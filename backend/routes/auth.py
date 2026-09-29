import re
import secrets
from typing import Literal, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from core.database import get_db
from core.ratelimit import limiter
from core.timeutil import utcnow
from core.security import (hash_password, verify_password, validate_password, create_access_token,
                           decode_token, get_current_user, password_fingerprint)
from models.user import User, UserRole
from schemas import UserOut
from services.email_service import send_verification_email, send_password_reset_email, send_email_changed_notice

router = APIRouter()

PHONE_RE = re.compile(r"^\+?[0-9 ]{10,15}$")
SUPPORTED_LANGS = {"en", "hi", "mr"}

class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str
    phone: Optional[str] = None
    # Anyone can ask for a vendor account; an admin has to approve it
    account_type: Literal["user", "vendor"] = "user"
    accept_terms: bool = False

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please accept the Terms of use and Privacy policy")
        return v

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        if not PHONE_RE.match(v.strip()):
            raise ValueError("Enter a valid phone number")
        return v.strip()

class EmailRequest(BaseModel):
    email: EmailStr

class TokenRequest(BaseModel):
    token: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    email = req.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name, email=email, phone=req.phone,
        hashed_password=hash_password(req.password),
        role=UserRole.user,
        vendor_requested=req.account_type == "vendor",
        terms_accepted_at=utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    background.add_task(send_verification_email, user)
    msg = "Account created. Check your email to verify your address."
    if user.vendor_requested:
        msg += " An administrator will review your request to become a Parking Partner."
    return {"message": msg, "user": UserOut.model_validate(user)}

@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username.strip().lower()).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled. Contact support.")
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
    }

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user

# ── Account details ───────────────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = None      # empty string clears it

    @field_validator("name")
    @classmethod
    def _name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Name is required")
        return v.strip() if v else v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not v.strip():
            return ""                    # clears the phone number
        if not PHONE_RE.match(v.strip()):
            raise ValueError("Enter a valid phone number")
        return v.strip()

class EmailChange(BaseModel):
    new_email: EmailStr
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

@router.patch("/me", response_model=UserOut)
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields and fields["name"] is not None:
        user.name = fields["name"]
    if "phone" in fields:
        user.phone = fields["phone"] or None
    db.commit()
    db.refresh(user)
    return user

