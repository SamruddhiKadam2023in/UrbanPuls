from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import cloudinary, cloudinary.uploader
from core.database import get_db
from core.security import get_current_user, get_admin_user
from core.config import settings
from models.booking import Complaint, ComplaintStatus, ComplaintType
from models.user import User
from services.pdf_service import generate_fine_pdf
from services.sms_service import notify_police

router = APIRouter()

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

@router.post("/", status_code=201)
async def submit_complaint(
    complaint_type: ComplaintType = Form(...),
    description: str = Form(""),
    latitude: float = Form(...),
    longitude: float = Form(...),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    photo_url = None
    if photo:
        try:
            contents = await photo.read()
            result = cloudinary.uploader.upload(contents, folder="tpms/complaints")
            photo_url = result.get("secure_url")
        except Exception:
            photo_url = None  # graceful fallback if Cloudinary not configured

    complaint = Complaint(
        user_id=current_user.id,
        complaint_type=complaint_type,
        description=description,
        latitude=latitude,
        longitude=longitude,
        photo_url=photo_url
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return {"message": "Complaint submitted", "complaint_id": complaint.id}

@router.get("/")
def get_complaints(status: Optional[str] = None, db: Session = Depends(get_db),
                   admin: User = Depends(get_admin_user)):
    query = db.query(Complaint)
    if status:
        query = query.filter(Complaint.status == status)
    return query.order_by(Complaint.created_at.desc()).all()

@router.get("/my")
def my_complaints(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Complaint).filter(Complaint.user_id == current_user.id).order_by(Complaint.created_at.desc()).all()

@router.patch("/{complaint_id}/verify")
def verify_complaint(complaint_id: int, db: Session = Depends(get_db),
                     admin: User = Depends(get_admin_user)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = ComplaintStatus.verified
    complaint.points_awarded = 10
    user = db.query(User).filter(User.id == complaint.user_id).first()
    if user:
        user.points += 10

    # Generate fine PDF
    fine_path = generate_fine_pdf(complaint)
    complaint.fine_generated = True

    # Notify police via SMS
    try:
        notify_police(complaint)
        complaint.police_notified = True
    except Exception:
        pass

    db.commit()
    return {"message": "Complaint verified, points awarded, fine generated", "fine_pdf": fine_path}

@router.patch("/{complaint_id}/reject")
def reject_complaint(complaint_id: int, db: Session = Depends(get_db),
                     admin: User = Depends(get_admin_user)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    complaint.status = ComplaintStatus.rejected
    db.commit()
    return {"message": "Complaint rejected"}

@router.post("/redeem-points")
def redeem_points(points: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    if current_user.points < points:
        raise HTTPException(status_code=400, detail="Insufficient points")
    discount = points * 0.5  # 1 point = ₹0.5 discount
    current_user.points -= points
    db.commit()
    return {"message": "Points redeemed", "discount_amount": discount, "remaining_points": current_user.points}
