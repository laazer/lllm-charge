"""Multi-format 3D export with platform-specific presets."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


class ExportFormat(Enum):
    """Supported 3D export formats."""

    GLTF = "gltf"
    GLB = "glb"
    FBX = "fbx"
    OBJ = "obj"
    USD = "usd"
    USDC = "usdc"
    USDZ = "usdz"
    STL = "stl"
    PLY = "ply"
    ABC = "abc"
    DAE = "dae"


@dataclass
class ExportPreset:
    """Export configuration preset for a target platform."""

    name: str
    format: ExportFormat
    settings: dict = field(default_factory=dict)
    target: str = "generic"


BUILT_IN_PRESETS: dict[str, ExportPreset] = {
    "web": ExportPreset("web", ExportFormat.GLB, {
        "export_draco_mesh_compression_enable": True,
        "export_image_format": "AUTO",
        "export_apply_modifiers": True,
    }, "web"),
    "unity": ExportPreset("unity", ExportFormat.FBX, {
        "apply_unit_scale": True,
        "apply_scale_options": "FBX_SCALE_ALL",
        "axis_forward": "Z",
        "axis_up": "Y",
        "use_mesh_modifiers": True,
    }, "unity"),
    "unreal": ExportPreset("unreal", ExportFormat.FBX, {
        "apply_unit_scale": True,
        "apply_scale_options": "FBX_SCALE_ALL",
        "axis_forward": "X",
        "axis_up": "Z",
        "use_mesh_modifiers": True,
        "mesh_smooth_type": "FACE",
    }, "unreal"),
    "godot": ExportPreset("godot", ExportFormat.GLTF, {
        "export_apply_modifiers": True,
        "export_format": "GLTF_SEPARATE",
    }, "godot"),
    "3d_print": ExportPreset("3d_print", ExportFormat.STL, {
        "use_mesh_modifiers": True,
        "ascii": False,
    }, "3d_print"),
    "archviz": ExportPreset("archviz", ExportFormat.FBX, {
        "use_mesh_modifiers": True,
        "path_mode": "COPY",
        "embed_textures": True,
    }, "archviz"),
}

FORMAT_EXTENSIONS: dict[ExportFormat, str] = {
    ExportFormat.GLTF: ".gltf",
    ExportFormat.GLB: ".glb",
    ExportFormat.FBX: ".fbx",
    ExportFormat.OBJ: ".obj",
    ExportFormat.USD: ".usd",
    ExportFormat.USDC: ".usdc",
    ExportFormat.USDZ: ".usdz",
    ExportFormat.STL: ".stl",
    ExportFormat.PLY: ".ply",
    ExportFormat.ABC: ".abc",
    ExportFormat.DAE: ".dae",
}


class ExportManager:
    """Exports Blender objects/scenes in multiple formats."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def export_object(
        self,
        obj: Any,
        path: str,
        format: ExportFormat = ExportFormat.GLB,
        settings: dict | None = None,
    ) -> str:
        """Export a single object to the specified format."""
        self._require_bpy()
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        filepath = self._ensure_extension(path, format)
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)

        self._call_exporter(format, filepath, settings or {}, use_selection=True)
        logger.info("Exported '%s' to %s", obj.name, filepath)
        return filepath

    def export_scene(
        self,
        path: str,
        format: ExportFormat = ExportFormat.GLB,
        settings: dict | None = None,
    ) -> str:
        """Export the entire scene."""
        self._require_bpy()
        filepath = self._ensure_extension(path, format)
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)

        self._call_exporter(format, filepath, settings or {}, use_selection=False)
        logger.info("Exported scene to %s", filepath)
        return filepath

    def export_selected(
        self,
        path: str,
        format: ExportFormat = ExportFormat.GLB,
        settings: dict | None = None,
    ) -> str:
        """Export currently selected objects."""
        self._require_bpy()
        filepath = self._ensure_extension(path, format)
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)

        self._call_exporter(format, filepath, settings or {}, use_selection=True)
        return filepath

    def batch_export(
        self,
        objects: list[Any],
        output_dir: str,
        formats: list[ExportFormat] | None = None,
    ) -> list[str]:
        """Export each object in multiple formats."""
        if formats is None:
            formats = [ExportFormat.GLB, ExportFormat.FBX]

        outputs: list[str] = []
        for obj in objects:
            for fmt in formats:
                ext = FORMAT_EXTENSIONS.get(fmt, ".bin")
                path = str(Path(output_dir) / f"{obj.name}{ext}")
                result = self.export_object(obj, path, fmt)
                outputs.append(result)
        return outputs

    def export_with_preset(
        self,
        obj: Any,
        path: str,
        preset_name: str,
    ) -> str:
        """Export using a named preset configuration."""
        if preset_name not in BUILT_IN_PRESETS:
            raise KeyError(f"Preset '{preset_name}' not found. Available: {list(BUILT_IN_PRESETS)}")
        preset = BUILT_IN_PRESETS[preset_name]
        return self.export_object(obj, path, preset.format, preset.settings)

    def _ensure_extension(self, path: str, format: ExportFormat) -> str:
        expected_ext = FORMAT_EXTENSIONS.get(format, "")
        if expected_ext and not path.endswith(expected_ext):
            return path + expected_ext
        return path

    def _call_exporter(
        self,
        format: ExportFormat,
        filepath: str,
        settings: dict,
        use_selection: bool,
    ) -> None:
        exporter_map = {
            ExportFormat.GLTF: lambda: bpy.ops.export_scene.gltf(
                filepath=filepath, use_selection=use_selection,
                export_format="GLTF_SEPARATE", **settings
            ),
            ExportFormat.GLB: lambda: bpy.ops.export_scene.gltf(
                filepath=filepath, use_selection=use_selection,
                export_format="GLB", **settings
            ),
            ExportFormat.FBX: lambda: bpy.ops.export_scene.fbx(
                filepath=filepath, use_selection=use_selection, **settings
            ),
            ExportFormat.OBJ: lambda: bpy.ops.wm.obj_export(
                filepath=filepath, export_selected_objects=use_selection, **settings
            ),
            ExportFormat.STL: lambda: bpy.ops.export_mesh.stl(
                filepath=filepath, use_selection=use_selection, **settings
            ),
            ExportFormat.PLY: lambda: bpy.ops.export_mesh.ply(
                filepath=filepath, **settings
            ),
            ExportFormat.DAE: lambda: bpy.ops.wm.collada_export(
                filepath=filepath, selected=use_selection, **settings
            ),
            ExportFormat.USD: lambda: bpy.ops.wm.usd_export(
                filepath=filepath, selected_objects_only=use_selection, **settings
            ),
            ExportFormat.USDC: lambda: bpy.ops.wm.usd_export(
                filepath=filepath, selected_objects_only=use_selection, **settings
            ),
            ExportFormat.ABC: lambda: bpy.ops.wm.alembic_export(
                filepath=filepath, selected=use_selection, **settings
            ),
        }
        exporter = exporter_map.get(format)
        if exporter:
            exporter()
        else:
            raise ValueError(f"No exporter available for format: {format}")
