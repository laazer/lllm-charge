"""Tests for export/multi_format.py — ExportManager and format utilities."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

import blender_pipeline.export.multi_format as mf_mod


@pytest.fixture(autouse=True)
def _patch_multi_format_bpy(mock_blender_modules: dict) -> None:
    """Ensure the module-level bpy ref is the mock so lambdas in _call_exporter work."""
    mf_mod.HAS_BPY = True
    mf_mod.bpy = mock_blender_modules["bpy"]


class TestExportFormatAndExtensions:
    """Verify FORMAT_EXTENSIONS covers every ExportFormat member."""

    def test_all_export_formats_have_extensions(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import ExportFormat, FORMAT_EXTENSIONS

        for member in ExportFormat:
            assert member in FORMAT_EXTENSIONS, (
                f"ExportFormat.{member.name} is missing from FORMAT_EXTENSIONS"
            )

    def test_extensions_start_with_dot(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import FORMAT_EXTENSIONS

        for fmt, extension in FORMAT_EXTENSIONS.items():
            assert extension.startswith("."), (
                f"Extension for {fmt} should start with '.', got {extension!r}"
            )


class TestEnsureExtension:
    """ExportManager._ensure_extension adds or preserves file extensions."""

    def _make_manager(self) -> "ExportManager":
        from blender_pipeline.export.multi_format import ExportManager
        return ExportManager()

    def test_adds_extension_when_missing(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import ExportFormat
        manager = self._make_manager()
        result = manager._ensure_extension("/tmp/model", ExportFormat.GLB)
        assert result == "/tmp/model.glb"

    def test_preserves_extension_when_present(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import ExportFormat
        manager = self._make_manager()
        result = manager._ensure_extension("/tmp/model.glb", ExportFormat.GLB)
        assert result == "/tmp/model.glb"

    def test_adds_extension_for_fbx(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import ExportFormat
        manager = self._make_manager()
        result = manager._ensure_extension("/output/scene", ExportFormat.FBX)
        assert result == "/output/scene.fbx"

    def test_adds_extension_for_stl(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import ExportFormat
        manager = self._make_manager()
        result = manager._ensure_extension("mesh", ExportFormat.STL)
        assert result == "mesh.stl"


class TestExportObject:
    """ExportManager.export_object selects the object and calls the exporter."""

    def test_export_object_selects_and_exports(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        mock_obj = MagicMock()
        mock_obj.name = "Cube"

        output_path = str(tmp_dir / "cube")
        result = manager.export_object(mock_obj, output_path, ExportFormat.GLB)

        mock_bpy.ops.object.select_all.assert_called_with(action="DESELECT")
        mock_obj.select_set.assert_called_with(True)
        assert mock_bpy.context.view_layer.objects.active == mock_obj
        assert result.endswith(".glb")

    def test_export_object_calls_gltf_exporter_for_glb(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        mock_obj = MagicMock()
        mock_obj.name = "Sphere"

        output_path = str(tmp_dir / "sphere.glb")
        manager.export_object(mock_obj, output_path, ExportFormat.GLB)

        mock_bpy.ops.export_scene.gltf.assert_called_once()
        call_kwargs = mock_bpy.ops.export_scene.gltf.call_args
        assert call_kwargs.kwargs["filepath"] == output_path
        assert call_kwargs.kwargs["use_selection"] is True
        assert call_kwargs.kwargs["export_format"] == "GLB"

    def test_export_object_passes_custom_settings(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        mock_obj = MagicMock()
        mock_obj.name = "Obj"
        custom_settings = {"apply_unit_scale": True}

        manager.export_object(
            mock_obj, str(tmp_dir / "obj.fbx"), ExportFormat.FBX, settings=custom_settings
        )

        call_kwargs = mock_bpy.ops.export_scene.fbx.call_args.kwargs
        assert call_kwargs["apply_unit_scale"] is True


class TestExportScene:
    """ExportManager.export_scene exports with use_selection=False."""

    def test_export_scene_uses_selection_false(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        manager.export_scene(str(tmp_dir / "scene"), ExportFormat.GLB)

        call_kwargs = mock_bpy.ops.export_scene.gltf.call_args.kwargs
        assert call_kwargs["use_selection"] is False


class TestExportSelected:
    """ExportManager.export_selected exports with use_selection=True."""

    def test_export_selected_uses_selection_true(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        manager.export_selected(str(tmp_dir / "selected"), ExportFormat.FBX)

        call_kwargs = mock_bpy.ops.export_scene.fbx.call_args.kwargs
        assert call_kwargs["use_selection"] is True


class TestBatchExport:
    """ExportManager.batch_export iterates objects x formats."""

    def test_batch_export_calls_export_object_for_each_combination(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()

        obj_a = MagicMock()
        obj_a.name = "ObjA"
        obj_b = MagicMock()
        obj_b.name = "ObjB"

        formats = [ExportFormat.GLB, ExportFormat.FBX]

        with patch.object(manager, "export_object", return_value="mocked_path") as mock_export:
            results = manager.batch_export([obj_a, obj_b], str(tmp_dir), formats)

        assert mock_export.call_count == 4
        assert len(results) == 4

    def test_batch_export_defaults_to_glb_and_fbx(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        obj = MagicMock()
        obj.name = "Item"

        with patch.object(manager, "export_object", return_value="path") as mock_export:
            manager.batch_export([obj], str(tmp_dir))

        called_formats = [c.args[2] for c in mock_export.call_args_list]
        assert called_formats == [ExportFormat.GLB, ExportFormat.FBX]


class TestExportWithPreset:
    """ExportManager.export_with_preset delegates to export_object with preset config."""

    def test_web_preset_uses_glb_format(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.multi_format import (
            ExportManager,
            ExportFormat,
            BUILT_IN_PRESETS,
        )

        manager = ExportManager()
        mock_obj = MagicMock()
        mock_obj.name = "WebModel"

        with patch.object(manager, "export_object", return_value="done") as mock_export:
            manager.export_with_preset(mock_obj, str(tmp_dir / "web"), "web")

        preset = BUILT_IN_PRESETS["web"]
        mock_export.assert_called_once_with(
            mock_obj, str(tmp_dir / "web"), preset.format, preset.settings
        )

    def test_unknown_preset_raises_key_error(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.multi_format import ExportManager

        manager = ExportManager()
        mock_obj = MagicMock()
        mock_obj.name = "Obj"

        with pytest.raises(KeyError, match="nonexistent"):
            manager.export_with_preset(mock_obj, "/tmp/out", "nonexistent")


class TestCallExporter:
    """Verify _call_exporter dispatches to the correct bpy.ops function for each format."""

    EXPORTER_EXPECTATIONS = {
        "GLTF": ("export_scene", "gltf", {"export_format": "GLTF_SEPARATE"}),
        "GLB": ("export_scene", "gltf", {"export_format": "GLB"}),
        "FBX": ("export_scene", "fbx", {}),
        "OBJ": ("wm", "obj_export", {}),
        "STL": ("export_mesh", "stl", {}),
        "PLY": ("export_mesh", "ply", {}),
        "DAE": ("wm", "collada_export", {}),
        "USD": ("wm", "usd_export", {}),
        "USDC": ("wm", "usd_export", {}),
        "ABC": ("wm", "alembic_export", {}),
    }

    @pytest.mark.parametrize(
        "format_name",
        list(EXPORTER_EXPECTATIONS.keys()),
    )
    def test_correct_bpy_ops_called(
        self, mock_blender_modules: dict, format_name: str
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        export_format = ExportFormat[format_name]

        manager._call_exporter(export_format, "/tmp/test.ext", {}, use_selection=True)

        namespace, func_name, _extra = self.EXPORTER_EXPECTATIONS[format_name]
        ops_namespace = getattr(mock_bpy.ops, namespace)
        ops_function = getattr(ops_namespace, func_name)
        ops_function.assert_called_once()

    def test_usdz_raises_value_error(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat

        manager = ExportManager()
        with pytest.raises(ValueError, match="No exporter available"):
            manager._call_exporter(ExportFormat.USDZ, "/tmp/out.usdz", {}, use_selection=True)
