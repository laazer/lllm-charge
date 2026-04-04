"""Tests for PhysicsAnimator — runs without Blender by mocking bpy."""

from __future__ import annotations

from unittest.mock import MagicMock, PropertyMock

import pytest

import blender_pipeline.animation.physics as physics_mod
from blender_pipeline.animation.physics import (
    BUILT_IN_PRESETS,
    PhysicsAnimator,
    PhysicsPreset,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enable_bpy(mock_blender_modules: dict) -> MagicMock:
    """Patch the module-level flag and bpy reference, return mock_bpy."""
    physics_mod.HAS_BPY = True
    physics_mod.bpy = mock_blender_modules["bpy"]
    return mock_blender_modules["bpy"]


def _make_mock_object() -> MagicMock:
    """Return a mock Blender object with rigid_body, modifiers, etc."""
    obj = MagicMock()
    obj.rigid_body = MagicMock()
    obj.modifiers = MagicMock()
    obj.particle_systems = MagicMock()
    obj.particle_systems.__getitem__ = MagicMock(return_value=MagicMock())
    return obj


# ---------------------------------------------------------------------------
# BUILT_IN_PRESETS
# ---------------------------------------------------------------------------

class TestBuiltInPresets:
    def test_all_five_presets_present(self) -> None:
        expected_names = {"dropping", "bouncing_ball", "curtain", "flag_wind", "demolition"}
        assert set(BUILT_IN_PRESETS.keys()) == expected_names

    def test_dropping_is_rigid_body(self) -> None:
        assert BUILT_IN_PRESETS["dropping"].physics_type == "rigid_body"

    def test_bouncing_ball_is_rigid_body(self) -> None:
        assert BUILT_IN_PRESETS["bouncing_ball"].physics_type == "rigid_body"

    def test_curtain_is_cloth(self) -> None:
        assert BUILT_IN_PRESETS["curtain"].physics_type == "cloth"

    def test_flag_wind_is_cloth(self) -> None:
        assert BUILT_IN_PRESETS["flag_wind"].physics_type == "cloth"

    def test_demolition_is_rigid_body(self) -> None:
        assert BUILT_IN_PRESETS["demolition"].physics_type == "rigid_body"

    def test_preset_dataclass_fields(self) -> None:
        preset = BUILT_IN_PRESETS["bouncing_ball"]
        assert preset.mass == 0.5
        assert preset.bounciness == 0.9
        assert preset.friction == 0.3


# ---------------------------------------------------------------------------
# _require_bpy
# ---------------------------------------------------------------------------

class TestRequireBpy:
    def test_raises_when_bpy_unavailable(self, mock_blender_modules: dict) -> None:
        physics_mod.HAS_BPY = False
        animator = PhysicsAnimator()
        with pytest.raises(RuntimeError, match="bpy is not available"):
            animator._require_bpy()

    def test_does_not_raise_when_bpy_available(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        animator._require_bpy()  # should not raise


# ---------------------------------------------------------------------------
# _select_only
# ---------------------------------------------------------------------------

class TestSelectOnly:
    def test_deselects_all_then_selects_target(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = MagicMock()

        animator._select_only(obj)

        mock_bpy.ops.object.select_all.assert_called_once_with(action="DESELECT")
        obj.select_set.assert_called_once_with(True)
        assert mock_bpy.context.view_layer.objects.active == obj


# ---------------------------------------------------------------------------
# setup_rigid_body
# ---------------------------------------------------------------------------

class TestSetupRigidBody:
    def test_calls_rigidbody_object_add(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_rigid_body(obj, mass=2.0, friction=0.4, bounciness=0.7)

        mock_bpy.ops.rigidbody.object_add.assert_called_once_with(type="ACTIVE")

    def test_sets_mass_friction_bounciness(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_rigid_body(obj, mass=2.0, friction=0.4, bounciness=0.7)

        assert obj.rigid_body.mass == 2.0
        assert obj.rigid_body.friction == 0.4
        assert obj.rigid_body.restitution == 0.7

    def test_default_body_type_is_active(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_rigid_body(obj)

        mock_bpy.ops.rigidbody.object_add.assert_called_once_with(type="ACTIVE")

    def test_passive_body_type(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_rigid_body(obj, body_type="PASSIVE")

        mock_bpy.ops.rigidbody.object_add.assert_called_once_with(type="PASSIVE")


# ---------------------------------------------------------------------------
# setup_cloth_sim
# ---------------------------------------------------------------------------

class TestSetupClothSim:
    def test_adds_cloth_modifier(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_cloth_sim(obj, quality=8, mass=0.5, stiffness=10.0, damping=3.0)

        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="CLOTH")

    def test_configures_cloth_settings(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()
        cloth_mock = MagicMock()
        obj.modifiers.__getitem__ = MagicMock(return_value=cloth_mock)

        animator.setup_cloth_sim(obj, quality=8, mass=0.5, stiffness=10.0, damping=3.0)

        assert cloth_mock.settings.quality == 8
        assert cloth_mock.settings.mass == 0.5
        assert cloth_mock.settings.tension_stiffness == 10.0
        assert cloth_mock.settings.tension_damping == 3.0


# ---------------------------------------------------------------------------
# setup_soft_body
# ---------------------------------------------------------------------------

class TestSetupSoftBody:
    def test_adds_soft_body_modifier(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_soft_body(obj, mass=2.0, friction=0.6, speed=1.5)

        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="SOFT_BODY")

    def test_configures_soft_body_settings(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()
        soft_mock = MagicMock()
        obj.modifiers.__getitem__ = MagicMock(return_value=soft_mock)

        animator.setup_soft_body(obj, mass=2.0, friction=0.6, speed=1.5)

        assert soft_mock.settings.mass == 2.0
        assert soft_mock.settings.friction == 0.6
        assert soft_mock.settings.speed == 1.5


# ---------------------------------------------------------------------------
# setup_fluid_sim
# ---------------------------------------------------------------------------

class TestSetupFluidSim:
    def test_adds_fluid_modifier(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.setup_fluid_sim(obj, sim_type="DOMAIN", resolution=128)

        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="FLUID")

    def test_domain_resolution_set(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()
        fluid_mock = MagicMock()
        obj.modifiers.__getitem__ = MagicMock(return_value=fluid_mock)

        animator.setup_fluid_sim(obj, sim_type="DOMAIN", resolution=128)

        assert fluid_mock.fluid_type == "DOMAIN"
        assert fluid_mock.domain_settings.resolution_max == 128

    def test_non_domain_skips_resolution(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        # Use a fresh MagicMock with spec-less domain_settings so we can
        # detect whether resolution_max was explicitly assigned.
        class _TrackedSettings:
            def __init__(self) -> None:
                self.resolution_max_was_set = False
                self._resolution_max = None

            @property
            def resolution_max(self) -> object:
                return self._resolution_max

            @resolution_max.setter
            def resolution_max(self, value: object) -> None:
                self.resolution_max_was_set = True
                self._resolution_max = value

        fluid_mock = MagicMock()
        tracked = _TrackedSettings()
        fluid_mock.domain_settings = tracked
        obj.modifiers.__getitem__ = MagicMock(return_value=fluid_mock)

        animator.setup_fluid_sim(obj, sim_type="FLOW", resolution=128)

        assert fluid_mock.fluid_type == "FLOW"
        assert not tracked.resolution_max_was_set, (
            "domain_settings.resolution_max should not be set for non-DOMAIN types"
        )


# ---------------------------------------------------------------------------
# create_collision_ground
# ---------------------------------------------------------------------------

class TestCreateCollisionGround:
    def test_creates_plane_and_passive_rigid_body(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        ground_obj = MagicMock()
        ground_obj.rigid_body = MagicMock()
        mock_bpy.context.active_object = ground_obj

        animator = PhysicsAnimator()
        result = animator.create_collision_ground(size=15.0, friction=0.9)

        mock_bpy.ops.mesh.primitive_plane_add.assert_called_once_with(
            size=15.0, location=(0, 0, 0)
        )
        mock_bpy.ops.rigidbody.object_add.assert_called_once_with(type="PASSIVE")
        assert ground_obj.rigid_body.friction == 0.9
        assert ground_obj.rigid_body.restitution == 0.3
        assert ground_obj.name == "CollisionGround"
        assert result is ground_obj


# ---------------------------------------------------------------------------
# bake_physics
# ---------------------------------------------------------------------------

class TestBakePhysics:
    def test_sets_frame_range_and_bakes(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.bake_physics(start_frame=10, end_frame=200, obj=obj)

        assert mock_bpy.context.scene.frame_start == 10
        assert mock_bpy.context.scene.frame_end == 200
        mock_bpy.ops.ptcache.bake_all.assert_called_once_with(bake=True)

    def test_bake_without_obj(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()

        animator.bake_physics(start_frame=1, end_frame=100)

        mock_bpy.ops.ptcache.bake_all.assert_called_once_with(bake=True)


# ---------------------------------------------------------------------------
# create_explosion
# ---------------------------------------------------------------------------

class TestCreateExplosion:
    def test_adds_particle_system_with_correct_settings(
        self, mock_blender_modules: dict
    ) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()
        particle_system = MagicMock()
        settings = MagicMock()
        particle_system.settings = settings
        obj.particle_systems.__getitem__ = MagicMock(return_value=particle_system)

        mock_bpy = mock_blender_modules["bpy"]
        result = animator.create_explosion(obj, pieces=30, force=15.0, seed=7)

        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="PARTICLE_SYSTEM")
        assert settings.count == 30
        assert settings.lifetime == 100
        assert settings.normal_factor == 15.0
        assert settings.emit_from == "FACE"
        assert settings.physics_type == "NEWTON"
        assert settings.render_type == "OBJECT"
        assert settings.use_rotations is True
        assert settings.use_modifier_stack is True
        assert result == [obj]


# ---------------------------------------------------------------------------
# create_rain
# ---------------------------------------------------------------------------

class TestCreateRain:
    def test_creates_emitter_plane_and_configures_particles(
        self, mock_blender_modules: dict
    ) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        emitter = MagicMock()
        particle_system = MagicMock()
        settings = MagicMock()
        particle_system.settings = settings
        emitter.particle_systems.__getitem__ = MagicMock(return_value=particle_system)
        mock_bpy.context.active_object = emitter

        animator = PhysicsAnimator()
        result = animator.create_rain(
            area_size=8.0, particle_count=500, speed=3.0, lifetime=40
        )

        mock_bpy.ops.mesh.primitive_plane_add.assert_called_once_with(
            size=8.0, location=(0, 0, 10)
        )
        assert emitter.name == "RainEmitter"
        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="PARTICLE_SYSTEM")
        assert settings.count == 500
        assert settings.lifetime == 40
        assert settings.normal_factor == -3.0
        assert settings.emit_from == "FACE"
        assert settings.physics_type == "NEWTON"
        assert settings.effector_weights.gravity == 1.0
        assert result is emitter


# ---------------------------------------------------------------------------
# apply_preset
# ---------------------------------------------------------------------------

class TestApplyPreset:
    def test_unknown_preset_raises_key_error(self, mock_blender_modules: dict) -> None:
        _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        with pytest.raises(KeyError, match="nonexistent"):
            animator.apply_preset(obj, "nonexistent")

    def test_dropping_dispatches_to_rigid_body(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.apply_preset(obj, "dropping")

        mock_bpy.ops.rigidbody.object_add.assert_called_once()
        assert obj.rigid_body.mass == 1.0

    def test_bouncing_ball_dispatches_to_rigid_body(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.apply_preset(obj, "bouncing_ball")

        mock_bpy.ops.rigidbody.object_add.assert_called_once()
        assert obj.rigid_body.restitution == 0.9

    def test_curtain_dispatches_to_cloth(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()
        cloth_mock = MagicMock()
        obj.modifiers.__getitem__ = MagicMock(return_value=cloth_mock)

        animator.apply_preset(obj, "curtain")

        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="CLOTH")
        assert cloth_mock.settings.mass == 0.3

    def test_flag_wind_dispatches_to_cloth(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()
        cloth_mock = MagicMock()
        obj.modifiers.__getitem__ = MagicMock(return_value=cloth_mock)

        animator.apply_preset(obj, "flag_wind")

        mock_bpy.ops.object.modifier_add.assert_called_once_with(type="CLOTH")
        assert cloth_mock.settings.tension_stiffness == 10.0

    def test_demolition_dispatches_to_rigid_body(self, mock_blender_modules: dict) -> None:
        mock_bpy = _enable_bpy(mock_blender_modules)
        animator = PhysicsAnimator()
        obj = _make_mock_object()

        animator.apply_preset(obj, "demolition")

        mock_bpy.ops.rigidbody.object_add.assert_called_once()
        assert obj.rigid_body.mass == 5.0
        assert obj.rigid_body.friction == 0.8
        assert obj.rigid_body.restitution == 0.1
