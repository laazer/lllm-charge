"""Tests for GODOT-CG-001: GDScript Symbol Parser."""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from app.codegraph.gdscript_parser import GDScriptSymbol, parse_gdscript_file


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_source(source: str, tmp_path: Path) -> list[GDScriptSymbol]:
    """Write *source* to a temp .gd file and parse it."""
    gd_file = tmp_path / "test_script.gd"
    gd_file.write_text(textwrap.dedent(source))
    return parse_gdscript_file(str(gd_file))


def symbol_names(symbols: list[GDScriptSymbol]) -> list[str]:
    return [s.name for s in symbols]


def by_type(symbols: list[GDScriptSymbol], symbol_type: str) -> list[GDScriptSymbol]:
    return [s for s in symbols if s.symbol_type == symbol_type]


# ---------------------------------------------------------------------------
# class_name
# ---------------------------------------------------------------------------

class TestClassNameDeclaration:
    def test_extracts_class_name(self, tmp_path):
        syms = parse_source("class_name PlayerController3D\n", tmp_path)
        classes = by_type(syms, "class")
        assert any(s.name == "PlayerController3D" for s in classes)

    def test_class_name_symbol_type_is_class(self, tmp_path):
        syms = parse_source("class_name MyNode\n", tmp_path)
        assert by_type(syms, "class")[0].symbol_type == "class"

    def test_class_name_line_number_is_correct(self, tmp_path):
        syms = parse_source("\nclass_name MyNode\n", tmp_path)
        cls = by_type(syms, "class")[0]
        assert cls.line == 2


# ---------------------------------------------------------------------------
# extends
# ---------------------------------------------------------------------------

class TestExtendsDeclaration:
    def test_parent_class_captured_on_class_symbol(self, tmp_path):
        syms = parse_source(
            "class_name Hero\nextends CharacterBody3D\n",
            tmp_path,
        )
        cls = by_type(syms, "class")[0]
        assert cls.parent_class == "CharacterBody3D"

    def test_extends_without_class_name_still_sets_parent(self, tmp_path):
        """A file without class_name but with extends should still record parent."""
        syms = parse_source("extends Node3D\n\nfunc _ready():\n\tpass\n", tmp_path)
        funcs = by_type(syms, "function")
        assert funcs[0].parent_class == "Node3D"


# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------

class TestFunctions:
    def test_extracts_func(self, tmp_path):
        syms = parse_source("func move(delta: float) -> void:\n\tpass\n", tmp_path)
        funcs = by_type(syms, "function")
        assert any(s.name == "move" for s in funcs)

    def test_return_type_extracted(self, tmp_path):
        syms = parse_source("func get_health() -> int:\n\treturn 100\n", tmp_path)
        func = by_type(syms, "function")[0]
        assert func.return_type == "int"

    def test_return_type_none_when_absent(self, tmp_path):
        syms = parse_source("func _ready():\n\tpass\n", tmp_path)
        func = by_type(syms, "function")[0]
        assert func.return_type is None

    def test_static_func_is_static(self, tmp_path):
        syms = parse_source("static func clamp_speed(v: float) -> float:\n\treturn v\n", tmp_path)
        func = by_type(syms, "function")[0]
        assert func.is_static is True

    def test_non_static_func_is_not_static(self, tmp_path):
        syms = parse_source("func jump():\n\tpass\n", tmp_path)
        assert by_type(syms, "function")[0].is_static is False

    def test_func_line_number(self, tmp_path):
        syms = parse_source("\n\nfunc my_func():\n\tpass\n", tmp_path)
        func = by_type(syms, "function")[0]
        assert func.line == 3


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

class TestSignals:
    def test_extracts_signal(self, tmp_path):
        syms = parse_source("signal health_changed(new_health: int)\n", tmp_path)
        signals = by_type(syms, "signal")
        assert any(s.name == "health_changed" for s in signals)

    def test_simple_signal_no_args(self, tmp_path):
        syms = parse_source("signal died\n", tmp_path)
        signals = by_type(syms, "signal")
        assert any(s.name == "died" for s in signals)

    def test_signal_line_number(self, tmp_path):
        syms = parse_source("extends Node\nsignal jumped\n", tmp_path)
        sig = by_type(syms, "signal")[0]
        assert sig.line == 2


# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

class TestVariables:
    def test_plain_var(self, tmp_path):
        syms = parse_source("var jump_count: int = 0\n", tmp_path)
        variables = by_type(syms, "variable")
        assert any(s.name == "jump_count" for s in variables)

    def test_export_var_is_exported(self, tmp_path):
        syms = parse_source("@export var speed: float = 5.0\n", tmp_path)
        var = by_type(syms, "variable")[0]
        assert var.is_exported is True

    def test_plain_var_is_not_exported(self, tmp_path):
        syms = parse_source("var speed: float = 5.0\n", tmp_path)
        assert by_type(syms, "variable")[0].is_exported is False

    def test_onready_var_extracted(self, tmp_path):
        syms = parse_source("@onready var mesh := $Mesh3D\n", tmp_path)
        variables = by_type(syms, "variable")
        assert any(s.name == "mesh" for s in variables)

    def test_static_var(self, tmp_path):
        syms = parse_source("static var instance_count: int = 0\n", tmp_path)
        var = by_type(syms, "variable")[0]
        assert var.is_static is True

    def test_export_onready_var(self, tmp_path):
        syms = parse_source("@export @onready var label: Label\n", tmp_path)
        var = by_type(syms, "variable")[0]
        assert var.is_exported is True


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

