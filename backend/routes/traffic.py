from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from core.timeutil import utcnow, to_local
from models.booking import TrafficData
from models.parking import ParkingZone
from models.user import User, UserRole
from routes.zones import get_owned_zone

router = APIRouter()

class TrafficRecord(BaseModel):
    zone_id: int
    density: float = Field(ge=0, le=1)
    vehicle_count: int = Field(default=0, ge=0)

@router.get("/heatmap")
def get_heatmap_data(db: Session = Depends(get_db)):
    latest = db.query(TrafficData.zone_id, func.max(TrafficData.recorded_at).label("ts")) \
        .group_by(TrafficData.zone_id).subquery()
    densities = dict(
        db.query(TrafficData.zone_id, TrafficData.density)
        .join(latest, (TrafficData.zone_id == latest.c.zone_id) & (TrafficData.recorded_at == latest.c.ts))
        .all()
    )
    zones = db.query(ParkingZone).filter(ParkingZone.is_active.is_(True)).all()
    return [
        {"zone_id": z.id, "zone_name": z.name, "latitude": z.latitude, "longitude": z.longitude,
         "density": densities.get(z.id, 0.0), "weight": densities.get(z.id, 0.0)}
        for z in zones
    ]

@router.get("/predict/{zone_id}")
def predict_traffic(zone_id: int, db: Session = Depends(get_db)):
    since = utcnow() - timedelta(days=7)
    records = db.query(TrafficData).filter(TrafficData.zone_id == zone_id, TrafficData.recorded_at >= since).all()

    if not records:
        return {"zone_id": zone_id, "hourly_density": {}, "peak_hours": [], "best_travel_hours": [],
                "prediction_source": "none"}

    hourly: dict[int, list[float]] = {}
    for r in records:
        hourly.setdefault(to_local(r.recorded_at).hour, []).append(r.density)   # local hours, not UTC
    avg_hourly = {h: round(sum(v) / len(v), 2) for h, v in sorted(hourly.items())}
    by_density = sorted(avg_hourly, key=avg_hourly.get)
    return {
        "zone_id": zone_id,
        "hourly_density": avg_hourly,
        "peak_hours": sorted(by_density[-5:]),
        "best_travel_hours": sorted(by_density[:3]),
        "prediction_source": "historical",
    }

@router.post("/record", status_code=201)
def record_traffic(data: TrafficRecord, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(UserRole.admin, UserRole.vendor))):
    get_owned_zone(db, data.zone_id, user)
    db.add(TrafficData(zone_id=data.zone_id, density=data.density, vehicle_count=data.vehicle_count))
    db.commit()
    return {"message": "Traffic data recorded"}

@router.get("/summary")
def traffic_summary(db: Session = Depends(get_db)):
    avgs = dict(db.query(TrafficData.zone_id, func.avg(TrafficData.density)).group_by(TrafficData.zone_id).all())
    zones = db.query(ParkingZone).filter(ParkingZone.is_active.is_(True)).order_by(ParkingZone.id).all()
    return [{"zone_id": z.id, "zone_name": z.name, "avg_density": round(avgs.get(z.id) or 0.0, 2)} for z in zones]
