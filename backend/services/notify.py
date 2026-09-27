"""Creates in-app notifications, pushes them live and optionally emails them."""
from sqlalchemy.orm import Session

from core.config import settings
from models.activity import Notification
from models.user import User
from services.live import queue_event, queue_email

def notification_out(n: Notification) -> dict:
    return {"id": n.id, "type": n.type, "title": n.title, "message": n.message,
            "link": n.link, "is_read": n.is_read, "created_at": n.created_at}

def notify(db: Session, user: User | None, type_: str, title: str, message: str,
           link: str | None = None, email: bool = False) -> None:
    """Call before db.commit(); nothing is sent if the transaction rolls back."""
    if user is None:
        return
    n = Notification(user_id=user.id, type=type_, title=title, message=message, link=link)
    db.add(n)
    db.flush()   # assigns id and created_at
    queue_event(db, f"user:{user.id}", {"type": "notification", "notification": notification_out(n)})
    if email:
        url = f"{settings.FRONTEND_URL}{link}" if link else settings.FRONTEND_URL
        queue_email(db, user.email, title, f"Hi {user.name},\n\n{message}\n\n{url}\n\n— TPMS")

def notify_role(db: Session, roles: list, type_: str, title: str, message: str, link: str | None = None) -> None:
    for user in db.query(User).filter(User.role.in_(roles), User.is_active.is_(True)).all():
        notify(db, user, type_, title, message, link)
