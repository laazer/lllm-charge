"""MCP HTTP routes — tools list, resources, call, status."""
from __future__ import annotations
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.mcp.builtin_tools import register_builtin_tools
from app.mcp.executor import executor
from app.mcp.registry import registry

router = APIRouter(prefix="/mcp", tags=["mcp"])

# Ensure tools are registered when this module loads
register_builtin_tools()

_START_TIME = time.time()

_RESOURCES = [
    {"uri": "workspace://files", "name": "Workspace Files", "description": "Files in the project workspace"},
    {"uri": "db://agents", "name": "Agents", "description": "Agent records in the database"},
    {"uri": "db://workflows", "name": "Workflows", "description": "Workflow definitions"},
    {"uri": "db://specs", "name": "Specifications", "description": "Project specifications"},
]


class CallRequest(BaseModel):
    params: Optional[Dict[str, Any]] = None
    # Also accept flat body fields
    model_config = {"extra": "allow"}


@router.get("/tools")
def list_tools():
    tools = registry.list_tools()
    return {
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
                "category": t.category,
            }
            for t in tools
        ],
        "count": len(tools),
    }


@router.get("/resources")
def list_resources():
    return {"resources": _RESOURCES}


@router.get("/status")
def mcp_status():
    return {
        "initialized": True,
        "tool_count": len(registry),
        "uptime_seconds": round(time.time() - _START_TIME, 2),
        "status": "ok",
    }


@router.post("/call/{tool_name}")
async def call_tool(tool_name: str, request: CallRequest):
    tool = registry.get_tool(tool_name)
    if tool is None:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    # Merge params from nested params field and top-level extra fields
    params: Dict[str, Any] = {}
    if request.params:
        params.update(request.params)
    # Include any extra top-level fields (e.g. {"prompt": "..."})
    extra = request.model_extra or {}
    params.update(extra)

    try:
        result = await executor.execute(tool_name, params)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except (FileNotFoundError, NotADirectoryError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return result
