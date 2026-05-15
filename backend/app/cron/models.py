"""SQLAlchemy models for cron jobs and execution history."""
from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.database.models.base import BaseModel


class CronJob(BaseModel):
    """Persistent definition of a scheduled job."""

    __tablename__ = "cron_jobs"

    name = Column(String, nullable=False)
    schedule = Column(String, nullable=False)
    command = Column(Text, nullable=False)
    job_type = Column(String, default="shell")
    enabled = Column(Boolean, default=True, nullable=False)
    execution_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    tags = Column(Text, default="")  # comma-separated


class CronExecution(BaseModel):
    """Record of a single job execution."""

    __tablename__ = "cron_executions"

    job_id = Column(String, nullable=False, index=True)
    status = Column(String, default="running")  # running | success | failed
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
