"""
API routes for workflow management
"""
from fastapi import APIRouter
from typing import List

router = APIRouter()


@router.get("/workflows", response_model=List[dict])
async def get_workflows():
    """Get all workflows"""
    return []


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get specific workflow"""
    return {"id": workflow_id, "name": "Test Workflow"}


@router.post("/workflows")
async def create_workflow(workflow_data: dict):
    """Create new workflow"""
    return {"id": "new-workflow", "status": "created"}