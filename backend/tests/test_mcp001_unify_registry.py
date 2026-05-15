"""MCP-001: Remove stub MCP implementation, unify on real ToolRegistry."""
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).parent.parent
APP_MCP_DIR = BACKEND_ROOT / "app" / "mcp"


# ---------------------------------------------------------------------------
# Stub file deletion
# ---------------------------------------------------------------------------

class TestStubFilesRemoved:
    def test_mcp_server_stub_deleted(self):
        assert not (APP_MCP_DIR / "server.py").exists(), (
            "app/mcp/server.py (MCPServer stub) must be deleted"
        )

    def test_mcp_tools_stub_deleted(self):
        assert not (APP_MCP_DIR / "tools.py").exists(), (
            "app/mcp/tools.py (get_available_tools stub) must be deleted"
        )


# ---------------------------------------------------------------------------
# main.py no longer references stubs
# ---------------------------------------------------------------------------

class TestMainNoStubImports:
    def _main_source(self) -> str:
        return (BACKEND_ROOT / "app" / "main.py").read_text()

    def test_no_mcpserver_import(self):
        assert "MCPServer" not in self._main_source(), (
            "app/main.py must not import MCPServer"
        )

    def test_no_get_available_tools_import(self):
        assert "get_available_tools" not in self._main_source(), (
            "app/main.py must not import get_available_tools"
        )

    def test_no_mcp_server_module_import(self):
        assert "from app.mcp.server" not in self._main_source(), (
            "app/main.py must not import from app.mcp.server"
        )

    def test_no_mcp_tools_module_import(self):
        src = self._main_source()
        assert "from app.mcp.tools import" not in src or "from app.mcp.tools." in src, (
            "app/main.py must not import from app.mcp.tools (the stub module)"
        )

    def test_no_api_mcp_tools_stub_endpoint(self):
        src = self._main_source()
        assert '"/api/mcp/tools"' not in src or "mcp_api_router" in src, (
            "The hardcoded /api/mcp/tools stub endpoint must be removed"
        )


# ---------------------------------------------------------------------------
# Real registry importable
# ---------------------------------------------------------------------------

class TestRealRegistryImportable:
    def test_tool_registry_importable(self):
        from app.mcp.registry import ToolRegistry
        assert ToolRegistry is not None

    def test_tool_executor_importable(self):
        from app.mcp.executor import ToolExecutor
        assert ToolExecutor is not None

    def test_mcp_api_router_importable(self):
        from app.api.mcp_router import router
        assert router is not None

    def test_mcp_api_router_has_routes(self):
        from app.api.mcp_router import router
        paths = [r.path for r in router.routes]
        assert any("/mcp/tools" in p for p in paths), (
            f"mcp_api_router must have /mcp/tools route, got: {paths}"
        )

    def test_mcp_api_router_has_call_endpoint(self):
        from app.api.mcp_router import router
        paths = [r.path for r in router.routes]
        assert any("mcp/call" in p for p in paths), (
            f"mcp_api_router must have /mcp/call/{{tool_name}} route, got: {paths}"
        )


# ---------------------------------------------------------------------------
# Live endpoint returns real tools
# ---------------------------------------------------------------------------

@pytest.fixture()
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


class TestLiveEndpoints:
    def test_mcp_tools_endpoint_exists(self, client):
        resp = client.get("/mcp/tools")
        assert resp.status_code == 200

    def test_mcp_tools_returns_real_tools(self, client):
        resp = client.get("/mcp/tools")
        data = resp.json()
        assert "tools" in data
        tool_names = [t["name"] for t in data["tools"]]
        assert "test_tool" not in tool_names, (
            "Stub test_tool must not appear in /mcp/tools response"
        )
        assert len(tool_names) >= 4, (
            f"Expected at least 4 real tools, got: {tool_names}"
        )

    def test_real_tools_include_filesystem(self, client):
        resp = client.get("/mcp/tools")
        names = [t["name"] for t in resp.json()["tools"]]
        assert "read_file" in names
        assert "write_file" in names
        assert "list_directory" in names

    def test_real_tools_include_hybrid_reasoning(self, client):
        resp = client.get("/mcp/tools")
        names = [t["name"] for t in resp.json()["tools"]]
        assert "hybrid_reasoning" in names

    def test_api_mcp_tools_stub_gone(self, client):
        resp = client.get("/api/mcp/tools")
        assert resp.status_code == 404, (
            f"Stub /api/mcp/tools endpoint must be removed, got {resp.status_code}"
        )

    def test_mcp_call_endpoint_exists(self, client):
        resp = client.post("/mcp/call/list_directory", json={"params": {"path": "/tmp"}})
        assert resp.status_code in (200, 403), (
            f"Expected 200 or 403 from /mcp/call/list_directory, got {resp.status_code}"
        )
