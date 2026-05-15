"""Tests for GODOT-CG-003: CodeGraph API — Godot Integration."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(test_client):
    return test_client


def _make_indexer_mock(
    has_index: bool = True,
    file_count: int = 10,
    symbol_count: int = 80,
    search_results: list | None = None,
) -> MagicMock:
    """Return a pre-configured GodotProjectIndexer mock."""
    mock = MagicMock()
    mock.get_status.return_value = {
        "has_index": has_index,
        "project_root": "/fake/project",
        "file_count": file_count,
        "symbol_count": symbol_count,
        "indexed_at": "2025-01-01T00:00:00+00:00" if has_index else None,
    }
    from app.codegraph.godot_indexer import IndexResult
    mock.index_project.return_value = IndexResult(
        file_count=file_count,
        symbol_count=symbol_count,
        duration_ms=120,
    )
    mock.search.return_value = search_results or [
        {
            "name": "move_and_slide",
            "symbol_type": "function",
            "file_path": "scripts/player.gd",
            "line": 42,
        }
    ]
    return mock


# ─── GET /api/codegraph/godot/status ─────────────────────────────────────────

class TestGodotStatus:
    def test_status_returns_200(self, client: TestClient):
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=_make_indexer_mock()):
            response = client.get("/api/codegraph/godot/status")
        assert response.status_code == 200

    def test_status_no_index_returns_has_index_false(self, client: TestClient, tmp_path):
        mock = _make_indexer_mock(has_index=False)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
                response = client.get("/api/codegraph/godot/status")
        assert response.json()["has_index"] is False

    def test_status_with_index_returns_has_index_true(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True, file_count=5, symbol_count=40)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.get("/api/codegraph/godot/status")
        data = response.json()
        assert data["has_index"] is True

    def test_status_includes_file_and_symbol_counts(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True, file_count=7, symbol_count=55)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.get("/api/codegraph/godot/status")
        data = response.json()
        assert "file_count" in data
        assert "symbol_count" in data


# ─── POST /api/codegraph/godot/index ─────────────────────────────────────────

class TestGodotIndex:
    def test_index_returns_200(self, client: TestClient, tmp_path):
        mock = _make_indexer_mock()
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/index",
                json={"project_path": str(tmp_path)},
            )
        assert response.status_code == 200

    def test_index_returns_stats(self, client: TestClient, tmp_path):
        mock = _make_indexer_mock(file_count=12, symbol_count=90)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/index",
                json={"project_path": str(tmp_path)},
            )
        data = response.json()
        assert "file_count" in data
        assert "symbol_count" in data
        assert "duration_ms" in data

    def test_index_calls_index_project(self, client: TestClient, tmp_path):
        mock = _make_indexer_mock()
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            client.post(
                "/api/codegraph/godot/index",
                json={"project_path": str(tmp_path)},
            )
        mock.index_project.assert_called_once()

    def test_index_creates_indexer_with_project_path(self, client: TestClient, tmp_path):
        mock = _make_indexer_mock()
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock) as MockClass:
            client.post(
                "/api/codegraph/godot/index",
                json={"project_path": str(tmp_path)},
            )
        MockClass.assert_called_once_with(str(tmp_path))


# ─── POST /api/codegraph/godot/search ────────────────────────────────────────

class TestGodotSearch:
    def test_search_returns_200(self, client: TestClient):
        mock = _make_indexer_mock()
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/search",
                json={"query": "move"},
            )
        assert response.status_code == 200

    def test_search_no_index_returns_no_index_status(self, client: TestClient):
        mock = _make_indexer_mock(has_index=False)
        mock.search.return_value = []
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/search",
                json={"query": "move"},
            )
        data = response.json()
        assert data["status"] == "no_index"
        assert data["results"] == []

    def test_search_with_index_returns_ok_status(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/search",
                json={"query": "move"},
            )
        assert response.json()["status"] == "ok"

    def test_search_returns_results_list(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/search",
                json={"query": "move"},
            )
        data = response.json()
        assert "results" in data
        assert isinstance(data["results"], list)

    def test_search_response_includes_query_and_total(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            response = client.post(
                "/api/codegraph/godot/search",
                json={"query": "player"},
            )
        data = response.json()
        assert data["query"] == "player"
        assert "total" in data

    def test_search_passes_symbol_type_to_indexer(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            client.post(
                "/api/codegraph/godot/search",
                json={"query": "move", "symbol_type": "function"},
            )
        call_kwargs = mock.search.call_args
        assert call_kwargs is not None
        args, kwargs = call_kwargs
        # symbol_type may be passed positionally or as kwarg
        all_args = list(args) + list(kwargs.values())
        assert "function" in all_args or kwargs.get("symbol_type") == "function"

    def test_search_passes_limit_to_indexer(self, client: TestClient):
        mock = _make_indexer_mock(has_index=True)
        with patch("app.api.codegraph.GodotProjectIndexer", return_value=mock):
            client.post(
                "/api/codegraph/godot/search",
                json={"query": "x", "limit": 5},
            )
        call_kwargs = mock.search.call_args
        args, kwargs = call_kwargs
        all_args = list(args) + list(kwargs.values())
        assert 5 in all_args or kwargs.get("limit") == 5


# ─── Unified /api/codegraph/search merge ─────────────────────────────────────

class TestUnifiedSearchMerge:
    def test_unified_search_no_regression_without_godot_index(self, client: TestClient, tmp_path):
        """Existing /search still returns results when no .codegraph-godot/ exists."""
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph._has_index", return_value=False):
                response = client.post(
                    "/api/codegraph/search",
                    json={"query": "foo"},
                )
        assert response.status_code == 200

    def test_unified_search_includes_sources_field_with_godot_index(
        self, client: TestClient, tmp_path
    ):
        """When Godot index exists, response has 'sources' listing queried indices."""
        # Create a fake .codegraph-godot/index.json so the merge path triggers
        godot_index_dir = tmp_path / ".codegraph-godot"
        godot_index_dir.mkdir()
        import json
        (godot_index_dir / "index.json").write_text(
            json.dumps({
                "version": 1,
                "project_root": str(tmp_path),
                "indexed_at": "2025-01-01T00:00:00+00:00",
                "file_count": 1,
                "symbol_count": 2,
                "symbols": [
                    {"name": "gdmove", "symbol_type": "function", "file_path": "a.gd", "line": 1,
                     "return_type": None, "parent_class": None, "is_exported": False,
                     "is_static": False, "docstring": None}
                ],
            })
        )
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph._has_index", return_value=False):
                with patch("app.api.codegraph._run_search", return_value=[]):
                    response = client.post(
                        "/api/codegraph/search",
                        json={"query": "gdmove"},
                    )
        data = response.json()
        assert "sources" in data

    def test_unified_search_godot_results_appear_in_merged_output(
        self, client: TestClient, tmp_path
    ):
        """Godot symbols show up in the merged result list."""
        godot_index_dir = tmp_path / ".codegraph-godot"
        godot_index_dir.mkdir()
        import json
        (godot_index_dir / "index.json").write_text(
            json.dumps({
                "version": 1,
                "project_root": str(tmp_path),
                "indexed_at": "2025-01-01T00:00:00+00:00",
                "file_count": 1,
                "symbol_count": 1,
                "symbols": [
                    {"name": "unique_godot_func", "symbol_type": "function",
                     "file_path": "player.gd", "line": 10,
                     "return_type": None, "parent_class": None,
                     "is_exported": False, "is_static": False, "docstring": None}
                ],
            })
        )
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph._has_index", return_value=False):
                with patch("app.api.codegraph._run_search", return_value=[]):
                    response = client.post(
                        "/api/codegraph/search",
                        json={"query": "unique_godot_func"},
                    )
        data = response.json()
        names = [r.get("name") for r in data.get("results", [])]
        assert "unique_godot_func" in names
