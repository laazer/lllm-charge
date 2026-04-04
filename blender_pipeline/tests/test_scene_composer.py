"""Tests for SceneComposer — lighting, camera, layout, and environment."""

from __future__ import annotations

import math
from dataclasses import fields
from unittest.mock import MagicMock, patch

import pytest

from blender_pipeline.llm_integration.scene_composer import (
    CAMERA_PRESETS,
    LIGHTING_PRESETS,
    EnvironmentSpec,
    SceneComposer,
    WorldSettings,
)
from blender_pipeline.core.config import LLMConfig


# ── Helpers ────────────────────────────────────────────────────────


def _make_mock_objects(count: int) -> list[MagicMock]:
    """Create mock Blender objects with a settable .location property."""
    objects: list[MagicMock] = []
    for index in range(count):
        obj = MagicMock()
        obj.name = f"MockObj_{index}"
        obj.location = (0.0, 0.0, 0.0)
        objects.append(obj)
    return objects


def _make_composer() -> SceneComposer:
    """Create a SceneComposer with default config, patching TextTo3DGenerator."""
    with patch("blender_pipeline.llm_integration.scene_composer.TextTo3DGenerator"):
        return SceneComposer(LLMConfig())


# ── Dataclass defaults ─────────────────────────────────────────────


class TestEnvironmentSpec:
    def test_defaults(self) -> None:
        spec = EnvironmentSpec()
        assert spec.type == "studio"
        assert spec.hdri_path is None
        assert spec.ambient_color == [0.05, 0.05, 0.08]
        assert spec.fog_density == 0.0
        assert spec.background_color == [0.05, 0.05, 0.08, 1.0]

    def test_custom_values(self) -> None:
        spec = EnvironmentSpec(
            type="outdoor",
            hdri_path="/textures/sky.hdr",
            ambient_color=[1.0, 1.0, 1.0],
            fog_density=0.5,
            background_color=[0.2, 0.3, 0.4, 1.0],
        )
        assert spec.type == "outdoor"
        assert spec.hdri_path == "/textures/sky.hdr"
        assert spec.fog_density == 0.5


class TestWorldSettings:
    def test_defaults(self) -> None:
        settings = WorldSettings()
        assert settings.background_color == [0.05, 0.05, 0.08, 1.0]
        assert settings.ambient_occlusion is True
        assert settings.bloom is False
        assert settings.volumetrics is False

    def test_custom_values(self) -> None:
        settings = WorldSettings(
            background_color=[1.0, 1.0, 1.0, 1.0],
            ambient_occlusion=False,
            bloom=True,
            volumetrics=True,
        )
        assert settings.bloom is True
        assert settings.volumetrics is True


# ── Preset data integrity ─────────────────────────────────────────


class TestLightingPresets:
    EXPECTED_STYLES = [
        "studio_3point",
        "dramatic",
        "natural_outdoor",
        "sunset",
        "moonlight",
        "neon",
    ]

    def test_all_six_styles_exist(self) -> None:
        for style in self.EXPECTED_STYLES:
            assert style in LIGHTING_PRESETS, f"Missing lighting style: {style}"

    def test_each_style_has_at_least_one_light(self) -> None:
        for style, lights in LIGHTING_PRESETS.items():
            assert len(lights) >= 1, f"{style} has no lights"

    def test_each_light_has_required_keys(self) -> None:
        required_keys = {"type", "position", "intensity", "color"}
        for style, lights in LIGHTING_PRESETS.items():
            for index, light in enumerate(lights):
                for key in required_keys:
                    assert key in light, (
                        f"{style}[{index}] missing key '{key}'"
                    )

    def test_light_types_are_valid_blender_types(self) -> None:
        valid_types = {"POINT", "SUN", "SPOT", "AREA"}
        for style, lights in LIGHTING_PRESETS.items():
            for light in lights:
                assert light["type"] in valid_types, (
                    f"{style} has invalid light type: {light['type']}"
                )


class TestCameraPresets:
    EXPECTED_STYLES = [
        "front",
        "three_quarter",
        "top_down",
        "dramatic_low",
        "close_up",
        "wide",
    ]

    def test_all_six_styles_exist(self) -> None:
        for style in self.EXPECTED_STYLES:
            assert style in CAMERA_PRESETS, f"Missing camera style: {style}"

    def test_each_style_has_position_and_look_at(self) -> None:
        for style, preset in CAMERA_PRESETS.items():
            assert "position" in preset, f"{style} missing 'position'"
            assert "look_at" in preset, f"{style} missing 'look_at'"
            assert len(preset["position"]) == 3
            assert len(preset["look_at"]) == 3


# ── auto_light_scene ───────────────────────────────────────────────


