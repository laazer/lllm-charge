"""Prompt-driven PBR material generation with built-in presets."""

from __future__ import annotations

import json
import logging
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

logger = logging.getLogger(__name__)

MATERIAL_SYSTEM_PROMPT = """You are a PBR material parameter generator. Given a material description, output JSON:
{
  "base_color": [r, g, b, a],
  "metallic": 0.0-1.0,
  "roughness": 0.0-1.0,
  "specular": 0.0-1.0,
  "subsurface": 0.0-1.0,
  "emission_strength": 0.0+,
  "emission_color": [r, g, b],
  "normal_strength": 0.0-2.0,
  "texture_type": "none|noise|voronoi|wave|musgrave"
}
Use physically accurate values. Output ONLY valid JSON."""


@dataclass
class MaterialParams:
    """PBR material parameters."""

    base_color: list[float] = field(default_factory=lambda: [0.8, 0.8, 0.8, 1.0])
    metallic: float = 0.0
    roughness: float = 0.5
    specular: float = 0.5
    subsurface: float = 0.0
    emission_strength: float = 0.0
    emission_color: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    normal_strength: float = 1.0
    texture_type: str = "none"


MATERIAL_PRESETS: dict[str, MaterialParams] = {
    "wood": MaterialParams(base_color=[0.4, 0.25, 0.13, 1.0], roughness=0.7, texture_type="noise"),
    "metal": MaterialParams(base_color=[0.7, 0.7, 0.72, 1.0], metallic=1.0, roughness=0.3),
    "glass": MaterialParams(base_color=[0.95, 0.95, 0.97, 0.1], metallic=0.0, roughness=0.05, specular=1.0),
    "stone": MaterialParams(base_color=[0.5, 0.48, 0.45, 1.0], roughness=0.85, texture_type="noise"),
    "plastic": MaterialParams(base_color=[0.8, 0.2, 0.2, 1.0], roughness=0.4, specular=0.5),
    "fabric": MaterialParams(base_color=[0.3, 0.3, 0.6, 1.0], roughness=0.95, subsurface=0.1, texture_type="noise"),
    "rubber": MaterialParams(base_color=[0.15, 0.15, 0.15, 1.0], roughness=0.9, specular=0.2),
    "ceramic": MaterialParams(base_color=[0.9, 0.88, 0.85, 1.0], roughness=0.2, specular=0.8),
    "gold": MaterialParams(base_color=[1.0, 0.77, 0.34, 1.0], metallic=1.0, roughness=0.2),
    "silver": MaterialParams(base_color=[0.95, 0.93, 0.88, 1.0], metallic=1.0, roughness=0.15),
    "copper": MaterialParams(base_color=[0.72, 0.45, 0.2, 1.0], metallic=1.0, roughness=0.35),
    "marble": MaterialParams(base_color=[0.92, 0.9, 0.88, 1.0], roughness=0.15, specular=0.7, texture_type="voronoi"),
    "concrete": MaterialParams(base_color=[0.6, 0.58, 0.55, 1.0], roughness=0.95, texture_type="noise"),
    "brick": MaterialParams(base_color=[0.6, 0.2, 0.12, 1.0], roughness=0.85, texture_type="voronoi"),
    "leather": MaterialParams(base_color=[0.35, 0.2, 0.1, 1.0], roughness=0.7, subsurface=0.05, texture_type="noise"),
    "ice": MaterialParams(base_color=[0.7, 0.85, 0.95, 0.6], roughness=0.1, specular=0.9, subsurface=0.3),
    "water": MaterialParams(base_color=[0.1, 0.3, 0.5, 0.3], roughness=0.02, specular=1.0),
    "lava": MaterialParams(base_color=[0.1, 0.02, 0.0, 1.0], roughness=0.8, emission_strength=5.0, emission_color=[1.0, 0.3, 0.0], texture_type="noise"),
    "neon": MaterialParams(base_color=[0.0, 1.0, 0.5, 1.0], emission_strength=10.0, emission_color=[0.0, 1.0, 0.5]),
    "holographic": MaterialParams(base_color=[0.5, 0.3, 0.8, 0.7], metallic=0.8, roughness=0.1, specular=1.0, emission_strength=1.0, emission_color=[0.5, 0.3, 0.8]),
}


