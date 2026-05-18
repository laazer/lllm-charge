"""
API routes for skill management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.api.deps import get_db
from app.database.models.skills import Skill
from app.schemas.skills import (
    SkillCreate, SkillUpdate, SkillResponse, SkillListResponse
)
from app.core.logging import get_logger
import uuid

router = APIRouter()
logger = get_logger("api.skills")


@router.get("/", response_model=SkillListResponse)
async def get_skills(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    project_id: Optional[str] = Query(None, description="Filter by project ID")
):
    """Get all skills with pagination and filtering"""
    try:
        # Build query
        query = db.query(Skill)

        # Apply filters
        if category:
            query = query.filter(Skill.category == category)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Skill.title.ilike(search_term)) |
                (Skill.description.ilike(search_term))
            )
        if project_id:
            query = query.filter(Skill.project_id == project_id)

        # Get total count
        total = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        skills = query.offset(offset).limit(page_size).all()

        # Convert to response models
        skill_responses = [
            SkillResponse(
                id=skill.id,
                title=skill.title,
                description=skill.description,
                category=skill.category,
                tags=skill.tags or [],
                project_id=skill.project_id,
                status=skill.status,
                created_at=skill.created_at,
                updated_at=skill.updated_at
            )
            for skill in skills
        ]

        logger.info(f"Retrieved {len(skill_responses)} skills (page {page})")

        return SkillListResponse(
            skills=skill_responses,
            total=total,
            page=page,
            page_size=page_size
        )

    except Exception as e:
        logger.error(f"Error retrieving skills: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve skills")


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: str, db: Session = Depends(get_db)):
    """Get specific skill by ID"""
    try:
        skill = db.query(Skill).filter(Skill.id == skill_id).first()

        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill {skill_id} not found")

        return SkillResponse(
            id=skill.id,
            title=skill.title,
            description=skill.description,
            category=skill.category,
            tags=skill.tags or [],
            project_id=skill.project_id,
            status=skill.status,
            created_at=skill.created_at,
            updated_at=skill.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving skill {skill_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve skill")


@router.post("/", response_model=SkillResponse, status_code=201)
async def create_skill(skill_data: SkillCreate, db: Session = Depends(get_db)):
    """Create new skill"""
    try:
        # Check if skill with same title exists
        existing = db.query(Skill).filter(Skill.title == skill_data.title).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Skill with title '{skill_data.title}' already exists"
            )

        # Create new skill
        skill = Skill(
            id=str(uuid.uuid4()),
            title=skill_data.title,
            description=skill_data.description,
            category=skill_data.category,
            tags=skill_data.tags or [],
            project_id=skill_data.project_id,
            status=skill_data.status
        )

        db.add(skill)
        db.commit()
        db.refresh(skill)

        logger.info(f"Created new skill: {skill.title} (ID: {skill.id})")

        return SkillResponse(
            id=skill.id,
            title=skill.title,
            description=skill.description,
            category=skill.category,
            tags=skill.tags or [],
            project_id=skill.project_id,
            status=skill.status,
            created_at=skill.created_at,
            updated_at=skill.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating skill: {e}")
        raise HTTPException(status_code=500, detail="Failed to create skill")


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    skill_data: SkillUpdate,
    db: Session = Depends(get_db)
):
    """Update existing skill"""
    try:
        skill = db.query(Skill).filter(Skill.id == skill_id).first()

        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill {skill_id} not found")

        # Update only provided fields
        update_data = skill_data.dict(exclude_unset=True)

        for field, value in update_data.items():
            setattr(skill, field, value)

        db.commit()
        db.refresh(skill)

        logger.info(f"Updated skill: {skill.title} (ID: {skill.id})")

        return SkillResponse(
            id=skill.id,
            title=skill.title,
            description=skill.description,
            category=skill.category,
            tags=skill.tags or [],
            project_id=skill.project_id,
            status=skill.status,
            created_at=skill.created_at,
            updated_at=skill.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating skill {skill_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update skill")


@router.delete("/{skill_id}", status_code=200)
async def delete_skill(skill_id: str, db: Session = Depends(get_db)):
    """Delete skill"""
    try:
        skill = db.query(Skill).filter(Skill.id == skill_id).first()

        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill {skill_id} not found")

        skill_title = skill.title
        db.delete(skill)
        db.commit()

        logger.info(f"Deleted skill: {skill_title} (ID: {skill_id})")
        return {"message": f"Skill {skill_id} deleted"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting skill {skill_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete skill")
