"""Batch rendering system with multi-view, turntable, and queue management."""

from __future__ import annotations

import logging
import math
import subprocess
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional

try:
    import bpy
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


class RenderFormat(Enum):
    """Supported render output formats."""

    PNG = "PNG"
    JPEG = "JPEG"
    EXR = "OPEN_EXR"
    TIFF = "TIFF"
    BMP = "BMP"


@dataclass
class RenderJob:
    """A single render job specification."""

    name: str
    scene_file: str = ""
    camera: str = ""
    resolution: tuple[int, int] = (1920, 1080)
    samples: int = 128
    output_path: str = "./renders"
    format: RenderFormat = RenderFormat.PNG
    frame_range: Optional[tuple[int, int]] = None


class RenderQueue:
    """Manages a queue of render jobs."""

    def __init__(self) -> None:
        self._jobs: list[RenderJob] = []

    def add_job(self, job: RenderJob) -> None:
        self._jobs.append(job)

    def remove_job(self, name: str) -> None:
        self._jobs = [j for j in self._jobs if j.name != name]

    def get_queue(self) -> list[RenderJob]:
        return list(self._jobs)

    def clear(self) -> None:
        self._jobs.clear()

    def estimate_time(self, job: RenderJob) -> float:
        """Rough estimate: 0.001 seconds per pixel per sample / 100."""
        pixels = job.resolution[0] * job.resolution[1]
        frames = 1
        if job.frame_range:
            frames = job.frame_range[1] - job.frame_range[0] + 1
        return pixels * job.samples / 100_000_000 * frames


