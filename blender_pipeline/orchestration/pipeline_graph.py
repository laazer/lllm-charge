"""Node-based generation pipeline graph with topological execution."""

from __future__ import annotations

import json
import logging
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class PipelineContext:
    """Shared state passed between pipeline nodes during execution."""

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value

    def get_object(self, name: str) -> Any:
        return self._data.get(f"object:{name}")

    def set_object(self, name: str, obj: Any) -> None:
        self._data[f"object:{name}"] = obj

    def keys(self) -> list[str]:
        return list(self._data.keys())


@dataclass
class PipelineEdge:
    """A connection between two pipeline nodes."""

    source_node: str
    source_output: str
    target_node: str
    target_input: str


class PipelineNode:
    """Base class for pipeline nodes."""

    def __init__(self, name: str, node_type: str = "base") -> None:
        self.name = name
        self.node_type = node_type
        self.inputs: dict[str, Any] = {}
        self.outputs: dict[str, Any] = {}

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        """Execute this node. Override in subclasses."""
        return {}

    def validate(self) -> bool:
        """Check if required inputs are set."""
        return True

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "node_type": self.node_type,
            "inputs": {k: str(v) for k, v in self.inputs.items()},
        }

    def __repr__(self) -> str:
        return f"<{self.node_type}:{self.name}>"


class MeshGeneratorNode(PipelineNode):
    """Generates a mesh using the parametric/noise/lsystem generators."""

    def __init__(self, name: str, generator_type: str = "parametric", params: dict | None = None) -> None:
        super().__init__(name, "mesh_generator")
        self.generator_type = generator_type
        self.inputs = params or {}

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.generation.parametric import ParametricGenerator
        generator = ParametricGenerator()
        obj = generator.generate_from_params(self.inputs)
        context.set_object(self.name, obj)
        return {"object": obj}


class ModifierNode(PipelineNode):
    """Applies a Blender modifier to an object."""

    def __init__(self, name: str, modifier_type: str = "SUBSURF", settings: dict | None = None) -> None:
        super().__init__(name, "modifier")
        self.modifier_type = modifier_type
        self.settings = settings or {}

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        try:
            import bpy
        except ImportError:
            raise RuntimeError("bpy is not available")

        input_obj = self.inputs.get("object") or context.get("last_object")
        if not input_obj:
            raise ValueError(f"ModifierNode '{self.name}' has no input object")

        modifier = input_obj.modifiers.new(name=self.modifier_type, type=self.modifier_type)
        for key, value in self.settings.items():
            setattr(modifier, key, value)

        context.set_object(self.name, input_obj)
        return {"object": input_obj}


class MaterialNode(PipelineNode):
    """Assigns a material to an object."""

    def __init__(self, name: str, material_description: str = "") -> None:
        super().__init__(name, "material")
        self.material_description = material_description

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.llm_integration.material_from_prompt import MaterialGenerator
        generator = MaterialGenerator()
        params = generator.generate_material(self.material_description)
        material = generator.create_blender_material(params, name=self.name)

        input_obj = self.inputs.get("object") or context.get("last_object")
        if input_obj:
            generator.apply_material(input_obj, material)

        return {"material": material, "object": input_obj}


class AnimationNode(PipelineNode):
    """Applies animation to an object."""

    def __init__(self, name: str, template_name: str = "bounce") -> None:
        super().__init__(name, "animation")
        self.template_name = template_name

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.animation.keyframe_templates import TemplateLibrary
        library = TemplateLibrary()
        input_obj = self.inputs.get("object") or context.get("last_object")
        if input_obj:
            library.apply_template(self.template_name, input_obj)
        return {"object": input_obj}


class ExportNode(PipelineNode):
    """Exports an object to a file."""

    def __init__(self, name: str, format: str = "glb", output_path: str = "./output") -> None:
        super().__init__(name, "export")
        self.format = format
        self.output_path = output_path

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.export.multi_format import ExportManager, ExportFormat
        manager = ExportManager()
        input_obj = self.inputs.get("object") or context.get("last_object")
        fmt = ExportFormat(self.format)
        filepath = manager.export_object(input_obj, self.output_path, fmt)
        return {"file_path": filepath}


