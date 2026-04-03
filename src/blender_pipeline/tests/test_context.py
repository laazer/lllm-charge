"""Tests for BlenderContext scene state management."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import blender_pipeline.core.context as context_mod
from blender_pipeline.core.context import BlenderContext
from blender_pipeline.core.config import BlenderConfig


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_bpy(mock_blender_modules: dict) -> MagicMock:
    """Patch the context module to think bpy is available and return the mock."""
    mock_bpy = mock_blender_modules["bpy"]
    context_mod.HAS_BPY = True
    context_mod.bpy = mock_bpy
    return mock_bpy


def _setup_no_bpy() -> None:
    """Patch the context module to think bpy is unavailable."""
    context_mod.HAS_BPY = False


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------

class TestBlenderContextInit:
    def test_default_config(self, mock_blender_modules: dict) -> None:
        context = BlenderContext()
        assert isinstance(context.config, BlenderConfig)
        assert context._saved_state is None

    def test_custom_config(self, mock_blender_modules: dict) -> None:
        custom_config = BlenderConfig(
            render_engine="BLENDER_EEVEE",
            render_samples=64,
        )
        context = BlenderContext(config=custom_config)
        assert context.config.render_engine == "BLENDER_EEVEE"
        assert context.config.render_samples == 64


# ---------------------------------------------------------------------------
# clear_scene
# ---------------------------------------------------------------------------

class TestClearScene:
    def test_calls_select_all_and_delete(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.clear_scene()

        mock_bpy.ops.object.select_all.assert_called_once_with(action="SELECT")
        mock_bpy.ops.object.delete.assert_called_once_with(use_global=False)

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()

        context.clear_scene()

        mock_bpy.ops.object.select_all.assert_not_called()
        mock_bpy.ops.object.delete.assert_not_called()


# ---------------------------------------------------------------------------
# select_all
# ---------------------------------------------------------------------------

class TestSelectAll:
    def test_calls_select_all_with_select(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.select_all()

        mock_bpy.ops.object.select_all.assert_called_once_with(action="SELECT")

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()

        context.select_all()

        mock_bpy.ops.object.select_all.assert_not_called()


# ---------------------------------------------------------------------------
# deselect_all
# ---------------------------------------------------------------------------

class TestDeselectAll:
    def test_calls_select_all_with_deselect(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.deselect_all()

        mock_bpy.ops.object.select_all.assert_called_once_with(action="DESELECT")

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()

        context.deselect_all()

        mock_bpy.ops.object.select_all.assert_not_called()


# ---------------------------------------------------------------------------
# delete_selected
# ---------------------------------------------------------------------------

class TestDeleteSelected:
    def test_calls_delete(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.delete_selected()

        mock_bpy.ops.object.delete.assert_called_once_with(use_global=False)

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()

        context.delete_selected()

        mock_bpy.ops.object.delete.assert_not_called()


# ---------------------------------------------------------------------------
# set_render_engine
# ---------------------------------------------------------------------------

class TestSetRenderEngine:
    def test_sets_engine(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.set_render_engine("CYCLES")

        assert mock_bpy.context.scene.render.engine == "CYCLES"

    def test_sets_eevee(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.set_render_engine("BLENDER_EEVEE")

        assert mock_bpy.context.scene.render.engine == "BLENDER_EEVEE"

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        # Reset the attribute to detect any writes
        mock_bpy.context.scene.render.engine = "ORIGINAL"
        context = BlenderContext()

        context.set_render_engine("CYCLES")

        assert mock_bpy.context.scene.render.engine == "ORIGINAL"


# ---------------------------------------------------------------------------
# set_resolution
# ---------------------------------------------------------------------------

class TestSetResolution:
    def test_sets_resolution(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.set_resolution(3840, 2160)

        assert mock_bpy.context.scene.render.resolution_x == 3840
        assert mock_bpy.context.scene.render.resolution_y == 2160

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.context.scene.render.resolution_x = 1920
        mock_bpy.context.scene.render.resolution_y = 1080
        context = BlenderContext()

        context.set_resolution(3840, 2160)

        assert mock_bpy.context.scene.render.resolution_x == 1920
        assert mock_bpy.context.scene.render.resolution_y == 1080


# ---------------------------------------------------------------------------
# save_blend_file
# ---------------------------------------------------------------------------

class TestSaveBlendFile:
    def test_calls_save_as_mainfile(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()
        output_path = tmp_dir / "scene.blend"

        context.save_blend_file(output_path)

        mock_bpy.ops.wm.save_as_mainfile.assert_called_once_with(
            filepath=str(output_path.resolve())
        )

    def test_accepts_string_path(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        context.save_blend_file("/tmp/test_scene.blend")

        mock_bpy.ops.wm.save_as_mainfile.assert_called_once()
        call_kwargs = mock_bpy.ops.wm.save_as_mainfile.call_args[1]
        assert call_kwargs["filepath"].endswith("test_scene.blend")

    def test_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()

        context.save_blend_file("/tmp/noop.blend")

        mock_bpy.ops.wm.save_as_mainfile.assert_not_called()


# ---------------------------------------------------------------------------
# execute_script
# ---------------------------------------------------------------------------

class TestExecuteScript:
    @patch("blender_pipeline.core.context.subprocess.run")
    def test_calls_subprocess_run(
        self, mock_run: MagicMock, mock_blender_modules: dict
    ) -> None:
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="ok", stderr=""
        )
        context = BlenderContext()

        result = context.execute_script("/path/to/script.py")

        mock_run.assert_called_once_with(
            ["blender", "--background", "--python", "/path/to/script.py"],
            capture_output=True,
            text=True,
            timeout=300,
            check=True,
        )
        assert result.returncode == 0

    @patch("blender_pipeline.core.context.subprocess.run")
    def test_uses_custom_executable_path(
        self, mock_run: MagicMock, mock_blender_modules: dict
    ) -> None:
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="", stderr=""
        )
        custom_config = BlenderConfig(executable_path="/opt/blender/blender")
        context = BlenderContext(config=custom_config)

        context.execute_script("test.py")

        called_command = mock_run.call_args[0][0]
        assert called_command[0] == "/opt/blender/blender"


# ---------------------------------------------------------------------------
# execute_script_text
# ---------------------------------------------------------------------------

class TestExecuteScriptText:
    @patch("blender_pipeline.core.context.subprocess.run")
    def test_creates_temp_file_and_executes(
        self, mock_run: MagicMock, mock_blender_modules: dict
    ) -> None:
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="done", stderr=""
        )
        context = BlenderContext()

        result = context.execute_script_text("import bpy; print('hello')")

        mock_run.assert_called_once()
        called_command = mock_run.call_args[0][0]
        assert called_command[0] == "blender"
        assert called_command[1] == "--background"
        assert called_command[2] == "--python"
        # The fourth arg should be a temp file path ending in .py
        assert called_command[3].endswith(".py")
        assert result.returncode == 0

    @patch("blender_pipeline.core.context.subprocess.run")
    def test_cleans_up_temp_file(
        self, mock_run: MagicMock, mock_blender_modules: dict
    ) -> None:
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="", stderr=""
        )
        context = BlenderContext()

        context.execute_script_text("print(1)")

        # The temp file should be cleaned up after execution
        called_command = mock_run.call_args[0][0]
        temp_path = Path(called_command[3])
        assert not temp_path.exists()

    @patch("blender_pipeline.core.context.subprocess.run")
    def test_cleans_up_temp_file_on_error(
        self, mock_run: MagicMock, mock_blender_modules: dict
    ) -> None:
        mock_run.side_effect = subprocess.CalledProcessError(1, "blender")
        context = BlenderContext()

        with pytest.raises(subprocess.CalledProcessError):
            context.execute_script_text("bad code")

        called_command = mock_run.call_args[0][0]
        temp_path = Path(called_command[3])
        assert not temp_path.exists()


# ---------------------------------------------------------------------------
# Context manager (__enter__ / __exit__)
# ---------------------------------------------------------------------------

class TestContextManager:
    def test_enter_saves_state(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()

        returned = context.__enter__()

        assert returned is context
        mock_bpy.ops.wm.save_as_mainfile.assert_called_once()
        assert context._saved_state is not None

    def test_exit_restores_state(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()
        context.__enter__()

        saved_path = context._saved_state

        context.__exit__(None, None, None)

        mock_bpy.ops.wm.open_mainfile.assert_called_once_with(filepath=saved_path)
        assert context._saved_state is None

    def test_context_manager_with_statement(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)

        with BlenderContext() as ctx:
            assert isinstance(ctx, BlenderContext)
            assert ctx._saved_state is not None

        mock_bpy.ops.wm.open_mainfile.assert_called_once()

    def test_enter_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()

        returned = context.__enter__()

        assert returned is context
        assert context._saved_state is None
        mock_bpy.ops.wm.save_as_mainfile.assert_not_called()

    def test_exit_noop_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        _setup_no_bpy()
        mock_bpy = mock_blender_modules["bpy"]
        context = BlenderContext()
        context.__enter__()

        context.__exit__(None, None, None)

        mock_bpy.ops.wm.open_mainfile.assert_not_called()

    def test_exit_noop_when_no_saved_state(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        context = BlenderContext()
        # Do not call __enter__, so _saved_state is None

        context.__exit__(None, None, None)

        mock_bpy.ops.wm.open_mainfile.assert_not_called()
