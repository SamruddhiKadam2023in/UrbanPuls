from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class ParkingZone(Base):
    __tablename__ = "parking_zones"
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(100), nullable=False)
    address      = Column(String(200), nullable=False)
    latitude     = Column(Float, nullable=False)
    longitude    = Column(Float, nullable=False)
    total_slots  = Column(Integer, default=0)
    price_per_hour = Column(Float, default=20.0)
    vendor_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    slots  = relationship("ParkingSlot", back_populates="zone")
    vendor = relationship("User", foreign_keys=[vendor_id])

class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    id          = Column(Integer, primary_key=True, index=True)
    zone_id     = Column(Integer, ForeignKey("parking_zones.id"), nullable=False)
    slot_number = Column(String(20), nullable=False)
    is_occupied = Column(Boolean, default=False)
    vehicle_number = Column(String(20), nullable=True)
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    zone     = relationship("ParkingZone", back_populates="slots")
    bookings = relationship("Booking",     back_populates="slot")
