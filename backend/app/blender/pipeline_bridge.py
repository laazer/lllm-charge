"""Bridge from the FastAPI backend to the src/blender_pipeline/ Python package."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict

# Path to the existing blender_pipeline package in the monorepo
PIPELINE_ROOT = Path(__file__).parent.parent.parent.parent / "src" / "blender_pipeline"


class BlenderPipelineBridge:
    """Thin bridge that shells out to the blender_pipeline orchestrator."""

    async def check_availability(self) -> Dict[str, Any]:
        """Return ``{available: bool, version: str | None}`` for the system Blender install."""
        try:
            result = subprocess.run(
                ["blender", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                version = result.stdout.strip().splitlines()[0] if result.stdout.strip() else None
                return {"available": True, "version": version}
            return {"available": False, "version": None}
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return {"available": False, "version": None}

    def _run_pipeline(self, args: list[str]) -> Dict[str, Any]:
        """Run the blender_pipeline orchestrator as a subprocess and return parsed JSON output."""
        start = time.monotonic()
        try:
            result = subprocess.run(
                [sys.executable, "-m", "blender_pipeline.orchestration.pipeline_orchestrator", *args],
                capture_output=True,
                text=True,
                cwd=str(PIPELINE_ROOT.parent),
                timeout=300,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Blender is not available on this system") from exc

        if result.returncode != 0:
            raise RuntimeError(
                f"Pipeline failed (exit {result.returncode}): {result.stderr.strip()}"
            )

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            data = {"asset_id": "", "file_path": result.stdout.strip(), "preview_url": None, "metadata": {}}

        elapsed_ms = int((time.monotonic() - start) * 1000)
        data.setdefault("generation_time_ms", elapsed_ms)
        return data

    async def generate_asset(
        self,
        prompt: str,
        asset_type: str,
        style: str,
        complexity: str,
    ) -> Dict[str, Any]:
        """Generate a 3D asset from a text prompt via the pipeline orchestrator."""
        args = [
            "--prompt", prompt,
            "--type", asset_type,
            "--style", style,
            "--complexity", complexity,
            "--output-json",
        ]
        return self._run_pipeline(args)

    async def generate_smart(self, prompt: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Smart generation with LLM-driven style selection and additional options."""
        args = [
            "--prompt", prompt,
            "--smart",
            "--output-json",
        ]
        for key, value in options.items():
            args.extend([f"--{key.replace('_', '-')}", str(value)])
        return self._run_pipeline(args)
