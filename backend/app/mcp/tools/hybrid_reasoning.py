"""MCP hybrid_reasoning tool — delegates to HybridRouter."""
from __future__ import annotations
from typing import Any, Dict


def _get_router():
    from app.reasoning.hybrid_router import HybridRouter
    from app.reasoning.providers.ollama import OllamaProvider
    from app.reasoning.providers.anthropic import AnthropicProvider
    return HybridRouter(providers=[OllamaProvider(), AnthropicProvider()])


async def handle_hybrid_reasoning(params: Dict[str, Any]) -> Dict[str, Any]:
    prompt = params.get("prompt", "")
    if not prompt:
        return {"error": "prompt parameter is required"}
    prefer_local = params.get("prefer_local", True)
    complexity = params.get("complexity", "simple")
    router = _get_router()
    result = await router.complete(prompt, prefer_local=prefer_local, complexity=complexity)
    return result
