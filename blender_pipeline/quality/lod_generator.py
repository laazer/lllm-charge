"""Level of Detail (LOD) generation via mesh decimation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class LODLevel:
    """Specification for a single LOD level."""

    level: int
    ratio: float
    name: str = ""

    def __post_init__(self) -> None:
        if not self.name:
            self.name = f"LOD{self.level}"


DEFAULT_LOD_LEVELS = [
    LODLevel(0, 1.0, "LOD0_Full"),
    LODLevel(1, 0.5, "LOD1_Half"),
    LODLevel(2, 0.25, "LOD2_Quarter"),
    LODLevel(3, 0.1, "LOD3_Low"),
]

PLATFORM_LOD_TARGETS: dict[str, list[LODLevel]] = {
    "mobile": [
        LODLevel(0, 1.0), LODLevel(1, 0.3), LODLevel(2, 0.1), LODLevel(3, 0.03),
    ],
    "desktop": [
        LODLevel(0, 1.0), LODLevel(1, 0.5), LODLevel(2, 0.25), LODLevel(3, 0.1),
    ],
    "web": [
        LODLevel(0, 0.5), LODLevel(1, 0.2), LODLevel(2, 0.05),
    ],
    "vr": [
        LODLevel(0, 1.0), LODLevel(1, 0.6), LODLevel(2, 0.3), LODLevel(3, 0.15),
    ],
}


class LODGenerator:
    """Generates Level of Detail mesh variants via decimation."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def get_vertex_count(self, obj: Any) -> int:
        """Return the vertex count of a mesh object."""
        self._require_bpy()
        return len(obj.data.vertices)

    def get_face_count(self, obj: Any) -> int:
        """Return the face/polygon count of a mesh object."""
        self._require_bpy()
        return len(obj.data.polygons)

    def estimate_memory(self, obj: Any) -> int:
        """Estimate GPU memory in bytes (rough: 32 bytes/vertex + 12 bytes/face)."""
        self._require_bpy()
        return self.get_vertex_count(obj) * 32 + self.get_face_count(obj) * 12

    def generate_lod(
        self,
        obj: Any,
        levels: list[LODLevel] | None = None,
    ) -> list[Any]:
        """Create decimated copies at each LOD level."""
        self._require_bpy()
        levels = levels or DEFAULT_LOD_LEVELS
        lod_objects: list[Any] = []

        for level in levels:
            if level.ratio >= 1.0:
                lod_objects.append(obj)
                continue

            copy = obj.copy()
            copy.data = obj.data.copy()
            copy.name = f"{obj.name}_{level.name}"
            bpy.context.collection.objects.link(copy)

            modifier = copy.modifiers.new(name="Decimate", type="DECIMATE")
            modifier.ratio = level.ratio

            bpy.context.view_layer.objects.active = copy
            bpy.ops.object.select_all(action="DESELECT")
            copy.select_set(True)
            bpy.ops.object.modifier_apply(modifier="Decimate")

            lod_objects.append(copy)
            logger.info(
                "Created %s: %d vertices (%.0f%% of original)",
                copy.name, self.get_vertex_count(copy), level.ratio * 100,
            )

        return lod_objects

    def generate_default_lods(self, obj: Any) -> list[Any]:
        """Generate LODs using default levels."""
        return self.generate_lod(obj, DEFAULT_LOD_LEVELS)

    def setup_lod_group(
        self,
        original: Any,
        lod_objects: list[Any],
        distances: list[float] | None = None,
    ) -> Any:
        """Create an empty as LOD group parent with distance-based visibility."""
        self._require_bpy()
        if distances is None:
            distances = [0, 10, 25, 50]

        lod_group = bpy.data.objects.new(f"{original.name}_LODGroup", None)
        lod_group.empty_display_type = "ARROWS"
        bpy.context.collection.objects.link(lod_group)

        for index, lod_obj in enumerate(lod_objects):
            lod_obj.parent = lod_group
            if index < len(distances):
                lod_obj["lod_distance"] = distances[index]

        return lod_group

    def auto_lod_levels(self, obj: Any, target_platform: str = "desktop") -> list[LODLevel]:
        """Determine optimal LOD levels based on mesh complexity and target platform."""
        if target_platform in PLATFORM_LOD_TARGETS:
            return PLATFORM_LOD_TARGETS[target_platform]
        return DEFAULT_LOD_LEVELS
