"""Reusable animation presets with keyframe templates."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class Keyframe:
    """A single keyframe value."""

    frame: int
    value: float
    interpolation: str = "BEZIER"


@dataclass
class AnimationChannel:
    """A sequence of keyframes on a single property."""

    property_path: str
    index: int = 0
    keyframes: list[Keyframe] = field(default_factory=list)


@dataclass
class KeyframeTemplate:
    """A reusable animation preset made up of multiple channels."""

    name: str
    channels: list[AnimationChannel]
    frame_count: int = 60
    fps: int = 24


def _bounce_template() -> KeyframeTemplate:
    return KeyframeTemplate(
        name="bounce",
        channels=[AnimationChannel(
            property_path="location", index=2,
            keyframes=[
                Keyframe(0, 0.0), Keyframe(12, 2.0, "BEZIER"),
                Keyframe(24, 0.0, "BEZIER"), Keyframe(36, 1.0, "BEZIER"),
                Keyframe(48, 0.0, "BEZIER"), Keyframe(60, 0.0),
            ],
        )],
        frame_count=60,
    )


def _spin_template() -> KeyframeTemplate:
    return KeyframeTemplate(
        name="spin",
        channels=[AnimationChannel(
            property_path="rotation_euler", index=2,
            keyframes=[Keyframe(0, 0.0, "LINEAR"), Keyframe(60, math.pi * 2, "LINEAR")],
        )],
        frame_count=60,
    )


def _pulse_template() -> KeyframeTemplate:
    channels = []
    for axis_index in range(3):
        channels.append(AnimationChannel(
            property_path="scale", index=axis_index,
            keyframes=[
                Keyframe(0, 1.0), Keyframe(15, 1.3, "BEZIER"),
                Keyframe(30, 1.0, "BEZIER"), Keyframe(45, 0.8, "BEZIER"),
                Keyframe(60, 1.0),
            ],
        ))
    return KeyframeTemplate(name="pulse", channels=channels, frame_count=60)


def _fade_in_template() -> KeyframeTemplate:
    return KeyframeTemplate(
        name="fade_in",
        channels=[AnimationChannel(
            property_path="color", index=3,
            keyframes=[Keyframe(0, 0.0, "LINEAR"), Keyframe(30, 1.0, "LINEAR")],
        )],
        frame_count=30,
    )


def _fade_out_template() -> KeyframeTemplate:
    return KeyframeTemplate(
        name="fade_out",
        channels=[AnimationChannel(
            property_path="color", index=3,
            keyframes=[Keyframe(0, 1.0, "LINEAR"), Keyframe(30, 0.0, "LINEAR")],
        )],
        frame_count=30,
    )


def _slide_in_template() -> KeyframeTemplate:
    return KeyframeTemplate(
        name="slide_in",
        channels=[AnimationChannel(
            property_path="location", index=0,
            keyframes=[Keyframe(0, -10.0, "BEZIER"), Keyframe(30, 0.0, "BEZIER")],
        )],
        frame_count=30,
    )


def _shake_template() -> KeyframeTemplate:
    keyframes = []
    for i in range(13):
        amplitude = 0.3 * (1.0 - i / 12.0)
        value = amplitude * (1 if i % 2 == 0 else -1)
        keyframes.append(Keyframe(i * 2, value, "LINEAR"))
    return KeyframeTemplate(
        name="shake",
        channels=[AnimationChannel(property_path="location", index=0, keyframes=keyframes)],
        frame_count=24,
    )


def _orbit_template() -> KeyframeTemplate:
    keyframes_x: list[Keyframe] = []
    keyframes_y: list[Keyframe] = []
    total_frames = 120
    steps = 24
    for i in range(steps + 1):
        frame = int(i * total_frames / steps)
        angle = 2 * math.pi * i / steps
        keyframes_x.append(Keyframe(frame, math.cos(angle) * 5.0, "BEZIER"))
        keyframes_y.append(Keyframe(frame, math.sin(angle) * 5.0, "BEZIER"))
    return KeyframeTemplate(
        name="orbit",
        channels=[
            AnimationChannel(property_path="location", index=0, keyframes=keyframes_x),
            AnimationChannel(property_path="location", index=1, keyframes=keyframes_y),
        ],
        frame_count=total_frames,
    )


BUILT_IN_TEMPLATES: dict[str, KeyframeTemplate] = {
    "bounce": _bounce_template(),
    "spin": _spin_template(),
    "pulse": _pulse_template(),
    "fade_in": _fade_in_template(),
    "fade_out": _fade_out_template(),
    "slide_in": _slide_in_template(),
    "shake": _shake_template(),
    "orbit": _orbit_template(),
}


class TemplateLibrary:
    """Manages and applies keyframe animation templates."""

    def __init__(self) -> None:
        self._templates: dict[str, KeyframeTemplate] = dict(BUILT_IN_TEMPLATES)

    def register_template(self, template: KeyframeTemplate) -> None:
        self._templates[template.name] = template

    def get_template(self, name: str) -> KeyframeTemplate:
        if name not in self._templates:
            raise KeyError(f"Template '{name}' not found. Available: {list(self._templates)}")
        return self._templates[name]

    def list_templates(self) -> list[str]:
        return list(self._templates.keys())

    def apply_template(
        self,
        template_name: str,
        target_object: Any,
        start_frame: int = 0,
        speed_multiplier: float = 1.0,
    ) -> None:
        """Apply a named template to a Blender object."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        template = self.get_template(template_name)
        for channel in template.channels:
            for keyframe in channel.keyframes:
                adjusted_frame = start_frame + int(keyframe.frame / speed_multiplier)
                target_object.keyframe_insert(
                    data_path=channel.property_path,
                    index=channel.index,
                    frame=adjusted_frame,
                )
                fcurve = _find_fcurve(target_object, channel.property_path, channel.index)
                if fcurve and fcurve.keyframe_points:
                    kf_point = fcurve.keyframe_points[-1]
                    kf_point.co.y = keyframe.value
                    kf_point.interpolation = keyframe.interpolation

    def combine_templates(
        self,
        template_names: list[str],
        target_object: Any,
        start_frame: int = 0,
    ) -> None:
        """Layer multiple templates onto a single object."""
        for name in template_names:
            self.apply_template(name, target_object, start_frame)

    def create_walk_cycle(
        self,
        rig_object: Any,
        stride_length: float = 1.0,
        speed: float = 1.0,
    ) -> None:
        """Apply a basic walk cycle to an armature (location oscillation + rotation)."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        total_frames = int(48 / speed)
        for frame in range(0, total_frames + 1, 4):
            phase = (frame / total_frames) * math.pi * 2
            rig_object.location.z = abs(math.sin(phase)) * 0.1 * stride_length
            rig_object.location.x = (frame / total_frames) * stride_length * 2
            rig_object.keyframe_insert(data_path="location", frame=frame)

    def create_idle_animation(
        self,
        rig_object: Any,
        breath_intensity: float = 0.02,
    ) -> None:
        """Apply subtle idle breathing motion."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        for frame in range(0, 121, 6):
            phase = (frame / 120.0) * math.pi * 2
            rig_object.scale = (
                1.0 + math.sin(phase) * breath_intensity * 0.5,
                1.0 + math.sin(phase) * breath_intensity * 0.5,
                1.0 + math.sin(phase) * breath_intensity,
            )
            rig_object.keyframe_insert(data_path="scale", frame=frame)


def _find_fcurve(obj: Any, data_path: str, index: int) -> Any:
    """Find an FCurve on an object by data path and index."""
    if not obj.animation_data or not obj.animation_data.action:
        return None
    for fcurve in obj.animation_data.action.fcurves:
        if fcurve.data_path == data_path and fcurve.array_index == index:
            return fcurve
    return None
