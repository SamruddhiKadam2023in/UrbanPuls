import json
import logging
from typing import Optional
import cv2
import numpy as np
from fastapi import (APIRouter, Depends, File, HTTPException, Query, Request, UploadFile,
                     WebSocket, WebSocketDisconnect, status)
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db, SessionLocal
from core.ratelimit import limiter
from core.security import require_roles, user_from_token
from core.timeutil import utcnow
from models.booking import DetectionLog
from models.user import User, UserRole
from services.storage_service import read_limited
from yolo.detector import run_detection, model_available, VIOLATION_LABELS

log = logging.getLogger("tpms.detection")
router = APIRouter()
DETECTION_ROLES = (UserRole.admin, UserRole.vendor, UserRole.police)
detection_staff = require_roles(*DETECTION_ROLES)
active_connections: set[WebSocket] = set()

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
    db.commit()

    if is_violation:
        msg = json.dumps({"type": "violation", "zone_id": zone_id, "detections": violations,
                          "timestamp": utcnow().isoformat()})
        for ws in list(active_connections):
            try:
                await ws.send_text(msg)
            except Exception:
                active_connections.discard(ws)

    return {
        "detections": detections,
        "violations": violations,
        "is_violation": is_violation,
        "count": len(detections),
        "mock": not model_available(),
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query("")):
    # Browsers cannot send an Authorization header on WebSockets, so the token comes as a query parameter
    db = SessionLocal()
    try:
        user = user_from_token(token, db)
        allowed = user.role in DETECTION_ROLES
    except HTTPException:
        allowed = False
    finally:
        db.close()
    if not allowed:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.discard(websocket)

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
