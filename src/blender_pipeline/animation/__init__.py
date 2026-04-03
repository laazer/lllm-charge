"""Animation systems — keyframe templates, physics, mocap, procedural."""

from blender_pipeline.animation.keyframe_templates import (
    Keyframe,
    AnimationChannel,
    KeyframeTemplate,
    TemplateLibrary,
)
from blender_pipeline.animation.physics import PhysicsAnimator, PhysicsPreset
from blender_pipeline.animation.mocap import MocapImporter, BVHData, BoneMapping
from blender_pipeline.animation.procedural import ProceduralAnimator

__all__ = [
    "Keyframe",
    "AnimationChannel",
    "KeyframeTemplate",
    "TemplateLibrary",
    "PhysicsAnimator",
    "PhysicsPreset",
    "MocapImporter",
    "BVHData",
    "BoneMapping",
    "ProceduralAnimator",
]
