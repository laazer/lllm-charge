"""
Tests for MIG-003: Port Cron Job System to Python.

Acceptance criteria:
  - POST /api/cron/jobs creates a job
  - POST /api/cron/validate-schedule returns next 5 run times for valid cron expr
  - POST /api/cron/jobs/{id}/toggle enables/disables a job
  - POST /api/cron/jobs/{id}/run triggers immediate execution
  - GET /api/cron/executions returns paginated history sorted by started_at desc
  - GET /api/cron/dashboard returns counts for active, failed, upcoming jobs
  - Invalid cron expression returns 400 with descriptive error
  - Job lifecycle: create → toggle → run → delete
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


# ─── Create job ────────────────────────────────────────────────────────────────

class TestCreateCronJob:
    def test_create_job_returns_id_and_name(self, test_client: TestClient):
        """POST /api/cron/jobs creates a job and returns id + name."""
        payload = {"name": "My Job", "schedule": "0 * * * *", "command": "echo hello"}
        response = test_client.post("/api/cron/jobs", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["name"] == "My Job"

    def test_create_job_stores_schedule(self, test_client: TestClient):
        """Created job has the schedule that was sent."""
        payload = {"name": "Scheduled", "schedule": "*/5 * * * *", "command": "run"}
        response = test_client.post("/api/cron/jobs", json=payload)
        data = response.json()
        assert data["schedule"] == "*/5 * * * *"

    def test_create_job_defaults_to_enabled(self, test_client: TestClient):
        """New jobs are enabled by default."""
        payload = {"name": "Auto-Enabled", "schedule": "0 0 * * *", "command": "noop"}
        response = test_client.post("/api/cron/jobs", json=payload)
        data = response.json()
        assert data["enabled"] is True

    def test_invalid_cron_expression_returns_400(self, test_client: TestClient):
        """Invalid cron expression returns 400 with descriptive error."""
        payload = {"name": "Bad Job", "schedule": "not-a-cron", "command": "echo"}
        response = test_client.post("/api/cron/jobs", json=payload)
        assert response.status_code == 400
        assert "cron" in response.json().get("detail", "").lower() or \
               "schedule" in response.json().get("detail", "").lower() or \
               "invalid" in response.json().get("detail", "").lower()


# ─── List jobs ─────────────────────────────────────────────────────────────────

class TestListCronJobs:
    def test_list_jobs_returns_list(self, test_client: TestClient):
        """GET /api/cron/jobs returns a list."""
        response = test_client.get("/api/cron/jobs")
        assert response.status_code == 200
        data = response.json()
        jobs = data.get("jobs", data)
        assert isinstance(jobs, list)

    def test_list_jobs_reflects_created_job(self, test_client: TestClient):
        """Created job appears in the list."""
        test_client.post("/api/cron/jobs", json={"name": "Listed", "schedule": "0 1 * * *", "command": "x"})
        response = test_client.get("/api/cron/jobs")
        data = response.json()
        jobs = data.get("jobs", data)
        assert any(j["name"] == "Listed" for j in jobs)


# ─── Get single job ────────────────────────────────────────────────────────────

class TestGetCronJob:
    def test_get_job_by_id(self, test_client: TestClient):
        """GET /api/cron/jobs/{id} returns the specific job."""
        create = test_client.post("/api/cron/jobs", json={"name": "Fetchable", "schedule": "0 2 * * *", "command": "y"})
        job_id = create.json()["id"]
        response = test_client.get(f"/api/cron/jobs/{job_id}")
        assert response.status_code == 200
        assert response.json()["id"] == job_id

    def test_get_unknown_job_returns_404(self, test_client: TestClient):
        """GET /api/cron/jobs/nonexistent returns 404."""
        response = test_client.get("/api/cron/jobs/nonexistent-job-id")
        assert response.status_code == 404


# ─── Toggle job ────────────────────────────────────────────────────────────────

class TestToggleCronJob:
    def test_toggle_disables_enabled_job(self, test_client: TestClient):
        """Toggling an enabled job disables it."""
        create = test_client.post("/api/cron/jobs", json={"name": "Toggle", "schedule": "0 3 * * *", "command": "z"})
        job_id = create.json()["id"]
        assert create.json()["enabled"] is True

        response = test_client.post(f"/api/cron/jobs/{job_id}/toggle")
        assert response.status_code == 200
        assert response.json()["enabled"] is False

    def test_toggle_re_enables_disabled_job(self, test_client: TestClient):
        """Toggling twice re-enables the job."""
        create = test_client.post("/api/cron/jobs", json={"name": "Toggle2", "schedule": "0 4 * * *", "command": "a"})
        job_id = create.json()["id"]
        test_client.post(f"/api/cron/jobs/{job_id}/toggle")  # disable
        response = test_client.post(f"/api/cron/jobs/{job_id}/toggle")  # re-enable
        assert response.json()["enabled"] is True

    def test_toggle_unknown_job_returns_404(self, test_client: TestClient):
        """POST /api/cron/jobs/nonexistent/toggle returns 404."""
        response = test_client.post("/api/cron/jobs/nonexistent/toggle")
        assert response.status_code == 404


# ─── Run job ───────────────────────────────────────────────────────────────────

class TestRunCronJob:
    def test_run_job_creates_execution_record(self, test_client: TestClient):
        """POST /api/cron/jobs/{id}/run creates an execution and returns its id."""
        create = test_client.post("/api/cron/jobs", json={"name": "Runnable", "schedule": "0 5 * * *", "command": "echo ok"})
        job_id = create.json()["id"]

        response = test_client.post(f"/api/cron/jobs/{job_id}/run")
        assert response.status_code in (200, 201)
        data = response.json()
        assert "execution_id" in data or "id" in data

    def test_run_job_increments_execution_count(self, test_client: TestClient):
        """Running a job increments its execution_count."""
        create = test_client.post("/api/cron/jobs", json={"name": "Counter", "schedule": "0 6 * * *", "command": "noop"})
        job_id = create.json()["id"]

        test_client.post(f"/api/cron/jobs/{job_id}/run")
        job = test_client.get(f"/api/cron/jobs/{job_id}").json()
        assert job["execution_count"] >= 1

    def test_run_unknown_job_returns_404(self, test_client: TestClient):
        """POST /api/cron/jobs/nonexistent/run returns 404."""
        response = test_client.post("/api/cron/jobs/nonexistent/run")
        assert response.status_code == 404


# ─── Executions ────────────────────────────────────────────────────────────────

class TestCronExecutions:
    def test_executions_returns_list(self, test_client: TestClient):
        """GET /api/cron/executions returns a list."""
        response = test_client.get("/api/cron/executions")
        assert response.status_code == 200
        data = response.json()
        executions = data.get("executions", data)
        assert isinstance(executions, list)

    def test_executions_include_pagination_fields(self, test_client: TestClient):
        """GET /api/cron/executions includes total and page fields."""
        response = test_client.get("/api/cron/executions")
        data = response.json()
        assert "total" in data

    def test_executions_appear_after_run(self, test_client: TestClient):
        """Running a job makes an execution appear in /api/cron/executions."""
        create = test_client.post("/api/cron/jobs", json={"name": "ExecTest", "schedule": "0 7 * * *", "command": "noop"})
        job_id = create.json()["id"]
        test_client.post(f"/api/cron/jobs/{job_id}/run")

        response = test_client.get("/api/cron/executions")
        data = response.json()
        executions = data.get("executions", data)
        assert any(e.get("job_id") == job_id for e in executions)


# ─── Delete job ────────────────────────────────────────────────────────────────

class TestDeleteCronJob:
    def test_delete_removes_job(self, test_client: TestClient):
        """DELETE /api/cron/jobs/{id} removes the job."""
        create = test_client.post("/api/cron/jobs", json={"name": "Deletable", "schedule": "0 8 * * *", "command": "noop"})
        job_id = create.json()["id"]

        response = test_client.delete(f"/api/cron/jobs/{job_id}")
        assert response.status_code in (200, 204)

        get_response = test_client.get(f"/api/cron/jobs/{job_id}")
        assert get_response.status_code == 404

    def test_delete_unknown_job_returns_404(self, test_client: TestClient):
        """DELETE /api/cron/jobs/nonexistent returns 404."""
        response = test_client.delete("/api/cron/jobs/nonexistent")
        assert response.status_code == 404


# ─── Validate schedule ─────────────────────────────────────────────────────────

class TestValidateSchedule:
    def test_valid_cron_returns_next_run_times(self, test_client: TestClient):
        """POST /api/cron/validate-schedule returns next 5 run times."""
        payload = {"schedule": "0 * * * *"}
        response = test_client.post("/api/cron/validate-schedule", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "next_runs" in data
        assert len(data["next_runs"]) >= 5

    def test_invalid_cron_in_validate_returns_400(self, test_client: TestClient):
        """POST /api/cron/validate-schedule returns 400 for bad expressions."""
        response = test_client.post("/api/cron/validate-schedule", json={"schedule": "not-valid"})
        assert response.status_code == 400


# ─── Dashboard ─────────────────────────────────────────────────────────────────

class TestCronDashboard:
    def test_dashboard_returns_200(self, test_client: TestClient):
        """GET /api/cron/dashboard returns 200."""
        response = test_client.get("/api/cron/dashboard")
        assert response.status_code == 200

    def test_dashboard_has_required_fields(self, test_client: TestClient):
        """Dashboard includes total, active, and failed counts."""
        response = test_client.get("/api/cron/dashboard")
        data = response.json()
        assert "total" in data
        assert "active" in data
        assert "failed" in data

    def test_dashboard_counts_reflect_created_jobs(self, test_client: TestClient):
        """Dashboard total increments when jobs are created."""
        before = test_client.get("/api/cron/dashboard").json()["total"]
        test_client.post("/api/cron/jobs", json={"name": "Dashboard Job", "schedule": "0 9 * * *", "command": "noop"})
        after = test_client.get("/api/cron/dashboard").json()["total"]
        assert after == before + 1


# ─── Templates ─────────────────────────────────────────────────────────────────

class TestCronTemplates:
    def test_templates_returns_list(self, test_client: TestClient):
        """GET /api/cron/templates returns a list of templates."""
        response = test_client.get("/api/cron/templates")
        assert response.status_code == 200
        data = response.json()
        templates = data.get("templates", data)
        assert isinstance(templates, list)
        assert len(templates) > 0

    def test_each_template_has_name_and_schedule(self, test_client: TestClient):
        """Each template has name and schedule fields."""
        response = test_client.get("/api/cron/templates")
        data = response.json()
        templates = data.get("templates", data)
        for template in templates:
            assert "name" in template
            assert "schedule" in template


# ─── Status ────────────────────────────────────────────────────────────────────

class TestCronStatus:
    def test_status_returns_200(self, test_client: TestClient):
        """GET /api/cron/status returns 200."""
        response = test_client.get("/api/cron/status")
        assert response.status_code == 200

    def test_status_has_running_field(self, test_client: TestClient):
        """GET /api/cron/status includes a running flag."""
        response = test_client.get("/api/cron/status")
        data = response.json()
        assert "running" in data
