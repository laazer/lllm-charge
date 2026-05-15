"""
API routes for specification management
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.database.models.main import Specification

router = APIRouter()


class SpecCreate(BaseModel):
    title: str
    content: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    status: Optional[str] = "draft"
    priority: Optional[str] = None
    tags: Optional[List[str]] = None


class SpecResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: str
    project_id: Optional[str]
    priority: Optional[str]
    tags: Optional[List[str]]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SpecListResponse(BaseModel):
    specs: List[SpecResponse]
    total: int


def _spec_to_response(spec: Specification) -> SpecResponse:
    return SpecResponse(
        id=spec.id,
        title=spec.title,
        description=spec.description,
        status=spec.status or "draft",
        project_id=spec.project_id,
        priority=spec.priority,
        tags=spec.tags or [],
        created_at=spec.created_at,
        updated_at=spec.updated_at,
    )


@router.get("/", response_model=SpecListResponse)
async def list_specs(
    db: Session = Depends(get_db),
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    query = db.query(Specification)
    if project_id:
        query = query.filter(Specification.project_id == project_id)
    if status:
        query = query.filter(Specification.status == status)
    if search:
        query = query.filter(Specification.title.ilike(f"%{search}%"))
    specs = query.all()
    return SpecListResponse(specs=[_spec_to_response(s) for s in specs], total=len(specs))


@router.post("/", response_model=SpecResponse, status_code=201)
async def create_spec(payload: SpecCreate, db: Session = Depends(get_db)):
    spec = Specification(
        id=str(uuid.uuid4()),
        title=payload.title,
        description=payload.description or payload.content,
        status=payload.status or "draft",
        project_id=payload.project_id,
        priority=payload.priority,
        tags=payload.tags or [],
    )
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return _spec_to_response(spec)


@router.get("/{spec_id}", response_model=SpecResponse)
async def get_spec(spec_id: str, db: Session = Depends(get_db)):
    spec = db.query(Specification).filter(Specification.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Specification not found")
    return _spec_to_response(spec)


@router.put("/{spec_id}", response_model=SpecResponse)
async def update_spec(spec_id: str, payload: SpecCreate, db: Session = Depends(get_db)):
    spec = db.query(Specification).filter(Specification.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Specification not found")
    spec.title = payload.title
    if payload.description is not None:
        spec.description = payload.description
    if payload.status is not None:
        spec.status = payload.status
    if payload.priority is not None:
        spec.priority = payload.priority
    if payload.tags is not None:
        spec.tags = payload.tags
    db.commit()
    db.refresh(spec)
    return _spec_to_response(spec)


@router.delete("/{spec_id}", status_code=204)
async def delete_spec(spec_id: str, db: Session = Depends(get_db)):
    spec = db.query(Specification).filter(Specification.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Specification not found")
    db.delete(spec)
    db.commit()


@router.post("/skills/spec-cleanup/scan")
async def scan_specs(db: Session = Depends(get_db)):
    specs = db.query(Specification).filter(Specification.status == "draft").all()
    issues = [
        {"spec_id": s.id, "title": s.title, "issue": "Spec is in draft state"}
        for s in specs
        if not s.description
    ]
    return {"issues": issues, "total": len(issues)}


@router.post("/skills/spec-cleanup/run")
async def run_spec_cleanup(db: Session = Depends(get_db)):
    specs = db.query(Specification).filter(Specification.description.is_(None)).all()
    for spec in specs:
        spec.description = ""
    db.commit()
    return {"fixed": len(specs)}
