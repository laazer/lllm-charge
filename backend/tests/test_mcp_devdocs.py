"""
Tests for MIG-005: MCP Tools and DevDocs APIs

Acceptance criteria:
  - GET /mcp/tools returns ≥4 tool definitions with name, description, parameters
  - POST /mcp/call/hybrid_reasoning executes via HybridRouter
  - POST /mcp/call/read_file returns file contents; rejects outside-workspace paths
  - GET /mcp/status returns initialized=true and accurate tool_count
  - GET /api/devdocs/languages returns available languages
  - POST /api/devdocs/search returns matching entries
  - DevDocs cache stored in data/devdocs/ and reused
  - Unit tests mock HTTP fetches for devdocs
"""
import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient


# ─── MCP Tools list ──────────────────────────────────────────────────────────

class TestMCPToolsList:
    def test_tools_endpoint_returns_200(self, test_client: TestClient):
        response = test_client.get("/mcp/tools")
        assert response.status_code == 200

    def test_tools_returns_at_least_4_tools(self, test_client: TestClient):
        response = test_client.get("/mcp/tools")
        data = response.json()
        tools = data.get("tools", data)
        assert isinstance(tools, list)
        assert len(tools) >= 4

    def test_each_tool_has_required_fields(self, test_client: TestClient):
        response = test_client.get("/mcp/tools")
        data = response.json()
        tools = data.get("tools", data)
        for tool in tools:
            assert "name" in tool
            assert "description" in tool

    def test_tools_includes_hybrid_reasoning(self, test_client: TestClient):
        response = test_client.get("/mcp/tools")
        data = response.json()
        tools = data.get("tools", data)
        names = [t["name"] for t in tools]
        assert "hybrid_reasoning" in names

    def test_tools_includes_filesystem_tools(self, test_client: TestClient):
        response = test_client.get("/mcp/tools")
        data = response.json()
        tools = data.get("tools", data)
        names = [t["name"] for t in tools]
        assert "read_file" in names


# ─── MCP Status ──────────────────────────────────────────────────────────────

class TestMCPStatus:
    def test_status_returns_200(self, test_client: TestClient):
        response = test_client.get("/mcp/status")
        assert response.status_code == 200

    def test_status_initialized_is_true(self, test_client: TestClient):
        response = test_client.get("/mcp/status")
        data = response.json()
        assert data.get("initialized") is True

    def test_status_tool_count_matches_tools_list(self, test_client: TestClient):
        tools_response = test_client.get("/mcp/tools")
        tools = tools_response.json().get("tools", tools_response.json())
        status_response = test_client.get("/mcp/status")
        status = status_response.json()
        assert status.get("tool_count") == len(tools)


# ─── MCP Call: hybrid_reasoning ─────────────────────────────────────────────

class TestMCPCallHybridReasoning:
    def test_call_hybrid_reasoning_returns_200(self, test_client: TestClient):
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock:
            mock.return_value = {"text": "test response", "provider": "mock", "latency_ms": 10}
            response = test_client.post(
                "/mcp/call/hybrid_reasoning",
                json={"prompt": "hello"}
            )
        assert response.status_code == 200

    def test_call_hybrid_reasoning_returns_text(self, test_client: TestClient):
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock:
            mock.return_value = {"text": "hello world", "provider": "ollama", "latency_ms": 20}
            response = test_client.post(
                "/mcp/call/hybrid_reasoning",
                json={"prompt": "hello"}
            )
        data = response.json()
        assert "text" in data or "result" in data

    def test_call_unknown_tool_returns_404(self, test_client: TestClient):
        response = test_client.post("/mcp/call/nonexistent_tool", json={})
        assert response.status_code == 404


# ─── MCP Call: read_file ─────────────────────────────────────────────────────

class TestMCPCallReadFile:
    def test_read_file_returns_contents(self, test_client: TestClient, tmp_path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("hello content")
        response = test_client.post(
            "/mcp/call/read_file",
            json={"path": str(test_file)}
        )
        assert response.status_code == 200
        data = response.json()
        result = data.get("result", data)
        content = result.get("content", result) if isinstance(result, dict) else result
        assert "hello content" in str(content)

    def test_read_file_rejects_outside_workspace(self, test_client: TestClient):
        response = test_client.post(
            "/mcp/call/read_file",
            json={"path": "/etc/passwd"}
        )
        # The implementation returns 200 with an error payload for disallowed paths
        data = response.json()
        result = data.get("result", data)
        assert "error" in str(result).lower() or response.status_code in (400, 403)


# ─── MCP Resources ───────────────────────────────────────────────────────────

class TestMCPResources:
    def test_resources_returns_200(self, test_client: TestClient):
        response = test_client.get("/mcp/resources")
        assert response.status_code == 200

    def test_resources_returns_list(self, test_client: TestClient):
        response = test_client.get("/mcp/resources")
        data = response.json()
        resources = data.get("resources", data)
        assert isinstance(resources, list)


# ─── DevDocs languages ────────────────────────────────────────────────────────

class TestDevDocsLanguages:
    def test_languages_returns_200(self, test_client: TestClient):
        response = test_client.get("/api/devdocs/languages")
        assert response.status_code == 200

    def test_languages_returns_list(self, test_client: TestClient):
        response = test_client.get("/api/devdocs/languages")
        data = response.json()
        languages = data.get("languages", data)
        assert isinstance(languages, list)


# ─── DevDocs search ──────────────────────────────────────────────────────────

class TestDevDocsSearch:
    def test_search_returns_200(self, test_client: TestClient):
        mock_index = {
            "entries": [
                {"name": "async", "path": "functions/async", "type": "function"},
                {"name": "asyncio", "path": "library/asyncio", "type": "module"},
            ]
        }
        with patch("app.devdocs.cache.DevDocsCache.get_or_fetch", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_index
            response = test_client.post(
                "/api/devdocs/search",
                json={"query": "async", "language": "python"}
            )
        assert response.status_code == 200

    def test_search_returns_matching_entries(self, test_client: TestClient):
        mock_index = {
            "entries": [
                {"name": "asyncio.run", "path": "library/asyncio", "type": "function"},
                {"name": "list", "path": "functions/list", "type": "function"},
            ]
        }
        with patch("app.devdocs.cache.DevDocsCache.get_or_fetch", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_index
            response = test_client.post(
                "/api/devdocs/search",
                json={"query": "asyncio", "language": "python"}
            )
        data = response.json()
        results = data.get("results", data)
        assert isinstance(results, list)
        assert len(results) >= 1
        result_names = [r.get("name", r.get("title", "")) for r in results]
        assert any("asyncio" in name.lower() for name in result_names)

    def test_search_missing_query_returns_422(self, test_client: TestClient):
        response = test_client.post("/api/devdocs/search", json={"language": "python"})
        assert response.status_code == 422

    def test_search_missing_language_returns_422(self, test_client: TestClient):
        response = test_client.post("/api/devdocs/search", json={"query": "async"})
        assert response.status_code == 422
