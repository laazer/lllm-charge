"""MCP tools package."""
from __future__ import annotations
from typing import Any, Dict, List


def get_available_tools() -> List[Dict[str, Any]]:
    """Return all registered tools — backward-compat for main.py."""
    from app.api.mcp_router import _registry
    return _registry.list_tools()
