"""Procedural animation — no manual keyframing needed."""

from __future__ import annotations

import logging
import math
import random
from dataclasses import dataclass
from typing import Any

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

from blender_pipeline.generation.noise import PerlinNoise

logger = logging.getLogger(__name__)


@dataclass
class FrameRange:
    """Animation frame range."""

    start: int = 1
    end: int = 120


class ProceduralAnimator:
    """Generates animation procedurally by baking math-driven motion to keyframes."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    # ── Core procedural effects ─────────────────────────────────────

    def apply_sine_wave(
        self,
        obj: Any,
        property_path: str = "location",
        index: int = 2,
        amplitude: float = 1.0,
        frequency: float = 1.0,
        phase: float = 0.0,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Apply sine-wave motion to a property channel."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        for frame in range(frame_range.start, frame_range.end + 1):
            time = (frame - frame_range.start) / 24.0
            value = amplitude * math.sin(2 * math.pi * frequency * time + phase)
            _set_property_value(obj, property_path, index, value)
            obj.keyframe_insert(data_path=property_path, index=index, frame=frame)

    def apply_noise_jitter(
        self,
        obj: Any,
        property_path: str = "location",
        index: int = 0,
        intensity: float = 0.5,
        speed: float = 1.0,
        seed: int = 42,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Apply noise-based random jitter to a property."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        perlin = PerlinNoise(seed)
        for frame in range(frame_range.start, frame_range.end + 1):
            time = (frame - frame_range.start) / 24.0 * speed
            value = perlin.noise2d(time, seed * 0.1) * intensity
            _set_property_value(obj, property_path, index, value)
            obj.keyframe_insert(data_path=property_path, index=index, frame=frame)

    def apply_spring_dynamics(
        self,
        obj: Any,
        target_position: tuple[float, float, float] = (0.0, 0.0, 0.0),
        stiffness: float = 10.0,
        damping: float = 0.5,
        mass: float = 1.0,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Simulate spring physics baked to location keyframes."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        dt = 1.0 / 24.0

        positions = [obj.location[i] for i in range(3)]
        velocities = [0.0, 0.0, 0.0]

        for frame in range(frame_range.start, frame_range.end + 1):
            for axis in range(3):
                displacement = positions[axis] - target_position[axis]
                spring_force = -stiffness * displacement
                damping_force = -damping * velocities[axis]
                acceleration = (spring_force + damping_force) / mass
                velocities[axis] += acceleration * dt
                positions[axis] += velocities[axis] * dt
                obj.location[axis] = positions[axis]
            obj.keyframe_insert(data_path="location", frame=frame)

    def apply_pendulum(
        self,
        obj: Any,
        pivot_point: tuple[float, float, float] = (0.0, 0.0, 5.0),
        length: float = 3.0,
        initial_angle: float = 45.0,
        damping: float = 0.02,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Simulate pendulum motion baked to keyframes."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        dt = 1.0 / 24.0
        gravity = 9.81

        angle = math.radians(initial_angle)
        angular_velocity = 0.0

        for frame in range(frame_range.start, frame_range.end + 1):
            angular_acceleration = -(gravity / length) * math.sin(angle) - damping * angular_velocity
            angular_velocity += angular_acceleration * dt
            angle += angular_velocity * dt

            obj.location = (
                pivot_point[0] + length * math.sin(angle),
                pivot_point[1],
                pivot_point[2] - length * math.cos(angle),
            )
            obj.keyframe_insert(data_path="location", frame=frame)

    def apply_follow_path(
        self,
        obj: Any,
        path_points: list[tuple[float, float, float]],
        speed: float = 1.0,
        loop: bool = False,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Move an object along a 3D path defined by control points."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        if len(path_points) < 2:
            return

        total_frames = frame_range.end - frame_range.start
        segment_count = len(path_points) - (0 if loop else 1)

        for frame in range(frame_range.start, frame_range.end + 1):
            progress = ((frame - frame_range.start) / total_frames) * speed
            if loop:
                progress = progress % 1.0
            else:
                progress = min(progress, 1.0)

            segment_progress = progress * segment_count
            segment_index = min(int(segment_progress), segment_count - 1)
            local_progress = segment_progress - segment_index

            point_a = path_points[segment_index % len(path_points)]
            point_b = path_points[(segment_index + 1) % len(path_points)]

            obj.location = tuple(
                a + (b - a) * local_progress for a, b in zip(point_a, point_b)
            )
            obj.keyframe_insert(data_path="location", frame=frame)

    def apply_look_at(
        self,
        obj: Any,
        target_object: Any,
        influence: float = 1.0,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Add a Track To constraint for look-at behavior."""
        self._require_bpy()
        constraint = obj.constraints.new(type="TRACK_TO")
        constraint.target = target_object
        constraint.track_axis = "TRACK_NEGATIVE_Z"
        constraint.up_axis = "UP_Y"
        constraint.influence = influence

    def apply_breathing(
        self,
        obj: Any,
        intensity: float = 0.02,
        rate: float = 0.25,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Apply subtle scale-based breathing effect."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        for frame in range(frame_range.start, frame_range.end + 1):
            time = (frame - frame_range.start) / 24.0
            breath = math.sin(2 * math.pi * rate * time)
            obj.scale = (
                1.0 + breath * intensity * 0.5,
                1.0 + breath * intensity * 0.5,
                1.0 + breath * intensity,
            )
            obj.keyframe_insert(data_path="scale", frame=frame)

    def apply_floating(
        self,
        obj: Any,
        height: float = 0.5,
        speed: float = 0.5,
        wobble: float = 0.1,
        frame_range: FrameRange | None = None,
    ) -> None:
        """Apply hovering/floating motion."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        base_z = obj.location.z

        for frame in range(frame_range.start, frame_range.end + 1):
            time = (frame - frame_range.start) / 24.0
            float_offset = height * math.sin(2 * math.pi * speed * time)
            wobble_x = wobble * math.sin(2 * math.pi * speed * 1.3 * time)
            wobble_y = wobble * math.cos(2 * math.pi * speed * 0.7 * time)
            obj.location.x += wobble_x
            obj.location.y += wobble_y
            obj.location.z = base_z + float_offset
            obj.keyframe_insert(data_path="location", frame=frame)

    def apply_wave_deform(
        self,
        mesh_object: Any,
        amplitude: float = 0.5,
        wavelength: float = 2.0,
        speed: float = 1.0,
        direction: tuple[float, float] = (1.0, 0.0),
        frame_range: FrameRange | None = None,
    ) -> None:
        """Apply animated wave deformation via a Wave modifier."""
        self._require_bpy()
        frame_range = frame_range or FrameRange()
        modifier = mesh_object.modifiers.new(name="WaveDeform", type="WAVE")
        modifier.height = amplitude
        modifier.width = wavelength
        modifier.speed = speed
        modifier.use_x = direction[0] != 0
        modifier.use_y = direction[1] != 0
        modifier.time_offset = frame_range.start / 24.0

    def combine_procedural(
        self,
        obj: Any,
        effects: list[dict],
    ) -> None:
        """Apply multiple procedural effects to an object."""
        effect_map = {
            "sine_wave": self.apply_sine_wave,
            "noise_jitter": self.apply_noise_jitter,
            "spring": self.apply_spring_dynamics,
            "pendulum": self.apply_pendulum,
            "follow_path": self.apply_follow_path,
            "breathing": self.apply_breathing,
            "floating": self.apply_floating,
            "wave_deform": self.apply_wave_deform,
        }
        for effect in effects:
            effect_type = effect.pop("type", None)
            if effect_type not in effect_map:
                logger.warning("Unknown procedural effect: %s", effect_type)
                continue
            effect_map[effect_type](obj, **effect)


def _set_property_value(obj: Any, property_path: str, index: int, value: float) -> None:
    """Set a single channel of a vector property on a Blender object."""
    prop = getattr(obj, property_path)
    prop[index] = value
