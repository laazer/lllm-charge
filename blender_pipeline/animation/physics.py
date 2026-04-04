"""Physics-driven animation setup and baking."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class PhysicsPreset:
    """Predefined physics simulation configuration."""

    name: str
    physics_type: str
    mass: float = 1.0
    friction: float = 0.5
    bounciness: float = 0.5
    stiffness: float = 1.0
    damping: float = 0.1
    body_type: str = "ACTIVE"


BUILT_IN_PRESETS: dict[str, PhysicsPreset] = {
    "dropping": PhysicsPreset("dropping", "rigid_body", mass=1.0, friction=0.5, bounciness=0.3),
    "bouncing_ball": PhysicsPreset("bouncing_ball", "rigid_body", mass=0.5, friction=0.3, bounciness=0.9),
    "curtain": PhysicsPreset("curtain", "cloth", mass=0.3, stiffness=5.0, damping=5.0),
    "flag_wind": PhysicsPreset("flag_wind", "cloth", mass=0.15, stiffness=10.0, damping=2.0),
    "demolition": PhysicsPreset("demolition", "rigid_body", mass=5.0, friction=0.8, bounciness=0.1),
}


class PhysicsAnimator:
    """Sets up and bakes physics simulations in Blender."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def _select_only(self, obj: Any) -> None:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

    def setup_rigid_body(
        self,
        obj: Any,
        mass: float = 1.0,
        friction: float = 0.5,
        bounciness: float = 0.5,
        body_type: str = "ACTIVE",
    ) -> None:
        """Add a rigid body simulation to an object."""
        self._require_bpy()
        self._select_only(obj)
        bpy.ops.rigidbody.object_add(type=body_type)
        obj.rigid_body.mass = mass
        obj.rigid_body.friction = friction
        obj.rigid_body.restitution = bounciness

    def setup_cloth_sim(
        self,
        obj: Any,
        quality: int = 5,
        mass: float = 0.3,
        stiffness: float = 5.0,
        damping: float = 5.0,
    ) -> None:
        """Add a cloth simulation to a mesh object."""
        self._require_bpy()
        self._select_only(obj)
        bpy.ops.object.modifier_add(type="CLOTH")
        cloth = obj.modifiers["Cloth"]
        cloth.settings.quality = quality
        cloth.settings.mass = mass
        cloth.settings.tension_stiffness = stiffness
        cloth.settings.tension_damping = damping

    def setup_soft_body(
        self,
        obj: Any,
        mass: float = 1.0,
        friction: float = 0.5,
        speed: float = 1.0,
    ) -> None:
        """Add a soft body simulation to an object."""
        self._require_bpy()
        self._select_only(obj)
        bpy.ops.object.modifier_add(type="SOFT_BODY")
        soft = obj.modifiers["Softbody"]
        soft.settings.mass = mass
        soft.settings.friction = friction
        soft.settings.speed = speed

    def setup_fluid_sim(
        self,
        obj: Any,
        sim_type: str = "DOMAIN",
        resolution: int = 64,
    ) -> None:
        """Add a fluid simulation to an object."""
        self._require_bpy()
        self._select_only(obj)
        bpy.ops.object.modifier_add(type="FLUID")
        fluid = obj.modifiers["Fluid"]
        fluid.fluid_type = sim_type
        if sim_type == "DOMAIN":
            fluid.domain_settings.resolution_max = resolution

    def create_collision_ground(
        self,
        size: float = 20.0,
        friction: float = 0.8,
    ) -> Any:
        """Create a ground plane with passive rigid body for collisions."""
        self._require_bpy()
        bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
        ground = bpy.context.active_object
        ground.name = "CollisionGround"
        bpy.ops.rigidbody.object_add(type="PASSIVE")
        ground.rigid_body.friction = friction
        ground.rigid_body.restitution = 0.3
        return ground

    def bake_physics(
        self,
        start_frame: int = 1,
        end_frame: int = 250,
        obj: Optional[Any] = None,
    ) -> None:
        """Bake the physics simulation to keyframes."""
        self._require_bpy()
        bpy.context.scene.frame_start = start_frame
        bpy.context.scene.frame_end = end_frame
        if obj:
            self._select_only(obj)
        override = bpy.context.copy()
        override["point_cache"] = obj.rigid_body if obj and obj.rigid_body else None
        bpy.ops.ptcache.bake_all(bake=True)

    def create_explosion(
        self,
        center_object: Any,
        pieces: int = 20,
        force: float = 10.0,
        seed: int = 42,
    ) -> list[Any]:
        """Fracture an object and apply outward force to simulate an explosion."""
        self._require_bpy()
        self._select_only(center_object)

        bpy.ops.object.modifier_add(type="PARTICLE_SYSTEM")
        particle_system = center_object.particle_systems[-1]
        settings = particle_system.settings
        settings.count = pieces
        settings.lifetime = 100
        settings.normal_factor = force
        settings.emit_from = "FACE"
        settings.physics_type = "NEWTON"
        settings.render_type = "OBJECT"
        settings.use_rotations = True
        settings.use_modifier_stack = True

        return [center_object]

    def create_rain(
        self,
        area_size: float = 10.0,
        particle_count: int = 1000,
        speed: float = 5.0,
        lifetime: int = 60,
    ) -> Any:
        """Create a particle-based rain effect."""
        self._require_bpy()
        bpy.ops.mesh.primitive_plane_add(size=area_size, location=(0, 0, 10))
        emitter = bpy.context.active_object
        emitter.name = "RainEmitter"

        bpy.ops.object.modifier_add(type="PARTICLE_SYSTEM")
        particle_system = emitter.particle_systems[-1]
        settings = particle_system.settings
        settings.count = particle_count
        settings.lifetime = lifetime
        settings.normal_factor = -speed
        settings.emit_from = "FACE"
        settings.physics_type = "NEWTON"
        settings.effector_weights.gravity = 1.0

        return emitter

    def apply_preset(self, obj: Any, preset_name: str) -> None:
        """Apply a built-in physics preset to an object."""
        if preset_name not in BUILT_IN_PRESETS:
            raise KeyError(f"Preset '{preset_name}' not found. Available: {list(BUILT_IN_PRESETS)}")
        preset = BUILT_IN_PRESETS[preset_name]
        if preset.physics_type == "rigid_body":
            self.setup_rigid_body(obj, preset.mass, preset.friction, preset.bounciness, preset.body_type)
        elif preset.physics_type == "cloth":
            self.setup_cloth_sim(obj, mass=preset.mass, stiffness=preset.stiffness, damping=preset.damping)
        elif preset.physics_type == "soft_body":
            self.setup_soft_body(obj, mass=preset.mass, friction=preset.friction)
