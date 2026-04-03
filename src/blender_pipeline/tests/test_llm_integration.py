"""Tests for LLM integration modules."""

import json
from unittest.mock import patch, MagicMock

import pytest

from blender_pipeline.llm_integration.text_to_3d import (
    SceneDescription,
    ObjectSpec,
    LightSpec,
    CameraSpec,
    MaterialSpec,
    _extract_json,
)
from blender_pipeline.llm_integration.material_from_prompt import (
    MaterialGenerator,
    MaterialParams,
    MATERIAL_PRESETS,
    _parse_material_params,
)
from blender_pipeline.llm_integration.animation_from_text import (
    AnimationSequence,
    AnimationAction,
    AnimationInterpreter,
)


class TestSceneDescription:
    def test_from_dict_basic(self) -> None:
        data = {
            "objects": [{"shape": "sphere", "name": "Ball", "position": [0, 0, 1]}],
            "lights": [{"type": "SUN", "intensity": 5}],
            "camera": {"position": [5, -5, 3]},
        }
        scene = SceneDescription.from_dict(data)
        assert len(scene.objects) == 1
        assert scene.objects[0].shape == "sphere"
        assert scene.objects[0].name == "Ball"
        assert len(scene.lights) == 1
        assert scene.camera.position == [5, -5, 3]

    def test_from_dict_empty(self) -> None:
        scene = SceneDescription.from_dict({})
        assert scene.objects == []
        assert scene.lights == []

    def test_to_dict_roundtrip(self) -> None:
        scene = SceneDescription(
            objects=[ObjectSpec(shape="box", name="Cube")],
            lights=[LightSpec(type="POINT")],
        )
        data = scene.to_dict()
        assert data["objects"][0]["shape"] == "box"
        assert data["lights"][0]["type"] == "POINT"

    def test_object_spec_defaults(self) -> None:
        spec = ObjectSpec()
        assert spec.shape == "box"
        assert spec.scale == [1.0, 1.0, 1.0]
        assert isinstance(spec.material, MaterialSpec)

    def test_material_spec_defaults(self) -> None:
        mat = MaterialSpec()
        assert mat.metallic == 0.0
        assert mat.roughness == 0.5


class TestExtractJson:
    def test_plain_json(self) -> None:
        result = _extract_json('{"objects": []}')
        assert result == {"objects": []}

    def test_json_in_code_block(self) -> None:
        text = '```json\n{"objects": [{"shape": "box"}]}\n```'
        result = _extract_json(text)
        assert result["objects"][0]["shape"] == "box"

    def test_invalid_json_returns_fallback(self) -> None:
        result = _extract_json("not json at all")
        assert "objects" in result


class TestMaterialPresets:
    def test_all_presets_have_valid_params(self) -> None:
        for name, params in MATERIAL_PRESETS.items():
            assert 0.0 <= params.metallic <= 1.0, f"{name} metallic out of range"
            assert 0.0 <= params.roughness <= 1.0, f"{name} roughness out of range"
            assert len(params.base_color) == 4, f"{name} base_color should be RGBA"

    def test_preset_lookup_by_name(self) -> None:
        gen = MaterialGenerator()
        result = gen.try_preset_first("rusty metal fence")
        assert result is not None
        assert result.metallic == 1.0

    def test_preset_lookup_wood(self) -> None:
        gen = MaterialGenerator()
        result = gen.try_preset_first("old weathered wood")
        assert result is not None
        assert result.roughness > 0.5

    def test_no_preset_match(self) -> None:
        gen = MaterialGenerator()
        result = gen.try_preset_first("alien biomechanical surface")
        assert result is None

    def test_parse_material_params_valid_json(self) -> None:
        json_str = json.dumps({"base_color": [1, 0, 0, 1], "metallic": 0.8, "roughness": 0.3})
        result = _parse_material_params(json_str)
        assert result.metallic == 0.8
        assert result.roughness == 0.3

    def test_parse_material_params_invalid_falls_back(self) -> None:
        result = _parse_material_params("garbage")
        assert isinstance(result, MaterialParams)
        assert result.roughness == 0.5


class TestAnimationSequence:
    def test_from_dict(self) -> None:
        data = {
            "name": "test_anim",
            "total_frames": 60,
            "fps": 30,
            "actions": [
                {"object_name": "Cube", "action_type": "move", "parameters": {"target": [1, 2, 3]}, "start_frame": 1, "duration_frames": 30},
            ],
        }
        seq = AnimationSequence.from_dict(data)
        assert seq.name == "test_anim"
        assert len(seq.actions) == 1
        assert seq.actions[0].action_type == "move"
        assert seq.total_frames == 60

    def test_preview_sequence(self) -> None:
        seq = AnimationSequence(
            name="preview_test",
            actions=[AnimationAction("Cube", "bounce", {"height": 3}, 1, 60)],
            total_frames=60,
        )
        interpreter = AnimationInterpreter()
        preview = interpreter.preview_sequence(seq)
        assert "preview_test" in preview
        assert "Cube" in preview
        assert "bounce" in preview
