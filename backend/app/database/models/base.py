"""
Base model classes and mixins for database models
"""
from sqlalchemy import Column, String, DateTime
from sqlalchemy.ext.declarative import declared_attr
from datetime import datetime
import uuid


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class UUIDMixin:
    """Mixin for UUID primary key"""
    
    @declared_attr
    def id(cls):
        return Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))


class BaseModel(UUIDMixin, TimestampMixin):
    """Base model with UUID and timestamps"""
    pass