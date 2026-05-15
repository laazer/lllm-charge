"""Agentic tool-chaining loop for MCP-003."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from app.mcp.executor import ToolExecutor
from app.mcp.registry import ToolRegistry

_TOOL_CALL_PATTERN = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL)

_SYSTEM_PROMPT = """\
You are an autonomous agent. To accomplish the goal you may call tools.
When you want to call a tool, respond with ONLY a JSON block:
```json
{"tool": "<tool_name>", "params": {<key>: <value>}}
```
When you are finished, respond with plain text (no JSON block)."""


class AgentLoop:
    """Runs an LLM-driven tool-use loop until completion or max_steps."""

    def __init__(self, registry: ToolRegistry, executor: ToolExecutor) -> None:
        self._registry = registry
        self._executor = executor

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse_tool_call(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract the first tool-call JSON block from LLM text, or None."""
        match = _TOOL_CALL_PATTERN.search(text)
        if not match:
            return None
        try:
            obj = json.loads(match.group(1))
            if "tool" in obj and "params" in obj:
                return obj
        except (json.JSONDecodeError, ValueError):
            pass
        return None

    async def run(
        self,
        goal: str,
        allowed_tools: List[str],
        max_steps: int,
        prefer_local: bool = False,
        complexity: str = "complex",
        llm_responses: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Execute the agentic loop.

        ``llm_responses`` is an optional injection list used in tests to avoid
        real LLM calls. When exhausted the loop treats the last entry as final.
        """
        steps: List[Dict[str, Any]] = []
        context = self._build_initial_context(goal, allowed_tools)
        step_num = 0
        final_response = ""

        while step_num < max_steps:
            llm_text = await self._call_llm(
                context, prefer_local, complexity, llm_responses, step_num
            )
            tool_call = self.parse_tool_call(llm_text)

            if tool_call is None:
                final_response = llm_text.strip()
                break

            tool_name = tool_call["tool"]
            params = tool_call.get("params", {})
            step_num += 1

            if tool_name not in allowed_tools:
                step_record = {
                    "step": step_num,
                    "tool": tool_name,
                    "params": params,
                    "result": {"error": f"Tool '{tool_name}' is not allowed"},
                }
            else:
                result = await self._executor.execute(tool_name, params)
                step_record = {
                    "step": step_num,
                    "tool": tool_name,
                    "params": params,
                    "result": result,
                }

            steps.append(step_record)
            context = self._append_step_to_context(context, step_record)

            if step_num >= max_steps:
                return {
                    "steps": steps,
                    "final_response": "",
                    "steps_taken": step_num,
                    "truncated": True,
                }

        return {
            "steps": steps,
            "final_response": final_response,
            "steps_taken": step_num,
            "truncated": False,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_initial_context(self, goal: str, allowed_tools: List[str]) -> str:
        tool_list = ", ".join(allowed_tools) if allowed_tools else "none"
        return (
            f"{_SYSTEM_PROMPT}\n\n"
            f"Available tools: {tool_list}\n\n"
            f"Goal: {goal}"
        )

    def _append_step_to_context(self, context: str, step: Dict[str, Any]) -> str:
        return (
            f"{context}\n\n"
            f"[Step {step['step']}] Called {step['tool']} → "
            f"{json.dumps(step['result'], ensure_ascii=False)}"
        )

    async def _call_llm(
        self,
        context: str,
        prefer_local: bool,
        complexity: str,
        injected: Optional[List[str]],
        step_index: int,
    ) -> str:
        if injected is not None:
            idx = min(step_index, len(injected) - 1)
            raw = injected[idx]
            return raw.get("text", raw) if isinstance(raw, dict) else str(raw)

        from app.reasoning.hybrid_router import HybridRouter
        from app.reasoning.providers.ollama import OllamaProvider
        from app.reasoning.providers.anthropic import AnthropicProvider

        router = HybridRouter(providers=[OllamaProvider(), AnthropicProvider()])
        try:
            result = await router.complete(
                context, prefer_local=prefer_local, complexity=complexity
            )
            return result.get("text", str(result))
        except Exception as exc:
            return f"LLM unavailable: {exc}"
