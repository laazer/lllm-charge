"""
Configuration management for LLM-Charge FastAPI backend
"""
from typing import List

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings  # type: ignore[no-redef,assignment]


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Database configuration
    database_url: str = "sqlite:///./data/llm-charge.db"

    # CORS configuration — defaults used when env file is missing or invalid
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # Application configuration
    debug: bool = False
    app_name: str = "LLM-Charge Backend"
    app_version: str = "2.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_ignore_empty = True


def _load_settings() -> Settings:
    """Load settings, falling back to defaults if .env is malformed."""
    try:
        return Settings()
    except Exception:
        # .env file may contain values that can't be parsed (e.g. cors_origins
        # in an incompatible format).  Load with defaults only.
        return Settings(_env_file=None)  # type: ignore[call-arg]


# Global settings instance
settings = _load_settings()
