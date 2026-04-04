"""Tests for BatchRenderer and RenderQueue — batch rendering system."""

from __future__ import annotations

import math
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

import blender_pipeline.quality.batch_render as br_mod
from blender_pipeline.quality.batch_render import (
    BatchRenderer,
    RenderFormat,
    RenderJob,
    RenderQueue,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patch_module(mock_blender_modules: dict) -> None:
    """Inject mock bpy into the batch_render module."""
    br_mod.HAS_BPY = True
    br_mod.bpy = mock_blender_modules["bpy"]


def _make_obj(name: str = "TestObj") -> MagicMock:
    """Return a mock Blender object with location and dimensions."""
    obj = MagicMock()
    obj.name = name
    obj.location = MagicMock()
    obj.location.x = 0.0
    obj.location.y = 0.0
    obj.location.z = 0.0
    obj.location.__getitem__ = lambda self, idx: [0.0, 0.0, 0.0][idx]
    obj.dimensions = MagicMock()
    obj.dimensions.__iter__ = lambda self: iter([2.0, 2.0, 2.0])

    # max(obj.dimensions) needs to work
    dim_max = MagicMock(return_value=2.0)
    obj.dimensions.__class__ = type(obj.dimensions)
    # Use a simple approach: patch max to work
    obj.dimensions.x = 2.0
    obj.dimensions.y = 2.0
    obj.dimensions.z = 2.0

    return obj


# ---------------------------------------------------------------------------
# RenderFormat enum
# ---------------------------------------------------------------------------

class TestRenderFormat:
    def test_all_values_exist(self) -> None:
        assert RenderFormat.PNG.value == "PNG"
        assert RenderFormat.JPEG.value == "JPEG"
        assert RenderFormat.EXR.value == "OPEN_EXR"
        assert RenderFormat.TIFF.value == "TIFF"
        assert RenderFormat.BMP.value == "BMP"

    def test_enum_count(self) -> None:
        assert len(RenderFormat) == 5


# ---------------------------------------------------------------------------
# RenderJob dataclass
# ---------------------------------------------------------------------------

class TestRenderJob:
    def test_defaults(self) -> None:
        job = RenderJob(name="test_render")
        assert job.name == "test_render"
        assert job.scene_file == ""
        assert job.camera == ""
        assert job.resolution == (1920, 1080)
        assert job.samples == 128
        assert job.output_path == "./renders"
        assert job.format == RenderFormat.PNG
        assert job.frame_range is None

    def test_custom_values(self) -> None:
        job = RenderJob(
            name="hires",
            scene_file="scene.blend",
            camera="MainCam",
            resolution=(3840, 2160),
            samples=256,
            output_path="/tmp/renders",
            format=RenderFormat.EXR,
            frame_range=(1, 100),
        )
        assert job.resolution == (3840, 2160)
        assert job.samples == 256
        assert job.format == RenderFormat.EXR
        assert job.frame_range == (1, 100)


# ---------------------------------------------------------------------------
# RenderQueue
# ---------------------------------------------------------------------------

class TestRenderQueue:
    def test_add_job(self) -> None:
        queue = RenderQueue()
        job = RenderJob(name="job1")
        queue.add_job(job)
        assert len(queue.get_queue()) == 1
        assert queue.get_queue()[0] is job

    def test_remove_job_by_name(self) -> None:
        queue = RenderQueue()
        queue.add_job(RenderJob(name="keep"))
        queue.add_job(RenderJob(name="remove_me"))
        queue.add_job(RenderJob(name="also_keep"))

        queue.remove_job("remove_me")

        names = [j.name for j in queue.get_queue()]
        assert "remove_me" not in names
        assert len(names) == 2

    def test_remove_nonexistent_job_is_safe(self) -> None:
        queue = RenderQueue()
        queue.add_job(RenderJob(name="only"))
        queue.remove_job("ghost")
        assert len(queue.get_queue()) == 1

    def test_get_queue_returns_copy(self) -> None:
        queue = RenderQueue()
        job = RenderJob(name="job")
        queue.add_job(job)

        returned = queue.get_queue()
        returned.clear()
        # Original queue unaffected
        assert len(queue.get_queue()) == 1

    def test_clear(self) -> None:
        queue = RenderQueue()
        queue.add_job(RenderJob(name="a"))
        queue.add_job(RenderJob(name="b"))
        queue.clear()
        assert len(queue.get_queue()) == 0

    def test_estimate_time_single_frame(self) -> None:
        queue = RenderQueue()
        job = RenderJob(name="test", resolution=(1920, 1080), samples=128)
        pixels = 1920 * 1080
        expected = pixels * 128 / 100_000_000 * 1
        result = queue.estimate_time(job)
        assert result == pytest.approx(expected)

    def test_estimate_time_with_frame_range(self) -> None:
        queue = RenderQueue()
        job = RenderJob(
            name="anim",
            resolution=(1920, 1080),
            samples=64,
            frame_range=(1, 10),
        )
        pixels = 1920 * 1080
        frames = 10
        expected = pixels * 64 / 100_000_000 * frames
        result = queue.estimate_time(job)
        assert result == pytest.approx(expected)


# ---------------------------------------------------------------------------
# BatchRenderer.render_single
# ---------------------------------------------------------------------------

class TestRenderSingle:
    def test_sets_resolution_samples_format(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        scene = mock_bpy.context.scene

        job = RenderJob(
            name="shot",
            resolution=(1280, 720),
            samples=64,
            format=RenderFormat.JPEG,
            output_path=str(tmp_dir),
        )

        renderer = BatchRenderer()
        renderer.render_single(job)

        assert scene.render.resolution_x == 1280
        assert scene.render.resolution_y == 720
        assert scene.cycles.samples == 64
        assert scene.render.image_settings.file_format == "JPEG"

    def test_render_called_with_write_still(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]

        job = RenderJob(name="still", output_path=str(tmp_dir))
        renderer = BatchRenderer()
        renderer.render_single(job)

        mock_bpy.ops.render.render.assert_called_once_with(write_still=True)

    def test_animation_render_with_frame_range(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        scene = mock_bpy.context.scene

        job = RenderJob(
            name="anim",
            output_path=str(tmp_dir),
            frame_range=(1, 50),
        )
        renderer = BatchRenderer()
        renderer.render_single(job)

        assert scene.frame_start == 1
        assert scene.frame_end == 50
        mock_bpy.ops.render.render.assert_called_once_with(animation=True)

    def test_camera_set_when_specified(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        scene = mock_bpy.context.scene
        cam_obj = MagicMock()
        mock_bpy.data.objects.get.return_value = cam_obj

        job = RenderJob(name="shot", camera="MainCamera", output_path=str(tmp_dir))
        renderer = BatchRenderer()
        renderer.render_single(job)

        mock_bpy.data.objects.get.assert_called_with("MainCamera")
        assert scene.camera is cam_obj

    def test_camera_not_set_when_empty(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]

        job = RenderJob(name="shot", camera="", output_path=str(tmp_dir))
        renderer = BatchRenderer()
        renderer.render_single(job)

        mock_bpy.data.objects.get.assert_not_called()

    def test_returns_output_filepath(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)

        job = RenderJob(name="result_test", output_path=str(tmp_dir))
        renderer = BatchRenderer()
        result = renderer.render_single(job)

        assert "result_test" in result
        assert str(tmp_dir) in result

    def test_raises_without_bpy(self) -> None:
        br_mod.HAS_BPY = False
        renderer = BatchRenderer()
        with pytest.raises(RuntimeError, match="bpy is not available"):
            renderer.render_single(RenderJob(name="fail"))


# ---------------------------------------------------------------------------
# BatchRenderer.render_queue
# ---------------------------------------------------------------------------

class TestRenderQueue_Render:
    def test_calls_render_single_for_each_job(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        _patch_module(mock_blender_modules)
        renderer = BatchRenderer()
        renderer.render_single = MagicMock(side_effect=lambda j: f"/out/{j.name}")

        queue = RenderQueue()
        queue.add_job(RenderJob(name="job_a", output_path=str(tmp_dir)))
        queue.add_job(RenderJob(name="job_b", output_path=str(tmp_dir)))

        outputs = renderer.render_queue(queue)

        assert renderer.render_single.call_count == 2
        assert outputs == ["/out/job_a", "/out/job_b"]


# ---------------------------------------------------------------------------
# BatchRenderer.render_turntable
# ---------------------------------------------------------------------------

class TestRenderTurntable:
    def test_camera_created_and_removed(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()

        # Make max() work on dimensions
        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            renderer.render_turntable(obj, frames=4, output_dir="/tmp/tt")

        mock_bpy.data.cameras.new.assert_called_once_with(name="TurntableCam")
        mock_bpy.data.objects.remove.assert_called_once()
        mock_bpy.data.cameras.remove.assert_called_once()

    def test_render_called_per_frame(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            outputs = renderer.render_turntable(obj, frames=8, output_dir="/tmp/tt")

        assert mock_bpy.ops.render.render.call_count == 8
        assert len(outputs) == 8

    def test_resolution_applied(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        scene = mock_bpy.context.scene
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            renderer.render_turntable(obj, frames=1, resolution=(512, 512))

        assert scene.render.resolution_x == 512
        assert scene.render.resolution_y == 512


# ---------------------------------------------------------------------------
# BatchRenderer.render_multiview
# ---------------------------------------------------------------------------

class TestRenderMultiview:
    def test_renders_all_default_views(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            outputs = renderer.render_multiview(obj, output_dir="/tmp/mv")

        default_views = ["front", "back", "left", "right", "top", "three_quarter"]
        assert mock_bpy.ops.render.render.call_count == len(default_views)
        assert len(outputs) == len(default_views)

    def test_custom_views(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            outputs = renderer.render_multiview(
                obj, views=["front", "top"], output_dir="/tmp/mv"
            )

        assert mock_bpy.ops.render.render.call_count == 2
        assert len(outputs) == 2

    def test_camera_created_and_cleaned_up(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            renderer.render_multiview(obj, views=["front"])

        mock_bpy.data.cameras.new.assert_called_once_with(name="MultiViewCam")
        mock_bpy.data.objects.remove.assert_called_once()
        mock_bpy.data.cameras.remove.assert_called_once()

    def test_resolution_applied(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        scene = mock_bpy.context.scene
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            renderer.render_multiview(obj, views=["front"], resolution=(800, 600))

        assert scene.render.resolution_x == 800
        assert scene.render.resolution_y == 600

    def test_unknown_view_skipped(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        obj = _make_obj()

        with patch("builtins.max", return_value=2.0):
            renderer = BatchRenderer()
            outputs = renderer.render_multiview(
                obj, views=["unknown_angle"], output_dir="/tmp/mv"
            )

        mock_bpy.ops.render.render.assert_not_called()
        assert len(outputs) == 0


# ---------------------------------------------------------------------------
# BatchRenderer.render_animation
# ---------------------------------------------------------------------------

class TestRenderAnimation:
    def test_frame_range_and_format_set(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        scene = mock_bpy.context.scene

        renderer = BatchRenderer()
        renderer.render_animation(
            scene_file="scene.blend",
            frame_start=10,
            frame_end=50,
            output_dir="/tmp/anim",
            format=RenderFormat.EXR,
        )

        assert scene.frame_start == 10
        assert scene.frame_end == 50
        assert scene.render.image_settings.file_format == "OPEN_EXR"
        mock_bpy.ops.render.render.assert_called_once_with(animation=True)

    def test_returns_output_directory(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        renderer = BatchRenderer()
        result = renderer.render_animation(
            scene_file="scene.blend",
            frame_start=1,
            frame_end=10,
            output_dir="/tmp/anim_out",
        )
        assert "/tmp/anim_out" in result


# ---------------------------------------------------------------------------
# BatchRenderer.create_contact_sheet
# ---------------------------------------------------------------------------

class TestCreateContactSheet:
    def test_graceful_on_missing_pillow(self, mock_blender_modules: dict) -> None:
        """Verify the actual code path returns empty string when PIL is missing."""
        renderer = BatchRenderer()
        import builtins
        original_import = builtins.__import__

        def mock_import(name: str, *args, **kwargs):
            if name == "PIL":
                raise ImportError("No module named 'PIL'")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            result = renderer.create_contact_sheet(["/img.png"])

        assert result == ""

    def test_returns_empty_for_empty_paths(self, mock_blender_modules: dict) -> None:
        """Even with Pillow available, empty input returns empty string."""
        renderer = BatchRenderer()
        mock_image_module = MagicMock()
        with patch.dict(
            "sys.modules",
            {"PIL": MagicMock(Image=mock_image_module), "PIL.Image": mock_image_module},
        ):
            result = renderer.create_contact_sheet([], columns=4)
        assert result == ""

    def test_with_mock_pillow_creates_sheet(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        """Verify images are opened, composited, and saved."""
        renderer = BatchRenderer()

        mock_image_class = MagicMock()
        mock_img = MagicMock()
        mock_img.width = 100
        mock_img.height = 100
        mock_img.resize.return_value = mock_img
        mock_image_class.open.return_value = mock_img
        mock_sheet = MagicMock()
        mock_image_class.new.return_value = mock_sheet

        output_path = str(tmp_dir / "sheet.png")

        with patch.dict(
            "sys.modules",
            {"PIL": MagicMock(Image=mock_image_class), "PIL.Image": mock_image_class},
        ):
            result = renderer.create_contact_sheet(
                ["/fake/img1.png", "/fake/img2.png"],
                columns=2,
                output_path=output_path,
            )

        assert result == output_path
        assert mock_image_class.open.call_count == 2
        mock_image_class.new.assert_called_once()
        mock_sheet.save.assert_called_once_with(output_path)

    def test_skips_images_that_fail_to_open(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        """If all images fail to open, returns empty string."""
        renderer = BatchRenderer()

        mock_image_class = MagicMock()
        mock_image_class.open.side_effect = OSError("file not found")

        output_path = str(tmp_dir / "sheet.png")

        with patch.dict(
            "sys.modules",
            {"PIL": MagicMock(Image=mock_image_class), "PIL.Image": mock_image_class},
        ):
            result = renderer.create_contact_sheet(
                ["/bad1.png", "/bad2.png"],
                output_path=output_path,
            )

        assert result == ""
