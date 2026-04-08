"""
Pydantic schemas for project management
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.database.models.projects import ProjectStatus, ProjectType


class ProjectBase(BaseModel):
    """Base project schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    key: Optional[str] = Field(None, max_length=50, description="Project key/identifier")
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE, description="Project status")
    project_type: ProjectType = Field(default=ProjectType.SOFTWARE, description="Project type")
    lead: Optional[str] = Field(None, max_length=255, description="Project lead")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Project configuration")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Project metadata")


class ProjectCreate(ProjectBase):
    """Schema for creating projects"""
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Project name cannot be empty')
        return v.strip()
    
    @validator('key')
    def key_must_be_valid(cls, v):
        if v and not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Project key must be alphanumeric (with hyphens/underscores)')
        return v


class ProjectUpdate(BaseModel):
    """Schema for updating projects"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    project_type: Optional[ProjectType] = None
    lead: Optional[str] = Field(None, max_length=255)
    config: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if v and not v.strip():
            raise ValueError('Project name cannot be empty')
        return v.strip() if v else None


class ProjectResponse(ProjectBase):
    """Schema for project responses"""
    id: str
    specs_count: Optional[int] = Field(default=0, description="Number of specifications")
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Schema for paginated project list responses"""
    projects: List[ProjectResponse]
    total: int
    page: int
    page_size: int


class ProjectMetrics(BaseModel):
    """Schema for project metrics"""
    total_projects: int
    active_projects: int
    completed_projects: int
    total_specs: int
    avg_specs_per_project: float
    
    class Config:
        orm_mode = True