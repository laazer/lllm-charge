"""MCP-003: Agentic tool-chaining endpoint — POST /mcp/agent/run."""
from __future__ import annotations

import json
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _llm_response(text: str) -> Dict[str, Any]:
    """Simulate the shape returned by hybrid_reasoning."""
    return {"text": text, "provider": "mock", "cost": 0.0}


def _tool_call_text(tool: str, params: Dict[str, Any]) -> str:
    """LLM response text containing a single tool call block."""
    return f'I need to use a tool.\n```json\n{json.dumps({"tool": tool, "params": params})}\n```'


# ---------------------------------------------------------------------------
# Unit tests — AgentLoop
# ---------------------------------------------------------------------------

class TestAgentLoop:
    @pytest.fixture()
    def registry(self):
        from app.mcp.registry import ToolRegistry
        reg = ToolRegistry()
        reg.register(
            "list_directory", "List dir", {"type": "object", "properties": {"path": {"type": "string"}}},
            AsyncMock(return_value={"entries": [{"name": "foo.gd", "type": "file"}]}),
        )
        reg.register(
            "read_file", "Read file", {"type": "object", "properties": {"path": {"type": "string"}}},
            AsyncMock(return_value={"path": "/tmp/foo.gd", "content": "# placeholder"}),
        )
        return reg

    @pytest.fixture()
    def executor(self, registry):
        from app.mcp.executor import ToolExecutor
        return ToolExecutor(registry)

    @pytest.fixture()
    def loop(self, registry, executor):
        from app.mcp.agent_loop import AgentLoop
        return AgentLoop(registry=registry, executor=executor)

    # ── parse_tool_call ──────────────────────────────────────────────────────

    def test_parse_tool_call_from_json_block(self, loop):
        text = _tool_call_text("read_file", {"path": "/tmp/foo.gd"})
        call = loop.parse_tool_call(text)
        assert call is not None
        assert call["tool"] == "read_file"
        assert call["params"] == {"path": "/tmp/foo.gd"}

    def test_parse_tool_call_returns_none_for_plain_text(self, loop):
        assert loop.parse_tool_call("Hello! I am done.") is None

    def test_parse_tool_call_returns_none_for_malformed_json(self, loop):
        assert loop.parse_tool_call("```json\n{broken```") is None

    # ── allowed_tools enforcement ────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_disallowed_tool_returns_error_step(self, loop):
        result = await loop.run(
            goal="say hi",
            allowed_tools=["read_file"],
            max_steps=3,
            llm_responses=[_tool_call_text("write_file", {"path": "/x", "content": "y"})],
        )
        assert any("not allowed" in str(s.get("result", "")) for s in result["steps"])

    # ── max_steps enforcement ────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_max_steps_truncation(self, loop):
        # Always return a tool call — loop must stop at max_steps
        repeating = [_tool_call_text("list_directory", {"path": "/tmp"})] * 5
        result = await loop.run(
            goal="loop forever",
            allowed_tools=["list_directory"],
            max_steps=2,
            llm_responses=repeating,
        )
        assert result["truncated"] is True
        assert result["steps_taken"] == 2

    # ── successful multi-step execution ─────────────────────────────────────

    @pytest.mark.asyncio
    async def test_multi_step_executes_tools_in_sequence(self, loop):
        responses = [
            _tool_call_text("list_directory", {"path": "/tmp"}),
            _tool_call_text("read_file", {"path": "/tmp/foo.gd"}),
            "All done! Both tools executed.",
        ]
        result = await loop.run(
            goal="list then read",
            allowed_tools=["list_directory", "read_file"],
            max_steps=5,
            llm_responses=responses,
        )
        tools_used = [s["tool"] for s in result["steps"]]
        assert "list_directory" in tools_used
        assert "read_file" in tools_used
        assert result["truncated"] is False
        assert result["final_response"] == "All done! Both tools executed."

    # ── no tool calls → immediate final response ─────────────────────────────

    @pytest.mark.asyncio
    async def test_no_tool_call_returns_final_response_immediately(self, loop):
        result = await loop.run(
            goal="say hello",
            allowed_tools=[],
            max_steps=1,
            llm_responses=["Hello! I am done."],
        )
        assert result["final_response"] == "Hello! I am done."
        assert result["steps"] == []
        assert result["steps_taken"] == 0
        assert result["truncated"] is False

    # ── executor is used, not direct handler calls ───────────────────────────

    @pytest.mark.asyncio
    async def test_uses_executor_for_dispatch(self, loop, executor):
        with patch.object(executor, "execute", wraps=executor.execute) as mock_exec:
            await loop.run(
                goal="list it",
                allowed_tools=["list_directory"],
                max_steps=3,
                llm_responses=[
                    _tool_call_text("list_directory", {"path": "/tmp"}),
                    "Done.",
                ],
            )
        mock_exec.assert_called_once_with("list_directory", {"path": "/tmp"})


# ---------------------------------------------------------------------------
# Integration tests — HTTP endpoint
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


class TestAgentRunEndpoint:
    def test_endpoint_exists(self, client):
        # Even with no LLM available, the endpoint must return 200 (not 404/422)
        with patch("app.mcp.agent_loop.AgentLoop._call_llm", new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = "Hello, I am done."
            resp = client.post(
                "/mcp/agent/run",
                json={"goal": "say hello", "allowed_tools": [], "max_steps": 1},
            )
        assert resp.status_code == 200

    def test_response_has_required_fields(self, client):
        with patch("app.mcp.agent_loop.AgentLoop._call_llm", new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = "Done."
            resp = client.post(
                "/mcp/agent/run",
                json={"goal": "hello", "max_steps": 1},
            )
        data = resp.json()
        assert "steps" in data
        assert "final_response" in data
        assert "steps_taken" in data
        assert "truncated" in data

    def test_max_steps_default_applied(self, client):
        with patch("app.mcp.agent_loop.AgentLoop._call_llm", new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = "Done."
            resp = client.post("/mcp/agent/run", json={"goal": "hello"})
        assert resp.status_code == 200

    def test_invalid_request_returns_422(self, client):
        resp = client.post("/mcp/agent/run", json={})
        assert resp.status_code == 422
