"""Blender context manager for scene state management."""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from blender_pipeline.core.config import BlenderConfig

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


class BlenderContext:
    """Manages Blender scene state with context manager support."""

    def __init__(self, config: Optional[BlenderConfig] = None) -> None:
        self.config = config or BlenderConfig()
        self._saved_state: Optional[str] = None

    def __enter__(self) -> BlenderContext:
        if HAS_BPY:
            self._saved_state = self._save_temp_blend()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:  # type: ignore[no-untyped-def]
        if HAS_BPY and self._saved_state:
            bpy.ops.wm.open_mainfile(filepath=self._saved_state)
            Path(self._saved_state).unlink(missing_ok=True)
            self._saved_state = None

    def clear_scene(self) -> None:
        """Remove all objects from the current scene."""
        if not HAS_BPY:
            logger.warning("bpy not available — skipping clear_scene")
            return
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)

    def select_all(self) -> None:
        """Select all objects in the scene."""
        if not HAS_BPY:
            return
        bpy.ops.object.select_all(action="SELECT")

    def deselect_all(self) -> None:
        """Deselect all objects in the scene."""
        if not HAS_BPY:
            return
        bpy.ops.object.select_all(action="DESELECT")

    def delete_selected(self) -> None:
        """Delete currently selected objects."""
        if not HAS_BPY:
            return
        bpy.ops.object.delete(use_global=False)

    def set_render_engine(self, engine: str) -> None:
        """Set the render engine (CYCLES, BLENDER_EEVEE, BLENDER_WORKBENCH)."""
        if not HAS_BPY:
            return
        bpy.context.scene.render.engine = engine

    def set_resolution(self, width: int, height: int) -> None:
        """Set render resolution."""
        if not HAS_BPY:
            return
        bpy.context.scene.render.resolution_x = width
        bpy.context.scene.render.resolution_y = height

    def save_blend_file(self, path: str | Path) -> None:
        """Save the current scene to a .blend file."""
        if not HAS_BPY:
            return
        filepath = str(Path(path).resolve())
        bpy.ops.wm.save_as_mainfile(filepath=filepath)

    def execute_script(self, script_path: str | Path) -> subprocess.CompletedProcess[str]:
        """Run a Python script inside Blender via subprocess."""
        command = [
            self.config.executable_path,
            "--background",
            "--python",
            str(script_path),
        ]
        logger.info("Executing Blender script: %s", script_path)
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300,
            check=True,
        )

    def execute_script_text(self, script_text: str) -> subprocess.CompletedProcess[str]:
        """Run inline Python code inside Blender via a temp file."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False
        ) as temp_file:
            temp_file.write(script_text)
            temp_path = temp_file.name
        try:
            return self.execute_script(temp_path)
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def _save_temp_blend(self) -> str:
        """Save current state to a temporary .blend file and return its path."""
        temp_path = tempfile.mktemp(suffix=".blend")
        bpy.ops.wm.save_as_mainfile(filepath=temp_path, copy=True)
        return temp_path
