from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from core.database import SessionLocal
from core.security import user_from_token
from models.user import UserRole
from services.live import hub

router = APIRouter()
STAFF_ROLES = (UserRole.admin, UserRole.vendor, UserRole.police)

@router.websocket("/ws")
async def live_socket(websocket: WebSocket, token: str = Query("")):
    # Browsers cannot set headers on WebSockets, so the login token comes as a query parameter
    db = SessionLocal()
    try:
        user = user_from_token(token, db)
        channels = ["public", f"user:{user.id}"]
        if user.role in STAFF_ROLES:
            channels.append("staff")
    except HTTPException:
        user = None
    finally:
        db.close()
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    hub.connect(websocket, channels)
    try:
        while True:
            await websocket.receive_text()   # clients only send keep-alive pings
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(websocket)
