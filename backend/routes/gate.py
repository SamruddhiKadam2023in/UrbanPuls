"""Vendor gate operations: check-in, walk-ins and pay-at-the-gate checkout."""
import logging
from datetime import timedelta
from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.security import require_roles
from core.timeutil import utcnow, fmt_local
from models.booking import Booking, BookingStatus, PaymentMethod
from models.parking import ParkingSlot, ParkingZone, VehicleType
from models.user import User, UserRole
from routes.bookings import normalize_vehicle
from routes.zones import get_owned_zone
from schemas import BookingOut, booking_out
from services import booking_service as bs
from services.live import zone_changed
from services.messages import render
from services.notify import notify
from services.pdf_service import generate_receipt

log = logging.getLogger("tpms.gate")
router = APIRouter()
gate_staff = require_roles(UserRole.vendor, UserRole.admin, UserRole.attendant)

class CheckInRequest(BaseModel):
    booking_code: str = Field(min_length=4, max_length=16)

class WalkInRequest(BaseModel):
    zone_id: int
    vehicle_number: str
    expected_hours: float = Field(default=1.0, gt=0, le=24)
    vehicle_type: VehicleType = VehicleType.four_wheeler
    slot_id: Optional[int] = None

    @field_validator("vehicle_number")
    @classmethod
    def _vehicle(cls, v: str) -> str:
        return normalize_vehicle(v)

class CheckOutRequest(BaseModel):
    booking_id: int
    payment_method: Optional[PaymentMethod] = None

# ── Helpers ───────────────────────────────────────────────────────────────────
def _managed_zone_ids(db: Session, user: User) -> list[int] | None:
    if user.role == UserRole.admin:
        return None
    return [z.id for z in db.query(ParkingZone.id).filter(ParkingZone.vendor_id == user.zone_owner_id).all()]

def _managed_booking(db: Session, user: User, *, booking_id: int | None = None, code: str | None = None) -> Booking:
    q = db.query(Booking)
    q = q.filter(Booking.id == booking_id) if booking_id is not None else q.filter(Booking.booking_code == code.strip().upper())
    booking = q.first()
    zone_ids = _managed_zone_ids(db, user)
    if not booking or (zone_ids is not None and booking.zone_id not in zone_ids):
        raise HTTPException(status_code=404, detail="Booking not found at your parking zones")
    return booking

