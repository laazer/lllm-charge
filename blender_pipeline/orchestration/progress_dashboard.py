"""Progress dashboard — terminal and HTTP-based job monitoring."""

from __future__ import annotations

import json
import logging
import time
import threading
from dataclasses import dataclass, field
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Job:
    """A tracked generation/render job."""

    id: str
    name: str
    status: str = "pending"  # pending, running, completed, failed, cancelled
    progress: float = 0.0
    total_steps: int = 1
    current_step: int = 0
    start_time: float = 0.0
    end_time: float = 0.0
    error_message: str = ""
    output_files: list[str] = field(default_factory=list)
    current_message: str = ""

    @property
    def duration_seconds(self) -> float:
        end = self.end_time if self.end_time > 0 else time.time()
        return end - self.start_time if self.start_time > 0 else 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "progress": self.progress,
            "total_steps": self.total_steps,
            "current_step": self.current_step,
            "duration_seconds": round(self.duration_seconds, 1),
            "error_message": self.error_message,
            "output_files": self.output_files,
            "current_message": self.current_message,
        }


class JobManager:
    """Manages the lifecycle of generation/render jobs."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._next_id = 1

    def create_job(self, name: str, total_steps: int = 1) -> str:
        """Create a new job and return its ID."""
        job_id = f"job_{self._next_id}"
        self._next_id += 1
        self._jobs[job_id] = Job(
            id=job_id,
            name=name,
            total_steps=total_steps,
            start_time=time.time(),
            status="running",
        )
        logger.info("Created job %s: %s", job_id, name)
        return job_id

    def update_progress(self, job_id: str, step: int, message: str = "") -> None:
        """Update a job's progress."""
        job = self._jobs.get(job_id)
        if not job:
            return
        job.current_step = step
        job.progress = step / job.total_steps if job.total_steps > 0 else 0.0
        job.current_message = message

    def complete_job(self, job_id: str, output_files: list[str] | None = None) -> None:
        """Mark a job as completed."""
        job = self._jobs.get(job_id)
        if not job:
            return
        job.status = "completed"
        job.progress = 1.0
        job.current_step = job.total_steps
        job.end_time = time.time()
        job.output_files = output_files or []
        logger.info("Job %s completed (%.1fs)", job_id, job.duration_seconds)

    def fail_job(self, job_id: str, error: str) -> None:
        """Mark a job as failed."""
        job = self._jobs.get(job_id)
        if not job:
            return
        job.status = "failed"
        job.end_time = time.time()
        job.error_message = error
        logger.error("Job %s failed: %s", job_id, error)

    def cancel_job(self, job_id: str) -> None:
        """Cancel a running job."""
        job = self._jobs.get(job_id)
        if not job:
            return
        job.status = "cancelled"
        job.end_time = time.time()

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def get_all_jobs(self) -> list[Job]:
        return list(self._jobs.values())

    def get_active_jobs(self) -> list[Job]:
        return [j for j in self._jobs.values() if j.status in ("pending", "running")]

    def get_statistics(self) -> dict:
        """Get aggregate job statistics."""
        jobs = list(self._jobs.values())
        completed = [j for j in jobs if j.status == "completed"]
        avg_time = (
            sum(j.duration_seconds for j in completed) / len(completed)
            if completed else 0.0
        )
        return {
            "total": len(jobs),
            "pending": sum(1 for j in jobs if j.status == "pending"),
            "running": sum(1 for j in jobs if j.status == "running"),
            "completed": len(completed),
            "failed": sum(1 for j in jobs if j.status == "failed"),
            "cancelled": sum(1 for j in jobs if j.status == "cancelled"),
            "average_duration_seconds": round(avg_time, 1),
        }


