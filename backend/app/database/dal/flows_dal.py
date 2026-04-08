"""
Data Access Layer for Flow entities
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database.models.flows import Flow, FlowExecution, FlowTemplate, FlowVersion, FlowSchedule
from app.database.models.schemas import FlowCreate, FlowUpdate
from .base_dal import BaseDAL
from .repository import BaseRepository


class FlowsDAL(BaseDAL[Flow, FlowCreate, FlowUpdate]):
    """Data Access Layer for Flow entities"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Flow, db)

    async def get_with_executions(self, flow_id: str) -> Optional[Flow]:
        """
        Get flow with execution history
        
        Args:
            flow_id: Flow identifier
            
        Returns:
            Flow with loaded executions or None
        """
        query = (
            select(Flow)
            .options(selectinload(Flow.executions))
            .where(Flow.id == flow_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_status(self, status: str) -> List[Flow]:
        """
        Get flows by status
        
        Args:
            status: Flow status to filter by
            
        Returns:
            List of flows with matching status
        """
        query = select(Flow).where(Flow.status == status)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_category(self, category: str) -> List[Flow]:
        """
        Get flows by category
        
        Args:
            category: Flow category to filter by
            
        Returns:
            List of flows with matching category
        """
        query = select(Flow).where(Flow.category == category)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def search_flows(
        self,
        query_string: str,
        status: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Flow]:
        """
        Search flows by name, description, or tags
        
        Args:
            query_string: Text to search for
            status: Optional status filter
            category: Optional category filter
            tags: Optional tags filter
            
        Returns:
            List of matching flows
        """
        search_pattern = f"%{query_string}%"
        conditions = [
            or_(
                Flow.name.ilike(search_pattern),
                Flow.description.ilike(search_pattern)
            )
        ]
        
        if status:
            conditions.append(Flow.status == status)
        
        if category:
            conditions.append(Flow.category == category)
        
        if tags:
            # Search for flows that have any of the specified tags
            # This is a simplified implementation - in production you might want more sophisticated JSON querying
            for tag in tags:
                conditions.append(Flow.tags.like(f'%"{tag}"%'))
        
        query = select(Flow).where(and_(*conditions)).limit(50)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_flow_statistics(self, flow_id: str) -> Dict[str, Any]:
        """
        Get comprehensive statistics for a flow
        
        Args:
            flow_id: Flow identifier
            
        Returns:
            Dictionary with flow statistics
        """
        # Get basic flow info
        flow = await self.get(flow_id)
        if not flow:
            return {}
        
        # Count executions by status
        execution_counts = await self.db.execute(
            select(
                FlowExecution.status,
                func.count(FlowExecution.id).label('count')
            )
            .where(FlowExecution.flow_id == flow_id)
            .group_by(FlowExecution.status)
        )
        execution_stats = {row.status: row.count for row in execution_counts}
        
        # Get execution time statistics
        execution_times = await self.db.execute(
            select(
                func.avg(FlowExecution.execution_time).label('avg_time'),
                func.min(FlowExecution.execution_time).label('min_time'),
                func.max(FlowExecution.execution_time).label('max_time')
            )
            .where(
                and_(
                    FlowExecution.flow_id == flow_id,
                    FlowExecution.execution_time.is_not(None)
                )
            )
        )
        time_stats = execution_times.first()
        
        # Get latest execution
        latest_execution = await self.db.execute(
            select(FlowExecution)
            .where(FlowExecution.flow_id == flow_id)
            .order_by(FlowExecution.created_at.desc())
            .limit(1)
        )
        latest = latest_execution.scalar_one_or_none()
        
        return {
            "flow_id": flow_id,
            "name": flow.name,
            "status": flow.status,
            "category": flow.category,
            "node_count": len(flow.nodes) if flow.nodes else 0,
            "edge_count": len(flow.edges) if flow.edges else 0,
            "execution_counts": execution_stats,
            "total_executions": sum(execution_stats.values()),
            "average_execution_time": float(time_stats.avg_time) if time_stats.avg_time else None,
            "min_execution_time": time_stats.min_time,
            "max_execution_time": time_stats.max_time,
            "latest_execution": {
                "id": latest.id,
                "status": latest.status,
                "created_at": latest.created_at,
                "execution_time": latest.execution_time
            } if latest else None,
            "created_at": flow.created_at,
            "updated_at": flow.updated_at
        }


class FlowExecutionsDAL(BaseDAL[FlowExecution, Dict, Dict]):
    """Data Access Layer for Flow Executions"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(FlowExecution, db)

    async def create_execution(
        self,
        flow_id: str,
        input_data: Optional[Dict] = None,
        metadata: Optional[Dict] = None
    ) -> FlowExecution:
        """
        Create new flow execution
        
        Args:
            flow_id: Flow identifier
            input_data: Input data for execution
            metadata: Optional execution metadata
            
        Returns:
            Created FlowExecution
        """
        execution_data = {
            "flow_id": flow_id,
            "status": "pending",
            "input_data": input_data or {},
            "started_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        }
        
        execution = FlowExecution(**execution_data)
        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)
        return execution

    async def update_execution_status(
        self,
        execution_id: str,
        status: str,
        current_node: Optional[str] = None,
        output_data: Optional[Dict] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update execution status and progress
        
        Args:
            execution_id: Execution identifier
            status: New status
            current_node: Current node being executed
            output_data: Output data if completed
            error_message: Error message if failed
            
        Returns:
            True if updated
        """
        execution = await self.get(execution_id)
        if not execution:
            return False
        
        execution.status = status
        if current_node:
            execution.current_node = current_node
        if output_data:
            execution.output_data = output_data
        if error_message:
            execution.error_message = error_message
        
        if status in ['completed', 'failed', 'cancelled']:
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                delta = execution.completed_at - execution.started_at
                execution.execution_time = int(delta.total_seconds() * 1000)  # milliseconds
        
        await self.db.commit()
        return True

    async def get_executions_for_flow(
        self,
        flow_id: str,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[FlowExecution]:
        """
        Get executions for specific flow
        
        Args:
            flow_id: Flow identifier
            status: Optional status filter
            limit: Maximum number of executions to return
            
        Returns:
            List of flow executions
        """
        conditions = [FlowExecution.flow_id == flow_id]
        
        if status:
            conditions.append(FlowExecution.status == status)
        
        query = (
            select(FlowExecution)
            .where(and_(*conditions))
            .order_by(FlowExecution.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_running_executions(self) -> List[FlowExecution]:
        """
        Get all currently running executions
        
        Returns:
            List of running executions
        """
        query = select(FlowExecution).where(FlowExecution.status == 'running')
        result = await self.db.execute(query)
        return result.scalars().all()


class FlowRepository(BaseRepository[Flow, FlowCreate, FlowUpdate]):
    """High-level repository for Flow operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Flow, db)
        self.flows_dal = FlowsDAL(db)
        self.executions_dal = FlowExecutionsDAL(db)

    async def get_with_executions(self, flow_id: str) -> Optional[Flow]:
        """Get flow with execution history"""
        return await self.flows_dal.get_with_executions(flow_id)

    async def search(self, query_string: str, **filters) -> List[Flow]:
        """Search flows with filters"""
        return await self.flows_dal.search_flows(query_string, **filters)

    async def get_statistics(self, flow_id: str) -> Dict[str, Any]:
        """Get flow statistics"""
        return await self.flows_dal.get_flow_statistics(flow_id)

    async def execute_flow(
        self,
        flow_id: str,
        input_data: Optional[Dict] = None
    ) -> Optional[FlowExecution]:
        """
        Start flow execution
        
        Args:
            flow_id: Flow identifier
            input_data: Input data for execution
            
        Returns:
            Created FlowExecution or None if flow not found
        """
        # Verify flow exists and is executable
        flow = await self.get_by_id(flow_id)
        if not flow or flow.status not in ['active', 'draft']:
            return None
        
        # Create execution
        execution = await self.executions_dal.create_execution(
            flow_id=flow_id,
            input_data=input_data
        )
        
        return execution

    async def get_execution_history(
        self,
        flow_id: str,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[FlowExecution]:
        """Get execution history for flow"""
        return await self.executions_dal.get_executions_for_flow(
            flow_id=flow_id,
            status=status,
            limit=limit
        )

    async def update_execution(
        self,
        execution_id: str,
        status: str,
        **kwargs
    ) -> bool:
        """Update execution status"""
        return await self.executions_dal.update_execution_status(
            execution_id=execution_id,
            status=status,
            **kwargs
        )

    async def get_active_executions(self) -> List[FlowExecution]:
        """Get all running executions"""
        return await self.executions_dal.get_running_executions()

    async def clone_flow(self, flow_id: str, new_name: str) -> Optional[Flow]:
        """
        Clone an existing flow
        
        Args:
            flow_id: Source flow identifier
            new_name: Name for cloned flow
            
        Returns:
            Cloned flow or None if source not found
        """
        source_flow = await self.get_by_id(flow_id)
        if not source_flow:
            return None
        
        # Create clone data
        clone_data = {
            "name": new_name,
            "description": f"Clone of {source_flow.name}",
            "nodes": source_flow.nodes,
            "edges": source_flow.edges,
            "type": source_flow.type,
            "status": "draft",
            "category": source_flow.category,
            "tags": source_flow.tags,
            "settings": source_flow.settings,
            "triggers": source_flow.triggers
        }
        
        # Create clone
        from app.database.models.schemas import FlowCreate
        clone_schema = FlowCreate(**clone_data)
        cloned_flow = await self.create(clone_schema)
        
        return cloned_flow