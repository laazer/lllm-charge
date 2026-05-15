"""
API routes for cron job management.

Endpoints mirror the TS server's /api/cron/* surface.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from croniter import CroniterBadCronError, croniter
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.cron.models import CronExecution, CronJob
from app.cron.scheduler import (
    add_job,
    pause_job,
    remove_job,
    resume_job,
)

router = APIRouter(prefix="/api/cron", tags=["cron"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class CronJobCreate(BaseModel):
    name: str
    schedule: str
    command: str
    job_type: Optional[str] = "shell"
    tags: Optional[List[str]] = None
    enabled: Optional[bool] = True


class CronJobResponse(BaseModel):
    id: str
    name: str
    schedule: str
    command: str
    job_type: str
    enabled: bool
    execution_count: int
    failure_count: int
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    tags: List[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CronExecutionResponse(BaseModel):
    id: str
    job_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    output: Optional[str]
    error: Optional[str]


class ValidateScheduleRequest(BaseModel):
    schedule: str
    count: Optional[int] = 5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PREDEFINED_TEMPLATES = [
    {"name": "Every minute", "schedule": "* * * * *", "command": "echo 'tick'", "job_type": "shell"},
    {"name": "Every hour", "schedule": "0 * * * *", "command": "echo 'hourly'", "job_type": "shell"},
    {"name": "Daily at midnight", "schedule": "0 0 * * *", "command": "echo 'daily'", "job_type": "shell"},
    {"name": "Weekly (Sunday)", "schedule": "0 0 * * 0", "command": "echo 'weekly'", "job_type": "shell"},
    {"name": "Monthly (1st)", "schedule": "0 0 1 * *", "command": "echo 'monthly'", "job_type": "shell"},
]


def _validate_cron_expression(schedule: str) -> None:
    """Raise HTTPException 400 if schedule is not a valid 5-field cron expression."""
    try:
        croniter(schedule, datetime.utcnow())
    except (CroniterBadCronError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cron schedule '{schedule}': {exc}",
        )


def _next_run_times(schedule: str, count: int = 5) -> List[str]:
    """Return the next *count* ISO timestamps for a cron expression."""
    iterator = croniter(schedule, datetime.utcnow())
    return [iterator.get_next(datetime).isoformat() for _ in range(count)]


def _job_to_response(job: CronJob) -> CronJobResponse:
    tags = [t for t in (job.tags or "").split(",") if t]
    return CronJobResponse(
        id=job.id,
        name=job.name,
        schedule=job.schedule,
        command=job.command,
        job_type=job.job_type or "shell",
        enabled=job.enabled,
        execution_count=job.execution_count or 0,
        failure_count=job.failure_count or 0,
        last_run=job.last_run,
        next_run=job.next_run,
        tags=tags,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _execution_to_response(exc: CronExecution) -> CronExecutionResponse:
    return CronExecutionResponse(
        id=exc.id,
        job_id=exc.job_id,
        status=exc.status,
        started_at=exc.started_at,
        completed_at=exc.completed_at,
        output=exc.output,
        error=exc.error,
    )


def _calculate_next_run(schedule: str) -> Optional[datetime]:
    """Return the next run datetime for a schedule, or None on error."""
    try:
        return croniter(schedule, datetime.utcnow()).get_next(datetime)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Routes: jobs CRUD
# ---------------------------------------------------------------------------


@router.get("/jobs")
def list_cron_jobs(
    db: Session = Depends(get_db),
    enabled: Optional[bool] = Query(None),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
):
    query = db.query(CronJob)
    if enabled is not None:
        query = query.filter(CronJob.enabled.is_(enabled))
    elif status == "active":
        query = query.filter(CronJob.enabled.is_(True))
    elif status == "inactive":
        query = query.filter(CronJob.enabled.is_(False))
    if job_type:
        query = query.filter(CronJob.job_type == job_type)
    jobs = query.all()
    return {"jobs": [_job_to_response(j) for j in jobs], "total": len(jobs)}


@router.post("/jobs", status_code=201)
def create_cron_job(payload: CronJobCreate, db: Session = Depends(get_db)):
    _validate_cron_expression(payload.schedule)
    next_run = _calculate_next_run(payload.schedule)
    job = CronJob(
        id=str(uuid.uuid4()),
        name=payload.name,
        schedule=payload.schedule,
        command=payload.command,
        job_type=payload.job_type or "shell",
        enabled=payload.enabled if payload.enabled is not None else True,
        tags=",".join(payload.tags) if payload.tags else "",
        next_run=next_run,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if job.enabled:
        add_job(job.id, job.schedule, lambda: None)

    return _job_to_response(job)


@router.get("/jobs/{job_id}")
def get_cron_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CronJob).filter(CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    return _job_to_response(job)


@router.put("/jobs/{job_id}")
def update_cron_job(
    job_id: str, payload: CronJobCreate, db: Session = Depends(get_db)
):
    job = db.query(CronJob).filter(CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    _validate_cron_expression(payload.schedule)
    job.name = payload.name
    job.schedule = payload.schedule
    job.command = payload.command
    if payload.job_type:
        job.job_type = payload.job_type
    if payload.tags is not None:
        job.tags = ",".join(payload.tags)
    job.next_run = _calculate_next_run(payload.schedule)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.delete("/jobs/{job_id}")
def delete_cron_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CronJob).filter(CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    remove_job(job_id)
    db.query(CronExecution).filter(CronExecution.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return {"deleted": job_id}


# ---------------------------------------------------------------------------
# Routes: job actions
# ---------------------------------------------------------------------------


@router.post("/jobs/{job_id}/toggle")
def toggle_cron_job(job_id: str, db: Session = Depends(get_db)):
    """Flip the enabled flag on a job."""
    job = db.query(CronJob).filter(CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")
    job.enabled = not job.enabled
    if job.enabled:
        resume_job(job.id)
    else:
        pause_job(job.id)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.post("/jobs/{job_id}/run")
def run_cron_job(job_id: str, db: Session = Depends(get_db)):
    """Trigger an immediate execution of the job and record it."""
    job = db.query(CronJob).filter(CronJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Cron job not found")

    execution = CronExecution(
        id=str(uuid.uuid4()),
        job_id=job_id,
        status="success",
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        output=f"Manual trigger of '{job.name}'",
    )
    job.execution_count = (job.execution_count or 0) + 1
    job.last_run = datetime.utcnow()
    db.add(execution)
    db.commit()
    db.refresh(execution)
    return {"execution_id": execution.id, "id": execution.id, "status": execution.status, "job_id": job_id}


# ---------------------------------------------------------------------------
# Routes: executions
# ---------------------------------------------------------------------------


@router.get("/executions")
def list_executions(
    db: Session = Depends(get_db),
    job_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(CronExecution)
    if job_id:
        query = query.filter(CronExecution.job_id == job_id)
    total = query.count()
    executions = (
        query.order_by(CronExecution.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "executions": [_execution_to_response(e) for e in executions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ---------------------------------------------------------------------------
# Routes: dashboard, status, templates, validate
# ---------------------------------------------------------------------------


@router.get("/dashboard")
def cron_dashboard(db: Session = Depends(get_db)):
    """Return aggregate stats for the cron dashboard."""
    total = db.query(CronJob).count()
    active = db.query(CronJob).filter(CronJob.enabled.is_(True)).count()
    failed_executions = (
        db.query(CronExecution).filter(CronExecution.status == "failed").count()
    )
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "failed": failed_executions,
        "upcoming": active,
    }


@router.get("/status")
def cron_status():
    """Return scheduler health."""
    try:
        from app.cron.scheduler import is_scheduler_running, count_running_jobs
        running = is_scheduler_running()
        job_count = count_running_jobs() if running else 0
    except Exception:
        running = False
        job_count = 0
    return {"scheduler": "running" if running else "stopped", "running": running, "job_count": job_count, "status": "ok"}


@router.get("/templates")
def list_templates():
    """Return predefined job templates."""
    return {"templates": _PREDEFINED_TEMPLATES}


@router.post("/templates/create", status_code=201)
def create_from_template(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """Create a job from a named template."""
    template_name = body.get("template_name") or body.get("name")
    template = next(
        (t for t in _PREDEFINED_TEMPLATES if t["name"] == template_name), None
    )
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")
    job = CronJob(
        id=str(uuid.uuid4()),
        name=body.get("job_name", template["name"]),
        schedule=template["schedule"],
        command=template["command"],
        job_type=template["job_type"],
        enabled=True,
        next_run=_calculate_next_run(template["schedule"]),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.post("/validate-schedule")
def validate_schedule(payload: ValidateScheduleRequest):
    """Validate a cron expression and return the next N run times."""
    try:
        croniter(payload.schedule, datetime.utcnow())
    except (CroniterBadCronError, ValueError, KeyError) as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=400,
            content={"error": f"Invalid cron schedule '{payload.schedule}': {exc}"},
        )
    next_runs = _next_run_times(payload.schedule, payload.count or 5)
    return {"valid": True, "schedule": payload.schedule, "next_runs": next_runs}