class BatchRenderer:
    """Renders single jobs, queues, turntables, and multi-view setups."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def render_single(self, job: RenderJob) -> str:
        """Render a single job and return the output path."""
        self._require_bpy()
        scene = bpy.context.scene
        scene.render.resolution_x = job.resolution[0]
        scene.render.resolution_y = job.resolution[1]
        scene.cycles.samples = job.samples
        scene.render.image_settings.file_format = job.format.value

        output_dir = Path(job.output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = str(output_dir / job.name)
        scene.render.filepath = output_file

        if job.camera:
            cam = bpy.data.objects.get(job.camera)
            if cam:
                scene.camera = cam

        if job.frame_range:
            scene.frame_start = job.frame_range[0]
            scene.frame_end = job.frame_range[1]
            bpy.ops.render.render(animation=True)
        else:
            bpy.ops.render.render(write_still=True)

        logger.info("Rendered: %s", output_file)
        return output_file

    def render_queue(self, queue: RenderQueue, parallel: bool = False) -> list[str]:
        """Render all jobs in the queue."""
        outputs: list[str] = []
        for job in queue.get_queue():
            output = self.render_single(job)
            outputs.append(output)
        return outputs

    def render_turntable(
        self,
        obj: Any,
        frames: int = 36,
        output_dir: str = "./renders/turntable",
        resolution: tuple[int, int] = (1080, 1080),
    ) -> list[str]:
        """Render a 360-degree turntable around an object."""
        self._require_bpy()
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        outputs: list[str] = []

        cam_data = bpy.data.cameras.new(name="TurntableCam")
        cam_obj = bpy.data.objects.new("TurntableCam", cam_data)
        bpy.context.collection.objects.link(cam_obj)
        bpy.context.scene.camera = cam_obj

        center = obj.location
        radius = max(obj.dimensions) * 2.5

        scene = bpy.context.scene
        scene.render.resolution_x = resolution[0]
        scene.render.resolution_y = resolution[1]

        for frame_index in range(frames):
            angle = 2 * math.pi * frame_index / frames
            cam_obj.location = (
                center.x + radius * math.cos(angle),
                center.y + radius * math.sin(angle),
                center.z + radius * 0.4,
            )

            direction = [center[i] - cam_obj.location[i] for i in range(3)]
            dist = math.sqrt(sum(d * d for d in direction))
            if dist > 0:
                direction = [d / dist for d in direction]
                pitch = math.asin(-direction[2])
                yaw = math.atan2(direction[0], direction[1])
                cam_obj.rotation_euler = (pitch + math.pi / 2, 0, yaw)

            filepath = str(output_path / f"turntable_{frame_index:04d}")
            scene.render.filepath = filepath
            bpy.ops.render.render(write_still=True)
            outputs.append(filepath)

        bpy.data.objects.remove(cam_obj)
        bpy.data.cameras.remove(cam_data)
        return outputs

    def render_multiview(
        self,
        obj: Any,
        views: list[str] | None = None,
        output_dir: str = "./renders/multiview",
        resolution: tuple[int, int] = (1080, 1080),
    ) -> list[str]:
        """Render from multiple preset camera angles."""
        self._require_bpy()
        if views is None:
            views = ["front", "back", "left", "right", "top", "three_quarter"]

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        outputs: list[str] = []

        center = obj.location
        distance = max(obj.dimensions) * 2.5

        view_positions = {
            "front": (center.x, center.y - distance, center.z + distance * 0.3),
            "back": (center.x, center.y + distance, center.z + distance * 0.3),
            "left": (center.x - distance, center.y, center.z + distance * 0.3),
            "right": (center.x + distance, center.y, center.z + distance * 0.3),
            "top": (center.x, center.y, center.z + distance * 1.5),
            "three_quarter": (
                center.x + distance * 0.7,
                center.y - distance * 0.7,
                center.z + distance * 0.5,
            ),
        }

        cam_data = bpy.data.cameras.new(name="MultiViewCam")
        cam_obj = bpy.data.objects.new("MultiViewCam", cam_data)
        bpy.context.collection.objects.link(cam_obj)
        bpy.context.scene.camera = cam_obj

        scene = bpy.context.scene
        scene.render.resolution_x = resolution[0]
        scene.render.resolution_y = resolution[1]

        for view_name in views:
            position = view_positions.get(view_name)
            if not position:
                continue

            cam_obj.location = position
            direction = [center[i] - position[i] for i in range(3)]
            dist = math.sqrt(sum(d * d for d in direction))
            if dist > 0:
                direction = [d / dist for d in direction]
                pitch = math.asin(-direction[2])
                yaw = math.atan2(direction[0], direction[1])
                cam_obj.rotation_euler = (pitch + math.pi / 2, 0, yaw)

            filepath = str(output_path / f"{view_name}")
            scene.render.filepath = filepath
            bpy.ops.render.render(write_still=True)
            outputs.append(filepath)

        bpy.data.objects.remove(cam_obj)
        bpy.data.cameras.remove(cam_data)
        return outputs

    def render_animation(
        self,
        scene_file: str,
        frame_start: int,
        frame_end: int,
        output_dir: str = "./renders/animation",
        format: RenderFormat = RenderFormat.PNG,
    ) -> str:
        """Render an animation frame range."""
        self._require_bpy()
        scene = bpy.context.scene
        scene.frame_start = frame_start
        scene.frame_end = frame_end
        scene.render.image_settings.file_format = format.value

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(output_path / "frame_")

        bpy.ops.render.render(animation=True)
        return str(output_path)

    def create_contact_sheet(
        self,
        image_paths: list[str],
        columns: int = 4,
        output_path: str = "./renders/contact_sheet.png",
    ) -> str:
        """Combine rendered images into a grid contact sheet."""
        try:
            from PIL import Image
        except ImportError:
            logger.error("Pillow is required for contact sheets: pip install Pillow")
            return ""

        if not image_paths:
            return ""

        images = []
        for path in image_paths:
            try:
                img = Image.open(path)
                images.append(img)
            except Exception as exc:
                logger.warning("Could not open %s: %s", path, exc)

        if not images:
            return ""

        thumb_width = images[0].width
        thumb_height = images[0].height
        rows = math.ceil(len(images) / columns)

        sheet = Image.new("RGB", (thumb_width * columns, thumb_height * rows), (0, 0, 0))
        for index, img in enumerate(images):
            row = index // columns
            col = index % columns
            img_resized = img.resize((thumb_width, thumb_height))
            sheet.paste(img_resized, (col * thumb_width, row * thumb_height))

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        sheet.save(output_path)
        logger.info("Contact sheet saved: %s", output_path)
        return output_path
