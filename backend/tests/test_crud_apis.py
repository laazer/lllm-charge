"""
Tests for MIG-002: Complete Stub CRUD APIs in Python.

Covers all acceptance criteria:
  - GET /api/workflows returns real rows with pagination
  - POST /api/workflows/{id}/execute creates an execution record
  - GET /api/specs  returns real specs from DB, empty array when none exist
  - GET /api/projects  returns real projects; POST /api/projects/scan discovers filesystem projects
  - GET /api/health   returns uptime and db status
  - GET /api/metrics  returns live counters (not hardcoded)
"""
import pytest
from fastapi.testclient import TestClient


# ─── Workflows ─────────────────────────────────────────────────────────────────

class TestWorkflowsAPI:
    def test_list_workflows_returns_empty_list_initially(self, test_client: TestClient):
        """GET /api/workflows/ returns an empty list before any data is created."""
        response = test_client.get("/api/workflows/")
        assert response.status_code == 200
        data = response.json()
        workflows = data.get("workflows", data)
        assert isinstance(workflows, list)
        assert len(workflows) == 0

    def test_create_workflow_returns_record_with_id(self, test_client: TestClient):
        """POST /api/workflows/ creates a workflow and returns it with an id."""
        payload = {"name": "My Workflow", "description": "Integration test workflow"}
        response = test_client.post("/api/workflows/", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["name"] == "My Workflow"

    def test_list_workflows_reflects_created_records(self, test_client: TestClient):
        """GET /api/workflows/ returns rows that were previously created."""
        test_client.post("/api/workflows/", json={"name": "WF-Listed"})
        response = test_client.get("/api/workflows/")
        data = response.json()
        workflows = data.get("workflows", data)
        assert any(w["name"] == "WF-Listed" for w in workflows)

    def test_list_workflows_includes_pagination_fields(self, test_client: TestClient):
        """GET /api/workflows/ response includes total, page, page_size."""
        response = test_client.get("/api/workflows/")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

    def test_execute_workflow_creates_execution_record_with_status(self, test_client: TestClient):
        """POST /api/workflows/{id}/execute creates an execution record and returns its id and status."""
        create = test_client.post("/api/workflows/", json={"name": "Exec WF"})
        wf_id = create.json()["id"]

        response = test_client.post(f"/api/workflows/{wf_id}/execute", json={})
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert "status" in data

    def test_execute_workflow_links_execution_to_workflow(self, test_client: TestClient):
        """Execution record contains the workflow_id that triggered it."""
        create = test_client.post("/api/workflows/", json={"name": "Linked WF"})
        wf_id = create.json()["id"]

        response = test_client.post(f"/api/workflows/{wf_id}/execute", json={})
        assert response.json().get("workflow_id") == wf_id

    def test_execute_unknown_workflow_returns_404(self, test_client: TestClient):
        """POST /api/workflows/nonexistent/execute returns 404."""
        response = test_client.post("/api/workflows/nonexistent/execute", json={})
        assert response.status_code == 404


# ─── Specs ─────────────────────────────────────────────────────────────────────

class TestSpecsAPI:
    def test_list_specs_returns_empty_array_when_none_exist(self, test_client: TestClient):
        """GET /api/specs/ returns an empty list when the database is empty."""
        response = test_client.get("/api/specs/")
        assert response.status_code == 200
        data = response.json()
        specs = data.get("specs", data)
        assert specs == []

    def test_create_spec_returns_id_and_title(self, test_client: TestClient):
        """POST /api/specs/ creates a spec and returns id and title."""
        payload = {"title": "My First Spec", "content": "Spec content here"}
        response = test_client.post("/api/specs/", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["title"] == "My First Spec"

    def test_list_specs_returns_real_data_from_db(self, test_client: TestClient):
        """GET /api/specs/ returns previously created specs from the database."""
        test_client.post("/api/specs/", json={"title": "Stored Spec"})
        response = test_client.get("/api/specs/")
        data = response.json()
        specs = data.get("specs", data)
        assert len(specs) >= 1
        assert any(s["title"] == "Stored Spec" for s in specs)

    def test_get_spec_by_id(self, test_client: TestClient):
        """GET /api/specs/{id} returns the specific spec."""
        create = test_client.post("/api/specs/", json={"title": "Fetchable Spec"})
        spec_id = create.json()["id"]

        response = test_client.get(f"/api/specs/{spec_id}")
        assert response.status_code == 200
        assert response.json()["id"] == spec_id

    def test_get_unknown_spec_returns_404(self, test_client: TestClient):
        """GET /api/specs/nonexistent returns 404."""
        response = test_client.get("/api/specs/nonexistent-id")
        assert response.status_code == 404


# ─── Projects ──────────────────────────────────────────────────────────────────

class TestProjectsAPI:
    def test_list_projects_returns_list(self, test_client: TestClient):
        """GET /api/projects/ returns a list (empty or otherwise)."""
        response = test_client.get("/api/projects/")
        assert response.status_code == 200
        data = response.json()
        projects = data.get("projects", data)
        assert isinstance(projects, list)

    def test_create_project_returns_id_and_name(self, test_client: TestClient):
        """POST /api/projects/ creates a project and returns id and name."""
        payload = {"name": "Alpha Project", "description": "Test project"}
        response = test_client.post("/api/projects/", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["name"] == "Alpha Project"

    def test_list_projects_returns_real_data_from_db(self, test_client: TestClient):
        """GET /api/projects/ returns previously created projects."""
        test_client.post("/api/projects/", json={"name": "Listed Project"})
        response = test_client.get("/api/projects/")
        data = response.json()
        projects = data.get("projects", data)
        assert any(p["name"] == "Listed Project" for p in projects)

    def test_scan_projects_returns_discovered_list(self, test_client: TestClient):
        """POST /api/projects/scan returns a list of discovered filesystem projects."""
        response = test_client.post("/api/projects/scan", json={"path": "/tmp"})
        assert response.status_code in (200, 201)
        data = response.json()
        # Must return either a dict with "projects" key or a plain list
        assert "projects" in data or isinstance(data, list)

    def test_get_project_by_id(self, test_client: TestClient):
        """GET /api/projects/{id} returns the specific project."""
        create = test_client.post("/api/projects/", json={"name": "Fetchable Project"})
        project_id = create.json()["id"]

        response = test_client.get(f"/api/projects/{project_id}")
        assert response.status_code == 200
        assert response.json()["id"] == project_id

    def test_get_unknown_project_returns_404(self, test_client: TestClient):
        """GET /api/projects/nonexistent returns 404."""
        response = test_client.get("/api/projects/nonexistent-id")
        assert response.status_code == 404


# ─── Health & Metrics ──────────────────────────────────────────────────────────

class TestHealthAndMetricsAPI:
    def test_api_health_returns_uptime(self, test_client: TestClient):
        """GET /api/health returns a response with uptime information."""
        response = test_client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        # Must include an uptime field (seconds since server start)
        assert "uptime_seconds" in data or "uptime" in data

    def test_api_health_returns_db_status(self, test_client: TestClient):
        """GET /api/health includes database connectivity status."""
        response = test_client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "database" in data or "db_status" in data

    def test_api_metrics_returns_request_count(self, test_client: TestClient):
        """GET /api/metrics includes a request_count counter (not hardcoded sentinel)."""
        response = test_client.get("/api/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "request_count" in data or "requests" in data
        count_key = "request_count" if "request_count" in data else "requests"
        assert isinstance(data[count_key], (int, float))

    def test_api_metrics_returns_error_rate(self, test_client: TestClient):
        """GET /api/metrics includes an error_rate field."""
        response = test_client.get("/api/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "error_rate" in data
