"""
Loads demo data for local development. Refuses to run in production.

    cd backend
    alembic upgrade head
    python seed.py

For a production admin account use create_admin.py instead.
"""
import os
import random
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(__file__))

from core.config import settings
from core.database import SessionLocal
from core.security import hash_password
from core.timeutil import utcnow, LOCAL_TZ
from models.booking import TrafficData
from models.parking import ParkingZone, ParkingSlot
from models.user import User, UserRole

if settings.is_production:
    sys.exit("seed.py loads demo accounts with known passwords and must not run in production.")

DEMO_USERS = [
    # name, email, password, role, points
    ("Admin User",   "admin@tpms.com",  "admin123",  UserRole.admin,  0),
    ("Vendor One",   "vendor@tpms.com", "vendor123", UserRole.vendor, 0),
    ("Test User",    "user@tpms.com",   "user123",   UserRole.user,   50),
    ("Police Desk",  "police@tpms.com", "police123", UserRole.police, 0),
]

ZONES = [
    # name, address, lat, lng, slots, price per hour
    ("Dadar West Parking",   "Dadar West, Mumbai",   19.0176, 72.8437, 30, 25.0),
    ("Bandra Kurla Complex", "BKC, Mumbai",          19.0596, 72.8650, 50, 40.0),
    ("Andheri Station Lot",  "Andheri East, Mumbai", 19.1136, 72.8697, 40, 20.0),
    ("Lower Parel Hub",      "Lower Parel, Mumbai",  18.9990, 72.8303, 25, 35.0),
    ("Thane Station Park",   "Thane West, MH",       19.1963, 72.9667, 60, 15.0),
]

def main():
    db = SessionLocal()
    users = {}
    for name, email, password, role, points in DEMO_USERS:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(name=name, email=email, hashed_password=hash_password(password),
                        role=role, points=points, email_verified=True)
            db.add(user)
            db.flush()
            print(f"Created {role.value:<6} {email} / {password}")
        users[role] = user

    vendor = users[UserRole.vendor]
    zone_ids = []
    for name, addr, lat, lng, slots, price in ZONES:
        zone = db.query(ParkingZone).filter(ParkingZone.name == name).first()
        if not zone:
            zone = ParkingZone(name=name, address=addr, latitude=lat, longitude=lng, total_slots=slots,
                               price_per_hour=price, vendor_id=vendor.id,
                               upi_id="tpms.demo@upi", upi_name=name)
            db.add(zone)
            db.flush()
            for i in range(1, slots + 1):
                db.add(ParkingSlot(zone_id=zone.id, slot_number=f"S{i:03d}"))
            print(f"Created zone  {name} ({slots} slots)")
        zone_ids.append(zone.id)

    if not db.query(TrafficData).first():
        # 7 days of hourly readings with rush hours at 8–10 and 17–20 local time
        today_local = utcnow().astimezone(LOCAL_TZ).replace(minute=0, second=0, microsecond=0)
        for zone_id in zone_ids:
            for day_offset in range(7):
                for hour in range(6, 23):
                    base = 0.75 if (8 <= hour <= 10 or 17 <= hour <= 20) else 0.5 if 12 <= hour <= 14 else 0.3
                    density = round(min(1.0, max(0.0, base + random.uniform(-0.1, 0.1))), 2)
                    ts = (today_local - timedelta(days=day_offset + 1)).replace(hour=hour)
                    db.add(TrafficData(zone_id=zone_id, density=density,
                                       vehicle_count=int(density * 100), recorded_at=ts))
        print("Created 7 days of traffic data")

    db.commit()
    db.close()
    print("\nDemo data ready.")

if __name__ == "__main__":
    main()
