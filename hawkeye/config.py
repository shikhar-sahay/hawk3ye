"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Hawk3ye"
    app_version: str = "2.0.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    # API Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 1

    # Database
    database_url: str = "sqlite+aiosqlite:///./hawkeye.db"
    database_echo: bool = False

    # Security
    api_key_secret: str = Field(
        default="change-me-in-production-min-32-chars",
        min_length=32,
    )
    jwt_secret: str = Field(
        default="change-me-in-production-min-32-chars",
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Detection Thresholds
    brute_force_max_attempts: int = 5
    brute_force_window_minutes: int = 15
    cred_stuffing_max_usernames: int = 10
    cred_stuffing_window_minutes: int = 10
    enumeration_404_threshold: int = 20
    enumeration_window_minutes: int = 5
    session_hijack_max_distance_km: int = 500
    session_hijack_window_hours: int = 1
    api_abuse_rpm_threshold: int = 60
    bot_detection_confidence_threshold: float = 0.7

    # Detection (per-detector time windows)
    detection_time_window_minutes: int = 60
    brute_force_window_minutes: int = 15
    cred_stuffing_window_minutes: int = 10
    enumeration_window_minutes: int = 5
    session_hijack_window_hours: int = 1

    # Correlation
    correlation_time_window_hours: int = 24
    correlation_min_alerts: int = 2
    incident_auto_close_hours: int = 72

    # Frontend
    frontend_ws_heartbeat_seconds: int = 30

    # API Key header
    api_key_header: str = "X-API-Key"

    # CORS (Vite dev server default; in dev the frontend also proxies /api
    # and /ws through the same origin, so CORS rarely applies)
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    # API
    api_key_length: int = 32


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
