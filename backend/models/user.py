from sqlalchemy import Column, Integer, String, Boolean, Enum, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base
from core.timeutil import UTCDateTime, utcnow
import enum

class UserRole(str, enum.Enum):
    user = "user"
    vendor = "vendor"
    admin = "admin"
    police = "police"          # shown as "Field Officer"
    attendant = "attendant"    # gate staff employed by a Parking Partner (vendor)

class User(Base):
    __tablename__ = "users"
    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String(100), nullable=False)
    email            = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password  = Column(String(100), nullable=False)
    role             = Column(Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False)
    phone            = Column(String(20), nullable=True)
    points           = Column(Integer, default=0, nullable=False)
    preferred_lang   = Column(String(10), default="en", nullable=False)
    is_active        = Column(Boolean, default=True, nullable=False)
    email_verified   = Column(Boolean, default=False, nullable=False)
    vendor_requested = Column(Boolean, default=False, nullable=False)   # awaiting admin approval
    employer_id      = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)   # attendants only
    terms_accepted_at = Column(UTCDateTime, nullable=True)   # consent record (DPDP Act); staff accounts: null
    created_at       = Column(UTCDateTime, default=utcnow, nullable=False)

    bookings   = relationship("Booking",   back_populates="user", foreign_keys="Booking.user_id")
    complaints = relationship("Complaint", back_populates="user", foreign_keys="Complaint.user_id")
    employer   = relationship("User", remote_side=[id])

    @property
    def zone_owner_id(self) -> int:
        """Whose parking zones this account works on: its own, or its employer's for gate attendants."""
        return self.employer_id if self.role == UserRole.attendant else self.id
