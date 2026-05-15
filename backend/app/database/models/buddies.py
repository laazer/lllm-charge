"""SQLAlchemy models for buddy chat agents and their message history."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database.models.base import BaseModel


class Buddy(BaseModel):
    """Persistent AI buddy with a persona and conversation history."""

    __tablename__ = "buddies"

    name = Column(String, nullable=False)
    role = Column(String, default="assistant")
    persona = Column(Text, default="")
    model = Column(String, default="")
    message_count = Column(Integer, default=0, nullable=False)


class BuddyMessage(BaseModel):
    """A single turn in a buddy's conversation history."""

    __tablename__ = "buddy_messages"

    buddy_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
