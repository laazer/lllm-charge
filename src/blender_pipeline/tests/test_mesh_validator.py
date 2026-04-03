"""Tests for MeshValidator — mesh geometry validation and fixing."""

from __future__ import annotations

from unittest.mock import MagicMock, call

import pytest

import blender_pipeline.quality.mesh_validator as mv_mod
from blender_pipeline.quality.mesh_validator import (
    MeshIssue,
    MeshStats,
    MeshValidator,
    ValidationResult,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patch_module(mock_blender_modules: dict) -> None:
    """Inject mock bpy/bmesh into the mesh_validator module."""
    mv_mod.HAS_BPY = True
    mv_mod.bpy = mock_blender_modules["bpy"]
    mv_mod.bmesh = mock_blender_modules["bmesh"]


def _make_obj(
    vertex_count: int = 10,
    edge_count: int = 15,
    face_count: int = 6,
    face_vert_counts: list[int] | None = None,
) -> MagicMock:
    """Return a mock Blender mesh object."""
    obj = MagicMock()
    obj.name = "TestMesh"

    vertices = [MagicMock() for _ in range(vertex_count)]
    edges = [MagicMock() for _ in range(edge_count)]

    if face_vert_counts is None:
        face_vert_counts = [3] * face_count

    polygons = []
    for vert_count in face_vert_counts:
        poly = MagicMock()
        poly.vertices = list(range(vert_count))
        polygons.append(poly)

    obj.data.vertices = vertices
    obj.data.edges = edges
    obj.data.polygons = polygons
    return obj


def _make_iterable_mock(items: list) -> MagicMock:
    """Create a MagicMock that has ensure_lookup_table() and supports iteration/len."""
    mock = MagicMock()
    mock.__iter__ = MagicMock(return_value=iter(items))
    mock.__len__ = MagicMock(return_value=len(items))
    mock.ensure_lookup_table = MagicMock()
    return mock


def _make_bmesh_mock(
    mock_blender_modules: dict,
    edges: list[MagicMock] | None = None,
    faces: list[MagicMock] | None = None,
    verts: list[MagicMock] | None = None,
) -> MagicMock:
    """Configure the bmesh.new() mock to return a bmesh with given elements."""
    mock_bmesh = mock_blender_modules["bmesh"]
    bm = MagicMock()
    bm.edges = _make_iterable_mock(edges or [])
    bm.faces = _make_iterable_mock(faces or [])
    bm.verts = _make_iterable_mock(verts or [])
    mock_bmesh.new.return_value = bm
    return bm


# ---------------------------------------------------------------------------
# Dataclass tests
# ---------------------------------------------------------------------------

class TestMeshIssue:
    def test_creation(self) -> None:
        issue = MeshIssue(
            severity="error",
            type="non_manifold",
            description="Found 3 non-manifold edges",
            affected_elements=[0, 1, 2],
        )
        assert issue.severity == "error"
        assert issue.type == "non_manifold"
        assert len(issue.affected_elements) == 3

    def test_default_affected_elements(self) -> None:
        issue = MeshIssue(severity="warning", type="test", description="test issue")
        assert issue.affected_elements == []


class TestMeshStats:
    def test_defaults_are_zero(self) -> None:
        stats = MeshStats()
        assert stats.vertex_count == 0
        assert stats.edge_count == 0
        assert stats.face_count == 0
        assert stats.triangle_count == 0
        assert stats.non_manifold_edges == 0
        assert stats.loose_vertices == 0
        assert stats.degenerate_faces == 0
        assert stats.flipped_normals == 0

    def test_custom_values(self) -> None:
        stats = MeshStats(vertex_count=100, edge_count=200, face_count=80, triangle_count=160)
        assert stats.vertex_count == 100
        assert stats.triangle_count == 160


class TestValidationResult:
    def test_defaults(self) -> None:
        result = ValidationResult()
        assert result.passed is True
        assert result.issues == []
        assert isinstance(result.stats, MeshStats)


# ---------------------------------------------------------------------------
# _compute_stats
# ---------------------------------------------------------------------------

class TestComputeStats:
    def test_counts_vertices_edges_faces(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        obj = _make_obj(vertex_count=8, edge_count=12, face_count=6, face_vert_counts=[3] * 6)
        validator = MeshValidator()
        stats = validator._compute_stats(obj)

        assert stats.vertex_count == 8
        assert stats.edge_count == 12
        assert stats.face_count == 6

    def test_triangle_count_from_polygons(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        # 2 triangles (3 verts -> 1 tri each) + 1 quad (4 verts -> 2 tris)
        obj = _make_obj(face_vert_counts=[3, 3, 4])
        validator = MeshValidator()
        stats = validator._compute_stats(obj)

        assert stats.triangle_count == 4  # 1 + 1 + 2


# ---------------------------------------------------------------------------
# validate
# ---------------------------------------------------------------------------

class TestValidate:
    def test_passes_when_no_errors(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        _make_bmesh_mock(mock_blender_modules)
        obj = _make_obj()
        validator = MeshValidator()

        # Make all checks return empty lists
        validator.check_non_manifold = MagicMock(return_value=[])
        validator.check_flipped_normals = MagicMock(return_value=[])
        validator.check_degenerate_faces = MagicMock(return_value=[])
        validator.check_loose_vertices = MagicMock(return_value=[])
        validator.check_duplicate_vertices = MagicMock(return_value=[])
        validator.check_ngons = MagicMock(return_value=[])
        validator.check_zero_length_edges = MagicMock(return_value=[])

        result = validator.validate(obj)

        assert result.passed is True
        assert result.issues == []

    def test_fails_when_error_severity_issue_exists(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        _make_bmesh_mock(mock_blender_modules)
        obj = _make_obj()
        validator = MeshValidator()

        error_issue = MeshIssue(severity="error", type="non_manifold", description="bad edges")
        validator.check_non_manifold = MagicMock(return_value=[error_issue])
        validator.check_flipped_normals = MagicMock(return_value=[])
        validator.check_degenerate_faces = MagicMock(return_value=[])
        validator.check_loose_vertices = MagicMock(return_value=[])
        validator.check_duplicate_vertices = MagicMock(return_value=[])
        validator.check_ngons = MagicMock(return_value=[])
        validator.check_zero_length_edges = MagicMock(return_value=[])

        result = validator.validate(obj)

        assert result.passed is False
        assert len(result.issues) == 1

    def test_passes_with_only_warnings(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        _make_bmesh_mock(mock_blender_modules)
        obj = _make_obj()
        validator = MeshValidator()

        warning_issue = MeshIssue(severity="warning", type="loose", description="loose verts")
        validator.check_non_manifold = MagicMock(return_value=[])
        validator.check_flipped_normals = MagicMock(return_value=[])
        validator.check_degenerate_faces = MagicMock(return_value=[])
        validator.check_loose_vertices = MagicMock(return_value=[warning_issue])
        validator.check_duplicate_vertices = MagicMock(return_value=[])
        validator.check_ngons = MagicMock(return_value=[])
        validator.check_zero_length_edges = MagicMock(return_value=[])

        result = validator.validate(obj)

        assert result.passed is True
        assert len(result.issues) == 1


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

class TestCheckNonManifold:
    def test_detects_non_manifold_edges(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        edge_bad = MagicMock()
        edge_bad.is_manifold = False
        edge_bad.is_boundary = False
        edge_bad.index = 5

        edge_ok = MagicMock()
        edge_ok.is_manifold = True
        edge_ok.is_boundary = False
        edge_ok.index = 0

        _make_bmesh_mock(mock_blender_modules, edges=[edge_ok, edge_bad])

        validator = MeshValidator()
        issues = validator.check_non_manifold(_make_obj())

        assert len(issues) == 1
        assert issues[0].severity == "error"
        assert issues[0].type == "non_manifold"
        assert 5 in issues[0].affected_elements

    def test_no_issues_when_all_manifold(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        edge = MagicMock()
        edge.is_manifold = True
        edge.is_boundary = False
        _make_bmesh_mock(mock_blender_modules, edges=[edge])

        validator = MeshValidator()
        issues = validator.check_non_manifold(_make_obj())
        assert issues == []

    def test_boundary_edges_not_flagged(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        edge = MagicMock()
        edge.is_manifold = False
        edge.is_boundary = True
        edge.index = 0
        _make_bmesh_mock(mock_blender_modules, edges=[edge])

        validator = MeshValidator()
        issues = validator.check_non_manifold(_make_obj())
        assert issues == []


class TestCheckFlippedNormals:
    def test_detects_same_winding_order(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)

        v1 = MagicMock()
        v2 = MagicMock()
        v3 = MagicMock()
        v4 = MagicMock()

        face_a = MagicMock()
        face_a.index = 0
        face_a.verts = [v1, v2, v3]
        face_a.edges = [MagicMock()]

        face_b = MagicMock()
        face_b.index = 1
        face_b.verts = [v1, v2, v4]  # same winding for v1->v2

        edge = face_a.edges[0]
        edge.link_faces = [face_a, face_b]

        _make_bmesh_mock(mock_blender_modules, faces=[face_a, face_b])

        validator = MeshValidator()
        issues = validator.check_flipped_normals(_make_obj())

        assert len(issues) == 1
        assert issues[0].severity == "warning"
        assert issues[0].type == "flipped_normals"

    def test_no_issues_with_consistent_normals(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)

        face = MagicMock()
        face.index = 0
        face.edges = [MagicMock()]
        face.edges[0].link_faces = [face]  # only one face per edge

        _make_bmesh_mock(mock_blender_modules, faces=[face])

        validator = MeshValidator()
        issues = validator.check_flipped_normals(_make_obj())
        assert issues == []


class TestCheckDegenerateFaces:
    def test_detects_zero_area_faces(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        face_bad = MagicMock()
        face_bad.calc_area.return_value = 1e-10
        face_bad.index = 0

        face_ok = MagicMock()
        face_ok.calc_area.return_value = 1.0
        face_ok.index = 1

        _make_bmesh_mock(mock_blender_modules, faces=[face_bad, face_ok])

        validator = MeshValidator()
        issues = validator.check_degenerate_faces(_make_obj())

        assert len(issues) == 1
        assert issues[0].type == "degenerate_faces"
        assert 0 in issues[0].affected_elements

    def test_no_issues_above_threshold(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        face = MagicMock()
        face.calc_area.return_value = 1.0
        face.index = 0
        _make_bmesh_mock(mock_blender_modules, faces=[face])

        validator = MeshValidator()
        issues = validator.check_degenerate_faces(_make_obj())
        assert issues == []


class TestCheckLooseVertices:
    def test_detects_unconnected_vertices(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        vert_loose = MagicMock()
        vert_loose.link_faces = []
        vert_loose.index = 3

        vert_connected = MagicMock()
        vert_connected.link_faces = [MagicMock()]
        vert_connected.index = 0

        _make_bmesh_mock(mock_blender_modules, verts=[vert_connected, vert_loose])

        validator = MeshValidator()
        issues = validator.check_loose_vertices(_make_obj())

        assert len(issues) == 1
        assert issues[0].type == "loose_vertices"
        assert 3 in issues[0].affected_elements

    def test_no_issues_when_all_connected(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        vert = MagicMock()
        vert.link_faces = [MagicMock()]
        vert.index = 0
        _make_bmesh_mock(mock_blender_modules, verts=[vert])

        validator = MeshValidator()
        issues = validator.check_loose_vertices(_make_obj())
        assert issues == []


class TestCheckDuplicateVertices:
    def test_detects_overlapping_vertices(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)

        from blender_pipeline.tests.conftest import MockVector

        vert_a = MagicMock()
        vert_a.co = MockVector([1.0, 2.0, 3.0])
        vert_a.index = 0

        vert_b = MagicMock()
        vert_b.co = MockVector([1.0, 2.0, 3.0])  # same position
        vert_b.index = 1

        _make_bmesh_mock(mock_blender_modules, verts=[vert_a, vert_b])

        validator = MeshValidator()
        issues = validator.check_duplicate_vertices(_make_obj())

        assert len(issues) == 1
        assert issues[0].type == "duplicate_vertices"
        assert 1 in issues[0].affected_elements

    def test_no_issues_when_verts_separated(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)

        from blender_pipeline.tests.conftest import MockVector

        vert_a = MagicMock()
        vert_a.co = MockVector([0.0, 0.0, 0.0])
        vert_a.index = 0

        vert_b = MagicMock()
        vert_b.co = MockVector([10.0, 10.0, 10.0])
        vert_b.index = 1

        _make_bmesh_mock(mock_blender_modules, verts=[vert_a, vert_b])

        validator = MeshValidator()
        issues = validator.check_duplicate_vertices(_make_obj())
        assert issues == []


class TestCheckNgons:
    def test_detects_faces_with_more_than_4_verts(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        face_ngon = MagicMock()
        face_ngon.verts = [MagicMock() for _ in range(6)]
        face_ngon.index = 0

        face_quad = MagicMock()
        face_quad.verts = [MagicMock() for _ in range(4)]
        face_quad.index = 1

        _make_bmesh_mock(mock_blender_modules, faces=[face_ngon, face_quad])

        validator = MeshValidator()
        issues = validator.check_ngons(_make_obj())

        assert len(issues) == 1
        assert issues[0].type == "ngons"
        assert issues[0].severity == "info"
        assert 0 in issues[0].affected_elements

    def test_no_issues_with_tris_and_quads(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        face_tri = MagicMock()
        face_tri.verts = [MagicMock() for _ in range(3)]
        face_tri.index = 0

        _make_bmesh_mock(mock_blender_modules, faces=[face_tri])

        validator = MeshValidator()
        issues = validator.check_ngons(_make_obj())
        assert issues == []


class TestCheckZeroLengthEdges:
    def test_detects_zero_length(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        edge_zero = MagicMock()
        edge_zero.calc_length.return_value = 0.0
        edge_zero.index = 2

        edge_ok = MagicMock()
        edge_ok.calc_length.return_value = 1.5
        edge_ok.index = 0

        _make_bmesh_mock(mock_blender_modules, edges=[edge_zero, edge_ok])

        validator = MeshValidator()
        issues = validator.check_zero_length_edges(_make_obj())

        assert len(issues) == 1
        assert issues[0].type == "zero_length_edges"
        assert 2 in issues[0].affected_elements

    def test_no_issues_when_all_have_length(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        edge = MagicMock()
        edge.calc_length.return_value = 0.5
        edge.index = 0
        _make_bmesh_mock(mock_blender_modules, edges=[edge])

        validator = MeshValidator()
        issues = validator.check_zero_length_edges(_make_obj())
        assert issues == []


# ---------------------------------------------------------------------------
# Fixers
# ---------------------------------------------------------------------------

class TestFixNormals:
    def test_enters_edit_mode_and_recalculates(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        mock_bpy = mock_blender_modules["bpy"]
        validator = MeshValidator()
        obj = _make_obj()

        validator.fix_normals(obj)

        mock_bpy.ops.object.mode_set.assert_any_call(mode="EDIT")
        mock_bpy.ops.mesh.normals_make_consistent.assert_called_once_with(inside=False)
        mock_bpy.ops.object.mode_set.assert_any_call(mode="OBJECT")


class TestFixLooseVertices:
    def test_removes_loose_and_updates_mesh(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        loose_vert = MagicMock()
        loose_vert.link_faces = []

        connected_vert = MagicMock()
        connected_vert.link_faces = [MagicMock()]

        bm = _make_bmesh_mock(mock_blender_modules, verts=[connected_vert, loose_vert])

        validator = MeshValidator()
        obj = _make_obj()
        count = validator.fix_loose_vertices(obj)

        assert count == 1
        bm.verts.remove.assert_called_once_with(loose_vert)
        bm.to_mesh.assert_called_once_with(obj.data)
        bm.free.assert_called_once()
        obj.data.update.assert_called_once()


class TestFixAll:
    def test_runs_all_fixes_then_validates(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        validator = MeshValidator()
        mock_result = ValidationResult(passed=True)
        validator.fix_normals = MagicMock()
        validator.fix_loose_vertices = MagicMock(return_value=0)
        validator.fix_non_manifold = MagicMock(return_value=0)
        validator.validate = MagicMock(return_value=mock_result)

        obj = _make_obj()
        result = validator.fix_all(obj)

        validator.fix_normals.assert_called_once_with(obj)
        validator.fix_loose_vertices.assert_called_once_with(obj)
        validator.fix_non_manifold.assert_called_once_with(obj)
        validator.validate.assert_called_once_with(obj)
        assert result is mock_result


# ---------------------------------------------------------------------------
# generate_report
# ---------------------------------------------------------------------------

class TestGenerateReport:
    def test_passed_report(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        validator = MeshValidator()
        result = ValidationResult(
            passed=True,
            stats=MeshStats(vertex_count=100, edge_count=200, face_count=80, triangle_count=160),
        )

        report = validator.generate_report(result)

        assert "PASSED" in report
        assert "Vertices:  100" in report
        assert "Edges:     200" in report
        assert "Faces:     80" in report
        assert "Triangles: 160" in report
        assert "No issues found." in report

    def test_failed_report_with_issues(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        validator = MeshValidator()
        result = ValidationResult(
            passed=False,
            stats=MeshStats(vertex_count=50, edge_count=100, face_count=30, triangle_count=60),
            issues=[
                MeshIssue(
                    severity="error",
                    type="non_manifold",
                    description="Found 3 non-manifold edges",
                    affected_elements=[1, 2, 3],
                ),
                MeshIssue(
                    severity="warning",
                    type="loose_vertices",
                    description="Found 2 loose vertices",
                    affected_elements=[10, 11],
                ),
            ],
        )

        report = validator.generate_report(result)

        assert "FAILED" in report
        assert "[ERROR]" in report
        assert "[WARN]" in report
        assert "non_manifold" in report
        assert "loose_vertices" in report
        assert "Issues" in report

    def test_report_truncates_large_element_lists(self, mock_blender_modules: dict) -> None:
        _patch_module(mock_blender_modules)
        validator = MeshValidator()
        many_elements = list(range(25))
        result = ValidationResult(
            passed=False,
            issues=[
                MeshIssue(
                    severity="error",
                    type="test",
                    description="many",
                    affected_elements=many_elements,
                ),
            ],
        )

        report = validator.generate_report(result)

        assert "(+15)" in report
