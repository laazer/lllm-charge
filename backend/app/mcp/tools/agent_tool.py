"""Agent MCP tools — list_agents, spawn_agent."""
from __future__ import annotations
from typing import Any, Dict, List


def list_agents() -> Dict[str, Any]:
    """Return list of available agents."""
    return {"agents": [], "count": 0}


def spawn_agent(name: str, role: str = "assistant") -> Dict[str, Any]:
    """Spawn a new agent."""
    import uuid
    return {"agent_id": str(uuid.uuid4()), "name": name, "role": role, "status": "spawned"}
