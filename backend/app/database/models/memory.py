"""SQLAlchemy models for the memory note and checkpoint system."""
from sqlalchemy import Column, String, Text

from app.database.models.base import BaseModel


class MemoryNote(BaseModel):
    """A persistent note with tags for later retrieval."""

    __tablename__ = "memory_notes"

    title = Column(String, nullable=False)
    content = Column(Text, default="")
    tags = Column(Text, default="")   # comma-separated tag list


class MemoryCheckpoint(BaseModel):
    """A named snapshot of context saved at a point in time."""

    __tablename__ = "memory_checkpoints"

    label = Column(String, nullable=False)
    context_snapshot = Column(Text, default="{}")
