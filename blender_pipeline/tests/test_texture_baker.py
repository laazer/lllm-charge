"""Tests for export/texture_baker.py — TextureBaker baking and channel packing."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

import blender_pipeline.export.texture_baker as tb_mod


@pytest.fixture(autouse=True)
def _patch_texture_baker_bpy(mock_blender_modules: dict) -> None:
    """Ensure the module-level bpy ref is the mock so TextureBaker methods work."""
    tb_mod.HAS_BPY = True
    tb_mod.bpy = mock_blender_modules["bpy"]


class TestBakeTypeEnum:
    """Verify BakeType enum members."""

    def test_all_bake_types_present(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.texture_baker import BakeType

        expected_members = {
            "NORMAL", "AO", "CURVATURE", "DIFFUSE",
            "ROUGHNESS", "METALLIC", "EMISSION", "COMBINED", "SHADOW",
        }
        actual_members = {member.name for member in BakeType}
        assert actual_members == expected_members

    def test_emission_value_is_emit(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.texture_baker import BakeType

        assert BakeType.EMISSION.value == "EMIT"


class TestBakeSettingsDefaults:
    """Verify BakeSettings dataclass defaults."""

    def test_default_values(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.texture_baker import BakeSettings

        settings = BakeSettings()
        assert settings.resolution == 2048
        assert settings.samples == 64
        assert settings.margin == 16
        assert settings.cage_extrusion == pytest.approx(0.1)

    def test_custom_values(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.export.texture_baker import BakeSettings

        settings = BakeSettings(resolution=1024, samples=32, margin=8, cage_extrusion=0.2)
        assert settings.resolution == 1024
        assert settings.samples == 32


class TestSetupBakeMaterial:
    """TextureBaker._setup_bake_material creates/configures material nodes."""

    def test_creates_material_when_none_exist(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker

        baker = TextureBaker()
        mock_obj = MagicMock()
        mock_obj.name = "TestObj"
        mock_obj.data.materials.__len__ = MagicMock(return_value=0)
        mock_obj.data.materials.__bool__ = MagicMock(return_value=False)

        mock_material = MagicMock()
        mock_material.use_nodes = True
        mock_bpy.data.materials.new.return_value = mock_material

        mock_image = MagicMock()

        baker._setup_bake_material(mock_obj, mock_image)

        mock_bpy.data.materials.new.assert_called_once_with(name="TestObj_bake_mat")
        mock_obj.data.materials.append.assert_called_once_with(mock_material)

    def test_adds_image_texture_node_and_selects_it(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker

        baker = TextureBaker()
        mock_obj = MagicMock()
        mock_obj.name = "Obj"

        mock_material = MagicMock()
        mock_material.use_nodes = True
        mock_obj.data.materials.__bool__ = MagicMock(return_value=True)
        mock_obj.data.materials.__getitem__ = MagicMock(return_value=mock_material)

        mock_tex_node = MagicMock()
        mock_material.node_tree.nodes.new.return_value = mock_tex_node

        mock_image = MagicMock()
        baker._setup_bake_material(mock_obj, mock_image)

        mock_material.node_tree.nodes.new.assert_called_once_with("ShaderNodeTexImage")
        assert mock_tex_node.image == mock_image
        assert mock_tex_node.select is True
        assert mock_material.node_tree.nodes.active == mock_tex_node


class TestBakeTexture:
    """TextureBaker.bake_texture creates image, sets engine, bakes, and saves."""

    def test_bake_texture_full_workflow(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker, BakeType, BakeSettings

        baker = TextureBaker()
        mock_high = MagicMock()
        mock_low = MagicMock()
        mock_low.name = "LowPoly"
        mock_low.data.materials.__bool__ = MagicMock(return_value=True)
        mock_low.data.materials.__getitem__ = MagicMock(return_value=MagicMock(use_nodes=True))

        mock_image = MagicMock()
        mock_bpy.data.images.new.return_value = mock_image

        settings = BakeSettings(resolution=512, samples=16)
        output_path = str(tmp_dir / "normal.png")

        result = baker.bake_texture(mock_high, mock_low, BakeType.NORMAL, settings, output_path)

        mock_bpy.data.images.new.assert_called_once_with(
            name="bake_NORMAL", width=512, height=512
        )
        assert mock_bpy.context.scene.render.engine == "CYCLES"
        assert mock_bpy.context.scene.cycles.samples == 16
        assert mock_bpy.context.scene.render.bake.use_selected_to_active is True

        mock_bpy.ops.object.bake.assert_called_once_with(type="NORMAL")
        mock_image.save.assert_called_once()
        assert result == output_path

    def test_bake_curvature_uses_normal_type(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker, BakeType, BakeSettings

        baker = TextureBaker()
        mock_obj = MagicMock()
        mock_obj.name = "Obj"
        mock_obj.data.materials.__bool__ = MagicMock(return_value=True)
        mock_obj.data.materials.__getitem__ = MagicMock(return_value=MagicMock(use_nodes=True))
        mock_bpy.data.images.new.return_value = MagicMock()

        settings = BakeSettings()
        baker.bake_texture(mock_obj, mock_obj, BakeType.CURVATURE, settings, str(tmp_dir / "c.png"))

        mock_bpy.ops.object.bake.assert_called_once_with(type="NORMAL")


class TestBakeAllMaps:
    """TextureBaker.bake_all_maps bakes NORMAL, AO, DIFFUSE, ROUGHNESS."""

    def test_bake_all_maps_calls_four_types(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.texture_baker import TextureBaker, BakeType, BakeSettings

        baker = TextureBaker()
        mock_high = MagicMock()
        mock_low = MagicMock()
        mock_low.name = "Mesh"

        settings = BakeSettings()

        with patch.object(baker, "bake_texture", return_value="/fake/path.png") as mock_bake:
            results = baker.bake_all_maps(mock_high, mock_low, settings, str(tmp_dir))

        assert mock_bake.call_count == 4
        baked_types = [c.args[2] for c in mock_bake.call_args_list]
        assert baked_types == [BakeType.NORMAL, BakeType.AO, BakeType.DIFFUSE, BakeType.ROUGHNESS]
        assert len(results) == 4
        assert "NORMAL" in results
        assert "AO" in results


class TestBakeAO:
    """TextureBaker.bake_ao bakes AO for a single object."""

    def test_bake_ao_sets_selected_to_active_false(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker, BakeSettings

        baker = TextureBaker()
        mock_obj = MagicMock()
        mock_obj.name = "Obj"
        mock_obj.data.materials.__bool__ = MagicMock(return_value=True)
        mock_obj.data.materials.__getitem__ = MagicMock(return_value=MagicMock(use_nodes=True))
        mock_bpy.data.images.new.return_value = MagicMock()

        settings = BakeSettings()
        output_path = str(tmp_dir / "ao.png")
        result = baker.bake_ao(mock_obj, settings, output_path)

        assert mock_bpy.context.scene.render.bake.use_selected_to_active is False
        mock_bpy.ops.object.bake.assert_called_once_with(type="AO")
        assert result == output_path


class TestBakeNormalMap:
    """TextureBaker.bake_normal_map delegates to bake_texture with NORMAL."""

    def test_delegates_to_bake_texture(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        from blender_pipeline.export.texture_baker import TextureBaker, BakeType, BakeSettings

        baker = TextureBaker()
        mock_high = MagicMock()
        mock_low = MagicMock()
        settings = BakeSettings()

        with patch.object(baker, "bake_texture", return_value="/path/normal.png") as mock_bake:
            result = baker.bake_normal_map(mock_high, mock_low, settings, "/path/normal.png")

        mock_bake.assert_called_once_with(
            mock_high, mock_low, BakeType.NORMAL, settings, "/path/normal.png"
        )
        assert result == "/path/normal.png"


class TestBakeCurvature:
    """TextureBaker.bake_curvature delegates to bake_texture with CURVATURE."""

    def test_delegates_to_bake_texture(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        from blender_pipeline.export.texture_baker import TextureBaker, BakeType, BakeSettings

        baker = TextureBaker()
        mock_obj = MagicMock()
        settings = BakeSettings()

        with patch.object(baker, "bake_texture", return_value="/path/curv.png") as mock_bake:
            result = baker.bake_curvature(mock_obj, settings, "/path/curv.png")

        mock_bake.assert_called_once_with(
            mock_obj, mock_obj, BakeType.CURVATURE, settings, "/path/curv.png"
        )
        assert result == "/path/curv.png"


class TestCreateCage:
    """TextureBaker.create_cage copies object and adds Displace modifier."""

    def test_create_cage_copies_and_displaces(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker

        baker = TextureBaker()
        mock_low = MagicMock()
        mock_low.name = "LowPoly"

        mock_cage = MagicMock()
        mock_low.copy.return_value = mock_cage
        mock_cage_data = MagicMock()
        mock_low.data.copy.return_value = mock_cage_data

        mock_modifier = MagicMock()
        mock_cage.modifiers.new.return_value = mock_modifier

        cage = baker.create_cage(mock_low, extrusion=0.15)

        mock_low.copy.assert_called_once()
        mock_low.data.copy.assert_called_once()
        assert mock_cage.name == "LowPoly_cage"
        mock_bpy.context.collection.objects.link.assert_called_once_with(mock_cage)

        mock_cage.modifiers.new.assert_called_once_with(name="Displace", type="DISPLACE")
        assert mock_modifier.strength == 0.15

        mock_bpy.ops.object.modifier_apply.assert_called_once_with(modifier="Displace")
        assert cage == mock_cage


class TestSetupBakeMaterials:
    """TextureBaker.setup_bake_materials creates image and calls _setup_bake_material."""

    def test_creates_image_and_sets_up_material(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        from blender_pipeline.export.texture_baker import TextureBaker, BakeType

        baker = TextureBaker()
        mock_high = MagicMock()
        mock_low = MagicMock()
        mock_low.data.materials.__bool__ = MagicMock(return_value=True)
        mock_low.data.materials.__getitem__ = MagicMock(return_value=MagicMock(use_nodes=True))

        mock_image = MagicMock()
        mock_bpy.data.images.new.return_value = mock_image

        with patch.object(baker, "_setup_bake_material") as mock_setup:
            baker.setup_bake_materials(mock_high, mock_low, BakeType.NORMAL)

        mock_bpy.data.images.new.assert_called_once_with(
            name="bake_NORMAL", width=2048, height=2048
        )
        mock_setup.assert_called_once_with(mock_low, mock_image)


class TestCombineMaps:
    """TextureBaker.combine_maps merges channel images into packed RGB."""

    def test_combine_maps_with_mock_pillow(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.texture_baker import TextureBaker

        baker = TextureBaker()

        mock_ao_image = MagicMock()
        mock_ao_image.size = (256, 256)
        mock_roughness_image = MagicMock()
        mock_roughness_image.size = (256, 256)
        mock_metallic_image = MagicMock()
        mock_metallic_image.size = (256, 256)

        mock_combined = MagicMock()

        mock_image_module = MagicMock()

        def mock_open(path: str) -> MagicMock:
            img = MagicMock()
            img.convert.return_value = img
            img.size = (256, 256)
            img.resize.return_value = img
            return img

        mock_image_module.open.side_effect = mock_open
        mock_image_module.new.return_value = MagicMock()
        mock_image_module.merge.return_value = mock_combined

        output_path = str(tmp_dir / "orm.png")
        maps = {
            "AO": str(tmp_dir / "ao.png"),
            "ROUGHNESS": str(tmp_dir / "rough.png"),
            "METALLIC": str(tmp_dir / "metal.png"),
        }

        mock_pil = MagicMock()
        mock_pil.Image = mock_image_module
        with patch.dict(sys.modules, {"PIL": mock_pil, "PIL.Image": mock_image_module}):
            result = baker.combine_maps(maps, output_path)

        mock_image_module.merge.assert_called_once()
        merge_args = mock_image_module.merge.call_args
        assert merge_args.args[0] == "RGB"
        mock_combined.save.assert_called_once_with(output_path)
        assert result == output_path

    def test_combine_maps_returns_empty_when_pillow_missing(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.export.texture_baker import TextureBaker

        baker = TextureBaker()
        maps = {"AO": "/fake/ao.png"}

        with patch.dict(sys.modules, {"PIL": None, "PIL.Image": None}):
            with patch("builtins.__import__", side_effect=ImportError("No module named 'PIL'")):
                # Re-import to clear any cached PIL
                result = baker.combine_maps(maps, str(tmp_dir / "orm.png"))

        assert result == ""
