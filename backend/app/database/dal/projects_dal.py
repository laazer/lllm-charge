"""
Data Access Layer for Project entities
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database.models.main import Project, Specification
from app.database.models.agents import Agent
from app.database.models.schemas import ProjectCreate, ProjectUpdate
from .base_dal import BaseDAL
from .repository import BaseRepository


class ProjectsDAL(BaseDAL[Project, ProjectCreate, ProjectUpdate]):
    """Data Access Layer for Project entities"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Project, db)

    async def get_with_relationships(self, project_id: str) -> Optional[Project]:
        """
        Get project with all related data (specifications, agents, etc.)
        
        Args:
            project_id: Project identifier
            
        Returns:
            Project with loaded relationships or None
        """
        query = (
            select(Project)
            .options(
                selectinload(Project.specifications),
                # Add other relationships as they're defined
            )
            .where(Project.id == project_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_type(self, project_type: str) -> List[Project]:
        """
        Get projects by type
        
        Args:
            project_type: Project type to filter by
            
        Returns:
            List of projects with matching type
        """
        query = select(Project).where(Project.type == project_type)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_active_projects(self) -> List[Project]:
        """
        Get all active projects
        
        Returns:
            List of active projects
        """
        query = select(Project).where(
            and_(
                Project.deleted_at.is_(None),
                or_(
                    Project.status == 'active',
                    Project.status == 'in_progress'
                )
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_lead(self, lead: str) -> List[Project]:
        """
        Get projects by lead
        
        Args:
            lead: Project lead to filter by
            
        Returns:
            List of projects with matching lead
        """
        query = select(Project).where(Project.lead == lead)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def search_projects(
        self,
        query_string: str,
        project_type: Optional[str] = None,
        lead: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Project]:
        """
        Search projects by name, description, or key
        
        Args:
            query_string: Text to search for
            project_type: Optional type filter
            lead: Optional lead filter
            status: Optional status filter
            
        Returns:
            List of matching projects
        """
        search_pattern = f"%{query_string}%"
        conditions = [
            or_(
                Project.name.ilike(search_pattern),
                Project.description.ilike(search_pattern),
                Project.key.ilike(search_pattern)
            )
        ]
        
        if project_type:
            conditions.append(Project.type == project_type)
        
        if lead:
            conditions.append(Project.lead == lead)
            
        if status:
            conditions.append(Project.status == status)
        
        # Exclude soft-deleted projects
        conditions.append(Project.deleted_at.is_(None))
        
        query = select(Project).where(and_(*conditions)).limit(50)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_project_statistics(self, project_id: str) -> Dict[str, Any]:
        """
        Get comprehensive statistics for a project
        
        Args:
            project_id: Project identifier
            
        Returns:
            Dictionary with project statistics
        """
        # Get basic project info
        project = await self.get(project_id)
        if not project:
            return {}
        
        # Count specifications by status
        spec_counts = await self.db.execute(
            select(
                Specification.status,
                func.count(Specification.id).label('count')
            )
            .where(Specification.project_id == project_id)
            .group_by(Specification.status)
        )
        spec_stats = {row.status: row.count for row in spec_counts}
        
        # Count total specifications
        total_specs = sum(spec_stats.values())
        
        # Count agents associated with project
        agent_count = await self.db.execute(
            select(func.count(Agent.id))
            .where(Agent.project_id == project_id)
        )
        
        # Calculate completion percentage
        completed_specs = spec_stats.get('completed', 0)
        completion_percentage = (completed_specs / total_specs * 100) if total_specs > 0 else 0
        
        return {
            "project_id": project_id,
            "name": project.name,
            "key": project.key,
            "type": project.type,
            "status": project.status,
            "lead": project.lead,
            "specification_counts": spec_stats,
            "total_specifications": total_specs,
            "completion_percentage": round(completion_percentage, 1),
            "agent_count": agent_count.scalar(),
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "codegraph_path": project.codegraph_path,
            "agent_config": project.agent_config
        }

    async def update_status(self, project_id: str, status: str, comment: Optional[str] = None) -> bool:
        """
        Update project status
        
        Args:
            project_id: Project identifier
            status: New status
            comment: Optional comment about the status change
            
        Returns:
            True if updated successfully
        """
        project = await self.get(project_id)
        if not project:
            return False
        
        project.status = status
        project.updated_at = datetime.utcnow()
        
        # Add status change to description if comment provided
        if comment:
            status_note = f"\nStatus updated to '{status}': {comment}"
            if project.description:
                project.description += status_note
            else:
                project.description = status_note
        
        await self.db.commit()
        return True

    async def get_project_summary(self, project_id: str) -> Dict[str, Any]:
        """
        Get project summary with key metrics
        
        Args:
            project_id: Project identifier
            
        Returns:
            Dictionary with project summary
        """
        project = await self.get_with_relationships(project_id)
        if not project:
            return {}
        
        # Get specification counts
        specs = project.specifications if hasattr(project, 'specifications') else []
        spec_counts = {}
        for spec in specs:
            status = spec.status
            spec_counts[status] = spec_counts.get(status, 0) + 1
        
        # Calculate progress
        total_specs = len(specs)
        completed_specs = spec_counts.get('completed', 0)
        in_progress_specs = spec_counts.get('in_progress', 0) + spec_counts.get('active', 0)
        
        progress_percentage = (completed_specs / total_specs * 100) if total_specs > 0 else 0
        
        return {
            "id": project.id,
            "name": project.name,
            "key": project.key,
            "type": project.type,
            "status": project.status,
            "lead": project.lead,
            "total_specifications": total_specs,
            "completed_specifications": completed_specs,
            "in_progress_specifications": in_progress_specs,
            "progress_percentage": round(progress_percentage, 1),
            "created_at": project.created_at,
            "last_updated": project.updated_at
        }

    async def assign_lead(self, project_id: str, lead: str) -> bool:
        """
        Assign a new lead to the project
        
        Args:
            project_id: Project identifier
            lead: New project lead
            
        Returns:
            True if assigned successfully
        """
        project = await self.get(project_id)
        if not project:
            return False
        
        project.lead = lead
        project.updated_at = datetime.utcnow()
        await self.db.commit()
        return True


class ProjectRepository(BaseRepository[Project, ProjectCreate, ProjectUpdate]):
    """High-level repository for Project operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Project, db)
        self.projects_dal = ProjectsDAL(db)

    async def get_with_relationships(self, project_id: str) -> Optional[Project]:
        """Get project with all relationships"""
        return await self.projects_dal.get_with_relationships(project_id)

    async def get_by_type(self, project_type: str) -> List[Project]:
        """Get projects by type"""
        return await self.projects_dal.get_by_type(project_type)

    async def search(self, query_string: str, **filters) -> List[Project]:
        """Search projects with filters"""
        return await self.projects_dal.search_projects(query_string, **filters)

    async def get_statistics(self, project_id: str) -> Dict[str, Any]:
        """Get project statistics"""
        return await self.projects_dal.get_project_statistics(project_id)

    async def get_active_projects(self) -> List[Project]:
        """Get all active projects"""
        return await self.projects_dal.get_active_projects()

    async def update_status(self, project_id: str, status: str, comment: Optional[str] = None) -> bool:
        """Update project status"""
        return await self.projects_dal.update_status(project_id, status, comment)

    async def assign_lead(self, project_id: str, lead: str) -> bool:
        """Assign project lead"""
        return await self.projects_dal.assign_lead(project_id, lead)

    async def get_dashboard_overview(self) -> Dict[str, Any]:
        """
        Get dashboard overview of all projects
        
        Returns:
            Dictionary with overview statistics
        """
        # Get all active projects
        active_projects = await self.get_active_projects()
        
        # Calculate overall statistics
        total_projects = len(active_projects)
        project_types = {}
        project_leads = {}
        status_counts = {}
        
        for project in active_projects:
            # Count by type
            project_types[project.type] = project_types.get(project.type, 0) + 1
            
            # Count by lead
            if project.lead:
                project_leads[project.lead] = project_leads.get(project.lead, 0) + 1
            
            # Count by status
            status_counts[project.status] = status_counts.get(project.status, 0) + 1
        
        return {
            "total_projects": total_projects,
            "project_types": project_types,
            "project_leads": project_leads,
            "status_breakdown": status_counts,
            "recent_projects": [
                {
                    "id": p.id,
                    "name": p.name,
                    "status": p.status,
                    "updated_at": p.updated_at
                }
                for p in sorted(active_projects, key=lambda x: x.updated_at, reverse=True)[:5]
            ]
        }

    async def clone_project(self, project_id: str, new_name: str, new_key: str) -> Optional[Project]:
        """
        Clone an existing project
        
        Args:
            project_id: Source project identifier
            new_name: Name for cloned project
            new_key: Key for cloned project
            
        Returns:
            Cloned project or None if source not found
        """
        source_project = await self.get_by_id(project_id)
        if not source_project:
            return None
        
        # Create clone data
        clone_data = {
            "name": new_name,
            "key": new_key,
            "description": f"Clone of {source_project.name}",
            "type": source_project.type,
            "status": "draft",
            "lead": source_project.lead,
            "codegraph_path": source_project.codegraph_path,
            "agent_config": source_project.agent_config
        }
        
        # Create clone
        clone_schema = ProjectCreate(**clone_data)
        cloned_project = await self.create(clone_schema)
        
        return cloned_project

    async def archive_project(self, project_id: str) -> bool:
        """
        Archive a project (soft delete with status change)
        
        Args:
            project_id: Project identifier
            
        Returns:
            True if archived successfully
        """
        # Update status to archived
        success = await self.update_status(project_id, "archived", "Project archived")
        
        if success:
            # Also perform soft delete
            await self.soft_delete(project_id)
        
        return success

    async def restore_project(self, project_id: str) -> bool:
        """
        Restore an archived project
        
        Args:
            project_id: Project identifier
            
        Returns:
            True if restored successfully
        """
        project = await self.get_by_id(project_id)
        if not project:
            return False
        
        # Clear soft delete and update status
        project.deleted_at = None
        project.status = "active"
        project.updated_at = datetime.utcnow()
        
        await self.db.commit()
        return True