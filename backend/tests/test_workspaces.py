from datetime import timedelta
from core.timeutil import utcnow
from models.booking import Booking
from models.user import UserRole
from conftest import make_user, make_zone, auth, reserve, window

def test_partner_today_summary(client, db):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor, slots=3)
    zone.upi_id = None
    db.commit()
    make_user(db, "u@test.com")
    hu, hv = auth(client, "u@test.com"), auth(client, "vendor@test.com")

    b = reserve(client, hu, zone, zone.slots[0], *window(start_in_minutes=30)).json()
    client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone.id, "vehicle_number": "MH02CD5678"})
    walk = db.query(Booking).filter_by(is_walk_in=True).one()
    walk.checked_in_at = utcnow() - timedelta(minutes=50)
    db.commit()
    client.post("/api/gate/check-out", headers=hv, json={"booking_id": walk.id, "payment_method": "upi"})

    s = client.get("/api/vendors/today", headers=hv).json()
    assert s["totals"]["revenue"] == 20 and s["totals"]["upi"] == 20 and s["totals"]["cash"] == 0
    assert s["totals"]["reservations"] == 1 and s["totals"]["walk_ins"] == 1
    assert [a["id"] for a in s["arriving"]] == [b["id"]]
    assert s["lots"][0]["total"] == 3
    assert {"zone_id": zone.id, "zone": zone.name, "issue": "no_upi"} in s["issues"]

def test_partner_today_only_own_lots(client, db):
    owner = make_user(db, "owner@test.com", UserRole.vendor)
    make_zone(db, owner)
    make_user(db, "other@test.com", UserRole.vendor)
    s = client.get("/api/vendors/today", headers=auth(client, "other@test.com")).json()
    assert s["lots"] == [] and s["totals"]["revenue"] == 0

def test_admin_summary(client, db):
    make_user(db, "admin@test.com", UserRole.admin)
    applicant = make_user(db, "shop@test.com")
    applicant.vendor_requested = True
    make_user(db, "new@test.com", verified=False)
    db.commit()
    client.post("/api/complaints/", headers=auth(client, "shop@test.com"),
                data={"complaint_type": "accident", "latitude": "19", "longitude": "72"})
    s = client.get("/api/admin/summary", headers=auth(client, "admin@test.com")).json()
    assert s["attention"]["pending_complaints"] == 1
    assert s["attention"]["partner_requests"] == 1
    assert s["attention"]["unverified_users"] == 1
    assert s["platform"]["admins"] == 1 and s["platform"]["users"] == 2
    assert client.get("/api/admin/summary", headers=auth(client, "shop@test.com")).status_code == 403
