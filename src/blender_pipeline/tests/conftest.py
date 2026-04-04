"""Shared fixtures for blender_pipeline tests."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest


class MockVector(list):
    """Minimal mathutils.Vector stand-in."""

    @property
    def length(self) -> float:
        return sum(x * x for x in self) ** 0.5

    def normalized(self) -> MockVector:
        length = self.length
        if length == 0:
            return MockVector(self)
        return MockVector(x / length for x in self)

    def __add__(self, other):  # type: ignore[override]
        return MockVector(a + b for a, b in zip(self, other))

    def __sub__(self, other):
        return MockVector(a - b for a, b in zip(self, other))


@pytest.fixture(autouse=True)
def mock_blender_modules(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Install mock bpy/bmesh/mathutils in sys.modules so imports succeed."""
    mock_bpy = MagicMock()
    mock_bmesh = MagicMock()
    mock_mathutils = MagicMock()
    mock_mathutils.Vector = MockVector

    mocks = {
        "bpy": mock_bpy,
        "bmesh": mock_bmesh,
        "mathutils": mock_mathutils,
    }
    for name, mock in mocks.items():
        monkeypatch.setitem(sys.modules, name, mock)

    return mocks


@pytest.fixture
def tmp_dir() -> Path:
    """Provide a temporary directory for file I/O tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_pipeline_config() -> dict:
    return {
        "blender": {"render_engine": "CYCLES", "render_samples": 64},
        "export": {"default_formats": ["GLTF"], "output_directory": "/tmp/test_output"},
        "llm": {"endpoint_url": "http://localhost:11434/api/generate", "model_name": "llama3"},
        "log_level": "DEBUG",
    }
