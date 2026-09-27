from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from core.database import Base
from core.timeutil import UTCDateTime, utcnow

class ParkingZone(Base):
    __tablename__ = "parking_zones"
    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(100), nullable=False)
    address        = Column(String(200), nullable=False)
    latitude       = Column(Float, nullable=False)
    longitude      = Column(Float, nullable=False)
    total_slots    = Column(Integer, default=0, nullable=False)
    price_per_hour = Column(Float, default=20.0, nullable=False)
    vendor_id      = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    upi_id         = Column(String(100), nullable=True)   # vendor's UPI ID, e.g. parking@okicici
    upi_name       = Column(String(100), nullable=True)   # payee name shown in UPI apps
    is_active      = Column(Boolean, default=True, nullable=False)
    created_at     = Column(UTCDateTime, default=utcnow, nullable=False)

    slots  = relationship("ParkingSlot", back_populates="zone", order_by="ParkingSlot.id")
    vendor = relationship("User", foreign_keys=[vendor_id])

class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    __table_args__ = (UniqueConstraint("zone_id", "slot_number", name="uq_slot_zone_number"),)
    id             = Column(Integer, primary_key=True, index=True)
    zone_id        = Column(Integer, ForeignKey("parking_zones.id"), nullable=False, index=True)
    slot_number    = Column(String(20), nullable=False)
    is_occupied    = Column(Boolean, default=False, nullable=False)   # a car is physically parked
    is_active      = Column(Boolean, default=True, nullable=False)    # vendor can take a slot out of use
    vehicle_number = Column(String(20), nullable=True)
    updated_at     = Column(UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False)

    zone     = relationship("ParkingZone", back_populates="slots")
    bookings = relationship("Booking",     back_populates="slot")
