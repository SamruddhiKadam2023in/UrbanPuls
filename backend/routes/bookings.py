import re
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import AwareDatetime, BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.ratelimit import limiter
from core.security import get_current_user, require_verified
from core.timeutil import to_utc, utcnow, fmt_local
from models.activity import Rating
from models.booking import Booking, BookingStatus
from models.parking import ParkingSlot, ParkingZone, VehicleType
from models.user import User, UserRole
from schemas import BookingOut, booking_out
from services import booking_service as bs
from services.live import zone_changed
from services.notify import notify

router = APIRouter()

VEHICLE_RE = re.compile(r"^[A-Z0-9]{4,12}$")

def normalize_vehicle(v: str) -> str:
    v = re.sub(r"[\s\-]", "", v).upper()
    if not VEHICLE_RE.match(v):
        raise ValueError("Enter a valid vehicle number, e.g. MH01AB1234")
    return v

class ReservationCreate(BaseModel):
    zone_id: int
    slot_id: int
    start_time: AwareDatetime
    end_time: AwareDatetime
    vehicle_number: str
    vehicle_type: VehicleType = VehicleType.four_wheeler
    points_to_redeem: int = Field(default=0, ge=0)

    @field_validator("vehicle_number")
    @classmethod
    def _vehicle(cls, v: str) -> str:
        return normalize_vehicle(v)

class ExtendRequest(BaseModel):
    end_time: AwareDatetime

class RatingCreate(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)

def validate_window(start, end) -> None:
    now = utcnow()
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    if start < now - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="Start time is in the past")
    if start > now + timedelta(days=settings.MAX_ADVANCE_DAYS):
        raise HTTPException(status_code=400, detail=f"Bookings can be made at most {settings.MAX_ADVANCE_DAYS} days ahead")
    if end - start > timedelta(hours=settings.MAX_BOOKING_HOURS):
        raise HTTPException(status_code=400, detail=f"A booking can be at most {settings.MAX_BOOKING_HOURS} hours long")

def _get_own_booking(db: Session, booking_id: int, user: User) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@router.post("/", status_code=201, response_model=BookingOut)
@limiter.limit("10/minute")
def create_reservation(request: Request, data: ReservationCreate, db: Session = Depends(get_db),
                       user: User = Depends(require_verified)):
    start, end = to_utc(data.start_time), to_utc(data.end_time)
    validate_window(start, end)

    if bs.recent_no_show_count(db, user.id) >= settings.NO_SHOW_LIMIT:
        raise HTTPException(status_code=403, detail=(
            f"Booking is paused because of {settings.NO_SHOW_LIMIT} missed reservations in the last "
            f"{settings.NO_SHOW_WINDOW_DAYS} days. You can still park as a walk-in at the gate."))
    if bs.active_booking_count(db, user.id) >= settings.MAX_ACTIVE_RESERVATIONS:
        raise HTTPException(status_code=400, detail=f"You can hold at most {settings.MAX_ACTIVE_RESERVATIONS} active bookings")
    if data.points_to_redeem > user.points:
        raise HTTPException(status_code=400, detail="You do not have that many points")

    zone = db.get(ParkingZone, data.zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=404, detail="Zone not found")

    # Lock the slot row so two people cannot reserve it at the same moment (PostgreSQL row lock)
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == data.slot_id, ParkingSlot.zone_id == zone.id) \
        .with_for_update().first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found in this zone")
    if slot.vehicle_type != data.vehicle_type:
        raise HTTPException(status_code=400, detail="This slot is for a different type of vehicle")
    if not bs.slot_is_free(db, slot, start, end):
        raise HTTPException(status_code=409, detail="This slot is already taken for part of that time. Please pick another slot.")

    rate = zone.price_for(data.vehicle_type)
    _, estimate = bs.fare_for(start, end, rate)
    booking = Booking(
        booking_code=bs.new_booking_code(db),
        user_id=user.id, slot_id=slot.id, zone_id=zone.id,
        vehicle_number=data.vehicle_number, vehicle_type=data.vehicle_type,
        start_time=start, end_time=end,
        price_per_hour=rate, estimated_amount=estimate,
        points_to_redeem=data.points_to_redeem,
        status=BookingStatus.reserved,
    )
    db.add(booking)
    db.flush()
    notify(db, user, "booking", "booking_reserved", link="/bookings", email=True,
           slot=slot.slot_number, zone=zone.name, start=fmt_local(start), code=booking.booking_code,
           grace=settings.BOOKING_GRACE_MINUTES)
    zone_changed(db, zone.id)
    db.commit()
    db.refresh(booking)
    return booking_out(booking)

