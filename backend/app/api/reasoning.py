"""Reasoning API routes — provider status, stats, logs, insights, and the MCP completion endpoint."""
import asyncio
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

from app.reasoning.hybrid_router import HybridRouter
from app.reasoning.providers.ollama import OllamaProvider
from app.reasoning.providers.anthropic import AnthropicProvider

router = APIRouter()

# Shared singleton router used by all endpoints
_default_providers = [OllamaProvider(), AnthropicProvider()]
_hybrid_router: HybridRouter = HybridRouter(providers=_default_providers)


# ── Request / Response models ─────────────────────────────────────────────────

class HybridReasoningRequest(BaseModel):
    prompt: str
    prefer_local: bool = True
    complexity: str = "simple"


# ── Provider status ───────────────────────────────────────────────────────────

@router.get("/api/providers/status")
async def get_providers_status() -> Dict[str, Any]:
    """Return health and metadata for every configured provider."""
    statuses: List[Dict[str, Any]] = []
    for provider in _default_providers:
        try:
            healthy = await asyncio.wait_for(provider.health_check(), timeout=5.0)
        except Exception:
            healthy = False
        statuses.append({
            "name": provider.name,
            "status": "healthy" if healthy else "unhealthy",
            "is_local": provider.is_local,
        })
    return {"providers": statuses}


# ── MCP hybrid_reasoning endpoint ─────────────────────────────────────────────

@router.post("/mcp/call/hybrid_reasoning")
async def hybrid_reasoning(request: HybridReasoningRequest) -> Dict[str, Any]:
    """Route a prompt to the best available provider and return the completion."""
    try:
        return await HybridRouter.complete(
            _hybrid_router,
            request.prompt,
            prefer_local=request.prefer_local,
            complexity=request.complexity,
        )
    except Exception as exc:
        return {"error": str(exc), "prompt": request.prompt}


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/api/reasoning/stats")
async def get_reasoning_stats() -> Dict[str, Any]:
    """Return aggregate routing statistics."""
    return HybridRouter.get_stats(_hybrid_router)


# ── Routing log ───────────────────────────────────────────────────────────────

@router.get("/api/reasoning/logs")
async def get_routing_logs(limit: int = 100) -> Dict[str, Any]:
    """Return the last N routing decisions."""
    log = HybridRouter.get_routing_log(_hybrid_router)
    entries = [
        {
            "prompt_preview": e.prompt_preview,
            "chosen_provider": e.chosen_provider,
            "latency_ms": e.latency_ms,
            "timestamp": e.timestamp,
            "fallback": e.fallback,
        }
        for e in log[-limit:]
    ]
    return {"entries": entries, "total": len(log)}


# ── Routing insights ──────────────────────────────────────────────────────────

@router.get("/api/reasoning/routing-insights")
async def get_routing_insights() -> Dict[str, Any]:
    """Return actionable recommendations for tuning the routing configuration."""
    stats = HybridRouter.get_stats(_hybrid_router)
    recommendations: List[str] = []

    if stats["local_percentage"] < 50:
        recommendations.append(
            "Local usage is below 50% — consider starting an Ollama instance for cost savings."
        )
    if stats["total_requests"] == 0:
        recommendations.append(
            "No requests recorded yet — send a few prompts to populate routing statistics."
        )
    if not recommendations:
        recommendations.append("Routing configuration looks optimal.")

    return {"recommendations": recommendations, "stats": stats}
