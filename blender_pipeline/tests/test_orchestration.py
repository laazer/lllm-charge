"""Tests for orchestration modules — pipeline graph, config processor, job manager."""

import json
from pathlib import Path

import pytest

from blender_pipeline.orchestration.pipeline_graph import (
    Pipeline,
    PipelineNode,
    PipelineEdge,
    PipelineContext,
    PipelineBuilder,
    MeshGeneratorNode,
    ExportNode,
    ConditionalNode,
)
from blender_pipeline.orchestration.watch_folder import ConfigProcessor
from blender_pipeline.orchestration.progress_dashboard import (
    JobManager,
    Job,
    TerminalDashboard,
)


class TestPipelineContext:
    def test_get_set(self) -> None:
        ctx = PipelineContext()
        ctx.set("key", "value")
        assert ctx.get("key") == "value"

    def test_get_default(self) -> None:
        ctx = PipelineContext()
        assert ctx.get("missing", "default") == "default"

    def test_object_storage(self) -> None:
        ctx = PipelineContext()
        ctx.set_object("cube", {"name": "Cube"})
        assert ctx.get_object("cube") == {"name": "Cube"}

    def test_keys(self) -> None:
        ctx = PipelineContext()
        ctx.set("a", 1)
        ctx.set("b", 2)
        assert "a" in ctx.keys()
        assert "b" in ctx.keys()


class TestPipelineNode:
    def test_base_node(self) -> None:
        node = PipelineNode("test", "base")
        assert node.name == "test"
        assert node.node_type == "base"
        assert node.validate() is True

    def test_to_dict(self) -> None:
        node = PipelineNode("my_node", "test_type")
        node.inputs = {"shape": "box"}
        data = node.to_dict()
        assert data["name"] == "my_node"
        assert data["node_type"] == "test_type"

    def test_repr(self) -> None:
        node = PipelineNode("gen", "mesh_generator")
        assert "mesh_generator" in repr(node)
        assert "gen" in repr(node)


class TestPipeline:
    def test_add_and_remove_node(self) -> None:
        pipeline = Pipeline()
        node = PipelineNode("a", "test")
        pipeline.add_node(node)
        assert pipeline.get_node("a") is node
        pipeline.remove_node("a")
        with pytest.raises(KeyError):
            pipeline.get_node("a")

    def test_connect_nodes(self) -> None:
        pipeline = Pipeline()
        pipeline.add_node(PipelineNode("a", "test"))
        pipeline.add_node(PipelineNode("b", "test"))
        pipeline.connect("a", "output", "b", "input")
        assert len(pipeline._edges) == 1

    def test_validate_missing_node(self) -> None:
        pipeline = Pipeline()
        pipeline.add_node(PipelineNode("a", "test"))
        pipeline.connect("a", "output", "nonexistent", "input")
        errors = pipeline.validate()
        assert any("nonexistent" in e for e in errors)

    def test_validate_cycle_detection(self) -> None:
        pipeline = Pipeline()
        pipeline.add_node(PipelineNode("a", "test"))
        pipeline.add_node(PipelineNode("b", "test"))
        pipeline.connect("a", "out", "b", "in")
        pipeline.connect("b", "out", "a", "in")
        errors = pipeline.validate()
        assert any("cycle" in e.lower() for e in errors)

    def test_topological_sort_linear(self) -> None:
        pipeline = Pipeline()
        pipeline.add_node(PipelineNode("a", "test"))
        pipeline.add_node(PipelineNode("b", "test"))
        pipeline.add_node(PipelineNode("c", "test"))
        pipeline.connect("a", "out", "b", "in")
        pipeline.connect("b", "out", "c", "in")
        order = pipeline._topological_sort()
        assert order.index("a") < order.index("b") < order.index("c")

    def test_save_and_load(self, tmp_dir: Path) -> None:
        pipeline = Pipeline("test_pipeline")
        pipeline.add_node(PipelineNode("gen", "mesh_generator"))
        pipeline.add_node(PipelineNode("export", "export"))
        pipeline.connect("gen", "object", "export", "object")

        path = tmp_dir / "pipeline.json"
        pipeline.save(str(path))
        assert path.exists()

        loaded = Pipeline.load(str(path))
        assert loaded.name == "test_pipeline"
        assert "gen" in [n for n in loaded._nodes]

    def test_visualize(self) -> None:
        pipeline = Pipeline("viz_test")
        pipeline.add_node(PipelineNode("a", "generator"))
        pipeline.add_node(PipelineNode("b", "export"))
        pipeline.connect("a", "object", "b", "object")
        text = pipeline.visualize()
        assert "viz_test" in text
        assert "generator" in text


