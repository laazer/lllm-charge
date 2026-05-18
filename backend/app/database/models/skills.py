"""
Skill model for reusable agent capabilities
"""
from sqlalchemy import Column, String, Text, JSON
from .base import BaseModel


class Skill(BaseModel):
    """Skill model representing reusable agent capabilities

    Skills are global resources that can be assigned to agents or projects.
    They have categories, tags, and optional project scoping.
    """
    __tablename__ = "skills"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=False)  # documentation, analysis, integration, optimization, automation, general
    tags = Column(JSON, nullable=True, default=list)
    project_id = Column(String, nullable=True)  # null = global skill, set = project-specific
    status = Column(String, nullable=False, default="active")  # active, archived, deprecated
