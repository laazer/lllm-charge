"""
API routes for specification management
"""
from fastapi import APIRouter
from typing import List

router = APIRouter()


@router.get("/specs", response_model=List[dict])
async def get_specs():
    """Get all specifications"""
    return []


@router.get("/specs/{spec_id}")
async def get_spec(spec_id: str):
    """Get specific specification"""
    return {"id": spec_id, "title": "Test Spec"}


@router.post("/specs")
async def create_spec(spec_data: dict):
    """Create new specification"""
    return {"id": "new-spec", "status": "created"}