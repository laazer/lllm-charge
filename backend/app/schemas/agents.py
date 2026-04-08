"""
Pydantic schemas for agent API validation
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class AgentRole(str, Enum):
    """Agent role enumeration for API"""
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


class AgentStatus(str, Enum):
    """Agent status enumeration for API"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRAINING = "training"
    DEPLOYED = "deployed"
    ERROR = "error"


class AgentCapabilities(BaseModel):
    """Agent capabilities schema"""
    reasoning: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="Reasoning capability score")
    creativity: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="Creativity capability score")
    technical: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="Technical capability score")
    communication: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="Communication capability score")


class AgentBase(BaseModel):
    """Base agent schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Agent name")
    description: Optional[str] = Field(None, max_length=2000, description="Agent description")
    primary_role: AgentRole = Field(..., description="Primary role of the agent")
    capabilities: Optional[AgentCapabilities] = Field(default_factory=AgentCapabilities, description="Agent capabilities")


class AgentCreate(AgentBase):
    """Schema for creating a new agent"""
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Agent configuration")
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Agent name cannot be empty')
        return v.strip()


class AgentUpdate(BaseModel):
    """Schema for updating an agent"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    primary_role: Optional[AgentRole] = None
    status: Optional[AgentStatus] = None
    capabilities: Optional[AgentCapabilities] = None
    config: Optional[Dict[str, Any]] = None
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Agent name cannot be empty')
        return v.strip() if v else v


class AgentResponse(AgentBase):
    """Schema for agent API responses"""
    id: str = Field(..., description="Agent ID")
    status: AgentStatus = Field(..., description="Agent status")
    task_count: int = Field(0, ge=0, description="Number of tasks completed")
    success_rate: float = Field(0.0, ge=0.0, le=1.0, description="Task success rate")
    avg_response_time: float = Field(0.0, ge=0.0, description="Average response time in seconds")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Agent configuration")
    
    class Config:
        from_attributes = True  # Enables ORM mode for SQLAlchemy models


class AgentListResponse(BaseModel):
    """Schema for agent list responses"""
    agents: list[AgentResponse] = Field(..., description="List of agents")
    total: int = Field(..., ge=0, description="Total number of agents")
    page: int = Field(1, ge=1, description="Current page number")
    page_size: int = Field(10, ge=1, le=100, description="Number of items per page")


class AgentMetrics(BaseModel):
    """Schema for agent performance metrics"""
    total_agents: int = Field(0, ge=0, description="Total number of agents")
    active_agents: int = Field(0, ge=0, description="Number of active agents")
    avg_success_rate: float = Field(0.0, ge=0.0, le=1.0, description="Average success rate across all agents")
    total_tasks: int = Field(0, ge=0, description="Total tasks across all agents")
    avg_response_time: float = Field(0.0, ge=0.0, description="Average response time across all agents")