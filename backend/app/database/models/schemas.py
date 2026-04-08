"""
Pydantic schemas for request/response validation
"""
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, validator, Field
from enum import Enum


class AgentStatus(str, Enum):
    """Agent status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRAINING = "training"
    DEPLOYED = "deployed"
    ERROR = "error"


class AgentRole(str, Enum):
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


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common fields"""
    
    class Config:
        from_attributes = True
        use_enum_values = True


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields"""
    created_at: datetime
    updated_at: Optional[datetime] = None


# Project schemas
class ProjectBase(BaseSchema):
    """Base project schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    key: Optional[str] = Field(None, max_length=50)
    type: Optional[str] = Field(None, max_length=100)
    lead: Optional[str] = Field(None, max_length=255)
    agent_config: Optional[Dict[str, Any]] = None
    codegraph_path: Optional[str] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a project"""
    pass


class ProjectUpdate(BaseSchema):
    """Schema for updating a project"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    key: Optional[str] = Field(None, max_length=50)
    type: Optional[str] = Field(None, max_length=100)
    lead: Optional[str] = Field(None, max_length=255)
    agent_config: Optional[Dict[str, Any]] = None
    codegraph_path: Optional[str] = None


class Project(ProjectBase, TimestampSchema):
    """Complete project schema"""
    id: str


# Specification schemas
class SpecificationBase(BaseSchema):
    """Base specification schema"""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="draft", max_length=50)
    project_id: Optional[str] = None
    assigned_agent: Optional[str] = None
    priority: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None
    linked_classes: Optional[List[str]] = None
    linked_methods: Optional[List[str]] = None
    linked_tests: Optional[List[str]] = None
    comments: Optional[List[Dict[str, Any]]] = None


class SpecificationCreate(SpecificationBase):
    """Schema for creating a specification"""
    pass


class SpecificationUpdate(BaseSchema):
    """Schema for updating a specification"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    assigned_agent: Optional[str] = None
    priority: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None
    linked_classes: Optional[List[str]] = None
    linked_methods: Optional[List[str]] = None
    linked_tests: Optional[List[str]] = None
    comments: Optional[List[Dict[str, Any]]] = None


class Specification(SpecificationBase, TimestampSchema):
    """Complete specification schema"""
    id: str


# Agent schemas
class AgentCapabilities(BaseSchema):
    """Agent capabilities schema"""
    reasoning: float = Field(..., ge=0.0, le=1.0)
    creativity: float = Field(..., ge=0.0, le=1.0)
    technical: float = Field(..., ge=0.0, le=1.0)
    communication: float = Field(..., ge=0.0, le=1.0)


class AgentBase(BaseSchema):
    """Base agent schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    primary_role: Optional[str] = None
    capabilities: Optional[AgentCapabilities] = None
    project_id: Optional[str] = None
    security_policy: Optional[Dict[str, Any]] = None
    constraints: Optional[Dict[str, Any]] = None
    
    @validator('capabilities', pre=True)
    def parse_capabilities(cls, v):
        """Parse capabilities from dict to AgentCapabilities"""
        if isinstance(v, dict):
            return AgentCapabilities(**v)
        return v


class AgentCreate(AgentBase):
    """Schema for creating an agent"""
    pass


class AgentUpdate(BaseSchema):
    """Schema for updating an agent"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    primary_role: Optional[str] = None
    capabilities: Optional[AgentCapabilities] = None
    project_id: Optional[str] = None
    security_policy: Optional[Dict[str, Any]] = None
    constraints: Optional[Dict[str, Any]] = None


class Agent(AgentBase, TimestampSchema):
    """Complete agent schema"""
    id: str
    last_active: Optional[datetime] = None


# Flow schemas
class FlowBase(BaseSchema):
    """Base flow schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    type: Optional[str] = None
    status: str = Field(default="draft")
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None
    triggers: Optional[List[Dict[str, Any]]] = None


class FlowCreate(FlowBase):
    """Schema for creating a flow"""
    pass


class FlowUpdate(BaseSchema):
    """Schema for updating a flow"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    type: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None
    triggers: Optional[List[Dict[str, Any]]] = None


class Flow(FlowBase, TimestampSchema):
    """Complete flow schema"""
    id: str


# Note schemas
class NoteBase(BaseSchema):
    """Base note schema"""
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    project_id: Optional[str] = None


class NoteCreate(NoteBase):
    """Schema for creating a note"""
    pass


class NoteUpdate(BaseSchema):
    """Schema for updating a note"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    tags: Optional[List[str]] = None


class Note(NoteBase, TimestampSchema):
    """Complete note schema"""
    id: str


# Metrics schemas
class RequestMetricBase(BaseSchema):
    """Base request metric schema"""
    request_type: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    response_time: Optional[float] = Field(None, ge=0.0)
    tokens_input: Optional[int] = Field(None, ge=0)
    tokens_output: Optional[int] = Field(None, ge=0)
    cost: Optional[float] = Field(None, ge=0.0)
    success: str = Field(default="true")
    error_message: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class RequestMetricCreate(RequestMetricBase):
    """Schema for creating a request metric"""
    pass


class RequestMetric(RequestMetricBase, TimestampSchema):
    """Complete request metric schema"""
    id: str


# Response schemas
class HealthResponse(BaseSchema):
    """Health check response schema"""
    status: str
    timestamp: datetime
    version: Optional[str] = None
    database: bool
    services: Dict[str, bool]


class ErrorResponse(BaseSchema):
    """Error response schema"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class PaginatedResponse(BaseSchema):
    """Paginated response schema"""
    items: List[Any]
    total: int
    page: int = Field(..., ge=1)
    size: int = Field(..., ge=1, le=100)
    pages: int


# Validation helpers
def validate_json_field(v):
    """Validate JSON fields"""
    if v is None:
        return v
    if isinstance(v, (dict, list)):
        return v
    raise ValueError("Field must be a valid JSON object or array")


def validate_id_format(v):
    """Validate ID format"""
    if not v or not isinstance(v, str) or len(v.strip()) == 0:
        raise ValueError("ID must be a non-empty string")
    return v.strip()


def validate_percentage(v):
    """Validate percentage values"""
    if v is not None and (v < 0.0 or v > 100.0):
        raise ValueError("Percentage must be between 0.0 and 100.0")
    return v


def validate_score(v):
    """Validate score values (0.0-1.0)"""
    if v is not None and (v < 0.0 or v > 1.0):
        raise ValueError("Score must be between 0.0 and 1.0")
    return v