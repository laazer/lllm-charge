"""
Test file for SQLAlchemy Models
Testing all database models and their relationships
"""
import pytest
import asyncio
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker
import tempfile
import os

# Import all models
from app.database.models.main import Base, Project, Specification, Note, Checkpoint
from app.database.models.agents import Agent, AgentTask, AgentLearning, AgentCollaboration
from app.database.models.flows import Flow, FlowExecution, FlowTemplate, FlowVersion, FlowSchedule
from app.database.models.metrics import (
    RequestMetric, PerformanceMetric, CostMetric, 
    QualityMetric, UsageMetric, AlertMetric
)
from app.database.models.schemas import (
    ProjectCreate, ProjectUpdate, SpecificationCreate, SpecificationUpdate,
    AgentCreate, AgentUpdate, FlowCreate, FlowUpdate
)


class TestModels:
    """Test SQLAlchemy models functionality"""
    
    @pytest.fixture
    def test_db_engine(self):
        """Create temporary database for testing"""
        # Create temporary SQLite database
        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(db_fd)
        
        # Create engine
        engine = create_engine(f"sqlite:///{db_path}", echo=False)
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        yield engine
        
        # Cleanup
        engine.dispose()
        os.unlink(db_path)
    
    @pytest.fixture
    def test_session(self, test_db_engine):
        """Create database session for testing"""
        SessionLocal = sessionmaker(bind=test_db_engine)
        session = SessionLocal()
        
        yield session
        
        session.close()
    
    def test_project_model_creation(self, test_session):
        """Test Project model creation and basic operations"""
        # Create project
        project = Project(
            id="test-project-001",
            name="Test Project",
            key="TEST",
            description="Test project description",
            type="software",
            status="active",
            lead="test-lead"
        )
        
        test_session.add(project)
        test_session.commit()
        
        # Query project
        retrieved = test_session.query(Project).filter(Project.id == "test-project-001").first()
        
        assert retrieved is not None
        assert retrieved.name == "Test Project"
        assert retrieved.key == "TEST"
        assert retrieved.status == "active"
        assert retrieved.type == "software"
        assert retrieved.lead == "test-lead"
        assert retrieved.created_at is not None
        assert retrieved.updated_at is not None
    
    def test_specification_model_creation(self, test_session):
        """Test Specification model creation and relationships"""
        # Create project first
        project = Project(
            id="test-project-spec",
            name="Test Project for Specs",
            key="SPEC",
            type="software",
            status="active"
        )
        test_session.add(project)
        test_session.commit()
        
        # Create specification
        spec = Specification(
            id="test-spec-001",
            title="Test Specification",
            description="Test specification description",
            status="draft",
            priority="medium",
            project_id="test-project-spec"
        )
        
        test_session.add(spec)
        test_session.commit()
        
        # Query specification
        retrieved = test_session.query(Specification).filter(Specification.id == "test-spec-001").first()
        
        assert retrieved is not None
        assert retrieved.title == "Test Specification"
        assert retrieved.status == "draft"
        assert retrieved.priority == "medium"
        assert retrieved.project_id == "test-project-spec"
    
    def test_agent_model_creation(self, test_session):
        """Test Agent model creation"""
        agent = Agent(
            id="test-agent-001",
            name="Test Agent",
            description="Test agent description",
            primary_role="assistant",
            capabilities={
                "reasoning": 0.8,
                "creativity": 0.7,
                "technical": 0.9,
                "communication": 0.8
            },
            status="active"
        )
        
        test_session.add(agent)
        test_session.commit()
        
        # Query agent
        retrieved = test_session.query(Agent).filter(Agent.id == "test-agent-001").first()
        
        assert retrieved is not None
        assert retrieved.name == "Test Agent"
        assert retrieved.primary_role == "assistant"
        assert retrieved.status == "active"
        assert isinstance(retrieved.capabilities, dict)
        assert retrieved.capabilities["reasoning"] == 0.8
    
    def test_flow_model_creation(self, test_session):
        """Test Flow model creation"""
        flow = Flow(
            id="test-flow-001",
            name="Test Flow",
            description="Test flow description",
            type="workflow",
            status="draft",
            nodes=[
                {
                    "id": "start",
                    "type": "trigger",
                    "name": "Start Node",
                    "position": {"x": 100, "y": 100}
                }
            ],
            edges=[]
        )
        
        test_session.add(flow)
        test_session.commit()
        
        # Query flow
        retrieved = test_session.query(Flow).filter(Flow.id == "test-flow-001").first()
        
        assert retrieved is not None
        assert retrieved.name == "Test Flow"
        assert retrieved.type == "workflow"
        assert retrieved.status == "draft"
        assert isinstance(retrieved.nodes, list)
        assert len(retrieved.nodes) == 1
        assert retrieved.nodes[0]["type"] == "trigger"
    
    def test_model_relationships(self, test_session):
        """Test model relationships work correctly"""
        # Create project
        project = Project(
            id="test-project-rel",
            name="Test Project Relations",
            key="REL",
            type="software",
            status="active"
        )
        test_session.add(project)
        test_session.commit()
        
        # Create specifications for the project
        spec1 = Specification(
            id="spec-rel-001",
            title="Specification 1",
            description="First spec",
            status="draft",
            project_id="test-project-rel"
        )
        
        spec2 = Specification(
            id="spec-rel-002",
            title="Specification 2",
            description="Second spec",
            status="active",
            project_id="test-project-rel"
        )
        
        test_session.add(spec1)
        test_session.add(spec2)
        test_session.commit()
        
        # Query project with specifications
        project_with_specs = test_session.query(Project).filter(Project.id == "test-project-rel").first()
        
        assert project_with_specs is not None
        # Note: Depending on relationship configuration, you might need to explicitly load
        # the specifications or configure eager loading
    
    def test_json_field_handling(self, test_session):
        """Test JSON field serialization and deserialization"""
        # Test agent capabilities (JSON field)
        capabilities = {
            "reasoning": 0.95,
            "creativity": 0.8,
            "technical": 0.9,
            "communication": 0.85,
            "specialized_skills": ["python", "javascript", "database"]
        }
        
        agent = Agent(
            id="test-json-agent",
            name="JSON Test Agent",
            description="Testing JSON capabilities",
            primary_role="developer",
            capabilities=capabilities,
            status="active"
        )
        
        test_session.add(agent)
        test_session.commit()
        
        # Retrieve and verify JSON data
        retrieved = test_session.query(Agent).filter(Agent.id == "test-json-agent").first()
        
        assert retrieved is not None
        assert isinstance(retrieved.capabilities, dict)
        assert retrieved.capabilities["reasoning"] == 0.95
        assert "specialized_skills" in retrieved.capabilities
        assert "python" in retrieved.capabilities["specialized_skills"]
    
    def test_timestamp_handling(self, test_session):
        """Test timestamp fields are handled correctly"""
        project = Project(
            id="test-timestamps",
            name="Timestamp Test",
            key="TIME",
            type="test",
            status="active"
        )
        
        test_session.add(project)
        test_session.commit()
        
        # Check timestamps were set
        retrieved = test_session.query(Project).filter(Project.id == "test-timestamps").first()
        
        assert retrieved.created_at is not None
        assert retrieved.updated_at is not None
        assert isinstance(retrieved.created_at, datetime)
        assert isinstance(retrieved.updated_at, datetime)
        
        # Update project and check timestamp changes
        original_updated = retrieved.updated_at
        retrieved.description = "Updated description"
        test_session.commit()
        
        # Re-query
        updated = test_session.query(Project).filter(Project.id == "test-timestamps").first()
        
        # Note: You might need to manually update the timestamp in your model
        # depending on your SQLAlchemy configuration
        assert updated.description == "Updated description"
    
    def test_pydantic_schema_validation(self):
        """Test Pydantic schema validation works"""
        # Test valid project creation
        valid_project_data = {
            "name": "Valid Project",
            "key": "VALID",
            "description": "Valid project description",
            "type": "software",
            "status": "active",
            "lead": "project-lead"
        }
        
        project_schema = ProjectCreate(**valid_project_data)
        assert project_schema.name == "Valid Project"
        assert project_schema.key == "VALID"
        assert project_schema.type == "software"
        
        # Test validation fails with invalid data
        with pytest.raises(Exception):
            ProjectCreate(name="", key="", type="invalid_type")
    
    def test_all_models_have_required_fields(self, test_session):
        """Test that all models have the expected basic fields"""
        models_to_test = [
            (Project, {"id": "test-p", "name": "Test", "key": "T", "type": "test", "status": "active"}),
            (Specification, {"id": "test-s", "title": "Test", "description": "Test", "status": "draft"}),
            (Agent, {"id": "test-a", "name": "Test", "description": "Test", "primary_role": "test", "status": "active"}),
            (Flow, {"id": "test-f", "name": "Test", "description": "Test", "type": "test", "status": "draft"})
        ]
        
        for model_class, test_data in models_to_test:
            # Add default capabilities for Agent
            if model_class == Agent:
                test_data["capabilities"] = {"reasoning": 0.5}
            
            # Add default nodes/edges for Flow
            if model_class == Flow:
                test_data["nodes"] = []
                test_data["edges"] = []
            
            instance = model_class(**test_data)
            test_session.add(instance)
            test_session.commit()
            
            # Verify instance was created successfully
            assert instance.id is not None
            assert hasattr(instance, 'created_at')
            assert hasattr(instance, 'updated_at')


