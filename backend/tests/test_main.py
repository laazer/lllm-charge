"""
Tests for main FastAPI application
"""
import pytest
from fastapi.testclient import TestClient


def test_health_endpoint(test_client: TestClient):
    """Test health endpoint"""
    response = test_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "version" in data


def test_readiness_endpoint(test_client: TestClient):
    """Test readiness endpoint"""
    response = test_client.get("/health/ready")
    assert response.status_code in [200, 503]


def test_liveness_endpoint(test_client: TestClient):
    """Test liveness endpoint"""
    response = test_client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_create_agent(test_client: TestClient, sample_agent_data):
    """Test agent creation"""
    response = test_client.post("/api/agents/", json=sample_agent_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == sample_agent_data["name"]
    assert data["primary_role"] == sample_agent_data["primary_role"]
    assert "id" in data


def test_get_agents(test_client: TestClient):
    """Test getting all agents"""
    response = test_client.get("/api/agents/")
    assert response.status_code == 200
    body = response.json()
    assert "agents" in body
    assert isinstance(body["agents"], list)
