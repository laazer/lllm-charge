"""Noise-based terrain and organic shape generation."""

from __future__ import annotations

import logging
import math
import random
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


# ── Pure-Python Perlin noise fallback ───────────────────────────────

class PerlinNoise:
    """Simple 2D/3D Perlin noise implementation (fallback when 'noise' lib is unavailable)."""

    def __init__(self, seed: int = 0) -> None:
        self._rng = random.Random(seed)
        self._permutation = list(range(256))
        self._rng.shuffle(self._permutation)
        self._perm = self._permutation * 2

    @staticmethod
    def _fade(t: float) -> float:
        return t * t * t * (t * (t * 6 - 15) + 10)

    @staticmethod
    def _lerp(a: float, b: float, t: float) -> float:
        return a + t * (b - a)

    def _grad2d(self, hash_val: int, x: float, y: float) -> float:
        h = hash_val & 3
        if h == 0:
            return x + y
        if h == 1:
            return -x + y
        if h == 2:
            return x - y
        return -x - y

    def noise2d(self, x: float, y: float) -> float:
        """Return Perlin noise value in [-1, 1] for 2D coordinates."""
        xi = int(math.floor(x)) & 255
        yi = int(math.floor(y)) & 255
        xf = x - math.floor(x)
        yf = y - math.floor(y)

        u = self._fade(xf)
        v = self._fade(yf)

        perm = self._perm
        aa = perm[perm[xi] + yi]
        ab = perm[perm[xi] + yi + 1]
        ba = perm[perm[xi + 1] + yi]
        bb = perm[perm[xi + 1] + yi + 1]

        x1 = self._lerp(self._grad2d(aa, xf, yf), self._grad2d(ba, xf - 1, yf), u)
        x2 = self._lerp(self._grad2d(ab, xf, yf - 1), self._grad2d(bb, xf - 1, yf - 1), u)
        return self._lerp(x1, x2, v)

    def octave_noise2d(
        self,
        x: float,
        y: float,
        octaves: int = 6,
        persistence: float = 0.5,
        lacunarity: float = 2.0,
    ) -> float:
        """Multi-octave Perlin noise for more natural detail."""
        total = 0.0
        amplitude = 1.0
        frequency = 1.0
        max_value = 0.0

        for _ in range(octaves):
            total += self.noise2d(x * frequency, y * frequency) * amplitude
            max_value += amplitude
            amplitude *= persistence
            frequency *= lacunarity

        return total / max_value if max_value != 0 else 0.0


# ── Noise parameters ────────────────────────────────────────────────

@dataclass
class NoiseParams:
    """Parameters controlling noise generation."""

    scale: float = 1.0
    octaves: int = 6
    persistence: float = 0.5
    lacunarity: float = 2.0
    seed: int = 42
    amplitude: float = 1.0


# ── Generator ───────────────────────────────────────────────────────

