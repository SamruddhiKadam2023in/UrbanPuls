from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_admin_user, hash_password, validate_password
from models.user import User, UserRole
from schemas import UserOut

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
               db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if vendor_requested is not None:
        q = q.filter(User.vendor_requested.is_(vendor_requested))
    return q.order_by(User.created_at.desc()).all()

@router.post("/users", status_code=201, response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    """Staff accounts (police, vendors, other admins) are created here rather than through sign-up."""
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
    if data.role is not None:
        user.role = data.role
        if data.role == UserRole.vendor:
            user.vendor_requested = False
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.vendor_requested is not None:
        user.vendor_requested = data.vendor_requested
    db.commit()
    db.refresh(user)
    return user
