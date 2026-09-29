import cv2
import numpy as np
from core.config import settings
from models.user import User, UserRole
from routes import detection
from conftest import make_user, auth

def submit(client, headers):
    return client.post("/api/complaints/", headers=headers, data={
        "complaint_type": "illegal_parking", "description": "Blocking gate", "latitude": "19.0", "longitude": "72.8"})

def test_complaint_verified_only_once(client, db):
    make_user(db, "admin@test.com", UserRole.admin)
    make_user(db, "u@test.com")
    cid = submit(client, auth(client, "u@test.com")).json()["complaint_id"]
    ha = auth(client, "admin@test.com")
    assert client.patch(f"/api/complaints/{cid}/verify", headers=ha).status_code == 200
    assert client.patch(f"/api/complaints/{cid}/verify", headers=ha).status_code == 400
    db.expire_all()
    assert db.query(User).filter_by(email="u@test.com").one().points == settings.COMPLAINT_REWARD_POINTS
    fine = client.get(f"/api/complaints/{cid}/fine", headers=ha)
    assert fine.status_code == 200 and fine.headers["content-type"] == "application/pdf"

def test_unverified_user_cannot_complain(client, db):
    make_user(db, "u@test.com", verified=False)
    assert submit(client, auth(client, "u@test.com")).status_code == 403

def test_photo_type_is_checked(client, db):
    make_user(db, "u@test.com")
    res = client.post("/api/complaints/", headers=auth(client, "u@test.com"),
                      data={"complaint_type": "accident", "latitude": "19", "longitude": "72"},
                      files={"photo": ("x.exe", b"MZ", "application/octet-stream")})
    assert res.status_code == 400

def _jpeg() -> bytes:
    return cv2.imencode(".jpg", np.zeros((64, 64, 3), np.uint8))[1].tobytes()

def test_detection_disabled_without_model_when_mock_not_allowed(client, db, monkeypatch):
    make_user(db, "p@test.com", UserRole.police)
    monkeypatch.setattr(settings, "YOLO_ALLOW_MOCK", False)
    monkeypatch.setattr(detection, "model_available", lambda: False)   # as if model.onnx were missing
    res = client.post("/api/detect/image", headers=auth(client, "p@test.com"),
                      files={"file": ("a.jpg", _jpeg(), "image/jpeg")})
    assert res.status_code == 503

def test_plain_car_is_not_a_violation(client, db, monkeypatch):
    make_user(db, "p@test.com", UserRole.police)
    monkeypatch.setattr(detection, "run_detection", lambda frame: [{"label": "car", "confidence": 0.9, "bbox": [0, 0, 1, 1]}])
    res = client.post("/api/detect/image", headers=auth(client, "p@test.com"),
                      files={"file": ("a.jpg", _jpeg(), "image/jpeg")})
    assert res.status_code == 200 and res.json()["is_violation"] is False
