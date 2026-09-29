import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from core.config import settings
from core.database import SessionLocal
from core.ratelimit import limiter
from routes import (admin, alerts, auth, bookings, complaints, detection, gate, live, notifications,
                    traffic, vendors, zones)
from services.booking_service import expire_no_shows, send_reminders
from services.live import hub

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("tpms")

def run_booking_jobs() -> None:
    for job in (send_reminders, expire_no_shows):
        db = SessionLocal()
        try:
            done = job(db)
            if done:
                log.info("%s: %d booking(s)", job.__name__, len(done))
        except Exception:
            db.rollback()
            log.exception("%s failed", job.__name__)
        finally:
            db.close()

async def booking_jobs_loop():
    """Reminders and no-show release. Runs in every worker; SKIP LOCKED keeps them from colliding."""
    while True:
        await asyncio.to_thread(run_booking_jobs)
        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # The schema is managed by Alembic: run `alembic upgrade head` before starting the app
    for d in (settings.receipts_dir, settings.fines_dir, settings.uploads_dir):
        d.mkdir(parents=True, exist_ok=True)
    hub.bind_loop(asyncio.get_running_loop())
    task = asyncio.create_task(booking_jobs_loop()) if settings.SCHEDULER_ENABLED else None
    yield
    if task:
        task.cancel()

app = FastAPI(
    title="Traffic & Parking Management System",
    description="API for UrbanPuls: parking reservations with pay-at-the-gate, complaints and traffic insights",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(admin.router,      prefix="/api/admin",      tags=["Admin"])
app.include_router(zones.router,      prefix="/api/zones",      tags=["Zones"])
app.include_router(bookings.router,   prefix="/api/bookings",   tags=["Bookings"])
app.include_router(gate.router,       prefix="/api/gate",       tags=["Gate"])
app.include_router(detection.router,  prefix="/api/detect",     tags=["YOLO Detection"])
app.include_router(complaints.router, prefix="/api/complaints", tags=["Complaints"])
app.include_router(traffic.router,    prefix="/api/traffic",    tags=["Traffic"])
app.include_router(alerts.router,     prefix="/api/alerts",     tags=["Alerts"])
app.include_router(vendors.router,    prefix="/api/vendors",    tags=["Vendors"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(live.router,       prefix="/api/live",       tags=["Live updates"])

settings.uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

@app.get("/api/health", tags=["Health"])
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "database unavailable"})

@app.get("/")
def root():
    return {"message": "UrbanPuls API is running"}
