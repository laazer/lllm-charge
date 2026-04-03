"""Interpret natural language animation descriptions into Blender keyframes."""

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

ANIMATION_SYSTEM_PROMPT = """You are an animation sequence generator. Given a description and object names, output JSON:
{
  "name": "sequence_name",
  "total_frames": 120,
  "fps": 24,
  "actions": [
    {
      "object_name": "object_name",
      "action_type": "move|rotate|scale|bounce|orbit|shake|wave|fade|follow_path",
      "parameters": {
        // action-specific parameters
      },
      "start_frame": 1,
      "duration_frames": 60
    }
  ]
}

Action parameter schemas:
- move: {"target": [x, y, z]}
- rotate: {"axis": "x|y|z", "degrees": 360}
- scale: {"target": [sx, sy, sz]}
- bounce: {"height": 2.0, "bounces": 3}
- orbit: {"center": [0, 0, 0], "radius": 5.0, "axis": "z"}
- shake: {"intensity": 0.3, "decay": true}
- wave: {"amplitude": 0.5, "frequency": 1.0}
- fade: {"direction": "in|out"}
- follow_path: {"points": [[x,y,z], ...], "loop": false}

Output ONLY valid JSON."""


@dataclass
class AnimationAction:
    """A single animation action in a sequence."""

    object_name: str
    action_type: str
    parameters: dict = field(default_factory=dict)
    start_frame: int = 1
    duration_frames: int = 60


@dataclass
class AnimationSequence:
    """A complete animation sequence."""

    name: str = "sequence"
    actions: list[AnimationAction] = field(default_factory=list)
    total_frames: int = 120
    fps: int = 24

    @classmethod
    def from_dict(cls, data: dict) -> AnimationSequence:
        actions = [
            AnimationAction(
                object_name=a.get("object_name", ""),
                action_type=a.get("action_type", "move"),
                parameters=a.get("parameters", {}),
                start_frame=a.get("start_frame", 1),
                duration_frames=a.get("duration_frames", 60),
            )
            for a in data.get("actions", [])
        ]
        return cls(
            name=data.get("name", "sequence"),
            actions=actions,
            total_frames=data.get("total_frames", 120),
            fps=data.get("fps", 24),
        )


ACTION_TYPES = ("move", "rotate", "scale", "bounce", "orbit", "shake", "wave", "fade", "follow_path")