class NoiseGenerator:
    """Creates terrain and organic shapes using noise displacement."""

    def __init__(self) -> None:
        self._perlin_cache: dict[int, PerlinNoise] = {}

    def _get_perlin(self, seed: int) -> PerlinNoise:
        if seed not in self._perlin_cache:
            self._perlin_cache[seed] = PerlinNoise(seed)
        return self._perlin_cache[seed]

    def _require_bpy(self) -> None:
        if not HAS_BPY:
            raise RuntimeError("bpy is not available — run inside Blender")

    def compute_height_map(
        self,
        width: int,
        height: int,
        params: NoiseParams,
    ) -> list[list[float]]:
        """Compute a 2D height map (pure Python, no Blender needed)."""
        perlin = self._get_perlin(params.seed)
        height_map: list[list[float]] = []
        for row in range(height):
            current_row: list[float] = []
            for col in range(width):
                nx = col / width * params.scale
                ny = row / height * params.scale
                value = perlin.octave_noise2d(
                    nx, ny, params.octaves, params.persistence, params.lacunarity
                )
                current_row.append(value * params.amplitude)
            height_map.append(current_row)
        return height_map

    def generate_terrain(
        self,
        size_x: float = 10.0,
        size_y: float = 10.0,
        subdivisions: int = 64,
        scale: float = 3.0,
        octaves: int = 6,
        persistence: float = 0.5,
        lacunarity: float = 2.0,
        seed: int = 42,
        height_scale: float = 2.0,
    ) -> Any:
        """Create a terrain mesh by displacing a grid with Perlin noise."""
        self._require_bpy()
        perlin = self._get_perlin(seed)

        bpy.ops.mesh.primitive_grid_add(
            x_subdivisions=subdivisions,
            y_subdivisions=subdivisions,
            size=max(size_x, size_y),
        )
        terrain = bpy.context.active_object
        terrain.name = "Terrain"
        terrain.scale = (size_x / max(size_x, size_y), size_y / max(size_x, size_y), 1.0)

        bm = bmesh.new()
        bm.from_mesh(terrain.data)
        for vert in bm.verts:
            noise_value = perlin.octave_noise2d(
                vert.co.x * scale / size_x,
                vert.co.y * scale / size_y,
                octaves,
                persistence,
                lacunarity,
            )
            vert.co.z = noise_value * height_scale
        bm.to_mesh(terrain.data)
        bm.free()
        terrain.data.update()
        return terrain

    def generate_rock(
        self,
        base_radius: float = 1.0,
        detail: int = 3,
        noise_scale: float = 0.8,
        seed: int = 42,
    ) -> Any:
        """Create a rock-like shape from a displaced icosphere."""
        self._require_bpy()
        perlin = self._get_perlin(seed)

        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=base_radius, subdivisions=detail
        )
        rock = bpy.context.active_object
        rock.name = "Rock"

        bm = bmesh.new()
        bm.from_mesh(rock.data)
        for vert in bm.verts:
            displacement = perlin.octave_noise2d(
                vert.co.x * 2.0 + vert.co.z,
                vert.co.y * 2.0 + vert.co.z,
                octaves=4,
                persistence=0.5,
                lacunarity=2.0,
            )
            direction = vert.co.normalized()
            vert.co += direction * displacement * noise_scale
        bm.to_mesh(rock.data)
        bm.free()
        rock.data.update()
        return rock

    def generate_organic_surface(
        self,
        base_object: Any,
        noise_params: NoiseParams,
    ) -> Any:
        """Apply noise displacement to an existing mesh."""
        self._require_bpy()
        perlin = self._get_perlin(noise_params.seed)

        bm = bmesh.new()
        bm.from_mesh(base_object.data)
        for vert in bm.verts:
            displacement = perlin.octave_noise2d(
                vert.co.x * noise_params.scale,
                vert.co.y * noise_params.scale,
                noise_params.octaves,
                noise_params.persistence,
                noise_params.lacunarity,
            )
            normal = vert.normal if vert.normal.length > 0 else vert.co.normalized()
            vert.co += normal * displacement * noise_params.amplitude
        bm.to_mesh(base_object.data)
        bm.free()
        base_object.data.update()
        return base_object

    def generate_mountain_range(
        self,
        length: float = 20.0,
        width: float = 10.0,
        peaks: int = 5,
        height_scale: float = 4.0,
        seed: int = 42,
    ) -> Any:
        """Create an elongated terrain with distinct peaks."""
        self._require_bpy()
        perlin = self._get_perlin(seed)
        rng = random.Random(seed)

        terrain = self.generate_terrain(
            size_x=length,
            size_y=width,
            subdivisions=128,
            scale=4.0,
            height_scale=height_scale * 0.3,
            seed=seed,
        )

        peak_positions = [(rng.uniform(-length / 2, length / 2), rng.uniform(-width / 3, width / 3)) for _ in range(peaks)]

        bm = bmesh.new()
        bm.from_mesh(terrain.data)
        for vert in bm.verts:
            for peak_x, peak_y in peak_positions:
                distance = math.sqrt((vert.co.x - peak_x) ** 2 + (vert.co.y - peak_y) ** 2)
                peak_radius = rng.uniform(2.0, 4.0)
                influence = max(0.0, 1.0 - distance / peak_radius)
                vert.co.z += influence ** 2 * height_scale
        bm.to_mesh(terrain.data)
        bm.free()
        terrain.data.update()
        terrain.name = "MountainRange"
        return terrain
