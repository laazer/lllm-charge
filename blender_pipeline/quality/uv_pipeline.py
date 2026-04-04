"""UV auto-unwrapping pipeline with multiple projection methods."""

from __future__ import annotations

import logging
from typing import Any

try:
    import bpy
    import bmesh
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    bmesh = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)

UV_METHODS = ("smart", "lightmap", "cube", "cylinder", "sphere", "auto")


class UVPipeline:
    """UV unwrapping pipeline with multiple methods and auto-detection."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def _enter_edit_mode(self, obj: Any) -> None:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")

    def _exit_edit_mode(self) -> None:
        bpy.ops.object.mode_set(mode="OBJECT")

    def smart_uv_project(
        self,
        obj: Any,
        angle_limit: float = 66.0,
        island_margin: float = 0.02,
        area_weight: float = 0.0,
    ) -> None:
        """Apply Smart UV Project unwrapping."""
        self._require_bpy()
        self._enter_edit_mode(obj)
        bpy.ops.uv.smart_project(
            angle_limit=angle_limit,
            island_margin=island_margin,
            area_weight=area_weight,
        )
        self._exit_edit_mode()

    def lightmap_pack(
        self,
        obj: Any,
        quality: int = 12,
        margin: float = 0.1,
    ) -> None:
        """Apply Lightmap UV pack."""
        self._require_bpy()
        self._enter_edit_mode(obj)
        bpy.ops.uv.lightmap_pack(
            PREF_CONTEXT="ALL_FACES",
            PREF_PACK_IN_ONE=True,
            PREF_BOX_DIV=quality,
            PREF_MARGIN_DIV=margin,
        )
        self._exit_edit_mode()

    def cube_project(self, obj: Any, cube_size: float = 1.0) -> None:
        """Apply cube projection UV unwrapping."""
        self._require_bpy()
        self._enter_edit_mode(obj)
        bpy.ops.uv.cube_project(cube_size=cube_size)
        self._exit_edit_mode()

    def cylinder_project(self, obj: Any) -> None:
        """Apply cylindrical projection UV unwrapping."""
        self._require_bpy()
        self._enter_edit_mode(obj)
        bpy.ops.uv.cylinder_project()
        self._exit_edit_mode()

    def sphere_project(self, obj: Any) -> None:
        """Apply spherical projection UV unwrapping."""
        self._require_bpy()
        self._enter_edit_mode(obj)
        bpy.ops.uv.sphere_project()
        self._exit_edit_mode()

    def auto_unwrap(self, obj: Any, method: str = "auto") -> None:
        """Unwrap using the specified method, or auto-detect the best one."""
        if method == "auto":
            method = self.detect_best_method(obj)

        method_map = {
            "smart": self.smart_uv_project,
            "lightmap": self.lightmap_pack,
            "cube": self.cube_project,
            "cylinder": self.cylinder_project,
            "sphere": self.sphere_project,
        }
        unwrap_function = method_map.get(method, self.smart_uv_project)
        unwrap_function(obj)
        logger.info("UV unwrapped '%s' using method: %s", obj.name, method)

    def detect_best_method(self, obj: Any) -> str:
        """Analyze geometry to recommend the best UV method."""
        self._require_bpy()
        dimensions = obj.dimensions
        dx, dy, dz = dimensions.x, dimensions.y, dimensions.z

        if dx > 0 and dy > 0 and dz > 0:
            aspect_ratios = sorted([dx / max(dy, 0.001), dy / max(dz, 0.001), dz / max(dx, 0.001)])
            if aspect_ratios[0] < 0.2:
                return "cylinder"
            if all(0.8 < r < 1.2 for r in aspect_ratios):
                return "sphere" if _is_roughly_spherical(obj) else "cube"

        return "smart"

    def batch_unwrap(self, objects: list[Any], method: str = "auto") -> None:
        """Unwrap multiple objects."""
        for obj in objects:
            self.auto_unwrap(obj, method)

    def pack_islands(self, obj: Any, margin: float = 0.01) -> None:
        """Optimize UV island packing."""
        self._require_bpy()
        self._enter_edit_mode(obj)
        bpy.ops.uv.pack_islands(margin=margin)
        self._exit_edit_mode()

    def generate_uv_grid_texture(
        self,
        obj: Any,
        resolution: int = 1024,
    ) -> Any:
        """Create and assign a UV checker texture for validation."""
        self._require_bpy()
        image = bpy.data.images.new(
            name="UV_Checker", width=resolution, height=resolution, generated_type="UV_GRID"
        )

        if not obj.data.materials:
            mat = bpy.data.materials.new(name="UV_Check_Material")
            mat.use_nodes = True
            obj.data.materials.append(mat)
        else:
            mat = obj.data.materials[0]

        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.image = image

        principled = nodes.get("Principled BSDF")
        if principled:
            links.new(tex_node.outputs["Color"], principled.inputs["Base Color"])

        return image


def _is_roughly_spherical(obj: Any) -> bool:
    """Quick heuristic: check if an object is roughly spherical by vertex distribution."""
    mesh = obj.data
    if len(mesh.vertices) < 8:
        return False
    center = [0.0, 0.0, 0.0]
    for vert in mesh.vertices:
        for i in range(3):
            center[i] += vert.co[i]
    vertex_count = len(mesh.vertices)
    center = [c / vertex_count for c in center]

    distances = []
    for vert in mesh.vertices:
        dist = sum((vert.co[i] - center[i]) ** 2 for i in range(3)) ** 0.5
        distances.append(dist)

    if not distances:
        return False
    avg_dist = sum(distances) / len(distances)
    variance = sum((d - avg_dist) ** 2 for d in distances) / len(distances)
    return variance / (avg_dist ** 2) < 0.05 if avg_dist > 0 else False
