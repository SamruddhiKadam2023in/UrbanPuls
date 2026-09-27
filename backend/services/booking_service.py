"""Booking rules: pricing, slot availability, reservation limits and no-show handling."""
import math
import secrets
from datetime import datetime, timedelta
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from core.config import settings
from core.timeutil import utcnow
from models.booking import Booking, BookingStatus
from models.parking import ParkingSlot

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O/1/I to avoid misreading at the gate

def new_booking_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(10))
        if not db.query(Booking.id).filter(Booking.booking_code == code).first():
            return code

# ── Pricing ───────────────────────────────────────────────────────────────────
def billed_minutes(minutes: float) -> int:
    inc = settings.BILLING_INCREMENT_MINUTES
    minutes = max(minutes, settings.MIN_BILLED_MINUTES)
    # small tolerance so 60.0001 minutes is not billed as 90
    return int(math.ceil((minutes - 1e-6) / inc) * inc)

def fare_for(start: datetime, end: datetime, price_per_hour: float) -> tuple[int, float]:
    minutes = (end - start).total_seconds() / 60
    billed = billed_minutes(minutes)
    return billed, round(billed / 60 * price_per_hour, 2)

def points_discount(points_available: int, fare: float) -> tuple[int, float]:
    """Returns (points used, rupee discount), never discounting more than the fare."""
    if points_available <= 0 or fare <= 0:
        return 0, 0.0
    value = settings.POINT_VALUE_RUPEES
    used = min(points_available, math.ceil(fare / value))
    return used, round(min(used * value, fare), 2)

# ── Availability ──────────────────────────────────────────────────────────────
def _starts_now(start: datetime) -> bool:
    return start <= utcnow() + timedelta(minutes=1)

def conflict_filter(start: datetime, end: datetime):
    """Bookings that hold a slot at some point in [start, end)."""
    reserved = and_(Booking.status == BookingStatus.reserved,
                    Booking.start_time < end, Booking.end_time > start)
    # A parked car holds its slot until it checks out, even past its booked end time
    if _starts_now(start):
        parked = Booking.status == BookingStatus.checked_in
    else:
        parked = and_(Booking.status == BookingStatus.checked_in,
                      Booking.start_time < end, Booking.end_time > start)
    return or_(reserved, parked)

def slot_is_free(db: Session, slot: ParkingSlot, start: datetime, end: datetime,
                 exclude_booking_id: int | None = None) -> bool:
    if not slot.is_active:
        return False
    if slot.is_occupied and _starts_now(start):
        return False
    q = db.query(Booking.id).filter(Booking.slot_id == slot.id, conflict_filter(start, end))
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return q.first() is None

def free_slots(db: Session, zone_id: int, start: datetime, end: datetime) -> list[ParkingSlot]:
    busy = db.query(Booking.slot_id).filter(Booking.zone_id == zone_id, conflict_filter(start, end))
    q = db.query(ParkingSlot).filter(ParkingSlot.zone_id == zone_id,
                                     ParkingSlot.is_active.is_(True),
                                     ParkingSlot.id.not_in(busy))
    if _starts_now(start):
        q = q.filter(ParkingSlot.is_occupied.is_(False))
    return q.order_by(ParkingSlot.id).all()

def held_slot_ids_now(db: Session, zone_ids: list[int] | None = None) -> set[int]:
    """Slots reserved for right now (the car may not have arrived yet)."""
    now = utcnow()
    q = db.query(Booking.slot_id).filter(Booking.status == BookingStatus.reserved,
                                         Booking.start_time <= now, Booking.end_time > now)
    if zone_ids is not None:
        q = q.filter(Booking.zone_id.in_(zone_ids))
    return {row[0] for row in q.all()}

def available_now_counts(db: Session, zone_ids: list[int]) -> dict[int, int]:
    held = held_slot_ids_now(db, zone_ids)
    q = db.query(ParkingSlot.zone_id, func.count(ParkingSlot.id)).filter(
        ParkingSlot.zone_id.in_(zone_ids),
        ParkingSlot.is_active.is_(True),
        ParkingSlot.is_occupied.is_(False),
    )
    if held:
        q = q.filter(ParkingSlot.id.not_in(held))
    return dict(q.group_by(ParkingSlot.zone_id).all())

# ── Per-user limits ───────────────────────────────────────────────────────────
def active_booking_count(db: Session, user_id: int) -> int:
    return db.query(Booking).filter(Booking.user_id == user_id,
                                    Booking.status.in_([BookingStatus.reserved, BookingStatus.checked_in])).count()

def recent_no_show_count(db: Session, user_id: int) -> int:
    since = utcnow() - timedelta(days=settings.NO_SHOW_WINDOW_DAYS)
    return db.query(Booking).filter(Booking.user_id == user_id,
                                    Booking.status == BookingStatus.no_show,
                                    Booking.start_time >= since).count()

# ── Scheduled job ─────────────────────────────────────────────────────────────
def expire_no_shows(db: Session) -> list[Booking]:
    """Marks reservations whose car never arrived as no-shows. Safe to run from several workers."""
    cutoff = utcnow() - timedelta(minutes=settings.BOOKING_GRACE_MINUTES)
    expired = db.query(Booking).filter(Booking.status == BookingStatus.reserved,
                                       Booking.start_time < cutoff).all()
    for b in expired:
        b.status = BookingStatus.no_show
    if expired:
        db.commit()
    return expired
