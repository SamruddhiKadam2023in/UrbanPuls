"""
Creates the first administrator account (safe to use in production).

    python create_admin.py --email you@example.com --name "Your Name"

The password is asked for interactively, or read from the ADMIN_PASSWORD environment variable.
"""
import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from core.database import SessionLocal
from core.security import hash_password, validate_password
from models.user import User, UserRole

def main():
    parser = argparse.ArgumentParser(description="Create an UrbanPuls administrator")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()

    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Password: ")
    try:
        validate_password(password)
    except ValueError as e:
        sys.exit(str(e))

    db = SessionLocal()
    email = args.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.role = UserRole.admin
        user.is_active = True
        print(f"Existing account {email} is now an administrator.")
    else:
        db.add(User(name=args.name, email=email, hashed_password=hash_password(password),
                    role=UserRole.admin, email_verified=True))
        print(f"Administrator {email} created.")
    db.commit()
    db.close()

if __name__ == "__main__":
    main()
