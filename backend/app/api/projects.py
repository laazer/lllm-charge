"""
API routes for project management
"""
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.database.models.main import Project

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    path: Optional[str] = None
    key: Optional[str] = None
    type: Optional[str] = None
    codegraph_path: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    key: Optional[str]
    type: Optional[str]
    codegraph_path: Optional[str] = None
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


class ScanRequest(BaseModel):
    path: str


def _project_to_response(proj: Project) -> ProjectResponse:
    return ProjectResponse(
        id=proj.id,
        name=proj.name,
        description=proj.description,
        key=proj.key,
        type=proj.type,
        codegraph_path=proj.codegraph_path,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
    )


@router.get("/", response_model=ProjectListResponse)
async def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return ProjectListResponse(
        projects=[_project_to_response(p) for p in projects],
        total=len(projects),
    )


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        key=payload.key,
        type=payload.type,
        codegraph_path=payload.codegraph_path or payload.path,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_response(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, payload: ProjectCreate, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.key is not None:
        project.key = payload.key
    if payload.type is not None:
        project.type = payload.type
    if payload.codegraph_path is not None:
        project.codegraph_path = payload.codegraph_path
    elif payload.path is not None:
        project.codegraph_path = payload.path
    db.commit()
    db.refresh(project)
    return _project_to_response(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


def _scan_project_metadata(project_path: str) -> dict:
    """Detect project metadata from a directory."""
    metadata = {
        "name": os.path.basename(project_path),
        "description": "",
        "type": "software",
        "lead": "Unknown",
        "codeGraphPath": None,
        "agentConfig": {},
    }

    # Check for CLAUDE.md to infer type and description
    claude_md_path = os.path.join(project_path, "CLAUDE.md")
    if os.path.exists(claude_md_path):
        metadata["codeGraphPath"] = claude_md_path

    # Check for .codegraph directory
    codegraph_path = os.path.join(project_path, ".codegraph")
    if os.path.isdir(codegraph_path):
        metadata["codeGraphPath"] = codegraph_path

    # Detect agent configuration
    agent_config = {}
    if os.path.exists(os.path.join(project_path, "CLAUDE.md")):
        agent_config["claudeMdPath"] = os.path.join(project_path, "CLAUDE.md")
    if os.path.exists(os.path.join(project_path, "AGENT.md")):
        agent_config["agentMdPath"] = os.path.join(project_path, "AGENT.md")

    # Check for common project directories
    for dirname in ["skills", "agents", "workflows"]:
        dir_path = os.path.join(project_path, dirname)
        if os.path.isdir(dir_path):
            agent_config[f"{dirname}Dir"] = dir_path

    metadata["agentConfig"] = agent_config

    # Try to detect project type from directory contents
    if os.path.exists(os.path.join(project_path, "package.json")):
        metadata["type"] = "software"
    elif os.path.exists(os.path.join(project_path, "pyproject.toml")):
        metadata["type"] = "software"
    elif os.path.exists(os.path.join(project_path, ".codegraph")):
        metadata["type"] = "research"

    return metadata


@router.post("/scan")
async def scan_projects(body: ScanRequest):
    """Scan a directory for a project and return its metadata."""
    scan_path = body.path

    if not os.path.isdir(scan_path):
        raise HTTPException(status_code=404, detail=f"Path not found: {scan_path}")

    # Scan the provided path
    detected = _scan_project_metadata(scan_path)

    return {
        "path": os.path.abspath(scan_path),
        "detected": detected,
    }


@router.post("/import-samples")
async def import_sample_projects(db: Session = Depends(get_db)):
    samples = [
        {"name": "Sample Web App", "description": "A sample web application", "type": "web"},
        {"name": "Sample API", "description": "A sample REST API", "type": "api"},
    ]
    created = []
    for sample in samples:
        existing = db.query(Project).filter(Project.name == sample["name"]).first()
        if not existing:
            project = Project(id=str(uuid.uuid4()), **sample)
            db.add(project)
            created.append(sample["name"])
    db.commit()
    return {"imported": created}
