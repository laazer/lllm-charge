"""Text-to-3D pipeline: convert natural language descriptions into Blender scenes."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

from blender_pipeline.core.config import LLMConfig
from blender_pipeline.llm_integration._llm_client import call_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a 3D scene generator. Given a text description, output a JSON object describing a 3D scene.

Output format (strict JSON, no markdown):
{
  "objects": [
    {
      "shape": "box|sphere|cylinder|cone|torus|grid",
      "name": "descriptive_name",
      "position": [x, y, z],
      "rotation": [rx, ry, rz],
      "scale": [sx, sy, sz],
      "material": {
        "base_color": [r, g, b, a],
        "metallic": 0.0,
        "roughness": 0.5,
        "emission_strength": 0.0,
        "emission_color": [r, g, b]
      }
    }
  ],
  "lights": [
    {
      "type": "POINT|SUN|SPOT|AREA",
      "position": [x, y, z],
      "intensity": 1000.0,
      "color": [r, g, b]
    }
  ],
  "camera": {
    "position": [x, y, z],
    "look_at": [x, y, z],
    "focal_length": 50.0,
    "sensor_size": 36.0
  }
}

Use reasonable sizes (objects 0.5-5.0 units). Position camera to frame the scene nicely.
Always include at least one light. Use physically plausible material values."""


@dataclass
class MaterialSpec:
    """PBR material specification."""

    base_color: list[float] = field(default_factory=lambda: [0.8, 0.8, 0.8, 1.0])
    metallic: float = 0.0
    roughness: float = 0.5
    emission_strength: float = 0.0
    emission_color: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])


@dataclass
class ObjectSpec:
    """Specification for a single 3D object."""

    shape: str = "box"
    name: str = "Object"
    position: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    rotation: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    scale: list[float] = field(default_factory=lambda: [1.0, 1.0, 1.0])
    material: MaterialSpec = field(default_factory=MaterialSpec)


@dataclass
class LightSpec:
    """Light specification."""

    type: str = "POINT"
    position: list[float] = field(default_factory=lambda: [5.0, 5.0, 5.0])
    intensity: float = 1000.0
    color: list[float] = field(default_factory=lambda: [1.0, 1.0, 1.0])


@dataclass
class CameraSpec:
    """Camera specification."""

    position: list[float] = field(default_factory=lambda: [7.0, -7.0, 5.0])
    look_at: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    focal_length: float = 50.0
    sensor_size: float = 36.0


@dataclass
class SceneDescription:
    """Complete scene specification."""

    objects: list[ObjectSpec] = field(default_factory=list)
    lights: list[LightSpec] = field(default_factory=list)
    camera: CameraSpec = field(default_factory=CameraSpec)

    @classmethod
    def from_dict(cls, data: dict) -> SceneDescription:
        """Parse a SceneDescription from a dictionary (e.g., LLM JSON output)."""
        objects = [
            ObjectSpec(
                shape=obj.get("shape", "box"),
                name=obj.get("name", "Object"),
                position=obj.get("position", [0, 0, 0]),
                rotation=obj.get("rotation", [0, 0, 0]),
                scale=obj.get("scale", [1, 1, 1]),
                material=MaterialSpec(**obj["material"]) if "material" in obj else MaterialSpec(),
            )
            for obj in data.get("objects", [])
        ]
        lights = [
            LightSpec(
                type=lt.get("type", "POINT"),
                position=lt.get("position", [5, 5, 5]),
                intensity=lt.get("intensity", 1000),
                color=lt.get("color", [1, 1, 1]),
            )
            for lt in data.get("lights", [])
        ]
        camera_data = data.get("camera", {})
        camera = CameraSpec(
            position=camera_data.get("position", [7, -7, 5]),
            look_at=camera_data.get("look_at", [0, 0, 0]),
            focal_length=camera_data.get("focal_length", 50),
            sensor_size=camera_data.get("sensor_size", 36),
        )
        return cls(objects=objects, lights=lights, camera=camera)

    def to_dict(self) -> dict:
        return asdict(self)


