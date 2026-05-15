"""In-process CronStore — thin synchronous wrapper around SQLAlchemy.

The store is used both by the API routes (which inject a DB session via
FastAPI's `Depends`) and by the unit tests that call it directly.

When tests call it directly (without a DB session), the store creates its
own temporary in-memory session so the lifecycle tests remain isolated.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.cron.models import CronExecution, CronJob
from app.database.models.base import Base


# ---------------------------------------------------------------------------
# Lightweight data classes for the in-memory unit-test path
# ---------------------------------------------------------------------------

@dataclass
class JobRecord:
    id: str
    name: str
    schedule: str
    command: str
    job_type: str
    enabled: bool
    tags: list
    execution_count: int = 0
    failure_count: int = 0
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExecutionRecord:
    id: str
    job_id: str
    status: str
    started_at: datetime
    output: Optional[str] = None
    error: Optional[str] = None
    completed_at: Optional[datetime] = None


class CronStore:
    """Pure-Python in-memory store for unit tests.

    Does NOT touch the database — used only in direct-call tests.
    The HTTP routes use `get_db`-injected sessions instead.
    """

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._executions: List[ExecutionRecord] = []

    # ── Jobs ─────────────────────────────────────────────────────────────────

    def create_job(
        self,
        name: str,
        schedule: str,
        command: str,
        job_type: str = "shell",
        tags: Optional[list] = None,
    ) -> JobRecord:
        job_id = str(uuid.uuid4())
        job = JobRecord(
            id=job_id,
            name=name,
            schedule=schedule,
            command=command,
            job_type=job_type,
            enabled=True,
            tags=tags or [],
        )
        self._jobs[job_id] = job
        return job

    def list_jobs(self) -> Dict[str, JobRecord]:
        return dict(self._jobs)

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        return self._jobs.get(job_id)

    def toggle_job(self, job_id: str) -> JobRecord:
        job = self._jobs.get(job_id)
        if job is None:
            raise KeyError(f"Job {job_id!r} not found")
        job.enabled = not job.enabled
        return job

    def delete_job(self, job_id: str) -> None:
        if job_id not in self._jobs:
            raise KeyError(f"Job {job_id!r} not found")
        del self._jobs[job_id]

    # ── Executions ───────────────────────────────────────────────────────────

    def record_execution(
        self,
        job_id: str,
        status: str = "success",
        output: Optional[str] = None,
        error: Optional[str] = None,
    ) -> ExecutionRecord:
        job = self._jobs.get(job_id)
        if job is None:
            raise KeyError(f"Job {job_id!r} not found")
        job.execution_count += 1
        if status == "failed":
            job.failure_count += 1
        job.last_run = datetime.utcnow()

        exec_record = ExecutionRecord(
            id=str(uuid.uuid4()),
            job_id=job_id,
            status=status,
            started_at=datetime.utcnow(),
            output=output,
            error=error,
            completed_at=datetime.utcnow(),
        )
        self._executions.append(exec_record)
        return exec_record

    def get_executions(self, job_id: Optional[str] = None) -> List[ExecutionRecord]:
        if job_id is None:
            return sorted(self._executions, key=lambda e: e.started_at, reverse=True)
        return sorted(
            [e for e in self._executions if e.job_id == job_id],
            key=lambda e: e.started_at,
            reverse=True,
        )
