from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from core.database import Base
from core.timeutil import UTCDateTime, utcnow
import enum

class BookingStatus(str, enum.Enum):
    reserved   = "reserved"     # booked online, car not yet arrived
    checked_in = "checked_in"   # car is parked
    completed  = "completed"    # checked out and paid at the gate
    cancelled  = "cancelled"
    no_show    = "no_show"      # never arrived within the grace period

# Statuses that hold a slot
HOLDING_STATUSES = (BookingStatus.reserved, BookingStatus.checked_in)

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    upi  = "upi"

class Booking(Base):
    __tablename__ = "bookings"
    id                = Column(Integer, primary_key=True, index=True)
    booking_code      = Column(String(16), unique=True, index=True, nullable=False)  # shown as QR code
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # null for walk-ins
    slot_id           = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    zone_id           = Column(Integer, ForeignKey("parking_zones.id"), nullable=False, index=True)
    vehicle_number    = Column(String(20), nullable=False)
    is_walk_in        = Column(Boolean, default=False, nullable=False)
    status            = Column(Enum(BookingStatus, name="booking_status"), default=BookingStatus.reserved, nullable=False, index=True)

    start_time        = Column(UTCDateTime, nullable=False)   # reserved window
    end_time          = Column(UTCDateTime, nullable=False)
    checked_in_at     = Column(UTCDateTime, nullable=True)
    checked_out_at    = Column(UTCDateTime, nullable=True)

    price_per_hour    = Column(Float, nullable=False)          # locked in at booking time
    estimated_amount  = Column(Float, nullable=False)
    points_to_redeem  = Column(Integer, default=0, nullable=False)
    points_redeemed   = Column(Integer, default=0, nullable=False)
    discount_amount   = Column(Float, default=0.0, nullable=False)
    final_amount      = Column(Float, nullable=True)            # set at checkout
    payment_method    = Column(Enum(PaymentMethod, name="payment_method"), nullable=True)
    payment_recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    receipt_path      = Column(String(300), nullable=True)
    created_at        = Column(UTCDateTime, default=utcnow, nullable=False)
    updated_at        = Column(UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User",        back_populates="bookings", foreign_keys=[user_id])
    slot = relationship("ParkingSlot", back_populates="bookings")
    zone = relationship("ParkingZone")

class ComplaintType(str, enum.Enum):
    illegal_parking    = "illegal_parking"
    road_blockage      = "road_blockage"
    signal_malfunction = "signal_malfunction"
    accident           = "accident"
    vendor_issue       = "vendor_issue"

class ComplaintStatus(str, enum.Enum):
    pending  = "pending"
    verified = "verified"
    rejected = "rejected"
    resolved = "resolved"

class Complaint(Base):
    __tablename__ = "complaints"
    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    complaint_type  = Column(Enum(ComplaintType, name="complaint_type"), nullable=False)
    description     = Column(Text, nullable=True)
    latitude        = Column(Float, nullable=False)
    longitude       = Column(Float, nullable=False)
    photo_url       = Column(String(500), nullable=True)
    video_url       = Column(String(500), nullable=True)
    status          = Column(Enum(ComplaintStatus, name="complaint_status"), default=ComplaintStatus.pending, nullable=False, index=True)
    points_awarded  = Column(Integer, default=0, nullable=False)
    fine_generated  = Column(Boolean, default=False, nullable=False)
    fine_path       = Column(String(300), nullable=True)
    police_notified = Column(Boolean, default=False, nullable=False)
    reviewed_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(UTCDateTime, default=utcnow, nullable=False)
    updated_at      = Column(UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="complaints", foreign_keys=[user_id])

class TrafficData(Base):
    __tablename__ = "traffic_data"
    id            = Column(Integer, primary_key=True, index=True)
    zone_id       = Column(Integer, ForeignKey("parking_zones.id"), nullable=False, index=True)
    density       = Column(Float, nullable=False)   # 0.0 – 1.0
    vehicle_count = Column(Integer, default=0, nullable=False)
    recorded_at   = Column(UTCDateTime, default=utcnow, nullable=False, index=True)

class DetectionLog(Base):
    __tablename__ = "detection_logs"
    id           = Column(Integer, primary_key=True, index=True)
    image_url    = Column(String(500), nullable=True)
    detections   = Column(Text, nullable=True)   # JSON string
    zone_id      = Column(Integer, ForeignKey("parking_zones.id"), nullable=True)
    is_violation = Column(Boolean, default=False, nullable=False)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at   = Column(UTCDateTime, default=utcnow, nullable=False)
