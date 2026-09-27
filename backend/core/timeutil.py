"""All datetimes are timezone-aware UTC inside the app and stored as UTC in the database."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy.types import TypeDecorator, DateTime
from core.config import settings

LOCAL_TZ = ZoneInfo(settings.TIMEZONE)

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def to_utc(dt: datetime) -> datetime:
    """Naive values are assumed to already be UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_local(dt: datetime) -> datetime:
    return to_utc(dt).astimezone(LOCAL_TZ)

def fmt_local(dt: datetime | None) -> str:
    return to_local(dt).strftime("%d %b %Y, %I:%M %p") if dt else "N/A"

class UTCDateTime(TypeDecorator):
    """Stores UTC without tz info (works the same on SQLite and PostgreSQL), returns aware UTC."""
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return to_utc(value).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)
