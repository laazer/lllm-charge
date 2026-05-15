"""
Pytest configuration and fixtures
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database.database import get_db
from app.database.models.base import Base
# Import model modules so their tables are registered in Base.metadata before create_all
import app.database.models.agents  # noqa: F401
import app.database.models.main  # noqa: F401
import app.database.models.workflows  # noqa: F401
import app.cron.models  # noqa: F401
import app.database.models.buddies  # noqa: F401
import app.database.models.memory  # noqa: F401
from app.main import app
import tempfile
import os


# ---------------------------------------------------------------------------
# Session-scoped in-memory DB override — applies to all tests, including those
# that use the module-level TestClient(app) pattern in test_cron.py.
# ---------------------------------------------------------------------------

_session_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(bind=_session_engine)
_SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=_session_engine)


def _override_get_db():
    db = _SessionFactory()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


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
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_agent_data():
    """Sample agent data for testing"""
    return {
        "name": "Test Agent",
        "description": "A test agent for unit testing",
        "primary_role": "assistant",
        "capabilities": {
            "reasoning": 0.8,
            "creativity": 0.7,
            "technical": 0.9,
            "communication": 0.85
        },
        "project_id": "test-project-123",
        "security_policy": {
            "sandboxed": True,
            "max_memory": "512MB"
        },
        "constraints": {
            "max_execution_time": 300
        }
    }