class TextTo3DGenerator:
    """Converts text descriptions into 3D scenes via LLM."""

    def __init__(self, config: Optional[LLMConfig] = None) -> None:
        self.config = config or LLMConfig()

    def generate_from_description(self, description: str) -> SceneDescription:
        """Send description to LLM and parse the resulting scene JSON."""
        response_text = call_llm(
            self.config, SYSTEM_PROMPT, description
        )
        scene_data = _extract_json(response_text)
        return SceneDescription.from_dict(scene_data)

    def build_scene(self, scene: SceneDescription) -> list[Any]:
        """Create all Blender objects from a SceneDescription."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        created: list[Any] = []

        for obj_spec in scene.objects:
            blender_obj = _create_object(obj_spec)
            _apply_material(blender_obj, obj_spec.material)
            created.append(blender_obj)

        for light_spec in scene.lights:
            light_obj = _create_light(light_spec)
            created.append(light_obj)

        camera_obj = _create_camera(scene.camera)
        created.append(camera_obj)

        return created

    def refine_with_feedback(
        self, scene: SceneDescription, feedback: str
    ) -> SceneDescription:
        """Send current scene + user feedback to LLM for refinement."""
        prompt = (
            f"Current scene:\n{json.dumps(scene.to_dict(), indent=2)}\n\n"
            f"User feedback: {feedback}\n\n"
            "Output the refined scene as JSON in the same format."
        )
        response_text = call_llm(self.config, SYSTEM_PROMPT, prompt)
        scene_data = _extract_json(response_text)
        return SceneDescription.from_dict(scene_data)


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    text = text.strip()
    if "```" in text:
        start = text.find("```")
        first_newline = text.find("\n", start)
        end = text.find("```", first_newline)
        if end > first_newline:
            text = text[first_newline:end].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM JSON: %s", exc)
        return {"objects": [], "lights": [{"type": "SUN", "position": [0, 0, 10], "intensity": 5, "color": [1, 1, 1]}], "camera": {}}


def _create_object(spec: ObjectSpec) -> Any:
    """Create a Blender mesh object from an ObjectSpec."""
    from blender_pipeline.generation.parametric import ParametricGenerator
    generator = ParametricGenerator()
    return generator.generate_from_params({
        "shape": spec.shape,
        "name": spec.name,
        "position": tuple(spec.position),
        "rotation": tuple(spec.rotation),
        "scale": tuple(spec.scale),
    })


def _apply_material(obj: Any, material_spec: MaterialSpec) -> None:
    """Create and apply a PBR material to an object."""
    mat = bpy.data.materials.new(name=f"{obj.name}_material")
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = material_spec.base_color
        principled.inputs["Metallic"].default_value = material_spec.metallic
        principled.inputs["Roughness"].default_value = material_spec.roughness
        if material_spec.emission_strength > 0:
            principled.inputs["Emission Strength"].default_value = material_spec.emission_strength
            principled.inputs["Emission Color"].default_value = [*material_spec.emission_color, 1.0]
    obj.data.materials.append(mat)


def _create_light(spec: LightSpec) -> Any:
    """Create a Blender light from a LightSpec."""
    light_data = bpy.data.lights.new(name="Light", type=spec.type)
    light_data.energy = spec.intensity
    light_data.color = spec.color
    light_obj = bpy.data.objects.new("Light", light_data)
    light_obj.location = spec.position
    bpy.context.collection.objects.link(light_obj)
    return light_obj


def _create_camera(spec: CameraSpec) -> Any:
    """Create a Blender camera from a CameraSpec."""
    import math
    cam_data = bpy.data.cameras.new(name="Camera")
    cam_data.lens = spec.focal_length
    cam_data.sensor_width = spec.sensor_size
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    cam_obj.location = spec.position
    bpy.context.collection.objects.link(cam_obj)

    direction = [spec.look_at[i] - spec.position[i] for i in range(3)]
    length = math.sqrt(sum(d * d for d in direction))
    if length > 0:
        direction = [d / length for d in direction]
        pitch = math.asin(-direction[2])
        yaw = math.atan2(direction[0], direction[1])
        cam_obj.rotation_euler = (pitch + math.pi / 2, 0, yaw)

    bpy.context.scene.camera = cam_obj
    return cam_obj
