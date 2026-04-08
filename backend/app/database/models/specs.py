"""
Specification database models
"""
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from app.database.base import Base
from app.database.mixins import BaseModel, TimestampMixin
from enum import Enum


class SpecStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class SpecPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Spec(Base, BaseModel, TimestampMixin):
    """Specification model"""
    __tablename__ = "specs"
    
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)
    status = Column(String(20), default=SpecStatus.DRAFT, nullable=False, index=True)
    priority = Column(String(20), default=SpecPriority.MEDIUM, nullable=False, index=True)
    
    # Project relationship
    project_id = Column(String(255), ForeignKey("projects.id"), nullable=True, index=True)
    project = relationship("Project", back_populates="specs")
    
    # Agent assignment
    assigned_agent_id = Column(String(255), ForeignKey("agents.id"), nullable=True, index=True)
    assigned_agent = relationship("Agent", back_populates="assigned_specs")
    
    # Metadata
    tags = Column(SQLiteJSON, default=list)
    linked_classes = Column(SQLiteJSON, default=list)
    linked_methods = Column(SQLiteJSON, default=list) 
    linked_tests = Column(SQLiteJSON, default=list)
    comments = Column(SQLiteJSON, default=list)
    
    # Progress tracking
    progress_percentage = Column(Integer, default=0)
    estimated_hours = Column(Integer)
    actual_hours = Column(Integer)
    
    def __repr__(self):
        return f"<Spec(id={self.id}, title={self.title[:50]}..., status={self.status})>"