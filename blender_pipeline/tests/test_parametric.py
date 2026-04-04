"""Tests for parametric mesh generation (ParametricGenerator)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import blender_pipeline.generation.parametric as parametric_mod
from blender_pipeline.generation.parametric import MeshSpec, ParametricGenerator, SHAPE_TYPES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_bpy(mock_blender_modules: dict) -> MagicMock:
    """Patch the parametric module to think bpy is available and return the mock."""
    mock_bpy = mock_blender_modules["bpy"]
    parametric_mod.HAS_BPY = True
    parametric_mod.bpy = mock_bpy

    active_object = MagicMock(name="ActiveObject")
    active_object.scale = (1.0, 1.0, 1.0)
    mock_bpy.context.active_object = active_object
    return mock_bpy


# ---------------------------------------------------------------------------
# MeshSpec dataclass
# ---------------------------------------------------------------------------

class TestMeshSpec:
    def test_defaults(self) -> None:
        spec = MeshSpec(shape="box")
        assert spec.shape == "box"
        assert spec.position == (0.0, 0.0, 0.0)
        assert spec.rotation == (0.0, 0.0, 0.0)
        assert spec.scale == (1.0, 1.0, 1.0)
        assert spec.params == {}
        assert spec.name is None

    def test_custom_values(self) -> None:
        spec = MeshSpec(
            shape="sphere",
            name="MySphere",
            position=(1.0, 2.0, 3.0),
            rotation=(0.1, 0.2, 0.3),
            scale=(2.0, 2.0, 2.0),
            params={"radius": 5.0},
        )
        assert spec.name == "MySphere"
        assert spec.params == {"radius": 5.0}


class TestShapeTypes:
    def test_shape_types_tuple(self) -> None:
        assert isinstance(SHAPE_TYPES, tuple)
        for shape in ("box", "sphere", "cylinder", "torus", "cone", "grid"):
            assert shape in SHAPE_TYPES


# ---------------------------------------------------------------------------
# _require_bpy
# ---------------------------------------------------------------------------

class TestRequireBpy:
    def test_raises_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        parametric_mod.HAS_BPY = False
        generator = ParametricGenerator()
        with pytest.raises(RuntimeError, match="bpy is not available"):
            generator._require_bpy()

    def test_passes_when_bpy_available(self, mock_blender_modules: dict) -> None:
        parametric_mod.HAS_BPY = True
        generator = ParametricGenerator()
        generator._require_bpy()  # should not raise


# ---------------------------------------------------------------------------
# _set_transform
# ---------------------------------------------------------------------------

class TestSetTransform:
    def test_sets_location_rotation_scale(self, mock_blender_modules: dict) -> None:
        generator = ParametricGenerator()
        obj = MagicMock()
        position = (1.0, 2.0, 3.0)
        rotation = (0.1, 0.2, 0.3)
        scale = (4.0, 5.0, 6.0)

        generator._set_transform(obj, position, rotation, scale)

        assert obj.location == position
        assert obj.rotation_euler == rotation
        assert obj.scale == scale


# ---------------------------------------------------------------------------
# generate_box
# ---------------------------------------------------------------------------

class TestGenerateBox:
    def test_basic_box(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_box(4.0, 6.0, 2.0)

        mock_bpy.ops.mesh.primitive_cube_add.assert_called_once_with(size=1)
        assert result == mock_bpy.context.active_object
        assert result.scale == (2.0, 1.0, 3.0)  # width/2, depth/2, height/2

    def test_default_dimensions(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_box()

        assert result.scale == (1.0, 1.0, 1.0)  # 2/2, 2/2, 2/2

    def test_box_with_subdivisions(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_box(2.0, 2.0, 2.0, segments=3)

        mock_bpy.ops.object.mode_set.assert_any_call(mode="EDIT")
        mock_bpy.ops.mesh.subdivide.assert_called_once_with(number_cuts=2)
        mock_bpy.ops.object.mode_set.assert_any_call(mode="OBJECT")

    def test_box_no_subdivide_when_segments_one(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_box(2.0, 2.0, 2.0, segments=1)

        mock_bpy.ops.mesh.subdivide.assert_not_called()


# ---------------------------------------------------------------------------
# generate_sphere
# ---------------------------------------------------------------------------

class TestGenerateSphere:
    def test_default_sphere(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_sphere()

        mock_bpy.ops.mesh.primitive_uv_sphere_add.assert_called_once_with(
            radius=1.0, segments=32, ring_count=16
        )
        assert result == mock_bpy.context.active_object

    def test_custom_sphere(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_sphere(radius=2.5, segments=64, rings=32)

        mock_bpy.ops.mesh.primitive_uv_sphere_add.assert_called_once_with(
            radius=2.5, segments=64, ring_count=32
        )


# ---------------------------------------------------------------------------
# generate_cylinder
# ---------------------------------------------------------------------------

class TestGenerateCylinder:
    def test_default_cylinder(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_cylinder()

        mock_bpy.ops.mesh.primitive_cylinder_add.assert_called_once_with(
            radius=1.0, depth=2.0, vertices=32
        )
        assert result == mock_bpy.context.active_object

    def test_custom_cylinder(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_cylinder(radius=0.5, height=10.0, segments=16)

        mock_bpy.ops.mesh.primitive_cylinder_add.assert_called_once_with(
            radius=0.5, depth=10.0, vertices=16
        )


# ---------------------------------------------------------------------------
# generate_torus
# ---------------------------------------------------------------------------

class TestGenerateTorus:
    def test_default_torus(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_torus()

        mock_bpy.ops.mesh.primitive_torus_add.assert_called_once_with(
            major_radius=1.0,
            minor_radius=0.25,
            major_segments=48,
            minor_segments=12,
        )
        assert result == mock_bpy.context.active_object

    def test_custom_torus(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_torus(
            major_radius=3.0, minor_radius=0.5,
            major_segments=24, minor_segments=8,
        )

        mock_bpy.ops.mesh.primitive_torus_add.assert_called_once_with(
            major_radius=3.0,
            minor_radius=0.5,
            major_segments=24,
            minor_segments=8,
        )


# ---------------------------------------------------------------------------
# generate_cone
# ---------------------------------------------------------------------------

class TestGenerateCone:
    def test_default_cone(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_cone()

        mock_bpy.ops.mesh.primitive_cone_add.assert_called_once_with(
            radius1=1.0, depth=2.0, vertices=32
        )
        assert result == mock_bpy.context.active_object

    def test_custom_cone(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_cone(radius=2.0, height=5.0, segments=8)

        mock_bpy.ops.mesh.primitive_cone_add.assert_called_once_with(
            radius1=2.0, depth=5.0, vertices=8
        )


# ---------------------------------------------------------------------------
# generate_grid
# ---------------------------------------------------------------------------

class TestGenerateGrid:
    def test_default_grid(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_grid()

        mock_bpy.ops.mesh.primitive_grid_add.assert_called_once_with(
            x_subdivisions=10, y_subdivisions=10, size=2.0
        )
        assert result == mock_bpy.context.active_object
        # size_x == size_y == 2.0 so scale should be (1.0, 1.0, 1.0)
        assert result.scale == (1.0, 1.0, 1.0)

    def test_rectangular_grid(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_grid(size_x=4.0, size_y=2.0, subdivisions=5)

        mock_bpy.ops.mesh.primitive_grid_add.assert_called_once_with(
            x_subdivisions=5, y_subdivisions=5, size=4.0
        )
        obj = mock_bpy.context.active_object
        # scale = (4/4, 2/4, 1) = (1.0, 0.5, 1.0)
        assert obj.scale == (1.0, 0.5, 1.0)


# ---------------------------------------------------------------------------
# generate_from_params — dispatcher
# ---------------------------------------------------------------------------

class TestGenerateFromParams:
    def test_dispatches_box(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_from_params({"shape": "box", "width": 3.0})

        mock_bpy.ops.mesh.primitive_cube_add.assert_called_once()
        assert result == mock_bpy.context.active_object

    def test_dispatches_cube_alias(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "cube"})

        mock_bpy.ops.mesh.primitive_cube_add.assert_called_once()

    def test_dispatches_sphere(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "sphere", "radius": 2.0})

        mock_bpy.ops.mesh.primitive_uv_sphere_add.assert_called_once()

    def test_dispatches_cylinder(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "cylinder"})

        mock_bpy.ops.mesh.primitive_cylinder_add.assert_called_once()

    def test_dispatches_torus(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "torus"})

        mock_bpy.ops.mesh.primitive_torus_add.assert_called_once()

    def test_dispatches_cone(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "cone"})

        mock_bpy.ops.mesh.primitive_cone_add.assert_called_once()

    def test_dispatches_grid(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "grid"})

        mock_bpy.ops.mesh.primitive_grid_add.assert_called_once()

    def test_dispatches_plane_alias(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "plane"})

        mock_bpy.ops.mesh.primitive_grid_add.assert_called_once()

    def test_unknown_shape_raises_value_error(self, mock_blender_modules: dict) -> None:
        _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        with pytest.raises(ValueError, match="Unknown shape type: 'hexagon'"):
            generator.generate_from_params({"shape": "hexagon"})

    def test_applies_transform_and_name(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        result = generator.generate_from_params({
            "shape": "sphere",
            "name": "MySphere",
            "position": (1.0, 2.0, 3.0),
            "rotation": (0.1, 0.2, 0.3),
            "scale": (2.0, 2.0, 2.0),
        })

        assert result.location == (1.0, 2.0, 3.0)
        assert result.rotation_euler == (0.1, 0.2, 0.3)
        assert result.scale == (2.0, 2.0, 2.0)
        assert result.name == "MySphere"

    def test_case_insensitive_shape(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        generator.generate_from_params({"shape": "BOX"})

        mock_bpy.ops.mesh.primitive_cube_add.assert_called_once()


# ---------------------------------------------------------------------------
# batch_generate
# ---------------------------------------------------------------------------

class TestBatchGenerate:
    def test_generates_multiple_objects(self, mock_blender_modules: dict) -> None:
        mock_bpy = _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        specs = [
            {"shape": "box", "width": 1.0},
            {"shape": "sphere", "radius": 2.0},
            {"shape": "cone"},
        ]
        results = generator.batch_generate(specs)

        assert len(results) == 3
        mock_bpy.ops.mesh.primitive_cube_add.assert_called_once()
        mock_bpy.ops.mesh.primitive_uv_sphere_add.assert_called_once()
        mock_bpy.ops.mesh.primitive_cone_add.assert_called_once()

    def test_empty_batch(self, mock_blender_modules: dict) -> None:
        _setup_bpy(mock_blender_modules)
        generator = ParametricGenerator()

        results = generator.batch_generate([])

        assert results == []
