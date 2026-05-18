"""
MCP HTTP API routes with detailed metrics tracking.

Exposes the tool registry over HTTP so frontend clients can discover and
invoke tools without going through the stdio MCP protocol. Tracks metrics
like tool usage, errors, uptime, and system resources.
"""
from __future__ import annotations

import time
import psutil
import os
from typing import Any, Dict, Optional
from collections import defaultdict
from datetime import datetime

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
# MCP Metrics Tracking (replaces old Node.js tracking)
# ---------------------------------------------------------------------------

class MCPMetrics:
    """Track MCP server metrics for monitoring and debugging"""
    def __init__(self):
        self.start_time = time.time()
        self.total_calls = 0
        self.total_errors = 0
        self.tool_usage: Dict[str, int] = defaultdict(int)
        self.tool_errors: Dict[str, int] = defaultdict(int)
        self.request_count = 0
        self.websocket_clients = 0

        # Cache sizes (simulated for now)
        self.code_graph_cache = 0
        self.docs_cache = 0
        self.memory_graph = 0

    def record_tool_call(self, tool_name: str):
        """Record a tool was called"""
        self.total_calls += 1
        self.tool_usage[tool_name] += 1

    def record_tool_error(self, tool_name: str):
        """Record a tool call errored"""
        self.total_errors += 1
        self.tool_errors[tool_name] += 1

    def record_request(self):
        """Record an HTTP request"""
        self.request_count += 1

    def get_uptime_ms(self) -> float:
        """Get uptime in milliseconds"""
        return (time.time() - self.start_time) * 1000

    def format_uptime(self) -> str:
        """Format uptime as human readable string"""
        uptime_seconds = int(self.get_uptime_ms() / 1000)
        seconds = uptime_seconds % 60
        minutes = (uptime_seconds // 60) % 60
        hours = (uptime_seconds // 3600) % 24
        days = uptime_seconds // 86400

        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        if minutes > 0:
            return f"{minutes}m {seconds}s"
        return f"{seconds}s"

    def get_error_rate(self) -> float:
        """Get error rate as percentage"""
        if self.total_calls == 0:
            return 0.0
        return round((self.total_errors / self.total_calls) * 100, 2)

    def get_most_used_tools(self, limit: int = 5) -> list:
        """Get most used tools"""
        sorted_tools = sorted(self.tool_usage.items(), key=lambda x: x[1], reverse=True)
        return [
            {"name": name, "count": count, "lastUsed": datetime.now().isoformat()}
            for name, count in sorted_tools[:limit]
        ]

    def get_tools_with_errors(self) -> list:
        """Get tools that have errored"""
        return [
            {"name": name, "errorCount": count}
            for name, count in sorted(self.tool_errors.items(), key=lambda x: x[1], reverse=True)
        ]

    def get_system_memory_usage(self) -> dict:
        """Get system memory usage"""
        try:
            process = psutil.Process(os.getpid())
            mem_info = process.memory_info()
            return {
                "rss": mem_info.rss,
                "heapUsed": mem_info.rss,  # Python doesn't have separate heap tracking
                "heapTotal": mem_info.vms,  # Virtual memory as approximation
                "external": 0,
            }
        except:
            return {"rss": 0, "heapUsed": 0, "heapTotal": 0, "external": 0}


# Global metrics instance
_metrics = MCPMetrics()

# ---------------------------------------------------------------------------
# Build the shared registry and executor at module load time
# ---------------------------------------------------------------------------

_registry = ToolRegistry()
_executor = ToolExecutor(_registry)
_start_time = time.time()

# Register all tools...
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
    "Execute a workflow by ID with given inputs",
    {
        "type": "object",
        "properties": {
            "workflow_id": {"type": "string"},
            "inputs": {"type": "object"},
        },
        "required": ["workflow_id"],
    },
    handle_run_workflow,
)

_registry.register(
    "list_agents",
    "List all available agents",
    {"type": "object", "properties": {}},
    handle_list_agents,
)

_registry.register(
    "spawn_agent",
    "Create and run a new agent with specified configuration",
    {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "agent_type": {"type": "string"},
            "config": {"type": "object"},
        },
        "required": ["name"],
    },
    handle_spawn_agent,
)

_registry.register(
    "analyze_react_component",
    "Analyze a React component for performance and best practices",
    {
        "type": "object",
        "properties": {"component_path": {"type": "string"}},
        "required": ["component_path"],
    },
    handle_analyze_react_component,
)

_registry.register(
    "analyze_django_models",
    "Analyze Django models for schema issues",
    {
        "type": "object",
        "properties": {"project_path": {"type": "string"}},
        "required": ["project_path"],
    },
    handle_analyze_django_models,
)

