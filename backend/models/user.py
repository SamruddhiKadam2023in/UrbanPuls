from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum

class UserRole(str, enum.Enum):
    user = "user"
    vendor = "vendor"
    admin = "admin"
    police = "police"

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role          = Column(Enum(UserRole), default=UserRole.user)
    phone         = Column(String(20), nullable=True)
    points        = Column(Integer, default=0)
    preferred_lang = Column(String(10), default="en")
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    bookings   = relationship("Booking",   back_populates="user")
    complaints = relationship("Complaint", back_populates="user")
