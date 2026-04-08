"""
SQLAlchemy models for agent management
"""
import uuid

from sqlalchemy import Column, String, Text, JSON, Enum as SQLEnum, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base
import enum


class AgentStatus(enum.Enum):
    """Agent status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRAINING = "training"
    DEPLOYED = "deployed"
    ERROR = "error"


class AgentRole(enum.Enum):
    """Agent role enumeration"""
    ARCHITECT = "architect"
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATA = "data"
    QA = "qa"
    SECURITY = "security"
    DOCUMENTATION = "documentation"
    MANAGER = "manager"
    ANALYST = "analyst"
    ASSISTANT = "assistant"


class Agent(Base):
    """Agent model for AI agents in the system"""
    
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    primary_role = Column(String)
    status = Column(String, nullable=False, default=AgentStatus.ACTIVE.value)
    capabilities = Column(JSON)  # reasoning, creativity, technical, communication
    config = Column(JSON, default=dict)
    project_id = Column(String, nullable=True)  # null = independent agent
    security_policy = Column(JSON)
    constraints = Column(JSON)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_active = Column(DateTime)
    
    # Relationships
    tasks = relationship("AgentTask", back_populates="agent")
    learning_records = relationship("AgentLearning", back_populates="agent")
    collaborations = relationship("AgentCollaboration", back_populates="agent")
    
    def __repr__(self):
        return f"<Agent(id={self.id}, name={self.name}, role={self.primary_role})>"


class AgentTask(Base):
    """Agent task execution tracking"""
    __tablename__ = "agent_tasks"
    
    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id"))
    task_type = Column(String)
    input_data = Column(JSON)
    output_data = Column(JSON)
    status = Column(String)  # pending, running, completed, failed
    execution_time = Column(Integer)  # milliseconds
    quality_score = Column(String)  # quality rating
    created_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    
    # Relationships
    agent = relationship("Agent", back_populates="tasks")
    
    def __repr__(self):
        return f"<AgentTask(id={self.id}, type={self.task_type}, status={self.status})>"


class AgentLearning(Base):
    """Agent learning and improvement tracking"""
    __tablename__ = "agent_learning"
    
    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id"))
    learning_type = Column(String)  # feedback, pattern_recognition, skill_improvement
    input_context = Column(JSON)
    learned_pattern = Column(JSON)
    confidence_score = Column(String)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="learning_records")
    
    def __repr__(self):
        return f"<AgentLearning(id={self.id}, type={self.learning_type})>"


class AgentCollaboration(Base):
    """Agent collaboration and communication tracking"""
    __tablename__ = "agent_collaborations"
    
    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id"))
    collaborator_id = Column(String)  # other agent ID
    collaboration_type = Column(String)  # task_handoff, knowledge_sharing, joint_execution
    context_data = Column(JSON)
    outcome = Column(JSON)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="collaborations")
    
    def __repr__(self):
        return f"<AgentCollaboration(id={self.id}, type={self.collaboration_type})>"