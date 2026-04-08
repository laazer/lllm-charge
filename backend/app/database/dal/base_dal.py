"""
Base Data Access Layer providing common CRUD operations
"""
from typing import Generic, TypeVar, Type, Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, desc, asc, func
from sqlalchemy.orm import selectinload
from datetime import datetime

# Generic type for database models
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class BaseDAL(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base Data Access Layer with common CRUD operations"""
    
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        """
        Initialize with model class and database session
        
        Args:
            model: SQLAlchemy model class
            db: Async database session
        """
        self.model = model
        self.db = db

    async def create(self, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Create new entity
        
        Args:
            obj_in: Pydantic schema for creating entity
            
        Returns:
            Created entity
        """
        obj_data = obj_in.dict() if hasattr(obj_in, 'dict') else obj_in
        db_obj = self.model(**obj_data)
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def get(self, entity_id: str) -> Optional[ModelType]:
        """
        Get entity by ID
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            Entity if found, None otherwise
        """
        query = select(self.model).where(self.model.id == entity_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        order_desc: bool = False
    ) -> List[ModelType]:
        """
        Get multiple entities with filtering and pagination
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Dictionary of field filters
            order_by: Field name to order by
            order_desc: Whether to order in descending order
            
        Returns:
            List of entities
        """
        query = select(self.model)
        
        # Apply filters
        if filters:
            filter_conditions = []
            for field, value in filters.items():
                if hasattr(self.model, field):
                    model_field = getattr(self.model, field)
                    if isinstance(value, list):
                        # IN clause for list values
                        filter_conditions.append(model_field.in_(value))
                    elif isinstance(value, str) and value.startswith('%') and value.endswith('%'):
                        # LIKE clause for patterns
                        filter_conditions.append(model_field.like(value))
                    else:
                        # Exact match
                        filter_conditions.append(model_field == value)
            
            if filter_conditions:
                query = query.where(and_(*filter_conditions))
        
        # Apply ordering
        if order_by and hasattr(self.model, order_by):
            order_field = getattr(self.model, order_by)
            if order_desc:
                query = query.order_by(desc(order_field))
            else:
                query = query.order_by(asc(order_field))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(self, *, entity_id: str, obj_in: UpdateSchemaType) -> Optional[ModelType]:
        """
        Update entity by ID
        
        Args:
            entity_id: Entity identifier
            obj_in: Pydantic schema for updating entity
            
        Returns:
            Updated entity if found, None otherwise
        """
        # Get current entity
        db_obj = await self.get(entity_id)
        if not db_obj:
            return None
        
        # Update fields
        obj_data = obj_in.dict(exclude_unset=True) if hasattr(obj_in, 'dict') else obj_in
        for field, value in obj_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
        # Set updated timestamp if model has it
        if hasattr(db_obj, 'updated_at'):
            db_obj.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, entity_id: str) -> bool:
        """
        Hard delete entity by ID
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            True if deleted, False if not found
        """
        query = delete(self.model).where(self.model.id == entity_id)
        result = await self.db.execute(query)
        await self.db.commit()
        return result.rowcount > 0

    async def soft_delete(self, entity_id: str) -> bool:
        """
        Soft delete entity by setting deleted_at timestamp
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            True if deleted, False if not found
        """
        if not hasattr(self.model, 'deleted_at'):
            # Fall back to hard delete if no soft delete support
            return await self.delete(entity_id)
        
        query = (
            update(self.model)
            .where(self.model.id == entity_id)
            .values(deleted_at=datetime.utcnow())
        )
        result = await self.db.execute(query)
        await self.db.commit()
        return result.rowcount > 0

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities with optional filtering
        
        Args:
            filters: Dictionary of field filters
            
        Returns:
            Number of entities matching filters
        """
        query = select(func.count(self.model.id))
        
        # Apply filters
        if filters:
            filter_conditions = []
            for field, value in filters.items():
                if hasattr(self.model, field):
                    model_field = getattr(self.model, field)
                    if isinstance(value, list):
                        filter_conditions.append(model_field.in_(value))
                    elif isinstance(value, str) and value.startswith('%') and value.endswith('%'):
                        filter_conditions.append(model_field.like(value))
                    else:
                        filter_conditions.append(model_field == value)
            
            if filter_conditions:
                query = query.where(and_(*filter_conditions))
        
        result = await self.db.execute(query)
        return result.scalar()

    async def exists(self, entity_id: str) -> bool:
        """
        Check if entity exists
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            True if entity exists, False otherwise
        """
        query = select(func.count(self.model.id)).where(self.model.id == entity_id)
        result = await self.db.execute(query)
        return result.scalar() > 0