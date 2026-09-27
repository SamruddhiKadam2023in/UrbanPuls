from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db
from core.security import get_current_user, get_admin_user
from models.parking import ParkingZone, ParkingSlot
from models.user import User

router = APIRouter()

class ZoneCreate(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    total_slots: int
    price_per_hour: float = 20.0
    vendor_id: Optional[int] = None

class SlotResponse(BaseModel):
    id: int
    slot_number: str
    is_occupied: bool
    vehicle_number: Optional[str]
    class Config:
        from_attributes = True

class ZoneResponse(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    total_slots: int
    price_per_hour: float
    available_slots: int
    slots: List[SlotResponse] = []
    class Config:
        from_attributes = True

@router.get("/", response_model=List[ZoneResponse])
def get_all_zones(db: Session = Depends(get_db)):
    zones = db.query(ParkingZone).filter(ParkingZone.is_active == True).all()
    result = []
    for z in zones:
        available = sum(1 for s in z.slots if not s.is_occupied)
        result.append({
            "id": z.id, "name": z.name, "address": z.address,
            "latitude": z.latitude, "longitude": z.longitude,
            "total_slots": z.total_slots, "price_per_hour": z.price_per_hour,
            "available_slots": available, "slots": z.slots
        })
    return result

@router.get("/{zone_id}", response_model=ZoneResponse)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.query(ParkingZone).filter(ParkingZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    available = sum(1 for s in zone.slots if not s.is_occupied)
    return {**zone.__dict__, "available_slots": available, "slots": zone.slots}

@router.post("/", status_code=201)
def create_zone(data: ZoneCreate, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    zone = ParkingZone(**data.dict())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    # Auto-create slots
    for i in range(1, data.total_slots + 1):
        slot = ParkingSlot(zone_id=zone.id, slot_number=f"S{i:03d}")
        db.add(slot)
    db.commit()
    return {"message": "Zone created", "zone_id": zone.id}

@router.patch("/{zone_id}/slots/{slot_id}")
def update_slot(zone_id: int, slot_id: int, is_occupied: bool,
                vehicle_number: Optional[str] = None,
                db: Session = Depends(get_db)):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id, ParkingSlot.zone_id == zone_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_occupied = is_occupied
    slot.vehicle_number = vehicle_number
    db.commit()
    return {"message": "Slot updated"}

@router.get("/{zone_id}/slots", response_model=List[SlotResponse])
def get_slots(zone_id: int, db: Session = Depends(get_db)):
    return db.query(ParkingSlot).filter(ParkingSlot.zone_id == zone_id).all()
