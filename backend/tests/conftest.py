import os
import sys
import tempfile

# Configure the app for tests before anything imports core.config
TMP_DIR = tempfile.mkdtemp(prefix="tpms_test_")
os.environ.update({
    "ENVIRONMENT": "test",
    # Set TEST_DATABASE_URL to run the suite against PostgreSQL
    "DATABASE_URL": os.environ.get("TEST_DATABASE_URL", f"sqlite:///{TMP_DIR}/test.db"),
    "SCHEDULER_ENABLED": "false",
    "DATA_DIR": TMP_DIR,
    "SMTP_HOST": "",
    "CLOUDINARY_CLOUD_NAME": "",
    "TWILIO_ACCOUNT_SID": "",
})
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import timedelta
import pytest
from fastapi.testclient import TestClient

from core.database import Base, engine, SessionLocal
from core.security import hash_password
from core.timeutil import utcnow
import models  # noqa: F401
from models.parking import ParkingZone, ParkingSlot
from models.user import User, UserRole
from main import app

PASSWORD = "secret123"

@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def make_user(db, email="user@test.com", role=UserRole.user, verified=True, points=0, active=True) -> User:
    user = User(name=email.split("@")[0].title(), email=email, hashed_password=hash_password(PASSWORD),
                role=role, email_verified=verified, points=points, is_active=active)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def make_zone(db, vendor: User, slots=3, price=20.0, name="Test Zone") -> ParkingZone:
    zone = ParkingZone(name=name, address="Somewhere", latitude=19.0, longitude=72.8,
                       total_slots=slots, price_per_hour=price, vendor_id=vendor.id, upi_id="test@upi")
    db.add(zone)
    db.flush()
    for i in range(1, slots + 1):
        db.add(ParkingSlot(zone_id=zone.id, slot_number=f"S{i:03d}"))
    db.commit()
    db.refresh(zone)
    return zone

def auth(client, email, password=PASSWORD) -> dict:
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

def iso(dt) -> str:
    return dt.isoformat()

def window(start_in_minutes=5, hours=2):
    start = utcnow() + timedelta(minutes=start_in_minutes)
    return start, start + timedelta(hours=hours)

def reserve(client, headers, zone, slot, start, end, vehicle="MH01AB1234", points=0):
    return client.post("/api/bookings/", headers=headers, json={
        "zone_id": zone.id, "slot_id": slot.id, "start_time": iso(start), "end_time": iso(end),
        "vehicle_number": vehicle, "points_to_redeem": points,
    })
