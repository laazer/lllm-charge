"""Scene composition from text — lighting, camera, layout, environment."""

from __future__ import annotations

import json
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

from blender_pipeline.core.config import LLMConfig
from blender_pipeline.llm_integration._llm_client import call_llm
from blender_pipeline.llm_integration.text_to_3d import SceneDescription, TextTo3DGenerator

logger = logging.getLogger(__name__)

SCENE_SYSTEM_PROMPT = """You are a 3D scene layout composer. Given a description, output a complete scene layout as JSON:
{
  "objects": [{"shape": "...", "name": "...", "position": [x,y,z], "rotation": [rx,ry,rz], "scale": [sx,sy,sz]}],
  "lighting_style": "studio_3point|dramatic|natural_outdoor|sunset|moonlight|neon",
  "camera_style": "front|three_quarter|top_down|dramatic_low|close_up|wide",
  "layout": "grid|circle|random_scatter|line|pyramid",
  "environment": {
    "type": "studio|outdoor|indoor",
    "ambient_color": [r, g, b],
    "background_color": [r, g, b, a]
  }
}
Output ONLY valid JSON."""


@dataclass
class EnvironmentSpec:
    """Scene environment configuration."""

    type: str = "studio"
    hdri_path: Optional[str] = None
    ambient_color: list[float] = field(default_factory=lambda: [0.05, 0.05, 0.08])
    fog_density: float = 0.0
    background_color: list[float] = field(default_factory=lambda: [0.05, 0.05, 0.08, 1.0])


@dataclass
class WorldSettings:
    """Blender world settings."""

    background_color: list[float] = field(default_factory=lambda: [0.05, 0.05, 0.08, 1.0])
    ambient_occlusion: bool = True
    bloom: bool = False
    volumetrics: bool = False


# ── Lighting presets ────────────────────────────────────────────────

LIGHTING_PRESETS: dict[str, list[dict]] = {
    "studio_3point": [
        {"type": "AREA", "position": [4, -3, 5], "intensity": 500, "color": [1.0, 0.95, 0.9]},
        {"type": "AREA", "position": [-3, -2, 3], "intensity": 200, "color": [0.8, 0.85, 1.0]},
        {"type": "AREA", "position": [0, 4, 2], "intensity": 100, "color": [0.9, 0.9, 0.95]},
    ],
    "dramatic": [
        {"type": "SPOT", "position": [3, -1, 6], "intensity": 1000, "color": [1.0, 0.9, 0.7]},
        {"type": "POINT", "position": [-4, 2, 1], "intensity": 50, "color": [0.3, 0.4, 0.8]},
    ],
    "natural_outdoor": [
        {"type": "SUN", "position": [5, 5, 10], "intensity": 5, "color": [1.0, 0.98, 0.95]},
        {"type": "AREA", "position": [0, 0, 8], "intensity": 100, "color": [0.6, 0.7, 1.0]},
    ],
    "sunset": [
        {"type": "SUN", "position": [10, 0, 2], "intensity": 3, "color": [1.0, 0.6, 0.3]},
        {"type": "AREA", "position": [-5, 0, 5], "intensity": 50, "color": [0.3, 0.3, 0.6]},
    ],
    "moonlight": [
        {"type": "SUN", "position": [-3, 5, 8], "intensity": 1, "color": [0.7, 0.8, 1.0]},
        {"type": "POINT", "position": [0, 0, 3], "intensity": 20, "color": [0.5, 0.6, 0.8]},
    ],
    "neon": [
        {"type": "POINT", "position": [3, 0, 2], "intensity": 300, "color": [1.0, 0.0, 0.5]},
        {"type": "POINT", "position": [-3, 0, 2], "intensity": 300, "color": [0.0, 0.5, 1.0]},
        {"type": "POINT", "position": [0, 3, 2], "intensity": 200, "color": [0.0, 1.0, 0.5]},
    ],
}

CAMERA_PRESETS: dict[str, dict] = {
    "front": {"position": [0, -8, 3], "look_at": [0, 0, 1]},
    "three_quarter": {"position": [6, -6, 4], "look_at": [0, 0, 1]},
    "top_down": {"position": [0, 0, 12], "look_at": [0, 0, 0]},
    "dramatic_low": {"position": [5, -3, 0.5], "look_at": [0, 0, 2]},
    "close_up": {"position": [2, -2, 2], "look_at": [0, 0, 1]},
    "wide": {"position": [12, -12, 8], "look_at": [0, 0, 0]},
}


