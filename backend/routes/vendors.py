from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user
from models.parking import ParkingZone, ParkingSlot
from models.booking import Booking, BookingStatus
from models.user import User

router = APIRouter()

@router.get("/my-zones")
def vendor_zones(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["vendor", "admin"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Vendor access required")
    zones = db.query(ParkingZone).filter(ParkingZone.vendor_id == current_user.id).all()
    result = []
    for z in zones:
        available = sum(1 for s in z.slots if not s.is_occupied)
        bookings_today = db.query(Booking).filter(Booking.zone_id == z.id, Booking.status == BookingStatus.active).count()
        result.append({**z.__dict__, "available_slots": available, "active_bookings": bookings_today})
    return result

@router.get("/stats")
def vendor_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    zones = db.query(ParkingZone).filter(ParkingZone.vendor_id == current_user.id).all()
    zone_ids = [z.id for z in zones]
    total_bookings = db.query(Booking).filter(Booking.zone_id.in_(zone_ids)).count()
    total_revenue  = sum(b.total_amount for b in db.query(Booking).filter(Booking.zone_id.in_(zone_ids), Booking.status == BookingStatus.active).all())
    return {"total_zones": len(zones), "total_bookings": total_bookings, "total_revenue": total_revenue}