class ValidatorNode(PipelineNode):
    """Runs mesh validation."""

    def __init__(self, name: str, auto_fix: bool = False) -> None:
        super().__init__(name, "validator")
        self.auto_fix = auto_fix

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.quality.mesh_validator import MeshValidator
        validator = MeshValidator()
        input_obj = self.inputs.get("object") or context.get("last_object")
        if self.auto_fix:
            result = validator.fix_all(input_obj)
        else:
            result = validator.validate(input_obj)
        return {"result": result, "passed": result.passed, "object": input_obj}


class LODNode(PipelineNode):
    """Generates LOD levels."""

    def __init__(self, name: str, platform: str = "desktop") -> None:
        super().__init__(name, "lod")
        self.platform = platform

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.quality.lod_generator import LODGenerator
        generator = LODGenerator()
        input_obj = self.inputs.get("object") or context.get("last_object")
        levels = generator.auto_lod_levels(input_obj, self.platform)
        lod_objects = generator.generate_lod(input_obj, levels)
        return {"lod_objects": lod_objects, "object": input_obj}


class RenderNode(PipelineNode):
    """Renders the scene or a turntable."""

    def __init__(self, name: str, render_type: str = "still", output_dir: str = "./renders") -> None:
        super().__init__(name, "render")
        self.render_type = render_type
        self.output_dir = output_dir

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        from blender_pipeline.quality.batch_render import BatchRenderer, RenderJob
        renderer = BatchRenderer()
        input_obj = self.inputs.get("object") or context.get("last_object")
        if self.render_type == "turntable" and input_obj:
            paths = renderer.render_turntable(input_obj, output_dir=self.output_dir)
            return {"output_paths": paths}
        job = RenderJob(name=self.name, output_path=self.output_dir)
        path = renderer.render_single(job)
        return {"output_path": path}


class ConditionalNode(PipelineNode):
    """Branches based on a condition."""

    def __init__(self, name: str, condition_key: str = "", threshold: float = 0) -> None:
        super().__init__(name, "conditional")
        self.condition_key = condition_key
        self.threshold = threshold

    def execute(self, context: PipelineContext) -> dict[str, Any]:
        value = context.get(self.condition_key, 0)
        result = value > self.threshold if isinstance(value, (int, float)) else bool(value)
        return {"result": result, "branch": "true" if result else "false"}


# ── Pipeline ────────────────────────────────────────────────────────