class AnimationInterpreter:
    """Interprets text descriptions into animation sequences and executes them."""

    def __init__(self, config: Optional[LLMConfig] = None) -> None:
        self.config = config or LLMConfig()

    def interpret_animation(
        self,
        description: str,
        target_objects: list[str],
    ) -> AnimationSequence:
        """Send description to LLM and parse the animation sequence."""
        prompt = (
            f"Objects in scene: {target_objects}\n"
            f"Animation description: {description}"
        )
        response_text = call_llm(self.config, ANIMATION_SYSTEM_PROMPT, prompt)
        data = _extract_json(response_text)
        return AnimationSequence.from_dict(data)

    def execute_sequence(self, sequence: AnimationSequence) -> None:
        """Apply all actions in the sequence to Blender scene objects."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        bpy.context.scene.frame_end = max(
            bpy.context.scene.frame_end, sequence.total_frames
        )
        bpy.context.scene.render.fps = sequence.fps

        for action in sequence.actions:
            obj = bpy.data.objects.get(action.object_name)
            if not obj:
                logger.warning("Object '%s' not found in scene", action.object_name)
                continue
            self._execute_action(obj, action)

    def preview_sequence(self, sequence: AnimationSequence) -> str:
        """Return a human-readable preview of the animation sequence."""
        lines = [f"Animation: {sequence.name} ({sequence.total_frames} frames @ {sequence.fps} fps)"]
        for action in sequence.actions:
            lines.append(
                f"  [{action.start_frame}-{action.start_frame + action.duration_frames}] "
                f"{action.object_name}: {action.action_type} {action.parameters}"
            )
        return "\n".join(lines)

    def _execute_action(self, obj: Any, action: AnimationAction) -> None:
        """Execute a single animation action on a Blender object."""
        executor_map = {
            "move": self._action_move,
            "rotate": self._action_rotate,
            "scale": self._action_scale,
            "bounce": self._action_bounce,
            "orbit": self._action_orbit,
            "shake": self._action_shake,
            "wave": self._action_wave,
            "fade": self._action_fade,
            "follow_path": self._action_follow_path,
        }
        executor = executor_map.get(action.action_type)
        if executor:
            executor(obj, action)
        else:
            logger.warning("Unknown action type: %s", action.action_type)

    def _action_move(self, obj: Any, action: AnimationAction) -> None:
        target = action.parameters.get("target", [0, 0, 0])
        start = action.start_frame
        end = start + action.duration_frames
        obj.keyframe_insert(data_path="location", frame=start)
        obj.location = target
        obj.keyframe_insert(data_path="location", frame=end)

    def _action_rotate(self, obj: Any, action: AnimationAction) -> None:
        import math
        axis_map = {"x": 0, "y": 1, "z": 2}
        axis = axis_map.get(action.parameters.get("axis", "z"), 2)
        degrees = action.parameters.get("degrees", 360)
        start = action.start_frame
        end = start + action.duration_frames
        obj.keyframe_insert(data_path="rotation_euler", frame=start)
        obj.rotation_euler[axis] += math.radians(degrees)
        obj.keyframe_insert(data_path="rotation_euler", frame=end)

    def _action_scale(self, obj: Any, action: AnimationAction) -> None:
        target = action.parameters.get("target", [1, 1, 1])
        start = action.start_frame
        end = start + action.duration_frames
        obj.keyframe_insert(data_path="scale", frame=start)
        obj.scale = target
        obj.keyframe_insert(data_path="scale", frame=end)

    def _action_bounce(self, obj: Any, action: AnimationAction) -> None:
        import math
        height = action.parameters.get("height", 2.0)
        bounces = action.parameters.get("bounces", 3)
        frames_per_bounce = action.duration_frames // bounces
        for bounce_index in range(bounces):
            peak_frame = action.start_frame + bounce_index * frames_per_bounce + frames_per_bounce // 2
            ground_frame = action.start_frame + (bounce_index + 1) * frames_per_bounce
            bounce_height = height * (0.6 ** bounce_index)
            base_z = obj.location.z
            obj.location.z = base_z + bounce_height
            obj.keyframe_insert(data_path="location", frame=peak_frame)
            obj.location.z = base_z
            obj.keyframe_insert(data_path="location", frame=ground_frame)

    def _action_orbit(self, obj: Any, action: AnimationAction) -> None:
        import math
        center = action.parameters.get("center", [0, 0, 0])
        radius = action.parameters.get("radius", 5.0)
        steps = action.duration_frames
        for i in range(steps + 1):
            frame = action.start_frame + i
            angle = 2 * math.pi * i / steps
            obj.location = (
                center[0] + radius * math.cos(angle),
                center[1] + radius * math.sin(angle),
                center[2] if len(center) > 2 else obj.location.z,
            )
            obj.keyframe_insert(data_path="location", frame=frame)

    def _action_shake(self, obj: Any, action: AnimationAction) -> None:
        import random
        intensity = action.parameters.get("intensity", 0.3)
        decay = action.parameters.get("decay", True)
        rng = random.Random(42)
        base_loc = list(obj.location)
        for i in range(action.duration_frames):
            frame = action.start_frame + i
            factor = 1.0 - (i / action.duration_frames) if decay else 1.0
            obj.location = (
                base_loc[0] + rng.uniform(-intensity, intensity) * factor,
                base_loc[1] + rng.uniform(-intensity, intensity) * factor,
                base_loc[2],
            )
            obj.keyframe_insert(data_path="location", frame=frame)
        obj.location = base_loc
        obj.keyframe_insert(data_path="location", frame=action.start_frame + action.duration_frames)

    def _action_wave(self, obj: Any, action: AnimationAction) -> None:
        from blender_pipeline.animation.procedural import ProceduralAnimator, FrameRange
        animator = ProceduralAnimator()
        animator.apply_sine_wave(
            obj,
            amplitude=action.parameters.get("amplitude", 0.5),
            frequency=action.parameters.get("frequency", 1.0),
            frame_range=FrameRange(action.start_frame, action.start_frame + action.duration_frames),
        )

    def _action_fade(self, obj: Any, action: AnimationAction) -> None:
        direction = action.parameters.get("direction", "in")
        if not obj.data.materials:
            return
        mat = obj.data.materials[0]
        if not mat or not mat.use_nodes:
            return
        principled = mat.node_tree.nodes.get("Principled BSDF")
        if not principled:
            return
        alpha_input = principled.inputs.get("Alpha")
        if not alpha_input:
            return
        start_val = 0.0 if direction == "in" else 1.0
        end_val = 1.0 if direction == "in" else 0.0
        alpha_input.default_value = start_val
        alpha_input.keyframe_insert("default_value", frame=action.start_frame)
        alpha_input.default_value = end_val
        alpha_input.keyframe_insert("default_value", frame=action.start_frame + action.duration_frames)

    def _action_follow_path(self, obj: Any, action: AnimationAction) -> None:
        from blender_pipeline.animation.procedural import ProceduralAnimator, FrameRange
        points = action.parameters.get("points", [])
        loop = action.parameters.get("loop", False)
        if not points:
            return
        animator = ProceduralAnimator()
        animator.apply_follow_path(
            obj,
            path_points=[tuple(p) for p in points],
            loop=loop,
            frame_range=FrameRange(action.start_frame, action.start_frame + action.duration_frames),
        )


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response."""
    text = text.strip()
    if "```" in text:
        start = text.find("```")
        first_newline = text.find("\n", start)
        end = text.find("```", first_newline)
        if end > first_newline:
            text = text[first_newline:end].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error("Failed to parse animation JSON from LLM")
        return {"actions": []}
