"""
FastAPI Dependencies for Database and Security
"""
from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.database.database import get_db
from app.database.dal.projects_dal import ProjectRepository
from app.database.dal.agents_dal import AgentRepository
from app.database.dal.flows_dal import FlowRepository
from app.database.dal.specs_dal import SpecificationRepository
from app.database.models.main import Project
from app.database.models.agents import Agent


# Security dependencies
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Get current user from authentication token
    
    Args:
        credentials: HTTP Bearer token credentials
        
    Returns:
        Dictionary with user information
        
    Raises:
        HTTPException: If authentication fails
    """
    if not credentials:
        # For development, return a default user
        return {
            "id": "default-user",
            "username": "developer",
            "email": "dev@example.com",
            "roles": ["developer"],
            "permissions": ["read", "write", "admin"]
        }
    
    # TODO: Implement actual token validation
    token = credentials.credentials
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Placeholder token validation - replace with actual implementation
    if token == "invalid":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "id": "authenticated-user",
        "username": "user",
        "email": "user@example.com",
        "roles": ["user"],
        "permissions": ["read", "write"]
    }


async def get_admin_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Ensure current user has admin privileges
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User dictionary if admin
        
    Raises:
        HTTPException: If user is not admin
    """
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


# Database dependency factories
async def get_project_repository(
    db: AsyncSession = Depends(get_db)
) -> ProjectRepository:
    """
    Get Project repository instance
    
    Args:
        db: Database session
        
    Returns:
        ProjectRepository instance
    """
    return ProjectRepository(db)


async def get_agent_repository(
    db: AsyncSession = Depends(get_db)
) -> AgentRepository:
    """
    Get Agent repository instance
    
    Args:
        db: Database session
        
    Returns:
        AgentRepository instance
    """
    return AgentRepository(db)


async def get_flow_repository(
    db: AsyncSession = Depends(get_db)
) -> FlowRepository:
    """
    Get Flow repository instance
    
    Args:
        db: Database session
        
    Returns:
        FlowRepository instance
    """
    return FlowRepository(db)


async def get_spec_repository(
    db: AsyncSession = Depends(get_db)
) -> SpecificationRepository:
    """
    Get Specification repository instance
    
    Args:
        db: Database session
        
    Returns:
        SpecificationRepository instance
    """
    return SpecificationRepository(db)


# Validation dependencies
async def validate_project_exists(
    project_id: str,
    project_repo: ProjectRepository = Depends(get_project_repository)
) -> Project:
    """
    Validate that a project exists and return it
    
    Args:
        project_id: Project identifier
        project_repo: Project repository
        
    Returns:
        Project instance
        
    Raises:
        HTTPException: If project not found
    """
    try:
        project = await project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        return project
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


async def validate_agent_exists(
    agent_id: str,
    agent_repo: AgentRepository = Depends(get_agent_repository)
) -> Agent:
    """
    Validate that an agent exists and return it
    
    Args:
        agent_id: Agent identifier
        agent_repo: Agent repository
        
    Returns:
        Agent instance
        
    Raises:
        HTTPException: If agent not found
    """
    try:
        agent = await agent_repo.get_by_id(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent {agent_id} not found"
            )
        return agent
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


# Pagination dependencies
class PaginationParams:
    """Pagination parameters"""
    
    def __init__(
        self,
        skip: int = 0,
        limit: int = 100,
        max_limit: int = 1000
    ):
        self.skip = max(0, skip)
        self.limit = min(max(1, limit), max_limit)


async def get_pagination_params(
    skip: int = 0,
    limit: int = 100
) -> PaginationParams:
    """
    Get validated pagination parameters
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        PaginationParams instance
    """
    return PaginationParams(skip, limit)


# Health check dependency
async def get_db_health(
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Check database health status
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with health status
        
    Raises:
        HTTPException: If database is unhealthy
    """
    try:
        # Simple health check query
        result = await db.execute("SELECT 1")
        if result.scalar() == 1:
            return {
                "status": "healthy",
                "database": "connected",
                "timestamp": "2024-12-30T00:00:00Z"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database health check failed"
            )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )