from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from core.database import get_db
from core.security import require_roles, get_current_user
from core.timeutil import to_utc
from models.activity import Rating
from models.parking import ParkingZone, ParkingSlot
from models.user import User, UserRole
from schemas import ZoneOut, SlotOut
from services import booking_service as bs
from services.live import zone_changed

router = APIRouter()
vendor_or_admin = require_roles(UserRole.vendor, UserRole.admin)

UPI_ID_PATTERN = r"^[A-Za-z0-9.\-_]{2,256}@[A-Za-z]{2,64}$"

class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    total_slots: int = Field(ge=1, le=2000)
    price_per_hour: float = Field(default=20.0, gt=0, le=10000)
    upi_id: Optional[str] = Field(default=None, pattern=UPI_ID_PATTERN)
    upi_name: Optional[str] = Field(default=None, max_length=100)
    vendor_id: Optional[int] = None   # admins only; vendors always own the zones they create

class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    address: Optional[str] = Field(default=None, min_length=1, max_length=200)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    price_per_hour: Optional[float] = Field(default=None, gt=0, le=10000)
    upi_id: Optional[str] = Field(default=None, pattern=UPI_ID_PATTERN)
    upi_name: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None

class SlotsAdd(BaseModel):
    count: int = Field(ge=1, le=500)

class SlotUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_occupied: Optional[bool] = None   # manual override, e.g. a car parked without using the gate

# ── Helpers ───────────────────────────────────────────────────────────────────
def rating_stats(db: Session, zone_ids: list[int]) -> dict[int, tuple[float, int]]:
    if not zone_ids:
        return {}
    rows = db.query(Rating.zone_id, func.avg(Rating.stars), func.count(Rating.id)) \
        .filter(Rating.zone_id.in_(zone_ids)).group_by(Rating.zone_id).all()
    return {z: (round(float(avg), 1), n) for z, avg, n in rows}

def zone_out(zone: ParkingZone, available: int, held: set[int], with_slots: bool,
             ratings: dict | None = None, private: bool = False) -> ZoneOut:
    slots = []
    if with_slots:
        slots = [SlotOut(id=s.id, slot_number=s.slot_number, is_occupied=s.is_occupied, is_active=s.is_active,
                         is_available_now=s.is_active and not s.is_occupied and s.id not in held)
                 for s in zone.slots]
    avg, count = (ratings or {}).get(zone.id, (None, 0))
    return ZoneOut(id=zone.id, name=zone.name, address=zone.address, latitude=zone.latitude,
                   longitude=zone.longitude, total_slots=sum(1 for s in zone.slots if s.is_active),
                   price_per_hour=zone.price_per_hour, available_slots=available,
                   is_active=zone.is_active, vendor_id=zone.vendor_id,
                   upi_id=zone.upi_id if private else None, upi_name=zone.upi_name if private else None,
                   avg_rating=avg, rating_count=count, slots=slots)

def get_owned_zone(db: Session, zone_id: int, user: User) -> ParkingZone:
    zone = db.get(ParkingZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    if user.role != UserRole.admin and zone.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="This zone belongs to another Parking Partner")
    return zone

def _add_slots(db: Session, zone: ParkingZone, count: int) -> None:
    existing = {s.slot_number for s in zone.slots}
    n = 1
    added = 0
    while added < count:
        number = f"S{n:03d}"
        if number not in existing:
            db.add(ParkingSlot(zone_id=zone.id, slot_number=number))
            added += 1
        n += 1

def _sync_total(db: Session, zone: ParkingZone) -> None:
    db.flush()
    db.refresh(zone)
    zone.total_slots = sum(1 for s in zone.slots if s.is_active)

# ── Public ────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[ZoneOut])
def get_all_zones(db: Session = Depends(get_db)):
    zones = db.query(ParkingZone).options(selectinload(ParkingZone.slots)) \
        .filter(ParkingZone.is_active.is_(True)).order_by(ParkingZone.id).all()
    ids = [z.id for z in zones]
    counts = bs.available_now_counts(db, ids) if ids else {}
    held = bs.held_slot_ids_now(db, ids) if ids else set()
    ratings = rating_stats(db, ids)
    return [zone_out(z, counts.get(z.id, 0), held, with_slots=True, ratings=ratings) for z in zones]

@router.get("/{zone_id}", response_model=ZoneOut)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.get(ParkingZone, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=404, detail="Zone not found")
    counts = bs.available_now_counts(db, [zone.id])
    return zone_out(zone, counts.get(zone.id, 0), bs.held_slot_ids_now(db, [zone.id]), with_slots=True,
                    ratings=rating_stats(db, [zone.id]))

