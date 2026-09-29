from datetime import timedelta
from core.timeutil import utcnow
from models.booking import Booking
from models.user import UserRole
from conftest import make_user, auth, iso, window

def make_mixed_zone(client, hv):
    res = client.post("/api/zones/", headers=hv, json={
        "name": "Mixed Lot", "address": "Somewhere", "latitude": 19.0, "longitude": 72.8,
        "total_slots": 2, "two_wheeler_slots": 3, "price_per_hour": 40, "two_wheeler_price_per_hour": 10})
    assert res.status_code == 201, res.text
    return next(z for z in client.get("/api/zones/manage/mine", headers=hv).json() if z["id"] == res.json()["zone_id"])

def setup(db, client):
    make_user(db, "vendor@test.com", UserRole.vendor)
    make_user(db, "u@test.com")
    hv, hu = auth(client, "vendor@test.com"), auth(client, "u@test.com")
    return make_mixed_zone(client, hv), hv, hu

def test_zone_has_car_and_bike_slots(client, db):
    zone, hv, hu = setup(db, client)
    assert zone["slots_by_type"] == {"four_wheeler": 2, "two_wheeler": 3}
    assert zone["available_by_type"] == {"four_wheeler": 2, "two_wheeler": 3}
    numbers = sorted(s["slot_number"] for s in zone["slots"])
    assert numbers == ["B001", "B002", "B003", "S001", "S002"]

def test_bike_availability_and_price(client, db):
    zone, hv, hu = setup(db, client)
    start, end = window(hours=2)
    bikes = client.get(f"/api/zones/{zone['id']}/availability",
                       params={"start": iso(start), "end": iso(end), "vehicle_type": "two_wheeler"}).json()
    cars = client.get(f"/api/zones/{zone['id']}/availability", params={"start": iso(start), "end": iso(end)}).json()
    assert len(bikes["slots"]) == 3 and bikes["estimated_amount"] == 20 and bikes["price_per_hour"] == 10
    assert len(cars["slots"]) == 2 and cars["estimated_amount"] == 80

    bike_slot = bikes["slots"][0]["id"]
    base = {"zone_id": zone["id"], "slot_id": bike_slot, "start_time": iso(start), "end_time": iso(end), "vehicle_number": "MH01XY9999"}
    # A car can't take a two-wheeler slot
    assert client.post("/api/bookings/", headers=hu, json=base).status_code == 400
    res = client.post("/api/bookings/", headers=hu, json={**base, "vehicle_type": "two_wheeler"})
    assert res.status_code == 201 and res.json()["vehicle_type"] == "two_wheeler" and res.json()["estimated_amount"] == 20

def test_bike_checkout_uses_bike_rate(client, db):
    zone, hv, hu = setup(db, client)
    res = client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone["id"], "vehicle_number": "MH01XY9999", "vehicle_type": "two_wheeler"})
    assert res.status_code == 201 and res.json()["slot_number"].startswith("B")
    b = db.get(Booking, res.json()["id"])
    b.checked_in_at = utcnow() - timedelta(minutes=110)
    db.commit()
    quote = client.get(f"/api/gate/checkout-quote/{b.id}", headers=hv).json()
    assert quote["fare"] == 20    # 2 hours at Rs 10

def test_add_bike_slots_later(client, db):
    zone, hv, hu = setup(db, client)
    client.post(f"/api/zones/{zone['id']}/slots", headers=hv, json={"count": 2, "vehicle_type": "two_wheeler"})
    z = next(z for z in client.get("/api/zones/manage/mine", headers=hv).json() if z["id"] == zone["id"])
    assert z["slots_by_type"]["two_wheeler"] == 5

def test_zone_needs_at_least_one_slot(client, db):
    make_user(db, "vendor@test.com", UserRole.vendor)
    res = client.post("/api/zones/", headers=auth(client, "vendor@test.com"), json={
        "name": "Empty", "address": "X", "latitude": 19, "longitude": 72, "total_slots": 0, "two_wheeler_slots": 0})
    assert res.status_code == 422
