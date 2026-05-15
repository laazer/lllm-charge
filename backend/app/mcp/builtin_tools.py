"""Register all built-in MCP tools into the singleton registry."""
from __future__ import annotations
from app.mcp.registry import registry
from app.mcp.tools.filesystem import read_file, write_file, list_directory
from app.mcp.tools.workflow_tool import get_workflow, run_workflow
from app.mcp.tools.agent_tool import list_agents, spawn_agent


def register_builtin_tools() -> None:
    """Register all built-in tools. Idempotent — safe to call multiple times."""
    if registry.get_tool("hybrid_reasoning"):
        return  # already registered

    # Hybrid reasoning (async — handler registered by reasoning module)
    async def hybrid_reasoning_handler(prompt: str, prefer_local: bool = True, complexity: str = "simple", **_):
        from app.reasoning.hybrid_router import HybridRouter
        router = HybridRouter()
        return await router.complete(prompt, prefer_local=prefer_local, complexity=complexity)

    registry.register(
        name="hybrid_reasoning",
        description="Route a prompt to the best available LLM (local or cloud).",
        parameters={"prompt": {"type": "string"}, "prefer_local": {"type": "boolean"}, "complexity": {"type": "string"}},
        handler=hybrid_reasoning_handler,
        category="reasoning",
    )

    registry.register(
        name="read_file",
        description="Read the contents of a file within the workspace.",
        parameters={"path": {"type": "string", "description": "Absolute or relative file path"}},
        handler=read_file,
        category="filesystem",
    )

    registry.register(
        name="write_file",
        description="Write content to a file within the workspace.",
        parameters={"path": {"type": "string"}, "content": {"type": "string"}},
        handler=write_file,
        category="filesystem",
    )

    registry.register(
        name="list_directory",
        description="List entries in a directory within the workspace.",
        parameters={"path": {"type": "string"}},
        handler=list_directory,
        category="filesystem",
    )

    registry.register(
        name="get_workflow",
        description="Retrieve workflow information by ID.",
        parameters={"workflow_id": {"type": "string"}},
        handler=get_workflow,
        category="workflows",
    )

    registry.register(
        name="run_workflow",
        description="Trigger a workflow execution.",
        parameters={"workflow_id": {"type": "string"}, "inputs": {"type": "object"}},
        handler=run_workflow,
        category="workflows",
    )

    registry.register(
        name="list_agents",
        description="List all available agents.",
        parameters={},
        handler=list_agents,
        category="agents",
    )

    registry.register(
        name="spawn_agent",
        description="Spawn a new agent with the given name and role.",
        parameters={"name": {"type": "string"}, "role": {"type": "string"}},
        handler=spawn_agent,
        category="agents",
    )
