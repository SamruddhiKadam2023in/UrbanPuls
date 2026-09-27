from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
INSECURE_SECRET_KEYS = {
    "change-this-to-a-random-secret-key-in-production",
    "your-super-secret-key-change-in-production",
}

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"          # development | production | test
    TIMEZONE: str = "Asia/Kolkata"            # used for receipts and hourly traffic stats
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ── Database / cache ─────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./tpms.db"
    RATE_LIMIT_STORAGE_URI: str = "memory://"  # use redis://redis:6379 in production

    # ── Auth ─────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    VERIFY_TOKEN_EXPIRE_HOURS: int = 48

    # ── Email (leave SMTP_HOST empty to print emails to the console) ─────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "TPMS <no-reply@tpms.local>"
    SMTP_USE_TLS: bool = True

    # ── Booking rules ────────────────────────────────────────────────────────
    BOOKING_GRACE_MINUTES: int = 15        # no-show if not checked in this long after start
    EARLY_CHECKIN_MINUTES: int = 30        # how early a reserved car may enter
    MAX_ACTIVE_RESERVATIONS: int = 2
    NO_SHOW_LIMIT: int = 3                 # no-shows within the window that block booking
    NO_SHOW_WINDOW_DAYS: int = 30
    MAX_BOOKING_HOURS: int = 24
    MAX_ADVANCE_DAYS: int = 7
    BILLING_INCREMENT_MINUTES: int = 30
    MIN_BILLED_MINUTES: int = 60
    POINT_VALUE_RUPEES: float = 0.5
    COMPLAINT_REWARD_POINTS: int = 10
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_SECONDS: int = 60

    # ── Files ────────────────────────────────────────────────────────────────
    DATA_DIR: str = str(BASE_DIR)
    MAX_UPLOAD_MB: int = 10

    # ── Integrations (optional) ──────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    POLICE_PHONE_NUMBER: str = ""

    # Mock YOLO detections are only ever allowed outside production
    YOLO_ALLOW_MOCK: bool = True

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def yolo_mock_allowed(self) -> bool:
        return self.YOLO_ALLOW_MOCK and not self.is_production

    @property
    def receipts_dir(self) -> Path:
        return Path(self.DATA_DIR) / "receipts"

    @property
    def fines_dir(self) -> Path:
        return Path(self.DATA_DIR) / "fines"

    @property
    def uploads_dir(self) -> Path:
        return Path(self.DATA_DIR) / "uploads"

    @property
    def cloudinary_enabled(self) -> bool:
        return bool(self.CLOUDINARY_CLOUD_NAME and self.CLOUDINARY_API_KEY and self.CLOUDINARY_API_SECRET)

    @property
    def twilio_enabled(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN and self.TWILIO_PHONE_NUMBER and self.POLICE_PHONE_NUMBER)

    @model_validator(mode="after")
    def _check_production(self):
        if self.is_production:
            if self.SECRET_KEY in INSECURE_SECRET_KEYS or len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be a random value of at least 32 characters in production")
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("Use PostgreSQL (DATABASE_URL=postgresql://...) in production")
        return self

settings = Settings()
