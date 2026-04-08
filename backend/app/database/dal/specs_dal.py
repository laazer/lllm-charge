"""
Data Access Layer for Specification entities
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database.models.main import Specification, Project
from app.database.models.schemas import SpecificationCreate, SpecificationUpdate
from .base_dal import BaseDAL
from .repository import BaseRepository


class SpecsDAL(BaseDAL[Specification, SpecificationCreate, SpecificationUpdate]):
    """Data Access Layer for Specification entities"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Specification, db)

    async def get_with_project(self, spec_id: str) -> Optional[Specification]:
        """
        Get specification with project information
        
        Args:
            spec_id: Specification identifier
            
        Returns:
            Specification with loaded project or None
        """
        query = (
            select(Specification)
            .options(selectinload(Specification.project))
            .where(Specification.id == spec_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_status(self, status: str) -> List[Specification]:
        """
        Get specifications by status
        
        Args:
            status: Specification status to filter by
            
        Returns:
            List of specifications with matching status
        """
        query = select(Specification).where(Specification.status == status)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_project(self, project_id: str) -> List[Specification]:
        """
        Get specifications for a specific project
        
        Args:
            project_id: Project identifier
            
        Returns:
            List of specifications for the project
        """
        query = select(Specification).where(Specification.project_id == project_id)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_priority(self, priority: str) -> List[Specification]:
        """
        Get specifications by priority
        
        Args:
            priority: Specification priority to filter by
            
        Returns:
            List of specifications with matching priority
        """
        query = select(Specification).where(Specification.priority == priority)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_assigned_to_agent(self, agent_id: str) -> List[Specification]:
        """
        Get specifications assigned to specific agent
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            List of specifications assigned to the agent
        """
        query = select(Specification).where(Specification.assigned_agent == agent_id)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def search_specifications(
        self,
        query_string: str,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        project_id: Optional[str] = None,
        assigned_agent: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Specification]:
        """
        Search specifications by title, description, or tags
        
        Args:
            query_string: Text to search for
            status: Optional status filter
            priority: Optional priority filter
            project_id: Optional project filter
            assigned_agent: Optional agent filter
            tags: Optional tags filter
            
        Returns:
            List of matching specifications
        """
        search_pattern = f"%{query_string}%"
        conditions = [
            or_(
                Specification.title.ilike(search_pattern),
                Specification.description.ilike(search_pattern)
            )
        ]
        
        if status:
            conditions.append(Specification.status == status)
        
        if priority:
            conditions.append(Specification.priority == priority)
        
        if project_id:
            conditions.append(Specification.project_id == project_id)
            
        if assigned_agent:
            conditions.append(Specification.assigned_agent == assigned_agent)
        
        if tags:
            # Search for specifications that have any of the specified tags
            for tag in tags:
                conditions.append(Specification.tags.like(f'%"{tag}"%'))
        
        query = select(Specification).where(and_(*conditions)).limit(50)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_specification_statistics(self, spec_id: str) -> Dict[str, Any]:
        """
        Get comprehensive statistics for a specification
        
        Args:
            spec_id: Specification identifier
            
        Returns:
            Dictionary with specification statistics
        """
        # Get basic spec info
        spec = await self.get_with_project(spec_id)
        if not spec:
            return {}
        
        # Get project name if available
        project_name = spec.project.name if spec.project else None
        
        return {
            "spec_id": spec_id,
            "title": spec.title,
            "status": spec.status,
            "priority": spec.priority,
            "project_id": spec.project_id,
            "project_name": project_name,
            "assigned_agent": spec.assigned_agent,
            "tags": spec.tags or [],
            "linked_classes_count": len(spec.linked_classes) if spec.linked_classes else 0,
            "linked_methods_count": len(spec.linked_methods) if spec.linked_methods else 0,
            "linked_tests_count": len(spec.linked_tests) if spec.linked_tests else 0,
            "comments_count": len(spec.comments) if spec.comments else 0,
            "created_at": spec.created_at,
            "updated_at": spec.updated_at
        }

    async def get_status_counts(self, project_id: Optional[str] = None) -> Dict[str, int]:
        """
        Get count of specifications by status
        
        Args:
            project_id: Optional project filter
            
        Returns:
            Dictionary with status counts
        """
        query = select(
            Specification.status,
            func.count(Specification.id).label('count')
        )
        
        if project_id:
            query = query.where(Specification.project_id == project_id)
        
        query = query.group_by(Specification.status)
        
        result = await self.db.execute(query)
        return {row.status: row.count for row in result}

    async def get_priority_counts(self, project_id: Optional[str] = None) -> Dict[str, int]:
        """
        Get count of specifications by priority
        
        Args:
            project_id: Optional project filter
            
        Returns:
            Dictionary with priority counts
        """
        query = select(
            Specification.priority,
            func.count(Specification.id).label('count')
        )
        
        if project_id:
            query = query.where(Specification.project_id == project_id)
        
        query = query.where(Specification.priority.is_not(None)).group_by(Specification.priority)
        
        result = await self.db.execute(query)
        return {row.priority: row.count for row in result}

    async def assign_to_agent(self, spec_id: str, agent_id: str) -> bool:
        """
        Assign specification to an agent
        
        Args:
            spec_id: Specification identifier
            agent_id: Agent identifier
            
        Returns:
            True if assigned successfully
        """
        spec = await self.get(spec_id)
        if not spec:
            return False
        
        spec.assigned_agent = agent_id
        spec.updated_at = datetime.utcnow()
        await self.db.commit()
        return True

    async def update_status(self, spec_id: str, status: str, comment: Optional[str] = None) -> bool:
        """
        Update specification status with optional comment
        
        Args:
            spec_id: Specification identifier
            status: New status
            comment: Optional comment about the status change
            
        Returns:
            True if updated successfully
        """
        spec = await self.get(spec_id)
        if not spec:
            return False
        
        spec.status = status
        spec.updated_at = datetime.utcnow()
        
        # Add comment if provided
        if comment:
            if not spec.comments:
                spec.comments = []
            spec.comments.append({
                "timestamp": datetime.utcnow().isoformat(),
                "type": "status_change",
                "content": comment,
                "status": status
            })
        
        await self.db.commit()
        return True


class SpecificationRepository(BaseRepository[Specification, SpecificationCreate, SpecificationUpdate]):
    """High-level repository for Specification operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Specification, db)
        self.specs_dal = SpecsDAL(db)

    async def get_with_project(self, spec_id: str) -> Optional[Specification]:
        """Get specification with project information"""
        return await self.specs_dal.get_with_project(spec_id)

    async def search(self, query_string: str, **filters) -> List[Specification]:
        """Search specifications with filters"""
        return await self.specs_dal.search_specifications(query_string, **filters)

    async def get_statistics(self, spec_id: str) -> Dict[str, Any]:
        """Get specification statistics"""
        return await self.specs_dal.get_specification_statistics(spec_id)

    async def get_by_project(self, project_id: str) -> List[Specification]:
        """Get specifications for project"""
        return await self.specs_dal.get_by_project(project_id)

    async def get_by_status(self, status: str) -> List[Specification]:
        """Get specifications by status"""
        return await self.specs_dal.get_by_status(status)

    async def assign_to_agent(self, spec_id: str, agent_id: str) -> bool:
        """Assign specification to agent"""
        return await self.specs_dal.assign_to_agent(spec_id, agent_id)

    async def update_status(self, spec_id: str, status: str, comment: Optional[str] = None) -> bool:
        """Update specification status"""
        return await self.specs_dal.update_status(spec_id, status, comment)

    async def get_dashboard_summary(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get dashboard summary for specifications
        
        Args:
            project_id: Optional project filter
            
        Returns:
            Dictionary with summary statistics
        """
        # Get counts by status and priority
        status_counts = await self.specs_dal.get_status_counts(project_id)
        priority_counts = await self.specs_dal.get_priority_counts(project_id)
        
        # Get total count
        total_count = sum(status_counts.values())
        
        # Calculate completion percentage
        completed_count = status_counts.get('completed', 0)
        completion_percentage = (completed_count / total_count * 100) if total_count > 0 else 0
        
        return {
            "total_specifications": total_count,
            "status_breakdown": status_counts,
            "priority_breakdown": priority_counts,
            "completion_percentage": round(completion_percentage, 1),
            "project_id": project_id
        }

    async def get_recent_specifications(self, limit: int = 10, project_id: Optional[str] = None) -> List[Specification]:
        """
        Get recently created or updated specifications
        
        Args:
            limit: Maximum number of specifications to return
            project_id: Optional project filter
            
        Returns:
            List of recent specifications
        """
        filters = {}
        if project_id:
            filters["project_id"] = project_id
        
        return await self.get_multi_by_field(
            filters=filters,
            order_by="updated_at",
            order_desc=True,
            limit=limit
        )

    async def clone_specification(self, spec_id: str, new_title: str) -> Optional[Specification]:
        """
        Clone an existing specification
        
        Args:
            spec_id: Source specification identifier
            new_title: Title for cloned specification
            
        Returns:
            Cloned specification or None if source not found
        """
        source_spec = await self.get_by_id(spec_id)
        if not source_spec:
            return None
        
        # Create clone data
        clone_data = {
            "title": new_title,
            "description": source_spec.description,
            "status": "draft",
            "project_id": source_spec.project_id,
            "priority": source_spec.priority,
            "tags": source_spec.tags,
            "linked_classes": source_spec.linked_classes,
            "linked_methods": source_spec.linked_methods,
            "linked_tests": source_spec.linked_tests,
            "comments": [
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "type": "clone",
                    "content": f"Cloned from specification: {source_spec.title}"
                }
            ]
        }
        
        # Create clone
        clone_schema = SpecificationCreate(**clone_data)
        cloned_spec = await self.create(clone_schema)
        
        return cloned_spec