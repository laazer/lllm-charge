"""Tests for LODGenerator — Level of Detail generation via mesh decimation."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import blender_pipeline.quality.lod_generator as lod_mod
from blender_pipeline.quality.lod_generator import (
    DEFAULT_LOD_LEVELS,
    LODGenerator,
    LODLevel,
    PLATFORM_LOD_TARGETS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patch_module(mock_blender_modules: dict) -> None:
    """Inject mock bpy into the lod_generator module so _require_bpy passes."""
    lod_mod.HAS_BPY = True
    lod_mod.bpy = mock_blender_modules["bpy"]


def _make_mesh_object(vertex_count: int = 100, face_count: int = 50) -> MagicMock:
    """Return a mock Blender mesh object with configurable vertex/face counts."""
    obj = MagicMock()
    obj.name = "TestMesh"
    obj.data.vertices = [MagicMock()] * vertex_count
    obj.data.polygons = [MagicMock()] * face_count
    return obj


# ---------------------------------------------------------------------------
# LODLevel dataclass
# ---------------------------------------------------------------------------

class TestLODLevel:
    def test_default_name_generated_from_level(self) -> None:
        level = LODLevel(level=2, ratio=0.25)
        assert level.name == "LOD2"

    def test_custom_name_preserved(self) -> None:
        level = LODLevel(level=0, ratio=1.0, name="HighDetail")
        assert level.name == "HighDetail"

    def test_fields_stored(self) -> None:
        level = LODLevel(level=3, ratio=0.1, name="Low")
        assert level.level == 3
        assert level.ratio == 0.1
        assert level.name == "Low"


# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

class TestConstants:
    def test_default_lod_levels_has_four_entries(self) -> None:
        assert len(DEFAULT_LOD_LEVELS) == 4

    def test_default_lod_levels_ratios(self) -> None:
        ratios = [level.ratio for level in DEFAULT_LOD_LEVELS]
        assert ratios == [1.0, 0.5, 0.25, 0.1]

    def test_default_lod_levels_names(self) -> None:
        names = [level.name for level in DEFAULT_LOD_LEVELS]
        assert names == ["LOD0_Full", "LOD1_Half", "LOD2_Quarter", "LOD3_Low"]

    def test_platform_lod_targets_contains_all_platforms(self) -> None:
        for platform in ("mobile", "desktop", "web", "vr"):
            assert platform in PLATFORM_LOD_TARGETS

    def test_platform_mobile_has_four_levels(self) -> None:
        assert len(PLATFORM_LOD_TARGETS["mobile"]) == 4

    def test_platform_web_has_three_levels(self) -> None:
        assert len(PLATFORM_LOD_TARGETS["web"]) == 3


# ---------------------------------------------------------------------------
# LODGenerator
# ---------------------------------------------------------------------------

class TestGetVertexCount:
    def test_returns_vertex_count(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_mesh_object(vertex_count=200)
        generator = LODGenerator()
        assert generator.get_vertex_count(obj) == 200

    def test_raises_without_bpy(self) -> None:
        lod_mod.HAS_BPY = False
        generator = LODGenerator()
        with pytest.raises(RuntimeError, match="bpy is not available"):
            generator.get_vertex_count(MagicMock())


class TestGetFaceCount:
    def test_returns_face_count(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_mesh_object(face_count=75)
        generator = LODGenerator()
        assert generator.get_face_count(obj) == 75


class TestEstimateMemory:
    def test_formula_32_per_vertex_plus_12_per_face(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_mesh_object(vertex_count=100, face_count=50)
        generator = LODGenerator()
        expected = 100 * 32 + 50 * 12  # 3200 + 600 = 3800
        assert generator.estimate_memory(obj) == expected

    def test_zero_geometry(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_mesh_object(vertex_count=0, face_count=0)
        generator = LODGenerator()
        assert generator.estimate_memory(obj) == 0


class TestGenerateLod:
    def test_first_level_at_ratio_1_returns_original(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_mesh_object()
        generator = LODGenerator()

        levels = [LODLevel(0, 1.0, "Full")]
        result = generator.generate_lod(obj, levels)

        assert len(result) == 1
        assert result[0] is obj

    def test_decimation_modifier_added(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_mesh_object()
        copy = MagicMock()
        copy.name = "TestMesh_LOD1"
        copy.data.vertices = [MagicMock()] * 50
        obj.copy.return_value = copy
        obj.data.copy.return_value = MagicMock()

        modifier = MagicMock()
        copy.modifiers.new.return_value = modifier

        generator = LODGenerator()
        levels = [LODLevel(1, 0.5, "Half")]
        result = generator.generate_lod(obj, levels)

        copy.modifiers.new.assert_called_once_with(name="Decimate", type="DECIMATE")
        assert modifier.ratio == 0.5
        assert len(result) == 1
        assert result[0] is copy

    def test_copy_linked_to_collection(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_mesh_object()
        copy = MagicMock()
        copy.data.vertices = [MagicMock()] * 25
        copy.modifiers.new.return_value = MagicMock()
        obj.copy.return_value = copy
        obj.data.copy.return_value = MagicMock()

        generator = LODGenerator()
        levels = [LODLevel(2, 0.25, "Quarter")]
        generator.generate_lod(obj, levels)

        mock_bpy.context.collection.objects.link.assert_called_with(copy)

    def test_modifier_apply_called(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_mesh_object()
        copy = MagicMock()
        copy.data.vertices = [MagicMock()] * 10
        copy.modifiers.new.return_value = MagicMock()
        obj.copy.return_value = copy
        obj.data.copy.return_value = MagicMock()

        generator = LODGenerator()
        levels = [LODLevel(3, 0.1, "Low")]
        generator.generate_lod(obj, levels)

        mock_bpy.ops.object.modifier_apply.assert_called_with(modifier="Decimate")

    def test_defaults_to_default_lod_levels(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_mesh_object()
        copy = MagicMock()
        copy.data.vertices = [MagicMock()] * 10
        copy.modifiers.new.return_value = MagicMock()
        obj.copy.return_value = copy
        obj.data.copy.return_value = MagicMock()

        generator = LODGenerator()
        result = generator.generate_lod(obj)

        # First level (ratio=1.0) returns original, 3 copies created
        assert len(result) == 4
        assert result[0] is obj


class TestGenerateDefaultLods:
    def test_delegates_to_generate_lod(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        generator = LODGenerator()
        generator.generate_lod = MagicMock(return_value=["a", "b", "c", "d"])

        result = generator.generate_default_lods(MagicMock())

        generator.generate_lod.assert_called_once()
        call_args = generator.generate_lod.call_args
        assert call_args[0][1] is DEFAULT_LOD_LEVELS


class TestSetupLodGroup:
    def test_empty_created_and_linked(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        original = MagicMock()
        original.name = "Original"
        lod_group = MagicMock()
        mock_bpy.data.objects.new.return_value = lod_group

        generator = LODGenerator()
        result = generator.setup_lod_group(original, [MagicMock(), MagicMock()])

        mock_bpy.data.objects.new.assert_called_once_with("Original_LODGroup", None)
        mock_bpy.context.collection.objects.link.assert_called_with(lod_group)
        assert result is lod_group

    def test_children_parented_and_distance_set(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        original = MagicMock()
        original.name = "Obj"
        lod_group = MagicMock()
        mock_bpy.data.objects.new.return_value = lod_group

        child_a = MagicMock()
        child_b = MagicMock()
        distances = [0, 15]

        generator = LODGenerator()
        generator.setup_lod_group(original, [child_a, child_b], distances)

        assert child_a.parent is lod_group
        assert child_b.parent is lod_group
        child_a.__setitem__.assert_called_with("lod_distance", 0)
        child_b.__setitem__.assert_called_with("lod_distance", 15)

    def test_default_distances_used(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.data.objects.new.return_value = MagicMock()
        original = MagicMock()
        original.name = "Obj"

        children = [MagicMock() for _ in range(4)]
        generator = LODGenerator()
        generator.setup_lod_group(original, children)

        expected_distances = [0, 10, 25, 50]
        for child, expected in zip(children, expected_distances):
            child.__setitem__.assert_called_with("lod_distance", expected)


class TestAutoLodLevels:
    def test_known_platform_returns_platform_levels(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        generator = LODGenerator()
        result = generator.auto_lod_levels(MagicMock(), "mobile")
        assert result is PLATFORM_LOD_TARGETS["mobile"]

    def test_unknown_platform_returns_default(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        generator = LODGenerator()
        result = generator.auto_lod_levels(MagicMock(), "nintendo_ds")
        assert result is DEFAULT_LOD_LEVELS

    def test_desktop_platform(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        generator = LODGenerator()
        result = generator.auto_lod_levels(MagicMock(), "desktop")
        assert result is PLATFORM_LOD_TARGETS["desktop"]

    def test_vr_platform(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        generator = LODGenerator()
        result = generator.auto_lod_levels(MagicMock(), "vr")
        assert result is PLATFORM_LOD_TARGETS["vr"]
