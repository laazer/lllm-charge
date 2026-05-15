"""Workflow MCP tools — get_workflow, run_workflow."""
from __future__ import annotations
from typing import Any, Dict, Optional


def get_workflow(workflow_id: str) -> Dict[str, Any]:
    """Return basic info about a workflow by id."""
    return {"workflow_id": workflow_id, "status": "retrieved"}


def run_workflow(workflow_id: str, inputs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Trigger a workflow execution."""
    return {"workflow_id": workflow_id, "execution_status": "triggered", "inputs": inputs or {}}
