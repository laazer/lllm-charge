"""
ORM smoke tests aligned with actual SQLAlchemy models.
"""
import os
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.database import Base
import app.database.models.main  # noqa: F401
import app.database.models.agents  # noqa: F401
import app.database.models.flows  # noqa: F401
import app.database.models.metrics  # noqa: F401

from app.database.models.main import Project, Specification, Checkpoint
from app.database.models.agents import Agent
from app.database.models.flows import Flow
from app.database.models.schemas import ProjectCreate, SpecificationCreate


@pytest.fixture
def test_db_engine():
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()
    os.unlink(db_path)


@pytest.fixture
def test_session(test_db_engine):
    SessionLocal = sessionmaker(bind=test_db_engine)
    session = SessionLocal()
    yield session
    session.close()


def test_project_crud(test_session):
    project = Project(
        id="test-project-001",
        name="Test Project",
        key="TEST",
        description="desc",
        type="software",
        lead="lead",
    )
    test_session.add(project)
    test_session.commit()

    got = test_session.query(Project).filter(Project.id == "test-project-001").first()
    assert got is not None
    assert got.name == "Test Project"
    assert got.key == "TEST"


def test_specification_with_project(test_session):
    test_session.add(
        Project(
            id="p1",
            name="P",
            key="K",
        )
    )
    spec = Specification(
        id="s1",
        title="Spec",
        description="d",
        status="draft",
        project_id="p1",
    )
    test_session.add(spec)
    test_session.commit()

    got = test_session.query(Specification).filter(Specification.id == "s1").first()
    assert got.project_id == "p1"


def test_agent_defaults_status(test_session):
    agent = Agent(id="a1", name="Agent One", primary_role="assistant")
    test_session.add(agent)
    test_session.commit()
    got = test_session.query(Agent).filter(Agent.id == "a1").first()
    assert got.status == "active"


def test_checkpoint_row(test_session):
    test_session.add(Project(id="p2", name="P2", key="K2"))
    cp = Checkpoint(id="c1", project_id="p2", label="snap", payload={"x": 1})
    test_session.add(cp)
    test_session.commit()
    got = test_session.query(Checkpoint).filter(Checkpoint.id == "c1").first()
    assert got.payload == {"x": 1}


def test_flow_json_fields(test_session):
    flow = Flow(
        id="f1",
        name="Flow",
        nodes=[],
        edges=[],
        type="workflow",
        status="draft",
    )
    test_session.add(flow)
    test_session.commit()
    got = test_session.query(Flow).filter(Flow.id == "f1").first()
    assert got.nodes == []


def test_pydantic_project_create_roundtrip_fields():
    p = ProjectCreate(name="N", key="K", description="d")
    assert p.name == "N"
    assert p.key == "K"


def test_pydantic_specification_create():
    s = SpecificationCreate(title="T", project_id="p1")
    assert s.title == "T"
    assert s.status == "draft"
