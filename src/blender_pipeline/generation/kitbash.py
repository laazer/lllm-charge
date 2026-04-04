"""Modular kitbashing system for assembling 3D structures from reusable components."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class SnapPoint:
    """A connection point on a component for snapping."""

    position: tuple[float, float, float]
    direction: tuple[float, float, float] = (0.0, 0.0, 1.0)
    label: str = ""


@dataclass
class KitbashComponent:
    """A reusable building block for kitbashing."""

    name: str
    category: str
    mesh_generator: Callable[[], Any]
    snap_points: list[SnapPoint] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class BuildingConfig:
    """Configuration for procedural building generation."""

    floors: int = 2
    width: float = 4.0
    depth: float = 4.0
    floor_height: float = 3.0
    style: str = "modern"
    has_roof: bool = True
    door_count: int = 1
    window_count: int = 4


# ── Default component generators ────────────────────────────────────

def _make_wall() -> Any:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = (2.0, 0.1, 1.5)
    obj.name = "Wall"
    return obj


def _make_floor_panel() -> Any:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = (2.0, 2.0, 0.05)
    obj.name = "Floor"
    return obj


def _make_door() -> Any:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = (0.5, 0.05, 1.0)
    obj.name = "Door"
    return obj


def _make_window() -> Any:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = (0.4, 0.02, 0.4)
    obj.name = "Window"
    return obj


def _make_roof() -> Any:
    bpy.ops.mesh.primitive_cone_add(radius1=2.8, depth=1.5, vertices=4)
    obj = bpy.context.active_object
    obj.name = "Roof"
    return obj


def _make_column() -> Any:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=3.0, vertices=12)
    obj = bpy.context.active_object
    obj.name = "Column"
    return obj


def _make_stairs() -> Any:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = (0.6, 0.3, 0.1)
    obj.name = "Stairs"
    return obj


def _make_decorative() -> Any:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, segments=12, ring_count=8)
    obj = bpy.context.active_object
    obj.name = "Decorative"
    return obj


# ── Default components ──────────────────────────────────────────────

DEFAULT_COMPONENTS = [
    KitbashComponent(
        name="basic_wall", category="walls", mesh_generator=_make_wall,
        snap_points=[
            SnapPoint((-1.0, 0.0, 0.0), (-1.0, 0.0, 0.0), "left"),
            SnapPoint((1.0, 0.0, 0.0), (1.0, 0.0, 0.0), "right"),
            SnapPoint((0.0, 0.0, 0.75), (0.0, 0.0, 1.0), "top"),
        ],
        tags=["structure", "basic"],
    ),
    KitbashComponent(
        name="basic_floor", category="floors", mesh_generator=_make_floor_panel,
        snap_points=[SnapPoint((0.0, 0.0, 0.025), (0.0, 0.0, 1.0), "top")],
        tags=["structure", "basic"],
    ),
    KitbashComponent(
        name="basic_door", category="doors", mesh_generator=_make_door,
        snap_points=[SnapPoint((0.0, 0.0, -0.5), (0.0, 0.0, -1.0), "bottom")],
        tags=["opening", "basic"],
    ),
    KitbashComponent(
        name="basic_window", category="windows", mesh_generator=_make_window,
        snap_points=[SnapPoint((0.0, 0.0, 0.0), (0.0, -1.0, 0.0), "face")],
        tags=["opening", "basic"],
    ),
    KitbashComponent(
        name="basic_roof", category="roofs", mesh_generator=_make_roof,
        snap_points=[SnapPoint((0.0, 0.0, -0.75), (0.0, 0.0, -1.0), "bottom")],
        tags=["structure", "basic"],
    ),
    KitbashComponent(
        name="basic_column", category="columns", mesh_generator=_make_column,
        snap_points=[
            SnapPoint((0.0, 0.0, -1.5), (0.0, 0.0, -1.0), "bottom"),
            SnapPoint((0.0, 0.0, 1.5), (0.0, 0.0, 1.0), "top"),
        ],
        tags=["structure", "decorative"],
    ),
    KitbashComponent(
        name="basic_stairs", category="stairs", mesh_generator=_make_stairs,
        snap_points=[SnapPoint((0.0, 0.0, 0.05), (0.0, 0.0, 1.0), "top")],
        tags=["structure", "basic"],
    ),
    KitbashComponent(
        name="basic_decorative", category="decorative", mesh_generator=_make_decorative,
        snap_points=[],
        tags=["decorative"],
    ),
]


# ── Library ─────────────────────────────────────────────────────────

class KitbashLibrary:
    """Registry of reusable kitbash components."""

    def __init__(self, load_defaults: bool = True) -> None:
        self._components: dict[str, KitbashComponent] = {}
        if load_defaults and HAS_BPY:
            for component in DEFAULT_COMPONENTS:
                self.register_component(component)

    def register_component(self, component: KitbashComponent) -> None:
        self._components[component.name] = component

    def get_component(self, name: str) -> KitbashComponent:
        if name not in self._components:
            raise KeyError(f"Component '{name}' not found in library")
        return self._components[name]

    def get_components_by_category(self, category: str) -> list[KitbashComponent]:
        return [c for c in self._components.values() if c.category == category]

    def get_components_by_tag(self, tag: str) -> list[KitbashComponent]:
        return [c for c in self._components.values() if tag in c.tags]

    def list_components(self) -> list[str]:
        return list(self._components.keys())

    def list_categories(self) -> list[str]:
        return list({c.category for c in self._components.values()})


# ── Assembler ───────────────────────────────────────────────────────

class KitbashAssembler:
    """Places and connects kitbash components to build structures."""

    def __init__(self, library: KitbashLibrary) -> None:
        self.library = library
        self._placed_objects: dict[str, Any] = {}

    def place_component(
        self,
        component_name: str,
        position: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
        scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
        instance_name: Optional[str] = None,
    ) -> Any:
        """Place a component from the library into the scene."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        component = self.library.get_component(component_name)
        obj = component.mesh_generator()
        obj.location = position
        obj.rotation_euler = rotation
        obj.scale = tuple(s1 * s2 for s1, s2 in zip(obj.scale, scale))

        label = instance_name or f"{component_name}_{len(self._placed_objects)}"
        obj.name = label
        self._placed_objects[label] = obj
        return obj

    def snap_components(
        self,
        source_name: str,
        source_snap_index: int,
        target_name: str,
        target_snap_index: int,
    ) -> None:
        """Snap two placed components together by their snap points."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        source_obj = self._placed_objects[source_name]
        target_obj = self._placed_objects[target_name]

        source_component = self.library.get_component(source_name.rsplit("_", 1)[0])
        target_component = self.library.get_component(target_name.rsplit("_", 1)[0])

        source_snap = source_component.snap_points[source_snap_index]
        target_snap = target_component.snap_points[target_snap_index]

        offset = tuple(
            t + tp - sp
            for t, tp, sp in zip(target_obj.location, target_snap.position, source_snap.position)
        )
        source_obj.location = offset

    def generate_building(self, config: BuildingConfig) -> list[Any]:
        """Procedurally assemble a building from library components."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        created_objects: list[Any] = []
        half_width = config.width / 2
        half_depth = config.depth / 2

        for floor_index in range(config.floors):
            floor_z = floor_index * config.floor_height

            floor_obj = self.place_component(
                "basic_floor",
                position=(0.0, 0.0, floor_z),
                scale=(config.width / 4, config.depth / 4, 1.0),
                instance_name=f"floor_{floor_index}",
            )
            created_objects.append(floor_obj)

            wall_positions = [
                (0.0, half_depth, floor_z + config.floor_height / 2, (0.0, 0.0, 0.0)),
                (0.0, -half_depth, floor_z + config.floor_height / 2, (0.0, 0.0, 0.0)),
                (half_width, 0.0, floor_z + config.floor_height / 2, (0.0, 0.0, 1.5708)),
                (-half_width, 0.0, floor_z + config.floor_height / 2, (0.0, 0.0, 1.5708)),
            ]
            for wall_index, (wx, wy, wz, wrot) in enumerate(wall_positions):
                wall_label = f"wall_f{floor_index}_w{wall_index}"
                wall_obj = self.place_component(
                    "basic_wall",
                    position=(wx, wy, wz),
                    rotation=wrot,
                    scale=(config.width / 4, 1.0, config.floor_height / 3),
                    instance_name=wall_label,
                )
                created_objects.append(wall_obj)

        if config.has_roof:
            roof_z = config.floors * config.floor_height
            roof_obj = self.place_component(
                "basic_roof",
                position=(0.0, 0.0, roof_z + 0.75),
                scale=(config.width / 5.6, config.depth / 5.6, 1.0),
                instance_name="roof",
            )
            created_objects.append(roof_obj)

        if config.door_count > 0 and "basic_door" in self.library.list_components():
            door_obj = self.place_component(
                "basic_door",
                position=(0.0, half_depth + 0.01, 0.5),
                instance_name="door_main",
            )
            created_objects.append(door_obj)

        for window_index in range(min(config.window_count, config.floors * 4)):
            floor_index = window_index // 4
            side = window_index % 4
            window_z = floor_index * config.floor_height + config.floor_height * 0.6
            window_positions = [
                (half_width * 0.5, half_depth + 0.01, window_z),
                (-half_width * 0.5, half_depth + 0.01, window_z),
                (half_width + 0.01, half_depth * 0.5, window_z),
                (half_width + 0.01, -half_depth * 0.5, window_z),
            ]
            if side < len(window_positions):
                wx, wy, wz = window_positions[side]
                window_obj = self.place_component(
                    "basic_window",
                    position=(wx, wy, wz),
                    instance_name=f"window_{window_index}",
                )
                created_objects.append(window_obj)

        return created_objects
