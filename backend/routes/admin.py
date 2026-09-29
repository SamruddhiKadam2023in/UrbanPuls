from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from datetime import datetime, time

from core.database import get_db
from core.security import get_admin_user, hash_password, validate_password
from core.timeutil import utcnow, to_local, LOCAL_TZ
from models.booking import Booking, BookingStatus, Complaint, ComplaintStatus
from models.parking import ParkingZone
from models.user import User, UserRole
from schemas import UserOut
from services.notify import notify

router = APIRouter()

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: UserRole

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

    @field_validator("role")
    @classmethod
    def _role(cls, v: UserRole) -> UserRole:
        if v == UserRole.attendant:
            raise ValueError("Gate attendants are added by their Parking Partner from the Staff page")
        return v

class UserUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    vendor_requested: Optional[bool] = None   # set False to decline a vendor request

@router.get("/users", response_model=list[UserOut])
def list_users(role: Optional[UserRole] = None, vendor_requested: Optional[bool] = None,
               search: Optional[str] = None, limit: int = 200,
               db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    q = db.query(User)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.filter(func.lower(User.name).like(term) | func.lower(User.email).like(term))
    if role:
        q = q.filter(User.role == role)
    if vendor_requested is not None:
        q = q.filter(User.vendor_requested.is_(vendor_requested))
    return q.order_by(User.created_at.desc()).limit(max(1, min(limit, 500))).all()

@router.post("/users", status_code=201, response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """Staff accounts (Field Officers, Parking Partners, other admins) are created here rather than through sign-up."""
    email = data.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(name=data.name.strip(), email=email, phone=data.phone, role=data.role,
                hashed_password=hash_password(data.password), email_verified=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and (data.role not in (None, UserRole.admin) or data.is_active is False):
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access")
    if data.role == UserRole.attendant and user.role != UserRole.attendant:
        raise HTTPException(status_code=400, detail="Gate attendants are added by their Parking Partner from the Staff page")
    was_requested = user.vendor_requested
    if data.role is not None and data.role != user.role:
        user.role = data.role
        if data.role != UserRole.attendant:
            user.employer_id = None
        if data.role == UserRole.vendor:
            user.vendor_requested = False
            notify(db, user, "account", "vendor_approved", link="/zones", email=True)
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.vendor_requested is False and was_requested and user.role != UserRole.vendor:
        user.vendor_requested = False
        notify(db, user, "account", "vendor_declined", email=True)
    elif data.vendor_requested is not None:
        user.vendor_requested = data.vendor_requested
    db.commit()
    db.refresh(user)
    return user


# ── Admin home ────────────────────────────────────────────────────────────────
@router.get("/summary")
def admin_summary(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """What needs an administrator's attention, plus platform totals for today."""
    since = datetime.combine(to_local(utcnow()).date(), time.min, LOCAL_TZ)
    role_counts = dict(db.query(User.role, func.count(User.id)).filter(User.is_active.is_(True)).group_by(User.role).all())
    revenue = db.query(func.coalesce(func.sum(Booking.final_amount), 0.0)) \
        .filter(Booking.status == BookingStatus.completed, Booking.checked_out_at >= since).scalar()
    return {
        "attention": {
            "pending_complaints": db.query(Complaint).filter(Complaint.status == ComplaintStatus.pending).count(),
            "partner_requests": db.query(User).filter(User.vendor_requested.is_(True), User.role == UserRole.user).count(),
            "verified_open": db.query(Complaint).filter(Complaint.status == ComplaintStatus.verified).count(),
            "no_shows_today": db.query(Booking).filter(Booking.status == BookingStatus.no_show, Booking.start_time >= since).count(),
            "unverified_users": db.query(User).filter(User.email_verified.is_(False), User.is_active.is_(True)).count(),
        },
        "today": {
            "bookings": db.query(Booking).filter(Booking.created_at >= since).count(),
            "parked_now": db.query(Booking).filter(Booking.status == BookingStatus.checked_in).count(),
            "revenue": float(revenue or 0),
            "complaints": db.query(Complaint).filter(Complaint.created_at >= since).count(),
        },
        "platform": {
            "users": role_counts.get(UserRole.user, 0),
            "partners": role_counts.get(UserRole.vendor, 0),
            "officers": role_counts.get(UserRole.police, 0),
            "admins": role_counts.get(UserRole.admin, 0),
            "zones": db.query(ParkingZone).filter(ParkingZone.is_active.is_(True)).count(),
        },
    }
