"""
Health check endpoints for the API
"""
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.database import get_db
from pydantic import BaseModel

health_router = APIRouter(prefix="/health", tags=["health"])

# Separate router for /api/health, /api/metrics (no prefix — registered at app level)
api_router = APIRouter(tags=["health"])

_SERVER_START_TIME = time.time()

# Simple in-memory counters updated by middleware
_counters: dict = {
    "request_count": 0,
    "error_count": 0,
}


def increment_request():
    _counters["request_count"] += 1


def increment_error():
    _counters["error_count"] += 1


class HealthResponse(BaseModel):
    status: str
    database: bool
    version: str


@health_router.get("/", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    """Basic health check endpoint."""
    try:
        db.execute(text("SELECT 1"))
        db_healthy = True
    except Exception:
        db_healthy = False

    return HealthResponse(
        status="healthy" if db_healthy else "unhealthy",
        database=db_healthy,
        version="2.0.0",
    )


@health_router.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database not ready")
    return {"status": "ready"}


@health_router.get("/live")
def liveness_check():
    return {"status": "alive"}


# ─── /api/health ───────────────────────────────────────────────────────────────

@api_router.get("/api/health")
def api_health_check(db: Session = Depends(get_db)):
    """Extended health check with uptime and DB status."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    uptime_seconds = time.time() - _SERVER_START_TIME
    return {
        "status": "healthy" if db_status == "ok" else "unhealthy",
        "version": "2.0.0",
        "uptime_seconds": round(uptime_seconds, 2),
        "database": db_status,
        "db_status": db_status,
    }


# ─── /api/metrics ──────────────────────────────────────────────────────────────

@api_router.get("/api/metrics")
def api_metrics():
    """Live server metrics."""
    request_count = _counters["request_count"]
    error_count = _counters["error_count"]
    error_rate = (error_count / request_count) if request_count > 0 else 0.0
    return {
        "request_count": request_count,
        "requests": request_count,
        "error_count": error_count,
        "error_rate": round(error_rate, 4),
        "uptime_seconds": round(time.time() - _SERVER_START_TIME, 2),
    }


# ─── /api/setup/* ──────────────────────────────────────────────────────────────

@api_router.get("/api/setup/status")
def setup_status():
    return {"completed": True, "steps": []}


@api_router.post("/api/setup/defaults")
def setup_defaults():
    return {"loaded": ["default_agents", "default_workflows", "default_skills"]}
