"""Tests for MIG-007: Blender Pipeline API."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(test_client):
    return test_client


# ─── BlenderPipelineBridge unit tests ────────────────────────────────────────

class TestBlenderPipelineBridge:
    """Unit tests for the pipeline bridge, mocking subprocess."""

    def _make_bridge(self):
        from app.blender.pipeline_bridge import BlenderPipelineBridge
        return BlenderPipelineBridge()

    def test_bridge_can_be_instantiated(self):
        bridge = self._make_bridge()
        assert bridge is not None

    def test_pipeline_root_points_to_src_blender_pipeline(self):
        from app.blender.pipeline_bridge import PIPELINE_ROOT
        assert "blender_pipeline" in str(PIPELINE_ROOT)
        assert "src" in str(PIPELINE_ROOT)

    @pytest.mark.asyncio
    async def test_check_availability_returns_available_true_when_blender_found(self):
        bridge = self._make_bridge()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Blender 3.6.0\n"
        with patch("app.blender.pipeline_bridge.subprocess.run", return_value=mock_result):
            result = await bridge.check_availability()
        assert result["available"] is True
        assert result["version"] is not None

    @pytest.mark.asyncio
    async def test_check_availability_returns_false_when_blender_missing(self):
        bridge = self._make_bridge()
        with patch(
            "app.blender.pipeline_bridge.subprocess.run",
            side_effect=FileNotFoundError("blender not found"),
        ):
            result = await bridge.check_availability()
        assert result["available"] is False
        assert result["version"] is None

    @pytest.mark.asyncio
    async def test_generate_asset_returns_asset_metadata(self):
        bridge = self._make_bridge()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({
            "asset_id": "abc123",
            "file_path": "/tmp/abc123.blend",
            "preview_url": None,
            "metadata": {"vertices": 1024, "faces": 512},
        })
        with patch("app.blender.pipeline_bridge.subprocess.run", return_value=mock_result):
            result = await bridge.generate_asset(
                prompt="a blue cube",
                asset_type="mesh",
                style="realistic",
                complexity="medium",
            )
        assert result["asset_id"] == "abc123"
        assert "file_path" in result
        assert "metadata" in result

    @pytest.mark.asyncio
    async def test_generate_asset_raises_when_blender_unavailable(self):
        bridge = self._make_bridge()
        with patch(
            "app.blender.pipeline_bridge.subprocess.run",
            side_effect=FileNotFoundError("blender not found"),
        ):
            with pytest.raises(RuntimeError, match="[Bb]lender"):
                await bridge.generate_asset("cube", "mesh", "realistic", "medium")

    @pytest.mark.asyncio
    async def test_generate_asset_raises_on_nonzero_returncode(self):
        bridge = self._make_bridge()
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "Error: something went wrong"
        mock_result.stdout = ""
        with patch("app.blender.pipeline_bridge.subprocess.run", return_value=mock_result):
            with pytest.raises(RuntimeError):
                await bridge.generate_asset("cube", "mesh", "realistic", "medium")

    @pytest.mark.asyncio
    async def test_generate_smart_delegates_to_pipeline(self):
        bridge = self._make_bridge()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({
            "asset_id": "smart123",
            "file_path": "/tmp/smart123.blend",
            "preview_url": None,
            "metadata": {"style": "anime", "lod": "high"},
        })
        with patch("app.blender.pipeline_bridge.subprocess.run", return_value=mock_result):
            result = await bridge.generate_smart(
                prompt="anime character",
                options={"style": "anime", "lod": "high"},
            )
        assert result["asset_id"] == "smart123"


# ─── Blender API routes ───────────────────────────────────────────────────────

class TestBlenderStatus:
    def test_status_returns_200(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            response = client.get("/api/blender/status")
        assert response.status_code == 200

    def test_status_returns_available_field(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            response = client.get("/api/blender/status")
        data = response.json()
        assert "available" in data
        assert "version" in data

    def test_status_available_false_when_blender_missing(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": False, "version": None}
            )
            response = client.get("/api/blender/status")
        data = response.json()
        assert data["available"] is False
        assert data["version"] is None


class TestBlenderGenerate:
    def test_generate_returns_200_with_asset_metadata(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            mock_bridge.generate_asset = AsyncMock(return_value={
                "asset_id": "xyz789",
                "file_path": "/tmp/xyz789.blend",
                "preview_url": None,
                "metadata": {},
                "generation_time_ms": 1200,
            })
            response = client.post("/api/blender/generate", json={
                "prompt": "a red sphere",
                "asset_type": "mesh",
                "style": "realistic",
                "complexity": "medium",
            })
        assert response.status_code == 200
        data = response.json()
        assert data["asset_id"] == "xyz789"

    def test_generate_returns_503_when_blender_unavailable(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": False, "version": None}
            )
            response = client.post("/api/blender/generate", json={
                "prompt": "a sphere",
                "asset_type": "mesh",
            })
        assert response.status_code == 503
        body = response.json()
        assert "error" in body or "error" in str(body)

    def test_generate_response_contains_required_fields(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            mock_bridge.generate_asset = AsyncMock(return_value={
                "asset_id": "abc",
                "file_path": "/tmp/abc.blend",
                "preview_url": None,
                "metadata": {"faces": 100},
                "generation_time_ms": 500,
            })
            response = client.post("/api/blender/generate", json={"prompt": "cube"})
        data = response.json()
        for field in ("asset_id", "file_path", "metadata"):
            assert field in data, f"Missing field: {field}"

    def test_generate_defaults_work_without_optional_fields(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            mock_bridge.generate_asset = AsyncMock(return_value={
                "asset_id": "def",
                "file_path": "/tmp/def.blend",
                "preview_url": None,
                "metadata": {},
                "generation_time_ms": 300,
            })
            # Only required field: prompt
            response = client.post("/api/blender/generate", json={"prompt": "a tree"})
        assert response.status_code == 200


class TestBlenderGenerateSmart:
    def test_smart_generate_returns_200(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            mock_bridge.generate_smart = AsyncMock(return_value={
                "asset_id": "smart1",
                "file_path": "/tmp/smart1.blend",
                "preview_url": None,
                "metadata": {"style": "anime"},
                "generation_time_ms": 2000,
            })
            response = client.post("/api/blender/generate/smart", json={
                "prompt": "an anime sword",
                "style": "anime",
                "lod": "high",
            })
        assert response.status_code == 200

    def test_smart_generate_passes_options_to_bridge(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": True, "version": "3.6.0"}
            )
            mock_bridge.generate_smart = AsyncMock(return_value={
                "asset_id": "s2",
                "file_path": "/tmp/s2.blend",
                "preview_url": None,
                "metadata": {},
                "generation_time_ms": 1800,
            })
            client.post("/api/blender/generate/smart", json={
                "prompt": "dragon",
                "style": "cartoon",
                "lod": "low",
            })
        call_kwargs = mock_bridge.generate_smart.call_args
        assert call_kwargs is not None

    def test_smart_generate_returns_503_when_blender_unavailable(self, client: TestClient):
        with patch("app.api.blender._bridge") as mock_bridge:
            mock_bridge.check_availability = AsyncMock(
                return_value={"available": False, "version": None}
            )
            response = client.post("/api/blender/generate/smart", json={"prompt": "tree"})
        assert response.status_code == 503