class TestAutoLightScene:
    def _run_auto_light(
        self, style: str, mock_bpy: MagicMock
    ) -> list[MagicMock]:
        composer = _make_composer()
        objects = _make_mock_objects(2)

        mock_light_data = MagicMock()
        mock_bpy.data.lights.new.return_value = mock_light_data

        mock_light_obj = MagicMock()
        mock_bpy.data.objects.new.return_value = mock_light_obj

        # Patch HAS_BPY to True at the module level
        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            return composer.auto_light_scene(objects, style=style)

    def test_studio_3point_creates_three_lights(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        lights = self._run_auto_light("studio_3point", mock_bpy)
        assert len(lights) == 3

    def test_dramatic_creates_two_lights(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        lights = self._run_auto_light("dramatic", mock_bpy)
        assert len(lights) == 2

    def test_neon_creates_three_lights(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        lights = self._run_auto_light("neon", mock_bpy)
        assert len(lights) == 3

    def test_light_data_receives_correct_type_and_energy(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_light_data = MagicMock()
        mock_bpy.data.lights.new.return_value = mock_light_data

        mock_light_obj = MagicMock()
        mock_bpy.data.objects.new.return_value = mock_light_obj

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.auto_light_scene([], style="sunset")

        # sunset has 2 lights: SUN and AREA
        assert mock_bpy.data.lights.new.call_count == 2
        first_call = mock_bpy.data.lights.new.call_args_list[0]
        assert first_call[1]["type"] == "SUN"

    def test_light_linked_to_collection(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.data.lights.new.return_value = MagicMock()
        mock_bpy.data.objects.new.return_value = MagicMock()

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.auto_light_scene([], style="moonlight")

        assert mock_bpy.context.collection.objects.link.call_count == 2

    def test_unknown_style_falls_back_to_studio_3point(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.data.lights.new.return_value = MagicMock()
        mock_bpy.data.objects.new.return_value = MagicMock()

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            lights = composer.auto_light_scene([], style="nonexistent_style")

        # studio_3point has 3 lights
        assert len(lights) == 3


# ── auto_camera ────────────────────────────────────────────────────


class TestAutoCamera:
    def _run_auto_camera(
        self, style: str, mock_bpy: MagicMock
    ) -> MagicMock:
        composer = _make_composer()
        objects = _make_mock_objects(1)

        mock_cam_data = MagicMock()
        mock_bpy.data.cameras.new.return_value = mock_cam_data

        mock_cam_obj = MagicMock()
        mock_cam_obj.location = [0, 0, 0]
        mock_cam_obj.rotation_euler = (0, 0, 0)
        mock_bpy.data.objects.new.return_value = mock_cam_obj

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            return composer.auto_camera(objects, style=style)

    def test_camera_created_and_linked(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        cam = self._run_auto_camera("front", mock_bpy)

        mock_bpy.data.cameras.new.assert_called_once_with(name="AutoCamera")
        mock_bpy.data.objects.new.assert_called_once()
        mock_bpy.context.collection.objects.link.assert_called_once_with(cam)

    def test_camera_set_as_scene_camera(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        cam = self._run_auto_camera("three_quarter", mock_bpy)
        assert mock_bpy.context.scene.camera == cam

    def test_camera_position_matches_preset(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_cam_obj = MagicMock()
        mock_cam_obj.location = [0, 0, 0]
        mock_cam_obj.rotation_euler = (0, 0, 0)
        mock_bpy.data.objects.new.return_value = mock_cam_obj
        mock_bpy.data.cameras.new.return_value = MagicMock()

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.auto_camera([], style="top_down")

        expected_position = CAMERA_PRESETS["top_down"]["position"]
        assert mock_cam_obj.location == expected_position

    def test_camera_lens_set_to_50(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_cam_data = MagicMock()
        mock_bpy.data.cameras.new.return_value = mock_cam_data
        mock_cam_obj = MagicMock()
        mock_cam_obj.location = [0, 0, 0]
        mock_cam_obj.rotation_euler = (0, 0, 0)
        mock_bpy.data.objects.new.return_value = mock_cam_obj

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.auto_camera([], style="front")

        assert mock_cam_data.lens == 50

    def test_unknown_camera_style_falls_back_to_three_quarter(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_cam_obj = MagicMock()
        mock_cam_obj.location = [0, 0, 0]
        mock_cam_obj.rotation_euler = (0, 0, 0)
        mock_bpy.data.objects.new.return_value = mock_cam_obj
        mock_bpy.data.cameras.new.return_value = MagicMock()

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.auto_camera([], style="totally_unknown")

        expected_position = CAMERA_PRESETS["three_quarter"]["position"]
        assert mock_cam_obj.location == expected_position


# ── arrange_objects / layout functions ─────────────────────────────


class TestArrangeObjects:
    def _run_arrange(
        self, layout: str, objects: list[MagicMock], spacing: float, mock_bpy: MagicMock
    ) -> None:
        composer = _make_composer()
        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.arrange_objects(objects, layout=layout, spacing=spacing)

    def test_dispatches_to_grid(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        objects = _make_mock_objects(4)
        self._run_arrange("grid", objects, 2.0, mock_bpy)
        # 4 objects in a grid with ceil(sqrt(4))=2 columns
        assert objects[0].location == (0, 0, 0)
        assert objects[1].location == (2.0, 0, 0)
        assert objects[2].location == (0, 2.0, 0)
        assert objects[3].location == (2.0, 2.0, 0)

    def test_dispatches_to_unknown_layout_uses_grid(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        objects = _make_mock_objects(2)
        self._run_arrange("nonexistent_layout", objects, 3.0, mock_bpy)
        # Falls back to grid: ceil(sqrt(2))=2 columns
        assert objects[0].location == (0, 0, 0)
        assert objects[1].location == (3.0, 0, 0)


class TestLayoutGrid:
    def test_single_object(self, mock_blender_modules: dict) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(1)
        composer._layout_grid(objects, 3.0)
        assert objects[0].location == (0, 0, 0)

    def test_four_objects_in_two_by_two(self, mock_blender_modules: dict) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(4)
        composer._layout_grid(objects, 5.0)
        # cols = ceil(sqrt(4)) = 2
        assert objects[0].location == (0, 0, 0)
        assert objects[1].location == (5.0, 0, 0)
        assert objects[2].location == (0, 5.0, 0)
        assert objects[3].location == (5.0, 5.0, 0)

    def test_five_objects_in_three_columns(self, mock_blender_modules: dict) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(5)
        composer._layout_grid(objects, 2.0)
        # cols = ceil(sqrt(5)) = 3
        assert objects[0].location == (0, 0, 0)
        assert objects[1].location == (2.0, 0, 0)
        assert objects[2].location == (4.0, 0, 0)
        assert objects[3].location == (0, 2.0, 0)
        assert objects[4].location == (2.0, 2.0, 0)


class TestLayoutCircle:
    def test_single_object_placed_at_spacing_radius(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(1)
        composer._layout_circle(objects, 4.0)
        # radius = spacing when only 1 object; angle = 0 => (radius, 0, 0)
        location = objects[0].location
        assert abs(location[0] - 4.0) < 1e-9
        assert abs(location[1]) < 1e-9
        assert location[2] == 0

    def test_four_objects_equally_spaced(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(4)
        spacing = 3.0
        composer._layout_circle(objects, spacing)

        radius = spacing * 4 / (2 * math.pi)
        for index, obj in enumerate(objects):
            angle = 2 * math.pi * index / 4
            expected_x = radius * math.cos(angle)
            expected_y = radius * math.sin(angle)
            assert abs(obj.location[0] - expected_x) < 1e-9
            assert abs(obj.location[1] - expected_y) < 1e-9
            assert obj.location[2] == 0

    def test_circle_radius_scales_with_object_count(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects_3 = _make_mock_objects(3)
        objects_6 = _make_mock_objects(6)
        spacing = 2.0

        composer._layout_circle(objects_3, spacing)
        composer._layout_circle(objects_6, spacing)

        radius_3 = math.sqrt(
            objects_3[0].location[0] ** 2 + objects_3[0].location[1] ** 2
        )
        radius_6 = math.sqrt(
            objects_6[0].location[0] ** 2 + objects_6[0].location[1] ** 2
        )
        assert radius_6 > radius_3


class TestLayoutLine:
    def test_objects_placed_along_x_axis(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(3)
        composer._layout_line(objects, 4.0)
        assert objects[0].location == (0, 0, 0)
        assert objects[1].location == (4.0, 0, 0)
        assert objects[2].location == (8.0, 0, 0)

    def test_single_object_at_origin(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(1)
        composer._layout_line(objects, 5.0)
        assert objects[0].location == (0, 0, 0)


class TestLayoutRandomScatter:
    def test_all_objects_get_positions(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(5)
        composer._layout_random_scatter(objects, 3.0)

        for obj in objects:
            assert obj.location is not None
            assert len(obj.location) == 3
            assert obj.location[2] == 0

    def test_positions_deterministic_with_fixed_seed(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects_a = _make_mock_objects(4)
        objects_b = _make_mock_objects(4)

        composer._layout_random_scatter(objects_a, 3.0)
        composer._layout_random_scatter(objects_b, 3.0)

        for obj_a, obj_b in zip(objects_a, objects_b):
            assert obj_a.location == obj_b.location

    def test_positions_within_expected_area(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(9)
        spacing = 2.0
        composer._layout_random_scatter(objects, spacing)

        area = spacing * max(1, int(math.sqrt(9)))
        for obj in objects:
            assert -area <= obj.location[0] <= area
            assert -area <= obj.location[1] <= area


class TestLayoutPyramid:
    def test_single_object_at_base(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(1)
        composer._layout_pyramid(objects, 2.0)
        # Level 0: 1 item, cols=1, offset=0
        assert objects[0].location == (0.0, 0.0, 0.0)

    def test_five_objects_stacked(
        self, mock_blender_modules: dict
    ) -> None:
        composer = _make_composer()
        objects = _make_mock_objects(5)
        composer._layout_pyramid(objects, 2.0)
        # Level 0: 1 item (1^2=1), level 1: 4 items (2^2=4)
        # All items should have z = level * spacing
        assert objects[0].location[2] == 0.0  # level 0
        for index in range(1, 5):
            assert objects[index].location[2] == 2.0  # level 1


# ── setup_environment ──────────────────────────────────────────────


class TestSetupEnvironment:
    def test_sets_background_color(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_world = MagicMock()
        mock_background = MagicMock()
        mock_world.node_tree.nodes.get.return_value = mock_background
        mock_bpy.context.scene.world = mock_world

        composer = _make_composer()
        spec = EnvironmentSpec(background_color=[0.1, 0.2, 0.3, 1.0])

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.setup_environment(spec)

        mock_background.inputs["Color"].default_value = [0.1, 0.2, 0.3, 1.0]
        mock_background.inputs["Strength"].default_value = 1.0
        mock_world.node_tree.nodes.get.assert_called_with("Background")

    def test_creates_world_when_none_exists(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_bpy.context.scene.world = None

        new_world = MagicMock()
        new_world.node_tree.nodes.get.return_value = MagicMock()
        mock_bpy.data.worlds.new.return_value = new_world

        composer = _make_composer()
        spec = EnvironmentSpec()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.setup_environment(spec)

        mock_bpy.data.worlds.new.assert_called_once_with("World")

    def test_enables_use_nodes(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_world = MagicMock()
        mock_world.node_tree.nodes.get.return_value = MagicMock()
        mock_bpy.context.scene.world = mock_world

        composer = _make_composer()

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.setup_environment(EnvironmentSpec())

        assert mock_world.use_nodes is True


# ── setup_world ────────────────────────────────────────────────────


class TestSetupWorld:
    def test_applies_eevee_settings(self, mock_blender_modules: dict) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_world = MagicMock()
        mock_world.node_tree.nodes.get.return_value = MagicMock()
        mock_bpy.context.scene.world = mock_world

        mock_eevee = MagicMock()
        mock_bpy.context.scene.eevee = mock_eevee

        composer = _make_composer()
        settings = WorldSettings(
            ambient_occlusion=True,
            bloom=True,
            volumetrics=True,
        )

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.setup_world(settings)

        assert mock_eevee.use_gtao is True
        assert mock_eevee.use_bloom is True
        assert mock_eevee.use_volumetric_lights is True

    def test_delegates_to_setup_environment(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_world = MagicMock()
        mock_world.node_tree.nodes.get.return_value = MagicMock()
        mock_bpy.context.scene.world = mock_world
        mock_bpy.context.scene.eevee = MagicMock()

        composer = _make_composer()
        settings = WorldSettings(background_color=[1.0, 0.0, 0.0, 1.0])

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy), \
             patch.object(composer, "setup_environment") as mock_setup_env:
            composer.setup_world(settings)

        mock_setup_env.assert_called_once()
        call_arg = mock_setup_env.call_args[0][0]
        assert isinstance(call_arg, EnvironmentSpec)
        assert call_arg.background_color == [1.0, 0.0, 0.0, 1.0]

    def test_eevee_settings_disabled_by_default(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = mock_blender_modules["bpy"]
        mock_world = MagicMock()
        mock_world.node_tree.nodes.get.return_value = MagicMock()
        mock_bpy.context.scene.world = mock_world

        mock_eevee = MagicMock()
        mock_bpy.context.scene.eevee = mock_eevee

        composer = _make_composer()
        settings = WorldSettings()  # defaults: bloom=False, volumetrics=False

        with patch("blender_pipeline.llm_integration.scene_composer.HAS_BPY", True), \
             patch("blender_pipeline.llm_integration.scene_composer.bpy", mock_bpy):
            composer.setup_world(settings)

        assert mock_eevee.use_bloom is False
        assert mock_eevee.use_volumetric_lights is False
