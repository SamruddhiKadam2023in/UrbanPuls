import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.ratelimit import limiter
from core.security import get_current_user, require_roles, require_verified
from models.booking import Complaint, ComplaintStatus, ComplaintType
from models.user import User, UserRole
from services.pdf_service import generate_fine_pdf
from services.sms_service import notify_police
from services.storage_service import save_upload

log = logging.getLogger("tpms.complaints")
router = APIRouter()
reviewers = require_roles(UserRole.admin, UserRole.police)
admin_only = require_roles(UserRole.admin)

def _complaint_out(c: Complaint) -> dict:
    return {
        "id": c.id, "user_id": c.user_id, "complaint_type": c.complaint_type.value,
        "description": c.description, "latitude": c.latitude, "longitude": c.longitude,
        "photo_url": c.photo_url, "status": c.status.value, "points_awarded": c.points_awarded,
        "fine_generated": c.fine_generated, "police_notified": c.police_notified,
        "created_at": c.created_at, "updated_at": c.updated_at,
    }

@router.post("/", status_code=201)
@limiter.limit("10/hour")
async def submit_complaint(
    request: Request,
    complaint_type: ComplaintType = Form(...),
    description: str = Form("", max_length=2000),
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_verified),
):
    photo_url = None
    if photo and photo.filename:
        try:
            photo_url = await save_upload(photo, "complaints")
        except HTTPException:
            raise
        except Exception:
            log.exception("Photo upload failed")
            raise HTTPException(status_code=502, detail="Photo upload failed, please try again")

    complaint = Complaint(
        user_id=current_user.id, complaint_type=complaint_type, description=description.strip() or None,
        latitude=latitude, longitude=longitude, photo_url=photo_url,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return {"message": "Complaint submitted", "complaint_id": complaint.id}

@router.get("/")
def get_complaints(status: Optional[ComplaintStatus] = None, db: Session = Depends(get_db),
                   _: User = Depends(reviewers)):
    query = db.query(Complaint)
    if status:
        query = query.filter(Complaint.status == status)
    return [_complaint_out(c) for c in query.order_by(Complaint.created_at.desc()).all()]

@router.get("/my")
def my_complaints(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Complaint).filter(Complaint.user_id == current_user.id).order_by(Complaint.created_at.desc()).all()
    return [_complaint_out(c) for c in rows]

def _pending(db: Session, complaint_id: int) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).with_for_update().first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.status != ComplaintStatus.pending:
        raise HTTPException(status_code=400, detail=f"Complaint is already {complaint.status.value}")
    return complaint

@router.patch("/{complaint_id}/verify")
def verify_complaint(complaint_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    complaint = _pending(db, complaint_id)
    complaint.status = ComplaintStatus.verified
    complaint.reviewed_by = admin.id
    complaint.points_awarded = settings.COMPLAINT_REWARD_POINTS
    reporter = db.get(User, complaint.user_id)
    if reporter:
        reporter.points += settings.COMPLAINT_REWARD_POINTS

    try:
        complaint.fine_path = generate_fine_pdf(complaint)
        complaint.fine_generated = True
    except Exception:
        log.exception("Fine PDF generation failed for complaint %s", complaint.id)
    complaint.police_notified = notify_police(complaint)
    db.commit()
    return {"message": "Complaint verified and points awarded", "fine_generated": complaint.fine_generated}

@router.patch("/{complaint_id}/reject")
def reject_complaint(complaint_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    complaint = _pending(db, complaint_id)
    complaint.status = ComplaintStatus.rejected
    complaint.reviewed_by = admin.id
    db.commit()
    return {"message": "Complaint rejected"}

@router.patch("/{complaint_id}/resolve")
def resolve_complaint(complaint_id: int, db: Session = Depends(get_db), user: User = Depends(reviewers)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.status != ComplaintStatus.verified:
        raise HTTPException(status_code=400, detail="Only verified complaints can be resolved")
    complaint.status = ComplaintStatus.resolved
    db.commit()
    return {"message": "Complaint resolved"}

@router.get("/{complaint_id}/fine")
def download_fine(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(reviewers)):
    complaint = db.get(Complaint, complaint_id)
    if not complaint or not complaint.fine_path:
        raise HTTPException(status_code=404, detail="No fine for this complaint")
    return FileResponse(complaint.fine_path, media_type="application/pdf", filename=f"fine_{complaint.id:06d}.pdf")
