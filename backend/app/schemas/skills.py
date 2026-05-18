"""
Pydantic schemas for Skill model
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime


class SkillBase(BaseModel):
    """Base skill fields for all schemas"""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=100)
    tags: Optional[List[str]] = Field(default_factory=list)

    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()


class SkillCreate(SkillBase):
    """Schema for creating a new skill"""
    project_id: Optional[str] = None
    status: str = Field(default="active")


class SkillUpdate(BaseModel):
    """Schema for updating a skill"""
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    project_id: Optional[str] = None
    status: Optional[str] = None

    @validator('title')
    def validate_title(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip() if v else None


class SkillResponse(SkillBase):
    """Schema for skill response with timestamps and metadata"""
    id: str
    project_id: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SkillListResponse(BaseModel):
    """Schema for paginated skill list response"""
    skills: List[SkillResponse]
    total: int
    page: int
    page_size: int