def _quote(db: Session, booking: Booking) -> dict:
    now = utcnow()
    billed, fare = bs.fare_for(booking.checked_in_at, now, booking.price_per_hour)
    available_points = min(booking.points_to_redeem, booking.user.points) if booking.user else 0
    points_used, discount = bs.points_discount(available_points, fare)
    payable = round(fare - discount, 2)
    zone = booking.zone
    upi_uri = None
    if zone.upi_id and payable > 0:
        upi_uri = (f"upi://pay?pa={quote(zone.upi_id)}&pn={quote(zone.upi_name or zone.name)}"
                   f"&am={payable:.2f}&cu=INR&tn={quote('UrbanPuls ' + booking.booking_code)}")
    return {
        "booking": booking_out(booking),
        "checked_in_at": booking.checked_in_at,
        "calculated_at": now,
        "parked_minutes": int((now - booking.checked_in_at).total_seconds() // 60),
        "billed_minutes": billed,
        "fare": fare,
        "points_used": points_used,
        "discount": discount,
        "payable": payable,
        "upi_uri": upi_uri,
        "upi_id": zone.upi_id,
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/overview")
def gate_overview(zone_id: int, db: Session = Depends(get_db), user: User = Depends(gate_staff)):
    zone = get_owned_zone(db, zone_id, user)
    now = utcnow()
    parked = db.query(Booking).filter(Booking.zone_id == zone.id, Booking.status == BookingStatus.checked_in) \
        .order_by(Booking.checked_in_at).all()
    upcoming = db.query(Booking).filter(Booking.zone_id == zone.id, Booking.status == BookingStatus.reserved,
                                        Booking.start_time <= now + timedelta(hours=12)) \
        .order_by(Booking.start_time).all()
    free = bs.available_now_counts(db, [zone.id]).get(zone.id, 0)
    return {
        "zone": {"id": zone.id, "name": zone.name, "upi_id": zone.upi_id, "price_per_hour": zone.price_per_hour,
                 "two_wheeler_price_per_hour": zone.two_wheeler_price_per_hour,
                 "vehicle_types": sorted({s.vehicle_type.value for s in zone.slots if s.is_active})},
        "free_now": free,
        "parked": [booking_out(b) for b in parked],
        "upcoming": [booking_out(b) for b in upcoming],
        "grace_minutes": settings.BOOKING_GRACE_MINUTES,
    }

@router.get("/lookup", response_model=list[BookingOut])
def lookup(code: Optional[str] = None, vehicle: Optional[str] = None,
           db: Session = Depends(get_db), user: User = Depends(gate_staff)):
    if code:
        return [booking_out(_managed_booking(db, user, code=code))]
    if not vehicle:
        raise HTTPException(status_code=400, detail="Give a booking code or a vehicle number")
    try:
        vehicle = normalize_vehicle(vehicle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    q = db.query(Booking).filter(Booking.vehicle_number == vehicle,
                                 Booking.status.in_([BookingStatus.reserved, BookingStatus.checked_in]))
    zone_ids = _managed_zone_ids(db, user)
    if zone_ids is not None:
        q = q.filter(Booking.zone_id.in_(zone_ids))
    return [booking_out(b) for b in q.order_by(Booking.start_time).all()]

@router.post("/check-in", response_model=BookingOut)
def check_in(data: CheckInRequest, db: Session = Depends(get_db), user: User = Depends(gate_staff)):
    booking = _managed_booking(db, user, code=data.booking_code)
    now = utcnow()
    if booking.status == BookingStatus.checked_in:
        raise HTTPException(status_code=400, detail="This car is already checked in")
    if booking.status != BookingStatus.reserved:
        raise HTTPException(status_code=400, detail=f"This booking is {booking.status.value.replace('_', ' ')}")
    if now < booking.start_time - timedelta(minutes=settings.EARLY_CHECKIN_MINUTES):
        opens = booking.start_time - timedelta(minutes=settings.EARLY_CHECKIN_MINUTES)
        raise HTTPException(status_code=400, detail=f"Too early. Check-in opens at {fmt_local(opens)}")
    if now > booking.start_time + timedelta(minutes=settings.BOOKING_GRACE_MINUTES):
        booking.status = BookingStatus.no_show
        zone_changed(db, booking.zone_id)
        db.commit()
        raise HTTPException(status_code=400, detail="This reservation expired. Park the car as a walk-in instead.")

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).with_for_update().first()
    if slot.is_occupied or not slot.is_active:
        # The booked slot is blocked (e.g. the previous car overstayed): move to another free slot
        alternatives = [s for s in bs.free_slots(db, booking.zone_id, now, booking.end_time, booking.vehicle_type)
                        if s.id != slot.id]
        if not alternatives:
            raise HTTPException(status_code=409, detail="The booked slot is occupied and no other slot is free")
        slot = alternatives[0]
        booking.slot_id = slot.id

    booking.status = BookingStatus.checked_in
    booking.checked_in_at = now
    slot.is_occupied = True
    slot.vehicle_number = booking.vehicle_number
    notify(db, booking.user, "checkin", "checked_in", link="/bookings",
           vehicle=booking.vehicle_number, slot=slot.slot_number, zone=booking.zone.name)
    zone_changed(db, booking.zone_id)
    db.commit()
    db.refresh(booking)
    return booking_out(booking)

@router.post("/walk-in", status_code=201, response_model=BookingOut)
def walk_in(data: WalkInRequest, db: Session = Depends(get_db), user: User = Depends(gate_staff)):
    zone = get_owned_zone(db, data.zone_id, user)
    if not zone.is_active:
        raise HTTPException(status_code=400, detail="This zone is inactive")
    already = db.query(Booking.id).filter(Booking.zone_id == zone.id, Booking.vehicle_number == data.vehicle_number,
                                          Booking.status == BookingStatus.checked_in).first()
    if already:
        raise HTTPException(status_code=400, detail="This vehicle is already parked here")

    now = utcnow()
    end = now + timedelta(hours=data.expected_hours)
    if data.slot_id is not None:
        slot = db.query(ParkingSlot).filter(ParkingSlot.id == data.slot_id, ParkingSlot.zone_id == zone.id) \
            .with_for_update().first()
        if not slot or slot.vehicle_type != data.vehicle_type or not bs.slot_is_free(db, slot, now, end):
            raise HTTPException(status_code=409, detail="That slot is not free for the expected time")
    else:
        free = bs.free_slots(db, zone.id, now, end, data.vehicle_type)
        if not free:
            raise HTTPException(status_code=409, detail="No slot is free for the expected time")
        slot = db.query(ParkingSlot).filter(ParkingSlot.id == free[0].id).with_for_update().first()

    rate = zone.price_for(data.vehicle_type)
    _, estimate = bs.fare_for(now, end, rate)
    booking = Booking(
        booking_code=bs.new_booking_code(db), user_id=None, is_walk_in=True,
        slot_id=slot.id, zone_id=zone.id, vehicle_number=data.vehicle_number, vehicle_type=data.vehicle_type,
        start_time=now, end_time=end, checked_in_at=now,
        price_per_hour=rate, estimated_amount=estimate,
        status=BookingStatus.checked_in,
    )
    slot.is_occupied = True
    slot.vehicle_number = data.vehicle_number
    db.add(booking)
    zone_changed(db, zone.id)
    db.commit()
    db.refresh(booking)
    return booking_out(booking)

@router.get("/checkout-quote/{booking_id}")
def checkout_quote(booking_id: int, db: Session = Depends(get_db), user: User = Depends(gate_staff)):
    booking = _managed_booking(db, user, booking_id=booking_id)
    if booking.status != BookingStatus.checked_in:
        raise HTTPException(status_code=400, detail="Only parked cars can be checked out")
    return _quote(db, booking)

@router.post("/check-out", response_model=BookingOut)
def check_out(data: CheckOutRequest, db: Session = Depends(get_db), user: User = Depends(gate_staff)):
    booking = _managed_booking(db, user, booking_id=data.booking_id)
    if booking.status != BookingStatus.checked_in:
        raise HTTPException(status_code=400, detail="Only parked cars can be checked out")

    customer = None
    if booking.user_id:
        customer = db.query(User).filter(User.id == booking.user_id).with_for_update().first()
    q = _quote(db, booking)   # recalculated on the server, never taken from the client
    if q["payable"] > 0 and data.payment_method is None:
        raise HTTPException(status_code=400, detail="Record how the customer paid (cash or UPI)")

    if customer and q["points_used"]:
        customer.points -= q["points_used"]
    booking.status = BookingStatus.completed
    booking.checked_out_at = q["calculated_at"]
    booking.points_redeemed = q["points_used"]
    booking.discount_amount = q["discount"]
    booking.final_amount = q["payable"]
    booking.payment_method = data.payment_method if q["payable"] > 0 else None
    booking.payment_recorded_by = user.id

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).with_for_update().first()
    slot.is_occupied = False
    slot.vehicle_number = None

    try:
        booking.receipt_path = generate_receipt(booking, booking.zone, slot,
                                                customer.name if customer else "Walk-in customer")
    except Exception:
        log.exception("Receipt generation failed for booking %s", booking.id)
    method = booking.payment_method.value.upper() if booking.payment_method else None
    notify(db, customer, "checkout", "checked_out", link="/bookings", email=True,
           vehicle=booking.vehicle_number, zone=booking.zone.name, amount=f"{booking.final_amount:.2f}",
           method=lambda lang: render("checked_out_method", lang, method=method)[1] if method else "",
           points=lambda lang: render("checked_out_points", lang, n=booking.points_redeemed)[1] if booking.points_redeemed else "")
    zone_changed(db, booking.zone_id)
    db.commit()
    db.refresh(booking)
    return booking_out(booking)
