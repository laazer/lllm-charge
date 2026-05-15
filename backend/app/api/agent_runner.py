"""POST /mcp/agent/run — agentic tool-chaining endpoint."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.mcp.agent_loop import AgentLoop
from app.mcp.executor import ToolExecutor
from app.mcp.registry import ToolRegistry

router = APIRouter(tags=["mcp"])


class AgentRunRequest(BaseModel):
    goal: str
    allowed_tools: List[str] = Field(default_factory=list)
    max_steps: int = Field(default=10, ge=1, le=50)
    prefer_local: bool = False
    complexity: str = "complex"


@router.post("/mcp/agent/run")
async def agent_run(request: AgentRunRequest) -> Dict[str, Any]:
    """Run an agentic loop: LLM calls tools until done or max_steps reached."""
    from app.api.mcp_router import _registry, _executor
    loop = AgentLoop(registry=_registry, executor=_executor)
    return await loop.run(
        goal=request.goal,
        allowed_tools=request.allowed_tools,
        max_steps=request.max_steps,
        prefer_local=request.prefer_local,
        complexity=request.complexity,
    )
