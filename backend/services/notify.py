"""Creates in-app notifications in the user's language, pushes them live and optionally emails them."""
from sqlalchemy.orm import Session

from core.config import settings
from models.activity import Notification
from models.user import User
from services.live import queue_event, queue_email
from services.messages import EMAIL_GREETING, lang_of, render

def notification_out(n: Notification) -> dict:
    return {"id": n.id, "type": n.type, "title": n.title, "message": n.message,
            "link": n.link, "is_read": n.is_read, "created_at": n.created_at}

def notify(db: Session, user: User | None, type_: str, message_key: str,
           link: str | None = None, email: bool = False, **params) -> None:
    """
    Call before db.commit(); nothing is sent if the transaction rolls back.
    A param may be a function of the language code, for values that need translating themselves.
    """
    if user is None:
        return
    lang = lang_of(user)
    values = {k: (v(lang) if callable(v) else v) for k, v in params.items()}
    title, message = render(message_key, lang, **values)

    n = Notification(user_id=user.id, type=type_, title=title, message=message, link=link)
    db.add(n)
    db.flush()   # assigns id and created_at
    queue_event(db, f"user:{user.id}", {"type": "notification", "notification": notification_out(n)})
    if email:
        url = f"{settings.FRONTEND_URL}{link}" if link else settings.FRONTEND_URL
        greeting = EMAIL_GREETING[lang].format(name=user.name)
        queue_email(db, user.email, title, f"{greeting}\n\n{message}\n\n{url}\n\n— UrbanPuls")

def notify_role(db: Session, roles: list, type_: str, message_key: str, link: str | None = None, **params) -> None:
    for user in db.query(User).filter(User.role.in_(roles), User.is_active.is_(True)).all():
        notify(db, user, type_, message_key, link, **params)