class TestConstants:
    def test_const_walrus(self, tmp_path):
        syms = parse_source("const MAX_HEALTH := 100\n", tmp_path)
        consts = by_type(syms, "constant")
        assert any(s.name == "MAX_HEALTH" for s in consts)

    def test_const_equals(self, tmp_path):
        syms = parse_source("const GRAVITY = 9.8\n", tmp_path)
        consts = by_type(syms, "constant")
        assert any(s.name == "GRAVITY" for s in consts)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TestEnums:
    def test_single_line_enum(self, tmp_path):
        syms = parse_source("enum State { IDLE, RUN, JUMP }\n", tmp_path)
        enums = by_type(syms, "enum")
        assert any(s.name == "State" for s in enums)

    def test_enum_symbol_type(self, tmp_path):
        syms = parse_source("enum Direction { UP, DOWN }\n", tmp_path)
        assert by_type(syms, "enum")[0].symbol_type == "enum"


# ---------------------------------------------------------------------------
# Inner classes
# ---------------------------------------------------------------------------

class TestInnerClasses:
    def test_inner_class_extracted(self, tmp_path):
        syms = parse_source("class HitData:\n\tvar damage: int\n", tmp_path)
        inner = by_type(syms, "inner_class")
        assert any(s.name == "HitData" for s in inner)

    def test_inner_class_symbol_type(self, tmp_path):
        syms = parse_source("class Effect:\n\tpass\n", tmp_path)
        assert by_type(syms, "inner_class")[0].symbol_type == "inner_class"


# ---------------------------------------------------------------------------
# Docstrings
# ---------------------------------------------------------------------------

class TestDocstrings:
    def test_double_hash_comment_captured_as_docstring(self, tmp_path):
        source = "## Moves the character each frame.\nfunc move(delta: float):\n\tpass\n"
        syms = parse_source(source, tmp_path)
        func = by_type(syms, "function")[0]
        assert func.docstring is not None
        assert "Moves the character" in func.docstring

    def test_no_docstring_is_none(self, tmp_path):
        syms = parse_source("func jump():\n\tpass\n", tmp_path)
        assert by_type(syms, "function")[0].docstring is None

    def test_single_hash_comment_not_captured(self, tmp_path):
        """Single # comments are regular comments, not API docstrings."""
        source = "# internal comment\nfunc jump():\n\tpass\n"
        syms = parse_source(source, tmp_path)
        assert by_type(syms, "function")[0].docstring is None

    def test_multiline_docstring(self, tmp_path):
        source = "## First line.\n## Second line.\nfunc move():\n\tpass\n"
        syms = parse_source(source, tmp_path)
        func = by_type(syms, "function")[0]
        assert "First line" in func.docstring
        assert "Second line" in func.docstring


# ---------------------------------------------------------------------------
# file_path
# ---------------------------------------------------------------------------

class TestFilePath:
    def test_file_path_set_on_all_symbols(self, tmp_path):
        source = "class_name A\nfunc f():\n\tpass\n"
        syms = parse_source(source, tmp_path)
        for s in syms:
            assert s.file_path.endswith(".gd")


# ---------------------------------------------------------------------------
# Resilience
# ---------------------------------------------------------------------------

class TestResilience:
    def test_empty_file_returns_empty_list(self, tmp_path):
        assert parse_source("", tmp_path) == []

    def test_file_with_only_comments_returns_empty(self, tmp_path):
        assert parse_source("# just a comment\n# another\n", tmp_path) == []

    def test_malformed_func_line_skipped(self, tmp_path):
        source = "func\nfunc valid():\n\tpass\n"
        syms = parse_source(source, tmp_path)
        funcs = by_type(syms, "function")
        assert len(funcs) == 1
        assert funcs[0].name == "valid"

    def test_mixed_indentation_handled(self, tmp_path):
        """Tabs and spaces both allowed without crashing."""
        source = "func a():\n\tpass\nfunc b():\n    pass\n"
        syms = parse_source(source, tmp_path)
        assert len(by_type(syms, "function")) == 2

    def test_returns_list_not_raises_on_partial_file(self, tmp_path):
        """Incomplete / truncated source must not raise."""
        source = "func incomplete("  # no closing paren or colon
        result = parse_source(source, tmp_path)
        assert isinstance(result, list)
