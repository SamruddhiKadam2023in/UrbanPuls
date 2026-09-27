from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from core.security import get_current_user
from models.user import User

router = APIRouter()

EMERGENCY_NUMBERS = {"police": "100", "ambulance": "108", "fire": "101", "general": "112"}

class EmergencyAlert(BaseModel):
    type: Literal["police", "ambulance", "fire", "general"]
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    message: str = Field(default="", max_length=500)

@router.post("/emergency")
def log_emergency(data: EmergencyAlert, current_user: User = Depends(get_current_user)):
    number = EMERGENCY_NUMBERS[data.type]
    return {
        "message": f"Please call {number}",
        "number": number,
        "location": {"latitude": data.latitude, "longitude": data.longitude},
    }
