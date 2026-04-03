"""Tests for orchestration/pipeline_graph.py nodes, Pipeline execution,
orchestration/watch_folder.py processing, and orchestration/progress_dashboard.py."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

import blender_pipeline.orchestration.pipeline_graph as pg_mod
import blender_pipeline.orchestration.watch_folder as wf_mod


@pytest.fixture(autouse=True)
def _patch_pipeline_modules(mock_blender_modules: dict) -> None:
    """Ensure module-level bpy refs are the mock where needed."""
    # pipeline_graph doesn't have module-level bpy, but some nodes import it at runtime
    pass


# ── Pipeline Node Tests ──────────────────────────────────────────────


class TestMeshGeneratorNode:
    """MeshGeneratorNode.execute calls ParametricGenerator and stores object."""

    def test_execute_calls_parametric_generator(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            MeshGeneratorNode,
            PipelineContext,
        )

        mock_generated_object = MagicMock()
        mock_generated_object.name = "GeneratedMesh"

        mock_generator = MagicMock()
        mock_generator.generate_from_params.return_value = mock_generated_object

        node = MeshGeneratorNode("gen_node", params={"shape": "sphere", "radius": 2.0})
        context = PipelineContext()

        with patch(
            "blender_pipeline.generation.parametric.ParametricGenerator",
            return_value=mock_generator,
        ):
            result = node.execute(context)

        mock_generator.generate_from_params.assert_called_once_with(
            {"shape": "sphere", "radius": 2.0}
        )
        assert result["object"] == mock_generated_object
        assert context.get_object("gen_node") == mock_generated_object


class TestConditionalNode:
    """ConditionalNode.execute branches based on threshold comparison."""

    def test_value_above_threshold_returns_true_branch(
        self, mock_blender_modules: dict
    ) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            ConditionalNode,
            PipelineContext,
        )

        node = ConditionalNode("check", condition_key="poly_count", threshold=1000)
        context = PipelineContext()
        context.set("poly_count", 5000)

        result = node.execute(context)

        assert result["result"] is True
        assert result["branch"] == "true"

    def test_value_below_threshold_returns_false_branch(
        self, mock_blender_modules: dict
    ) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            ConditionalNode,
            PipelineContext,
        )

        node = ConditionalNode("check", condition_key="poly_count", threshold=1000)
        context = PipelineContext()
        context.set("poly_count", 500)

        result = node.execute(context)

        assert result["result"] is False
        assert result["branch"] == "false"

    def test_value_equal_to_threshold_returns_false(
        self, mock_blender_modules: dict
    ) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            ConditionalNode,
            PipelineContext,
        )

        node = ConditionalNode("check", condition_key="val", threshold=10)
        context = PipelineContext()
        context.set("val", 10)

        result = node.execute(context)
        assert result["result"] is False
        assert result["branch"] == "false"

    def test_missing_key_defaults_to_zero(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            ConditionalNode,
            PipelineContext,
        )

        node = ConditionalNode("check", condition_key="nonexistent", threshold=0)
        context = PipelineContext()

        result = node.execute(context)
        assert result["result"] is False


class TestPipelineExecution:
    """Pipeline.execute runs nodes in topological order."""

    def test_two_node_pipeline_executes_in_order(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            Pipeline,
            PipelineNode,
            PipelineContext,
        )

        execution_log: list[str] = []

        class TrackerNode(PipelineNode):
            def execute(self, context: PipelineContext) -> dict:
                execution_log.append(self.name)
                return {"value": self.name}

        pipeline = Pipeline("test_pipeline")
        node_a = TrackerNode("node_a", "tracker")
        node_b = TrackerNode("node_b", "tracker")

        pipeline.add_node(node_a)
        pipeline.add_node(node_b)
        pipeline.connect("node_a", "value", "node_b", "input_value")

        pipeline.execute()

        assert execution_log == ["node_a", "node_b"]

    def test_pipeline_validation_detects_missing_node(
        self, mock_blender_modules: dict
    ) -> None:
        from blender_pipeline.orchestration.pipeline_graph import Pipeline, PipelineNode

        pipeline = Pipeline("broken")
        pipeline.add_node(PipelineNode("a"))
        pipeline.connect("a", "out", "nonexistent", "in")

        errors = pipeline.validate()
        assert any("nonexistent" in error for error in errors)

    def test_pipeline_passes_outputs_via_context(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.pipeline_graph import (
            Pipeline,
            PipelineNode,
            PipelineContext,
        )

        class ProducerNode(PipelineNode):
            def execute(self, context: PipelineContext) -> dict:
                return {"object": "produced_object"}

        class ConsumerNode(PipelineNode):
            def execute(self, context: PipelineContext) -> dict:
                return {"received": self.inputs.get("object", "nothing")}

        pipeline = Pipeline("data_flow")
        producer = ProducerNode("producer", "producer")
        consumer = ConsumerNode("consumer", "consumer")

        pipeline.add_node(producer)
        pipeline.add_node(consumer)
        pipeline.connect("producer", "object", "consumer", "object")

        context = pipeline.execute()

        consumer_outputs = context.get("outputs:consumer")
        assert consumer_outputs["received"] == "produced_object"


# ── Watch Folder Tests ───────────────────────────────────────────────


class TestConfigProcessor:
    """ConfigProcessor.process dispatches by config type."""

    def test_process_parametric_config(self, mock_blender_modules: dict, tmp_dir: Path) -> None:
        from blender_pipeline.orchestration.watch_folder import ConfigProcessor

        processor = ConfigProcessor()
        config = {"type": "parametric", "shape": "sphere", "params": {"radius": 1.0}}

        mock_generator = MagicMock()
        mock_obj = MagicMock()
        mock_obj.name = "Sphere"
        mock_generator.generate_from_params.return_value = mock_obj

        with patch(
            "blender_pipeline.generation.parametric.ParametricGenerator",
            return_value=mock_generator,
        ):
            results = processor.process(config, str(tmp_dir))

        mock_generator.generate_from_params.assert_called_once()

    def test_process_invalid_config_raises_value_error(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.orchestration.watch_folder import ConfigProcessor

        processor = ConfigProcessor()
        invalid_config = {"type": "unknown_type"}

        with pytest.raises(ValueError, match="Invalid config"):
            processor.process(invalid_config, str(tmp_dir))

    def test_process_missing_type_raises_value_error(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.orchestration.watch_folder import ConfigProcessor

        processor = ConfigProcessor()
        with pytest.raises(ValueError, match="Invalid config"):
            processor.process({}, str(tmp_dir))


class TestWatcherConfig:
    """WatcherConfig dataclass defaults."""

    def test_default_values(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.watch_folder import WatcherConfig

        config = WatcherConfig()
        assert config.input_dir == "./watch/input"
        assert config.output_dir == "./watch/output"
        assert config.poll_interval == 2.0
        assert config.auto_export_formats == ["glb"]
        assert config.auto_render_thumbnail is True

    def test_custom_values(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.watch_folder import WatcherConfig

        config = WatcherConfig(
            input_dir="/custom/in",
            output_dir="/custom/out",
            poll_interval=5.0,
            auto_export_formats=["fbx", "obj"],
            auto_render_thumbnail=False,
        )
        assert config.input_dir == "/custom/in"
        assert config.auto_export_formats == ["fbx", "obj"]


class TestFolderWatcher:
    """FolderWatcher file processing and callback management."""

    def test_process_file_reads_json_and_calls_processor(
        self, mock_blender_modules: dict, tmp_dir: Path
    ) -> None:
        from blender_pipeline.orchestration.watch_folder import FolderWatcher, WatcherConfig

        config_data = {"type": "parametric", "shape": "cube", "params": {"size": 1.0}}
        config_file = tmp_dir / "test_config.json"
        config_file.write_text(json.dumps(config_data))

        watcher = FolderWatcher(WatcherConfig(output_dir=str(tmp_dir / "out")))

        with patch.object(watcher._processor, "process", return_value=["cube.glb"]) as mock_proc:
            results = watcher.process_file(str(config_file))

        mock_proc.assert_called_once_with(config_data, str(tmp_dir / "out"))
        assert results == ["cube.glb"]

    def test_on_file_created_callback_set(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.watch_folder import FolderWatcher

        watcher = FolderWatcher()
        callback = MagicMock()

        watcher.on_file_created(callback)
        assert watcher._on_created == callback

    def test_on_file_modified_callback_set(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.watch_folder import FolderWatcher

        watcher = FolderWatcher()
        callback = MagicMock()

        watcher.on_file_modified(callback)
        assert watcher._on_modified == callback

    def test_on_error_callback_set(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.watch_folder import FolderWatcher

        watcher = FolderWatcher()
        callback = MagicMock()

        watcher.on_error(callback)
        assert watcher._on_error == callback

    def test_stop_sets_running_to_false(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.watch_folder import FolderWatcher

        watcher = FolderWatcher()
        watcher._running = True
        watcher.stop()
        assert watcher._running is False


# ── Dashboard Tests ──────────────────────────────────────────────────


class TestJobToDict:
    """Job.to_dict serializes all fields."""

    def test_to_dict_contains_all_fields(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job

        job = Job(
            id="job_1",
            name="Render Scene",
            status="running",
            progress=0.5,
            total_steps=10,
            current_step=5,
            start_time=1000.0,
            end_time=0.0,
            error_message="",
            output_files=["file1.glb"],
            current_message="Rendering frame 5",
        )

        result = job.to_dict()

        assert result["id"] == "job_1"
        assert result["name"] == "Render Scene"
        assert result["status"] == "running"
        assert result["progress"] == 0.5
        assert result["total_steps"] == 10
        assert result["current_step"] == 5
        assert result["error_message"] == ""
        assert result["output_files"] == ["file1.glb"]
        assert result["current_message"] == "Rendering frame 5"
        assert "duration_seconds" in result

    def test_to_dict_completed_job(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job

        job = Job(
            id="job_2",
            name="Export",
            status="completed",
            progress=1.0,
            start_time=100.0,
            end_time=110.0,
        )

        result = job.to_dict()
        assert result["duration_seconds"] == 10.0


class TestJobDurationSeconds:
    """Job.duration_seconds property calculates elapsed time."""

    def test_with_start_time_and_no_end_time(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job

        job = Job(id="j1", name="test", start_time=time.time() - 5.0)
        duration = job.duration_seconds

        assert duration >= 4.5
        assert duration <= 6.5

    def test_with_start_and_end_time(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job

        job = Job(id="j2", name="test", start_time=100.0, end_time=120.0)
        assert job.duration_seconds == pytest.approx(20.0)

    def test_with_no_start_time(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job

        job = Job(id="j3", name="test")
        assert job.duration_seconds == 0.0


class TestTerminalDashboard:
    """TerminalDashboard display and colorization methods."""

    def test_display_job_detail_contains_job_info(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job, TerminalDashboard

        dashboard = TerminalDashboard()
        job = Job(
            id="job_5",
            name="Bake Normals",
            status="running",
            progress=0.75,
            total_steps=4,
            current_step=3,
            start_time=time.time() - 10.0,
            current_message="Processing step 3",
        )

        output = dashboard.display_job_detail(job)

        assert "Bake Normals" in output
        assert "job_5" in output
        assert "running" in output
        assert "3/4" in output
        assert "Processing step 3" in output

    def test_display_job_detail_with_error(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job, TerminalDashboard

        dashboard = TerminalDashboard()
        job = Job(
            id="job_6",
            name="Failed Job",
            status="failed",
            error_message="Out of memory",
            start_time=100.0,
            end_time=105.0,
        )

        output = dashboard.display_job_detail(job)
        assert "Out of memory" in output

    def test_display_job_detail_with_output_files(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import Job, TerminalDashboard

        dashboard = TerminalDashboard()
        job = Job(
            id="job_7",
            name="Export Job",
            status="completed",
            output_files=["/output/model.glb", "/output/model.fbx"],
            start_time=100.0,
            end_time=110.0,
        )

        output = dashboard.display_job_detail(job)
        assert "/output/model.glb" in output
        assert "/output/model.fbx" in output

    def test_colorize_status_contains_ansi_codes(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import TerminalDashboard

        dashboard = TerminalDashboard()

        running_output = dashboard._colorize_status("running")
        assert "\033[34m" in running_output
        assert "\033[0m" in running_output

        completed_output = dashboard._colorize_status("completed")
        assert "\033[32m" in completed_output

        failed_output = dashboard._colorize_status("failed")
        assert "\033[31m" in failed_output

        pending_output = dashboard._colorize_status("pending")
        assert "\033[33m" in pending_output

    def test_colorize_unknown_status_returns_as_is(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import TerminalDashboard

        dashboard = TerminalDashboard()
        result = dashboard._colorize_status("unknown_status")
        assert result == "unknown_status"


class TestDashboardServer:
    """DashboardServer start/stop lifecycle with mocked HTTPServer."""

    def test_start_creates_server_and_thread(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import (
            DashboardServer,
            JobManager,
        )

        job_manager = JobManager()
        server = DashboardServer(job_manager)

        mock_http_server = MagicMock()

        with patch(
            "blender_pipeline.orchestration.progress_dashboard.HTTPServer",
            return_value=mock_http_server,
        ):
            with patch(
                "blender_pipeline.orchestration.progress_dashboard.threading.Thread",
            ) as mock_thread_class:
                mock_thread_instance = MagicMock()
                mock_thread_class.return_value = mock_thread_instance

                server.start(port=9999)

                assert server._server == mock_http_server
                mock_thread_instance.start.assert_called_once()

    def test_stop_shuts_down_server(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import (
            DashboardServer,
            JobManager,
        )

        job_manager = JobManager()
        server = DashboardServer(job_manager)

        mock_http_server = MagicMock()
        server._server = mock_http_server
        server._thread = MagicMock()

        server.stop()

        mock_http_server.shutdown.assert_called_once()
        assert server._server is None
        assert server._thread is None

    def test_stop_when_not_started_is_noop(self, mock_blender_modules: dict) -> None:
        from blender_pipeline.orchestration.progress_dashboard import (
            DashboardServer,
            JobManager,
        )

        job_manager = JobManager()
        server = DashboardServer(job_manager)

        server.stop()

        assert server._server is None
