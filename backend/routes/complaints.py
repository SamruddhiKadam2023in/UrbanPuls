import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from core.config import settings
from core.database import get_db
from core.ratelimit import limiter
from core.security import get_current_user, require_roles, require_verified
from models.activity import ComplaintEvent
from models.booking import Complaint, ComplaintStatus, ComplaintType
from models.user import User, UserRole
from services.notify import notify, notify_role
from services.pdf_service import generate_fine_pdf
from services.sms_service import notify_police
from services.storage_service import save_upload

log = logging.getLogger("tpms.complaints")
router = APIRouter()
reviewers = require_roles(UserRole.admin, UserRole.police)
admin_only = require_roles(UserRole.admin)

TYPE_LABELS = {t: t.value.replace("_", " ").capitalize() for t in ComplaintType}

class ReviewNote(BaseModel):
    note: str = Field(default="", max_length=1000)

def _complaint_out(c: Complaint, staff: bool = False) -> dict:
    out = {
        "id": c.id, "complaint_type": c.complaint_type.value,
        "description": c.description, "latitude": c.latitude, "longitude": c.longitude,
        "photo_url": c.photo_url, "status": c.status.value, "points_awarded": c.points_awarded,
        "fine_generated": c.fine_generated, "police_notified": c.police_notified,
        "created_at": c.created_at, "updated_at": c.updated_at,
        "timeline": [
            {"status": e.status.value, "note": e.note, "at": e.created_at,
             # Reporters see the role that acted, staff also see the name
             "by": (e.actor.name if staff else e.actor.role.value.capitalize()) if e.actor else None}
            for e in c.events
        ],
    }
    if staff:
        out["reporter"] = {"id": c.user.id, "name": c.user.name, "email": c.user.email} if c.user else None
    return out

def _add_event(db: Session, c: Complaint, status: ComplaintStatus, actor: User | None, note: str | None = None):
    c.status = status
    c.events.append(ComplaintEvent(status=status, note=(note or "").strip() or None, actor_id=actor.id if actor else None))

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
    _add_event(db, complaint, ComplaintStatus.pending, current_user, "Reported")
    db.flush()
    notify_role(db, [UserRole.admin], "complaint", "New complaint to review",
                f"{TYPE_LABELS[complaint_type]} reported by {current_user.name}.", link="/dashboard")
    db.commit()
    return {"message": "Complaint submitted", "complaint_id": complaint.id}

@router.get("/")
def get_complaints(status: Optional[ComplaintStatus] = None, db: Session = Depends(get_db),
                   _: User = Depends(reviewers)):
    query = db.query(Complaint).options(selectinload(Complaint.events).selectinload(ComplaintEvent.actor),
                                        selectinload(Complaint.user))
    if status:
        query = query.filter(Complaint.status == status)
    return [_complaint_out(c, staff=True) for c in query.order_by(Complaint.created_at.desc()).all()]

@router.get("/my")
def my_complaints(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Complaint).options(selectinload(Complaint.events).selectinload(ComplaintEvent.actor)) \
        .filter(Complaint.user_id == current_user.id).order_by(Complaint.created_at.desc()).all()
    return [_complaint_out(c) for c in rows]

def _locked(db: Session, complaint_id: int, expected: ComplaintStatus) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).with_for_update().first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.status != expected:
        raise HTTPException(status_code=400, detail=f"Complaint is already {complaint.status.value}")
    return complaint

@router.patch("/{complaint_id}/verify")
def verify_complaint(complaint_id: int, data: ReviewNote | None = None, db: Session = Depends(get_db),
                     admin: User = Depends(admin_only)):
    complaint = _locked(db, complaint_id, ComplaintStatus.pending)
    _add_event(db, complaint, ComplaintStatus.verified, admin, data.note if data else None)
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

    notify(db, reporter, "complaint", "Complaint verified",
           f"Your {TYPE_LABELS[complaint.complaint_type].lower()} report was verified. "
           f"You earned {settings.COMPLAINT_REWARD_POINTS} reward points.", link="/complaints", email=True)
    notify_role(db, [UserRole.police], "complaint", "Verified complaint needs action",
                f"{TYPE_LABELS[complaint.complaint_type]} at {complaint.latitude:.5f}, {complaint.longitude:.5f}.",
                link="/police")
    db.commit()
    return {"message": "Complaint verified and points awarded", "fine_generated": complaint.fine_generated}

@router.patch("/{complaint_id}/reject")
def reject_complaint(complaint_id: int, data: ReviewNote | None = None, db: Session = Depends(get_db),
                     admin: User = Depends(admin_only)):
    complaint = _locked(db, complaint_id, ComplaintStatus.pending)
    note = data.note if data else None
    _add_event(db, complaint, ComplaintStatus.rejected, admin, note)
    complaint.reviewed_by = admin.id
    notify(db, complaint.user, "complaint", "Complaint not accepted",
           f"Your {TYPE_LABELS[complaint.complaint_type].lower()} report could not be verified."
           + (f" Reason: {note.strip()}" if note and note.strip() else ""), link="/complaints")
    db.commit()
    return {"message": "Complaint rejected"}

@router.patch("/{complaint_id}/resolve")
def resolve_complaint(complaint_id: int, data: ReviewNote | None = None, db: Session = Depends(get_db),
                      user: User = Depends(reviewers)):
    complaint = _locked(db, complaint_id, ComplaintStatus.verified)
    note = data.note if data else None
    _add_event(db, complaint, ComplaintStatus.resolved, user, note)
    notify(db, complaint.user, "complaint", "Complaint resolved",
           f"Action has been taken on your {TYPE_LABELS[complaint.complaint_type].lower()} report."
           + (f" Note: {note.strip()}" if note and note.strip() else ""), link="/complaints")
    db.commit()
    return {"message": "Complaint resolved"}

@router.get("/{complaint_id}/fine")
def download_fine(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(reviewers)):
    complaint = db.get(Complaint, complaint_id)
    if not complaint or not complaint.fine_path:
        raise HTTPException(status_code=404, detail="No fine for this complaint")
    return FileResponse(complaint.fine_path, media_type="application/pdf", filename=f"fine_{complaint.id:06d}.pdf")
