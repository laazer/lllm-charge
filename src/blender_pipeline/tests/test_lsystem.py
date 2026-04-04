"""Tests for L-system generation."""

import pytest

from blender_pipeline.generation.lsystem import (
    LSystem,
    LSystemRule,
    LSystemGenerator,
    PRESETS,
    TurtleState,
    _rotate_vector,
    BranchSegment,
)


class TestLSystemExpansion:
    def test_simple_expansion(self) -> None:
        system = LSystem(axiom="A", rules=[LSystemRule("A", "AB"), LSystemRule("B", "A")])
        gen = LSystemGenerator()
        result = gen.expand(system, iterations=1)
        assert result == "AB"

    def test_two_iterations(self) -> None:
        system = LSystem(axiom="A", rules=[LSystemRule("A", "AB"), LSystemRule("B", "A")])
        gen = LSystemGenerator()
        result = gen.expand(system, iterations=2)
        assert result == "ABA"

    def test_three_iterations(self) -> None:
        system = LSystem(axiom="A", rules=[LSystemRule("A", "AB"), LSystemRule("B", "A")])
        gen = LSystemGenerator()
        result = gen.expand(system, iterations=3)
        assert result == "ABAAB"

    def test_string_grows_with_iterations(self) -> None:
        system = LSystem(axiom="F", rules=[LSystemRule("F", "F+F")])
        gen = LSystemGenerator()
        for iteration_count in range(1, 5):
            result = gen.expand(system, iterations=iteration_count)
            assert len(result) > iteration_count

    def test_no_matching_rule_preserves_character(self) -> None:
        system = LSystem(axiom="FX", rules=[LSystemRule("F", "FF")])
        gen = LSystemGenerator()
        result = gen.expand(system, iterations=1)
        assert result == "FFX"

    def test_all_presets_are_valid(self) -> None:
        for name, system in PRESETS.items():
            assert system.axiom, f"Preset '{name}' has empty axiom"
            assert len(system.rules) > 0, f"Preset '{name}' has no rules"
            assert system.angle > 0, f"Preset '{name}' has non-positive angle"


class TestTurtleInterpreter:
    def test_forward_produces_segment(self) -> None:
        system = LSystem(axiom="F", rules=[], length=1.0)
        gen = LSystemGenerator()
        segments = gen.interpret_to_segments("F", system)
        assert len(segments) == 1
        assert segments[0].start == [0.0, 0.0, 0.0]
        assert abs(segments[0].end[2] - 1.0) < 0.01

    def test_push_pop_restores_state(self) -> None:
        system = LSystem(axiom="F[F]F", rules=[], length=1.0)
        gen = LSystemGenerator()
        segments = gen.interpret_to_segments("F[F]F", system)
        assert len(segments) == 3
        assert abs(segments[2].start[2] - 1.0) < 0.01

    def test_branch_depth_increases(self) -> None:
        system = LSystem(axiom="F", rules=[], length=1.0)
        gen = LSystemGenerator()
        segments = gen.interpret_to_segments("[F]", system)
        assert segments[0].depth == 1

    def test_rotation_changes_direction(self) -> None:
        system = LSystem(axiom="F", rules=[], length=1.0, angle=90.0)
        gen = LSystemGenerator()
        segments_straight = gen.interpret_to_segments("FF", system)
        segments_turned = gen.interpret_to_segments("F+F", system)
        straight_end = segments_straight[1].end
        turned_end = segments_turned[1].end
        assert straight_end != turned_end


class TestRotateVector:
    def test_identity_rotation(self) -> None:
        result = _rotate_vector([1, 0, 0], [0, 0, 1], 0)
        assert abs(result[0] - 1.0) < 0.001
        assert abs(result[1]) < 0.001

    def test_90_degree_rotation(self) -> None:
        result = _rotate_vector([1, 0, 0], [0, 0, 1], 90)
        assert abs(result[0]) < 0.001
        assert abs(result[1] - 1.0) < 0.001
