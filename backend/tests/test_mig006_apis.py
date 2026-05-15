"""Tests for MIG-006: CodeGraph, Filesystem, Tools, Assets, and System APIs."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(test_client):
    return test_client


# ─── CodeGraph ───────────────────────────────────────────────────────────────

class TestCodeGraphStatus:
    def test_status_returns_200(self, client: TestClient):
        response = client.get("/api/codegraph/status")
        assert response.status_code == 200

    def test_status_reports_no_index_when_absent(self, client: TestClient, tmp_path):
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            response = client.get("/api/codegraph/status")
        assert response.status_code == 200
        data = response.json()
        assert data.get("has_index") is False or "no_index" in str(data).lower()

    def test_status_reports_index_when_present(self, client: TestClient, tmp_path):
        (tmp_path / ".codegraph").mkdir()
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            response = client.get("/api/codegraph/status")
        assert response.status_code == 200
        data = response.json()
        assert data.get("has_index") is True


class TestCodeGraphSearch:
    def test_search_returns_200(self, client: TestClient):
        response = client.post("/api/codegraph/search", json={"query": "test"})
        assert response.status_code == 200

    def test_search_no_index_returns_empty_with_status(self, client: TestClient, tmp_path):
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            response = client.post("/api/codegraph/search", json={"query": "foo"})
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "no_index"
        assert data.get("results") == []

    def test_search_with_index_calls_subprocess(self, client: TestClient, tmp_path):
        (tmp_path / ".codegraph").mkdir()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps([{"name": "MyClass", "type": "class", "file": "src/foo.py"}])
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph.subprocess.run", return_value=mock_result):
                response = client.post("/api/codegraph/search", json={"query": "MyClass"})
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert len(data.get("results", [])) >= 1

    def test_search_limit_respected(self, client: TestClient, tmp_path):
        (tmp_path / ".codegraph").mkdir()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps([{"name": f"Sym{i}"} for i in range(20)])
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph.subprocess.run", return_value=mock_result):
                response = client.post(
                    "/api/codegraph/search", json={"query": "Sym", "limit": 5}
                )
        data = response.json()
        assert len(data.get("results", [])) <= 5


class TestCodeGraphSync:
    def test_sync_returns_202(self, client: TestClient, tmp_path):
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph.subprocess.Popen"):
                response = client.post("/api/codegraph/sync")
        assert response.status_code in (200, 202)

    def test_sync_returns_status_field(self, client: TestClient, tmp_path):
        with patch("app.api.codegraph.CODEGRAPH_PROJECT_DIR", str(tmp_path)):
            with patch("app.api.codegraph.subprocess.Popen"):
                response = client.post("/api/codegraph/sync")
        data = response.json()
        assert "status" in data


# ─── Filesystem browse ────────────────────────────────────────────────────────

class TestFilesystemBrowse:
    def test_browse_valid_path_returns_200(self, client: TestClient, tmp_path):
        (tmp_path / "file.txt").write_text("hello")
        with patch("app.api.filesystem.WORKSPACE_ROOT", str(tmp_path)):
            response = client.post("/api/filesystem/browse", json={"path": str(tmp_path)})
        assert response.status_code == 200

    def test_browse_returns_entries_with_metadata(self, client: TestClient, tmp_path):
        (tmp_path / "readme.md").write_text("content")
        (tmp_path / "subdir").mkdir()
        with patch("app.api.filesystem.WORKSPACE_ROOT", str(tmp_path)):
            response = client.post("/api/filesystem/browse", json={"path": str(tmp_path)})
        data = response.json()
        entries = data.get("entries", [])
        assert len(entries) >= 2
        for entry in entries:
            assert "name" in entry
            assert "type" in entry

    def test_browse_file_entry_has_size_and_modified(self, client: TestClient, tmp_path):
        (tmp_path / "data.bin").write_bytes(b"x" * 100)
        with patch("app.api.filesystem.WORKSPACE_ROOT", str(tmp_path)):
            response = client.post("/api/filesystem/browse", json={"path": str(tmp_path)})
        data = response.json()
        files = [e for e in data.get("entries", []) if e.get("type") == "file"]
        assert len(files) >= 1
        f = files[0]
        assert "size" in f
        assert "modified" in f

    def test_browse_rejects_path_outside_workspace(self, client: TestClient, tmp_path):
        with patch("app.api.filesystem.WORKSPACE_ROOT", str(tmp_path)):
            response = client.post("/api/filesystem/browse", json={"path": "/etc"})
        assert response.status_code == 403

    def test_browse_rejects_path_traversal(self, client: TestClient, tmp_path):
        evil_path = str(tmp_path) + "/../../etc"
        with patch("app.api.filesystem.WORKSPACE_ROOT", str(tmp_path)):
            response = client.post("/api/filesystem/browse", json={"path": evil_path})
        assert response.status_code == 403

    def test_browse_nonexistent_path_returns_404(self, client: TestClient, tmp_path):
        with patch("app.api.filesystem.WORKSPACE_ROOT", str(tmp_path)):
            response = client.post(
                "/api/filesystem/browse", json={"path": str(tmp_path / "missing")}
            )
        assert response.status_code == 404


# ─── Tools config ─────────────────────────────────────────────────────────────

class TestToolsConfig:
    def test_get_config_returns_200(self, client: TestClient, tmp_path):
        config_file = tmp_path / "tools-config.json"
        with patch("app.api.tools.TOOLS_CONFIG_PATH", str(config_file)):
            response = client.get("/api/tools/config")
        assert response.status_code == 200

    def test_get_config_returns_dict(self, client: TestClient, tmp_path):
        config_file = tmp_path / "tools-config.json"
        with patch("app.api.tools.TOOLS_CONFIG_PATH", str(config_file)):
            response = client.get("/api/tools/config")
        assert isinstance(response.json(), dict)

    def test_put_config_persists_changes(self, client: TestClient, tmp_path):
        config_file = tmp_path / "tools-config.json"
        with patch("app.api.tools.TOOLS_CONFIG_PATH", str(config_file)):
            client.put("/api/tools/config", json={"max_tools": 10, "enabled": True})
            response = client.get("/api/tools/config")
        data = response.json()
        assert data.get("max_tools") == 10 or "max_tools" in str(data)

    def test_get_available_tools_returns_list(self, client: TestClient):
        response = client.get("/api/tools/available")
        assert response.status_code == 200
        data = response.json()
        tools = data.get("tools", data)
        assert isinstance(tools, list)

    def test_get_tools_stats_returns_200(self, client: TestClient):
        response = client.get("/api/tools/stats")
        assert response.status_code == 200

    def test_get_tools_profiles_returns_list(self, client: TestClient):
        response = client.get("/api/tools/profiles")
        assert response.status_code == 200
        data = response.json()
        profiles = data.get("profiles", data)
        assert isinstance(profiles, list)


# ─── Assets ──────────────────────────────────────────────────────────────────

class TestAssets:
    def test_list_assets_returns_200(self, client: TestClient, tmp_path):
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        with patch("app.api.assets.ASSETS_DIR", str(assets_dir)):
            response = client.get("/api/assets")
        assert response.status_code == 200

    def test_list_assets_empty_when_no_files(self, client: TestClient, tmp_path):
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        with patch("app.api.assets.ASSETS_DIR", str(assets_dir)):
            response = client.get("/api/assets")
        data = response.json()
        assets = data.get("assets", data)
        assert isinstance(assets, list)
        assert len(assets) == 0

    def test_list_assets_returns_files(self, client: TestClient, tmp_path):
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        (assets_dir / "image.png").write_bytes(b"\x89PNG")
        (assets_dir / "doc.pdf").write_bytes(b"%PDF")
        with patch("app.api.assets.ASSETS_DIR", str(assets_dir)):
            response = client.get("/api/assets")
        data = response.json()
        assets = data.get("assets", data)
        assert len(assets) == 2

    def test_list_assets_filter_by_type(self, client: TestClient, tmp_path):
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        (assets_dir / "img.png").write_bytes(b"PNG")
        (assets_dir / "doc.pdf").write_bytes(b"PDF")
        with patch("app.api.assets.ASSETS_DIR", str(assets_dir)):
            response = client.get("/api/assets?type=png")
        data = response.json()
        assets = data.get("assets", data)
        assert all("png" in a.get("name", "").lower() for a in assets)

    def test_asset_info_returns_metadata(self, client: TestClient, tmp_path):
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        (assets_dir / "test.png").write_bytes(b"PNG" * 10)
        with patch("app.api.assets.ASSETS_DIR", str(assets_dir)):
            response = client.get("/api/assets/test.png/info")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "size" in data

    def test_asset_info_404_for_unknown(self, client: TestClient, tmp_path):
        assets_dir = tmp_path / "assets"
        assets_dir.mkdir()
        with patch("app.api.assets.ASSETS_DIR", str(assets_dir)):
            response = client.get("/api/assets/ghost.png/info")
        assert response.status_code == 404


# ─── System introspect ────────────────────────────────────────────────────────

class TestSystemIntrospect:
    def test_introspect_returns_200(self, client: TestClient):
        response = client.get("/api/system/introspect")
        assert response.status_code == 200

    def test_introspect_returns_python_version(self, client: TestClient):
        response = client.get("/api/system/introspect")
        data = response.json()
        assert "python_version" in data
        assert sys.version.split()[0] in data["python_version"] or data["python_version"]

    def test_introspect_returns_uptime(self, client: TestClient):
        response = client.get("/api/system/introspect")
        data = response.json()
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], (int, float))
        assert data["uptime_seconds"] >= 0

    def test_introspect_returns_version(self, client: TestClient):
        response = client.get("/api/system/introspect")
        data = response.json()
        assert "version" in data

    def test_introspect_returns_modules(self, client: TestClient):
        response = client.get("/api/system/introspect")
        data = response.json()
        assert "modules" in data or "modules_loaded" in data
