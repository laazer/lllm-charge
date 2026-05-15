"""
API routes for workflow management
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.database.models.workflows import Workflow, WorkflowExecution, WorkflowStatus

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    project_id: Optional[str] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    nodes: Optional[List[Dict[str, Any]]]
    edges: Optional[List[Dict[str, Any]]]
    project_id: Optional[str]
    execution_count: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    workflows: List[WorkflowResponse]
    total: int
    page: int
    page_size: int


class ExecutionResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]


def _workflow_to_response(wf: Workflow) -> WorkflowResponse:
    return WorkflowResponse(
        id=wf.id,
        name=wf.name,
        description=wf.description,
        status=wf.status,
        nodes=wf.nodes or [],
        edges=wf.edges or [],
        project_id=wf.project_id,
        execution_count=wf.execution_count or 0,
        created_at=wf.created_at,
        updated_at=wf.updated_at,
    )


@router.get("/", response_model=WorkflowListResponse)
async def list_workflows(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
):
    query = db.query(Workflow)
    if status:
        query = query.filter(Workflow.status == status)
    if project_id:
        query = query.filter(Workflow.project_id == project_id)
    total = query.count()
    workflows = query.offset((page - 1) * page_size).limit(page_size).all()
    return WorkflowListResponse(
        workflows=[_workflow_to_response(w) for w in workflows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=WorkflowResponse, status_code=201)
async def create_workflow(payload: WorkflowCreate, db: Session = Depends(get_db)):
    workflow = Workflow(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        nodes=payload.nodes or [],
        edges=payload.edges or [],
        project_id=payload.project_id,
        status=WorkflowStatus.DRAFT,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return _workflow_to_response(workflow)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _workflow_to_response(workflow)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str, payload: WorkflowCreate, db: Session = Depends(get_db)
):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    workflow.name = payload.name
    workflow.description = payload.description
    if payload.nodes is not None:
        workflow.nodes = payload.nodes
    if payload.edges is not None:
        workflow.edges = payload.edges
    db.commit()
    db.refresh(workflow)
    return _workflow_to_response(workflow)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str, db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(workflow)
    db.commit()


@router.post("/{workflow_id}/execute", response_model=ExecutionResponse, status_code=201)
async def execute_workflow(workflow_id: str, db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    execution = WorkflowExecution(
        id=str(uuid.uuid4()),
        workflow_id=workflow_id,
        status="running",
        started_at=datetime.utcnow(),
    )
    workflow.execution_count = (workflow.execution_count or 0) + 1
    db.add(execution)
    db.commit()
    db.refresh(execution)
    return ExecutionResponse(
        id=execution.id,
        workflow_id=execution.workflow_id,
        status=execution.status,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
    )


@router.get("/{workflow_id}/executions")
async def list_executions(workflow_id: str, db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    executions = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.workflow_id == workflow_id)
        .all()
    )
    return {"executions": [
        {
            "id": e.id,
            "workflow_id": e.workflow_id,
            "status": e.status,
            "started_at": e.started_at,
            "completed_at": e.completed_at,
        }
        for e in executions
    ]}
