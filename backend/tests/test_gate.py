import os
from datetime import timedelta
from core.timeutil import utcnow
from models.booking import Booking, BookingStatus
from models.parking import ParkingSlot
from models.user import User, UserRole
from conftest import make_user, make_zone, auth, reserve, window

def setup(db, client, points=0):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor, slots=3, price=20.0)
    make_user(db, "u@test.com", points=points)
    return zone, auth(client, "u@test.com"), auth(client, "vendor@test.com")

def test_full_gate_flow_with_points(client, db):
    zone, hu, hv = setup(db, client, points=30)
    booking = reserve(client, hu, zone, zone.slots[0], *window(), points=20).json()

    res = client.post("/api/gate/check-in", headers=hv, json={"booking_code": booking["booking_code"].lower()})
    assert res.status_code == 200 and res.json()["status"] == "checked_in"
    db.expire_all()   # the API changed the rows through its own session
    assert db.get(ParkingSlot, zone.slots[0].id).is_occupied

    # Pretend the car has been parked for 2 hours 10 minutes
    b = db.get(Booking, booking["id"])
    b.checked_in_at = utcnow() - timedelta(hours=2, minutes=10)
    db.commit()

    quote = client.get(f"/api/gate/checkout-quote/{booking['id']}", headers=hv).json()
    assert quote["fare"] == 50            # 2h30m billed at Rs 20/h
    assert quote["points_used"] == 20 and quote["discount"] == 10
    assert quote["payable"] == 40
    assert quote["upi_uri"].startswith("upi://pay?pa=test%40upi") and "am=40.00" in quote["upi_uri"]

    assert client.post("/api/gate/check-out", headers=hv, json={"booking_id": booking["id"]}).status_code == 400
    done = client.post("/api/gate/check-out", headers=hv, json={"booking_id": booking["id"], "payment_method": "upi"})
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["status"] == "completed" and body["final_amount"] == 40 and body["has_receipt"]

    db.expire_all()
    assert db.query(User).filter_by(email="u@test.com").one().points == 10
    assert not db.get(ParkingSlot, zone.slots[0].id).is_occupied
    assert os.path.exists(db.get(Booking, booking["id"]).receipt_path)

    receipt = client.get(f"/api/bookings/{booking['id']}/receipt", headers=hu)
    assert receipt.status_code == 200 and receipt.headers["content-type"] == "application/pdf"

def test_other_vendor_cannot_check_in(client, db):
    zone, hu, _ = setup(db, client)
    make_user(db, "rival@test.com", UserRole.vendor)
    code = reserve(client, hu, zone, zone.slots[0], *window()).json()["booking_code"]
    res = client.post("/api/gate/check-in", headers=auth(client, "rival@test.com"), json={"booking_code": code})
    assert res.status_code == 404

def test_check_in_too_early_and_too_late(client, db):
    zone, hu, hv = setup(db, client)
    early = reserve(client, hu, zone, zone.slots[0], *window(start_in_minutes=120)).json()
    assert client.post("/api/gate/check-in", headers=hv, json={"booking_code": early["booking_code"]}).status_code == 400

    late = reserve(client, hu, zone, zone.slots[1], *window()).json()
    b = db.get(Booking, late["id"])
    b.start_time = utcnow() - timedelta(minutes=30)
    db.commit()
    assert client.post("/api/gate/check-in", headers=hv, json={"booking_code": late["booking_code"]}).status_code == 400
    db.refresh(b)
    assert b.status == BookingStatus.no_show

def test_occupied_slot_is_reassigned_at_check_in(client, db):
    zone, hu, hv = setup(db, client)
    booking = reserve(client, hu, zone, zone.slots[0], *window()).json()
    slot = db.get(ParkingSlot, zone.slots[0].id)
    slot.is_occupied = True     # previous car overstayed
    db.commit()
    db.expire_all()
    res = client.post("/api/gate/check-in", headers=hv, json={"booking_code": booking["booking_code"]})
    assert res.status_code == 200 and res.json()["slot_id"] != zone.slots[0].id

def test_walk_in(client, db):
    zone, _, hv = setup(db, client)
    res = client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone.id, "vehicle_number": "MH02CD5678"})
    assert res.status_code == 201 and res.json()["is_walk_in"] and res.json()["status"] == "checked_in"
    again = client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone.id, "vehicle_number": "MH02CD5678"})
    assert again.status_code == 400

    overview = client.get(f"/api/gate/overview?zone_id={zone.id}", headers=hv).json()
    assert overview["free_now"] == 2 and len(overview["parked"]) == 1

def test_walk_in_skips_reserved_slots(client, db):
    zone, hu, hv = setup(db, client)
    reserve(client, hu, zone, zone.slots[0], *window(start_in_minutes=0, hours=3))
    res = client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone.id, "vehicle_number": "MH02CD5678"})
    assert res.json()["slot_id"] != zone.slots[0].id
