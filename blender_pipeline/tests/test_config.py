"""Tests for core configuration management."""

import json
from pathlib import Path

import pytest

from blender_pipeline.core.config import (
    BlenderConfig,
    ExportConfig,
    LLMConfig,
    PipelineConfig,
)


class TestBlenderConfig:
    def test_default_values(self) -> None:
        config = BlenderConfig()
        assert config.render_engine == "CYCLES"
        assert config.render_samples == 128
        assert config.resolution_x == 1920
        assert config.resolution_y == 1080
        assert config.use_gpu is True

    def test_custom_values(self) -> None:
        config = BlenderConfig(render_engine="BLENDER_EEVEE", render_samples=64)
        assert config.render_engine == "BLENDER_EEVEE"
        assert config.render_samples == 64


class TestExportConfig:
    def test_default_formats(self) -> None:
        config = ExportConfig()
        assert "GLTF" in config.default_formats
        assert "FBX" in config.default_formats

    def test_custom_directory(self) -> None:
        config = ExportConfig(output_directory="/custom/path")
        assert config.output_directory == "/custom/path"


class TestLLMConfig:
    def test_default_endpoint(self) -> None:
        config = LLMConfig()
        assert "11434" in config.endpoint_url
        assert config.api_key is None

    def test_with_api_key(self) -> None:
        config = LLMConfig(api_key="test-key-123")
        assert config.api_key == "test-key-123"


class TestPipelineConfig:
    def test_default_creation(self) -> None:
        config = PipelineConfig()
        assert isinstance(config.blender, BlenderConfig)
        assert isinstance(config.export, ExportConfig)
        assert isinstance(config.llm, LLMConfig)
        assert config.log_level == "INFO"

    def test_save_and_load_roundtrip(self, tmp_dir: Path) -> None:
        config = PipelineConfig(
            blender=BlenderConfig(render_samples=64),
            log_level="DEBUG",
        )
        config_path = tmp_dir / "config.json"
        config.save_to_file(config_path)

        loaded = PipelineConfig.load_from_file(config_path)
        assert loaded.blender.render_samples == 64
        assert loaded.log_level == "DEBUG"
        assert loaded.blender.render_engine == "CYCLES"

    def test_to_dict(self) -> None:
        config = PipelineConfig()
        data = config.to_dict()
        assert "blender" in data
        assert "export" in data
        assert "llm" in data
        assert data["blender"]["render_engine"] == "CYCLES"

    def test_save_creates_parent_dirs(self, tmp_dir: Path) -> None:
        config = PipelineConfig()
        nested_path = tmp_dir / "nested" / "deep" / "config.json"
        config.save_to_file(nested_path)
        assert nested_path.exists()
