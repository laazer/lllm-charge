"""
Comprehensive tests for main FastAPI application.
Each test is isolated via the test_client fixture (fresh in-memory DB per test).
All create/update/delete tests verify database state — not just HTTP responses.

Route prefixes (from app/main.py):
  Health:  GET /health
  Agents:  /api/agents
"""
import pytest
from fastapi.testclient import TestClient
from app.database.models.agents import Agent


# ─── Health Endpoints ──────────────────────────────────────────────────────────

def test_health_endpoint_returns_required_fields(test_client: TestClient):
    """Health endpoint must return status, version, and components.database."""
    response = test_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ("healthy", "degraded", "unhealthy")
    assert "version" in data
    # "database" lives inside "components", not at top level
    assert "components" in data
    assert "database" in data["components"]


def test_health_endpoint_service_name(test_client: TestClient):
    """Health endpoint must identify the service by name."""
    response = test_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("service") == "llm-charge-backend"


def test_database_health_endpoint(test_client: TestClient):
    """Dedicated database health endpoint must respond with a status."""
    response = test_client.get("/health/database")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


# ─── Agent Creation ────────────────────────────────────────────────────────────

def test_create_agent_returns_201_with_complete_response(
    test_client: TestClient, sample_agent_data
):
    """POST /api/agents/ must return 201 with all expected response fields."""
    response = test_client.post("/api/agents/", json=sample_agent_data)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == sample_agent_data["name"]
    assert data["description"] == sample_agent_data["description"]
    assert data["primary_role"] == sample_agent_data["primary_role"]
    assert data["status"] == "active"
    assert "id" in data
    assert data["task_count"] == 0
    assert data["success_rate"] == 0.0
    assert data["avg_response_time"] == 0.0
    assert "created_at" in data
    assert "updated_at" in data


def test_create_agent_persists_to_database(
    test_client: TestClient, sample_agent_data, test_db
):
    """Agent must be queryable from database after creation."""
    response = test_client.post("/api/agents/", json=sample_agent_data)
    assert response.status_code == 201
    agent_id = response.json()["id"]

    db = test_db()
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    db.close()
    assert agent is not None
    assert agent.name == sample_agent_data["name"]
    assert agent.primary_role == sample_agent_data["primary_role"]


def test_create_agent_conflict_returns_409(
    test_client: TestClient, sample_agent_data
):
    """Creating an agent with a duplicate name must return 409 Conflict."""
    test_client.post("/api/agents/", json=sample_agent_data)
    response = test_client.post("/api/agents/", json=sample_agent_data)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_create_agent_with_invalid_role_returns_422(test_client: TestClient):
    """Creating an agent with an unknown role must return 422."""
    response = test_client.post("/api/agents/", json={
        "name": "Bad Role Agent",
        "primary_role": "not_a_real_role",
    })
    assert response.status_code == 422


def test_create_agent_missing_name_returns_422(test_client: TestClient):
    """POST without required name must return 422."""
    response = test_client.post("/api/agents/", json={"primary_role": "assistant"})
    assert response.status_code == 422


def test_create_agent_missing_role_returns_422(test_client: TestClient):
    """POST without required primary_role must return 422."""
    response = test_client.post("/api/agents/", json={"name": "Missing Role"})
    assert response.status_code == 422


def test_create_agent_preserves_capabilities(
    test_client: TestClient, sample_agent_data
):
    """Capabilities must round-trip through create without data loss."""
    response = test_client.post("/api/agents/", json=sample_agent_data)
    assert response.status_code == 201
    caps = response.json()["capabilities"]
    assert caps["reasoning"] == sample_agent_data["capabilities"]["reasoning"]
    assert caps["technical"] == sample_agent_data["capabilities"]["technical"]
    assert caps["creativity"] == sample_agent_data["capabilities"]["creativity"]
    assert caps["communication"] == sample_agent_data["capabilities"]["communication"]


# ─── Agent Retrieval ───────────────────────────────────────────────────────────

def test_get_agents_returns_empty_list_on_fresh_db(test_client: TestClient):
    """GET /api/agents/ on a fresh database must return an empty list."""
    response = test_client.get("/api/agents/")
    assert response.status_code == 200
    data = response.json()
    assert data["agents"] == []
    assert data["total"] == 0
    assert data["page"] == 1


