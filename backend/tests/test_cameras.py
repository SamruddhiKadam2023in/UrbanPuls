import cv2
import numpy as np
import pytest
from models.user import UserRole
from routes import detection
from services.violations import point_in_polygon, mark_violations
from yolo import detector
from conftest import make_user, make_zone, auth

SQUARE = [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]]   # bottom-right quarter of the image

def jpeg(w=400, h=300) -> bytes:
    return cv2.imencode(".jpg", np.full((h, w, 3), 90, np.uint8))[1].tobytes()

def add_camera(client, headers, zone_id=None, name="Gate 1 camera"):
    data = {"name": name}
    if zone_id is not None:
        data["zone_id"] = str(zone_id)
    return client.post("/api/detect/cameras", headers=headers, data=data, files={"image": ("cam.jpg", jpeg(), "image/jpeg")})

# ── Geometry ──────────────────────────────────────────────────────────────────
def test_point_in_polygon():
    assert point_in_polygon(0.75, 0.75, SQUARE)
    assert not point_in_polygon(0.25, 0.75, SQUARE)
    triangle = [[0, 0], [1, 0], [0, 1]]
    assert point_in_polygon(0.2, 0.2, triangle) and not point_in_polygon(0.8, 0.8, triangle)

def test_ground_point_decides_violation():
    # The car's roof is outside the area but its wheels (bottom of the box) are inside: violation
    car = {"label": "car", "confidence": 0.9, "bbox": [220, 100, 380, 280]}
    parked_elsewhere = {"label": "car", "confidence": 0.9, "bbox": [10, 100, 150, 280]}
    violations = mark_violations([car, parked_elsewhere], [SQUARE], 400, 300)
    assert violations == [car] and car["in_no_parking"] and not parked_elsewhere["in_no_parking"]

# ── Cameras ───────────────────────────────────────────────────────────────────
def test_camera_create_and_areas(client, db):
    make_user(db, "p@test.com", UserRole.police)
    h = auth(client, "p@test.com")
    cam = add_camera(client, h).json()
    assert cam["image_width"] == 400 and cam["image_height"] == 300 and cam["areas"] == []

    ok = client.patch(f"/api/detect/cameras/{cam['id']}", headers=h, json={"areas": [SQUARE]})
    assert ok.status_code == 200 and ok.json()["areas"] == [SQUARE]
    assert client.patch(f"/api/detect/cameras/{cam['id']}", headers=h, json={"areas": [[[0, 0], [1, 1]]]}).status_code == 422
    assert client.patch(f"/api/detect/cameras/{cam['id']}", headers=h, json={"areas": [[[0, 0], [2, 0], [0, 1]]]}).status_code == 422
    assert [c["id"] for c in client.get("/api/detect/cameras", headers=h).json()] == [cam["id"]]

def test_camera_permissions(client, db):
    partner = make_user(db, "partner@test.com", UserRole.vendor)
    zone = make_zone(db, partner)
    rival = make_user(db, "rival@test.com", UserRole.vendor)
    make_user(db, "u@test.com")
    make_user(db, "admin@test.com", UserRole.admin)
    hp, hr = auth(client, "partner@test.com"), auth(client, "rival@test.com")

    assert add_camera(client, auth(client, "u@test.com")).status_code == 403            # drivers can't
    assert add_camera(client, hr, zone_id=zone.id).status_code == 403                    # not their lot
    cam = add_camera(client, hp, zone_id=zone.id).json()
    assert client.get("/api/detect/cameras", headers=hr).json() == []                    # invisible to rivals
    assert client.patch(f"/api/detect/cameras/{cam['id']}", headers=hr, json={"name": "x"}).status_code == 403
    assert client.delete(f"/api/detect/cameras/{cam['id']}", headers=hr).status_code == 403
    ha = auth(client, "admin@test.com")
    assert len(client.get("/api/detect/cameras", headers=ha).json()) == 1                # admins see all
    assert client.delete(f"/api/detect/cameras/{cam['id']}", headers=hp).status_code == 200
    assert client.get("/api/detect/cameras", headers=hp).json() == []

# ── Detection with a camera ───────────────────────────────────────────────────
def test_detection_uses_camera_areas(client, db, monkeypatch):
    make_user(db, "p@test.com", UserRole.police)
    h = auth(client, "p@test.com")
    cam = add_camera(client, h).json()
    client.patch(f"/api/detect/cameras/{cam['id']}", headers=h, json={"areas": [SQUARE]})
    monkeypatch.setattr(detection, "run_detection", lambda frame: [
        {"label": "car", "confidence": 0.9, "bbox": [220, 100, 380, 280]},      # wheels in the no-parking area
        {"label": "motorcycle", "confidence": 0.8, "bbox": [10, 150, 80, 280]},  # parked outside it
    ])
    files = {"file": ("a.jpg", jpeg(), "image/jpeg")}
    with_cam = client.post("/api/detect/image", headers=h, data={"camera_id": str(cam["id"])}, files=files).json()
    assert with_cam["is_violation"] and [v["label"] for v in with_cam["violations"]] == ["car"]
    assert with_cam["width"] == 400 and with_cam["areas"] == [SQUARE]

    without = client.post("/api/detect/image", headers=h, files={"file": ("a.jpg", jpeg(), "image/jpeg")}).json()
    assert without["count"] == 2 and not without["is_violation"]   # no areas, so no violations

# ── The real model ────────────────────────────────────────────────────────────
@pytest.mark.skipif(not detector.model_available(), reason="yolo/model.onnx not present")
def test_real_model_runs_and_ignores_empty_road():
    frame = np.full((480, 640, 3), 128, np.uint8)
    assert detector.run_detection(frame) == []
    assert "car" in detector.LABELS and len(detector.LABELS) == 80
