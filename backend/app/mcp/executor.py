"""MCP Tool Executor — dispatches calls to registered tool handlers."""
from __future__ import annotations

import asyncio
import inspect
from typing import Any, Dict

from app.mcp.registry import ToolRegistry


class ToolExecutor:
    """Runs a named tool's handler, wrapping sync handlers in asyncio."""

    def __init__(self, registry: ToolRegistry) -> None:
        self._registry = registry

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the named tool with params; returns its result dict or an error dict."""
        tool = self._registry.get_tool(tool_name)
        if tool is None:
            return {"error": f"Tool '{tool_name}' not found"}

        handler = tool["handler"]
        try:
            if inspect.iscoroutinefunction(handler):
                result = await handler(params)
            else:
                result = handler(params)
            return result if isinstance(result, dict) else {"result": result}
        except PermissionError:
            raise
        except Exception as exc:
            return {"error": str(exc)}
