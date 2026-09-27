from datetime import timedelta, timezone, datetime
from core.timeutil import utcnow
from models.booking import Booking, BookingStatus
from models.user import UserRole
from services import booking_service as bs
from conftest import make_user, make_zone, auth, reserve, window, iso

def setup(db, client, **user_kw):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor, slots=3, price=20.0)
    make_user(db, "u@test.com", **user_kw)
    return zone, auth(client, "u@test.com")

# ── Pricing ───────────────────────────────────────────────────────────────────
def test_fare_counts_whole_days():
    start = utcnow()
    # The old code used timedelta.seconds, which made a 24-hour booking cost 0
    assert bs.fare_for(start, start + timedelta(hours=24), 20)[1] == 480
    assert bs.fare_for(start, start + timedelta(minutes=10), 20)[1] == 20       # minimum 1 hour
    assert bs.fare_for(start, start + timedelta(minutes=61), 20)[1] == 30       # rounded up to 30 min
    assert bs.fare_for(start, start + timedelta(minutes=90), 20)[1] == 30

def test_points_never_discount_more_than_fare():
    assert bs.points_discount(1000, 30) == (60, 30)
    assert bs.points_discount(10, 30) == (10, 5)
    assert bs.points_discount(0, 30) == (0, 0)

# ── Reservations ──────────────────────────────────────────────────────────────
def test_reservation_created_with_estimate(client, db):
    zone, h = setup(db, client)
    start, end = window(hours=2)
    res = reserve(client, h, zone, zone.slots[0], start, end, vehicle="mh 01 ab-1234")
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "reserved"
    assert body["estimated_amount"] == 40
    assert body["vehicle_number"] == "MH01AB1234"
    assert len(body["booking_code"]) == 10

def test_timezone_offsets_are_respected(client, db):
    zone, h = setup(db, client)
    ist = timezone(timedelta(hours=5, minutes=30))
    start = (utcnow() + timedelta(hours=1)).astimezone(ist).replace(microsecond=0)
    res = reserve(client, h, zone, zone.slots[0], start, start + timedelta(hours=1))
    assert res.status_code == 201
    stored = db.get(Booking, res.json()["id"])
    assert stored.start_time == start.astimezone(timezone.utc)

def test_naive_datetimes_are_rejected(client, db):
    zone, h = setup(db, client)
    start = (datetime.now() + timedelta(hours=1)).replace(microsecond=0)
    res = client.post("/api/bookings/", headers=h, json={
        "zone_id": zone.id, "slot_id": zone.slots[0].id, "start_time": start.isoformat(),
        "end_time": (start + timedelta(hours=1)).isoformat(), "vehicle_number": "MH01AB1234"})
    assert res.status_code == 422

def test_same_slot_cannot_be_double_booked(client, db):
    zone, h = setup(db, client)
    make_user(db, "b@test.com")
    hb = auth(client, "b@test.com")
    slot = zone.slots[0]
    start, end = window(hours=2)
    assert reserve(client, h, zone, slot, start, end).status_code == 201
    # overlaps the second hour
    assert reserve(client, hb, zone, slot, start + timedelta(hours=1), end + timedelta(hours=1)).status_code == 409
    # starts exactly when the first one ends: allowed
    assert reserve(client, hb, zone, slot, end, end + timedelta(hours=1)).status_code == 201

def test_availability_excludes_reserved_slots(client, db):
    zone, h = setup(db, client)
    start, end = window(hours=2)
    reserve(client, h, zone, zone.slots[0], start, end)
    res = client.get(f"/api/zones/{zone.id}/availability", params={"start": iso(start), "end": iso(end)})
    ids = [s["id"] for s in res.json()["slots"]]
    assert zone.slots[0].id not in ids and len(ids) == 2

def test_window_limits(client, db):
    zone, h = setup(db, client)
    start = utcnow() + timedelta(minutes=5)
    assert reserve(client, h, zone, zone.slots[0], start, start + timedelta(hours=25)).status_code == 400
    assert reserve(client, h, zone, zone.slots[0], start, start - timedelta(hours=1)).status_code == 400
    past = utcnow() - timedelta(hours=1)
    assert reserve(client, h, zone, zone.slots[0], past, past + timedelta(hours=2)).status_code == 400

def test_unverified_user_cannot_book(client, db):
    zone, h = setup(db, client, verified=False)
    assert reserve(client, h, zone, zone.slots[0], *window()).status_code == 403

def test_max_active_reservations(client, db):
    zone, h = setup(db, client)
    start, end = window()
    assert reserve(client, h, zone, zone.slots[0], start, end, vehicle="MH01AA0001").status_code == 201
    assert reserve(client, h, zone, zone.slots[1], start, end, vehicle="MH01AA0002").status_code == 201
    assert reserve(client, h, zone, zone.slots[2], start, end, vehicle="MH01AA0003").status_code == 400

def test_points_must_be_owned(client, db):
    zone, h = setup(db, client, points=5)
    assert reserve(client, h, zone, zone.slots[0], *window(), points=10).status_code == 400

def test_cancel_only_reserved(client, db):
    zone, h = setup(db, client)
    booking_id = reserve(client, h, zone, zone.slots[0], *window()).json()["id"]
    assert client.delete(f"/api/bookings/{booking_id}", headers=h).status_code == 200
    assert client.delete(f"/api/bookings/{booking_id}", headers=h).status_code == 400

def test_extend_blocked_by_next_reservation(client, db):
    zone, h = setup(db, client)
    make_user(db, "b@test.com")
    hb = auth(client, "b@test.com")
    slot = zone.slots[0]
    start, end = window(hours=1)
    mine = reserve(client, h, zone, slot, start, end).json()["id"]
    reserve(client, hb, zone, slot, end + timedelta(minutes=30), end + timedelta(hours=2))
    ok = client.post(f"/api/bookings/{mine}/extend", headers=h, json={"end_time": iso(end + timedelta(minutes=30))})
    assert ok.status_code == 200 and ok.json()["estimated_amount"] == 30
    clash = client.post(f"/api/bookings/{mine}/extend", headers=h, json={"end_time": iso(end + timedelta(hours=1))})
    assert clash.status_code == 409

# ── No-shows ──────────────────────────────────────────────────────────────────
def test_no_show_job_and_booking_block(client, db):
    zone, h = setup(db, client)
    user_id = client.get("/api/auth/me", headers=h).json()["id"]
    booking_id = reserve(client, h, zone, zone.slots[0], *window()).json()["id"]

    b = db.get(Booking, booking_id)
    b.start_time = utcnow() - timedelta(minutes=20)   # grace period (15 min) has passed
    db.commit()
    assert [x.id for x in bs.expire_no_shows(db)] == [booking_id]
    db.refresh(b)
    assert b.status == BookingStatus.no_show

    # Two more missed bookings reach the limit of 3
    for _ in range(2):
        db.add(Booking(booking_code=bs.new_booking_code(db), user_id=user_id, slot_id=zone.slots[1].id,
                       zone_id=zone.id, vehicle_number="MH01AB1234", status=BookingStatus.no_show,
                       start_time=utcnow() - timedelta(days=1), end_time=utcnow() - timedelta(hours=23),
                       price_per_hour=20, estimated_amount=20))
    db.commit()
    res = reserve(client, h, zone, zone.slots[2], *window())
    assert res.status_code == 403 and "paused" in res.json()["detail"]
