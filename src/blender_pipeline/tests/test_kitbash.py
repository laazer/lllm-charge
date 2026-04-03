"""Tests for the kitbash library and assembler system."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import blender_pipeline.generation.kitbash as kitbash_mod
from blender_pipeline.generation.kitbash import (
    BuildingConfig,
    KitbashAssembler,
    KitbashComponent,
    KitbashLibrary,
    SnapPoint,
    DEFAULT_COMPONENTS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_bpy(mock_blender_modules: dict) -> MagicMock:
    """Patch the kitbash module to think bpy is available and return the mock."""
    mock_bpy = mock_blender_modules["bpy"]
    kitbash_mod.HAS_BPY = True
    kitbash_mod.bpy = mock_bpy

    active_object = MagicMock(name="ActiveObject")
    active_object.scale = (1.0, 1.0, 1.0)
    active_object.location = (0.0, 0.0, 0.0)
    active_object.rotation_euler = (0.0, 0.0, 0.0)
    mock_bpy.context.active_object = active_object
    return mock_bpy


def _make_library_with_defaults(mock_blender_modules: dict) -> KitbashLibrary:
    """Create a KitbashLibrary with all DEFAULT_COMPONENTS registered."""
    _setup_bpy(mock_blender_modules)
    library = KitbashLibrary(load_defaults=False)
    for component in DEFAULT_COMPONENTS:
        library.register_component(component)
    return library


# ---------------------------------------------------------------------------
# SnapPoint dataclass
# ---------------------------------------------------------------------------

class TestSnapPoint:
    def test_creation_with_defaults(self) -> None:
        snap_point = SnapPoint(position=(1.0, 2.0, 3.0))
        assert snap_point.position == (1.0, 2.0, 3.0)
        assert snap_point.direction == (0.0, 0.0, 1.0)
        assert snap_point.label == ""

    def test_creation_with_custom_values(self) -> None:
        snap_point = SnapPoint(
            position=(0.0, 0.0, 0.0),
            direction=(1.0, 0.0, 0.0),
            label="top",
        )
        assert snap_point.direction == (1.0, 0.0, 0.0)
        assert snap_point.label == "top"


# ---------------------------------------------------------------------------
# KitbashComponent dataclass
# ---------------------------------------------------------------------------

class TestKitbashComponent:
    def test_creation_with_defaults(self) -> None:
        generator_function = MagicMock()
        component = KitbashComponent(
            name="test_comp",
            category="walls",
            mesh_generator=generator_function,
        )
        assert component.name == "test_comp"
        assert component.category == "walls"
        assert component.mesh_generator is generator_function
        assert component.snap_points == []
        assert component.tags == []

    def test_creation_with_snap_points_and_tags(self) -> None:
        snap_points = [SnapPoint((0.0, 0.0, 0.0), label="origin")]
        component = KitbashComponent(
            name="fancy",
            category="decorative",
            mesh_generator=MagicMock(),
            snap_points=snap_points,
            tags=["shiny", "metal"],
        )
        assert len(component.snap_points) == 1
        assert component.tags == ["shiny", "metal"]


# ---------------------------------------------------------------------------
# BuildingConfig dataclass
# ---------------------------------------------------------------------------

class TestBuildingConfig:
    def test_defaults(self) -> None:
        config = BuildingConfig()
        assert config.floors == 2
        assert config.width == 4.0
        assert config.depth == 4.0
        assert config.floor_height == 3.0
        assert config.style == "modern"
        assert config.has_roof is True
        assert config.door_count == 1
        assert config.window_count == 4

    def test_custom_values(self) -> None:
        config = BuildingConfig(
            floors=5,
            width=10.0,
            depth=8.0,
            floor_height=4.0,
            style="gothic",
            has_roof=False,
            door_count=2,
            window_count=12,
        )
        assert config.floors == 5
        assert config.style == "gothic"
        assert config.has_roof is False


# ---------------------------------------------------------------------------
# DEFAULT_COMPONENTS
# ---------------------------------------------------------------------------

class TestDefaultComponents:
    def test_all_components_have_required_fields(self) -> None:
        assert len(DEFAULT_COMPONENTS) == 8
        for component in DEFAULT_COMPONENTS:
            assert isinstance(component.name, str)
            assert len(component.name) > 0
            assert isinstance(component.category, str)
            assert len(component.category) > 0
            assert callable(component.mesh_generator)
            assert isinstance(component.snap_points, list)

    def test_expected_component_names(self) -> None:
        names = {component.name for component in DEFAULT_COMPONENTS}
        expected_names = {
            "basic_wall", "basic_floor", "basic_door", "basic_window",
            "basic_roof", "basic_column", "basic_stairs", "basic_decorative",
        }
        assert names == expected_names

    def test_expected_categories(self) -> None:
        categories = {component.category for component in DEFAULT_COMPONENTS}
        expected_categories = {
            "walls", "floors", "doors", "windows",
            "roofs", "columns", "stairs", "decorative",
        }
        assert categories == expected_categories


# ---------------------------------------------------------------------------
# KitbashLibrary
# ---------------------------------------------------------------------------

class TestKitbashLibrary:
    def test_init_no_defaults(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        assert library.list_components() == []

    def test_init_loads_defaults_when_bpy_available(self, mock_blender_modules: dict) -> None:
        kitbash_mod.HAS_BPY = True
        library = KitbashLibrary(load_defaults=True)
        assert len(library.list_components()) == len(DEFAULT_COMPONENTS)

    def test_init_skips_defaults_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        kitbash_mod.HAS_BPY = False
        library = KitbashLibrary(load_defaults=True)
        assert library.list_components() == []

    def test_register_component(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        component = KitbashComponent(
            name="custom_piece",
            category="custom",
            mesh_generator=MagicMock(),
        )
        library.register_component(component)
        assert "custom_piece" in library.list_components()

    def test_get_component(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        component = KitbashComponent(
            name="my_comp",
            category="test",
            mesh_generator=MagicMock(),
        )
        library.register_component(component)
        retrieved = library.get_component("my_comp")
        assert retrieved is component

    def test_get_component_unknown_raises_key_error(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        with pytest.raises(KeyError, match="Component 'nonexistent' not found"):
            library.get_component("nonexistent")

    def test_get_components_by_category(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        wall_component = KitbashComponent(
            name="wall_a", category="walls", mesh_generator=MagicMock()
        )
        floor_component = KitbashComponent(
            name="floor_a", category="floors", mesh_generator=MagicMock()
        )
        library.register_component(wall_component)
        library.register_component(floor_component)

        walls = library.get_components_by_category("walls")
        assert len(walls) == 1
        assert walls[0].name == "wall_a"

    def test_get_components_by_tag(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        component_a = KitbashComponent(
            name="comp_a", category="x", mesh_generator=MagicMock(), tags=["metal"]
        )
        component_b = KitbashComponent(
            name="comp_b", category="y", mesh_generator=MagicMock(), tags=["wood"]
        )
        component_c = KitbashComponent(
            name="comp_c", category="z", mesh_generator=MagicMock(), tags=["metal", "shiny"]
        )
        library.register_component(component_a)
        library.register_component(component_b)
        library.register_component(component_c)

        metal_components = library.get_components_by_tag("metal")
        assert len(metal_components) == 2
        metal_names = {c.name for c in metal_components}
        assert metal_names == {"comp_a", "comp_c"}

    def test_list_categories(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        library.register_component(
            KitbashComponent(name="a", category="walls", mesh_generator=MagicMock())
        )
        library.register_component(
            KitbashComponent(name="b", category="floors", mesh_generator=MagicMock())
        )
        library.register_component(
            KitbashComponent(name="c", category="walls", mesh_generator=MagicMock())
        )

        categories = library.list_categories()
        assert set(categories) == {"walls", "floors"}

    def test_list_components(self, mock_blender_modules: dict) -> None:
        library = KitbashLibrary(load_defaults=False)
        library.register_component(
            KitbashComponent(name="alpha", category="x", mesh_generator=MagicMock())
        )
        library.register_component(
            KitbashComponent(name="beta", category="y", mesh_generator=MagicMock())
        )
        assert set(library.list_components()) == {"alpha", "beta"}


# ---------------------------------------------------------------------------
# KitbashAssembler
# ---------------------------------------------------------------------------

class TestKitbashAssembler:
    def test_place_component_calls_mesh_generator(self, mock_blender_modules: dict) -> None:
        _setup_bpy(mock_blender_modules)
        mesh_generator = MagicMock()
        placed_object = MagicMock()
        placed_object.scale = (1.0, 1.0, 1.0)
        mesh_generator.return_value = placed_object

        library = KitbashLibrary(load_defaults=False)
        library.register_component(
            KitbashComponent(name="test_part", category="parts", mesh_generator=mesh_generator)
        )

        assembler = KitbashAssembler(library)
        result = assembler.place_component(
            "test_part",
            position=(1.0, 2.0, 3.0),
            rotation=(0.1, 0.2, 0.3),
            scale=(2.0, 2.0, 2.0),
            instance_name="my_instance",
        )

        mesh_generator.assert_called_once()
        assert result.location == (1.0, 2.0, 3.0)
        assert result.rotation_euler == (0.1, 0.2, 0.3)
        # scale is element-wise multiply: (1*2, 1*2, 1*2)
        assert result.scale == (2.0, 2.0, 2.0)
        assert result.name == "my_instance"

    def test_place_component_auto_names(self, mock_blender_modules: dict) -> None:
        _setup_bpy(mock_blender_modules)
        mesh_generator = MagicMock()
        placed_object = MagicMock()
        placed_object.scale = (1.0, 1.0, 1.0)
        mesh_generator.return_value = placed_object

        library = KitbashLibrary(load_defaults=False)
        library.register_component(
            KitbashComponent(name="part", category="parts", mesh_generator=mesh_generator)
        )

        assembler = KitbashAssembler(library)
        result = assembler.place_component("part")

        assert result.name == "part_0"

    def test_place_component_raises_without_bpy(self, mock_blender_modules: dict) -> None:
        kitbash_mod.HAS_BPY = False
        library = KitbashLibrary(load_defaults=False)
        library.register_component(
            KitbashComponent(name="part", category="parts", mesh_generator=MagicMock())
        )
        assembler = KitbashAssembler(library)

        with pytest.raises(RuntimeError, match="bpy is not available"):
            assembler.place_component("part")

    def test_generate_building_default_config(self, mock_blender_modules: dict) -> None:
        library = _make_library_with_defaults(mock_blender_modules)
        assembler = KitbashAssembler(library)

        # Each DEFAULT_COMPONENTS mesh_generator is a module-level function that
        # calls bpy.ops.mesh.*, which is already mocked. We need the generators
        # to return mock objects with .scale, .location, etc.
        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.context.active_object = MagicMock()
        mock_bpy.context.active_object.scale = (1.0, 1.0, 1.0)
        mock_bpy.context.active_object.location = (0.0, 0.0, 0.0)

        config = BuildingConfig()
        created_objects = assembler.generate_building(config)

        # Default config: 2 floors, has_roof, 1 door, 4 windows
        # Per floor: 1 floor + 4 walls = 5; 2 floors = 10
        # Plus 1 roof + 1 door + 4 windows = 6
        # Total = 16
        assert len(created_objects) == 16

    def test_generate_building_no_roof(self, mock_blender_modules: dict) -> None:
        library = _make_library_with_defaults(mock_blender_modules)
        assembler = KitbashAssembler(library)

        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.context.active_object = MagicMock()
        mock_bpy.context.active_object.scale = (1.0, 1.0, 1.0)

        config = BuildingConfig(has_roof=False, door_count=0, window_count=0)
        created_objects = assembler.generate_building(config)

        # 2 floors * (1 floor + 4 walls) = 10
        assert len(created_objects) == 10

    def test_generate_building_single_floor_no_extras(self, mock_blender_modules: dict) -> None:
        library = _make_library_with_defaults(mock_blender_modules)
        assembler = KitbashAssembler(library)

        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.context.active_object = MagicMock()
        mock_bpy.context.active_object.scale = (1.0, 1.0, 1.0)

        config = BuildingConfig(
            floors=1, has_roof=False, door_count=0, window_count=0
        )
        created_objects = assembler.generate_building(config)

        # 1 floor + 4 walls = 5
        assert len(created_objects) == 5

    def test_generate_building_raises_without_bpy(self, mock_blender_modules: dict) -> None:
        kitbash_mod.HAS_BPY = False
        library = KitbashLibrary(load_defaults=False)
        assembler = KitbashAssembler(library)

        with pytest.raises(RuntimeError, match="bpy is not available"):
            assembler.generate_building(BuildingConfig())
