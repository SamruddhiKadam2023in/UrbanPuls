from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from core.database import get_db
from core.security import hash_password, verify_password, create_access_token, get_current_user
from models.user import User, UserRole

router = APIRouter()

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""
    role: str = "user"

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    points: int
    phone: str = ""
    preferred_lang: str
    class Config:
        from_attributes = True

@router.post("/register", response_model=UserResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=req.name,
        email=req.email,
        hashed_password=hash_password(req.password),
        phone=req.phone,
        role=req.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "points": user.points,
            "preferred_lang": user.preferred_lang
        }
    }

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/language")
def update_language(lang: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.preferred_lang = lang
    db.commit()
    return {"message": "Language updated", "lang": lang}
