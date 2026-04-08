"""
Project database models
"""
from sqlalchemy import Column, String, Text, JSON, ForeignKey, DateTime, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from app.database.base import Base
from app.database.mixins import BaseModel, TimestampMixin
from enum import Enum


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectType(str, Enum):
    SOFTWARE = "software"
    RESEARCH = "research"
    DEMO = "demo"
    INFRASTRUCTURE = "infrastructure"


class Project(Base, BaseModel, TimestampMixin):
    """Project model"""
    __tablename__ = "projects"
    
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    key = Column(String(50), unique=True, index=True)
    status = Column(String(20), default=ProjectStatus.ACTIVE, nullable=False, index=True)
    project_type = Column(String(20), default=ProjectType.SOFTWARE, nullable=False)
    lead = Column(String(255))
    
    # Configuration and metadata
    config = Column(SQLiteJSON, default=dict)
    metadata = Column(SQLiteJSON, default=dict)
    
    # Relationships
    specs = relationship("Spec", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, status={self.status})>"