@router.get("/{zone_id}/ratings")
def zone_ratings(zone_id: int, db: Session = Depends(get_db)):
    rows = db.query(Rating).filter(Rating.zone_id == zone_id).order_by(Rating.created_at.desc()).limit(20).all()
    # Only the first name is shown publicly
    return [{"stars": r.stars, "comment": r.comment, "created_at": r.created_at,
             "by": r.user.name.split()[0] if r.user else None} for r in rows]

@router.get("/{zone_id}/availability")
def get_availability(zone_id: int, start: AwareDatetime, end: AwareDatetime, db: Session = Depends(get_db)):
    """Slots that are free for the whole of [start, end), plus the estimated fare."""
    zone = db.get(ParkingZone, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=404, detail="Zone not found")
    start, end = to_utc(start), to_utc(end)
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    free = bs.free_slots(db, zone_id, start, end)
    billed, fare = bs.fare_for(start, end, zone.price_per_hour)
    return {
        "zone_id": zone_id,
        "slots": [{"id": s.id, "slot_number": s.slot_number} for s in free],
        "billed_minutes": billed,
        "estimated_amount": fare,
        "price_per_hour": zone.price_per_hour,
    }

@router.get("/{zone_id}/slots", response_model=list[SlotOut])
def get_slots(zone_id: int, db: Session = Depends(get_db)):
    held = bs.held_slot_ids_now(db, [zone_id])
    slots = db.query(ParkingSlot).filter(ParkingSlot.zone_id == zone_id).order_by(ParkingSlot.id).all()
    return [SlotOut(id=s.id, slot_number=s.slot_number, is_occupied=s.is_occupied, is_active=s.is_active,
                    is_available_now=s.is_active and not s.is_occupied and s.id not in held) for s in slots]

# ── Vendor / admin management ─────────────────────────────────────────────────
@router.post("/", status_code=201)
def create_zone(data: ZoneCreate, db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    vendor_id = user.id
    if user.role == UserRole.admin and data.vendor_id is not None:
        vendor = db.get(User, data.vendor_id)
        if not vendor or vendor.role != UserRole.vendor:
            raise HTTPException(status_code=400, detail="vendor_id must belong to a Parking Partner account")
        vendor_id = vendor.id
    zone = ParkingZone(**data.model_dump(exclude={"vendor_id", "total_slots"}), vendor_id=vendor_id, total_slots=0)
    db.add(zone)
    db.flush()
    _add_slots(db, zone, data.total_slots)
    _sync_total(db, zone)
    zone_changed(db, zone.id)
    db.commit()
    return {"message": "Zone created", "zone_id": zone.id}

@router.patch("/{zone_id}")
def update_zone(zone_id: int, data: ZoneUpdate, db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    zone = get_owned_zone(db, zone_id, user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(zone, field, value)
    zone_changed(db, zone.id)
    db.commit()
    return {"message": "Zone updated"}

@router.post("/{zone_id}/slots", status_code=201)
def add_slots(zone_id: int, data: SlotsAdd, db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    zone = get_owned_zone(db, zone_id, user)
    _add_slots(db, zone, data.count)
    _sync_total(db, zone)
    zone_changed(db, zone.id)
    db.commit()
    return {"message": f"{data.count} slot(s) added", "total_slots": zone.total_slots}

@router.patch("/{zone_id}/slots/{slot_id}")
def update_slot(zone_id: int, slot_id: int, data: SlotUpdate,
                db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    zone = get_owned_zone(db, zone_id, user)
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id, ParkingSlot.zone_id == zone.id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if data.is_active is not None:
        slot.is_active = data.is_active
    if data.is_occupied is not None:
        slot.is_occupied = data.is_occupied
        if not data.is_occupied:
            slot.vehicle_number = None
    _sync_total(db, zone)
    zone_changed(db, zone.id)
    db.commit()
    return {"message": "Slot updated"}

@router.get("/manage/mine", response_model=list[ZoneOut])
def my_zones(db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    """Zones the caller manages, including inactive ones (admins see all)."""
    q = db.query(ParkingZone).options(selectinload(ParkingZone.slots))
    if user.role != UserRole.admin:
        q = q.filter(ParkingZone.vendor_id == user.id)
    zones = q.order_by(ParkingZone.id).all()
    ids = [z.id for z in zones]
    counts = bs.available_now_counts(db, ids) if ids else {}
    held = bs.held_slot_ids_now(db, ids) if ids else set()
    ratings = rating_stats(db, ids)
    return [zone_out(z, counts.get(z.id, 0), held, with_slots=True, ratings=ratings, private=True) for z in zones]
