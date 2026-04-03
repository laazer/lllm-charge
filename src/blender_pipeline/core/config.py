"""Configuration management for the Blender pipeline."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class BlenderConfig:
    """Blender executable and render settings."""

    executable_path: str = "blender"
    render_engine: str = "CYCLES"
    render_samples: int = 128
    resolution_x: int = 1920
    resolution_y: int = 1080
    use_gpu: bool = True
    output_format: str = "PNG"
    color_depth: str = "8"
    film_transparent: bool = False


@dataclass
class ExportConfig:
    """Default export settings."""

    output_directory: str = "./output"
    default_formats: list[str] = field(default_factory=lambda: ["GLTF", "FBX"])
    naming_template: str = "{name}_{timestamp}"
    embed_textures: bool = True
    apply_modifiers: bool = True
    use_compression: bool = True


@dataclass
class LLMConfig:
    """LLM endpoint configuration."""

    endpoint_url: str = "http://localhost:11434/api/generate"
    model_name: str = "llama3"
    api_key: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout_seconds: int = 60


@dataclass
class PipelineConfig:
    """Top-level pipeline configuration combining all sub-configs."""

    blender: BlenderConfig = field(default_factory=BlenderConfig)
    export: ExportConfig = field(default_factory=ExportConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    log_level: str = "INFO"
    max_parallel_jobs: int = 4
    asset_database_path: str = "./data/assets.db"
    version_storage_dir: str = "./data/versions"

    def save_to_file(self, path: str | Path) -> None:
        """Serialize the config to a JSON file."""
        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as file_handle:
            json.dump(asdict(self), file_handle, indent=2)

    @classmethod
    def load_from_file(cls, path: str | Path) -> PipelineConfig:
        """Deserialize a config from a JSON file."""
        with open(path, "r", encoding="utf-8") as file_handle:
            data = json.load(file_handle)
        return cls(
            blender=BlenderConfig(**data.get("blender", {})),
            export=ExportConfig(**data.get("export", {})),
            llm=LLMConfig(**data.get("llm", {})),
            log_level=data.get("log_level", "INFO"),
            max_parallel_jobs=data.get("max_parallel_jobs", 4),
            asset_database_path=data.get("asset_database_path", "./data/assets.db"),
            version_storage_dir=data.get("version_storage_dir", "./data/versions"),
        )

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return asdict(self)
