import json
import logging
from typing import Optional
import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.ratelimit import limiter
from core.security import require_roles
from core.timeutil import utcnow
from models.booking import DetectionLog
from models.user import User, UserRole
from services.live import queue_event
from services.storage_service import read_limited
from yolo.detector import run_detection, model_available, VIOLATION_LABELS

log = logging.getLogger("tpms.detection")
router = APIRouter()
DETECTION_ROLES = (UserRole.admin, UserRole.vendor, UserRole.police)
detection_staff = require_roles(*DETECTION_ROLES)

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

@router.get("/status")
def detection_status(_: User = Depends(detection_staff)):
    loaded = model_available()
    return {
        "model_loaded": loaded,
        "mock_mode": not loaded and settings.yolo_mock_allowed,
        "active": loaded or settings.yolo_mock_allowed,
    }

@router.post("/image")
@limiter.limit("20/minute")
async def detect_from_image(
    request: Request,
    file: UploadFile = File(...),
    zone_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(detection_staff),
):
    if not model_available() and not settings.yolo_mock_allowed:
        raise HTTPException(status_code=503, detail="Violation detection is not active yet: no trained model is installed")

    contents = await read_limited(file, IMAGE_TYPES)
    frame = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    detections = run_detection(frame)
    violations = [d for d in detections if d["label"] in VIOLATION_LABELS]
    is_violation = bool(violations)

    db.add(DetectionLog(detections=json.dumps(detections), zone_id=zone_id,
                        is_violation=is_violation, created_by=user.id))
    if is_violation:
        # Live alert to every signed-in vendor, admin and police officer (sent after commit)
        queue_event(db, "staff", {"type": "violation", "zone_id": zone_id, "detections": violations,
                                  "timestamp": utcnow().isoformat()})
    db.commit()

    return {
        "detections": detections,
        "violations": violations,
        "is_violation": is_violation,
        "count": len(detections),
        "mock": not model_available(),
    }

@router.get("/logs")
def get_detection_logs(zone_id: Optional[int] = None, db: Session = Depends(get_db),
                       _: User = Depends(detection_staff)):
    query = db.query(DetectionLog)
    if zone_id:
        query = query.filter(DetectionLog.zone_id == zone_id)
    return [
        {"id": l.id, "zone_id": l.zone_id, "is_violation": l.is_violation,
         "detections": json.loads(l.detections or "[]"), "created_at": l.created_at}
        for l in query.order_by(DetectionLog.created_at.desc()).limit(50).all()
    ]
