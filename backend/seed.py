"""
Run this once after the DB is up to seed test data.
  cd backend
  python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from core.database import SessionLocal, engine, Base
from models.user    import User, UserRole
from models.parking import ParkingZone, ParkingSlot
from models.booking import TrafficData
from core.security  import hash_password
from datetime       import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── 1. Admin user ────────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == "admin@tpms.com").first():
    db.add(User(name="Admin User", email="admin@tpms.com",
                hashed_password=hash_password("admin123"), role=UserRole.admin))
    print("✅ Admin created  → admin@tpms.com / admin123")

# ── 2. Vendor user ───────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == "vendor@tpms.com").first():
    vendor = User(name="Vendor One", email="vendor@tpms.com",
                  hashed_password=hash_password("vendor123"), role=UserRole.vendor)
    db.add(vendor)
    db.flush()
    vendor_id = vendor.id
    print("✅ Vendor created → vendor@tpms.com / vendor123")
else:
    vendor_id = db.query(User).filter(User.email == "vendor@tpms.com").first().id

# ── 3. Regular user ──────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == "user@tpms.com").first():
    db.add(User(name="Test User", email="user@tpms.com",
                hashed_password=hash_password("user123"), role=UserRole.user, points=50))
    print("✅ User created   → user@tpms.com / user123")

# ── 4. Parking zones (Mumbai locations) ──────────────────────────────────────
zones_data = [
    ("Dadar West Parking", "Dadar West, Mumbai",   19.0176,  72.8437, 30, 25.0),
    ("Bandra Kurla Complex","BKC, Mumbai",          19.0596,  72.8650, 50, 40.0),
    ("Andheri Station Lot", "Andheri East, Mumbai", 19.1136,  72.8697, 40, 20.0),
    ("Lower Parel Hub",     "Lower Parel, Mumbai",  18.9990,  72.8303, 25, 35.0),
    ("Thane Station Park",  "Thane West, MH",       19.1963,  72.9667, 60, 15.0),
]

zone_ids = []
for name, addr, lat, lng, slots, price in zones_data:
    if not db.query(ParkingZone).filter(ParkingZone.name == name).first():
        zone = ParkingZone(name=name, address=addr, latitude=lat, longitude=lng,
                           total_slots=slots, price_per_hour=price, vendor_id=vendor_id)
        db.add(zone)
        db.flush()
        # Auto-create slots
        for i in range(1, slots + 1):
            occupied = random.random() < 0.4   # 40% occupied
            db.add(ParkingSlot(zone_id=zone.id, slot_number=f"S{i:03d}", is_occupied=occupied))
        zone_ids.append(zone.id)
        print(f"✅ Zone created  → {name} ({slots} slots)")
    else:
        z = db.query(ParkingZone).filter(ParkingZone.name == name).first()
        zone_ids.append(z.id)

# ── 5. Traffic data (last 7 days, hourly) ────────────────────────────────────
for zone_id in zone_ids:
    for day_offset in range(7):
        for hour in range(6, 23):
            # Simulate rush hours 8-10 and 17-20
            base = 0.3
            if 8 <= hour <= 10 or 17 <= hour <= 20:
                base = 0.75
            elif 12 <= hour <= 14:
                base = 0.5
            density = min(1.0, base + random.uniform(-0.1, 0.1))
            ts = datetime.utcnow() - timedelta(days=day_offset, hours=(22 - hour))
            db.add(TrafficData(zone_id=zone_id, density=round(density, 2),
                               vehicle_count=int(density * 100), recorded_at=ts))

print("✅ Traffic data seeded (7 days)")

db.commit()
db.close()
print("\n🎉 Database seeded successfully!")
print("─" * 40)
print("Login credentials:")
print("  Admin  → admin@tpms.com  / admin123")
print("  Vendor → vendor@tpms.com / vendor123")
print("  User   → user@tpms.com   / user123")
