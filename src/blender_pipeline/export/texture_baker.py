"""Texture baking pipeline — normal maps, AO, curvature, and channel packing."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


class BakeType(Enum):
    """Supported bake texture types."""

    NORMAL = "NORMAL"
    AO = "AO"
    CURVATURE = "CURVATURE"
    DIFFUSE = "DIFFUSE"
    ROUGHNESS = "ROUGHNESS"
    METALLIC = "METALLIC"
    EMISSION = "EMIT"
    COMBINED = "COMBINED"
    SHADOW = "SHADOW"


@dataclass
class BakeSettings:
    """Configuration for texture baking."""

    resolution: int = 2048
    samples: int = 64
    margin: int = 16
    cage_extrusion: float = 0.1


class TextureBaker:
    """Bakes textures from high-poly to low-poly meshes."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def bake_texture(
        self,
        high_poly: Any,
        low_poly: Any,
        bake_type: BakeType,
        settings: BakeSettings,
        output_path: str,
    ) -> str:
        """Bake a texture map from high-poly to low-poly."""
        self._require_bpy()
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        image = bpy.data.images.new(
            name=f"bake_{bake_type.value}",
            width=settings.resolution,
            height=settings.resolution,
        )

        self._setup_bake_material(low_poly, image)

        bpy.context.scene.render.engine = "CYCLES"
        bpy.context.scene.cycles.samples = settings.samples
        bpy.context.scene.render.bake.margin = settings.margin
        bpy.context.scene.render.bake.cage_extrusion = settings.cage_extrusion
        bpy.context.scene.render.bake.use_selected_to_active = True

        bpy.ops.object.select_all(action="DESELECT")
        high_poly.select_set(True)
        low_poly.select_set(True)
        bpy.context.view_layer.objects.active = low_poly

        actual_type = bake_type.value
        if bake_type == BakeType.CURVATURE:
            actual_type = "NORMAL"

        bpy.ops.object.bake(type=actual_type)

        image.filepath_raw = str(output_file)
        image.file_format = "PNG"
        image.save()

        logger.info("Baked %s map to %s", bake_type.value, output_path)
        return str(output_file)

    def bake_all_maps(
        self,
        high_poly: Any,
        low_poly: Any,
        settings: BakeSettings,
        output_dir: str,
    ) -> dict[str, str]:
        """Bake all standard texture maps."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        bake_types = [BakeType.NORMAL, BakeType.AO, BakeType.DIFFUSE, BakeType.ROUGHNESS]

        results: dict[str, str] = {}
        for bake_type in bake_types:
            filepath = str(output_path / f"{low_poly.name}_{bake_type.value.lower()}.png")
            result = self.bake_texture(high_poly, low_poly, bake_type, settings, filepath)
            results[bake_type.value] = result

        return results

    def bake_ao(
        self,
        obj: Any,
        settings: BakeSettings,
        output_path: str,
    ) -> str:
        """Bake ambient occlusion for a single object."""
        self._require_bpy()
        image = bpy.data.images.new(
            name="bake_ao", width=settings.resolution, height=settings.resolution,
        )
        self._setup_bake_material(obj, image)

        bpy.context.scene.render.engine = "CYCLES"
        bpy.context.scene.cycles.samples = settings.samples
        bpy.context.scene.render.bake.use_selected_to_active = False

        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type="AO")

        image.filepath_raw = output_path
        image.file_format = "PNG"
        image.save()
        return output_path

    def bake_normal_map(
        self,
        high_poly: Any,
        low_poly: Any,
        settings: BakeSettings,
        output_path: str,
    ) -> str:
        """Bake a tangent-space normal map."""
        return self.bake_texture(high_poly, low_poly, BakeType.NORMAL, settings, output_path)

    def bake_curvature(
        self,
        obj: Any,
        settings: BakeSettings,
        output_path: str,
    ) -> str:
        """Bake a curvature map (approximated from normals)."""
        return self.bake_texture(obj, obj, BakeType.CURVATURE, settings, output_path)

    def create_cage(self, low_poly: Any, extrusion: float = 0.1) -> Any:
        """Create a baking cage mesh from the low-poly object."""
        self._require_bpy()
        cage = low_poly.copy()
        cage.data = low_poly.data.copy()
        cage.name = f"{low_poly.name}_cage"
        bpy.context.collection.objects.link(cage)

        modifier = cage.modifiers.new(name="Displace", type="DISPLACE")
        modifier.strength = extrusion

        bpy.context.view_layer.objects.active = cage
        bpy.ops.object.select_all(action="DESELECT")
        cage.select_set(True)
        bpy.ops.object.modifier_apply(modifier="Displace")

        return cage

    def setup_bake_materials(
        self,
        high_poly: Any,
        low_poly: Any,
        bake_type: BakeType,
    ) -> None:
        """Configure materials on both objects for baking."""
        self._require_bpy()
        image = bpy.data.images.new(
            name=f"bake_{bake_type.value}",
            width=2048, height=2048,
        )
        self._setup_bake_material(low_poly, image)

    def combine_maps(
        self,
        maps: dict[str, str],
        output_path: str,
    ) -> str:
        """Combine channel maps into a packed texture (e.g., ORM = AO+Roughness+Metallic)."""
        try:
            from PIL import Image
        except ImportError:
            logger.error("Pillow required for map combining: pip install Pillow")
            return ""

        channels = {}
        size = None
        for channel_name, map_path in maps.items():
            img = Image.open(map_path).convert("L")
            if size is None:
                size = img.size
            else:
                img = img.resize(size)
            channels[channel_name] = img

        if not channels or size is None:
            return ""

        default_channel = Image.new("L", size, 0)
        red = channels.get("AO", channels.get("R", default_channel))
        green = channels.get("ROUGHNESS", channels.get("G", default_channel))
        blue = channels.get("METALLIC", channels.get("B", default_channel))

        combined = Image.merge("RGB", (red, green, blue))
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        combined.save(output_path)
        logger.info("Combined maps saved to %s", output_path)
        return output_path

    def _setup_bake_material(self, obj: Any, image: Any) -> None:
        """Ensure the object has a material with an image texture node selected for baking."""
        if not obj.data.materials:
            mat = bpy.data.materials.new(name=f"{obj.name}_bake_mat")
            mat.use_nodes = True
            obj.data.materials.append(mat)

        mat = obj.data.materials[0]
        if not mat.use_nodes:
            mat.use_nodes = True

        nodes = mat.node_tree.nodes
        tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.image = image
        tex_node.select = True
        nodes.active = tex_node
