"""Tests for animation modules."""

import math

import pytest

from blender_pipeline.animation.keyframe_templates import (
    Keyframe,
    AnimationChannel,
    KeyframeTemplate,
    TemplateLibrary,
    BUILT_IN_TEMPLATES,
)
from blender_pipeline.animation.mocap import MocapImporter, BVHData, BoneMapping, _normalize_bone_name, _name_similarity


class TestKeyframeDataclasses:
    def test_keyframe_creation(self) -> None:
        kf = Keyframe(frame=10, value=1.5, interpolation="LINEAR")
        assert kf.frame == 10
        assert kf.value == 1.5
        assert kf.interpolation == "LINEAR"

    def test_animation_channel(self) -> None:
        channel = AnimationChannel(
            property_path="location", index=2,
            keyframes=[Keyframe(0, 0.0), Keyframe(30, 5.0)],
        )
        assert len(channel.keyframes) == 2
        assert channel.property_path == "location"

    def test_template_structure(self) -> None:
        template = KeyframeTemplate(
            name="test",
            channels=[AnimationChannel("location", 0, [Keyframe(0, 0.0)])],
            frame_count=30,
            fps=24,
        )
        assert template.name == "test"
        assert template.frame_count == 30


class TestTemplateLibrary:
    def test_built_in_templates_exist(self) -> None:
        expected = ["bounce", "spin", "pulse", "fade_in", "fade_out", "slide_in", "shake", "orbit"]
        for name in expected:
            assert name in BUILT_IN_TEMPLATES, f"Missing built-in template: {name}"

    def test_library_list(self) -> None:
        library = TemplateLibrary()
        templates = library.list_templates()
        assert len(templates) >= 8

    def test_get_template(self) -> None:
        library = TemplateLibrary()
        bounce = library.get_template("bounce")
        assert bounce.name == "bounce"
        assert len(bounce.channels) > 0

    def test_get_missing_template_raises(self) -> None:
        library = TemplateLibrary()
        with pytest.raises(KeyError):
            library.get_template("nonexistent")

    def test_register_custom_template(self) -> None:
        library = TemplateLibrary()
        custom = KeyframeTemplate("custom", [], 60)
        library.register_template(custom)
        assert library.get_template("custom").name == "custom"

    def test_bounce_has_z_channel(self) -> None:
        bounce = BUILT_IN_TEMPLATES["bounce"]
        z_channels = [c for c in bounce.channels if c.property_path == "location" and c.index == 2]
        assert len(z_channels) == 1

    def test_spin_uses_linear_interpolation(self) -> None:
        spin = BUILT_IN_TEMPLATES["spin"]
        for channel in spin.channels:
            for kf in channel.keyframes:
                assert kf.interpolation == "LINEAR"


class TestBVHParser:
    SAMPLE_BVH = """HIERARCHY
ROOT Hips
{
    OFFSET 0.0 0.0 0.0
    CHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation
    JOINT Spine
    {
        OFFSET 0.0 5.0 0.0
        CHANNELS 3 Xrotation Yrotation Zrotation
        End Site
        {
            OFFSET 0.0 5.0 0.0
        }
    }
}
MOTION
Frames: 2
Frame Time: 0.033333
0.0 0.0 0.0 0.0 0.0 0.0 10.0 20.0 30.0
1.0 2.0 3.0 5.0 10.0 15.0 20.0 25.0 35.0"""

    def test_parse_joints(self) -> None:
        importer = MocapImporter()
        data = importer.parse_bvh_string(self.SAMPLE_BVH)
        assert len(data.joints) >= 2
        root = data.joints[0]
        assert root.name == "Hips"
        assert root.parent is None

    def test_parse_frames(self) -> None:
        importer = MocapImporter()
        data = importer.parse_bvh_string(self.SAMPLE_BVH)
        assert data.frame_count == 2
        assert len(data.frames[0]) == 9

    def test_frame_time(self) -> None:
        importer = MocapImporter()
        data = importer.parse_bvh_string(self.SAMPLE_BVH)
        assert abs(data.frame_time - 0.033333) < 0.001

    def test_joint_hierarchy(self) -> None:
        importer = MocapImporter()
        data = importer.parse_bvh_string(self.SAMPLE_BVH)
        spine = next((j for j in data.joints if j.name == "Spine"), None)
        assert spine is not None
        assert spine.parent == "Hips"


class TestBoneMapping:
    def test_normalize_bone_name(self) -> None:
        assert _normalize_bone_name("Bip01_UpperArm_L") == "upperarm"
        assert _normalize_bone_name("DEF_spine") == "spine"

    def test_name_similarity_exact(self) -> None:
        assert _name_similarity("spine", "spine") == 1.0

    def test_name_similarity_partial(self) -> None:
        score = _name_similarity("upper_arm", "arm")
        assert score > 0.3

    def test_bone_mapping_dataclass(self) -> None:
        mapping = BoneMapping("source_hip", "target_hip", (0.1, 0.0, 0.0), 1.0)
        assert mapping.source_bone == "source_hip"
        assert mapping.scale_factor == 1.0
