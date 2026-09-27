from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_admin_user, hash_password, validate_password
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
    was_requested = user.vendor_requested
    if data.role is not None and data.role != user.role:
        user.role = data.role
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
