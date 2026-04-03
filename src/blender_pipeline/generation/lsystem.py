"""L-System grammar-based generation for trees, plants, and fractals."""

from __future__ import annotations

import logging
import math
import random
from dataclasses import dataclass, field
from typing import Any

try:
    import bpy
    import bmesh
    from mathutils import Vector, Matrix
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    bmesh = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class LSystemRule:
    """A single L-system production rule."""

    predecessor: str
    successor: str
    probability: float = 1.0


@dataclass
class LSystem:
    """Complete L-system definition."""

    axiom: str
    rules: list[LSystemRule]
    angle: float = 25.0
    length: float = 1.0
    length_decay: float = 0.7
    radius: float = 0.05
    radius_decay: float = 0.7
    iterations: int = 4


# ── Built-in presets ────────────────────────────────────────────────

TREE_PRESET = LSystem(
    axiom="F",
    rules=[LSystemRule("F", "FF+[+F-F-F]-[-F+F+F]")],
    angle=22.5,
    length=1.0,
    length_decay=0.65,
    radius=0.08,
    radius_decay=0.65,
    iterations=4,
)

BUSH_PRESET = LSystem(
    axiom="F",
    rules=[LSystemRule("F", "F[+F]F[-F]F")],
    angle=25.7,
    length=0.5,
    length_decay=0.6,
    radius=0.04,
    radius_decay=0.6,
    iterations=4,
)

FERN_PRESET = LSystem(
    axiom="X",
    rules=[
        LSystemRule("X", "F+[[X]-X]-F[-FX]+X"),
        LSystemRule("F", "FF"),
    ],
    angle=25.0,
    length=0.3,
    length_decay=0.5,
    radius=0.02,
    radius_decay=0.6,
    iterations=5,
)

CORAL_PRESET = LSystem(
    axiom="F",
    rules=[LSystemRule("F", "F[+F]F[-F][F]")],
    angle=20.0,
    length=0.4,
    length_decay=0.7,
    radius=0.06,
    radius_decay=0.75,
    iterations=4,
)

FRACTAL_PRESET = LSystem(
    axiom="F+F+F+F",
    rules=[LSystemRule("F", "F+F-F-FF+F+F-F")],
    angle=90.0,
    length=0.3,
    length_decay=0.5,
    radius=0.02,
    radius_decay=0.5,
    iterations=3,
)

PRESETS: dict[str, LSystem] = {
    "tree": TREE_PRESET,
    "bush": BUSH_PRESET,
    "fern": FERN_PRESET,
    "coral": CORAL_PRESET,
    "fractal": FRACTAL_PRESET,
}


# ── Turtle state for interpretation ─────────────────────────────────

@dataclass
class TurtleState:
    """3D turtle graphics state."""

    position: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    heading: list[float] = field(default_factory=lambda: [0.0, 0.0, 1.0])
    left: list[float] = field(default_factory=lambda: [0.0, 1.0, 0.0])
    up: list[float] = field(default_factory=lambda: [1.0, 0.0, 0.0])
    length: float = 1.0
    radius: float = 0.05
    depth: int = 0

    def copy(self) -> TurtleState:
        return TurtleState(
            position=self.position[:],
            heading=self.heading[:],
            left=self.left[:],
            up=self.up[:],
            length=self.length,
            radius=self.radius,
            depth=self.depth,
        )


def _rotate_vector(vector: list[float], axis: list[float], angle_deg: float) -> list[float]:
    """Rotate a 3D vector around an axis by angle_deg degrees (pure Python)."""
    angle = math.radians(angle_deg)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    ax, ay, az = axis
    vx, vy, vz = vector
    dot = ax * vx + ay * vy + az * vz
    cross_x = ay * vz - az * vy
    cross_y = az * vx - ax * vz
    cross_z = ax * vy - ay * vx
    return [
        vx * cos_a + cross_x * sin_a + ax * dot * (1 - cos_a),
        vy * cos_a + cross_y * sin_a + ay * dot * (1 - cos_a),
        vz * cos_a + cross_z * sin_a + az * dot * (1 - cos_a),
    ]


# ── Segment data for mesh building ──────────────────────────────────

@dataclass
class BranchSegment:
    """A single branch segment produced by the turtle interpreter."""

    start: list[float]
    end: list[float]
    radius: float
    depth: int


