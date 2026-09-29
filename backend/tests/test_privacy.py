from models.booking import Booking, BookingStatus
from models.user import User, UserRole
from conftest import make_user, make_zone, auth, reserve, window, PASSWORD

def test_export_contains_my_data_only(client, db):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor)
    make_user(db, "u@test.com")
    make_user(db, "other@test.com")
    hu = auth(client, "u@test.com")
    reserve(client, hu, zone, zone.slots[0], *window())
    reserve(client, auth(client, "other@test.com"), zone, zone.slots[1], *window())

    res = client.get("/api/auth/me/export", headers=hu)
    assert res.status_code == 200 and "attachment" in res.headers["content-disposition"]
    data = res.json()
    assert data["account"]["email"] == "u@test.com"
    assert len(data["bookings"]) == 1 and len(data["notifications"]) == 1
    assert "hashed_password" not in str(data)

def test_delete_account_anonymises_and_keeps_records(client, db):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor)
    user = make_user(db, "u@test.com", points=40)
    hu = auth(client, "u@test.com")
    b = reserve(client, hu, zone, zone.slots[0], *window()).json()

    assert client.request("DELETE", "/api/auth/me", headers=hu, json={"password": "wrong"}).status_code == 400
    assert client.request("DELETE", "/api/auth/me", headers=hu, json={"password": PASSWORD}).status_code == 200

    db.expire_all()
    u = db.get(User, user.id)
    assert u.email != "u@test.com" and u.name == "Deleted user" and u.phone is None and not u.is_active and u.points == 0
    assert db.get(Booking, b["id"]).status == BookingStatus.cancelled      # record kept, reservation released
    assert client.get("/api/auth/me", headers=hu).status_code == 401       # signed out everywhere
    assert client.post("/api/auth/login", data={"username": "u@test.com", "password": PASSWORD}).status_code == 401
    # The address can be used again for a new account
    assert client.post("/api/auth/register", json={"name": "New", "email": "u@test.com", "password": "fresh1234", "accept_terms": True}).status_code == 201

def test_cannot_delete_while_parked(client, db):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor)
    make_user(db, "u@test.com")
    hu, hv = auth(client, "u@test.com"), auth(client, "vendor@test.com")
    b = reserve(client, hu, zone, zone.slots[0], *window()).json()
    client.post("/api/gate/check-in", headers=hv, json={"booking_code": b["booking_code"]})
    res = client.request("DELETE", "/api/auth/me", headers=hu, json={"password": PASSWORD})
    assert res.status_code == 400 and "parked" in res.json()["detail"]

def test_partner_with_lots_and_last_admin_cannot_delete(client, db):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    make_zone(db, vendor)
    make_user(db, "admin@test.com", UserRole.admin)
    assert client.request("DELETE", "/api/auth/me", headers=auth(client, "vendor@test.com"), json={"password": PASSWORD}).status_code == 400
    assert client.request("DELETE", "/api/auth/me", headers=auth(client, "admin@test.com"), json={"password": PASSWORD}).status_code == 400
