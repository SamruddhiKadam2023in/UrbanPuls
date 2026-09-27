from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List
import json

from core.database import get_db
from models.booking import TrafficData
from models.parking import ParkingZone

router = APIRouter()

@router.get("/heatmap")
def get_heatmap_data(db: Session = Depends(get_db)):
    zones = db.query(ParkingZone).filter(ParkingZone.is_active == True).all()
    result = []
    for zone in zones:
        recent = db.query(TrafficData)\
            .filter(TrafficData.zone_id == zone.id)\
            .order_by(TrafficData.recorded_at.desc())\
            .first()
        density = recent.density if recent else 0.0
        result.append({
            "zone_id": zone.id,
            "zone_name": zone.name,
            "latitude": zone.latitude,
            "longitude": zone.longitude,
            "density": density,
            "weight": density
        })
    return result

@router.get("/predict/{zone_id}")
def predict_traffic(zone_id: int, db: Session = Depends(get_db)):
    # Get last 7 days of data grouped by hour
    since = datetime.utcnow() - timedelta(days=7)
    records = db.query(TrafficData)\
        .filter(TrafficData.zone_id == zone_id, TrafficData.recorded_at >= since)\
        .all()

    if not records:
        # Return dummy prediction if no data
        hourly = {h: round(0.3 + 0.4 * (1 if 8<=h<=10 or 17<=h<=20 else 0), 2) for h in range(24)}
        peak_hours = [8, 9, 10, 17, 18, 19, 20]
        best_hours = [h for h in range(24) if h not in peak_hours and 6 <= h <= 22]
        return {
            "zone_id": zone_id,
            "hourly_density": hourly,
            "peak_hours": peak_hours,
            "best_travel_hours": best_hours[:3],
            "prediction_source": "default"
        }

    # Aggregate by hour
    hourly = {}
    for r in records:
        h = r.recorded_at.hour
        if h not in hourly:
            hourly[h] = []
        hourly[h].append(r.density)
    avg_hourly = {h: round(sum(v)/len(v), 2) for h, v in hourly.items()}
    peak_hours = sorted(avg_hourly, key=lambda h: avg_hourly.get(h, 0), reverse=True)[:5]
    best_hours = sorted(avg_hourly, key=lambda h: avg_hourly.get(h, 0))[:3]

    return {
        "zone_id": zone_id,
        "hourly_density": avg_hourly,
        "peak_hours": peak_hours,
        "best_travel_hours": best_hours,
        "prediction_source": "historical"
    }

@router.post("/record")
def record_traffic(zone_id: int, density: float, vehicle_count: int = 0,
                   db: Session = Depends(get_db)):
    record = TrafficData(zone_id=zone_id, density=min(max(density, 0), 1), vehicle_count=vehicle_count)
    db.add(record)
    db.commit()
    return {"message": "Traffic data recorded"}

@router.get("/summary")
def traffic_summary(db: Session = Depends(get_db)):
    zones = db.query(ParkingZone).all()
    summary = []
    for zone in zones:
        avg = db.query(func.avg(TrafficData.density))\
            .filter(TrafficData.zone_id == zone.id)\
            .scalar() or 0.0
        summary.append({"zone_id": zone.id, "zone_name": zone.name, "avg_density": round(avg, 2)})
    return summary
