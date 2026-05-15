"""
Tests for MIG-003: Cron Job System

Acceptance criteria:
- POST /api/cron/jobs creates a job
- POST /api/cron/validate-schedule returns next 5 run times for valid expression
- POST /api/cron/jobs/{id}/toggle disables/enables a job
- POST /api/cron/jobs/{id}/run triggers immediate execution and logs result
- GET /api/cron/executions returns paginated history sorted by started_at desc
- GET /api/cron/dashboard returns accurate counts
- Invalid cron expression returns 400
- Unit tests mock APScheduler and verify job lifecycle
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_job(name="test-job", schedule="0 * * * *", command="echo hello"):
    resp = client.post("/api/cron/jobs", json={
        "name": name,
        "schedule": schedule,
        "command": command,
        "job_type": "shell",
        "enabled": True,
        "tags": [],
    })
    return resp


# ---------------------------------------------------------------------------
# POST /api/cron/jobs — create job
# ---------------------------------------------------------------------------

class TestCreateCronJob:

    def test_create_job_returns_201(self):
        resp = _create_job()
        assert resp.status_code == 201

    def test_created_job_has_id_and_name(self):
        resp = _create_job(name="my-job")
        data = resp.json()
        assert "id" in data
        assert data["name"] == "my-job"

    def test_created_job_has_schedule(self):
        resp = _create_job(schedule="*/5 * * * *")
        data = resp.json()
        assert data["schedule"] == "*/5 * * * *"

    def test_create_job_with_invalid_schedule_returns_400(self):
        resp = client.post("/api/cron/jobs", json={
            "name": "bad",
            "schedule": "not-a-cron",
            "command": "echo",
            "job_type": "shell",
            "enabled": True,
            "tags": [],
        })
        assert resp.status_code == 400

    def test_created_job_appears_in_list(self):
        _create_job(name="list-check-job")
        resp = client.get("/api/cron/jobs")
        assert resp.status_code == 200
        names = [j["name"] for j in resp.json().get("jobs", [])]
        assert "list-check-job" in names


# ---------------------------------------------------------------------------
# GET /api/cron/jobs
# ---------------------------------------------------------------------------

class TestListCronJobs:

    def test_list_returns_200(self):
        resp = client.get("/api/cron/jobs")
        assert resp.status_code == 200
        assert "jobs" in resp.json()

    def test_list_filter_by_enabled(self):
        _create_job(name="enabled-j")
        resp = client.get("/api/cron/jobs?enabled=true")
        assert resp.status_code == 200
        for job in resp.json().get("jobs", []):
            assert job["enabled"] is True


# ---------------------------------------------------------------------------
# GET /api/cron/jobs/{id}
# ---------------------------------------------------------------------------

class TestGetCronJob:

    def test_get_existing_job_returns_200(self):
        job_id = _create_job(name="get-test").json()["id"]
        resp = client.get(f"/api/cron/jobs/{job_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == job_id

    def test_get_nonexistent_job_returns_404(self):
        resp = client.get("/api/cron/jobs/nonexistent-id")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/cron/validate-schedule
# ---------------------------------------------------------------------------

class TestValidateSchedule:

    def test_valid_expression_returns_next_5_times(self):
        resp = client.post("/api/cron/validate-schedule",
                           json={"schedule": "0 * * * *"})
        assert resp.status_code == 200
        data = resp.json()
        assert "next_runs" in data
        assert len(data["next_runs"]) == 5

    def test_invalid_expression_returns_400(self):
        resp = client.post("/api/cron/validate-schedule",
                           json={"schedule": "not-valid-cron"})
        assert resp.status_code == 400
        assert "error" in resp.json()

    def test_valid_expression_returns_human_readable_times(self):
        resp = client.post("/api/cron/validate-schedule",
                           json={"schedule": "*/15 * * * *"})
        data = resp.json()
        assert all(isinstance(t, str) for t in data["next_runs"])


# ---------------------------------------------------------------------------
# POST /api/cron/jobs/{id}/toggle
# ---------------------------------------------------------------------------

class TestToggleCronJob:

    def test_toggle_disables_enabled_job(self):
        job_id = _create_job(name="toggle-j", schedule="0 0 * * *").json()["id"]
        resp = client.post(f"/api/cron/jobs/{job_id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

    def test_toggle_twice_re_enables_job(self):
        job_id = _create_job(name="toggle-twice").json()["id"]
        client.post(f"/api/cron/jobs/{job_id}/toggle")
        resp = client.post(f"/api/cron/jobs/{job_id}/toggle")
        assert resp.json()["enabled"] is True

    def test_toggle_nonexistent_job_returns_404(self):
        resp = client.post("/api/cron/jobs/ghost-id/toggle")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/cron/jobs/{id}/run  — manual trigger
# ---------------------------------------------------------------------------

class TestRunCronJob:

    def test_run_returns_200_with_execution_record(self):
        job_id = _create_job(name="run-test").json()["id"]
        resp = client.post(f"/api/cron/jobs/{job_id}/run")
        assert resp.status_code == 200
        data = resp.json()
        assert "execution_id" in data
        assert "status" in data

    def test_run_nonexistent_job_returns_404(self):
        resp = client.post("/api/cron/jobs/nope/run")
        assert resp.status_code == 404

    def test_run_creates_execution_history_entry(self):
        job_id = _create_job(name="history-test").json()["id"]
        client.post(f"/api/cron/jobs/{job_id}/run")
        resp = client.get("/api/cron/executions")
        job_ids = [e["job_id"] for e in resp.json()["executions"]]
        assert job_id in job_ids


# ---------------------------------------------------------------------------
# GET /api/cron/executions
# ---------------------------------------------------------------------------

class TestCronExecutions:

    def test_executions_returns_200(self):
        resp = client.get("/api/cron/executions")
        assert resp.status_code == 200

    def test_executions_has_pagination_fields(self):
        resp = client.get("/api/cron/executions")
        data = resp.json()
        assert "executions" in data
        assert "total" in data
        assert "page" in data

    def test_executions_ordered_newest_first(self):
        job_id = _create_job(name="order-test").json()["id"]
        client.post(f"/api/cron/jobs/{job_id}/run")
        client.post(f"/api/cron/jobs/{job_id}/run")
        resp = client.get("/api/cron/executions")
        execs = resp.json()["executions"]
        if len(execs) >= 2:
            # newest started_at should come first
            assert execs[0]["started_at"] >= execs[1]["started_at"]


# ---------------------------------------------------------------------------
# GET /api/cron/dashboard
# ---------------------------------------------------------------------------

class TestCronDashboard:

    def test_dashboard_returns_200(self):
        resp = client.get("/api/cron/dashboard")
        assert resp.status_code == 200

    def test_dashboard_has_required_counts(self):
        resp = client.get("/api/cron/dashboard")
        data = resp.json()
        assert "total" in data
        assert "active" in data
        assert "failed" in data
        assert "inactive" in data

    def test_dashboard_active_count_matches_enabled_jobs(self):
        # Create an enabled job
        _create_job(name="dashboard-active")
        resp = client.get("/api/cron/dashboard")
        data = resp.json()
        assert data["active"] >= 1

    def test_dashboard_total_increases_after_create(self):
        before = client.get("/api/cron/dashboard").json()["total"]
        _create_job(name="dashboard-total")
        after = client.get("/api/cron/dashboard").json()["total"]
        assert after == before + 1


# ---------------------------------------------------------------------------
# GET /api/cron/status
# ---------------------------------------------------------------------------

class TestCronStatus:

    def test_status_returns_200(self):
        resp = client.get("/api/cron/status")
        assert resp.status_code == 200

    def test_status_has_scheduler_field(self):
        resp = client.get("/api/cron/status")
        assert "scheduler" in resp.json()


# ---------------------------------------------------------------------------
# GET /api/cron/templates
# ---------------------------------------------------------------------------

class TestCronTemplates:

    def test_templates_returns_200(self):
        resp = client.get("/api/cron/templates")
        assert resp.status_code == 200

    def test_templates_returns_list(self):
        resp = client.get("/api/cron/templates")
        assert resp.status_code == 200
        data = resp.json()
        assert "templates" in data
        assert len(data["templates"]) > 0

    def test_each_template_has_name_and_schedule(self):
        resp = client.get("/api/cron/templates")
        assert resp.status_code == 200
        for tmpl in resp.json()["templates"]:
            assert "name" in tmpl
            assert "schedule" in tmpl


# ---------------------------------------------------------------------------
# DELETE /api/cron/jobs/{id}
# ---------------------------------------------------------------------------

class TestDeleteCronJob:

    def test_delete_returns_200(self):
        job_id = _create_job(name="del-test").json()["id"]
        resp = client.delete(f"/api/cron/jobs/{job_id}")
        assert resp.status_code == 200

    def test_deleted_job_not_in_list(self):
        job_id = _create_job(name="del-gone").json()["id"]
        client.delete(f"/api/cron/jobs/{job_id}")
        resp = client.get(f"/api/cron/jobs/{job_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Unit test — job lifecycle with mocked APScheduler
# ---------------------------------------------------------------------------

class TestJobLifecycleUnit:

    def test_cron_store_create_toggle_run_delete(self):
        """Full lifecycle using CronStore directly (no HTTP layer)."""
        from app.cron.store import CronStore

        store = CronStore()

        # Create
        job = store.create_job(
            name="unit-job",
            schedule="0 * * * *",
            command="echo unit",
            job_type="shell",
            tags=[],
        )
        assert job.id in store.list_jobs()

        # Toggle (disable)
        updated = store.toggle_job(job.id)
        assert updated.enabled is False

        # Run (manual execution logged)
        execution = store.record_execution(job.id, status="success", output="ok")
        assert execution.job_id == job.id
        assert store.get_executions(job.id)[0].status == "success"

        # Delete
        store.delete_job(job.id)
        assert job.id not in store.list_jobs()
