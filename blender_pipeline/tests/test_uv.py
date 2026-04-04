"""Tests for UVPipeline — UV auto-unwrapping with multiple projection methods."""

from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

import blender_pipeline.quality.uv_pipeline as uv_mod
from blender_pipeline.quality.uv_pipeline import UVPipeline, _is_roughly_spherical


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patch_module(mock_blender_modules: dict) -> None:
    """Inject mock bpy/bmesh into the uv_pipeline module."""
    uv_mod.HAS_BPY = True
    uv_mod.bpy = mock_blender_modules["bpy"]
    uv_mod.bmesh = mock_blender_modules["bmesh"]


def _make_obj(name: str = "TestObj") -> MagicMock:
    """Return a minimal mock mesh object."""
    obj = MagicMock()
    obj.name = name
    return obj


# ---------------------------------------------------------------------------
# _enter_edit_mode / _exit_edit_mode
# ---------------------------------------------------------------------------

class TestEditModeHelpers:
    def test_enter_edit_mode_selects_object_and_switches(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()
        obj = _make_obj()

        pipeline._enter_edit_mode(obj)

        mock_bpy.ops.object.select_all.assert_called_with(action="DESELECT")
        obj.select_set.assert_called_with(True)
        mock_bpy.ops.object.mode_set.assert_called_with(mode="EDIT")
        mock_bpy.ops.mesh.select_all.assert_called_with(action="SELECT")

    def test_exit_edit_mode_switches_to_object(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline._exit_edit_mode()

        mock_bpy.ops.object.mode_set.assert_called_with(mode="OBJECT")


# ---------------------------------------------------------------------------
# Projection methods
# ---------------------------------------------------------------------------

class TestSmartUVProject:
    def test_calls_smart_project_with_defaults(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()
        obj = _make_obj()

        pipeline.smart_uv_project(obj)

        mock_bpy.ops.uv.smart_project.assert_called_once_with(
            angle_limit=66.0,
            island_margin=0.02,
            area_weight=0.0,
        )

    def test_enters_and_exits_edit_mode(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()
        obj = _make_obj()

        pipeline.smart_uv_project(obj)

        # Entered edit mode
        mode_set_calls = mock_bpy.ops.object.mode_set.call_args_list
        assert call(mode="EDIT") in mode_set_calls
        assert call(mode="OBJECT") in mode_set_calls

    def test_custom_parameters(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()
        obj = _make_obj()

        pipeline.smart_uv_project(obj, angle_limit=45.0, island_margin=0.05, area_weight=1.0)

        mock_bpy.ops.uv.smart_project.assert_called_once_with(
            angle_limit=45.0,
            island_margin=0.05,
            area_weight=1.0,
        )

    def test_raises_without_bpy(self) -> None:
        uv_mod.HAS_BPY = False
        pipeline = UVPipeline()
        with pytest.raises(RuntimeError, match="bpy is not available"):
            pipeline.smart_uv_project(_make_obj())


class TestLightmapPack:
    def test_calls_lightmap_pack(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline.lightmap_pack(_make_obj())

        mock_bpy.ops.uv.lightmap_pack.assert_called_once_with(
            PREF_CONTEXT="ALL_FACES",
            PREF_PACK_IN_ONE=True,
            PREF_BOX_DIV=12,
            PREF_MARGIN_DIV=0.1,
        )


class TestCubeProject:
    def test_calls_cube_project(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline.cube_project(_make_obj())

        mock_bpy.ops.uv.cube_project.assert_called_once_with(cube_size=1.0)

    def test_custom_cube_size(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline.cube_project(_make_obj(), cube_size=2.5)

        mock_bpy.ops.uv.cube_project.assert_called_once_with(cube_size=2.5)


class TestCylinderProject:
    def test_calls_cylinder_project(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline.cylinder_project(_make_obj())

        mock_bpy.ops.uv.cylinder_project.assert_called_once()


class TestSphereProject:
    def test_calls_sphere_project(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline.sphere_project(_make_obj())

        mock_bpy.ops.uv.sphere_project.assert_called_once()


# ---------------------------------------------------------------------------
# auto_unwrap
# ---------------------------------------------------------------------------

class TestAutoUnwrap:
    def test_auto_calls_detect_then_method(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        pipeline.detect_best_method = MagicMock(return_value="cube")
        pipeline.cube_project = MagicMock()
        obj = _make_obj()

        pipeline.auto_unwrap(obj, method="auto")

        pipeline.detect_best_method.assert_called_once_with(obj)
        pipeline.cube_project.assert_called_once_with(obj)

    def test_explicit_method_skips_detection(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        pipeline.detect_best_method = MagicMock()
        pipeline.cylinder_project = MagicMock()
        obj = _make_obj()

        pipeline.auto_unwrap(obj, method="cylinder")

        pipeline.detect_best_method.assert_not_called()
        pipeline.cylinder_project.assert_called_once_with(obj)

    def test_unknown_method_falls_back_to_smart(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        pipeline.smart_uv_project = MagicMock()
        obj = _make_obj()

        pipeline.auto_unwrap(obj, method="nonexistent")

        pipeline.smart_uv_project.assert_called_once_with(obj)


# ---------------------------------------------------------------------------
# detect_best_method
# ---------------------------------------------------------------------------

class TestDetectBestMethod:
    def _make_obj_with_dimensions(self, dx: float, dy: float, dz: float) -> MagicMock:
        obj = _make_obj()
        dims = MagicMock()
        dims.x = dx
        dims.y = dy
        dims.z = dz
        obj.dimensions = dims
        return obj

    def test_elongated_returns_cylinder(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        # One dimension much smaller -> aspect_ratios[0] < 0.2
        obj = self._make_obj_with_dimensions(0.1, 5.0, 5.0)
        assert pipeline.detect_best_method(obj) == "cylinder"

    def test_equal_dimensions_non_spherical_returns_cube(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        obj = self._make_obj_with_dimensions(1.0, 1.0, 1.0)
        # Need to make _is_roughly_spherical return False
        obj.data.vertices = []  # < 8 vertices -> not spherical
        with patch("blender_pipeline.quality.uv_pipeline._is_roughly_spherical", return_value=False):
            result = pipeline.detect_best_method(obj)
        assert result == "cube"

    def test_equal_dimensions_spherical_returns_sphere(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        obj = self._make_obj_with_dimensions(1.0, 1.0, 1.0)
        with patch("blender_pipeline.quality.uv_pipeline._is_roughly_spherical", return_value=True):
            result = pipeline.detect_best_method(obj)
        assert result == "sphere"

    def test_zero_dimension_returns_smart(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        obj = self._make_obj_with_dimensions(0.0, 1.0, 1.0)
        assert pipeline.detect_best_method(obj) == "smart"


# ---------------------------------------------------------------------------
# batch_unwrap
# ---------------------------------------------------------------------------

class TestBatchUnwrap:
    def test_calls_auto_unwrap_for_each_object(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        pipeline.auto_unwrap = MagicMock()
        objects = [_make_obj("A"), _make_obj("B"), _make_obj("C")]

        pipeline.batch_unwrap(objects, method="smart")

        assert pipeline.auto_unwrap.call_count == 3
        for obj in objects:
            pipeline.auto_unwrap.assert_any_call(obj, "smart")

    def test_empty_list_does_nothing(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        pipeline = UVPipeline()
        pipeline.auto_unwrap = MagicMock()

        pipeline.batch_unwrap([])

        pipeline.auto_unwrap.assert_not_called()


# ---------------------------------------------------------------------------
# pack_islands
# ---------------------------------------------------------------------------

class TestPackIslands:
    def test_calls_pack_islands(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        pipeline = UVPipeline()

        pipeline.pack_islands(_make_obj(), margin=0.03)

        mock_bpy.ops.uv.pack_islands.assert_called_once_with(margin=0.03)


# ---------------------------------------------------------------------------
# generate_uv_grid_texture
# ---------------------------------------------------------------------------

class TestGenerateUVGridTexture:
    def test_image_created(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()
        obj.data.materials = []  # no existing materials
        mock_mat = MagicMock()
        mock_mat.use_nodes = False
        mock_bpy.data.materials.new.return_value = mock_mat
        mock_image = MagicMock()
        mock_bpy.data.images.new.return_value = mock_image

        pipeline = UVPipeline()
        result = pipeline.generate_uv_grid_texture(obj, resolution=512)

        mock_bpy.data.images.new.assert_called_once_with(
            name="UV_Checker",
            width=512,
            height=512,
            generated_type="UV_GRID",
        )
        assert result is mock_image

    def test_material_created_when_none_exists(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()
        obj.data.materials = []  # empty list -> falsy
        mock_mat = MagicMock()
        mock_bpy.data.materials.new.return_value = mock_mat
        mock_bpy.data.images.new.return_value = MagicMock()

        pipeline = UVPipeline()
        pipeline.generate_uv_grid_texture(obj)

        mock_bpy.data.materials.new.assert_called_once_with(name="UV_Check_Material")

    def test_existing_material_reused(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        existing_mat = MagicMock()
        obj = _make_obj()
        # Use a MagicMock for materials so truthiness works
        mat_list = MagicMock()
        mat_list.__bool__ = MagicMock(return_value=True)
        mat_list.__getitem__ = MagicMock(return_value=existing_mat)
        obj.data.materials = mat_list
        mock_bpy.data.images.new.return_value = MagicMock()

        pipeline = UVPipeline()
        pipeline.generate_uv_grid_texture(obj)

        mock_bpy.data.materials.new.assert_not_called()


# ---------------------------------------------------------------------------
# _is_roughly_spherical (module-level helper)
# ---------------------------------------------------------------------------

class TestIsRoughlySpherical:
    @staticmethod
    def _make_sphere_verts(count: int = 20, radius: float = 1.0) -> list:
        """Create mock vertices evenly distributed on a sphere surface."""
        import math

        verts = []
        for i in range(count):
            theta = math.acos(1 - 2 * (i + 0.5) / count)
            phi = math.pi * (1 + 5 ** 0.5) * i
            x = radius * math.sin(theta) * math.cos(phi)
            y = radius * math.sin(theta) * math.sin(phi)
            z = radius * math.cos(theta)
            vert = MagicMock()
            vert.co = [x, y, z]
            verts.append(vert)
        return verts

    def test_spherical_vertices_detected(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_obj()
        obj.data.vertices = self._make_sphere_verts(count=50, radius=1.0)

        assert _is_roughly_spherical(obj) is True

    def test_too_few_vertices_returns_false(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_obj()
        obj.data.vertices = [MagicMock() for _ in range(4)]
        for v in obj.data.vertices:
            v.co = [0.0, 0.0, 0.0]

        assert _is_roughly_spherical(obj) is False

    def test_non_spherical_vertices_returns_false(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_obj()
        verts = []
        for i in range(20):
            vert = MagicMock()
            vert.co = [float(i), 0.0, 0.0]
            verts.append(vert)
        obj.data.vertices = verts

        assert _is_roughly_spherical(obj) is False
