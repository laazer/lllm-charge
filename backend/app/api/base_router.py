"""
Base router class for API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
import logging

logger = logging.getLogger("llm-charge")


class BaseRouter:
    """Base router class with common functionality"""
    
    def __init__(self, prefix: str = "", tags: list = None):
        self.router = APIRouter(prefix=prefix, tags=tags or [])
        self.setup_routes()
    
    def setup_routes(self):
        """Override in subclasses to define routes"""
        pass
    
    def get_database_session(self, db: Session = Depends(get_db)):
        """Get database session dependency"""
        return db
    
    def handle_database_error(self, e: Exception, operation: str):
        """Standard database error handling"""
        logger.error(f"Database error during {operation}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error during {operation}"
        )
    
    def validate_request(self, data: dict, required_fields: list):
        """Validate request data"""
        for field in required_fields:
            if field not in data:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: {field}"
                )