"""
Pydantic schemas for specification management
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.database.models.specs import SpecStatus, SpecPriority


class SpecBase(BaseModel):
    """Base specification schema"""
    title: str = Field(..., min_length=1, max_length=500, description="Specification title")
    description: Optional[str] = Field(None, description="Specification description")
    status: SpecStatus = Field(default=SpecStatus.DRAFT, description="Specification status")
    priority: SpecPriority = Field(default=SpecPriority.MEDIUM, description="Specification priority")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    assigned_agent_id: Optional[str] = Field(None, description="Assigned agent ID")
    tags: Optional[List[str]] = Field(default_factory=list, description="Specification tags")
    linked_classes: Optional[List[str]] = Field(default_factory=list, description="Linked code classes")
    linked_methods: Optional[List[str]] = Field(default_factory=list, description="Linked code methods")
    linked_tests: Optional[List[str]] = Field(default_factory=list, description="Linked test files")
    comments: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Comments and notes")
    estimated_hours: Optional[int] = Field(None, ge=0, description="Estimated work hours")


class SpecCreate(SpecBase):
    """Schema for creating specifications"""
    
    @validator('title')
    def title_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Specification title cannot be empty')
        return v.strip()


class SpecUpdate(BaseModel):
    """Schema for updating specifications"""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[SpecStatus] = None
    priority: Optional[SpecPriority] = None
    assigned_agent_id: Optional[str] = None
    tags: Optional[List[str]] = None
    linked_classes: Optional[List[str]] = None
    linked_methods: Optional[List[str]] = None
    linked_tests: Optional[List[str]] = None
    comments: Optional[List[Dict[str, Any]]] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    estimated_hours: Optional[int] = Field(None, ge=0)
    actual_hours: Optional[int] = Field(None, ge=0)
    
    @validator('title')
    def title_must_not_be_empty(cls, v):
        if v and not v.strip():
            raise ValueError('Specification title cannot be empty')
        return v.strip() if v else None


class SpecResponse(SpecBase):
    """Schema for specification responses"""
    id: str
    progress_percentage: Optional[int] = Field(default=0, description="Completion percentage")
    actual_hours: Optional[int] = Field(None, description="Actual work hours")
    created_at: datetime
    updated_at: datetime
    
    # Related entity names for display
    project_name: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    
    class Config:
        orm_mode = True
        from_attributes = True


class SpecListResponse(BaseModel):
    """Schema for paginated specification list responses"""
    specs: List[SpecResponse]
    total: int
    page: int
    page_size: int


class SpecMetrics(BaseModel):
    """Schema for specification metrics"""
    total_specs: int
    draft_specs: int
    active_specs: int
    completed_specs: int
    cancelled_specs: int
    avg_completion_percentage: float
    total_estimated_hours: int
    total_actual_hours: int
    
    class Config:
        orm_mode = True


class SpecComment(BaseModel):
    """Schema for specification comments"""
    author: str = Field(..., description="Comment author")
    content: str = Field(..., min_length=1, description="Comment content")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Comment timestamp")
    
    @validator('content')
    def content_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Comment content cannot be empty')
        return v.strip()