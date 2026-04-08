"""
Configuration management for LLM-Charge FastAPI backend
"""
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database configuration
    database_url: str = "sqlite:///./data/llm-charge.db"

    # CORS configuration
    cors_origins: List[str] = [
        "http://localhost:3000",  # React frontend
        "http://localhost:3001",  # Legacy frontend
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # Application configuration
    debug: bool = False
    app_name: str = "LLM-Charge Backend"
    app_version: str = "2.0.0"


# Global settings instance
settings = Settings()
