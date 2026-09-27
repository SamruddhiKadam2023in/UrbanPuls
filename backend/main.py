from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import engine, Base
from routes import auth, zones, bookings, detection, complaints, traffic, alerts, vendors

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="Traffic & Parking Management System",
    description="API for TPMS with YOLO-based illegal parking detection",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(zones.router,      prefix="/api/zones",      tags=["Zones"])
app.include_router(bookings.router,   prefix="/api/bookings",   tags=["Bookings"])
app.include_router(detection.router,  prefix="/api/detect",     tags=["YOLO Detection"])
app.include_router(complaints.router, prefix="/api/complaints", tags=["Complaints"])
app.include_router(traffic.router,    prefix="/api/traffic",    tags=["Traffic"])
app.include_router(alerts.router,     prefix="/api/alerts",     tags=["Alerts"])
app.include_router(vendors.router,    prefix="/api/vendors",    tags=["Vendors"])

@app.get("/")
def root():
    return {"message": "TPMS API is running ✅"}
