"""Tests for GODOT-CG-002: Godot Project Indexer."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.codegraph.gdscript_parser import GDScriptSymbol
from app.codegraph.godot_indexer import GodotProjectIndexer, IndexResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_symbol(name: str, symbol_type: str = "function", file_path: str = "script.gd") -> GDScriptSymbol:
    return GDScriptSymbol(
        name=name,
        symbol_type=symbol_type,
        line=1,
        file_path=file_path,
    )


@pytest.fixture
def godot_project(tmp_path: Path) -> Path:
    """Create a minimal fake Godot project tree."""
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "player.gd").write_text("func move():\n\tpass\n")
    (scripts / "enemy.gd").write_text("func attack():\n\tpass\n")

    # Should be skipped
    addons = tmp_path / "addons" / "some_plugin"
    addons.mkdir(parents=True)
    (addons / "plugin.gd").write_text("func init():\n\tpass\n")

    godot_dir = tmp_path / ".godot"
    godot_dir.mkdir()
    (godot_dir / "internal.gd").write_text("func x():\n\tpass\n")

    return tmp_path


# ---------------------------------------------------------------------------
# IndexResult
# ---------------------------------------------------------------------------

class TestIndexResult:
    def test_index_result_has_required_fields(self):
        result = IndexResult(file_count=5, symbol_count=20, duration_ms=150)
        assert result.file_count == 5
        assert result.symbol_count == 20
        assert result.duration_ms == 150


# ---------------------------------------------------------------------------
# index_project
# ---------------------------------------------------------------------------

class TestIndexProject:
    def test_index_project_returns_index_result(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file") as mock_parse:
            mock_parse.return_value = [_make_symbol("move")]
            result = indexer.index_project()
        assert isinstance(result, IndexResult)

    def test_index_project_counts_gd_files(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file") as mock_parse:
            mock_parse.return_value = [_make_symbol("f")]
            result = indexer.index_project()
        # Should find scripts/player.gd and scripts/enemy.gd — not addons or .godot
        assert result.file_count == 2

    def test_index_project_skips_addons_directory(self, godot_project):
        """addons/ .gd files must not be indexed."""
        indexer = GodotProjectIndexer(str(godot_project))
        parsed_paths: list[str] = []

        def record_call(path: str):
            parsed_paths.append(path)
            return []

        with patch("app.codegraph.godot_indexer.parse_gdscript_file", side_effect=record_call):
            indexer.index_project()

        assert not any("addons" in p for p in parsed_paths)

    def test_index_project_skips_dotgodot_directory(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        parsed_paths: list[str] = []

        def record_call(path: str):
            parsed_paths.append(path)
            return []

        with patch("app.codegraph.godot_indexer.parse_gdscript_file", side_effect=record_call):
            indexer.index_project()

        assert not any(".godot" in p for p in parsed_paths)

    def test_index_written_to_disk(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[]):
            indexer.index_project()
        index_file = godot_project / ".codegraph-godot" / "index.json"
        assert index_file.exists()

    def test_index_json_structure(self, godot_project):
        sym = _make_symbol("PlayerController3D", "class", str(godot_project / "scripts" / "player.gd"))
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[sym]):
            indexer.index_project()
        index_file = godot_project / ".codegraph-godot" / "index.json"
        data = json.loads(index_file.read_text())
        assert data["version"] == 1
        assert "indexed_at" in data
        assert "file_count" in data
        assert "symbol_count" in data
        assert "symbols" in data
        assert isinstance(data["symbols"], list)

    def test_index_file_paths_are_relative(self, godot_project):
        abs_path = str(godot_project / "scripts" / "player.gd")
        sym = _make_symbol("move", "function", abs_path)
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[sym]):
            indexer.index_project()
        data = json.loads((godot_project / ".codegraph-godot" / "index.json").read_text())
        for entry in data["symbols"]:
            assert not Path(entry["file_path"]).is_absolute(), (
                f"file_path should be relative, got: {entry['file_path']}"
            )

    def test_reindex_overwrites_old_data(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[_make_symbol("old")]):
            indexer.index_project()
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[_make_symbol("new")]):
            indexer.index_project()
        data = json.loads((godot_project / ".codegraph-godot" / "index.json").read_text())
        names = [s["name"] for s in data["symbols"]]
        assert "new" in names
        assert "old" not in names

    def test_duration_ms_is_non_negative(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[]):
            result = indexer.index_project()
        assert result.duration_ms >= 0


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------

class TestSearch:
    @pytest.fixture
    def indexed_project(self, godot_project: Path) -> GodotProjectIndexer:
        symbols = [
            _make_symbol("move_and_slide", "function", str(godot_project / "scripts" / "player.gd")),
            _make_symbol("attack", "function", str(godot_project / "scripts" / "enemy.gd")),
            _make_symbol("PlayerController3D", "class", str(godot_project / "scripts" / "player.gd")),
            _make_symbol("health_changed", "signal", str(godot_project / "scripts" / "player.gd")),
        ]
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=symbols):
            indexer.index_project()
        return indexer

    def test_search_returns_list(self, indexed_project):
        results = indexed_project.search("move")
        assert isinstance(results, list)

    def test_search_substring_match_on_name(self, indexed_project):
        results = indexed_project.search("move")
        names = [r["name"] for r in results]
        assert "move_and_slide" in names

    def test_search_case_insensitive(self, indexed_project):
        results = indexed_project.search("PLAYER")
        assert len(results) > 0

    def test_search_matches_file_path(self, indexed_project):
        results = indexed_project.search("enemy")
        assert any("enemy" in r["file_path"] for r in results)

    def test_search_filter_by_symbol_type(self, indexed_project):
        results = indexed_project.search("", symbol_type="signal")
        assert all(r["symbol_type"] == "signal" for r in results)
        assert any(r["name"] == "health_changed" for r in results)

    def test_search_filter_excludes_other_types(self, indexed_project):
        results = indexed_project.search("", symbol_type="function")
        assert not any(r["symbol_type"] == "class" for r in results)

    def test_search_limit_respected(self, indexed_project):
        results = indexed_project.search("", limit=2)
        assert len(results) <= 2

    def test_search_empty_query_returns_all_up_to_limit(self, indexed_project):
        # The mock returns 4 symbols per .gd file; godot_project has 2 .gd files → 8 total
        results = indexed_project.search("", limit=100)
        assert len(results) >= 4

    def test_search_no_match_returns_empty_list(self, indexed_project):
        results = indexed_project.search("zzz_no_such_symbol")
        assert results == []


# ---------------------------------------------------------------------------
# get_status
# ---------------------------------------------------------------------------

class TestGetStatus:
    def test_status_no_index_returns_has_index_false(self, tmp_path):
        indexer = GodotProjectIndexer(str(tmp_path))
        status = indexer.get_status()
        assert status["has_index"] is False

    def test_status_with_index_returns_has_index_true(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[_make_symbol("f")]):
            indexer.index_project()
        status = indexer.get_status()
        assert status["has_index"] is True

    def test_status_includes_file_and_symbol_count(self, godot_project):
        sym = _make_symbol("f", "function", str(godot_project / "scripts" / "player.gd"))
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[sym]):
            indexer.index_project()
        status = indexer.get_status()
        assert "file_count" in status
        assert "symbol_count" in status

    def test_status_includes_indexed_at(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[]):
            indexer.index_project()
        assert "indexed_at" in indexer.get_status()

    def test_status_includes_project_root(self, tmp_path):
        indexer = GodotProjectIndexer(str(tmp_path))
        assert "project_root" in indexer.get_status()


# ---------------------------------------------------------------------------
# invalidate
# ---------------------------------------------------------------------------

class TestInvalidate:
    def test_invalidate_removes_index(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[]):
            indexer.index_project()
        indexer.invalidate()
        assert not (godot_project / ".codegraph-godot" / "index.json").exists()

    def test_invalidate_makes_has_index_false(self, godot_project):
        indexer = GodotProjectIndexer(str(godot_project))
        with patch("app.codegraph.godot_indexer.parse_gdscript_file", return_value=[]):
            indexer.index_project()
        indexer.invalidate()
        assert indexer.get_status()["has_index"] is False

    def test_invalidate_on_missing_index_does_not_raise(self, tmp_path):
        indexer = GodotProjectIndexer(str(tmp_path))
        indexer.invalidate()  # should not raise
