from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/tpms_db"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    CLOUDINARY_CLOUD_NAME: str = "your_cloud_name"
    CLOUDINARY_API_KEY: str = "your_api_key"
    CLOUDINARY_API_SECRET: str = "your_api_secret"

    TWILIO_ACCOUNT_SID: str = "your_twilio_sid"
    TWILIO_AUTH_TOKEN: str = "your_twilio_token"
    TWILIO_PHONE_NUMBER: str = "+1234567890"
    POLICE_PHONE_NUMBER: str = "+0987654321"

    RAZORPAY_KEY_ID: str = "your_razorpay_key_id"
    RAZORPAY_KEY_SECRET: str = "your_razorpay_secret"

    class Config:
        env_file = ".env"

settings = Settings()