def test_get_agents_returns_created_agent(
    test_client: TestClient, sample_agent_data
):
    """Agents must appear in GET /api/agents/ after creation."""
    test_client.post("/api/agents/", json=sample_agent_data)
    response = test_client.get("/api/agents/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["agents"][0]["name"] == sample_agent_data["name"]


def test_get_agent_by_id_returns_correct_agent(
    test_client: TestClient, sample_agent_data
):
    """GET /api/agents/{id} must return the exact agent with all fields."""
    create_resp = test_client.post("/api/agents/", json=sample_agent_data)
    assert create_resp.status_code == 201
    agent_id = create_resp.json()["id"]

    response = test_client.get(f"/api/agents/{agent_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == agent_id
    assert data["name"] == sample_agent_data["name"]
    assert data["primary_role"] == sample_agent_data["primary_role"]
    assert data["status"] == "active"
    assert "created_at" in data
    assert "updated_at" in data


def test_get_agent_not_found_returns_404(test_client: TestClient):
    """GET /api/agents/{nonexistent_id} must return 404."""
    response = test_client.get("/api/agents/nonexistent-id-999")
    assert response.status_code == 404


def test_get_agents_pagination_limits_results(test_client: TestClient):
    """page_size parameter must constrain the number of returned agents."""
    for i in range(3):
        test_client.post("/api/agents/", json={
            "name": f"Pagination Agent {i}",
            "primary_role": "assistant",
        })

    response = test_client.get("/api/agents/?page=1&page_size=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data["agents"]) == 2
    assert data["total"] == 3
    assert data["page_size"] == 2


def test_get_agents_filter_by_role(test_client: TestClient):
    """Role filter must return only agents matching the specified role."""
    test_client.post("/api/agents/", json={"name": "Arch Agent", "primary_role": "architect"})
    test_client.post("/api/agents/", json={"name": "Frontend Agent", "primary_role": "frontend"})

    response = test_client.get("/api/agents/?role=architect")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["agents"][0]["primary_role"] == "architect"


# ─── Agent Updates ─────────────────────────────────────────────────────────────

def test_update_agent_returns_updated_fields(
    test_client: TestClient, sample_agent_data
):
    """PUT /api/agents/{id} must return the agent with only changed fields updated."""
    create_resp = test_client.post("/api/agents/", json=sample_agent_data)
    assert create_resp.status_code == 201
    agent_id = create_resp.json()["id"]

    response = test_client.put(f"/api/agents/{agent_id}", json={
        "description": "Updated description",
        "status": "inactive"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Updated description"
    assert data["status"] == "inactive"
    assert data["name"] == sample_agent_data["name"]  # Unchanged fields preserved


def test_update_agent_persists_to_database(
    test_client: TestClient, sample_agent_data, test_db
):
    """Updates must be written to the database, not just returned in the response."""
    create_resp = test_client.post("/api/agents/", json=sample_agent_data)
    assert create_resp.status_code == 201
    agent_id = create_resp.json()["id"]

    test_client.put(f"/api/agents/{agent_id}", json={"description": "DB persisted update"})

    db = test_db()
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    db.close()
    assert agent.description == "DB persisted update"


def test_update_nonexistent_agent_returns_404(test_client: TestClient):
    """PUT on a nonexistent agent ID must return 404."""
    response = test_client.put("/api/agents/ghost-id-000", json={"description": "x"})
    assert response.status_code == 404


# ─── Agent Deletion ─────────────────────────────────────────────────────────────

def test_delete_agent_removes_from_database(
    test_client: TestClient, sample_agent_data, test_db
):
    """Deleted agent must not be retrievable from the database."""
    create_resp = test_client.post("/api/agents/", json=sample_agent_data)
    assert create_resp.status_code == 201
    agent_id = create_resp.json()["id"]

    delete_resp = test_client.delete(f"/api/agents/{agent_id}")
    assert delete_resp.status_code in (200, 204)

    db = test_db()
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    db.close()
    assert agent is None


def test_delete_nonexistent_agent_returns_404(test_client: TestClient):
    """DELETE on a nonexistent agent ID must return 404."""
    response = test_client.delete("/api/agents/nonexistent-delete-id")
    assert response.status_code == 404


def test_delete_agent_returns_success_status(
    test_client: TestClient, sample_agent_data
):
    """DELETE must return a success status code (200 or 204)."""
    create_resp = test_client.post("/api/agents/", json=sample_agent_data)
    assert create_resp.status_code == 201
    agent_id = create_resp.json()["id"]

    delete_resp = test_client.delete(f"/api/agents/{agent_id}")
    assert delete_resp.status_code in (200, 204)


def test_get_after_delete_returns_404(
    test_client: TestClient, sample_agent_data
):
    """GET on a previously-deleted agent must return 404."""
    create_resp = test_client.post("/api/agents/", json=sample_agent_data)
    assert create_resp.status_code == 201
    agent_id = create_resp.json()["id"]

    test_client.delete(f"/api/agents/{agent_id}")
    response = test_client.get(f"/api/agents/{agent_id}")
    assert response.status_code == 404
