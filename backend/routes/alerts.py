from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user, get_admin_user
from models.user import User
from models.parking import ParkingZone, ParkingSlot
from models.booking import Booking
from pydantic import BaseModel

router = APIRouter()

class EmergencyAlert(BaseModel):
    type: str        # police | ambulance | fire
    latitude: float
    longitude: float
    message: str = ""

@router.post("/emergency")
def log_emergency(data: EmergencyAlert, current_user: User = Depends(get_current_user)):
    numbers = {"police": "100", "ambulance": "108", "fire": "101"}
    return {
        "message": f"Emergency logged. Please call {numbers.get(data.type, '112')}",
        "number": numbers.get(data.type, "112"),
        "location": {"latitude": data.latitude, "longitude": data.longitude}
    }
