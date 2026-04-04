"""Motion capture import pipeline with BVH parsing and retargeting."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

try:
    import bpy
    from mathutils import Matrix, Vector
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class BVHJoint:
    """A joint parsed from a BVH file."""

    name: str
    parent: Optional[str]
    offset: tuple[float, float, float]
    channels: list[str]
    children: list[str] = field(default_factory=list)


@dataclass
class BVHData:
    """Parsed BVH motion capture data."""

    joints: list[BVHJoint]
    frames: list[list[float]]
    frame_time: float
    joint_order: list[str] = field(default_factory=list)

    @property
    def frame_count(self) -> int:
        return len(self.frames)

    @property
    def joint_count(self) -> int:
        return len(self.joints)

    @property
    def duration_seconds(self) -> float:
        return self.frame_count * self.frame_time


@dataclass
class BoneMapping:
    """Mapping between source and target skeleton bones."""

    source_bone: str
    target_bone: str
    rotation_offset: tuple[float, float, float] = (0.0, 0.0, 0.0)
    scale_factor: float = 1.0


class MocapImporter:
    """Imports and processes BVH motion capture data."""

    def parse_bvh(self, file_path: str | Path) -> BVHData:
        """Parse a BVH file into structured data."""
        content = Path(file_path).read_text(encoding="utf-8")
        return self.parse_bvh_string(content)

    def parse_bvh_string(self, content: str) -> BVHData:
        """Parse BVH content from a string."""
        lines = [line.strip() for line in content.strip().split("\n") if line.strip()]

        joints: list[BVHJoint] = []
        joint_order: list[str] = []
        parent_stack: list[str] = []
        frames: list[list[float]] = []
        frame_time: float = 0.033333

        section = "hierarchy"
        current_joint_name: Optional[str] = None
        current_offset: tuple[float, float, float] = (0.0, 0.0, 0.0)
        current_channels: list[str] = []

        line_index = 0
        while line_index < len(lines):
            line = lines[line_index]
            tokens = line.split()

            if section == "hierarchy":
                if tokens[0] in ("ROOT", "JOINT"):
                    current_joint_name = tokens[1]
                    joint_order.append(current_joint_name)
                elif tokens[0] == "End" and tokens[1] == "Site":
                    end_name = f"{parent_stack[-1]}_End" if parent_stack else "End"
                    current_joint_name = end_name
                elif tokens[0] == "OFFSET" and current_joint_name:
                    current_offset = (float(tokens[1]), float(tokens[2]), float(tokens[3]))
                elif tokens[0] == "CHANNELS" and current_joint_name:
                    channel_count = int(tokens[1])
                    current_channels = tokens[2:2 + channel_count]
                elif tokens[0] == "{":
                    if current_joint_name and current_joint_name in joint_order:
                        parent_name = parent_stack[-1] if parent_stack else None
                        joints.append(BVHJoint(
                            name=current_joint_name,
                            parent=parent_name,
                            offset=current_offset,
                            channels=current_channels,
                        ))
                        if parent_name:
                            for joint in joints:
                                if joint.name == parent_name:
                                    joint.children.append(current_joint_name)
                        parent_stack.append(current_joint_name)
                        current_channels = []
                    elif current_joint_name:
                        parent_stack.append(current_joint_name)
                elif tokens[0] == "}":
                    if parent_stack:
                        parent_stack.pop()
                elif tokens[0] == "MOTION":
                    section = "motion"
            elif section == "motion":
                if tokens[0] == "Frames:":
                    pass
                elif tokens[0] == "Frame" and len(tokens) >= 3 and tokens[1].startswith("Time"):
                    frame_time = float(tokens[2])
                else:
                    try:
                        frame_values = [float(v) for v in tokens]
                        frames.append(frame_values)
                    except ValueError:
                        pass

            line_index += 1

        return BVHData(
            joints=joints,
            frames=frames,
            frame_time=frame_time,
            joint_order=joint_order,
        )

    def create_armature_from_bvh(
        self,
        bvh_data: BVHData,
        name: str = "MocapArmature",
        scale: float = 0.01,
    ) -> Any:
        """Create a Blender armature matching the BVH skeleton."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        armature = bpy.data.armatures.new(f"{name}_armature")
        armature_obj = bpy.data.objects.new(name, armature)
        bpy.context.collection.objects.link(armature_obj)
        bpy.context.view_layer.objects.active = armature_obj
        bpy.ops.object.mode_set(mode="EDIT")

        joint_positions: dict[str, tuple[float, float, float]] = {}

        for joint in bvh_data.joints:
            bone = armature.edit_bones.new(joint.name)
            parent_pos = joint_positions.get(joint.parent, (0.0, 0.0, 0.0)) if joint.parent else (0.0, 0.0, 0.0)
            head = (
                parent_pos[0] + joint.offset[0] * scale,
                parent_pos[1] + joint.offset[1] * scale,
                parent_pos[2] + joint.offset[2] * scale,
            )
            joint_positions[joint.name] = head
            bone.head = head
            bone.tail = (head[0], head[1], head[2] + 0.1 * scale)

            if joint.parent:
                parent_bone = armature.edit_bones.get(joint.parent)
                if parent_bone:
                    bone.parent = parent_bone

        bpy.ops.object.mode_set(mode="OBJECT")
        return armature_obj

    def import_bvh_to_armature(
        self,
        bvh_data: BVHData,
        armature_object: Any,
        scale: float = 0.01,
    ) -> None:
        """Apply BVH frame data to an existing armature as keyframes."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        bpy.context.view_layer.objects.active = armature_object
        bpy.ops.object.mode_set(mode="POSE")

        for frame_index, frame_data in enumerate(bvh_data.frames):
            data_cursor = 0
            for joint in bvh_data.joints:
                pose_bone = armature_object.pose.bones.get(joint.name)
                if not pose_bone:
                    data_cursor += len(joint.channels)
                    continue

                for channel in joint.channels:
                    if data_cursor >= len(frame_data):
                        break
                    value = frame_data[data_cursor]
                    data_cursor += 1

                    if "position" in channel.lower():
                        axis_map = {"Xposition": 0, "Yposition": 1, "Zposition": 2}
                        axis = axis_map.get(channel)
                        if axis is not None:
                            pose_bone.location[axis] = value * scale
                    elif "rotation" in channel.lower():
                        import math
                        axis_map = {"Xrotation": 0, "Yrotation": 1, "Zrotation": 2}
                        axis = axis_map.get(channel)
                        if axis is not None:
                            pose_bone.rotation_euler[axis] = math.radians(value)

                pose_bone.keyframe_insert(data_path="location", frame=frame_index + 1)
                pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame_index + 1)

        bpy.ops.object.mode_set(mode="OBJECT")

    def retarget_animation(
        self,
        source_armature: Any,
        target_armature: Any,
        bone_mapping: list[BoneMapping],
    ) -> None:
        """Retarget animation from source to target armature using bone mapping."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        bpy.context.view_layer.objects.active = target_armature
        bpy.ops.object.mode_set(mode="POSE")

        source_action = source_armature.animation_data.action if source_armature.animation_data else None
        if not source_action:
            logger.warning("Source armature has no animation data")
            return

        frame_start = int(source_action.frame_range[0])
        frame_end = int(source_action.frame_range[1])

        for mapping in bone_mapping:
            source_bone = source_armature.pose.bones.get(mapping.source_bone)
            target_bone = target_armature.pose.bones.get(mapping.target_bone)
            if not source_bone or not target_bone:
                continue

            for frame in range(frame_start, frame_end + 1):
                bpy.context.scene.frame_set(frame)
                target_bone.rotation_euler = (
                    source_bone.rotation_euler[0] + mapping.rotation_offset[0],
                    source_bone.rotation_euler[1] + mapping.rotation_offset[1],
                    source_bone.rotation_euler[2] + mapping.rotation_offset[2],
                )
                target_bone.location = tuple(v * mapping.scale_factor for v in source_bone.location)
                target_bone.keyframe_insert(data_path="rotation_euler", frame=frame)
                target_bone.keyframe_insert(data_path="location", frame=frame)

        bpy.ops.object.mode_set(mode="OBJECT")

    def auto_map_bones(
        self,
        source_armature: Any,
        target_armature: Any,
    ) -> list[BoneMapping]:
        """Attempt automatic bone mapping by name similarity."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        source_bones = [b.name for b in source_armature.pose.bones]
        target_bones = [b.name for b in target_armature.pose.bones]
        mappings: list[BoneMapping] = []

        for source_name in source_bones:
            best_match: Optional[str] = None
            best_score: float = 0.0

            source_normalized = _normalize_bone_name(source_name)
            for target_name in target_bones:
                target_normalized = _normalize_bone_name(target_name)
                score = _name_similarity(source_normalized, target_normalized)
                if score > best_score and score > 0.5:
                    best_score = score
                    best_match = target_name

            if best_match:
                mappings.append(BoneMapping(source_bone=source_name, target_bone=best_match))

        return mappings

    def trim_animation(
        self,
        armature_object: Any,
        start_frame: int,
        end_frame: int,
    ) -> None:
        """Trim imported animation to a frame range."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        action = armature_object.animation_data.action if armature_object.animation_data else None
        if not action:
            return

        for fcurve in action.fcurves:
            points_to_remove = [kp for kp in fcurve.keyframe_points if kp.co.x < start_frame or kp.co.x > end_frame]
            for point in reversed(points_to_remove):
                fcurve.keyframe_points.remove(point)

    def blend_animations(
        self,
        animation_a: Any,
        animation_b: Any,
        blend_factor: float = 0.5,
        blend_frames: int = 10,
    ) -> None:
        """Blend between two animations over a transition period."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        if not animation_a.animation_data or not animation_b.animation_data:
            logger.warning("Both objects need animation data for blending")
            return

        nla_track = animation_a.animation_data.nla_tracks.new()
        nla_track.name = "BlendTrack"
        action_a = animation_a.animation_data.action
        action_b = animation_b.animation_data.action

        strip_a = nla_track.strips.new(action_a.name, int(action_a.frame_range[0]), action_a)
        strip_b = nla_track.strips.new(
            action_b.name, int(action_a.frame_range[1]) - blend_frames, action_b
        )
        strip_a.blend_out = blend_frames
        strip_b.blend_in = blend_frames


def _normalize_bone_name(name: str) -> str:
    """Normalize a bone name for comparison (lowercase, remove prefixes/suffixes)."""
    normalized = name.lower()
    normalized = re.sub(r"^(bip\d*_?|def_|drv_|mch_|org_)", "", normalized)
    normalized = re.sub(r"[._\-\s]+", "_", normalized)
    normalized = re.sub(r"_(l|r|left|right)$", "", normalized)
    return normalized


def _name_similarity(name_a: str, name_b: str) -> float:
    """Simple similarity score between two normalized bone names."""
    if name_a == name_b:
        return 1.0
    if name_a in name_b or name_b in name_a:
        return 0.8
    set_a = set(name_a.split("_"))
    set_b = set(name_b.split("_"))
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)
