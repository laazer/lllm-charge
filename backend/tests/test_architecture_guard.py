"""Architecture guard tests — verify Python-only backend constraint (MIG-008)."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent

TS_BACKEND_DIRS = [
    "src/agents",
    "src/core",
    "src/database",
    "src/intelligence",
    "src/mcp",
    "src/network",
    "src/reasoning",
    "src/security",
    "src/server",
    "src/skills",
    "src/utils",
    "src/workflows",
    "src/integrations",
    "src/cli",
]


class TestTsBackendDirectoriesRemoved:
    def test_no_ts_server_dirs_remain(self):
        remaining = [d for d in TS_BACKEND_DIRS if (REPO_ROOT / d).is_dir()]
        assert remaining == [], f"TS backend directories still exist: {remaining}"

    def test_src_contains_only_react_and_blender_pipeline(self):
        src = REPO_ROOT / "src"
        if not src.is_dir():
            return
        actual_dirs = {p.name for p in src.iterdir() if p.is_dir()}
        allowed = {"react", "blender_pipeline", "assets"}
        unexpected = actual_dirs - allowed
        assert not unexpected, f"Unexpected directories in src/: {unexpected}"

    def test_no_mjs_server_files_in_src(self):
        src = REPO_ROOT / "src"
        if not src.is_dir():
            return
        mjs_files = list(src.rglob("*.mjs"))
        assert mjs_files == [], f".mjs server files still present: {mjs_files}"


class TestPackageJsonClean:
    def test_dev_full_script_uses_python_backend(self):
        import json
        pkg = json.loads((REPO_ROOT / "package.json").read_text())
        scripts = pkg.get("scripts", {})
        dev_full = scripts.get("dev:full", "")
        assert "uvicorn" in dev_full or "python" in dev_full, (
            f"dev:full should run Python backend but got: {dev_full}"
        )

    def test_backend_test_script_exists(self):
        import json
        pkg = json.loads((REPO_ROOT / "package.json").read_text())
        scripts = pkg.get("scripts", {})
        assert "backend:test" in scripts, "package.json missing backend:test script"


class TestClaudeMdHasArchitectureWarning:
    def test_claude_md_contains_python_only_warning(self):
        claude_md = REPO_ROOT / "CLAUDE.md"
        assert claude_md.exists(), "CLAUDE.md not found at repo root"
        content = claude_md.read_text()
        assert "Python" in content and "backend" in content.lower(), (
            "CLAUDE.md should contain Python backend architecture warning"
        )
        assert "DO NOT" in content or "python-only" in content.lower() or "Python-Only" in content, (
            "CLAUDE.md should contain a clear 'DO NOT write TypeScript for the backend' warning"
        )
