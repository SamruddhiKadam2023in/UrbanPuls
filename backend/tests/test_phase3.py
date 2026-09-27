from datetime import timedelta
import pytest
from core.timeutil import utcnow
from models.activity import Notification
from models.booking import Booking, BookingStatus
from models.user import User, UserRole
from services import booking_service as bs
from services.live import queue_event
from conftest import make_user, make_zone, auth, reserve, window

def setup(db, client, points=0):
    vendor = make_user(db, "vendor@test.com", UserRole.vendor)
    zone = make_zone(db, vendor, slots=3, price=20.0)
    make_user(db, "u@test.com", points=points)
    return zone, auth(client, "u@test.com"), auth(client, "vendor@test.com")

def token_of(headers):
    return headers["Authorization"].split()[1]

def complete_visit(client, db, zone, hu, hv, minutes=110):
    """Parks for 1h50m by default, which is billed as exactly 2 hours."""
    b = reserve(client, hu, zone, zone.slots[0], *window()).json()
    client.post("/api/gate/check-in", headers=hv, json={"booking_code": b["booking_code"]})
    row = db.get(Booking, b["id"])
    row.checked_in_at = utcnow() - timedelta(minutes=minutes)
    db.commit()
    client.post("/api/gate/check-out", headers=hv, json={"booking_id": b["id"], "payment_method": "cash"})
    return b

