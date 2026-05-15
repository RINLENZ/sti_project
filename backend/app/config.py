from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    environment: str = "development"
    anthropic_api_key: str = ""
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"
    supabase_url: str = ""
    supabase_service_key: str = ""
    # Email / SMTP (optionnel — si vide, le lien reset est retourné directement)
    smtp_host:     str = ""
    smtp_port:     int = 587
    smtp_user:     str = ""
    smtp_password: str = ""
    smtp_from:     str = ""
    frontend_url:  str = "http://localhost:5173"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
