"""Parametric mesh generation using Blender primitives."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)

SHAPE_TYPES = ("box", "sphere", "cylinder", "torus", "cone", "grid")


@dataclass
class MeshSpec:
    """Specification for a single mesh to generate."""

    shape: str
    name: Optional[str] = None
    position: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0)
    params: dict[str, Any] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.params is None:
            self.params = {}


class ParametricGenerator:
    """Creates parametric meshes in Blender."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def _set_transform(
        self,
        obj: Any,
        position: tuple[float, float, float],
        rotation: tuple[float, float, float],
        scale: tuple[float, float, float],
    ) -> None:
        obj.location = position
        obj.rotation_euler = rotation
        obj.scale = scale

    def _active_object(self) -> Any:
        return bpy.context.active_object

    # ── Primitive generators ────────────────────────────────────────

    def generate_box(
        self,
        width: float = 2.0,
        height: float = 2.0,
        depth: float = 2.0,
        segments: int = 1,
    ) -> Any:
        """Create a subdivided box."""
        self._require_bpy()
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = self._active_object()
        obj.scale = (width / 2, depth / 2, height / 2)
        if segments > 1:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.subdivide(number_cuts=segments - 1)
            bpy.ops.object.mode_set(mode="OBJECT")
        return obj

    def generate_sphere(
        self,
        radius: float = 1.0,
        segments: int = 32,
        rings: int = 16,
    ) -> Any:
        """Create a UV sphere."""
        self._require_bpy()
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius, segments=segments, ring_count=rings
        )
        return self._active_object()

    def generate_cylinder(
        self,
        radius: float = 1.0,
        height: float = 2.0,
        segments: int = 32,
    ) -> Any:
        """Create a cylinder with caps."""
        self._require_bpy()
        bpy.ops.mesh.primitive_cylinder_add(
            radius=radius, depth=height, vertices=segments
        )
        return self._active_object()

    def generate_torus(
        self,
        major_radius: float = 1.0,
        minor_radius: float = 0.25,
        major_segments: int = 48,
        minor_segments: int = 12,
    ) -> Any:
        """Create a torus."""
        self._require_bpy()
        bpy.ops.mesh.primitive_torus_add(
            major_radius=major_radius,
            minor_radius=minor_radius,
            major_segments=major_segments,
            minor_segments=minor_segments,
        )
        return self._active_object()

    def generate_cone(
        self,
        radius: float = 1.0,
        height: float = 2.0,
        segments: int = 32,
    ) -> Any:
        """Create a cone."""
        self._require_bpy()
        bpy.ops.mesh.primitive_cone_add(
            radius1=radius, depth=height, vertices=segments
        )
        return self._active_object()

    def generate_grid(
        self,
        size_x: float = 2.0,
        size_y: float = 2.0,
        subdivisions: int = 10,
    ) -> Any:
        """Create a flat grid mesh."""
        self._require_bpy()
        bpy.ops.mesh.primitive_grid_add(
            x_subdivisions=subdivisions,
            y_subdivisions=subdivisions,
            size=max(size_x, size_y),
        )
        obj = self._active_object()
        obj.scale = (size_x / max(size_x, size_y), size_y / max(size_x, size_y), 1.0)
        return obj

    # ── Generic dispatcher ──────────────────────────────────────────

    def generate_from_params(self, params: dict[str, Any]) -> Any:
        """Dispatch to the correct generator based on a 'shape' key."""
        shape = params.get("shape", "").lower()
        generator_map = {
            "box": self.generate_box,
            "cube": self.generate_box,
            "sphere": self.generate_sphere,
            "cylinder": self.generate_cylinder,
            "torus": self.generate_torus,
            "cone": self.generate_cone,
            "grid": self.generate_grid,
            "plane": self.generate_grid,
        }
        generator = generator_map.get(shape)
        if generator is None:
            raise ValueError(f"Unknown shape type: '{shape}'. Valid: {list(generator_map)}")

        filtered_params = {k: v for k, v in params.items() if k != "shape"}
        position = filtered_params.pop("position", (0.0, 0.0, 0.0))
        rotation = filtered_params.pop("rotation", (0.0, 0.0, 0.0))
        scale = filtered_params.pop("scale", (1.0, 1.0, 1.0))
        name = filtered_params.pop("name", None)

        obj = generator(**filtered_params)

        self._set_transform(obj, position, rotation, scale)
        if name:
            obj.name = name
        return obj

    # ── Batch generation ────────────────────────────────────────────

    def batch_generate(self, specs: list[dict[str, Any]]) -> list[Any]:
        """Create multiple objects from a list of parameter dicts."""
        return [self.generate_from_params(spec) for spec in specs]
