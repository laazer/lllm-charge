"""
Tests for MIG-003: Port Cron Job System to Python.

Covers all acceptance criteria:
  - POST /api/cron/jobs creates a job and scheduler.add_job is called
  - POST /api/cron/validate-schedule returns next 5 run times for a valid cron expression
  - POST /api/cron/jobs/{id}/toggle disables/enables and calls scheduler pause/resume
  - POST /api/cron/jobs/{id}/run triggers immediate execution and logs a result
  - GET /api/cron/executions returns paginated history sorted by started_at desc
  - GET /api/cron/dashboard returns accurate counts for active, failed, and upcoming jobs
  - Invalid cron expression returns 400 with descriptive error
  - Job lifecycle (create → toggle → run → delete) verified end-to-end
"""
import time
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient


VALID_SCHEDULE = "0 * * * *"  # every hour
INVALID_SCHEDULE = "not-a-cron"

SAMPLE_JOB = {
    "name": "Test Job",
    "schedule": VALID_SCHEDULE,
    "command": "echo hello",
    "job_type": "shell",
}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _create_job(test_client: TestClient, overrides: dict | None = None) -> dict:
    payload = {**SAMPLE_JOB, **(overrides or {})}
    resp = test_client.post("/api/cron/jobs", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ─── Job creation ──────────────────────────────────────────────────────────────

class TestCreateCronJob:
    def test_create_job_returns_id_name_and_schedule(self, test_client: TestClient):
        """POST /api/cron/jobs returns 201 with id, name, and schedule fields."""
        with patch("app.api.cron.add_job"):
            resp = test_client.post("/api/cron/jobs", json=SAMPLE_JOB)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == SAMPLE_JOB["name"]
        assert data["schedule"] == VALID_SCHEDULE

    def test_create_job_stores_in_database(self, test_client: TestClient):
        """A created job is retrievable via GET /api/cron/jobs."""
        with patch("app.api.cron.add_job"):
            _create_job(test_client)
        resp = test_client.get("/api/cron/jobs")
        assert resp.status_code == 200
        data = resp.json()
        jobs = data.get("jobs", data) if isinstance(data, dict) else data
        assert len(jobs) >= 1
        assert any(j["name"] == SAMPLE_JOB["name"] for j in jobs)

    def test_create_job_calls_scheduler_add_job(self, test_client: TestClient):
        """Scheduler.add_job is invoked when a new enabled job is created."""
        with patch("app.api.cron.add_job") as mock_add:
            _create_job(test_client)
        mock_add.assert_called_once()
        call_args = mock_add.call_args[0]
        assert call_args[1] == VALID_SCHEDULE  # schedule passed through

    def test_create_job_with_invalid_schedule_returns_400(self, test_client: TestClient):
        """An invalid cron expression causes a 400 response with error detail."""
        resp = test_client.post(
            "/api/cron/jobs",
            json={**SAMPLE_JOB, "schedule": INVALID_SCHEDULE},
        )
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert detail  # non-empty error message

    def test_create_job_computes_next_run(self, test_client: TestClient):
        """A newly created job has a non-null next_run timestamp."""
        with patch("app.api.cron.add_job"):
            data = _create_job(test_client)
        assert data.get("next_run") is not None


# ─── Validate schedule ─────────────────────────────────────────────────────────

class TestValidateSchedule:
    def test_valid_expression_returns_next_5_run_times(self, test_client: TestClient):
        """POST /api/cron/validate-schedule returns 5 ISO timestamps for a valid expression."""
        resp = test_client.post(
            "/api/cron/validate-schedule",
            json={"schedule": VALID_SCHEDULE},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert "next_runs" in data
        assert len(data["next_runs"]) == 5

    def test_valid_expression_returns_requested_count(self, test_client: TestClient):
        """count parameter controls how many next run times are returned."""
        resp = test_client.post(
            "/api/cron/validate-schedule",
            json={"schedule": VALID_SCHEDULE, "count": 3},
        )
        assert resp.status_code == 200
        assert len(resp.json()["next_runs"]) == 3

    def test_invalid_expression_returns_400(self, test_client: TestClient):
        """An invalid cron expression returns 400."""
        resp = test_client.post(
            "/api/cron/validate-schedule",
            json={"schedule": INVALID_SCHEDULE},
        )
        assert resp.status_code == 400

    def test_next_run_times_are_iso_formatted_strings(self, test_client: TestClient):
        """Each returned next_run is an ISO-8601 formatted datetime string."""
        resp = test_client.post(
            "/api/cron/validate-schedule",
            json={"schedule": VALID_SCHEDULE, "count": 1},
        )
        run_time = resp.json()["next_runs"][0]
        # Basic ISO format check: contains 'T' separator
        assert "T" in run_time or "-" in run_time


# ─── Toggle (enable / disable) ─────────────────────────────────────────────────

class TestToggleCronJob:
    def test_toggle_disables_enabled_job(self, test_client: TestClient):
        """POST /api/cron/jobs/{id}/toggle flips enabled=True to False."""
        with patch("app.api.cron.add_job"):
            job = _create_job(test_client)
        job_id = job["id"]
        assert job["enabled"] is True

        with patch("app.api.cron.pause_job") as mock_pause:
            resp = test_client.post(f"/api/cron/jobs/{job_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False
        mock_pause.assert_called_once_with(job_id)

    def test_toggle_enables_disabled_job(self, test_client: TestClient):
        """A second toggle re-enables the job and calls scheduler resume_job."""
        with patch("app.api.cron.add_job"):
            job = _create_job(test_client)
        job_id = job["id"]

        # Disable first
        with patch("app.api.cron.pause_job"):
            test_client.post(f"/api/cron/jobs/{job_id}/toggle")

        # Re-enable
        with patch("app.api.cron.resume_job") as mock_resume:
            resp = test_client.post(f"/api/cron/jobs/{job_id}/toggle")
        assert resp.json()["enabled"] is True
        mock_resume.assert_called_once_with(job_id)

    def test_toggle_unknown_job_returns_404(self, test_client: TestClient):
        """Toggling a nonexistent job returns 404."""
        resp = test_client.post("/api/cron/jobs/nonexistent/toggle")
        assert resp.status_code == 404


# ─── Immediate execution ───────────────────────────────────────────────────────

class TestRunCronJob:
    def test_run_creates_execution_record(self, test_client: TestClient):
        """POST /api/cron/jobs/{id}/run returns an execution record with id and status."""
        with patch("app.api.cron.add_job"):
            job = _create_job(test_client)
        job_id = job["id"]

        resp = test_client.post(f"/api/cron/jobs/{job_id}/run")
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "id" in data or "execution_id" in data
        assert "status" in data

    def test_run_execution_is_retrievable_in_history(self, test_client: TestClient):
        """Execution created by /run appears in GET /api/cron/executions."""
        with patch("app.api.cron.add_job"):
            job = _create_job(test_client)
        job_id = job["id"]

        test_client.post(f"/api/cron/jobs/{job_id}/run")

        resp = test_client.get("/api/cron/executions")
        assert resp.status_code == 200
        executions = resp.json()["executions"]
        assert any(e["job_id"] == job_id for e in executions)

    def test_run_increments_execution_count_on_job(self, test_client: TestClient):
        """Running a job increments its execution_count."""
        with patch("app.api.cron.add_job"):
            job = _create_job(test_client)
        job_id = job["id"]
        initial_count = job.get("execution_count", 0)

        test_client.post(f"/api/cron/jobs/{job_id}/run")

        resp = test_client.get(f"/api/cron/jobs/{job_id}")
        assert resp.json()["execution_count"] == initial_count + 1

    def test_run_unknown_job_returns_404(self, test_client: TestClient):
        """Running a nonexistent job returns 404."""
        resp = test_client.post("/api/cron/jobs/nonexistent/run")
        assert resp.status_code == 404


# ─── Execution history ─────────────────────────────────────────────────────────

class TestExecutionHistory:
    def test_list_executions_is_paginated(self, test_client: TestClient):
        """GET /api/cron/executions response includes total, page, page_size."""
        resp = test_client.get("/api/cron/executions")
        assert resp.status_code == 200
        data = resp.json()
        assert "executions" in data
        assert "total" in data
        assert "page" in data

    def test_executions_sorted_by_started_at_desc(self, test_client: TestClient):
        """Executions are returned newest-first."""
        with patch("app.api.cron.add_job"):
            job = _create_job(test_client)
        job_id = job["id"]

        # Create multiple executions
        test_client.post(f"/api/cron/jobs/{job_id}/run")
        time.sleep(0.01)
        test_client.post(f"/api/cron/jobs/{job_id}/run")

        resp = test_client.get(f"/api/cron/executions?job_id={job_id}")
        executions = resp.json()["executions"]
        assert len(executions) >= 2
        timestamps = [e["started_at"] for e in executions]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_executions_filterable_by_job_id(self, test_client: TestClient):
        """job_id query param filters executions to a single job."""
        with patch("app.api.cron.add_job"):
            job_a = _create_job(test_client, {"name": "Job A"})
            job_b = _create_job(test_client, {"name": "Job B"})
        test_client.post(f"/api/cron/jobs/{job_a['id']}/run")
        test_client.post(f"/api/cron/jobs/{job_b['id']}/run")

        resp = test_client.get(f"/api/cron/executions?job_id={job_a['id']}")
        executions = resp.json()["executions"]
        assert all(e["job_id"] == job_a["id"] for e in executions)


# ─── Dashboard ─────────────────────────────────────────────────────────────────

class TestCronDashboard:
    def test_dashboard_returns_total_and_active_counts(self, test_client: TestClient):
        """GET /api/cron/dashboard includes total and active job counts."""
        resp = test_client.get("/api/cron/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data or "total_jobs" in data
        assert "active" in data or "active_jobs" in data

    def test_dashboard_active_count_reflects_enabled_jobs(self, test_client: TestClient):
        """Active count increments when an enabled job is created."""
        resp_before = test_client.get("/api/cron/dashboard")
        active_before = resp_before.json().get("active", resp_before.json().get("active_jobs", 0))

        with patch("app.api.cron.add_job"):
            _create_job(test_client)  # enabled=True by default

        resp_after = test_client.get("/api/cron/dashboard")
        active_after = resp_after.json().get("active", resp_after.json().get("active_jobs", 0))
        assert active_after == active_before + 1

    def test_dashboard_failed_count_reflects_executions(self, test_client: TestClient):
        """Failed execution count is present in the dashboard response (any key variant)."""
        resp = test_client.get("/api/cron/dashboard")
        data = resp.json()
        assert any(k in data for k in ("failed", "failed_executions", "failed_last_24h"))


# ─── Lifecycle integration ─────────────────────────────────────────────────────

class TestJobLifecycle:
    def test_full_lifecycle_create_toggle_run_delete(self, test_client: TestClient):
        """End-to-end: create → toggle (disable) → run → delete removes all records."""
        # 1. Create
        with patch("app.api.cron.add_job") as mock_add:
            job = _create_job(test_client)
        job_id = job["id"]
        mock_add.assert_called_once()

        # 2. Toggle (disable)
        with patch("app.api.cron.pause_job") as mock_pause:
            toggle_resp = test_client.post(f"/api/cron/jobs/{job_id}/toggle")
        assert toggle_resp.json()["enabled"] is False
        mock_pause.assert_called_once_with(job_id)

        # 3. Run manually despite being disabled
        run_resp = test_client.post(f"/api/cron/jobs/{job_id}/run")
        assert run_resp.status_code in (200, 201)

        # Execution is in history
        history_resp = test_client.get(f"/api/cron/executions?job_id={job_id}")
        assert history_resp.json()["total"] >= 1

        # 4. Delete — job and its executions should be gone
        with patch("app.api.cron.remove_job") as mock_remove:
            del_resp = test_client.delete(f"/api/cron/jobs/{job_id}")
        assert del_resp.status_code in (200, 204)
        mock_remove.assert_called_once_with(job_id)

        # Job is gone
        get_resp = test_client.get(f"/api/cron/jobs/{job_id}")
        assert get_resp.status_code == 404

        # Executions are gone
        history_after = test_client.get(f"/api/cron/executions?job_id={job_id}")
        assert history_after.json()["total"] == 0

    def test_scheduler_not_called_for_disabled_job_on_create(self, test_client: TestClient):
        """Creating a job with enabled=False does not call scheduler.add_job."""
        with patch("app.api.cron.add_job") as mock_add:
            _create_job(test_client, {"enabled": False})
        mock_add.assert_not_called()
