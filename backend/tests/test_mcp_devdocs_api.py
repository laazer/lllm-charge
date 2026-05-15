"""
Tests for MIG-005: Port MCP Tools and DevDocs APIs to Python.

Acceptance criteria:
  - GET /mcp/tools returns ≥4 tool definitions with name, description, parameters
  - POST /mcp/call/hybrid_reasoning delegates to HybridRouter
  - POST /mcp/call/read_file returns contents for whitelisted path; 403 for outside workspace
  - GET /mcp/status returns initialized:true and accurate tool_count
  - GET /api/devdocs/languages returns available cached languages
  - POST /api/devdocs/search {query, language} returns matching entries
  - DevDocs cache stored in data/devdocs/ and reused
"""
import json
import os
import tempfile
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient


# ─── ToolRegistry unit tests ──────────────────────────────────────────────────

class TestToolRegistry:
    def test_register_and_list_tool(self):
        """Registered tool appears in list_tools()."""
        from app.mcp.registry import ToolRegistry
        registry = ToolRegistry()
        registry.register("my_tool", "Does things", {"type": "object"}, lambda p: {"result": "ok"})
        tools = registry.list_tools()
        assert any(t["name"] == "my_tool" for t in tools)

    def test_each_tool_has_required_fields(self):
        """Each tool dict has name, description, and parameters keys."""
        from app.mcp.registry import ToolRegistry
        registry = ToolRegistry()
        registry.register("tool_a", "A tool", {"type": "object", "properties": {}}, lambda p: {})
        for tool in registry.list_tools():
            assert "name" in tool
            assert "description" in tool
            assert "parameters" in tool

    def test_get_tool_returns_none_for_unknown(self):
        """get_tool() returns None for an unregistered name."""
        from app.mcp.registry import ToolRegistry
        registry = ToolRegistry()
        assert registry.get_tool("nonexistent") is None

    def test_get_tool_returns_registered_tool(self):
        """get_tool() returns the handler for a registered tool."""
        from app.mcp.registry import ToolRegistry
        registry = ToolRegistry()
        handler = lambda p: {"ok": True}
        registry.register("found_it", "desc", {}, handler)
        result = registry.get_tool("found_it")
        assert result is not None


# ─── ToolExecutor unit tests ──────────────────────────────────────────────────

class TestToolExecutor:
    def test_execute_unknown_tool_raises_error(self):
        """Executing an unknown tool raises KeyError or returns error dict."""
        from app.mcp.registry import ToolRegistry
        from app.mcp.executor import ToolExecutor
        registry = ToolRegistry()
        executor = ToolExecutor(registry)
        import asyncio
        result = asyncio.run(executor.execute("no_such_tool", {}))
        assert "error" in result

    def test_execute_known_tool_returns_result(self):
        """Executing a registered tool returns its handler's output."""
        from app.mcp.registry import ToolRegistry
        from app.mcp.executor import ToolExecutor
        import asyncio
        registry = ToolRegistry()
        async def my_handler(params):
            return {"data": "hello"}
        registry.register("greeter", "Says hello", {}, my_handler)
        executor = ToolExecutor(registry)
        result = asyncio.run(executor.execute("greeter", {}))
        assert result.get("data") == "hello"


# ─── GET /mcp/tools ───────────────────────────────────────────────────────────

class TestMCPToolsEndpoint:
    def test_tools_returns_200(self, test_client: TestClient):
        """GET /mcp/tools returns 200."""
        response = test_client.get("/mcp/tools")
        assert response.status_code == 200

    def test_tools_returns_at_least_four(self, test_client: TestClient):
        """GET /mcp/tools returns ≥4 tool definitions."""
        response = test_client.get("/mcp/tools")
        data = response.json()
        tools = data.get("tools", data)
        assert isinstance(tools, list)
        assert len(tools) >= 4

    def test_each_tool_has_name_description_parameters(self, test_client: TestClient):
        """Each tool entry has name, description, and parameters fields."""
        response = test_client.get("/mcp/tools")
        data = response.json()
        tools = data.get("tools", data)
        for tool in tools:
            assert "name" in tool
            assert "description" in tool
            assert "parameters" in tool


# ─── GET /mcp/status ─────────────────────────────────────────────────────────

class TestMCPStatusEndpoint:
    def test_status_returns_200(self, test_client: TestClient):
        """GET /mcp/status returns 200."""
        response = test_client.get("/mcp/status")
        assert response.status_code == 200

    def test_status_has_initialized_true(self, test_client: TestClient):
        """GET /mcp/status includes initialized: true."""
        response = test_client.get("/mcp/status")
        data = response.json()
        assert data.get("initialized") is True

    def test_status_has_accurate_tool_count(self, test_client: TestClient):
        """tool_count matches the number of tools in GET /mcp/tools."""
        status = test_client.get("/mcp/status").json()
        tools = test_client.get("/mcp/tools").json()
        tool_list = tools.get("tools", tools)
        assert status.get("tool_count") == len(tool_list)


# ─── POST /mcp/call/read_file ─────────────────────────────────────────────────

