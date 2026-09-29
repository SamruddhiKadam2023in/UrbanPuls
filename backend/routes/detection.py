import json
import logging
from typing import Optional
import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.ratelimit import limiter
from core.security import require_roles
from core.timeutil import utcnow
from models.activity import Camera
from models.booking import DetectionLog
from models.parking import ParkingZone
from models.user import User, UserRole
from services.live import queue_event
from services.storage_service import read_limited, store_bytes
from services.violations import mark_violations
from yolo.detector import run_detection, model_available

log = logging.getLogger("tpms.detection")
router = APIRouter()
DETECTION_ROLES = (UserRole.admin, UserRole.vendor, UserRole.police)
detection_staff = require_roles(*DETECTION_ROLES)

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_AREAS, MAX_POINTS = 20, 50

# ── Helpers ───────────────────────────────────────────────────────────────────
async def _read_image(file: UploadFile) -> tuple[bytes, np.ndarray]:
    contents = await read_limited(file, IMAGE_TYPES)
    frame = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return contents, frame

def _camera_out(c: Camera) -> dict:
    return {"id": c.id, "name": c.name, "zone_id": c.zone_id, "zone_name": c.zone.name if c.zone else None,
            "owner_id": c.owner_id, "image_url": c.image_url, "image_width": c.image_width,
            "image_height": c.image_height, "areas": json.loads(c.areas or "[]"), "created_at": c.created_at}

def _visible_cameras(db: Session, user: User):
    q = db.query(Camera).filter(Camera.is_active.is_(True))
    if user.role == UserRole.vendor:
        # Parking Partners see cameras they added and cameras on their own lots
        own_zones = db.query(ParkingZone.id).filter(ParkingZone.vendor_id == user.id)
        q = q.filter((Camera.owner_id == user.id) | Camera.zone_id.in_(own_zones))
    return q

def _editable_camera(db: Session, camera_id: int, user: User) -> Camera:
    cam = db.get(Camera, camera_id)
    if not cam or not cam.is_active:
        raise HTTPException(status_code=404, detail="Camera not found")
    if user.role != UserRole.admin and cam.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the person who added this camera (or an admin) can change it")
    return cam

def _check_zone(db: Session, zone_id: Optional[int], user: User) -> None:
    if zone_id is None:
        return
    zone = db.get(ParkingZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    if user.role == UserRole.vendor and zone.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="This zone belongs to another Parking Partner")

class CameraUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    zone_id: Optional[int] = None
    areas: Optional[list[list[list[float]]]] = None

    @field_validator("areas")
    @classmethod
    def _areas(cls, v):
        if v is None:
            return v
        if len(v) > MAX_AREAS:
            raise ValueError(f"At most {MAX_AREAS} areas per camera")
        for poly in v:
            if not (3 <= len(poly) <= MAX_POINTS):
                raise ValueError(f"Each area needs 3 to {MAX_POINTS} points")
            for pt in poly:
                if len(pt) != 2 or not all(0 <= c <= 1 for c in pt):
                    raise ValueError("Area points must be [x, y] between 0 and 1")
        return [[[round(x, 4), round(y, 4)] for x, y in poly] for poly in v]

# ── Status ────────────────────────────────────────────────────────────────────
@router.get("/status")
def detection_status(_: User = Depends(detection_staff)):
    loaded = model_available()
    return {
        "model_loaded": loaded,
        "mock_mode": not loaded and settings.yolo_mock_allowed,
        "active": loaded or settings.yolo_mock_allowed,
    }

# ── Cameras ───────────────────────────────────────────────────────────────────
@router.get("/cameras")
def list_cameras(db: Session = Depends(get_db), user: User = Depends(detection_staff)):
    return [_camera_out(c) for c in _visible_cameras(db, user).order_by(Camera.name).all()]

