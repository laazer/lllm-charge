"""
SQLAlchemy models for main entities (projects, specs)
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class Project(Base):
    """Project model for organizing work"""
    
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Project metadata
    key = Column(String(50))
    type = Column(String(100))
    lead = Column(String(255))
    
    # Configuration stored as JSON
    agent_config = Column(JSON)
    codegraph_path = Column(String)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    specifications = relationship("Specification", back_populates="project")
    
    def __repr__(self):
        return f"<Project(id='{self.id}', name='{self.name}')>"


class Specification(Base):
    """Specification model for requirements and tasks"""
    
    __tablename__ = "specs"
    
    id = Column(String, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default='draft')
    
    # Relationships
    project_id = Column(String, ForeignKey("projects.id"))
    assigned_agent = Column(String)
    
    # Metadata
    priority = Column(String(50))
    tags = Column(JSON)
    linked_classes = Column(JSON)
    linked_methods = Column(JSON)
    linked_tests = Column(JSON)
    comments = Column(JSON)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="specifications")
    
    def __repr__(self):
        return f"<Specification(id='{self.id}', title='{self.title}', status='{self.status}')>"


class Note(Base):
    """Note model for documentation and memory"""
    
    __tablename__ = "notes"
    
    id = Column(String, primary_key=True)
    title = Column(String(255), nullable=False)
    content = Column(Text)
    tags = Column(JSON)
    project_id = Column(String, ForeignKey("projects.id"))
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Note(id='{self.id}', title='{self.title}')>"


class Checkpoint(Base):
    """Agent / workflow checkpoint for memory and recovery (aligned with Node-era schema)."""

    __tablename__ = "checkpoints"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    label = Column(String(255), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Checkpoint(id='{self.id}', project_id='{self.project_id}')>"