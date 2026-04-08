"""
API routes for agent management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.api.deps import get_db
from app.database.models.agents import Agent, AgentStatus, AgentRole
from app.schemas.agents import (
    AgentCreate, AgentUpdate, AgentResponse, AgentListResponse, AgentMetrics
)
from app.core.exceptions import NotFoundError, ValidationError, DatabaseError
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger("api.agents")


@router.get("/", response_model=AgentListResponse)
async def get_agents(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    role: Optional[AgentRole] = Query(None, description="Filter by role"),
    status: Optional[AgentStatus] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in name and description")
):
    """Get all agents with pagination and filtering"""
    try:
        # Build query
        query = db.query(Agent)
        
        # Apply filters
        if role:
            rv = role.value if hasattr(role, "value") else str(role)
            query = query.filter(Agent.primary_role == rv)
        if status:
            sv = status.value if hasattr(status, "value") else str(status)
            query = query.filter(Agent.status == sv)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Agent.name.ilike(search_term)) |
                (Agent.description.ilike(search_term))
            )
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        agents = query.offset(offset).limit(page_size).all()
        
        # Convert to response models
        agent_responses = [
            AgentResponse(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                primary_role=agent.primary_role,
                status=agent.status,
                capabilities=agent.capabilities or {},
                config=agent.config or {},
                task_count=int(agent.task_count) if agent.task_count else 0,
                success_rate=float(agent.success_rate) if agent.success_rate else 0.0,
                avg_response_time=float(agent.avg_response_time) if agent.avg_response_time else 0.0,
                created_at=agent.created_at,
                updated_at=agent.updated_at
            )
            for agent in agents
        ]
        
        logger.info(f"Retrieved {len(agent_responses)} agents (page {page})")
        
        return AgentListResponse(
            agents=agent_responses,
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error retrieving agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve agents")


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Get specific agent by ID"""
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        
        if not agent:
            raise NotFoundError("Agent", agent_id)
        
        return AgentResponse(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            primary_role=agent.primary_role,
            status=agent.status,
            capabilities=agent.capabilities or {},
            config=agent.config or {},
            task_count=int(agent.task_count) if agent.task_count else 0,
            success_rate=float(agent.success_rate) if agent.success_rate else 0.0,
            avg_response_time=float(agent.avg_response_time) if agent.avg_response_time else 0.0,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )
        
    except NotFoundError:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    except Exception as e:
        logger.error(f"Error retrieving agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve agent")


@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(agent_data: AgentCreate, db: Session = Depends(get_db)):
    """Create new agent"""
    try:
        # Check if agent with same name exists
        existing = db.query(Agent).filter(Agent.name == agent_data.name).first()
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Agent with name '{agent_data.name}' already exists"
            )
        
        # Create new agent (ORM columns are strings; API uses str enums)
        pr = agent_data.primary_role
        primary_role_val = pr.value if hasattr(pr, "value") else str(pr)
        agent = Agent(
            name=agent_data.name,
            description=agent_data.description,
            primary_role=primary_role_val,
            status=AgentStatus.ACTIVE.value,
            capabilities=agent_data.capabilities.dict() if agent_data.capabilities else {},
            config=agent_data.config or {}
        )
        
        db.add(agent)
        db.commit()
        db.refresh(agent)
        
        logger.info(f"Created new agent: {agent.name} (ID: {agent.id})")
        
        return AgentResponse(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            primary_role=agent.primary_role,
            status=agent.status,
            capabilities=agent.capabilities or {},
            config=agent.config or {},
            task_count=0,
            success_rate=0.0,
            avg_response_time=0.0,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create agent")


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str, 
    agent_data: AgentUpdate, 
    db: Session = Depends(get_db)
):
    """Update existing agent"""
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        
        # Update only provided fields
        update_data = agent_data.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if field == "capabilities" and value:
                setattr(agent, field, value.dict())
            else:
                setattr(agent, field, value)
        
        db.commit()
        db.refresh(agent)
        
        logger.info(f"Updated agent: {agent.name} (ID: {agent.id})")
        
        return AgentResponse(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            primary_role=agent.primary_role,
            status=agent.status,
            capabilities=agent.capabilities or {},
            config=agent.config or {},
            task_count=int(agent.task_count) if agent.task_count else 0,
            success_rate=float(agent.success_rate) if agent.success_rate else 0.0,
            avg_response_time=float(agent.avg_response_time) if agent.avg_response_time else 0.0,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update agent")


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """Delete agent"""
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        
        db.delete(agent)
        db.commit()
        
        logger.info(f"Deleted agent: {agent.name} (ID: {agent.id})")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete agent")


@router.get("/metrics/", response_model=AgentMetrics)
async def get_agent_metrics(db: Session = Depends(get_db)):
    """Get agent performance metrics"""
    try:
        total_agents = db.query(Agent).count()
        active_agents = db.query(Agent).filter(Agent.status == AgentStatus.ACTIVE).count()
        
        # Calculate averages (would be more complex with actual data)
        agents = db.query(Agent).all()
        
        total_tasks = sum(int(agent.task_count) if agent.task_count else 0 for agent in agents)
        
        success_rates = [
            float(agent.success_rate) if agent.success_rate else 0.0 
            for agent in agents
        ]
        avg_success_rate = sum(success_rates) / len(success_rates) if success_rates else 0.0
        
        response_times = [
            float(agent.avg_response_time) if agent.avg_response_time else 0.0 
            for agent in agents
        ]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
        
        return AgentMetrics(
            total_agents=total_agents,
            active_agents=active_agents,
            avg_success_rate=avg_success_rate,
            total_tasks=total_tasks,
            avg_response_time=avg_response_time
        )
        
    except Exception as e:
        logger.error(f"Error calculating agent metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate metrics")