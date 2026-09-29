"""Response shapes shared by several routers."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from models.booking import Booking

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str
    points: int
    phone: Optional[str] = None
    preferred_lang: str
    email_verified: bool
    vendor_requested: bool
    is_active: bool
    created_at: Optional[datetime] = None
    employer_id: Optional[int] = None

class SlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slot_number: str
    is_occupied: bool
    is_active: bool
    is_available_now: bool = True
    vehicle_type: str = "four_wheeler"

class ZoneOut(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    total_slots: int
    price_per_hour: float
    two_wheeler_price_per_hour: Optional[float] = None
    available_slots: int
    # Per vehicle type: {"four_wheeler": n, "two_wheeler": n}
    available_by_type: dict[str, int] = {}
    slots_by_type: dict[str, int] = {}
    is_active: bool
    vendor_id: Optional[int] = None
    upi_id: Optional[str] = None
    upi_name: Optional[str] = None
    avg_rating: Optional[float] = None
    rating_count: int = 0
    slots: list[SlotOut] = []

class BookingOut(BaseModel):
    id: int
    booking_code: str
    zone_id: int
    zone_name: str
    zone_address: str
    slot_id: int
    slot_number: str
    vehicle_number: str
    vehicle_type: str = "four_wheeler"
    customer_name: Optional[str]
    is_walk_in: bool
    status: str
    start_time: datetime
    end_time: datetime
    checked_in_at: Optional[datetime]
    checked_out_at: Optional[datetime]
    price_per_hour: float
    estimated_amount: float
    points_to_redeem: int
    points_redeemed: int
    discount_amount: float
    final_amount: Optional[float]
    payment_method: Optional[str]
    has_receipt: bool
    rating: Optional[int] = None
    created_at: datetime

def booking_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id, booking_code=b.booking_code,
        zone_id=b.zone_id, zone_name=b.zone.name, zone_address=b.zone.address,
        slot_id=b.slot_id, slot_number=b.slot.slot_number,
        vehicle_number=b.vehicle_number, vehicle_type=b.vehicle_type.value,
        customer_name=b.user.name if b.user else None,
        is_walk_in=b.is_walk_in, status=b.status.value,
        start_time=b.start_time, end_time=b.end_time,
        checked_in_at=b.checked_in_at, checked_out_at=b.checked_out_at,
        price_per_hour=b.price_per_hour, estimated_amount=b.estimated_amount,
        points_to_redeem=b.points_to_redeem, points_redeemed=b.points_redeemed,
        discount_amount=b.discount_amount, final_amount=b.final_amount,
        payment_method=b.payment_method.value if b.payment_method else None,
        has_receipt=bool(b.receipt_path), rating=b.rating.stars if b.rating else None,
        created_at=b.created_at,
    )
