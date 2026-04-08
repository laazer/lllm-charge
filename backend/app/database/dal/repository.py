"""
Repository pattern implementation for database access
"""
from typing import Generic, TypeVar, Type, Optional, List, Dict, Any, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime

from .base_dal import BaseDAL

# Generic types
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base repository providing high-level database operations
    Built on top of BaseDAL for enhanced functionality
    """
    
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        """
        Initialize repository with model and database session
        
        Args:
            model: SQLAlchemy model class
            db: Async database session
        """
        self.model = model
        self.db = db
        self.dal = BaseDAL[ModelType, CreateSchemaType, UpdateSchemaType](model, db)

    async def create(self, obj_in: CreateSchemaType) -> ModelType:
        """Create new entity"""
        return await self.dal.create(obj_in=obj_in)

    async def get_by_id(self, entity_id: str) -> Optional[ModelType]:
        """Get entity by ID"""
        return await self.dal.get(entity_id)

    async def get_by_field(self, field_name: str, value: Any) -> Optional[ModelType]:
        """
        Get entity by specific field value
        
        Args:
            field_name: Name of the field to query
            value: Value to match
            
        Returns:
            First matching entity or None
        """
        if not hasattr(self.model, field_name):
            return None
            
        field = getattr(self.model, field_name)
        query = select(self.model).where(field == value)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_multi_by_field(self, field_name: str, value: Any) -> List[ModelType]:
        """
        Get multiple entities by specific field value
        
        Args:
            field_name: Name of the field to query
            value: Value to match
            
        Returns:
            List of matching entities
        """
        if not hasattr(self.model, field_name):
            return []
            
        field = getattr(self.model, field_name)
        query = select(self.model).where(field == value)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def search(
        self,
        query_string: str,
        search_fields: List[str],
        limit: int = 50
    ) -> List[ModelType]:
        """
        Search entities across multiple text fields
        
        Args:
            query_string: Text to search for
            search_fields: List of field names to search in
            limit: Maximum number of results
            
        Returns:
            List of matching entities
        """
        if not query_string or not search_fields:
            return []
        
        search_pattern = f"%{query_string}%"
        search_conditions = []
        
        for field_name in search_fields:
            if hasattr(self.model, field_name):
                field = getattr(self.model, field_name)
                search_conditions.append(field.ilike(search_pattern))
        
        if not search_conditions:
            return []
        
        query = select(self.model).where(or_(*search_conditions)).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        order_desc: bool = False
    ) -> Dict[str, Any]:
        """
        Get paginated results with metadata
        
        Args:
            page: Page number (1-based)
            page_size: Number of items per page
            filters: Optional filters to apply
            order_by: Field to order by
            order_desc: Whether to order in descending order
            
        Returns:
            Dictionary with items, pagination metadata
        """
        # Calculate offset
        skip = (page - 1) * page_size
        
        # Get total count
        total = await self.dal.count(filters)
        
        # Get items
        items = await self.dal.get_multi(
            skip=skip,
            limit=page_size,
            filters=filters,
            order_by=order_by,
            order_desc=order_desc
        )
        
        # Calculate pagination metadata
        total_pages = (total + page_size - 1) // page_size
        has_next = page < total_pages
        has_prev = page > 1
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": has_next,
            "has_prev": has_prev
        }

    async def update(self, entity_id: str, obj_in: UpdateSchemaType) -> Optional[ModelType]:
        """Update entity"""
        return await self.dal.update(entity_id=entity_id, obj_in=obj_in)

    async def delete(self, entity_id: str) -> bool:
        """Hard delete entity"""
        return await self.dal.delete(entity_id)

    async def soft_delete(self, entity_id: str) -> bool:
        """Soft delete entity"""
        return await self.dal.soft_delete(entity_id)

    async def bulk_create(self, objects: List[CreateSchemaType]) -> List[ModelType]:
        """
        Create multiple entities in bulk
        
        Args:
            objects: List of creation schemas
            
        Returns:
            List of created entities
        """
        db_objects = []
        for obj_in in objects:
            obj_data = obj_in.dict() if hasattr(obj_in, 'dict') else obj_in
            db_obj = self.model(**obj_data)
            db_objects.append(db_obj)
        
        self.db.add_all(db_objects)
        await self.db.commit()
        
        # Refresh all objects
        for db_obj in db_objects:
            await self.db.refresh(db_obj)
        
        return db_objects

    async def bulk_update(
        self,
        updates: List[Dict[str, Any]],
        filter_field: str = "id"
    ) -> bool:
        """
        Update multiple entities in bulk
        
        Args:
            updates: List of update dictionaries with filter field and updates
            filter_field: Field to use for filtering (default: "id")
            
        Returns:
            True if successful
        """
        if not updates:
            return True
        
        # Group updates by entity
        for update_data in updates:
            if filter_field not in update_data:
                continue
            
            filter_value = update_data.pop(filter_field)
            
            # Add updated timestamp if model supports it
            if hasattr(self.model, 'updated_at'):
                update_data['updated_at'] = datetime.utcnow()
            
            # Execute update
            from sqlalchemy import update as sql_update
            query = (
                sql_update(self.model)
                .where(getattr(self.model, filter_field) == filter_value)
                .values(**update_data)
            )
            await self.db.execute(query)
        
        await self.db.commit()
        return True

    async def exists(self, entity_id: str) -> bool:
        """Check if entity exists"""
        return await self.dal.exists(entity_id)

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count entities with optional filters"""
        return await self.dal.count(filters)