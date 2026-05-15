"""MCP workflow tools — get_workflow and run_workflow wrappers."""
from __future__ import annotations

from typing import Any, Dict


async def handle_get_workflow(params: Dict[str, Any]) -> Dict[str, Any]:
    workflow_id = params.get("workflow_id", "")
    if not workflow_id:
        return {"error": "workflow_id is required"}
    try:
        from app.database.database import SessionLocal
        from app.database.models.workflows import Workflow
        db = SessionLocal()
        try:
            wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            if not wf:
                return {"error": f"Workflow '{workflow_id}' not found"}
            return {"id": wf.id, "name": wf.name, "status": wf.status}
        finally:
            db.close()
    except Exception as exc:
        return {"error": str(exc)}


async def handle_run_workflow(params: Dict[str, Any]) -> Dict[str, Any]:
    workflow_id = params.get("workflow_id", "")
    if not workflow_id:
        return {"error": "workflow_id is required"}
    try:
        import uuid
        from datetime import datetime
        from app.database.database import SessionLocal
        from app.database.models.workflows import Workflow, WorkflowExecution
        db = SessionLocal()
        try:
            wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            if not wf:
                return {"error": f"Workflow '{workflow_id}' not found"}
            execution = WorkflowExecution(
                id=str(uuid.uuid4()),
                workflow_id=workflow_id,
                status="running",
                started_at=datetime.utcnow(),
            )
            wf.execution_count = (wf.execution_count or 0) + 1
            db.add(execution)
            db.commit()
            return {"execution_id": execution.id, "status": execution.status}
        finally:
            db.close()
    except Exception as exc:
        return {"error": str(exc)}