@router.get("/my", response_model=list[BookingOut])
def my_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    return [booking_out(b) for b in bookings]

@router.get("/limits")
def my_limits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {
        "active_bookings": bs.active_booking_count(db, user.id),
        "max_active_bookings": settings.MAX_ACTIVE_RESERVATIONS,
        "recent_no_shows": bs.recent_no_show_count(db, user.id),
        "no_show_limit": settings.NO_SHOW_LIMIT,
        "grace_minutes": settings.BOOKING_GRACE_MINUTES,
        "point_value": settings.POINT_VALUE_RUPEES,
        "points": user.points,
    }

@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return booking_out(_get_own_booking(db, booking_id, user))

@router.delete("/{booking_id}")
def cancel_booking(booking_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    booking = _get_own_booking(db, booking_id, user)
    if booking.status != BookingStatus.reserved:
        raise HTTPException(status_code=400, detail="Only reservations that have not started parking can be cancelled")
    booking.status = BookingStatus.cancelled
    zone_changed(db, booking.zone_id)
    db.commit()
    return {"message": "Booking cancelled"}

@router.post("/{booking_id}/extend", response_model=BookingOut)
def extend_booking(booking_id: int, data: ExtendRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    booking = _get_own_booking(db, booking_id, user)
    if booking.status not in (BookingStatus.reserved, BookingStatus.checked_in):
        raise HTTPException(status_code=400, detail="Only upcoming or active bookings can be extended")
    new_end = to_utc(data.end_time)
    if new_end <= booking.end_time:
        raise HTTPException(status_code=400, detail="New end time must be later than the current one")
    if new_end - booking.start_time > timedelta(hours=settings.MAX_BOOKING_HOURS):
        raise HTTPException(status_code=400, detail=f"A booking can be at most {settings.MAX_BOOKING_HOURS} hours long")

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).with_for_update().first()
    clash = db.query(Booking.id).filter(
        Booking.slot_id == slot.id, Booking.id != booking.id,
        Booking.status == BookingStatus.reserved,
        Booking.start_time < new_end, Booking.end_time > booking.end_time,
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="The slot is reserved by someone else after your booking ends")

    booking.end_time = new_end
    _, booking.estimated_amount = bs.fare_for(booking.start_time, new_end, booking.price_per_hour)
    zone_changed(db, booking.zone_id)
    db.commit()
    db.refresh(booking)
    return booking_out(booking)

@router.post("/{booking_id}/rating", status_code=201)
def rate_booking(booking_id: int, data: RatingCreate, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    booking = _get_own_booking(db, booking_id, user)
    if booking.status != BookingStatus.completed:
        raise HTTPException(status_code=400, detail="You can rate a visit after checking out")
    if db.query(Rating.id).filter(Rating.booking_id == booking.id).first():
        raise HTTPException(status_code=400, detail="You already rated this visit")
    db.add(Rating(booking_id=booking.id, user_id=user.id, zone_id=booking.zone_id,
                  stars=data.stars, comment=data.comment.strip() or None))
    db.commit()
    return {"message": "Thanks for your rating"}

@router.get("/{booking_id}/receipt")
def download_receipt(booking_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    allowed = (booking.user_id == user.id or user.role == UserRole.admin
               or (user.role in (UserRole.vendor, UserRole.attendant) and booking.zone.vendor_id == user.zone_owner_id))
    if not allowed:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking.receipt_path:
        raise HTTPException(status_code=404, detail="The receipt is created when the car checks out")
    return FileResponse(booking.receipt_path, media_type="application/pdf", filename=f"receipt_{booking.booking_code}.pdf")
