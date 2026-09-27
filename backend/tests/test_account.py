from models.user import User
from conftest import make_user, auth, PASSWORD

def test_update_name_and_phone(client, db):
    make_user(db, "u@test.com")
    h = auth(client, "u@test.com")
    res = client.patch("/api/auth/me", headers=h, json={"name": "  Asha Patil ", "phone": "+91 98765 43210"})
    assert res.status_code == 200 and res.json()["name"] == "Asha Patil" and res.json()["phone"] == "+91 98765 43210"
    assert client.patch("/api/auth/me", headers=h, json={"phone": ""}).json()["phone"] is None
    assert client.patch("/api/auth/me", headers=h, json={"phone": "abc"}).status_code == 422
    assert client.patch("/api/auth/me", headers=h, json={"name": "   "}).status_code == 422

def test_profile_cannot_change_role_or_points(client, db):
    make_user(db, "u@test.com")
    h = auth(client, "u@test.com")
    res = client.patch("/api/auth/me", headers=h, json={"role": "admin", "points": 9999, "email_verified": True})
    assert res.status_code == 200 and res.json()["role"] == "user" and res.json()["points"] == 0

def test_change_email_needs_password_and_reverification(client, db):
    make_user(db, "u@test.com")
    make_user(db, "taken@test.com")
    h = auth(client, "u@test.com")
    assert client.post("/api/auth/change-email", headers=h, json={"new_email": "new@test.com", "password": "wrong"}).status_code == 400
    assert client.post("/api/auth/change-email", headers=h, json={"new_email": "TAKEN@test.com", "password": PASSWORD}).status_code == 400
    res = client.post("/api/auth/change-email", headers=h, json={"new_email": "New@Test.com", "password": PASSWORD})
    assert res.status_code == 200 and res.json()["email"] == "new@test.com" and not res.json()["email_verified"]
    auth(client, "new@test.com")     # signs in with the new address

def test_change_password_signs_out_other_sessions(client, db):
    make_user(db, "u@test.com")
    phone = auth(client, "u@test.com")        # another device
    laptop = auth(client, "u@test.com")
    bad = client.post("/api/auth/change-password", headers=laptop, json={"current_password": "wrong", "new_password": "newpass123"})
    assert bad.status_code == 400
    same = client.post("/api/auth/change-password", headers=laptop, json={"current_password": PASSWORD, "new_password": PASSWORD})
    assert same.status_code == 400
    res = client.post("/api/auth/change-password", headers=laptop, json={"current_password": PASSWORD, "new_password": "newpass123"})
    assert res.status_code == 200
    fresh = {"Authorization": f"Bearer {res.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=fresh).status_code == 200
    assert client.get("/api/auth/me", headers=phone).status_code == 401
    assert client.get("/api/auth/me", headers=laptop).status_code == 401
    auth(client, "u@test.com", "newpass123")
