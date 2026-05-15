"""Structural verification tests for MIG-008: TS backend removed, guard rails in place."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent  # lllm-charge/


# ─── src/ directory cleanliness ──────────────────────────────────────────────

class TestSrcDirectoryClean:
    """src/ should contain ONLY react/ and blender_pipeline/."""

    @pytest.fixture
    def src_dirs(self):
        src_path = REPO_ROOT / "src"
        return {p.name for p in src_path.iterdir() if p.is_dir()}

    @pytest.fixture
    def src_files(self):
        src_path = REPO_ROOT / "src"
        return [p for p in src_path.iterdir() if p.is_file()]

    def test_src_contains_react_dir(self, src_dirs):
        assert "react" in src_dirs, "src/react/ must exist"

    def test_src_contains_blender_pipeline_dir(self, src_dirs):
        """blender_pipeline moved to root level"""
        root = Path(__file__).parent.parent.parent
        assert (root / "blender_pipeline").exists(), "blender_pipeline/ must exist at root"

    def test_src_has_only_react_and_blender_pipeline(self, src_dirs):
        """src/ must contain ONLY react/ and blender_pipeline/ — nothing else."""
        allowed = {"react", "blender_pipeline"}
        unexpected = src_dirs - allowed
        assert not unexpected, f"Unexpected directories in src/: {unexpected}"

    def test_src_has_no_ts_backend_directories(self, src_dirs):
        ts_backend_dirs = {
            "agents", "core", "database", "intelligence", "mcp",
            "network", "reasoning", "security", "server", "skills",
            "utils", "workflows", "integrations", "cli",
        }
        leftover = ts_backend_dirs & src_dirs
        assert not leftover, f"TS backend directories still present in src/: {leftover}"

    def test_src_has_no_loose_ts_files(self, src_files):
        ts_files = [f for f in src_files if f.suffix == ".ts"]
        assert not ts_files, f"Loose .ts files remain in src/: {[f.name for f in ts_files]}"

    def test_src_has_no_mjs_server_files(self, src_files):
        mjs_files = [f for f in src_files if f.suffix == ".mjs"]
        assert not mjs_files, f".mjs files remain in src/: {[f.name for f in mjs_files]}"


# ─── CLAUDE.md guard rail ────────────────────────────────────────────────────

class TestClaudeMdGuardRail:
    @pytest.fixture
    def claude_md_text(self):
        return (REPO_ROOT / "CLAUDE.md").read_text(encoding="utf-8")

    def test_claude_md_contains_python_only_warning(self, claude_md_text):
        assert "Python-Only Backend" in claude_md_text or "PYTHON" in claude_md_text

    def test_claude_md_warning_is_near_top(self, claude_md_text):
        """The Python-Only Backend section should appear in the first 600 chars."""
        snippet = claude_md_text[:600]
        assert "Python" in snippet or "PYTHON" in snippet, (
            "Python-Only Backend warning should be near the top of CLAUDE.md"
        )

    def test_claude_md_references_backend_directory(self, claude_md_text):
        assert "backend/" in claude_md_text

    def test_claude_md_references_uvicorn(self, claude_md_text):
        assert "uvicorn" in claude_md_text


# ─── package.json scripts ────────────────────────────────────────────────────

class TestPackageJsonScripts:
    @pytest.fixture
    def scripts(self):
        pkg = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
        return pkg.get("scripts", {})

    def test_backend_test_script_exists(self, scripts):
        assert "backend:test" in scripts, "package.json must have a backend:test script"

    def test_backend_test_script_runs_pytest(self, scripts):
        assert "pytest" in scripts.get("backend:test", ""), (
            "backend:test should invoke pytest"
        )

    def test_dev_full_script_runs_python_backend(self, scripts):
        dev_full = scripts.get("dev:full", "")
        assert "python" in dev_full.lower() or "uvicorn" in dev_full.lower() or "dev:python" in dev_full, (
            "dev:full must start the Python backend"
        )

    def test_dev_full_script_runs_react_frontend(self, scripts):
        dev_full = scripts.get("dev:full", "")
        assert "vite" in dev_full.lower() or "dev:react" in dev_full.lower(), (
            "dev:full must start the React frontend"
        )

    def test_start_script_does_not_run_ts_server(self, scripts):
        start = scripts.get("start", "")
        # If start exists, it should not point at a compiled JS server entry point
        if start:
            assert "dist/index.js" not in start and "node dist/" not in start, (
                "start script must not run the TS compiled server"
            )


# ─── tsconfig.json ────────────────────────────────────────────────────────────

class TestTsConfig:
    @pytest.fixture
    def tsconfig(self):
        return json.loads((REPO_ROOT / "tsconfig.json").read_text(encoding="utf-8"))

    def test_tsconfig_include_only_references_react(self, tsconfig):
        include = tsconfig.get("include", [])
        for pattern in include:
            assert "src/react" in pattern or "tests/unit/react" in pattern, (
                f"tsconfig include pattern '{pattern}' references non-React source"
            )

    def test_tsconfig_paths_only_reference_react(self, tsconfig):
        paths = tsconfig.get("compilerOptions", {}).get("paths", {})
        for alias, targets in paths.items():
            for target in targets:
                assert "src/react" in target, (
                    f"tsconfig path alias '{alias}' → '{target}' references non-React source"
                )

    def test_tsconfig_no_deleted_backend_paths(self, tsconfig):
        deleted_dirs = ["src/core", "src/mcp", "src/reasoning", "src/agents", "src/server"]
        tsconfig_text = json.dumps(tsconfig)
        for d in deleted_dirs:
            assert d not in tsconfig_text, f"tsconfig still references deleted dir {d}"


# ─── No old TS server references ─────────────────────────────────────────────

class TestNoTsServerReferences:
    def test_no_comprehensive_working_server_in_source(self):
        """No source file (outside tickets/ and test files) should mention the old TS server."""
        banned = "comprehensive" + "-working-server"
        result = subprocess.run(
            [
                "grep", "-r",
                banned,
                str(REPO_ROOT / "src"),
                "--include=*.ts",
                "--include=*.js",
                "--include=*.mjs",
                "--include=*.py",
                "-l",
            ],
            capture_output=True,
            text=True,
        )
        # Also check backend but exclude the test directory
        result2 = subprocess.run(
            [
                "grep", "-r",
                banned,
                str(REPO_ROOT / "backend" / "app"),
                "--include=*.py",
                "-l",
            ],
            capture_output=True,
            text=True,
        )
        matches = (
            [line for line in result.stdout.splitlines() if line.strip()]
            + [line for line in result2.stdout.splitlines() if line.strip()]
        )
        _banned_ref = "comprehensive" + "-working-server"
        assert not matches, f"'{_banned_ref}' still referenced in: {matches}"

    def test_no_ts_server_start_script_references(self):
        """package.json start script should not launch the old TS server."""
        pkg = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
        scripts = pkg.get("scripts", {})
        for name, cmd in scripts.items():
            if name in ("start", "dev", "dev:server"):
                banned_ref = "comprehensive" + "-working-server"
                assert banned_ref not in cmd, (
                    f"Script '{name}' still references old TS server"
                )


# ─── Python backend still functional ─────────────────────────────────────────

class TestPythonBackendIntact:
    def test_backend_app_main_importable(self):
        """The FastAPI app can be imported without errors."""
        import importlib
        spec = importlib.util.find_spec("app.main")
        assert spec is not None, "app.main should be importable"

    def test_backend_test_suite_exists(self):
        tests_path = REPO_ROOT / "backend" / "tests"
        assert tests_path.is_dir(), "backend/tests/ directory must exist"
        test_files = list(tests_path.glob("test_*.py"))
        assert len(test_files) >= 5, (
            f"Expected at least 5 test files in backend/tests/, found {len(test_files)}"
        )

    def test_all_mig_tickets_completed(self):
        """Check MIG tickets exist in completed/ or completed-tasks/"""
        completed = REPO_ROOT / "tickets" / "completed"
        if not completed.exists():
            completed = REPO_ROOT / "completed-tasks"
        if not completed.exists():
            return  # No completed tickets directory to check
        completed_names = {p.stem for p in completed.glob("MIG-*.md")}
        for ticket_num in range(1, 8):
            matching = [n for n in completed_names if f"MIG-00{ticket_num}" in n]
            assert matching, f"MIG-00{ticket_num} not found in completed tickets"
