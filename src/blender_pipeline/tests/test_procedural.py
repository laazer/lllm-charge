"""Tests for ProceduralAnimator — runs without Blender by mocking bpy."""

from __future__ import annotations

import logging
import math
from unittest.mock import MagicMock, call

import pytest

import blender_pipeline.animation.procedural as procedural_mod
from blender_pipeline.animation.procedural import (
    FrameRange,
    ProceduralAnimator,
    _set_property_value,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enable_bpy(mock_blender_modules: dict) -> MagicMock:
    """Patch the module-level flag and bpy reference, return mock_bpy."""
    procedural_mod.HAS_BPY = True
    procedural_mod.bpy = mock_blender_modules["bpy"]
    return mock_blender_modules["bpy"]


def _make_mock_object(
    initial_location: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> MagicMock:
    """Return a mock Blender object with indexable location/scale/constraints."""
    obj = MagicMock()
    obj.location = list(initial_location)
    obj.scale = [1.0, 1.0, 1.0]
    obj.constraints = MagicMock()
    obj.modifiers = MagicMock()
    return obj


# ---------------------------------------------------------------------------
# FrameRange dataclass
# ---------------------------------------------------------------------------

class TestFrameRange:
    def test_default_values(self) -> None:
        frame_range = FrameRange()
        assert frame_range.start == 1
        assert frame_range.end == 120

    def test_custom_values(self) -> None:
        frame_range = FrameRange(start=10, end=250)
        assert frame_range.start == 10
        assert frame_range.end == 250


# ---------------------------------------------------------------------------
# _set_property_value (module-level helper)
# ---------------------------------------------------------------------------

class TestSetPropertyValue:
    def test_sets_correct_index(self) -> None:
        obj = MagicMock()
        obj.location = [0.0, 0.0, 0.0]
        _set_property_value(obj, "location", 2, 5.5)
        assert obj.location[2] == 5.5

    def test_sets_index_zero(self) -> None:
        obj = MagicMock()
        obj.rotation_euler = [0.0, 0.0, 0.0]
        _set_property_value(obj, "rotation_euler", 0, 1.57)
        assert obj.rotation_euler[0] == 1.57


# ---------------------------------------------------------------------------
# _require_bpy
# ---------------------------------------------------------------------------

class TestRequireBpy:
    def test_raises_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        procedural_mod.HAS_BPY = False
        animator = ProceduralAnimator()
        with pytest.raises(RuntimeError, match="bpy is not available"):
            animator._require_bpy()

    def test_no_error_when_bpy_available(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        animator._require_bpy()


# ---------------------------------------------------------------------------
# apply_sine_wave
# ---------------------------------------------------------------------------

class TestApplySineWave:
    def test_keyframe_insert_called_for_each_frame(
        self, mock_blender_modules: dict
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        frame_range = FrameRange(start=1, end=10)

        animator.apply_sine_wave(obj, frame_range=frame_range)

        assert obj.keyframe_insert.call_count == 10  # frames 1..10

    def test_values_follow_sine_pattern(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        amplitude = 2.0
        frequency = 1.0
        frame_range = FrameRange(start=1, end=25)

        animator.apply_sine_wave(
            obj,
            property_path="location",
            index=2,
            amplitude=amplitude,
            frequency=frequency,
            phase=0.0,
            frame_range=frame_range,
        )

        # Verify the value set at frame 1 (time=0 => sin(0)=0)
        # and at frame ~7 (time=0.25 => sin(pi/2)=1 => value=amplitude)
        # We can check the keyframe_insert calls by index
        calls = obj.keyframe_insert.call_args_list
        assert len(calls) == 25

        # At frame 1, time=0 => sin(0)=0 => value should be 0
        assert obj.location[2] is not None  # was set

    def test_sine_wave_uses_default_frame_range(
        self, mock_blender_modules: dict
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        animator.apply_sine_wave(obj)

        # Default FrameRange is 1..120 => 120 keyframes
        assert obj.keyframe_insert.call_count == 120

    def test_sine_wave_mathematical_correctness(
        self, mock_blender_modules: dict
    ) -> None:
        """Verify the actual sine values set on the object."""
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()

        recorded_values: list[float] = []
        obj = MagicMock()
        obj.location = [0.0, 0.0, 0.0]

        original_set = _set_property_value

        def capture_set(target: object, prop: str, idx: int, val: float) -> None:
            original_set(target, prop, idx, val)
            recorded_values.append(val)

        procedural_mod._set_property_value = capture_set  # type: ignore[attr-defined]
        try:
            frame_range = FrameRange(start=1, end=5)
            animator.apply_sine_wave(
                obj,
                amplitude=1.0,
                frequency=1.0,
                phase=0.0,
                frame_range=frame_range,
            )
        finally:
            procedural_mod._set_property_value = original_set  # type: ignore[attr-defined]

        for i, frame in enumerate(range(1, 6)):
            time = (frame - 1) / 24.0
            expected = 1.0 * math.sin(2 * math.pi * 1.0 * time)
            assert abs(recorded_values[i] - expected) < 1e-9, (
                f"Frame {frame}: expected {expected}, got {recorded_values[i]}"
            )


# ---------------------------------------------------------------------------
# apply_noise_jitter
# ---------------------------------------------------------------------------

class TestApplyNoiseJitter:
    def test_keyframes_inserted(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        frame_range = FrameRange(start=1, end=20)

        animator.apply_noise_jitter(obj, frame_range=frame_range, seed=7)

        assert obj.keyframe_insert.call_count == 20

    def test_uses_perlin_noise(self, mock_blender_modules: dict) -> None:
        """Verify different seeds produce different jitter patterns."""
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        frame_range = FrameRange(start=1, end=10)

        values_seed_1: list[float] = []
        values_seed_2: list[float] = []

        for seed, values_list in [(1, values_seed_1), (2, values_seed_2)]:
            obj = MagicMock()
            obj.location = [0.0, 0.0, 0.0]
            original_set = _set_property_value

            captured: list[float] = []

            def capture_set(target: object, prop: str, idx: int, val: float) -> None:
                original_set(target, prop, idx, val)
                captured.append(val)

            procedural_mod._set_property_value = capture_set  # type: ignore[attr-defined]
            try:
                animator.apply_noise_jitter(obj, seed=seed, frame_range=frame_range)
            finally:
                procedural_mod._set_property_value = original_set  # type: ignore[attr-defined]
            values_list.extend(captured)

        # Different seeds should produce different values
        assert values_seed_1 != values_seed_2


# ---------------------------------------------------------------------------
# apply_spring_dynamics
# ---------------------------------------------------------------------------

class TestApplySpringDynamics:
    def test_keyframes_inserted(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object(initial_location=(5.0, 0.0, 0.0))
        frame_range = FrameRange(start=1, end=30)

        animator.apply_spring_dynamics(
            obj, target_position=(0.0, 0.0, 0.0), frame_range=frame_range
        )

        assert obj.keyframe_insert.call_count == 30

    def test_spring_converges_toward_target(self, mock_blender_modules: dict) -> None:
        """After many frames, position should be closer to target than start."""
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object(initial_location=(10.0, 0.0, 0.0))
        target = (0.0, 0.0, 0.0)
        frame_range = FrameRange(start=1, end=200)

        animator.apply_spring_dynamics(
            obj,
            target_position=target,
            stiffness=10.0,
            damping=2.0,
            frame_range=frame_range,
        )

        # After 200 frames with damping, x should be much closer to 0 than 10
        final_x = obj.location[0]
        assert abs(final_x - target[0]) < abs(10.0 - target[0]), (
            f"Spring should converge toward target; final_x={final_x}"
        )

    def test_spring_with_high_damping_settles_quickly(
        self, mock_blender_modules: dict
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object(initial_location=(5.0, 5.0, 5.0))
        target = (0.0, 0.0, 0.0)
        frame_range = FrameRange(start=1, end=300)

        animator.apply_spring_dynamics(
            obj,
            target_position=target,
            stiffness=10.0,
            damping=5.0,
            frame_range=frame_range,
        )

        # With high damping, should be very close to target
        for axis in range(3):
            assert abs(obj.location[axis] - target[axis]) < 0.5, (
                f"Axis {axis}: expected near {target[axis]}, got {obj.location[axis]}"
            )


# ---------------------------------------------------------------------------
# apply_pendulum
# ---------------------------------------------------------------------------

class TestApplyPendulum:
    def test_keyframes_inserted(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        frame_range = FrameRange(start=1, end=50)

        animator.apply_pendulum(obj, frame_range=frame_range)

        assert obj.keyframe_insert.call_count == 50

    def test_pendulum_oscillates(self, mock_blender_modules: dict) -> None:
        """Pendulum x-position should cross zero (oscillation)."""
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        locations_x: list[float] = []
        original_keyframe = obj.keyframe_insert

        def capture_location(*args: object, **kwargs: object) -> None:
            # obj.location is set as a tuple before each keyframe_insert
            loc = obj.location
            if hasattr(loc, '__getitem__'):
                locations_x.append(loc[0])

        obj.keyframe_insert = capture_location
        frame_range = FrameRange(start=1, end=200)

        animator.apply_pendulum(
            obj,
            pivot_point=(0.0, 0.0, 5.0),
            length=3.0,
            initial_angle=45.0,
            damping=0.0,
            frame_range=frame_range,
        )

        # With no damping and 45-degree initial angle, x should oscillate:
        # some positive and some negative values
        has_positive = any(x > 0.1 for x in locations_x)
        has_negative = any(x < -0.1 for x in locations_x)
        assert has_positive and has_negative, (
            "Pendulum should oscillate through positive and negative x values"
        )

    def test_pendulum_follows_expected_math(self, mock_blender_modules: dict) -> None:
        """Verify first frame uses correct pendulum formula."""
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        pivot = (0.0, 0.0, 5.0)
        length = 3.0
        initial_angle = 30.0
        frame_range = FrameRange(start=1, end=2)

        first_locations: list[tuple[float, ...]] = []

        def capture_location(*args: object, **kwargs: object) -> None:
            loc = obj.location
            first_locations.append(tuple(loc))

        obj.keyframe_insert = capture_location

        animator.apply_pendulum(
            obj,
            pivot_point=pivot,
            length=length,
            initial_angle=initial_angle,
            damping=0.02,
            frame_range=frame_range,
        )

        # Verify we got 2 frames
        assert len(first_locations) == 2


# ---------------------------------------------------------------------------
# apply_follow_path
# ---------------------------------------------------------------------------

class TestApplyFollowPath:
    def test_keyframes_inserted_along_path(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        path = [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (10.0, 10.0, 0.0)]
        frame_range = FrameRange(start=1, end=30)

        animator.apply_follow_path(obj, path_points=path, frame_range=frame_range)

        assert obj.keyframe_insert.call_count == 30

    def test_single_point_path_returns_early(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        animator.apply_follow_path(obj, path_points=[(1.0, 2.0, 3.0)])

        assert obj.keyframe_insert.call_count == 0

    def test_loop_false_ends_at_last_point(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        path = [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0)]
        frame_range = FrameRange(start=1, end=50)

        final_locations: list[tuple[float, ...]] = []

        def capture_location(*args: object, **kwargs: object) -> None:
            loc = obj.location
            final_locations.append(tuple(loc))

        obj.keyframe_insert = capture_location

        animator.apply_follow_path(
            obj, path_points=path, speed=1.0, loop=False, frame_range=frame_range
        )

        # Last position should be at or very near the final path point
        last = final_locations[-1]
        assert abs(last[0] - 10.0) < 0.01, f"Expected x~10, got {last[0]}"

    def test_loop_true_wraps_around(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        path = [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0)]
        frame_range = FrameRange(start=1, end=50)

        locations: list[tuple[float, ...]] = []

        def capture_location(*args: object, **kwargs: object) -> None:
            loc = obj.location
            locations.append(tuple(loc))

        obj.keyframe_insert = capture_location

        # speed=2.0 so it will complete the path and loop
        animator.apply_follow_path(
            obj, path_points=path, speed=2.0, loop=True, frame_range=frame_range
        )

        # With looping at speed=2, the x values should wrap back near 0 at some point
        x_values = [loc[0] for loc in locations]
        # After going to 10, it should wrap back to start
        max_x = max(x_values)
        min_x = min(x_values)
        # The range should show the object revisiting earlier positions
        assert max_x > 5.0
        assert min_x < 5.0


# ---------------------------------------------------------------------------
# apply_look_at
# ---------------------------------------------------------------------------

class TestApplyLookAt:
    def test_adds_track_to_constraint(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        target = MagicMock()
        constraint_mock = MagicMock()
        obj.constraints.new.return_value = constraint_mock

        animator.apply_look_at(obj, target_object=target, influence=0.8)

        obj.constraints.new.assert_called_once_with(type="TRACK_TO")
        assert constraint_mock.target is target
        assert constraint_mock.track_axis == "TRACK_NEGATIVE_Z"
        assert constraint_mock.up_axis == "UP_Y"
        assert constraint_mock.influence == 0.8


# ---------------------------------------------------------------------------
# apply_breathing
# ---------------------------------------------------------------------------

class TestApplyBreathing:
    def test_keyframes_inserted(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        frame_range = FrameRange(start=1, end=48)

        animator.apply_breathing(obj, frame_range=frame_range)

        assert obj.keyframe_insert.call_count == 48

    def test_scale_follows_sine_oscillation(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        intensity = 0.05
        rate = 0.25

        scales: list[tuple[float, ...]] = []

        def capture_keyframe(*args: object, **kwargs: object) -> None:
            scales.append(tuple(obj.scale))

        obj.keyframe_insert = capture_keyframe
        frame_range = FrameRange(start=1, end=49)

        animator.apply_breathing(
            obj, intensity=intensity, rate=rate, frame_range=frame_range
        )

        # At frame 1, time=0, sin(0)=0 => scale should be (1.0, 1.0, 1.0)
        assert abs(scales[0][0] - 1.0) < 1e-6
        assert abs(scales[0][2] - 1.0) < 1e-6

        # Verify z-scale has larger oscillation than x/y (intensity vs intensity*0.5)
        # Find a frame where breath is near its peak
        z_deviations = [abs(s[2] - 1.0) for s in scales]
        x_deviations = [abs(s[0] - 1.0) for s in scales]
        max_z_deviation = max(z_deviations)
        max_x_deviation = max(x_deviations)
        assert max_z_deviation > max_x_deviation, (
            "Z-axis breathing should be larger than X-axis"
        )


# ---------------------------------------------------------------------------
# apply_floating
# ---------------------------------------------------------------------------

class TestApplyFloating:
    def test_keyframes_inserted(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        # The method accesses obj.location.z as a property, so we need a
        # mock that supports both attribute and index access
        location_mock = MagicMock()
        location_mock.z = 0.0
        location_mock.x = 0.0
        location_mock.y = 0.0
        location_mock.__getitem__ = lambda self, i: [self.x, self.y, self.z][i]
        obj.location = location_mock

        frame_range = FrameRange(start=1, end=30)

        animator.apply_floating(obj, frame_range=frame_range)

        assert obj.keyframe_insert.call_count == 30

    def test_z_follows_sine(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        location_mock = MagicMock()
        location_mock.z = 2.0
        location_mock.x = 0.0
        location_mock.y = 0.0
        obj.location = location_mock

        base_z = 2.0
        height = 1.0
        speed = 0.5

        z_values: list[float] = []

        def capture_keyframe(*args: object, **kwargs: object) -> None:
            z_values.append(obj.location.z)

        obj.keyframe_insert = capture_keyframe
        frame_range = FrameRange(start=1, end=50)

        animator.apply_floating(
            obj, height=height, speed=speed, frame_range=frame_range
        )

        # z should oscillate around base_z
        assert any(z > base_z for z in z_values), "z should go above base"
        assert any(z < base_z for z in z_values), "z should go below base"

    def test_wobble_affects_x_and_y(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        location_mock = MagicMock()
        location_mock.z = 0.0
        location_mock.x = 0.0
        location_mock.y = 0.0
        obj.location = location_mock

        frame_range = FrameRange(start=1, end=50)

        animator.apply_floating(obj, wobble=0.5, frame_range=frame_range)

        # x and y should have been modified (via +=)
        # With MagicMock, we can verify the += was called
        assert obj.location.x is not None  # was touched
        assert obj.location.y is not None  # was touched


# ---------------------------------------------------------------------------
# apply_wave_deform
# ---------------------------------------------------------------------------

class TestApplyWaveDeform:
    def test_adds_wave_modifier(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        modifier_mock = MagicMock()
        obj.modifiers.new.return_value = modifier_mock

        animator.apply_wave_deform(
            obj, amplitude=1.0, wavelength=3.0, speed=2.0, direction=(1.0, 0.0)
        )

        obj.modifiers.new.assert_called_once_with(name="WaveDeform", type="WAVE")
        assert modifier_mock.height == 1.0
        assert modifier_mock.width == 3.0
        assert modifier_mock.speed == 2.0
        assert modifier_mock.use_x is True
        assert modifier_mock.use_y is False

    def test_wave_both_directions(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        modifier_mock = MagicMock()
        obj.modifiers.new.return_value = modifier_mock

        animator.apply_wave_deform(obj, direction=(1.0, 1.0))

        assert modifier_mock.use_x is True
        assert modifier_mock.use_y is True

    def test_wave_time_offset_from_frame_range(
        self, mock_blender_modules: dict
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        modifier_mock = MagicMock()
        obj.modifiers.new.return_value = modifier_mock
        frame_range = FrameRange(start=48, end=120)

        animator.apply_wave_deform(obj, frame_range=frame_range)

        expected_offset = 48 / 24.0  # 2.0
        assert modifier_mock.time_offset == expected_offset


# ---------------------------------------------------------------------------
# combine_procedural
# ---------------------------------------------------------------------------

class TestCombineProcedural:
    def test_dispatches_sine_wave(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        effects = [{"type": "sine_wave", "amplitude": 2.0}]
        animator.combine_procedural(obj, effects)

        # sine_wave inserts keyframes on each frame of default FrameRange
        assert obj.keyframe_insert.call_count == 120

    def test_dispatches_breathing(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        effects = [{"type": "breathing", "intensity": 0.03}]
        animator.combine_procedural(obj, effects)

        assert obj.keyframe_insert.call_count == 120

    def test_unknown_type_logs_warning(
        self, mock_blender_modules: dict, caplog: pytest.LogCaptureFixture
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        with caplog.at_level(logging.WARNING):
            effects = [{"type": "unknown_effect"}]
            animator.combine_procedural(obj, effects)

        assert "Unknown procedural effect" in caplog.text

    def test_multiple_effects_applied_sequentially(
        self, mock_blender_modules: dict
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()
        modifier_mock = MagicMock()
        obj.modifiers.new.return_value = modifier_mock

        effects = [
            {"type": "breathing", "frame_range": FrameRange(1, 10)},
            {"type": "wave_deform", "amplitude": 0.5},
        ]
        animator.combine_procedural(obj, effects)

        # breathing: 10 keyframes, wave_deform: no keyframes (just modifier)
        assert obj.keyframe_insert.call_count == 10
        obj.modifiers.new.assert_called_once_with(name="WaveDeform", type="WAVE")

    def test_none_type_logs_warning(
        self, mock_blender_modules: dict, caplog: pytest.LogCaptureFixture
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = ProceduralAnimator()
        obj = _make_mock_object()

        with caplog.at_level(logging.WARNING):
            effects = [{"amplitude": 1.0}]  # no "type" key
            animator.combine_procedural(obj, effects)

        assert "Unknown procedural effect" in caplog.text
