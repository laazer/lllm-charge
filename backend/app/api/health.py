"""
Health check endpoints for the API
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db, database_health_check
from pydantic import BaseModel
import asyncio

health_router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    database: bool
    version: str
    uptime: float


@health_router.get("/", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint"""
    db_healthy = await database_health_check()
    
    return HealthResponse(
        status="healthy" if db_healthy else "unhealthy",
        database=db_healthy,
        version="2.0.0",
        uptime=0.0  # TODO: Implement uptime tracking
    )


@health_router.get("/ready")
async def readiness_check():
    """Readiness probe for Kubernetes/Docker"""
    db_healthy = await database_health_check()
    
    if not db_healthy:
        raise HTTPException(status_code=503, detail="Database not ready")
    
    return {"status": "ready"}


@health_router.get("/live")
async def liveness_check():
    """Liveness probe for Kubernetes/Docker"""
    return {"status": "alive"}