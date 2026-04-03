"""Mesh validation — detect and fix geometry issues."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

try:
    import bpy
    import bmesh
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    bmesh = None  # type: ignore[assignment]
    HAS_BPY = False

logger = logging.getLogger(__name__)


@dataclass
class MeshIssue:
    """A single mesh validation issue."""

    severity: str  # "error", "warning", "info"
    type: str
    description: str
    affected_elements: list[int] = field(default_factory=list)


@dataclass
class MeshStats:
    """Mesh geometry statistics."""

    vertex_count: int = 0
    edge_count: int = 0
    face_count: int = 0
    triangle_count: int = 0
    non_manifold_edges: int = 0
    loose_vertices: int = 0
    degenerate_faces: int = 0
    flipped_normals: int = 0


@dataclass
class ValidationResult:
    """Complete mesh validation result."""

    passed: bool = True
    issues: list[MeshIssue] = field(default_factory=list)
    stats: MeshStats = field(default_factory=MeshStats)


class MeshValidator:
    """Validates mesh geometry and fixes common issues."""

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def _get_bmesh(self, obj: Any) -> Any:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.edges.ensure_lookup_table()
        bm.faces.ensure_lookup_table()
        bm.verts.ensure_lookup_table()
        return bm

    def validate(self, obj: Any) -> ValidationResult:
        """Run all validation checks and return a comprehensive result."""
        self._require_bpy()
        result = ValidationResult()

        result.stats = self._compute_stats(obj)
        result.issues.extend(self.check_non_manifold(obj))
        result.issues.extend(self.check_flipped_normals(obj))
        result.issues.extend(self.check_degenerate_faces(obj))
        result.issues.extend(self.check_loose_vertices(obj))
        result.issues.extend(self.check_duplicate_vertices(obj))
        result.issues.extend(self.check_ngons(obj))
        result.issues.extend(self.check_zero_length_edges(obj))

        result.passed = not any(issue.severity == "error" for issue in result.issues)
        return result

    def _compute_stats(self, obj: Any) -> MeshStats:
        mesh = obj.data
        triangle_count = sum(len(poly.vertices) - 2 for poly in mesh.polygons)
        return MeshStats(
            vertex_count=len(mesh.vertices),
            edge_count=len(mesh.edges),
            face_count=len(mesh.polygons),
            triangle_count=triangle_count,
        )

    def check_non_manifold(self, obj: Any) -> list[MeshIssue]:
        """Find non-manifold edges."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        non_manifold = [e.index for e in bm.edges if not e.is_manifold and not e.is_boundary]
        bm.free()

        if non_manifold:
            return [MeshIssue(
                severity="error",
                type="non_manifold",
                description=f"Found {len(non_manifold)} non-manifold edge(s)",
                affected_elements=non_manifold,
            )]
        return []

    def check_flipped_normals(self, obj: Any) -> list[MeshIssue]:
        """Detect faces with inconsistent normals."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        flipped: list[int] = []

        for face in bm.faces:
            for edge in face.edges:
                linked_faces = edge.link_faces
                if len(linked_faces) == 2:
                    face_a, face_b = linked_faces
                    shared_verts = set(face_a.verts) & set(face_b.verts)
                    if len(shared_verts) == 2:
                        v1, v2 = list(shared_verts)
                        order_a = _edge_order_in_face(face_a, v1, v2)
                        order_b = _edge_order_in_face(face_b, v1, v2)
                        if order_a == order_b:
                            flipped.append(face.index)
                            break

        bm.free()
        if flipped:
            return [MeshIssue(
                severity="warning",
                type="flipped_normals",
                description=f"Found {len(flipped)} face(s) with potentially flipped normals",
                affected_elements=flipped,
            )]
        return []

    def check_degenerate_faces(self, obj: Any, min_area: float = 1e-8) -> list[MeshIssue]:
        """Find faces with near-zero area."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        degenerate = [f.index for f in bm.faces if f.calc_area() < min_area]
        bm.free()

        if degenerate:
            return [MeshIssue(
                severity="warning",
                type="degenerate_faces",
                description=f"Found {len(degenerate)} degenerate face(s) with area < {min_area}",
                affected_elements=degenerate,
            )]
        return []

    def check_loose_vertices(self, obj: Any) -> list[MeshIssue]:
        """Find vertices not connected to any face."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        loose = [v.index for v in bm.verts if not v.link_faces]
        bm.free()

        if loose:
            return [MeshIssue(
                severity="warning",
                type="loose_vertices",
                description=f"Found {len(loose)} loose vertex/vertices",
                affected_elements=loose,
            )]
        return []

    def check_duplicate_vertices(self, obj: Any, threshold: float = 0.0001) -> list[MeshIssue]:
        """Find overlapping vertices within a distance threshold."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        duplicates: list[int] = []

        verts = list(bm.verts)
        for i in range(len(verts)):
            for j in range(i + 1, len(verts)):
                dist = (verts[i].co - verts[j].co).length
                if dist < threshold:
                    duplicates.append(verts[j].index)

        bm.free()
        if duplicates:
            return [MeshIssue(
                severity="warning",
                type="duplicate_vertices",
                description=f"Found {len(duplicates)} duplicate vertex/vertices (threshold={threshold})",
                affected_elements=duplicates,
            )]
        return []

    def check_ngons(self, obj: Any, max_sides: int = 4) -> list[MeshIssue]:
        """Find faces with more than max_sides vertices."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        ngons = [f.index for f in bm.faces if len(f.verts) > max_sides]
        bm.free()

        if ngons:
            return [MeshIssue(
                severity="info",
                type="ngons",
                description=f"Found {len(ngons)} n-gon(s) with more than {max_sides} sides",
                affected_elements=ngons,
            )]
        return []

    def check_zero_length_edges(self, obj: Any, threshold: float = 1e-8) -> list[MeshIssue]:
        """Find edges with near-zero length."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        zero_edges = [e.index for e in bm.edges if e.calc_length() < threshold]
        bm.free()

        if zero_edges:
            return [MeshIssue(
                severity="warning",
                type="zero_length_edges",
                description=f"Found {len(zero_edges)} zero-length edge(s)",
                affected_elements=zero_edges,
            )]
        return []

    # ── Fixers ──────────────────────────────────────────────────────

    def fix_non_manifold(self, obj: Any) -> int:
        """Attempt to fix non-manifold geometry. Returns count of fixes."""
        self._require_bpy()
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.mesh.select_non_manifold()
        bpy.ops.mesh.fill()
        bpy.ops.object.mode_set(mode="OBJECT")
        remaining = len(self.check_non_manifold(obj))
        return remaining

    def fix_normals(self, obj: Any) -> None:
        """Recalculate normals to face outside."""
        self._require_bpy()
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")

    def fix_loose_vertices(self, obj: Any) -> int:
        """Remove loose vertices. Returns count removed."""
        self._require_bpy()
        bm = self._get_bmesh(obj)
        loose = [v for v in bm.verts if not v.link_faces]
        count = len(loose)
        for vert in loose:
            bm.verts.remove(vert)
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        return count

    def fix_all(self, obj: Any) -> ValidationResult:
        """Run all fixes, then re-validate."""
        self.fix_normals(obj)
        self.fix_loose_vertices(obj)
        self.fix_non_manifold(obj)
        return self.validate(obj)

    def generate_report(self, result: ValidationResult) -> str:
        """Generate a human-readable validation report."""
        lines = ["=== Mesh Validation Report ==="]
        lines.append(f"Status: {'PASSED' if result.passed else 'FAILED'}")
        lines.append("")
        lines.append("--- Statistics ---")
        lines.append(f"  Vertices:  {result.stats.vertex_count}")
        lines.append(f"  Edges:     {result.stats.edge_count}")
        lines.append(f"  Faces:     {result.stats.face_count}")
        lines.append(f"  Triangles: {result.stats.triangle_count}")
        lines.append("")

        if result.issues:
            lines.append("--- Issues ---")
            for issue in result.issues:
                icon = {"error": "[ERROR]", "warning": "[WARN]", "info": "[INFO]"}.get(issue.severity, "[?]")
                lines.append(f"  {icon} {issue.type}: {issue.description}")
                if issue.affected_elements:
                    element_preview = issue.affected_elements[:10]
                    suffix = f"... (+{len(issue.affected_elements) - 10})" if len(issue.affected_elements) > 10 else ""
                    lines.append(f"         Elements: {element_preview}{suffix}")
        else:
            lines.append("No issues found.")

        return "\n".join(lines)


def _edge_order_in_face(face: Any, vert_a: Any, vert_b: Any) -> bool:
    """Determine the winding order of two vertices in a face."""
    verts = list(face.verts)
    for i in range(len(verts)):
        if verts[i] == vert_a and verts[(i + 1) % len(verts)] == vert_b:
            return True
    return False
