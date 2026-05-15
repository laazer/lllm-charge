"""APScheduler-based job runner for cron jobs.

Provides a thin wrapper around APScheduler's AsyncIOScheduler that
manages per-job entries keyed by CronJob.id.
"""
from __future__ import annotations

import logging
import subprocess
from datetime import datetime
from typing import Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    """Return the singleton AsyncIOScheduler, creating it if needed."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start_scheduler() -> None:
    """Start the scheduler (called during app startup)."""
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        logger.info("Cron scheduler started")


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Cron scheduler stopped")
    _scheduler = None


def add_job(job_id: str, schedule: str, callback: Callable) -> None:
    """Register a job with the scheduler using its cron schedule."""
    scheduler = get_scheduler()
    trigger = CronTrigger.from_crontab(schedule)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    scheduler.add_job(callback, trigger=trigger, id=job_id, replace_existing=True)


def remove_job(job_id: str) -> None:
    """Remove a job from the scheduler if it exists."""
    scheduler = get_scheduler()
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def pause_job(job_id: str) -> None:
    """Pause a scheduled job."""
    scheduler = get_scheduler()
    job = scheduler.get_job(job_id)
    if job:
        job.pause()


def resume_job(job_id: str) -> None:
    """Resume a paused scheduled job."""
    scheduler = get_scheduler()
    job = scheduler.get_job(job_id)
    if job:
        job.resume()


def is_scheduler_running() -> bool:
    """Return True when the scheduler is active."""
    return _scheduler is not None and _scheduler.running


def count_running_jobs() -> int:
    """Return number of currently scheduled (non-paused) jobs."""
    scheduler = get_scheduler()
    return len(scheduler.get_jobs())