@router.post("/cameras", status_code=201)
async def create_camera(name: str = Form(..., min_length=1, max_length=100), zone_id: Optional[int] = Form(None),
                        image: UploadFile = File(...), db: Session = Depends(get_db),
                        user: User = Depends(detection_staff)):
    """A camera is a reference photo of one view. No-parking areas are drawn on it afterwards."""
    _check_zone(db, zone_id, user)
    contents, frame = await _read_image(image)
    h, w = frame.shape[:2]
    url = store_bytes(contents, "cameras", IMAGE_TYPES[image.content_type])
    cam = Camera(name=name.strip(), zone_id=zone_id, owner_id=user.id, image_url=url, image_width=w, image_height=h)
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return _camera_out(cam)

@router.patch("/cameras/{camera_id}")
def update_camera(camera_id: int, data: CameraUpdate, db: Session = Depends(get_db), user: User = Depends(detection_staff)):
    cam = _editable_camera(db, camera_id, user)
    fields = data.model_dump(exclude_unset=True)
    if "zone_id" in fields:
        _check_zone(db, fields["zone_id"], user)
        cam.zone_id = fields["zone_id"]
    if fields.get("name"):
        cam.name = fields["name"].strip()
    if "areas" in fields and fields["areas"] is not None:
        cam.areas = json.dumps(fields["areas"])
    db.commit()
    db.refresh(cam)
    return _camera_out(cam)

@router.delete("/cameras/{camera_id}")
def remove_camera(camera_id: int, db: Session = Depends(get_db), user: User = Depends(detection_staff)):
    cam = _editable_camera(db, camera_id, user)
    cam.is_active = False      # kept for the history of past detections
    db.commit()
    return {"message": "Camera removed"}

# ── Detection ─────────────────────────────────────────────────────────────────
@router.post("/image")
@limiter.limit("20/minute")
async def detect_from_image(
    request: Request,
    file: UploadFile = File(...),
    camera_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(detection_staff),
):
    """Finds vehicles in the photo. With a camera, vehicles inside its no-parking areas are violations."""
    if not model_available() and not settings.yolo_mock_allowed:
        raise HTTPException(status_code=503, detail="Violation detection is not active: no model is installed")

    cam = None
    if camera_id is not None:
        cam = _visible_cameras(db, user).filter(Camera.id == camera_id).first()
        if not cam:
            raise HTTPException(status_code=404, detail="Camera not found")

    contents, frame = await _read_image(file)
    h, w = frame.shape[:2]
    detections = run_detection(frame)
    areas = json.loads(cam.areas or "[]") if cam else []
    violations = mark_violations(detections, areas, w, h)
    is_violation = bool(violations)

    image_url = store_bytes(contents, "detections", IMAGE_TYPES[file.content_type]) if is_violation else None
    zone_id = cam.zone_id if cam else None
    db.add(DetectionLog(detections=json.dumps(detections), zone_id=zone_id, camera_id=cam.id if cam else None,
                        image_url=image_url, is_violation=is_violation, created_by=user.id))
    if is_violation:
        # Live alert to every signed-in Parking Partner, admin and Field Officer (sent after commit)
        queue_event(db, "staff", {"type": "violation", "zone_id": zone_id, "camera": cam.name if cam else None,
                                  "detections": violations, "timestamp": utcnow().isoformat()})
    db.commit()

    return {
        "detections": detections,
        "violations": violations,
        "is_violation": is_violation,
        "count": len(detections),
        "width": w,
        "height": h,
        "areas": areas,
        "camera": _camera_out(cam) if cam else None,
        "mock": not model_available(),
    }

@router.get("/logs")
def get_detection_logs(zone_id: Optional[int] = None, db: Session = Depends(get_db),
                       _: User = Depends(detection_staff)):
    query = db.query(DetectionLog)
    if zone_id:
        query = query.filter(DetectionLog.zone_id == zone_id)
    return [
        {"id": l.id, "zone_id": l.zone_id, "camera_id": l.camera_id, "is_violation": l.is_violation,
         "image_url": l.image_url, "detections": json.loads(l.detections or "[]"), "created_at": l.created_at}
        for l in query.order_by(DetectionLog.created_at.desc()).limit(50).all()
    ]
