"""MCP-002: Verify all MCP/MIG routers load cleanly and routes are live."""
from __future__ import annotations

import importlib
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# All routers importable
# ---------------------------------------------------------------------------

CRITICAL_ROUTERS = [
    "app.api.mcp_router",
    "app.api.cron",
    "app.api.devdocs",
    "app.api.buddies",
    "app.api.memory",
    "app.api.reasoning",
    "app.api.blender",
    "app.api.codegraph",
    "app.api.filesystem",
    "app.api.tools",
    "app.api.assets",
    "app.api.system",
]


@pytest.mark.parametrize("module_path", CRITICAL_ROUTERS)
def test_router_importable(module_path: str):
    mod = importlib.import_module(module_path)
    assert hasattr(mod, "router"), f"{module_path} must export 'router'"


# ---------------------------------------------------------------------------
# Heavy imports deferred — hybrid_reasoning module-level must not instantiate router
# ---------------------------------------------------------------------------

class TestHybridReasoningDeferredImports:
    def test_module_imports_without_provider_side_effects(self):
        """Re-importing should not raise even if providers are unavailable."""
        import importlib
        import app.mcp.tools.hybrid_reasoning as mod
        importlib.reload(mod)  # if module-level instantiation fails, this raises

    def test_no_module_level_router_instance(self):
        """_router should be created lazily, not at import time."""
        import app.mcp.tools.hybrid_reasoning as mod
        # If _router exists at module level it was eagerly created — check it's lazy
        source = (
            __import__("pathlib").Path(mod.__file__).read_text()
        )
        # The global assignment `_router = HybridRouter(...)` must not appear
        assert "_router = HybridRouter(" not in source, (
            "HybridRouter must not be instantiated at module level — defer to handler"
        )


# ---------------------------------------------------------------------------
# All expected routes present in app
# ---------------------------------------------------------------------------

EXPECTED_ROUTES = [
    "/mcp/tools",
    "/mcp/resources",
    "/mcp/status",
    "/mcp/call/{tool_name}",
    "/api/cron/jobs",
    "/api/devdocs/search",
    "/api/devdocs/languages",
    "/api/buddies",
    "/api/memory/notes",
    "/api/reasoning/stats",
]


@pytest.fixture(scope="module")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def live_paths(client):
    return {r.path for r in __import__("app.main", fromlist=["app"]).app.routes}


@pytest.mark.parametrize("expected_path", EXPECTED_ROUTES)
def test_route_registered(expected_path: str, live_paths):
    assert expected_path in live_paths, (
        f"Route '{expected_path}' not found in app. Registered: {sorted(live_paths)}"
    )


# ---------------------------------------------------------------------------
# End-to-end: /mcp/call/ execution
# ---------------------------------------------------------------------------

class TestMcpCallExecution:
    def test_call_list_directory_tmp(self, client):
        resp = client.post("/mcp/call/list_directory", json={"params": {"path": "/tmp"}})
        assert resp.status_code == 200
        data = resp.json()
        assert "entries" in data or "error" not in data

    def test_call_read_file_returns_content(self, client, tmp_path):
        f = tmp_path / "mcp_test.txt"
        f.write_text("hello mcp")
        resp = client.post("/mcp/call/read_file", json={"params": {"path": str(f)}})
        assert resp.status_code == 200
        assert resp.json().get("content") == "hello mcp"

    def test_call_write_file_creates_file(self, client, tmp_path):
        out = tmp_path / "written.txt"
        resp = client.post(
            "/mcp/call/write_file",
            json={"params": {"path": str(out), "content": "written by mcp"}},
        )
        assert resp.status_code == 200
        assert resp.json().get("written") is True
        assert out.read_text() == "written by mcp"

    def test_call_unknown_tool_returns_404(self, client):
        resp = client.post("/mcp/call/nonexistent_tool", json={})
        assert resp.status_code == 404

    def test_call_hybrid_reasoning_route_reachable(self, client):
        # /mcp/call/hybrid_reasoning is a dedicated route with flat body (not params-wrapped)
        # In test environments providers (Ollama/Anthropic) may be unavailable, so we only
        # assert the route exists (not 404) and parses the request (not 422).
        resp = client.post(
            "/mcp/call/hybrid_reasoning",
            json={"prompt": "say hi", "complexity": "simple"},
        )
        assert resp.status_code != 404, "Route must exist"
        assert resp.status_code != 422, "Route must accept valid body"


# ---------------------------------------------------------------------------
# /mcp/status reflects real tool count
# ---------------------------------------------------------------------------

class TestMcpStatus:
    def test_status_tool_count_matches_tools_list(self, client):
        status = client.get("/mcp/status").json()
        tools = client.get("/mcp/tools").json()
        assert status["tool_count"] == tools["total"]

    def test_status_initialized_true(self, client):
        assert client.get("/mcp/status").json()["initialized"] is True
