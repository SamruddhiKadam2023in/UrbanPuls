import re
from datetime import timedelta
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.config import settings
from core.database import get_db
from core.timeutil import utcnow
from models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Passwords ─────────────────────────────────────────────────────────────────
PASSWORD_RULES = "Password must be 8–72 characters and contain at least one letter and one number"

def validate_password(password: str) -> str:
    if not (8 <= len(password) and len(password.encode("utf-8")) <= 72):
        raise ValueError(PASSWORD_RULES)
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError(PASSWORD_RULES)
    return password

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False

# ── Tokens ────────────────────────────────────────────────────────────────────
def _encode(payload: dict, expires: timedelta) -> str:
    payload = {**payload, "exp": utcnow() + expires, "iat": utcnow()}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400 if expected_type != "access" else 401, detail="Invalid or expired token")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=400 if expected_type != "access" else 401, detail="Invalid token")
    return payload

def password_fingerprint(user: User) -> str:
    # Changes whenever the password changes, which signs out every existing session
    return user.hashed_password[-12:]

def create_access_token(user: User) -> str:
    return _encode({"sub": str(user.id), "role": user.role.value, "type": "access", "fp": password_fingerprint(user)},
                   timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

def create_reset_token(user: User) -> str:
    # Tied to the current password hash, so the link stops working once it has been used
    return _encode({"sub": str(user.id), "fp": password_fingerprint(user), "type": "reset"},
                   timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES))

def create_verify_token(user: User) -> str:
    return _encode({"sub": str(user.id), "email": user.email, "type": "verify"},
                   timedelta(hours=settings.VERIFY_TOKEN_EXPIRE_HOURS))

# ── Current user / role guards ────────────────────────────────────────────────
def user_from_token(token: str, db: Session) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token, "access")
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise credentials_exception
    user = db.get(User, user_id)
    if user is None or payload.get("fp") != password_fingerprint(user):
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    if user.role == UserRole.attendant:
        # Gate staff lose access as soon as their Parking Partner is disabled or loses the partner role
        employer = db.get(User, user.employer_id) if user.employer_id else None
        if not employer or not employer.is_active or employer.role != UserRole.vendor:
            raise HTTPException(status_code=403, detail="Your employer's account is not active")
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return user_from_token(token, db)

def require_roles(*roles: UserRole):
    allowed = {r.value for r in roles}

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed:
            raise HTTPException(status_code=403, detail="You do not have permission for this action")
        return current_user
    return checker

def require_verified(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email address first")
    return current_user

get_admin_user = require_roles(UserRole.admin)
