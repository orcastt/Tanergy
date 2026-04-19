from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tanvas:tanvas_dev@localhost:5432/tanvas_db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET_NAME: str = "tanvas-assets"
    MINIO_USE_SSL: bool = False

    # AI API Keys
    ANTHROPIC_API_KEY: str = ""
    MIDJOURNEY_API_KEY: str = ""
    MIDJOURNEY_API_URL: str = "https://api.midjourney.com/v1"
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_LOCATION: str = "us-central1"

    # Search
    TAVILY_API_KEY: str = ""

    # Auth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # Email
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "noreply@tanvas.app"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Execution limits (seconds per week)
    FREE_PLAN_WEEKLY_SECONDS: int = 1800
    STARTER_PLAN_WEEKLY_SECONDS: int = 18000
    PRO_PLAN_WEEKLY_SECONDS: int = 72000
    TEAM_PLAN_WEEKLY_SECONDS: int = 288000

    # File upload
    MAX_IMAGE_SIZE_MB: int = 20
    MAX_VIDEO_SIZE_MB: int = 500
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