@router.post("/change-email", response_model=UserOut)
@limiter.limit("5/hour")
def change_email(request: Request, data: EmailChange, background: BackgroundTasks,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_email = data.new_email.lower()
    if new_email == user.email:
        raise HTTPException(status_code=400, detail="That is already your email address")
    if db.query(User.id).filter(User.email == new_email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    old_email = user.email
    user.email = new_email
    user.email_verified = False      # the new address has to be confirmed
    db.commit()
    db.refresh(user)
    background.add_task(send_verification_email, user)
    background.add_task(send_email_changed_notice, old_email, user.name, new_email)
    return user

@router.post("/change-password")
@limiter.limit("5/hour")
def change_password(request: Request, data: PasswordChange, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if verify_password(data.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="The new password must be different")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    # Every other session is now signed out; this one continues with a fresh token
    return {"message": "Password changed", "access_token": create_access_token(user)}

@router.patch("/language")
def update_language(lang: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(status_code=400, detail="Unsupported language")
    current_user.preferred_lang = lang
    db.commit()
    return {"message": "Language updated", "lang": lang}

# ── Email verification ────────────────────────────────────────────────────────
@router.post("/verify-email")
def verify_email(req: TokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.token, "verify")
    user = db.get(User, int(payload["sub"]))
    if not user or user.email != payload.get("email"):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user.email_verified = True
    db.commit()
    return {"message": "Email verified"}

@router.post("/resend-verification")
@limiter.limit("3/minute")
def resend_verification(request: Request, background: BackgroundTasks,
                        current_user: User = Depends(get_current_user)):
    if current_user.email_verified:
        return {"message": "Email already verified"}
    background.add_task(send_verification_email, current_user)
    return {"message": "Verification email sent"}

# ── Password reset ────────────────────────────────────────────────────────────
@router.post("/forgot-password")
@limiter.limit("5/hour")
def forgot_password(request: Request, req: EmailRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if user and user.is_active:
        background.add_task(send_password_reset_email, user)
    # Same answer either way, so the endpoint cannot be used to discover accounts
    return {"message": "If an account exists for that email, a reset link has been sent."}

@router.post("/reset-password")
@limiter.limit("10/hour")
def reset_password(request: Request, req: ResetPasswordRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.token, "reset")
    user = db.get(User, int(payload["sub"]))
    if not user or password_fingerprint(user) != payload.get("fp"):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has already been used")
    user.hashed_password = hash_password(req.password)
    # Following the emailed link proves the address belongs to the user
    user.email_verified = True
    db.commit()
    return {"message": "Password updated. You can now sign in."}


# ── Your data (India DPDP Act 2023: access and erasure) ───────────────────────
class DeleteAccount(BaseModel):
    password: str

@router.get("/me/export")
def export_my_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Everything TPMS stores about the signed-in person, as one JSON download."""
    from models.activity import Notification, Rating
    from models.booking import Booking, Complaint
    from schemas import booking_out
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at).all()
    complaints = db.query(Complaint).filter(Complaint.user_id == user.id).order_by(Complaint.created_at).all()
    ratings = db.query(Rating).filter(Rating.user_id == user.id).all()
    notes = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at).all()
    data = {
        "exported_at": utcnow(),
        "account": UserOut.model_validate(user).model_dump(),
        "bookings": [booking_out(b).model_dump() for b in bookings],
        "complaints": [{"id": c.id, "type": c.complaint_type.value, "description": c.description,
                        "latitude": c.latitude, "longitude": c.longitude, "photo_url": c.photo_url,
                        "status": c.status.value, "points_awarded": c.points_awarded, "created_at": c.created_at}
                       for c in complaints],
        "ratings": [{"booking_id": r.booking_id, "zone_id": r.zone_id, "stars": r.stars, "comment": r.comment,
                     "created_at": r.created_at} for r in ratings],
        "notifications": [{"title": n.title, "message": n.message, "created_at": n.created_at} for n in notes],
    }
    return JSONResponse(content=jsonable_encoder(data),
                        headers={"Content-Disposition": f'attachment; filename="tpms-my-data-{user.id}.json"'})

@router.delete("/me")
@limiter.limit("5/hour")
def delete_my_account(request: Request, data: DeleteAccount, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """
    Closes the account and removes personal details. Booking and complaint records stay (without the
    person's details) because Parking Partners' receipts and revenue reports depend on them.
    """
    from models.activity import Notification
    from models.booking import Booking, BookingStatus
    from models.parking import ParkingZone

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if db.query(Booking.id).filter(Booking.user_id == user.id, Booking.status == BookingStatus.checked_in).first():
        raise HTTPException(status_code=400, detail="Your vehicle is still parked. Check out at the gate first.")
    if user.role == UserRole.vendor and db.query(ParkingZone.id).filter(ParkingZone.vendor_id == user.id).first():
        raise HTTPException(status_code=400, detail="You still own parking lots. Contact the TPMS administrator to transfer or close them first.")
    if user.role == UserRole.admin and db.query(User).filter(User.role == UserRole.admin, User.is_active.is_(True),
                                                              User.id != user.id).count() == 0:
        raise HTTPException(status_code=400, detail="You are the only administrator. Make someone else an admin first.")

    for b in db.query(Booking).filter(Booking.user_id == user.id, Booking.status == BookingStatus.reserved).all():
        b.status = BookingStatus.cancelled
    db.query(Notification).filter(Notification.user_id == user.id).delete()
    # Staff employed by a closing partner lose access through the employer check in core/security.py
    user.name = "Deleted user"
    user.email = f"deleted-{user.id}@deleted.invalid"
    user.phone = None
    user.hashed_password = hash_password(secrets.token_urlsafe(32))   # nobody knows it; also ends all sessions
    user.is_active = False
    user.email_verified = False
    user.vendor_requested = False
    user.points = 0
    db.commit()
    return {"message": "Your account has been deleted"}
