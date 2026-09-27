from models.user import UserRole
from conftest import make_user, make_zone, auth

def test_unauthenticated_writes_are_rejected(client, db):
    vendor = make_user(db, "v@test.com", UserRole.vendor)
    zone = make_zone(db, vendor)
    slot = zone.slots[0]
    assert client.patch(f"/api/zones/{zone.id}/slots/{slot.id}", json={"is_occupied": True}).status_code == 401
    assert client.post("/api/traffic/record", json={"zone_id": zone.id, "density": 0.5}).status_code == 401
    assert client.post("/api/detect/image", files={"file": ("a.jpg", b"x", "image/jpeg")}).status_code == 401
    assert client.get("/api/detect/logs").status_code == 401
    assert client.post("/api/bookings/", json={}).status_code == 401

def test_regular_user_cannot_use_staff_endpoints(client, db):
    vendor = make_user(db, "v@test.com", UserRole.vendor)
    zone = make_zone(db, vendor)
    make_user(db, "u@test.com")
    h = auth(client, "u@test.com")
    assert client.patch(f"/api/zones/{zone.id}/slots/{zone.slots[0].id}", headers=h, json={"is_occupied": True}).status_code == 403
    assert client.get("/api/admin/users", headers=h).status_code == 403
    assert client.get(f"/api/gate/overview?zone_id={zone.id}", headers=h).status_code == 403
    assert client.get("/api/complaints/", headers=h).status_code == 403
    assert client.get("/api/vendors/stats", headers=h).status_code == 403
    assert client.get("/api/detect/status", headers=h).status_code == 403

def test_vendor_cannot_manage_another_vendors_zone(client, db):
    owner = make_user(db, "owner@test.com", UserRole.vendor)
    make_user(db, "other@test.com", UserRole.vendor)
    zone = make_zone(db, owner)
    h = auth(client, "other@test.com")
    assert client.patch(f"/api/zones/{zone.id}", headers=h, json={"price_per_hour": 1}).status_code == 403
    assert client.post("/api/traffic/record", headers=h, json={"zone_id": zone.id, "density": 0.5}).status_code == 403
    assert client.get(f"/api/gate/overview?zone_id={zone.id}", headers=h).status_code == 403

def test_vendor_manages_own_zone(client, db):
    owner = make_user(db, "owner@test.com", UserRole.vendor)
    zone = make_zone(db, owner, slots=2)
    h = auth(client, "owner@test.com")
    assert client.post(f"/api/zones/{zone.id}/slots", headers=h, json={"count": 3}).json()["total_slots"] == 5
    assert client.patch(f"/api/zones/{zone.id}", headers=h, json={"upi_id": "bad upi"}).status_code == 422

def test_admin_approves_vendor_and_cannot_demote_self(client, db):
    admin = make_user(db, "admin@test.com", UserRole.admin)
    applicant = make_user(db, "shop@test.com")
    applicant.vendor_requested = True
    db.commit()
    h = auth(client, "admin@test.com")
    res = client.patch(f"/api/admin/users/{applicant.id}", headers=h, json={"role": "vendor"})
    assert res.status_code == 200 and res.json()["role"] == "vendor" and not res.json()["vendor_requested"]
    assert client.patch(f"/api/admin/users/{admin.id}", headers=h, json={"role": "user"}).status_code == 400
    assert client.patch(f"/api/admin/users/{admin.id}", headers=h, json={"is_active": False}).status_code == 400