_registry.register(
    "analyze_fastapi_routes",
    "Analyze FastAPI routes for consistency",
    {
        "type": "object",
        "properties": {"project_path": {"type": "string"}},
        "required": ["project_path"],
    },
    handle_analyze_fastapi_routes,
)

_registry.register(
    "get_react_project_health",
    "Get overall health metrics for a React project",
    {
        "type": "object",
        "properties": {"project_path": {"type": "string"}},
        "required": ["project_path"],
    },
    handle_get_react_project_health,
)

_registry.register(
    "scaffold_react_component",
    "Generate a new React component with boilerplate",
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
    "Check Django project for security issues",
    {
        "type": "object",
        "properties": {"project_path": {"type": "string"}},
        "required": ["project_path"],
    },
    handle_check_django_security,
)

# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class ToolCallRequest(BaseModel):
    """Request to call a tool"""
    params: Optional[Dict[str, Any]] = {}

    def effective_params(self) -> Dict[str, Any]:
        """Get effective parameters"""
        return self.params or {}

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# API Routes with Metrics
# ---------------------------------------------------------------------------

@router.get("/mcp/tools")
def list_tools():
    """Return all registered MCP tool definitions with usage tracking"""
    _metrics.record_request()

    tools = _registry.list_tools()
    detailed_tools = [
        {
            **tool,
            "category": tool.get("category", "general"),
            "isActive": True,
            "lastUsed": None,
            "usageCount": _metrics.tool_usage.get(tool["name"], 0),
        }
        for tool in tools
    ]

    return {
        "tools": detailed_tools,
        "total": len(detailed_tools),
        "summary": {
            "total": len(detailed_tools),
            "active": len(detailed_tools),
            "categories": list(set(t.get("category", "general") for t in detailed_tools)),
        },
    }


@router.get("/mcp/resources")
def list_resources():
    """Return available MCP resources"""
    _metrics.record_request()

    resources = [
        {"uri": "file://workspace", "name": "Workspace Files", "type": "filesystem", "isAvailable": True},
        {"uri": "db://workflows", "name": "Workflows", "type": "database", "isAvailable": True},
        {"uri": "db://agents", "name": "Agents", "type": "database", "isAvailable": True},
        {"uri": "db://projects", "name": "Projects", "type": "database", "isAvailable": True},
    ]

    return {
        "resources": resources,
        "summary": {
            "total": len(resources),
            "available": len([r for r in resources if r.get("isAvailable")]),
        },
    }


@router.get("/mcp/status")
def mcp_status():
    """Return MCP server health and detailed statistics"""
    _metrics.record_request()

    error_rate = _metrics.get_error_rate()
    uptime_ms = _metrics.get_uptime_ms()

    return {
        "isHealthy": error_rate < 10,
        "uptime": {
            "ms": uptime_ms,
            "formatted": _metrics.format_uptime(),
        },
        "tools": {
            "total": len(_registry.list_tools()),
            "totalCalls": _metrics.total_calls,
            "errors": _metrics.total_errors,
            "errorRate": error_rate,
            "mostUsed": _metrics.get_most_used_tools(),
            "withErrors": _metrics.get_tools_with_errors(),
        },
        "resources": {
            "total": 4,
            "available": 4,
        },
        "cache": {
            "codeGraph": _metrics.code_graph_cache,
            "docs": _metrics.docs_cache,
            "memory": _metrics.memory_graph,
        },
        "system": {
            "totalRequests": _metrics.request_count,
            "webSocketClients": _metrics.websocket_clients,
            "memoryUsage": _metrics.get_system_memory_usage(),
            "nodeVersion": f"Python {__import__('sys').version.split()[0]}",
        },
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/mcp/call/{tool_name}")
async def call_tool(tool_name: str, request: ToolCallRequest = None):
    """Execute a named MCP tool with the provided params"""
    _metrics.record_request()

    if request is None:
        request = ToolCallRequest()

    if _registry.get_tool(tool_name) is None:
        _metrics.record_tool_error(tool_name)
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    try:
        _metrics.record_tool_call(tool_name)
        result = await _executor.execute(tool_name, request.effective_params())
        return result
    except PermissionError as exc:
        _metrics.record_tool_error(tool_name)
        raise HTTPException(status_code=403, detail=str(exc))
    except FileNotFoundError as exc:
        _metrics.record_tool_error(tool_name)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        _metrics.record_tool_error(tool_name)
        raise HTTPException(status_code=500, detail=str(exc))
