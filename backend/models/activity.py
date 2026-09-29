from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, SmallInteger, CheckConstraint, Enum
from sqlalchemy.orm import relationship, backref
from core.database import Base
from core.timeutil import UTCDateTime, utcnow
from models.booking import ComplaintStatus

class Notification(Base):
    __tablename__ = "notifications"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type       = Column(String(30), nullable=False)      # booking, checkin, checkout, reminder, no_show, complaint, account
    title      = Column(String(150), nullable=False)
    message    = Column(Text, nullable=False)
    link       = Column(String(200), nullable=True)      # in-app path, e.g. /bookings
    is_read    = Column(Boolean, default=False, nullable=False)
    created_at = Column(UTCDateTime, default=utcnow, nullable=False, index=True)

class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (CheckConstraint("stars BETWEEN 1 AND 5", name="ck_rating_stars"),)
    id         = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True)   # one rating per visit
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    zone_id    = Column(Integer, ForeignKey("parking_zones.id"), nullable=False, index=True)
    stars      = Column(SmallInteger, nullable=False)
    comment    = Column(Text, nullable=True)
    created_at = Column(UTCDateTime, default=utcnow, nullable=False)

    user    = relationship("User")
    booking = relationship("Booking", backref=backref("rating", uselist=False))

class ComplaintEvent(Base):
    """One entry per status change, shown to the reporter as a timeline."""
    __tablename__ = "complaint_events"
    id           = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    status       = Column(Enum(ComplaintStatus, name="complaint_status", create_type=False), nullable=False)
    note         = Column(Text, nullable=True)
    actor_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at   = Column(UTCDateTime, default=utcnow, nullable=False)

    actor = relationship("User")

class Camera(Base):
    """A fixed viewpoint (e.g. a CCTV camera) with no-parking areas drawn on its reference photo."""
    __tablename__ = "cameras"
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(100), nullable=False)
    zone_id      = Column(Integer, ForeignKey("parking_zones.id"), nullable=True, index=True)
    owner_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    image_url    = Column(String(500), nullable=False)
    image_width  = Column(Integer, nullable=False)
    image_height = Column(Integer, nullable=False)
    areas        = Column(Text, nullable=False, default="[]")   # JSON: [[[x, y], ...], ...], normalised 0..1
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(UTCDateTime, default=utcnow, nullable=False)

    zone  = relationship("ParkingZone")
    owner = relationship("User")