class TerminalDashboard:
    """Terminal-based dashboard for displaying job progress."""

    PROGRESS_BAR_WIDTH = 30

    def display(self, job_manager: JobManager) -> str:
        """Render a formatted table of all jobs."""
        jobs = job_manager.get_all_jobs()
        if not jobs:
            return "No jobs."

        header = f"{'ID':<10} {'Name':<25} {'Status':<12} {'Progress':<35} {'Duration':<10}"
        separator = "-" * len(header)
        lines = [header, separator]

        for job in jobs:
            progress_bar = self.format_progress_bar(job.progress)
            duration = self.format_duration(job.duration_seconds)
            status_display = self._colorize_status(job.status)
            lines.append(f"{job.id:<10} {job.name:<25} {status_display:<12} {progress_bar} {duration:<10}")
            if job.current_message:
                lines.append(f"{'':>10} {job.current_message}")
            if job.error_message:
                lines.append(f"{'':>10} ERROR: {job.error_message}")

        stats = job_manager.get_statistics()
        lines.append(separator)
        lines.append(
            f"Total: {stats['total']} | Running: {stats['running']} | "
            f"Completed: {stats['completed']} | Failed: {stats['failed']}"
        )
        return "\n".join(lines)

    def display_job_detail(self, job: Job) -> str:
        """Detailed view of a single job."""
        lines = [
            f"Job: {job.name} ({job.id})",
            f"Status: {job.status}",
            f"Progress: {self.format_progress_bar(job.progress)} ({job.progress:.0%})",
            f"Step: {job.current_step}/{job.total_steps}",
            f"Duration: {self.format_duration(job.duration_seconds)}",
        ]
        if job.current_message:
            lines.append(f"Current: {job.current_message}")
        if job.error_message:
            lines.append(f"Error: {job.error_message}")
        if job.output_files:
            lines.append("Outputs:")
            for filepath in job.output_files:
                lines.append(f"  - {filepath}")
        return "\n".join(lines)

    @classmethod
    def format_progress_bar(cls, progress: float, width: int | None = None) -> str:
        """Render a text progress bar."""
        bar_width = width or cls.PROGRESS_BAR_WIDTH
        filled = int(bar_width * min(progress, 1.0))
        empty = bar_width - filled
        percentage = f"{progress:.0%}"
        return f"[{'█' * filled}{'░' * empty}] {percentage:>4}"

    @staticmethod
    def format_duration(seconds: float) -> str:
        """Format seconds into human-readable duration."""
        if seconds < 60:
            return f"{seconds:.1f}s"
        minutes = int(seconds // 60)
        remaining_seconds = seconds % 60
        if minutes < 60:
            return f"{minutes}m {remaining_seconds:.0f}s"
        hours = minutes // 60
        remaining_minutes = minutes % 60
        return f"{hours}h {remaining_minutes}m"

    @staticmethod
    def _colorize_status(status: str) -> str:
        """Return status with ANSI color codes for terminal display."""
        color_map = {
            "pending": "\033[33mpending\033[0m",
            "running": "\033[34mrunning\033[0m",
            "completed": "\033[32mcompleted\033[0m",
            "failed": "\033[31mfailed\033[0m",
            "cancelled": "\033[90mcancelled\033[0m",
        }
        return color_map.get(status, status)


class DashboardServer:
    """Lightweight HTTP server exposing job status as JSON API."""

    def __init__(self, job_manager: JobManager) -> None:
        self.job_manager = job_manager
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self, port: int = 8090) -> None:
        """Start the HTTP dashboard server in a background thread."""
        manager = self.job_manager

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                if self.path == "/jobs":
                    data = [j.to_dict() for j in manager.get_all_jobs()]
                elif self.path.startswith("/jobs/"):
                    job_id = self.path.split("/")[-1]
                    job = manager.get_job(job_id)
                    data = job.to_dict() if job else {"error": "not found"}
                elif self.path == "/stats":
                    data = manager.get_statistics()
                elif self.path == "/":
                    self._serve_html()
                    return
                else:
                    self.send_response(404)
                    self.end_headers()
                    return

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(data, indent=2).encode())

            def _serve_html(self) -> None:
                html = """<!DOCTYPE html><html><head><title>Pipeline Dashboard</title>
                <style>body{font-family:monospace;background:#1a1a2e;color:#e0e0e0;padding:20px}
                table{border-collapse:collapse;width:100%}th,td{padding:8px;text-align:left;border:1px solid #333}
                th{background:#16213e}.running{color:#4fc3f7}.completed{color:#81c784}.failed{color:#e57373}
                .progress{background:#333;border-radius:4px;overflow:hidden;height:20px}
                .progress-fill{background:#4fc3f7;height:100%;transition:width 0.3s}</style>
                </head><body><h1>Pipeline Dashboard</h1><div id="jobs"></div>
                <script>async function refresh(){const r=await fetch('/jobs');const jobs=await r.json();
                let html='<table><tr><th>ID</th><th>Name</th><th>Status</th><th>Progress</th><th>Duration</th></tr>';
                jobs.forEach(j=>{const pct=Math.round(j.progress*100);
                html+=`<tr><td>${j.id}</td><td>${j.name}</td><td class="${j.status}">${j.status}</td>
                <td><div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>${pct}%</td>
                <td>${j.duration_seconds}s</td></tr>`;});
                html+='</table>';document.getElementById('jobs').innerHTML=html;}
                refresh();setInterval(refresh,2000);</script></body></html>"""
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(html.encode())

            def log_message(self, format: str, *args: Any) -> None:  # type: ignore[override]
                pass

        self._server = HTTPServer(("0.0.0.0", port), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        logger.info("Dashboard server started on port %d", port)

    def stop(self) -> None:
        """Stop the HTTP server."""
        if self._server:
            self._server.shutdown()
            self._server = None
            self._thread = None
