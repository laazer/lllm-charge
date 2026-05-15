"""MCP Tool Registry — stores tool definitions and their handlers."""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional


class ToolRegistry:
    """Central registry for all MCP tools."""

    def __init__(self) -> None:
        self._tools: Dict[str, Dict[str, Any]] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters_schema: Dict[str, Any],
        handler: Callable,
    ) -> None:
        """Register a tool with its name, description, JSON-schema, and async handler."""
        self._tools[name] = {
            "name": name,
            "description": description,
            "parameters": parameters_schema,
            "handler": handler,
        }

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        """Return the full tool record or None if not registered."""
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        """Return all tool definitions (without the internal handler key)."""
        return [
            {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}
            for t in self._tools.values()
        ]

    @property
    def tool_count(self) -> int:
        return len(self._tools)


# Singleton registry used across the application
registry = ToolRegistry()
