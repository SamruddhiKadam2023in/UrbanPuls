from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import numpy as np, cv2, json
from datetime import datetime

from core.database import get_db
from core.security import get_current_user
from models.booking import DetectionLog
from models.user import User
from yolo.detector import run_detection

router = APIRouter()
active_connections: list[WebSocket] = []

@router.post("/image")
async def detect_from_image(
    file: UploadFile = File(...),
    zone_id: int = None,
    db: Session = Depends(get_db)
):
    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    frame  = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    detections = run_detection(frame)
    violations = [d for d in detections if d["label"] in ["illegal_parking", "vehicle", "car", "truck"]]
    is_violation = len(violations) > 0

    log = DetectionLog(
        detections=json.dumps(detections),
        zone_id=zone_id,
        is_violation=is_violation
    )
    db.add(log)
    db.commit()

    # Broadcast to all WebSocket clients
    if is_violation:
        msg = json.dumps({"type": "violation", "zone_id": zone_id, "detections": violations, "timestamp": str(datetime.utcnow())})
        for ws in active_connections:
            try:
                await ws.send_text(msg)
            except Exception:
                pass

    return {"detections": detections, "is_violation": is_violation, "count": len(detections)}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

@router.get("/logs")
def get_detection_logs(zone_id: int = None, db: Session = Depends(get_db)):
    query = db.query(DetectionLog)
    if zone_id:
        query = query.filter(DetectionLog.zone_id == zone_id)
    return query.order_by(DetectionLog.created_at.desc()).limit(50).all()
