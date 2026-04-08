"""
Pytest configuration and fixtures
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.api import deps
from app.database.database import Base, get_db

import app.database.models.main  # noqa: F401 — register ORM tables on Base.metadata
import app.database.models.agents  # noqa: F401
import app.database.models.flows  # noqa: F401
import app.database.models.metrics  # noqa: F401

from app.main import app as fastapi_app
import tempfile
import os


@pytest.fixture
def test_db():
    """Create test database"""
    # Create temporary database
    db_fd, db_path = tempfile.mkstemp()
    test_engine = create_engine(f"sqlite:///{db_path}")
    
    # Create tables
    Base.metadata.create_all(bind=test_engine)
    
    # Create session
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    yield TestingSessionLocal
    
    # Cleanup
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def test_client(test_db):
    """Create test client with test database"""
    def override_get_db():
        try:
            db = test_db()
            yield db
        finally:
            db.close()
    
    # Agents router depends on deps.get_db (re-export of database.get_db — override both)
    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[deps.get_db] = override_get_db
    client = TestClient(fastapi_app)
    yield client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def sample_agent_data():
    """Sample agent data for testing (matches AgentCreate schema)"""
    return {
        "name": "Test Agent",
        "description": "A test agent for unit testing",
        "primary_role": "assistant",
        "capabilities": {
            "reasoning": 0.8,
            "creativity": 0.7,
            "technical": 0.9,
            "communication": 0.85,
        },
        "config": {
            "project_id": "test-project-123",
            "security_policy": {"sandboxed": True, "max_memory": "512MB"},
            "constraints": {"max_execution_time": 300},
        },
    }