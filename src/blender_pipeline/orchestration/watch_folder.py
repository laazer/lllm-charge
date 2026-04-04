"""Watch folder system — auto-generates 3D models from config files."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


@dataclass
class WatcherConfig:
    """Configuration for the folder watcher."""

    input_dir: str = "./watch/input"
    output_dir: str = "./watch/output"
    poll_interval: float = 2.0
    auto_export_formats: list[str] = field(default_factory=lambda: ["glb"])
    auto_render_thumbnail: bool = True


class ConfigProcessor:
    """Processes generation config files into 3D objects/files."""

    VALID_TYPES = ("parametric", "pipeline", "text_to_3d")

    def validate_config(self, config: dict) -> list[str]:
        """Validate a generation config file."""
        errors: list[str] = []
        config_type = config.get("type")
        if not config_type:
            errors.append("Missing 'type' field")
        elif config_type not in self.VALID_TYPES:
            errors.append(f"Invalid type '{config_type}'. Valid: {self.VALID_TYPES}")

        if config_type == "parametric":
            if "shape" not in config and "params" not in config:
                errors.append("Parametric config requires 'shape' or 'params'")
        elif config_type == "pipeline":
            if "nodes" not in config:
                errors.append("Pipeline config requires 'nodes'")
        elif config_type == "text_to_3d":
            if "description" not in config:
                errors.append("text_to_3d config requires 'description'")

        return errors

    def process(self, config: dict, output_dir: str = "./output") -> list[str]:
        """Process a config and return list of created output file paths."""
        errors = self.validate_config(config)
        if errors:
            raise ValueError(f"Invalid config: {errors}")

        config_type = config["type"]
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        if config_type == "parametric":
            return self._process_parametric(config, output_path)
        elif config_type == "pipeline":
            return self._process_pipeline(config, output_path)
        elif config_type == "text_to_3d":
            return self._process_text_to_3d(config, output_path)

        return []

    def _process_parametric(self, config: dict, output_path: Path) -> list[str]:
        try:
            from blender_pipeline.generation.parametric import ParametricGenerator
            generator = ParametricGenerator()
            params = config.get("params", {})
            params["shape"] = config.get("shape", params.get("shape", "box"))
            obj = generator.generate_from_params(params)
            logger.info("Created parametric object: %s", obj.name)
            return [obj.name]
        except RuntimeError:
            logger.info("Queued parametric generation (bpy not available): %s", config)
            return [str(output_path / f"{config.get('shape', 'object')}.json")]

    def _process_pipeline(self, config: dict, output_path: Path) -> list[str]:
        from blender_pipeline.orchestration.pipeline_graph import Pipeline
        pipeline_path = output_path / "temp_pipeline.json"
        with open(pipeline_path, "w", encoding="utf-8") as file_handle:
            json.dump(config, file_handle)
        logger.info("Pipeline config saved for execution: %s", pipeline_path)
        return [str(pipeline_path)]

    def _process_text_to_3d(self, config: dict, output_path: Path) -> list[str]:
        try:
            from blender_pipeline.llm_integration.text_to_3d import TextTo3DGenerator
            generator = TextTo3DGenerator()
            scene = generator.generate_from_description(config["description"])
            objects = generator.build_scene(scene)
            return [obj.name for obj in objects]
        except RuntimeError:
            logger.info("Queued text_to_3d generation: %s", config.get("description", ""))
            return [str(output_path / "text_to_3d_queued.json")]


class FolderWatcher:
    """Watches a directory for config files and auto-generates 3D content."""

    def __init__(self, config: WatcherConfig | None = None) -> None:
        self.config = config or WatcherConfig()
        self._running = False
        self._processor = ConfigProcessor()
        self._processed_files: set[str] = set()
        self._file_mtimes: dict[str, float] = {}
        self._on_created: Optional[Callable[[str, list[str]], None]] = None
        self._on_modified: Optional[Callable[[str, list[str]], None]] = None
        self._on_error: Optional[Callable[[str, Exception], None]] = None

    def on_file_created(self, callback: Callable[[str, list[str]], None]) -> None:
        self._on_created = callback

    def on_file_modified(self, callback: Callable[[str, list[str]], None]) -> None:
        self._on_modified = callback

    def on_error(self, callback: Callable[[str, Exception], None]) -> None:
        self._on_error = callback

    def watch(
        self,
        input_dir: str | None = None,
        output_dir: str | None = None,
        poll_interval: float | None = None,
    ) -> None:
        """Start watching for config files. Blocks until stop() is called."""
        input_path = Path(input_dir or self.config.input_dir)
        output_path = Path(output_dir or self.config.output_dir)
        interval = poll_interval or self.config.poll_interval

        input_path.mkdir(parents=True, exist_ok=True)
        output_path.mkdir(parents=True, exist_ok=True)

        self._running = True
        logger.info("Watching %s for config files (interval: %.1fs)", input_path, interval)

        while self._running:
            self._scan_directory(input_path, output_path)
            time.sleep(interval)

    def stop(self) -> None:
        """Stop the file watcher."""
        self._running = False
        logger.info("Watcher stopped")

    def process_file(self, config_path: str | Path, output_dir: str | None = None) -> list[str]:
        """Process a single config file."""
        path = Path(config_path)
        output = output_dir or self.config.output_dir

        with open(path, "r", encoding="utf-8") as file_handle:
            config = json.load(file_handle)

        return self._processor.process(config, output)

    def _scan_directory(self, input_path: Path, output_path: Path) -> None:
        for config_file in input_path.glob("*.json"):
            file_key = str(config_file)
            mtime = config_file.stat().st_mtime

            is_new = file_key not in self._processed_files
            is_modified = self._file_mtimes.get(file_key, 0) < mtime

            if is_new or is_modified:
                try:
                    results = self.process_file(config_file, str(output_path))
                    self._processed_files.add(file_key)
                    self._file_mtimes[file_key] = mtime

                    if is_new and self._on_created:
                        self._on_created(file_key, results)
                    elif is_modified and self._on_modified:
                        self._on_modified(file_key, results)

                except Exception as exc:
                    logger.error("Error processing %s: %s", config_file, exc)
                    if self._on_error:
                        self._on_error(file_key, exc)
