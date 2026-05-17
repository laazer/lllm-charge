"""
MCP HTTP API routes.

Exposes the tool registry over HTTP so frontend clients can discover and
invoke tools without going through the stdio MCP protocol.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.mcp.registry import ToolRegistry
from app.mcp.executor import ToolExecutor
from app.mcp.tools.filesystem import handle_read_file, handle_write_file, handle_list_directory
from app.mcp.tools.hybrid_reasoning import handle_hybrid_reasoning
from app.mcp.tools.workflow import handle_get_workflow, handle_run_workflow
from app.mcp.tools.agents import handle_list_agents, handle_spawn_agent
from app.mcp.tools.analysis import (
    handle_analyze_react_component,
    handle_analyze_django_models,
    handle_analyze_fastapi_routes,
    handle_get_react_project_health,
    handle_scaffold_react_component,
    handle_check_django_security,
)

router = APIRouter(tags=["mcp"])

# ---------------------------------------------------------------------------
# Build the shared registry and executor at module load time
# ---------------------------------------------------------------------------

_registry = ToolRegistry()

_registry.register(
    "hybrid_reasoning",
    "Route a prompt through the hybrid LLM router (local-first with cloud fallback)",
    {
        "type": "object",
        "properties": {
            "prompt": {"type": "string"},
            "prefer_local": {"type": "boolean"},
            "complexity": {"type": "string", "enum": ["simple", "complex"]},
        },
        "required": ["prompt"],
    },
    handle_hybrid_reasoning,
)

_registry.register(
    "read_file",
    "Read the text contents of a file within the allowed workspace",
    {
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "required": ["path"],
    },
    handle_read_file,
)

_registry.register(
    "write_file",
    "Write text content to a file within the allowed workspace",
    {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        },
        "required": ["path", "content"],
    },
    handle_write_file,
)

_registry.register(
    "list_directory",
    "List files and directories at a given path within the allowed workspace",
    {
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "required": ["path"],
    },
    handle_list_directory,
)

_registry.register(
    "get_workflow",
    "Fetch a workflow definition by ID",
    {
        "type": "object",
        "properties": {"workflow_id": {"type": "string"}},
        "required": ["workflow_id"],
    },
    handle_get_workflow,
)

_registry.register(
    "run_workflow",
    "Trigger immediate execution of a workflow by ID",
    {
        "type": "object",
        "properties": {"workflow_id": {"type": "string"}},
        "required": ["workflow_id"],
    },
    handle_run_workflow,
)

_registry.register(
    "list_agents",
    "List all registered AI agents",
    {"type": "object", "properties": {}},
    handle_list_agents,
)

_registry.register(
    "spawn_agent",
    "Create and register a new AI agent",
    {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"],
    },
    handle_spawn_agent,
)

_registry.register(
    "analyze_react_component",
    "Analyze a React component for best practices and potential issues",
    {
        "type": "object",
        "properties": {
            "component_name": {"type": "string"},
            "file_path": {"type": "string"},
        },
        "required": ["component_name"],
    },
    handle_analyze_react_component,
)

_registry.register(
    "analyze_django_models",
    "Analyze Django models for schema issues and optimization opportunities",
    {
        "type": "object",
        "properties": {"app_name": {"type": "string"}},
    },
    handle_analyze_django_models,
)

_registry.register(
    "analyze_fastapi_routes",
    "Analyze FastAPI routes for security and performance issues",
    {
        "type": "object",
        "properties": {},
    },
    handle_analyze_fastapi_routes,
)

_registry.register(
    "get_react_project_health",
    "Get comprehensive health metrics for a React project",
    {
        "type": "object",
        "properties": {},
    },
    handle_get_react_project_health,
)

_registry.register(
    "scaffold_react_component",
    "Generate scaffolding for a new React component with boilerplate",
    {
        "type": "object",
        "properties": {
            "component_name": {"type": "string"},
            "component_type": {"type": "string", "enum": ["functional", "class"]},
        },
        "required": ["component_name"],
    },
    handle_scaffold_react_component,
)

_registry.register(
    "check_django_security",
    "Check Django project configuration for security best practices",
    {
        "type": "object",
        "properties": {},
    },
    handle_check_django_security,
)

_executor = ToolExecutor(_registry)
_start_time = time.time()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ToolCallRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    params: Optional[Dict[str, Any]] = None

    def effective_params(self) -> Dict[str, Any]:
        """Return params dict, falling back to extra fields in the request body."""
        if self.params is not None:
            return self.params
        extra = self.model_extra or {}
        return {k: v for k, v in extra.items() if k != "params"}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/mcp/tools")
def list_tools():
    """Return all registered MCP tool definitions."""
    tools = _registry.list_tools()
    return {"tools": tools, "total": len(tools)}


@router.get("/mcp/resources")
def list_resources():
    """Return available MCP resource types."""
    resources = [
        {"uri": "file://workspace", "name": "Workspace Files", "type": "filesystem"},
        {"uri": "db://workflows", "name": "Workflows", "type": "database"},
        {"uri": "db://agents", "name": "Agents", "type": "database"},
        {"uri": "db://projects", "name": "Projects", "type": "database"},
    ]
    return {"resources": resources}


@router.get("/mcp/status")
def mcp_status():
    """Return MCP server health and statistics."""
    return {
        "initialized": True,
        "tool_count": _registry.tool_count,
        "uptime_seconds": round(time.time() - _start_time, 2),
        "status": "ok",
    }


@router.post("/mcp/call/{tool_name}")
async def call_tool(tool_name: str, request: ToolCallRequest = ToolCallRequest()):
    """Execute a named MCP tool with the provided params."""
    if _registry.get_tool(tool_name) is None:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    try:
        result = await _executor.execute(tool_name, request.effective_params())
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result
