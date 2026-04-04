"""LLM-powered 3D generation — text-to-3D, materials, animation, scene composition."""

from blender_pipeline.llm_integration.text_to_3d import (
    TextTo3DGenerator,
    SceneDescription,
    ObjectSpec,
    LightSpec,
    CameraSpec,
    MaterialSpec,
)
from blender_pipeline.llm_integration.material_from_prompt import MaterialGenerator
from blender_pipeline.llm_integration.animation_from_text import AnimationInterpreter, AnimationSequence
from blender_pipeline.llm_integration.scene_composer import SceneComposer

__all__ = [
    "TextTo3DGenerator",
    "SceneDescription",
    "ObjectSpec",
    "LightSpec",
    "CameraSpec",
    "MaterialSpec",
    "MaterialGenerator",
    "AnimationInterpreter",
    "AnimationSequence",
    "SceneComposer",
]