# ── Generator ───────────────────────────────────────────────────────

class LSystemGenerator:
    """Generates 3D structures from L-system grammars."""

    def expand(self, system: LSystem, iterations: int | None = None) -> str:
        """Apply L-system rules iteratively to produce the final instruction string."""
        iterations = iterations if iterations is not None else system.iterations
        current = system.axiom
        rng = random.Random(42)
        for _ in range(iterations):
            next_string_parts: list[str] = []
            for char in current:
                applied = False
                for rule in system.rules:
                    if char == rule.predecessor and rng.random() <= rule.probability:
                        next_string_parts.append(rule.successor)
                        applied = True
                        break
                if not applied:
                    next_string_parts.append(char)
            current = "".join(next_string_parts)
        return current

    def interpret_to_segments(self, expanded: str, system: LSystem) -> list[BranchSegment]:
        """Interpret an expanded L-system string into branch segments using turtle graphics."""
        state = TurtleState(length=system.length, radius=system.radius)
        stack: list[TurtleState] = []
        segments: list[BranchSegment] = []

        for char in expanded:
            if char == "F":
                start = state.position[:]
                end = [
                    state.position[0] + state.heading[0] * state.length,
                    state.position[1] + state.heading[1] * state.length,
                    state.position[2] + state.heading[2] * state.length,
                ]
                segments.append(BranchSegment(
                    start=start, end=end, radius=state.radius, depth=state.depth
                ))
                state.position = end
            elif char == "+":
                state.heading = _rotate_vector(state.heading, state.up, system.angle)
                state.left = _rotate_vector(state.left, state.up, system.angle)
            elif char == "-":
                state.heading = _rotate_vector(state.heading, state.up, -system.angle)
                state.left = _rotate_vector(state.left, state.up, -system.angle)
            elif char == "&":
                state.heading = _rotate_vector(state.heading, state.left, system.angle)
                state.up = _rotate_vector(state.up, state.left, system.angle)
            elif char == "^":
                state.heading = _rotate_vector(state.heading, state.left, -system.angle)
                state.up = _rotate_vector(state.up, state.left, -system.angle)
            elif char == "\\":
                state.left = _rotate_vector(state.left, state.heading, system.angle)
                state.up = _rotate_vector(state.up, state.heading, system.angle)
            elif char == "/":
                state.left = _rotate_vector(state.left, state.heading, -system.angle)
                state.up = _rotate_vector(state.up, state.heading, -system.angle)
            elif char == "[":
                stack.append(state.copy())
                state.depth += 1
                state.length *= system.length_decay
                state.radius *= system.radius_decay
            elif char == "]":
                if stack:
                    state = stack.pop()

        return segments

    def interpret_to_mesh(self, expanded: str, system: LSystem, name: str = "LSystem") -> Any:
        """Create a Blender mesh object from an expanded L-system string."""
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

        segments = self.interpret_to_segments(expanded, system)
        if not segments:
            logger.warning("No segments produced from L-system")
            bpy.ops.mesh.primitive_cube_add(size=0.01)
            obj = bpy.context.active_object
            obj.name = name
            return obj

        mesh = bpy.data.meshes.new(f"{name}_mesh")
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)

        vertices: list[tuple[float, float, float]] = []
        edges: list[tuple[int, int]] = []
        for segment in segments:
            start_idx = len(vertices)
            vertices.append(tuple(segment.start))
            vertices.append(tuple(segment.end))
            edges.append((start_idx, start_idx + 1))

        mesh.from_pydata(vertices, edges, [])
        mesh.update()
        return obj

    def generate_tree(
        self,
        preset: str = "tree",
        iterations: int | None = None,
        seed: int = 42,
    ) -> Any:
        """Generate a tree mesh from a named preset."""
        system = PRESETS[preset]
        random.seed(seed)
        expanded = self.expand(system, iterations)
        return self.interpret_to_mesh(expanded, system, name=f"Tree_{preset}")

    def generate_plant(
        self,
        preset: str = "fern",
        iterations: int | None = None,
        seed: int = 42,
    ) -> Any:
        """Generate a plant mesh from a named preset."""
        system = PRESETS[preset]
        random.seed(seed)
        expanded = self.expand(system, iterations)
        return self.interpret_to_mesh(expanded, system, name=f"Plant_{preset}")
