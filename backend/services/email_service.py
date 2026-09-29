import logging
import smtplib
from email.message import EmailMessage
from core.config import settings
from core.security import create_reset_token, create_verify_token
from models.user import User

log = logging.getLogger("tpms.email")

def send_email(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        # Development fallback: print the email so links can still be followed
        log.warning("SMTP not configured, email not sent.\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception:
        log.exception("Failed to send email to %s", to)

def send_verification_email(user: User) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?token={create_verify_token(user)}"
    send_email(user.email, "Verify your UrbanPuls account",
               f"Hi {user.name},\n\nPlease confirm your email address by opening this link:\n{link}\n\n"
               f"The link is valid for {settings.VERIFY_TOKEN_EXPIRE_HOURS} hours.\n\n— UrbanPuls")

def send_password_reset_email(user: User) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={create_reset_token(user)}"
    send_email(user.email, "Reset your UrbanPuls password",
               f"Hi {user.name},\n\nSomeone asked to reset the password for this account. "
               f"If it was you, open this link to choose a new password:\n{link}\n\n"
               f"The link is valid for {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes and works once. "
               f"If you did not ask for this, you can ignore this email.\n\n— UrbanPuls")

def send_email_changed_notice(old_email: str, name: str, new_email: str) -> None:
    send_email(old_email, "Your UrbanPuls email address was changed",
               f"Hi {name},\n\nThe email address on your UrbanPuls account was changed to {new_email}.\n\n"
               f"If you did not do this, reset your password straight away at {settings.FRONTEND_URL}/forgot-password "
               f"and contact support.\n\n— UrbanPuls")
