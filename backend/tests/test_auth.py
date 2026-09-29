from core.security import create_verify_token, create_reset_token
from models.user import User, UserRole
from conftest import make_user, auth, PASSWORD

def register(client, **overrides):
    body = {"name": "New Person", "email": "new@test.com", "password": "goodpass1", "accept_terms": True, **overrides}
    return client.post("/api/auth/register", json=body)

def test_register_cannot_choose_admin_role(client, db):
    res = register(client, role="admin")
    assert res.status_code == 201
    user = db.query(User).filter_by(email="new@test.com").one()
    assert user.role == UserRole.user
    assert not user.email_verified

def test_vendor_signup_needs_approval(client, db):
    res = register(client, account_type="vendor")
    assert res.status_code == 201
    user = db.query(User).filter_by(email="new@test.com").one()
    assert user.role == UserRole.user and user.vendor_requested

def test_terms_must_be_accepted(client, db):
    assert register(client, accept_terms=False).status_code == 422
    assert register(client).status_code == 201
    assert db.query(User).filter_by(email="new@test.com").one().terms_accepted_at is not None

def test_weak_password_rejected(client):
    assert register(client, password="short1").status_code == 422
    assert register(client, password="onlyletters").status_code == 422

def test_duplicate_email_is_case_insensitive(client):
    assert register(client).status_code == 201
    assert register(client, email="NEW@test.com").status_code == 400

def test_login_and_disabled_account(client, db):
    make_user(db, "ok@test.com")
    make_user(db, "off@test.com", active=False)
    assert client.post("/api/auth/login", data={"username": "OK@test.com", "password": PASSWORD}).status_code == 200
    assert client.post("/api/auth/login", data={"username": "ok@test.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", data={"username": "off@test.com", "password": PASSWORD}).status_code == 403

def test_disabled_account_token_stops_working(client, db):
    user = make_user(db, "ok@test.com")
    headers = auth(client, "ok@test.com")
    user.is_active = False
    db.commit()
    assert client.get("/api/auth/me", headers=headers).status_code == 403

def test_email_verification(client, db):
    user = make_user(db, "v@test.com", verified=False)
    res = client.post("/api/auth/verify-email", json={"token": create_verify_token(user)})
    assert res.status_code == 200
    db.refresh(user)
    assert user.email_verified

def test_access_token_cannot_be_used_as_reset_token(client, db):
    make_user(db, "a@test.com")
    access = auth(client, "a@test.com")["Authorization"].split()[1]
    res = client.post("/api/auth/reset-password", json={"token": access, "password": "newpass123"})
    assert res.status_code == 400

def test_password_reset_link_works_once(client, db):
    user = make_user(db, "r@test.com")
    token = create_reset_token(user)
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "newpass123"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "other123"}).status_code == 400
    auth(client, "r@test.com", "newpass123")

def test_forgot_password_does_not_reveal_accounts(client, db):
    make_user(db, "known@test.com")
    a = client.post("/api/auth/forgot-password", json={"email": "known@test.com"})
    b = client.post("/api/auth/forgot-password", json={"email": "unknown@test.com"})
    assert a.status_code == b.status_code == 200
    assert a.json() == b.json()