class Pipeline:
    """A directed acyclic graph of pipeline nodes."""

    def __init__(self, name: str = "pipeline") -> None:
        self.name = name
        self._nodes: dict[str, PipelineNode] = {}
        self._edges: list[PipelineEdge] = []

    def add_node(self, node: PipelineNode) -> None:
        self._nodes[node.name] = node

    def remove_node(self, name: str) -> None:
        self._nodes.pop(name, None)
        self._edges = [e for e in self._edges if e.source_node != name and e.target_node != name]

    def connect(self, source: str, output: str, target: str, input_key: str) -> None:
        self._edges.append(PipelineEdge(source, output, target, input_key))

    def get_node(self, name: str) -> PipelineNode:
        return self._nodes[name]

    def validate(self) -> list[str]:
        """Check for cycles, missing nodes, missing connections."""
        errors: list[str] = []
        for edge in self._edges:
            if edge.source_node not in self._nodes:
                errors.append(f"Missing source node: {edge.source_node}")
            if edge.target_node not in self._nodes:
                errors.append(f"Missing target node: {edge.target_node}")

        if self._has_cycle():
            errors.append("Pipeline contains a cycle")

        return errors

    def execute(self) -> PipelineContext:
        """Execute nodes in topological order."""
        errors = self.validate()
        if errors:
            raise ValueError(f"Pipeline validation failed: {errors}")

        context = PipelineContext()
        execution_order = self._topological_sort()

        for node_name in execution_order:
            node = self._nodes[node_name]
            for edge in self._edges:
                if edge.target_node == node_name:
                    source_outputs = context.get(f"outputs:{edge.source_node}", {})
                    if edge.source_output in source_outputs:
                        node.inputs[edge.target_input] = source_outputs[edge.source_output]

            logger.info("Executing node: %s (%s)", node.name, node.node_type)
            outputs = node.execute(context)
            context.set(f"outputs:{node_name}", outputs)

            if "object" in outputs:
                context.set("last_object", outputs["object"])

        return context

    def save(self, path: str | Path) -> None:
        """Serialize pipeline to JSON."""
        data = {
            "name": self.name,
            "nodes": [node.to_dict() for node in self._nodes.values()],
            "edges": [
                {
                    "source_node": e.source_node, "source_output": e.source_output,
                    "target_node": e.target_node, "target_input": e.target_input,
                }
                for e in self._edges
            ],
        }
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as file_handle:
            json.dump(data, file_handle, indent=2)

    @classmethod
    def load(cls, path: str | Path) -> Pipeline:
        """Deserialize pipeline from JSON."""
        with open(path, "r", encoding="utf-8") as file_handle:
            data = json.load(file_handle)

        pipeline = cls(name=data.get("name", "pipeline"))
        node_constructors: dict[str, type] = {
            "mesh_generator": MeshGeneratorNode,
            "modifier": ModifierNode,
            "material": MaterialNode,
            "animation": AnimationNode,
            "export": ExportNode,
            "validator": ValidatorNode,
            "lod": LODNode,
            "render": RenderNode,
            "conditional": ConditionalNode,
        }

        for node_data in data.get("nodes", []):
            node_type = node_data.get("node_type", "base")
            constructor = node_constructors.get(node_type, PipelineNode)
            node = constructor(name=node_data["name"])
            node.inputs = node_data.get("inputs", {})
            pipeline.add_node(node)

        for edge_data in data.get("edges", []):
            pipeline.connect(
                edge_data["source_node"], edge_data["source_output"],
                edge_data["target_node"], edge_data["target_input"],
            )

        return pipeline

    def visualize(self) -> str:
        """Text-based visualization of the pipeline graph."""
        lines = [f"Pipeline: {self.name}", "=" * 40]
        order = self._topological_sort()
        for node_name in order:
            node = self._nodes[node_name]
            incoming = [e for e in self._edges if e.target_node == node_name]
            outgoing = [e for e in self._edges if e.source_node == node_name]
            lines.append(f"  [{node.node_type}] {node.name}")
            for edge in incoming:
                lines.append(f"    <- {edge.source_node}.{edge.source_output}")
            for edge in outgoing:
                lines.append(f"    -> {edge.target_node}.{edge.target_input}")
        return "\n".join(lines)

    def _topological_sort(self) -> list[str]:
        """Topological sort using Kahn's algorithm."""
        in_degree: dict[str, int] = {name: 0 for name in self._nodes}
        adjacency: dict[str, list[str]] = {name: [] for name in self._nodes}

        for edge in self._edges:
            if edge.source_node in self._nodes and edge.target_node in self._nodes:
                adjacency[edge.source_node].append(edge.target_node)
                in_degree[edge.target_node] += 1

        queue: deque[str] = deque(name for name, degree in in_degree.items() if degree == 0)
        result: list[str] = []

        while queue:
            node_name = queue.popleft()
            result.append(node_name)
            for neighbor in adjacency[node_name]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        return result

    def _has_cycle(self) -> bool:
        """Detect cycles via topological sort — cycle exists if not all nodes are sorted."""
        sorted_nodes = self._topological_sort()
        return len(sorted_nodes) != len(self._nodes)


# ── Fluent Builder ──────────────────────────────────────────────────

class PipelineBuilder:
    """Fluent API for building pipelines."""

    def __init__(self, name: str = "pipeline") -> None:
        self._pipeline = Pipeline(name)
        self._last_node: Optional[str] = None

    def start_with(self, node: PipelineNode) -> PipelineBuilder:
        self._pipeline.add_node(node)
        self._last_node = node.name
        return self

    def then(self, node: PipelineNode) -> PipelineBuilder:
        self._pipeline.add_node(node)
        if self._last_node:
            self._pipeline.connect(self._last_node, "object", node.name, "object")
        self._last_node = node.name
        return self

    def branch(
        self,
        condition: ConditionalNode,
        if_true: PipelineNode,
        if_false: PipelineNode,
    ) -> PipelineBuilder:
        self._pipeline.add_node(condition)
        self._pipeline.add_node(if_true)
        self._pipeline.add_node(if_false)
        if self._last_node:
            self._pipeline.connect(self._last_node, "object", condition.name, "object")
        self._pipeline.connect(condition.name, "true", if_true.name, "object")
        self._pipeline.connect(condition.name, "false", if_false.name, "object")
        return self

    def export_to(self, format: str, path: str) -> PipelineBuilder:
        node = ExportNode(f"export_{format}", format=format, output_path=path)
        return self.then(node)

    def build(self) -> Pipeline:
        return self._pipeline