class TestMCPReadFileTool:
    def test_read_file_returns_contents(self, test_client: TestClient, tmp_path):
        """POST /mcp/call/read_file returns file contents for an allowed path."""
        # Write a temp file and call via the MCP route
        test_file = tmp_path / "sample.txt"
        test_file.write_text("hello world")
        response = test_client.post(
            "/mcp/call/read_file",
            json={"params": {"path": str(test_file)}},
        )
        assert response.status_code == 200
        data = response.json()
        assert "hello world" in str(data)

    def test_read_file_rejects_path_traversal(self, test_client: TestClient):
        """POST /mcp/call/read_file returns 403 for paths outside allowed roots."""
        response = test_client.post(
            "/mcp/call/read_file",
            json={"params": {"path": "/etc/passwd"}},
        )
        assert response.status_code in (200, 403)
        if response.status_code == 200:
            data = response.json()
            # Must contain an error key if not 403
            assert "error" in data


# ─── POST /mcp/call/hybrid_reasoning (already wired via MIG-001) ─────────────

class TestMCPHybridReasoningTool:
    def test_hybrid_reasoning_returns_200(self, test_client: TestClient):
        """POST /mcp/call/hybrid_reasoning returns 200."""
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_c:
            mock_c.return_value = {"text": "hi", "provider": "ollama", "model": "llama2", "latency_ms": 5}
            response = test_client.post("/mcp/call/hybrid_reasoning", json={"prompt": "hello"})
        assert response.status_code == 200

    def test_hybrid_reasoning_returns_provider(self, test_client: TestClient):
        """Response includes provider field."""
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_c:
            mock_c.return_value = {"text": "ok", "provider": "ollama", "model": "llama2", "latency_ms": 5}
            response = test_client.post("/mcp/call/hybrid_reasoning", json={"prompt": "test"})
        assert "provider" in response.json()


# ─── GET /mcp/resources ──────────────────────────────────────────────────────

class TestMCPResourcesEndpoint:
    def test_resources_returns_200(self, test_client: TestClient):
        """GET /mcp/resources returns 200."""
        response = test_client.get("/mcp/resources")
        assert response.status_code == 200

    def test_resources_returns_list(self, test_client: TestClient):
        """Response contains a resources list."""
        response = test_client.get("/mcp/resources")
        data = response.json()
        resources = data.get("resources", data)
        assert isinstance(resources, list)


# ─── DevDocs: ToolRegistry unit tests ────────────────────────────────────────

class TestDevDocsCache:
    def test_search_returns_empty_for_uncached_language(self, tmp_path):
        """search() returns [] when no index is cached for a language."""
        from app.devdocs.cache import DevDocsCache
        cache = DevDocsCache(cache_dir=str(tmp_path))
        results = cache.search("nonexistent_lang_xyz", "anything")
        assert results == []

    def test_search_finds_matching_entries(self, tmp_path):
        """search() returns entries whose name/path contains the query."""
        from app.devdocs.cache import DevDocsCache
        cache = DevDocsCache(cache_dir=str(tmp_path))
        # Manually seed an index file
        lang_dir = tmp_path / "python"
        lang_dir.mkdir()
        index = {
            "entries": [
                {"name": "asyncio.run", "path": "asyncio#asyncio.run", "type": "Method"},
                {"name": "os.path", "path": "os.path", "type": "Module"},
            ]
        }
        (lang_dir / "index.json").write_text(json.dumps(index))
        results = cache.search("python", "asyncio")
        assert len(results) >= 1
        assert any("asyncio" in r.get("name", "") for r in results)

    def test_list_languages_returns_cached_dirs(self, tmp_path):
        """list_languages() returns dirs that have an index.json."""
        from app.devdocs.cache import DevDocsCache
        cache = DevDocsCache(cache_dir=str(tmp_path))
        (tmp_path / "python").mkdir()
        (tmp_path / "python" / "index.json").write_text('{"entries": []}')
        (tmp_path / "javascript").mkdir()
        (tmp_path / "javascript" / "index.json").write_text('{"entries": []}')
        langs = cache.list_languages()
        assert "python" in langs
        assert "javascript" in langs


# ─── GET /api/devdocs/languages ──────────────────────────────────────────────

class TestDevDocsLanguagesEndpoint:
    def test_languages_returns_200(self, test_client: TestClient):
        """GET /api/devdocs/languages returns 200."""
        response = test_client.get("/api/devdocs/languages")
        assert response.status_code == 200

    def test_languages_returns_list(self, test_client: TestClient):
        """Response contains a languages list."""
        response = test_client.get("/api/devdocs/languages")
        data = response.json()
        languages = data.get("languages", data)
        assert isinstance(languages, list)


# ─── POST /api/devdocs/search ────────────────────────────────────────────────

class TestDevDocsSearchEndpoint:
    def test_search_returns_200(self, test_client: TestClient):
        """POST /api/devdocs/search returns 200."""
        response = test_client.post(
            "/api/devdocs/search",
            json={"query": "async", "language": "python"},
        )
        assert response.status_code == 200

    def test_search_returns_results_list(self, test_client: TestClient):
        """POST /api/devdocs/search returns a results list."""
        response = test_client.post(
            "/api/devdocs/search",
            json={"query": "list", "language": "python"},
        )
        data = response.json()
        results = data.get("results", data)
        assert isinstance(results, list)

    def test_search_missing_query_returns_422(self, test_client: TestClient):
        """POST /api/devdocs/search without query field returns 422."""
        response = test_client.post("/api/devdocs/search", json={"language": "python"})
        assert response.status_code == 422
