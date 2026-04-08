"""
Data Access Layer for Agent entities
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database.models.agents import Agent, AgentTask, AgentLearning, AgentCollaboration
from app.database.models.schemas import AgentCreate, AgentUpdate
from .base_dal import BaseDAL
from .repository import BaseRepository


class AgentsDAL(BaseDAL[Agent, AgentCreate, AgentUpdate]):
    """Data Access Layer for Agent entities"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Agent, db)

    async def get_with_relationships(self, agent_id: str) -> Optional[Agent]:
        """
        Get agent with all related data (tasks, learning, collaborations)
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            Agent with loaded relationships or None
        """
        query = (
            select(Agent)
            .options(
                selectinload(Agent.tasks),
                selectinload(Agent.learning_records),
                selectinload(Agent.collaborations)
            )
            .where(Agent.id == agent_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_role(self, role: str) -> List[Agent]:
        """
        Get agents by primary role
        
        Args:
            role: Primary role to filter by
            
        Returns:
            List of agents with matching role
        """
        query = select(Agent).where(Agent.primary_role == role)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_available_agents(self, project_id: Optional[str] = None) -> List[Agent]:
        """
        Get agents that are available for assignment
        
        Args:
            project_id: Optional project ID to filter by
            
        Returns:
            List of available agents
        """
        query = select(Agent).where(
            and_(
                Agent.deleted_at.is_(None),
                or_(
                    Agent.project_id.is_(None),
                    Agent.project_id == project_id if project_id else True
                )
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def search_agents(
        self,
        query_string: str,
        roles: Optional[List[str]] = None,
        project_id: Optional[str] = None
    ) -> List[Agent]:
        """
        Search agents by name, description, or role
        
        Args:
            query_string: Text to search for
            roles: Optional list of roles to filter by
            project_id: Optional project ID to filter by
            
        Returns:
            List of matching agents
        """
        search_pattern = f"%{query_string}%"
        conditions = [
            or_(
                Agent.name.ilike(search_pattern),
                Agent.description.ilike(search_pattern)
            )
        ]
        
        if roles:
            conditions.append(Agent.primary_role.in_(roles))
        
        if project_id:
            conditions.append(
                or_(
                    Agent.project_id.is_(None),
                    Agent.project_id == project_id
                )
            )
        
        # Exclude soft-deleted agents
        conditions.append(Agent.deleted_at.is_(None))
        
        query = select(Agent).where(and_(*conditions)).limit(50)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_last_active(self, agent_id: str) -> bool:
        """
        Update agent's last active timestamp
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            True if updated, False if not found
        """
        agent = await self.get(agent_id)
        if not agent:
            return False
        
        agent.last_active = datetime.utcnow()
        await self.db.commit()
        return True

    async def get_agent_statistics(self, agent_id: str) -> Dict[str, Any]:
        """
        Get comprehensive statistics for an agent
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            Dictionary with agent statistics
        """
        # Get basic agent info
        agent = await self.get(agent_id)
        if not agent:
            return {}
        
        # Count tasks by status
        task_counts = await self.db.execute(
            select(
                AgentTask.status,
                func.count(AgentTask.id).label('count')
            )
            .where(AgentTask.agent_id == agent_id)
            .group_by(AgentTask.status)
        )
        task_stats = {row.status: row.count for row in task_counts}
        
        # Count learning records
        learning_count = await self.db.execute(
            select(func.count(AgentLearning.id))
            .where(AgentLearning.agent_id == agent_id)
        )
        
        # Count collaborations
        collaboration_count = await self.db.execute(
            select(func.count(AgentCollaboration.id))
            .where(AgentCollaboration.agent_id == agent_id)
        )
        
        return {
            "agent_id": agent_id,
            "name": agent.name,
            "primary_role": agent.primary_role,
            "capabilities": agent.capabilities,
            "last_active": agent.last_active,
            "task_counts": task_stats,
            "total_tasks": sum(task_stats.values()),
            "learning_records": learning_count.scalar(),
            "collaborations": collaboration_count.scalar(),
            "created_at": agent.created_at,
            "project_id": agent.project_id
        }


class AgentTasksDAL(BaseDAL[AgentTask, Dict, Dict]):
    """Data Access Layer for Agent Tasks"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(AgentTask, db)

    async def get_tasks_for_agent(
        self,
        agent_id: str,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[AgentTask]:
        """
        Get tasks for specific agent
        
        Args:
            agent_id: Agent identifier
            status: Optional status filter
            limit: Maximum number of tasks to return
            
        Returns:
            List of agent tasks
        """
        conditions = [AgentTask.agent_id == agent_id]
        
        if status:
            conditions.append(AgentTask.status == status)
        
        query = (
            select(AgentTask)
            .where(and_(*conditions))
            .order_by(AgentTask.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_task_status(self, task_id: str, status: str, result_data: Optional[Dict] = None) -> bool:
        """
        Update task status and result
        
        Args:
            task_id: Task identifier
            status: New status
            result_data: Optional result data
            
        Returns:
            True if updated
        """
        task = await self.get(task_id)
        if not task:
            return False
        
        task.status = status
        if result_data:
            task.result = result_data
        
        if status in ['completed', 'failed']:
            task.completed_at = datetime.utcnow()
        
        await self.db.commit()
        return True


class AgentRepository(BaseRepository[Agent, AgentCreate, AgentUpdate]):
    """High-level repository for Agent operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Agent, db)
        self.agents_dal = AgentsDAL(db)
        self.tasks_dal = AgentTasksDAL(db)

    async def get_with_relationships(self, agent_id: str) -> Optional[Agent]:
        """Get agent with all relationships"""
        return await self.agents_dal.get_with_relationships(agent_id)

    async def get_by_role(self, role: str) -> List[Agent]:
        """Get agents by role"""
        return await self.agents_dal.get_by_role(role)

    async def search(self, query_string: str, **filters) -> List[Agent]:
        """Search agents with filters"""
        return await self.agents_dal.search_agents(query_string, **filters)

    async def get_statistics(self, agent_id: str) -> Dict[str, Any]:
        """Get agent statistics"""
        return await self.agents_dal.get_agent_statistics(agent_id)
        
    async def assign_task(
        self,
        agent_id: str,
        task_description: str,
        task_type: str = "general",
        priority: str = "medium",
        metadata: Optional[Dict] = None
    ) -> Optional[AgentTask]:
        """
        Assign a new task to an agent
        
        Args:
            agent_id: Agent identifier
            task_description: Description of the task
            task_type: Type of task
            priority: Task priority
            metadata: Optional task metadata
            
        Returns:
            Created AgentTask or None
        """
        # Verify agent exists
        agent = await self.get_by_id(agent_id)
        if not agent:
            return None
        
        # Create task
        task_data = {
            "agent_id": agent_id,
            "task_description": task_description,
            "task_type": task_type,
            "priority": priority,
            "status": "pending",
            "metadata": metadata or {},
            "created_at": datetime.utcnow()
        }
        
        task = AgentTask(**task_data)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        
        return task