# ── Live updates and notifications ────────────────────────────────────────────
def test_live_socket_requires_login(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/api/live/ws?token=bad") as ws:
            ws.receive_text()

def test_reservation_pushes_notification_and_zone_update(client, db):
    zone, hu, _ = setup(db, client)
    with client.websocket_connect(f"/api/live/ws?token={token_of(hu)}") as ws:
        reserve(client, hu, zone, zone.slots[0], *window())
        events = [ws.receive_json(), ws.receive_json()]
    types = {e["type"] for e in events}
    assert types == {"notification", "zone_changed"}
    note = next(e for e in events if e["type"] == "notification")["notification"]
    assert note["title"] == "Parking reserved" and note["link"] == "/bookings"

    listing = client.get("/api/notifications/", headers=hu).json()
    assert listing["unread"] == 1
    nid = listing["items"][0]["id"]
    assert client.post(f"/api/notifications/{nid}/read", headers=hu).status_code == 200
    assert client.get("/api/notifications/", headers=hu).json()["unread"] == 0

def test_rolled_back_changes_are_not_published(db):
    db.query(User).count()          # routes always query before queueing, so a transaction is open
    queue_event(db, "public", {"type": "zone_changed", "zone_id": 1})
    db.rollback()
    assert "live_events" not in db.info

def test_users_cannot_read_others_notifications(client, db):
    zone, hu, _ = setup(db, client)
    reserve(client, hu, zone, zone.slots[0], *window())
    make_user(db, "other@test.com")
    ho = auth(client, "other@test.com")
    nid = client.get("/api/notifications/", headers=hu).json()["items"][0]["id"]
    assert client.get("/api/notifications/", headers=ho).json()["items"] == []
    assert client.post(f"/api/notifications/{nid}/read", headers=ho).status_code == 404

def test_checkout_and_no_show_notify_user(client, db):
    zone, hu, hv = setup(db, client)
    complete_visit(client, db, zone, hu, hv)
    titles = [n["title"] for n in client.get("/api/notifications/", headers=hu).json()["items"]]
    assert "Thanks for parking with us" in titles and "Checked in" in titles

    late = reserve(client, hu, zone, zone.slots[1], *window()).json()
    row = db.get(Booking, late["id"])
    row.start_time = utcnow() - timedelta(minutes=20)
    db.commit()
    bs.expire_no_shows(db)
    titles = [n["title"] for n in client.get("/api/notifications/", headers=hu).json()["items"]]
    assert "Reservation released" in titles

def test_reminder_sent_once(client, db):
    zone, hu, _ = setup(db, client)
    b = reserve(client, hu, zone, zone.slots[0], *window(start_in_minutes=20)).json()
    row = db.get(Booking, b["id"])
    row.created_at = utcnow() - timedelta(hours=3)   # booked well in advance
    db.commit()
    assert [x.id for x in bs.send_reminders(db)] == [b["id"]]
    assert bs.send_reminders(db) == []
    reminders = db.query(Notification).filter_by(type="reminder").count()
    assert reminders == 1

# ── Ratings ───────────────────────────────────────────────────────────────────
def test_rating_after_checkout_only_once(client, db):
    zone, hu, hv = setup(db, client)
    upcoming = reserve(client, hu, zone, zone.slots[1], *window(start_in_minutes=60)).json()
    assert client.post(f"/api/bookings/{upcoming['id']}/rating", headers=hu, json={"stars": 5}).status_code == 400

    b = complete_visit(client, db, zone, hu, hv)
    assert client.post(f"/api/bookings/{b['id']}/rating", headers=hu, json={"stars": 4, "comment": "Easy"}).status_code == 201
    assert client.post(f"/api/bookings/{b['id']}/rating", headers=hu, json={"stars": 1}).status_code == 400
    assert client.post(f"/api/bookings/{b['id']}/rating", headers=hu, json={"stars": 6}).status_code == 422

    z = next(z for z in client.get("/api/zones/").json() if z["id"] == zone.id)
    assert z["avg_rating"] == 4.0 and z["rating_count"] == 1
    assert z["upi_id"] is None                      # UPI details are not public
    assert client.get(f"/api/zones/{zone.id}/ratings").json()[0]["by"] == "U"
    mine = client.get("/api/bookings/my", headers=hu).json()
    assert next(x for x in mine if x["id"] == b["id"])["rating"] == 4

# ── Complaints timeline and police ───────────────────────────────────────────
def test_complaint_timeline_and_police_resolution(client, db):
    make_user(db, "admin@test.com", UserRole.admin)
    make_user(db, "police@test.com", UserRole.police)
    make_user(db, "u@test.com")
    hu, ha, hp = auth(client, "u@test.com"), auth(client, "admin@test.com"), auth(client, "police@test.com")

    cid = client.post("/api/complaints/", headers=hu, data={
        "complaint_type": "illegal_parking", "latitude": "19.0", "longitude": "72.8"}).json()["complaint_id"]
    assert client.get("/api/notifications/", headers=ha).json()["unread"] == 1

    assert client.patch(f"/api/complaints/{cid}/resolve", headers=hp, json={"note": "x"}).status_code == 400  # not verified yet
    assert client.patch(f"/api/complaints/{cid}/verify", headers=ha).status_code == 200
    assert client.get("/api/notifications/", headers=hp).json()["unread"] == 1
    assert client.patch(f"/api/complaints/{cid}/resolve", headers=hp, json={"note": "Vehicle towed"}).status_code == 200

    mine = client.get("/api/complaints/my", headers=hu).json()[0]
    assert [e["status"] for e in mine["timeline"]] == ["pending", "verified", "resolved"]
    assert mine["timeline"][-1]["note"] == "Vehicle towed"
    assert mine["timeline"][-1]["by"] == "Police"            # reporters don't see staff names
    assert "reporter" not in mine
    staff_view = client.get("/api/complaints/?status=resolved", headers=hp).json()[0]
    assert staff_view["reporter"]["email"] == "u@test.com"

def test_reject_includes_reason(client, db):
    make_user(db, "admin@test.com", UserRole.admin)
    make_user(db, "u@test.com")
    hu, ha = auth(client, "u@test.com"), auth(client, "admin@test.com")
    cid = client.post("/api/complaints/", headers=hu, data={
        "complaint_type": "accident", "latitude": "19", "longitude": "72"}).json()["complaint_id"]
    client.patch(f"/api/complaints/{cid}/reject", headers=ha, json={"note": "Photo unclear"})
    note = client.get("/api/notifications/", headers=hu).json()["items"][0]
    assert "Photo unclear" in note["message"]

# ── Reports and occupancy ─────────────────────────────────────────────────────
def test_revenue_report_and_exports(client, db):
    zone, hu, hv = setup(db, client)
    complete_visit(client, db, zone, hu, hv)                    # 2 hours at Rs 20 = Rs 40 cash
    client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone.id, "vehicle_number": "MH02CD5678"})

    rep = client.get("/api/vendors/report", headers=hv, params={"period": "day"}).json()
    assert rep["totals"]["revenue"] == 40 and rep["totals"]["cash"] == 40
    assert rep["totals"]["reservations"] == 1 and rep["totals"]["walk_ins"] == 1
    assert client.get("/api/vendors/report", headers=hv, params={"period": "month"}).json()["totals"]["revenue"] == 40

    csv = client.get("/api/vendors/report", headers=hv, params={"format": "csv"})
    assert csv.headers["content-type"].startswith("text/csv") and csv.text.splitlines()[-1].startswith("Total")
    pdf = client.get("/api/vendors/report", headers=hv, params={"format": "pdf", "zone_id": zone.id})
    assert pdf.content[:4] == b"%PDF"

    make_user(db, "rival@test.com", UserRole.vendor)
    hr = auth(client, "rival@test.com")
    assert client.get("/api/vendors/report", headers=hr, params={"zone_id": zone.id}).status_code == 403
    assert client.get("/api/vendors/report", headers=hr).json()["totals"]["revenue"] == 0

def test_occupancy(client, db):
    zone, hu, hv = setup(db, client)
    reserve(client, hu, zone, zone.slots[0], *window(start_in_minutes=0))
    client.post("/api/gate/walk-in", headers=hv, json={"zone_id": zone.id, "vehicle_number": "MH02CD5678"})
    occ = client.get("/api/vendors/occupancy", headers=hv).json()[0]
    assert (occ["total"], occ["parked"], occ["reserved"], occ["free"]) == (3, 1, 1, 1)

# ── Admin ─────────────────────────────────────────────────────────────────────
def test_admin_search_and_vendor_approval_notifies(client, db):
    make_user(db, "admin@test.com", UserRole.admin)
    shop = make_user(db, "shopkeeper@test.com")
    shop.vendor_requested = True
    db.commit()
    ha = auth(client, "admin@test.com")
    found = client.get("/api/admin/users", headers=ha, params={"search": "SHOPK"}).json()
    assert [u["email"] for u in found] == ["shopkeeper@test.com"]
    client.patch(f"/api/admin/users/{shop.id}", headers=ha, json={"role": "vendor"})
    hs = auth(client, "shopkeeper@test.com")
    assert client.get("/api/notifications/", headers=hs).json()["items"][0]["title"] == "Vendor account approved"
