"""Tests for noise generation (pure-Python Perlin noise)."""

import pytest

from blender_pipeline.generation.noise import PerlinNoise, NoiseGenerator, NoiseParams


class TestPerlinNoise:
    def test_output_range(self) -> None:
        perlin = PerlinNoise(seed=42)
        for x in range(50):
            for y in range(50):
                value = perlin.noise2d(x * 0.1, y * 0.1)
                assert -1.5 <= value <= 1.5, f"Noise value {value} out of expected range"

    def test_seed_reproducibility(self) -> None:
        perlin_a = PerlinNoise(seed=123)
        perlin_b = PerlinNoise(seed=123)
        for i in range(20):
            assert perlin_a.noise2d(i * 0.5, i * 0.3) == perlin_b.noise2d(i * 0.5, i * 0.3)

    def test_different_seeds_differ(self) -> None:
        perlin_a = PerlinNoise(seed=1)
        perlin_b = PerlinNoise(seed=99)
        values_differ = False
        for i in range(20):
            if perlin_a.noise2d(i * 0.5, i * 0.3) != perlin_b.noise2d(i * 0.5, i * 0.3):
                values_differ = True
                break
        assert values_differ, "Different seeds should produce different noise"

    def test_octave_noise_range(self) -> None:
        perlin = PerlinNoise(seed=42)
        for x in range(20):
            value = perlin.octave_noise2d(x * 0.1, x * 0.2, octaves=6)
            assert -2.0 <= value <= 2.0

    def test_octave_noise_smoothness(self) -> None:
        perlin = PerlinNoise(seed=42)
        prev = perlin.octave_noise2d(0, 0)
        max_delta = 0.0
        for i in range(1, 100):
            current = perlin.octave_noise2d(i * 0.01, 0)
            max_delta = max(max_delta, abs(current - prev))
            prev = current
        assert max_delta < 1.0, "Noise should change smoothly between nearby samples"


class TestNoiseGenerator:
    def test_compute_height_map_dimensions(self) -> None:
        generator = NoiseGenerator()
        params = NoiseParams(seed=42)
        height_map = generator.compute_height_map(10, 8, params)
        assert len(height_map) == 8
        assert len(height_map[0]) == 10

    def test_compute_height_map_seed_reproducibility(self) -> None:
        generator = NoiseGenerator()
        params = NoiseParams(seed=42)
        map_a = generator.compute_height_map(5, 5, params)
        map_b = generator.compute_height_map(5, 5, params)
        assert map_a == map_b

    def test_height_map_amplitude(self) -> None:
        generator = NoiseGenerator()
        params = NoiseParams(seed=42, amplitude=2.0)
        height_map = generator.compute_height_map(10, 10, params)
        max_val = max(max(row) for row in height_map)
        min_val = min(min(row) for row in height_map)
        assert max_val > 0 or min_val < 0, "Height map should have non-zero values"
