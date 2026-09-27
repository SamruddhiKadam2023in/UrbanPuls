from datetime import timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from core.timeutil import utcnow, to_local
from models.booking import Booking, BookingStatus
from models.parking import ParkingZone
from models.user import User, UserRole

router = APIRouter()
vendor_or_admin = require_roles(UserRole.vendor, UserRole.admin)

def _scope(q, db: Session, user: User):
    """Limits a Booking query to the caller's zones (admins see everything)."""
    if user.role == UserRole.admin:
        return q
    zone_ids = [z.id for z in db.query(ParkingZone.id).filter(ParkingZone.vendor_id == user.id).all()]
    return q.filter(Booking.zone_id.in_(zone_ids))

@router.get("/stats")
def vendor_stats(db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    zones_q = db.query(ParkingZone)
    if user.role != UserRole.admin:
        zones_q = zones_q.filter(ParkingZone.vendor_id == user.id)
    total_zones = zones_q.count()

    bookings = _scope(db.query(Booking), db, user)
    total_bookings = bookings.count()
    revenue = _scope(db.query(func.coalesce(func.sum(Booking.final_amount), 0.0))
                     .filter(Booking.status == BookingStatus.completed), db, user).scalar()
    parked_now = bookings.filter(Booking.status == BookingStatus.checked_in).count()
    no_shows = bookings.filter(Booking.status == BookingStatus.no_show).count()
    return {"total_zones": total_zones, "total_bookings": total_bookings, "total_revenue": float(revenue or 0),
            "parked_now": parked_now, "no_shows": no_shows}

@router.get("/trend")
def booking_trend(days: int = 7, db: Session = Depends(get_db), user: User = Depends(vendor_or_admin)):
    """Bookings created and revenue collected per local day."""
    days = max(1, min(days, 90))
    today = to_local(utcnow()).date()
    buckets = {today - timedelta(days=i): {"bookings": 0, "revenue": 0.0} for i in range(days - 1, -1, -1)}
    since = utcnow() - timedelta(days=days + 1)

    for b in _scope(db.query(Booking).filter(Booking.created_at >= since), db, user).all():
        day = to_local(b.created_at).date()
        if day in buckets:
            buckets[day]["bookings"] += 1
    for b in _scope(db.query(Booking).filter(Booking.status == BookingStatus.completed,
                                             Booking.checked_out_at >= since), db, user).all():
        day = to_local(b.checked_out_at).date()
        if day in buckets:
            buckets[day]["revenue"] += b.final_amount or 0

    return [{"date": d.isoformat(), "day": d.strftime("%a"), "bookings": v["bookings"],
             "revenue": round(v["revenue"], 2)} for d, v in buckets.items()]
