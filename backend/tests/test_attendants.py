from datetime import timedelta
from core.timeutil import utcnow
from models.booking import Booking
from models.user import User, UserRole
from conftest import make_user, make_zone, auth, reserve, window

STAFF = {"name": "Ravi Gate", "email": "ravi@test.com", "password": "gatepass1"}

def setup(db, client):
    partner = make_user(db, "partner@test.com", UserRole.vendor)
    zone = make_zone(db, partner, slots=3)
    make_user(db, "u@test.com")
    hp = auth(client, "partner@test.com")
    staff = client.post("/api/vendors/staff", headers=hp, json=STAFF)
    assert staff.status_code == 201, staff.text
    return partner, zone, hp, auth(client, "u@test.com"), auth(client, STAFF["email"], STAFF["password"])

def test_attendant_runs_the_gate_for_employer(client, db):
    partner, zone, hp, hu, ha = setup(db, client)
    assert [z["id"] for z in client.get("/api/zones/manage/mine", headers=ha).json()] == [zone.id]

    b = reserve(client, hu, zone, zone.slots[0], *window()).json()
    assert client.post("/api/gate/check-in", headers=ha, json={"booking_code": b["booking_code"]}).status_code == 200
    row = db.get(Booking, b["id"])
    row.checked_in_at = utcnow() - timedelta(minutes=50)
    db.commit()
    out = client.post("/api/gate/check-out", headers=ha, json={"booking_id": b["id"], "payment_method": "cash"})
    assert out.status_code == 200
    db.expire_all()
    staff = db.query(User).filter_by(email=STAFF["email"]).one()
    assert db.get(Booking, b["id"]).payment_recorded_by == staff.id     # who took the money
    assert client.get(f"/api/bookings/{b['id']}/receipt", headers=ha).status_code == 200

def test_attendant_cannot_manage_or_see_reports(client, db):
    partner, zone, hp, hu, ha = setup(db, client)
    assert client.patch(f"/api/zones/{zone.id}", headers=ha, json={"price_per_hour": 1}).status_code == 403
    assert client.post("/api/zones/", headers=ha, json={}).status_code in (403, 422)
    assert client.get("/api/vendors/report", headers=ha).status_code == 403
    assert client.get("/api/vendors/today", headers=ha).status_code == 403
    assert client.get("/api/vendors/staff", headers=ha).status_code == 403

def test_attendant_limited_to_employer_lots(client, db):
    partner, zone, hp, hu, ha = setup(db, client)
    rival = make_user(db, "rival@test.com", UserRole.vendor)
    other = make_zone(db, rival, name="Rival Lot")
    b = reserve(client, hu, other, other.slots[0], *window()).json()
    assert client.post("/api/gate/check-in", headers=ha, json={"booking_code": b["booking_code"]}).status_code == 404
    assert client.get(f"/api/gate/overview?zone_id={other.id}", headers=ha).status_code == 403

def test_partner_manages_own_staff_only(client, db):
    partner, zone, hp, hu, ha = setup(db, client)
    staff_id = client.get("/api/vendors/staff", headers=hp).json()[0]["id"]
    make_user(db, "rival@test.com", UserRole.vendor)
    hr = auth(client, "rival@test.com")
    assert client.get("/api/vendors/staff", headers=hr).json() == []
    assert client.patch(f"/api/vendors/staff/{staff_id}", headers=hr, json={"is_active": False}).status_code == 404

    # Partner disables the attendant: access stops immediately
    assert client.patch(f"/api/vendors/staff/{staff_id}", headers=hp, json={"is_active": False}).status_code == 200
    assert client.get("/api/auth/me", headers=ha).status_code == 403

def test_new_password_signs_attendant_out(client, db):
    partner, zone, hp, hu, ha = setup(db, client)
    staff_id = client.get("/api/vendors/staff", headers=hp).json()[0]["id"]
    client.patch(f"/api/vendors/staff/{staff_id}", headers=hp, json={"password": "newgate123"})
    assert client.get("/api/auth/me", headers=ha).status_code == 401
    auth(client, STAFF["email"], "newgate123")

def test_attendant_loses_access_when_partner_disabled(client, db):
    partner, zone, hp, hu, ha = setup(db, client)
    make_user(db, "admin@test.com", UserRole.admin)
    client.patch(f"/api/admin/users/{partner.id}", headers=auth(client, "admin@test.com"), json={"is_active": False})
    assert client.get("/api/zones/manage/mine", headers=ha).status_code == 403

def test_admin_cannot_create_attendants_directly(client, db):
    make_user(db, "admin@test.com", UserRole.admin)
    u = make_user(db, "x@test.com")
    h = auth(client, "admin@test.com")
    assert client.post("/api/admin/users", headers=h, json={**STAFF, "role": "attendant"}).status_code == 422
    assert client.patch(f"/api/admin/users/{u.id}", headers=h, json={"role": "attendant"}).status_code == 400
