"""
Health check endpoints for the API
"""
import time
from typing import Optional
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


class SetupDefaultsRequest(BaseModel):
    projectId: Optional[str] = None
    loadAgents: Optional[bool] = True
    loadSkills: Optional[bool] = True
    loadSpecs: Optional[bool] = True
    overwriteExisting: Optional[bool] = False


def _create_default_agents(db: Session, overwrite: bool = False) -> int:
    """Create default agents in the database."""
    from app.database.models.agents import Agent, AgentStatus
    import uuid

    default_agents = [
        {
            "name": "Code Analyzer",
            "description": "Analyzes code for patterns, issues, and optimization opportunities",
            "primary_role": "analyst"
        },
        {
            "name": "Documentation Assistant",
            "description": "Helps create, maintain, and improve project documentation",
            "primary_role": "documentation"
        },
        {
            "name": "Refactoring Specialist",
            "description": "Suggests and implements code refactoring improvements",
            "primary_role": "architect"
        },
        {
            "name": "Testing Coordinator",
            "description": "Manages test creation, execution, and coverage analysis",
            "primary_role": "qa"
        }
    ]

    created = 0
    for agent_data in default_agents:
        existing = db.query(Agent).filter(Agent.name == agent_data["name"]).first()
        if existing and not overwrite:
            continue

        if existing and overwrite:
            db.delete(existing)

        agent = Agent(
            id=str(uuid.uuid4()),
            name=agent_data["name"],
            description=agent_data["description"],
            primary_role=agent_data["primary_role"],
            status=AgentStatus.ACTIVE.value,
            capabilities={},
            config={}
        )
        db.add(agent)
        created += 1

    db.commit()
    return created


def _create_default_skills(db: Session, overwrite: bool = False) -> int:
    """Create default skills in the database."""
    from app.database.models.skills import Skill
    import uuid

    default_skills = [
        {
            "title": "Code Analysis",
            "description": "Analyze code for issues, patterns, and optimization opportunities",
            "category": "analysis",
            "tags": ["skill", "analysis", "code"]
        },
        {
            "title": "Documentation Generator",
            "description": "Generate and maintain project documentation automatically",
            "category": "documentation",
            "tags": ["skill", "documentation", "automation"]
        },
        {
            "title": "Test Writer",
            "description": "Create comprehensive test suites and improve test coverage",
            "category": "automation",
            "tags": ["skill", "testing", "automation"]
        },
        {
            "title": "Code Refactorer",
            "description": "Refactor code for better readability, performance, and maintainability",
            "category": "optimization",
            "tags": ["skill", "refactoring", "code"]
        },
        {
            "title": "Security Auditor",
            "description": "Audit code for security vulnerabilities and best practices",
            "category": "analysis",
            "tags": ["skill", "security", "analysis"]
        },
        {
            "title": "Performance Optimizer",
            "description": "Identify and optimize performance bottlenecks",
            "category": "optimization",
            "tags": ["skill", "performance", "optimization"]
        }
    ]

    created = 0
    for skill_data in default_skills:
        existing = db.query(Skill).filter(Skill.title == skill_data["title"]).first()
        if existing and not overwrite:
            continue

        if existing and overwrite:
            db.delete(existing)

        skill = Skill(
            id=str(uuid.uuid4()),
            title=skill_data["title"],
            description=skill_data["description"],
            category=skill_data["category"],
            tags=skill_data["tags"],
            project_id=None,  # Global skills
            status="active"
        )
        db.add(skill)
        created += 1

    db.commit()
    return created


@api_router.post("/api/setup/defaults")
def setup_defaults(request: SetupDefaultsRequest, db: Session = Depends(get_db)):
    """Load default agents, skills, and specs from the backend defaults."""
    loaded = []
    created = 0

    if request.loadAgents:
        agents_created = _create_default_agents(db, request.overwriteExisting or False)
        created += agents_created
        if agents_created > 0:
            loaded.append("default_agents")

    if request.loadSkills:
        skills_created = _create_default_skills(db, request.overwriteExisting or False)
        created += skills_created
        if skills_created > 0:
            loaded.append("default_skills")

    if request.loadSpecs:
        # Specs loading - placeholder for now
        loaded.append("default_specs")

    return {
        "success": True,
        "message": f"Loaded {len(loaded)} default items: {', '.join(loaded) if loaded else 'none'}. Created {created} items.",
        "baseUrl": "http://localhost:7891",
        "projectId": request.projectId or "default",
        "loaded": loaded,
        "created": created
    }
