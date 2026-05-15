"""Tools configuration API routes."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

# Path to persisted tool config — patched in tests
TOOLS_CONFIG_PATH = str(
    Path(__file__).parent.parent.parent.parent / "data" / "tools-config.json"
)

router = APIRouter(prefix="/api/tools", tags=["tools"])

_DEFAULT_CONFIG: Dict[str, Any] = {
    "enabled": True,
    "max_tools": 20,
    "timeout_seconds": 30,
    "allowed_tools": [],
}

_AVAILABLE_TOOLS: List[Dict[str, Any]] = [
    {"name": "read_file", "description": "Read file contents", "category": "filesystem"},
    {"name": "write_file", "description": "Write file contents", "category": "filesystem"},
    {"name": "list_directory", "description": "List directory entries", "category": "filesystem"},
    {"name": "hybrid_reasoning", "description": "Route prompt to local or cloud LLM", "category": "reasoning"},
    {"name": "list_agents", "description": "List registered agents", "category": "agents"},
    {"name": "spawn_agent", "description": "Spawn a new agent", "category": "agents"},
    {"name": "get_workflow", "description": "Get workflow by ID", "category": "workflows"},
    {"name": "run_workflow", "description": "Execute a workflow", "category": "workflows"},
]


def _load_config() -> Dict[str, Any]:
    config_path = Path(TOOLS_CONFIG_PATH)
    if config_path.exists():
        try:
            return json.loads(config_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT_CONFIG)


def _save_config(config: Dict[str, Any]) -> None:
    config_path = Path(TOOLS_CONFIG_PATH)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")


class ToolConfigUpdate(BaseModel):
    class Config:
        extra = "allow"


@router.get("/config")
def get_tool_config() -> Dict[str, Any]:
    """Return current tool configuration."""
    return _load_config()


@router.put("/config")
def update_tool_config(update: Dict[str, Any]) -> Dict[str, Any]:
    """Merge *update* into the persisted tool configuration and return it."""
    config = _load_config()
    config.update(update)
    _save_config(config)
    return config


@router.get("/available")
def list_available_tools() -> Dict[str, Any]:
    """Return all available tools with their capabilities."""
    return {"tools": _AVAILABLE_TOOLS, "total": len(_AVAILABLE_TOOLS)}


@router.get("/stats")
def get_tool_stats() -> Dict[str, Any]:
    """Return tool usage statistics (currently zeroed — not yet tracked)."""
    return {
        "total_calls": 0,
        "calls_by_tool": {t["name"]: 0 for t in _AVAILABLE_TOOLS},
        "errors": 0,
    }


_PROFILES: List[Dict[str, Any]] = [
    {
        "name": "minimal",
        "description": "Read-only filesystem access only",
        "allowed_tools": ["read_file", "list_directory"],
    },
    {
        "name": "standard",
        "description": "Filesystem read/write + reasoning",
        "allowed_tools": ["read_file", "write_file", "list_directory", "hybrid_reasoning"],
    },
    {
        "name": "full",
        "description": "All tools enabled",
        "allowed_tools": [t["name"] for t in _AVAILABLE_TOOLS],
    },
]


@router.get("/profiles")
def list_tool_profiles() -> Dict[str, Any]:
    """Return available tool profile presets."""
    return {"profiles": _PROFILES}


class NewProfileRequest(BaseModel):
    name: str
    description: str = ""
    allowed_tools: List[str] = []


@router.post("/profiles")
def create_tool_profile(request: NewProfileRequest) -> Dict[str, Any]:
    """Create a new tool profile preset."""
    profile = {
        "name": request.name,
        "description": request.description,
        "allowed_tools": request.allowed_tools,
    }
    _PROFILES.append(profile)
    return {"status": "created", "profile": profile}