class SceneComposer:
    """Composes complete 3D scenes from text descriptions."""

    def __init__(self, config: Optional[LLMConfig] = None) -> None:
        self.config = config or LLMConfig()
        self._generator = TextTo3DGenerator(config)

    def compose_scene(self, description: str) -> list[Any]:
        """Create a complete scene from a text description using LLM."""
        scene_desc = self._generator.generate_from_description(description)
        return self._generator.build_scene(scene_desc)

    def auto_light_scene(
        self,
        objects: list[Any],
        style: str = "studio_3point",
    ) -> list[Any]:
        """Add lighting to the scene using a named preset."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        if style not in LIGHTING_PRESETS:
            logger.warning("Unknown lighting style '%s', using studio_3point", style)
            style = "studio_3point"

        created_lights: list[Any] = []
        for light_def in LIGHTING_PRESETS[style]:
            light_data = bpy.data.lights.new(name=f"Light_{style}", type=light_def["type"])
            light_data.energy = light_def["intensity"]
            light_data.color = light_def["color"]
            light_obj = bpy.data.objects.new(f"Light_{style}", light_data)
            light_obj.location = light_def["position"]
            bpy.context.collection.objects.link(light_obj)
            created_lights.append(light_obj)

        return created_lights

    def auto_camera(
        self,
        objects: list[Any],
        style: str = "three_quarter",
    ) -> Any:
        """Position camera using a named preset, framing the given objects."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        if style not in CAMERA_PRESETS:
            logger.warning("Unknown camera style '%s', using three_quarter", style)
            style = "three_quarter"

        preset = CAMERA_PRESETS[style]
        cam_data = bpy.data.cameras.new(name="AutoCamera")
        cam_data.lens = 50
        cam_obj = bpy.data.objects.new("AutoCamera", cam_data)
        cam_obj.location = preset["position"]
        bpy.context.collection.objects.link(cam_obj)
        bpy.context.scene.camera = cam_obj

        look_at = preset["look_at"]
        direction = [look_at[i] - preset["position"][i] for i in range(3)]
        length = math.sqrt(sum(d * d for d in direction))
        if length > 0:
            direction = [d / length for d in direction]
            pitch = math.asin(-direction[2])
            yaw = math.atan2(direction[0], direction[1])
            cam_obj.rotation_euler = (pitch + math.pi / 2, 0, yaw)

        return cam_obj

    def arrange_objects(
        self,
        objects: list[Any],
        layout: str = "grid",
        spacing: float = 3.0,
    ) -> None:
        """Arrange objects in a layout pattern."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        layout_functions = {
            "grid": self._layout_grid,
            "circle": self._layout_circle,
            "random_scatter": self._layout_random_scatter,
            "line": self._layout_line,
            "pyramid": self._layout_pyramid,
        }
        layout_function = layout_functions.get(layout, self._layout_grid)
        layout_function(objects, spacing)

    def setup_environment(self, environment: EnvironmentSpec) -> None:
        """Configure the Blender world environment."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        world = bpy.context.scene.world
        if not world:
            world = bpy.data.worlds.new("World")
            bpy.context.scene.world = world

        world.use_nodes = True
        background = world.node_tree.nodes.get("Background")
        if background:
            background.inputs["Color"].default_value = environment.background_color
            background.inputs["Strength"].default_value = 1.0

    def setup_world(self, settings: WorldSettings) -> None:
        """Apply world settings to the scene."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        self.setup_environment(EnvironmentSpec(background_color=settings.background_color))

        if hasattr(bpy.context.scene, "eevee"):
            bpy.context.scene.eevee.use_gtao = settings.ambient_occlusion
            bpy.context.scene.eevee.use_bloom = settings.bloom
            bpy.context.scene.eevee.use_volumetric_lights = settings.volumetrics

    # ── Layout implementations ──────────────────────────────────────

    def _layout_grid(self, objects: list[Any], spacing: float) -> None:
        cols = max(1, int(math.ceil(math.sqrt(len(objects)))))
        for index, obj in enumerate(objects):
            row = index // cols
            col = index % cols
            obj.location = (col * spacing, row * spacing, 0)

    def _layout_circle(self, objects: list[Any], spacing: float) -> None:
        radius = spacing * len(objects) / (2 * math.pi) if len(objects) > 1 else spacing
        for index, obj in enumerate(objects):
            angle = 2 * math.pi * index / len(objects)
            obj.location = (radius * math.cos(angle), radius * math.sin(angle), 0)

    def _layout_random_scatter(self, objects: list[Any], spacing: float) -> None:
        import random
        rng = random.Random(42)
        area = spacing * max(1, int(math.sqrt(len(objects))))
        for obj in objects:
            obj.location = (
                rng.uniform(-area, area),
                rng.uniform(-area, area),
                0,
            )

    def _layout_line(self, objects: list[Any], spacing: float) -> None:
        for index, obj in enumerate(objects):
            obj.location = (index * spacing, 0, 0)

    def _layout_pyramid(self, objects: list[Any], spacing: float) -> None:
        placed = 0
        level = 0
        while placed < len(objects):
            items_in_level = max(1, len(objects) - placed) if level > 3 else (level + 1) ** 2
            items_in_level = min(items_in_level, len(objects) - placed)
            cols = max(1, int(math.ceil(math.sqrt(items_in_level))))
            for i in range(items_in_level):
                if placed >= len(objects):
                    break
                row = i // cols
                col = i % cols
                offset = -(cols - 1) * spacing / 2
                objects[placed].location = (
                    offset + col * spacing,
                    offset + row * spacing,
                    level * spacing,
                )
                placed += 1
            level += 1
