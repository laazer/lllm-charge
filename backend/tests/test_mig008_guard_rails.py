"""
Tests for MIG-008: Remove TypeScript Backend and Prevent Recurrence.

Verifies:
  - src/ has no TS server directories — only react/ and blender_pipeline/ as subdirectories
  - No .mjs server files remain in src/
  - CLAUDE.md contains the Python-Only Backend warning
  - tsconfig.json has no references to deleted backend directories
  - package.json has backend:test and dev:full scripts
  - comprehensive-working-server references don't appear in active source files
"""
import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


# ─── src/ structure ───────────────────────────────────────────────────────────

class TestSrcDirectoryStructure:
    def test_src_has_no_ts_backend_directories(self):
        """src/ must not contain TS backend directories (agents, server, reasoning, etc.)."""
        forbidden_dirs = {
            "agents", "core", "database", "intelligence", "mcp", "network",
            "reasoning", "security", "server", "skills", "utils", "workflows",
            "integrations", "cli", "routing", "specs",
        }
        src = REPO_ROOT / "src"
        if not src.exists():
            return  # src/ entirely gone is also fine
        existing_dirs = {p.name for p in src.iterdir() if p.is_dir()}
        found_forbidden = existing_dirs & forbidden_dirs
        assert not found_forbidden, (
            f"Forbidden TS backend directories still exist in src/: {found_forbidden}"
        )

    def test_src_contains_react_directory(self):
        """src/react/ must exist (React frontend)."""
        assert (REPO_ROOT / "src" / "react").is_dir(), "src/react/ is missing"

    def test_src_contains_blender_pipeline(self):
        """src/blender_pipeline/ must exist (Python Blender pipeline)."""
        assert (REPO_ROOT / "src" / "blender_pipeline").is_dir(), "src/blender_pipeline/ is missing"

    def test_no_mjs_server_files_in_src(self):
        """No .mjs files should exist in src/ (they were TS-server artefacts)."""
        src = REPO_ROOT / "src"
        mjs_files = list(src.rglob("*.mjs")) if src.exists() else []
        assert not mjs_files, f"Found .mjs files in src/: {[str(f) for f in mjs_files]}"


# ─── CLAUDE.md guard rail ────────────────────────────────────────────────────

class TestClaudeMdArchitectureRule:
    def test_claude_md_exists(self):
        """CLAUDE.md must exist at the repo root."""
        assert (REPO_ROOT / "CLAUDE.md").exists(), "CLAUDE.md is missing"

    def test_claude_md_has_python_only_warning(self):
        """CLAUDE.md must contain the Python-Only Backend warning heading."""
        content = (REPO_ROOT / "CLAUDE.md").read_text()
        assert "Python-Only Backend" in content, (
            "CLAUDE.md is missing the '⚠️ Architecture Rule: Python-Only Backend' section"
        )

    def test_claude_md_backend_is_python(self):
        """CLAUDE.md must state that the backend is Python/FastAPI."""
        content = (REPO_ROOT / "CLAUDE.md").read_text()
        assert "FastAPI" in content or "Python" in content, (
            "CLAUDE.md does not mention Python or FastAPI as the backend technology"
        )

    def test_claude_md_do_not_write_typescript_warning(self):
        """CLAUDE.md must explicitly warn against writing TypeScript for the backend."""
        content = (REPO_ROOT / "CLAUDE.md").read_text()
        assert "TYPESCRIPT" in content.upper() or "typescript" in content.lower(), (
            "CLAUDE.md should mention that TypeScript should not be used for the backend"
        )


# ─── tsconfig.json ───────────────────────────────────────────────────────────

class TestTsConfigClean:
    def test_tsconfig_exists(self):
        """tsconfig.json must exist."""
        assert (REPO_ROOT / "tsconfig.json").exists()

    def test_tsconfig_has_no_backend_path_aliases(self):
        """tsconfig.json paths must not reference deleted backend directories."""
        content = (REPO_ROOT / "tsconfig.json").read_text()
        forbidden_paths = [
            "src/core/", "src/intelligence/", "src/reasoning/",
            "src/mcp/", "src/utils/", "src/agents/", "src/server/",
        ]
        found = [p for p in forbidden_paths if p in content]
        assert not found, (
            f"tsconfig.json still references deleted backend dirs: {found}"
        )

    def test_tsconfig_includes_react_sources(self):
        """tsconfig.json include or paths must reference src/react/."""
        content = (REPO_ROOT / "tsconfig.json").read_text()
        assert "src/react" in content, (
            "tsconfig.json must include src/react/ as a source root"
        )


# ─── package.json scripts ────────────────────────────────────────────────────

class TestPackageJsonScripts:
    def _scripts(self) -> dict:
        pkg = json.loads((REPO_ROOT / "package.json").read_text())
        return pkg.get("scripts", {})

    def test_backend_test_script_exists(self):
        """package.json must have a 'backend:test' script."""
        assert "backend:test" in self._scripts(), (
            "package.json is missing 'backend:test' script"
        )

    def test_backend_test_runs_pytest(self):
        """backend:test script must invoke pytest."""
        script = self._scripts().get("backend:test", "")
        assert "pytest" in script, f"backend:test must run pytest, got: {script}"

    def test_dev_full_starts_python_backend(self):
        """dev:full script must start the Python uvicorn server."""
        scripts = self._scripts()
        dev_full = scripts.get("dev:full", "")
        dev_python = scripts.get("dev:python", "")
        combined = dev_full + dev_python
        assert "uvicorn" in combined or "python" in combined, (
            "dev:full / dev:python must start a Python/uvicorn process"
        )

    def test_dev_full_starts_frontend(self):
        """dev:full must also start the React/Vite frontend."""
        dev_full = self._scripts().get("dev:full", "")
        assert "vite" in dev_full or "dev:react" in dev_full or "concurrently" in dev_full, (
            f"dev:full should start the Vite dev server, got: {dev_full}"
        )


# ─── No comprehensive-working-server references in active source ──────────────

class TestNoTsServerReferences:
    def test_no_working_server_references_in_backend(self):
        """backend/ production code must not reference comprehensive-working-server."""
        backend = REPO_ROOT / "backend"
        this_file = Path(__file__)
        matches = []
        for ext in ("*.py", "*.json", "*.md"):
            for f in backend.rglob(ext):
                if f == this_file:
                    continue  # skip this guard-rail test file itself
                try:
                    if "comprehensive-working-server" in f.read_text():
                        matches.append(str(f))
                except Exception:
                    pass
        assert not matches, (
            f"Found comprehensive-working-server refs in backend/: {matches}"
        )

    def test_no_working_server_in_react_src(self):
        """src/react/ must not reference the old TS server."""
        react_src = REPO_ROOT / "src" / "react"
        if not react_src.exists():
            return
        matches = []
        for f in react_src.rglob("*.ts"):
            try:
                if "comprehensive-working-server" in f.read_text():
                    matches.append(str(f))
            except Exception:
                pass
        assert not matches, (
            f"Found comprehensive-working-server refs in src/react/: {matches}"
        )