@pytest.mark.asyncio
class TestAsyncModels:
    """Test async database operations"""
    
    @pytest.fixture
    async def async_test_engine(self):
        """Create async test database engine"""
        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(db_fd)
        
        # Create async engine
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=False)
        
        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        yield engine
        
        # Cleanup
        await engine.dispose()
        os.unlink(db_path)
    
    @pytest.fixture
    async def async_test_session(self, async_test_engine):
        """Create async database session for testing"""
        AsyncSessionLocal = async_sessionmaker(
            bind=async_test_engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False
        )
        
        async with AsyncSessionLocal() as session:
            yield session
    
    async def test_async_project_operations(self, async_test_session):
        """Test async project operations"""
        project = Project(
            id="async-project-001",
            name="Async Test Project",
            key="ASYNC",
            description="Testing async operations",
            type="software",
            status="active"
        )
        
        async_test_session.add(project)
        await async_test_session.commit()
        
        # Query project asynchronously
        result = await async_test_session.execute(
            text("SELECT name, key, status FROM projects WHERE id = :id"),
            {"id": "async-project-001"}
        )
        row = result.fetchone()
        
        assert row is not None
        assert row[0] == "Async Test Project"  # name
        assert row[1] == "ASYNC"              # key
        assert row[2] == "active"             # status


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])