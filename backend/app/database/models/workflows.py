"""
Workflow database models
"""
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from app.database.base import Base
from app.database.mixins import BaseModel, TimestampMixin
from enum import Enum


class WorkflowStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class WorkflowType(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    SCHEDULED = "scheduled"
    EVENT_DRIVEN = "event_driven"


class Workflow(Base, BaseModel, TimestampMixin):
    """Workflow model"""
    __tablename__ = "workflows"
    
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    status = Column(String(20), default=WorkflowStatus.DRAFT, nullable=False, index=True)
    workflow_type = Column(String(20), default=WorkflowType.MANUAL, nullable=False)
    
    # Project relationship
    project_id = Column(String(255), ForeignKey("projects.id"), nullable=True, index=True)
    project = relationship("Project")
    
    # Workflow definition
    nodes = Column(SQLiteJSON, default=list)  # Visual workflow nodes
    edges = Column(SQLiteJSON, default=list)  # Node connections
    triggers = Column(SQLiteJSON, default=list)  # Trigger configuration
    settings = Column(SQLiteJSON, default=dict)  # Workflow settings
    
    # Execution tracking
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    last_execution = Column(DateTime)
    average_duration = Column(Integer)  # Average execution time in seconds
    
    # Configuration
    is_enabled = Column(Boolean, default=True)
    max_retries = Column(Integer, default=3)
    timeout_seconds = Column(Integer, default=3600)
    
    # Relationships
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Workflow(id={self.id}, name={self.name}, status={self.status})>"


class WorkflowExecution(Base, BaseModel, TimestampMixin):
    """Workflow execution history"""
    __tablename__ = "workflow_executions"
    
    workflow_id = Column(String(255), ForeignKey("workflows.id"), nullable=False, index=True)
    workflow = relationship("Workflow", back_populates="executions")
    
    status = Column(String(20), nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    
    # Execution context
    input_data = Column(SQLiteJSON, default=dict)
    output_data = Column(SQLiteJSON, default=dict)
    error_message = Column(Text)
    execution_log = Column(SQLiteJSON, default=list)
    
    # Node execution tracking
    node_results = Column(SQLiteJSON, default=dict)
    current_node = Column(String(255))
    
    def __repr__(self):
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status={self.status})>"