class MaterialGenerator:
    """Generates PBR materials from text descriptions, using presets when possible."""

    def __init__(self, config: Optional[LLMConfig] = None) -> None:
        self.config = config or LLMConfig()

    def try_preset_first(self, description: str) -> Optional[MaterialParams]:
        """Check if the description matches a built-in preset (avoids LLM call)."""
        description_lower = description.lower().strip()
        for preset_name, params in MATERIAL_PRESETS.items():
            if preset_name in description_lower:
                return params
        return None

    def generate_material(self, description: str) -> MaterialParams:
        """Generate material parameters — tries preset first, falls back to LLM."""
        preset = self.try_preset_first(description)
        if preset:
            logger.info("Using preset material for: %s", description)
            return preset

        response_text = call_llm(self.config, MATERIAL_SYSTEM_PROMPT, description)
        return _parse_material_params(response_text)

    def create_blender_material(
        self,
        params: MaterialParams,
        name: str = "GeneratedMaterial",
    ) -> Any:
        """Create a Blender material node tree from MaterialParams."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        principled = nodes.get("Principled BSDF")
        if not principled:
            principled = nodes.new("ShaderNodeBsdfPrincipled")

        principled.inputs["Base Color"].default_value = params.base_color
        principled.inputs["Metallic"].default_value = params.metallic
        principled.inputs["Roughness"].default_value = params.roughness
        principled.inputs["Specular IOR Level"].default_value = params.specular
        principled.inputs["Subsurface Weight"].default_value = params.subsurface

        if params.emission_strength > 0:
            principled.inputs["Emission Strength"].default_value = params.emission_strength
            principled.inputs["Emission Color"].default_value = [*params.emission_color, 1.0]

        if params.texture_type != "none":
            texture_node = self._create_procedural_texture(nodes, params.texture_type)
            if texture_node:
                coord_node = nodes.new("ShaderNodeTexCoord")
                mapping_node = nodes.new("ShaderNodeMapping")
                links.new(coord_node.outputs["Object"], mapping_node.inputs["Vector"])
                links.new(mapping_node.outputs["Vector"], texture_node.inputs["Vector"])

                mix_node = nodes.new("ShaderNodeMixRGB")
                mix_node.inputs["Color1"].default_value = params.base_color
                mix_node.inputs["Color2"].default_value = [
                    min(1.0, c * 1.3) for c in params.base_color[:3]
                ] + [1.0]
                mix_node.inputs["Fac"].default_value = 0.3
                links.new(texture_node.outputs[0], mix_node.inputs["Fac"])
                links.new(mix_node.outputs["Color"], principled.inputs["Base Color"])

        return mat

    def _create_procedural_texture(self, nodes: Any, texture_type: str) -> Any:
        """Create a procedural texture node."""
        texture_map = {
            "noise": "ShaderNodeTexNoise",
            "voronoi": "ShaderNodeTexVoronoi",
            "wave": "ShaderNodeTexWave",
            "musgrave": "ShaderNodeTexMusgrave",
        }
        node_type = texture_map.get(texture_type)
        if not node_type:
            return None
        return nodes.new(node_type)

    def apply_material(self, obj: Any, material: Any) -> None:
        """Apply a Blender material to an object."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")
        if obj.data.materials:
            obj.data.materials[0] = material
        else:
            obj.data.materials.append(material)


def _parse_material_params(response_text: str) -> MaterialParams:
    """Parse MaterialParams from LLM response text."""
    text = response_text.strip()
    if "```" in text:
        start = text.find("```")
        first_newline = text.find("\n", start)
        end = text.find("```", first_newline)
        if end > first_newline:
            text = text[first_newline:end].strip()
    try:
        data = json.loads(text)
        return MaterialParams(
            base_color=data.get("base_color", [0.8, 0.8, 0.8, 1.0]),
            metallic=data.get("metallic", 0.0),
            roughness=data.get("roughness", 0.5),
            specular=data.get("specular", 0.5),
            subsurface=data.get("subsurface", 0.0),
            emission_strength=data.get("emission_strength", 0.0),
            emission_color=data.get("emission_color", [0.0, 0.0, 0.0]),
            normal_strength=data.get("normal_strength", 1.0),
            texture_type=data.get("texture_type", "none"),
        )
    except (json.JSONDecodeError, TypeError) as exc:
        logger.error("Failed to parse material params: %s", exc)
        return MaterialParams()
