"""
API routes for project management
"""
from fastapi import APIRouter
from typing import List

router = APIRouter()


@router.get("/projects", response_model=List[dict])
async def get_projects():
    """Get all projects"""
    return []


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get specific project"""
    return {"id": project_id, "name": "Test Project"}


@router.post("/projects")
async def create_project(project_data: dict):
    """Create new project"""
    return {"id": "new-project", "status": "created"}