class TestPipelineBuilder:
    def test_fluent_api(self) -> None:
        node_a = PipelineNode("gen", "mesh_generator")
        node_b = PipelineNode("export", "export")
        pipeline = (
            PipelineBuilder("test")
            .start_with(node_a)
            .then(node_b)
            .build()
        )
        assert len(pipeline._nodes) == 2
        assert len(pipeline._edges) == 1

    def test_export_to(self) -> None:
        node_a = PipelineNode("gen", "mesh_generator")
        pipeline = (
            PipelineBuilder("test")
            .start_with(node_a)
            .export_to("glb", "./output")
            .build()
        )
        assert len(pipeline._nodes) == 2


class TestConfigProcessor:
    def test_validate_parametric(self) -> None:
        processor = ConfigProcessor()
        errors = processor.validate_config({"type": "parametric", "shape": "box"})
        assert errors == []

    def test_validate_missing_type(self) -> None:
        processor = ConfigProcessor()
        errors = processor.validate_config({})
        assert any("type" in e.lower() for e in errors)

    def test_validate_invalid_type(self) -> None:
        processor = ConfigProcessor()
        errors = processor.validate_config({"type": "unknown"})
        assert len(errors) > 0

    def test_validate_text_to_3d_requires_description(self) -> None:
        processor = ConfigProcessor()
        errors = processor.validate_config({"type": "text_to_3d"})
        assert any("description" in e.lower() for e in errors)

    def test_validate_pipeline_requires_nodes(self) -> None:
        processor = ConfigProcessor()
        errors = processor.validate_config({"type": "pipeline"})
        assert any("nodes" in e.lower() for e in errors)


class TestJobManager:
    def test_create_job(self) -> None:
        manager = JobManager()
        job_id = manager.create_job("Test Job", total_steps=5)
        assert job_id.startswith("job_")

        job = manager.get_job(job_id)
        assert job is not None
        assert job.name == "Test Job"
        assert job.status == "running"

    def test_update_progress(self) -> None:
        manager = JobManager()
        job_id = manager.create_job("Progress Test", total_steps=10)
        manager.update_progress(job_id, 5, "Halfway done")

        job = manager.get_job(job_id)
        assert job.progress == 0.5
        assert job.current_message == "Halfway done"

    def test_complete_job(self) -> None:
        manager = JobManager()
        job_id = manager.create_job("Complete Test")
        manager.complete_job(job_id, output_files=["output.glb"])

        job = manager.get_job(job_id)
        assert job.status == "completed"
        assert job.progress == 1.0
        assert "output.glb" in job.output_files

    def test_fail_job(self) -> None:
        manager = JobManager()
        job_id = manager.create_job("Fail Test")
        manager.fail_job(job_id, "Out of memory")

        job = manager.get_job(job_id)
        assert job.status == "failed"
        assert "memory" in job.error_message

    def test_cancel_job(self) -> None:
        manager = JobManager()
        job_id = manager.create_job("Cancel Test")
        manager.cancel_job(job_id)
        assert manager.get_job(job_id).status == "cancelled"

    def test_get_active_jobs(self) -> None:
        manager = JobManager()
        id1 = manager.create_job("Active")
        id2 = manager.create_job("Done")
        manager.complete_job(id2)

        active = manager.get_active_jobs()
        assert len(active) == 1
        assert active[0].id == id1

    def test_statistics(self) -> None:
        manager = JobManager()
        manager.create_job("A")
        id2 = manager.create_job("B")
        manager.complete_job(id2)
        id3 = manager.create_job("C")
        manager.fail_job(id3, "error")

        stats = manager.get_statistics()
        assert stats["total"] == 3
        assert stats["completed"] == 1
        assert stats["failed"] == 1
        assert stats["running"] == 1


class TestTerminalDashboard:
    def test_format_progress_bar(self) -> None:
        bar = TerminalDashboard.format_progress_bar(0.5, 20)
        assert "█" in bar
        assert "░" in bar
        assert "50%" in bar

    def test_format_progress_bar_complete(self) -> None:
        bar = TerminalDashboard.format_progress_bar(1.0, 10)
        assert "100%" in bar
        assert "░" not in bar

    def test_format_progress_bar_empty(self) -> None:
        bar = TerminalDashboard.format_progress_bar(0.0, 10)
        assert "0%" in bar

    def test_format_duration_seconds(self) -> None:
        assert "s" in TerminalDashboard.format_duration(30.5)

    def test_format_duration_minutes(self) -> None:
        result = TerminalDashboard.format_duration(125)
        assert "m" in result

    def test_format_duration_hours(self) -> None:
        result = TerminalDashboard.format_duration(7200)
        assert "h" in result

    def test_display_no_jobs(self) -> None:
        manager = JobManager()
        dashboard = TerminalDashboard()
        output = dashboard.display(manager)
        assert "No jobs" in output

    def test_display_with_jobs(self) -> None:
        manager = JobManager()
        manager.create_job("Render Scene")
        dashboard = TerminalDashboard()
        output = dashboard.display(manager)
        assert "Render Scene" in output
        assert "running" in output
