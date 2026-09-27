from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum

class BookingStatus(str, enum.Enum):
    active    = "active"
    expired   = "expired"
    cancelled = "cancelled"
    completed = "completed"

class Booking(Base):
    __tablename__ = "bookings"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"),         nullable=False)
    slot_id        = Column(Integer, ForeignKey("parking_slots.id"), nullable=False)
    zone_id        = Column(Integer, ForeignKey("parking_zones.id"), nullable=False)
    start_time     = Column(DateTime(timezone=True), nullable=False)
    end_time       = Column(DateTime(timezone=True), nullable=False)
    total_amount   = Column(Float, nullable=False)
    status         = Column(Enum(BookingStatus), default=BookingStatus.active)
    payment_id     = Column(String(100), nullable=True)
    razorpay_order_id = Column(String(100), nullable=True)
    receipt_url    = Column(String(300), nullable=True)
    vehicle_number = Column(String(20), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User",        back_populates="bookings")
    slot = relationship("ParkingSlot", back_populates="bookings")

class ComplaintType(str, enum.Enum):
    illegal_parking = "illegal_parking"
    road_blockage   = "road_blockage"
    signal_malfunction = "signal_malfunction"
    accident        = "accident"
    vendor_issue    = "vendor_issue"

class ComplaintStatus(str, enum.Enum):
    pending  = "pending"
    verified = "verified"
    rejected = "rejected"
    resolved = "resolved"

class Complaint(Base):
    __tablename__ = "complaints"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    complaint_type = Column(Enum(ComplaintType), nullable=False)
    description    = Column(Text, nullable=True)
    latitude       = Column(Float, nullable=False)
    longitude      = Column(Float, nullable=False)
    photo_url      = Column(String(500), nullable=True)
    video_url      = Column(String(500), nullable=True)
    status         = Column(Enum(ComplaintStatus), default=ComplaintStatus.pending)
    points_awarded = Column(Integer, default=0)
    fine_generated = Column(Boolean, default=False)
    police_notified = Column(Boolean, default=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user = relationship("User", back_populates="complaints")

class TrafficData(Base):
    __tablename__ = "traffic_data"
    id          = Column(Integer, primary_key=True, index=True)
    zone_id     = Column(Integer, ForeignKey("parking_zones.id"), nullable=False)
    density     = Column(Float, nullable=False)   # 0.0 – 1.0
    vehicle_count = Column(Integer, default=0)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

class DetectionLog(Base):
    __tablename__ = "detection_logs"
    id            = Column(Integer, primary_key=True, index=True)
    image_url     = Column(String(500), nullable=True)
    detections    = Column(Text, nullable=True)   # JSON string
    zone_id       = Column(Integer, ForeignKey("parking_zones.id"), nullable=True)
    is_violation  = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
