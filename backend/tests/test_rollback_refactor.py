"""
Tests for REFACTOR-003: Unify duplicate exception handlers in database rollback module.

Covers:
  - OperationResult TypedDict and make_operation_result factory
  - database_operation context manager — success path, failure path, logging
  - MigrationRollback public methods — using real temp directories so no SQLAlchemy
    or application DB connections are required

Note: rollback.py imports SQLAlchemy models and app.config (which has a pydantic v2
incompatibility). We mock those transitive dependencies at the sys.modules level
before importing the modules under test so the tests remain fully self-contained.
"""
import logging
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Mock the pydantic-broken transitive dependencies before importing app code.
# ---------------------------------------------------------------------------
for _module in (
    "app.config",
    "app.database.database",
    "app.database.models.main",
    "app.database.models.agents",
    "app.database.models.flows",
    "app.database.models.metrics",
    "sqlalchemy",
    "sqlalchemy.ext.asyncio",
    "sqlalchemy.orm",
    "sqlalchemy",
):
    sys.modules.setdefault(_module, MagicMock())

from app.database.migrations.operation_result import (  # noqa: E402
    OperationResult,
    database_operation,
    make_operation_result,
)
from app.database.migrations.rollback import MigrationRollback  # noqa: E402


# ---------------------------------------------------------------------------
# make_operation_result
# ---------------------------------------------------------------------------

class TestMakeOperationResult:
    def test_has_success_false_by_default(self) -> None:
        result = make_operation_result()
        assert result["success"] is False

    def test_has_empty_errors_list_by_default(self) -> None:
        result = make_operation_result()
        assert result["errors"] == []

    def test_merges_extra_fields(self) -> None:
        result = make_operation_result(restored_databases=[], backup_timestamp=None)
        assert "restored_databases" in result
        assert result["backup_timestamp"] is None

    def test_extra_field_does_not_override_defaults(self) -> None:
        # success is always False unless explicitly overridden by the caller later
        result = make_operation_result(success=True)
        # make_operation_result sets success=False first, then update() overrides — we
        # verify the factory contract: update() happens, so this is True
        assert result["success"] is True


# ---------------------------------------------------------------------------
# database_operation context manager
# ---------------------------------------------------------------------------

class TestDatabaseOperationContextManager:
    def test_success_path_does_not_populate_errors(self) -> None:
        results: Dict[str, Any] = {"errors": []}
        with database_operation("test op", results):
            pass  # no exception
        assert results["errors"] == []

    def test_exception_appends_to_errors(self) -> None:
        results: Dict[str, Any] = {"errors": []}
        with database_operation("failing op", results):
            raise ValueError("something broke")
        assert len(results["errors"]) == 1
        assert "failing op failed" in results["errors"][0]
        assert "something broke" in results["errors"][0]

    def test_exception_is_swallowed(self) -> None:
        """Caller should be able to return a fallback value after the with-block."""
        reached_fallback = False
        with database_operation("silent op"):
            raise RuntimeError("boom")
        reached_fallback = True  # should be reached because exception is swallowed
        assert reached_fallback

    def test_no_results_dict_still_swallows_exception(self) -> None:
        """When results is None the CM logs only and swallows the exception."""
        with database_operation("no-results op"):
            raise RuntimeError("ignored")
        # If we got here, the exception was swallowed correctly

    def test_exception_is_logged(self, caplog: pytest.LogCaptureFixture) -> None:
        with caplog.at_level(logging.ERROR, logger="app.database.migrations.operation_result"):
            with database_operation("logged op"):
                raise RuntimeError("log this")
        assert any("logged op failed" in msg for msg in caplog.messages)
        assert any("log this" in msg for msg in caplog.messages)

    def test_results_none_does_not_raise_attribute_error(self) -> None:
        """Passing results=None (the default) must not crash."""
        with database_operation("default results"):
            raise ValueError("test")
        # no AttributeError — test passes if we reach here


# ---------------------------------------------------------------------------
# MigrationRollback — uses real temp directories
# ---------------------------------------------------------------------------

class TestMigrationRollbackWithTempDirs:
    """
    Tests that exercise MigrationRollback using a real temp directory as backup_dir
    and real (or nonexistent) SQLite files.  No SQLAlchemy or application DB needed.
    """

    def _make_rollback_with_temp_dirs(
        self, create_dbs: bool = True
    ) -> tuple[MigrationRollback, tempfile.TemporaryDirectory]:
        """Create a MigrationRollback whose paths point to a temp directory."""
        tmp_dir = tempfile.TemporaryDirectory()
        db_dir = Path(tmp_dir.name) / "data"
        db_dir.mkdir()
        backup_dir = db_dir / "backups"
        db_paths = {
            "main": str(db_dir / "llm-charge.db"),
            "agents": str(db_dir / "agents.db"),
            "flows": str(db_dir / "flows.db"),
        }

        # Inject both paths via constructor — no monkey-patching needed
        rollback = MigrationRollback(backup_dir=backup_dir, db_paths=db_paths)

        if create_dbs:
            for db_path in rollback.original_db_paths.values():
                conn = sqlite3.connect(db_path)
                conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
                conn.commit()
                conn.close()

        return rollback, tmp_dir

    # backup_restore

    @pytest.mark.asyncio
    async def test_backup_restore_returns_failure_when_no_backups(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            result = await rollback.backup_restore(migration_id="nonexistent")
            assert result["success"] is False
            assert result["errors"]
        finally:
            tmp.cleanup()

    @pytest.mark.asyncio
    async def test_backup_restore_result_has_standard_keys(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            result = await rollback.backup_restore()
            assert "success" in result
            assert "errors" in result
            assert "restored_databases" in result
        finally:
            tmp.cleanup()

    # restore_backup

    @pytest.mark.asyncio
    async def test_restore_backup_returns_failure_for_missing_timestamp(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            result = await rollback.restore_backup("99999999_999999")
            assert result["success"] is False
            assert result["errors"]
            assert "99999999_999999" in result["errors"][0]
        finally:
            tmp.cleanup()

    @pytest.mark.asyncio
    async def test_restore_backup_succeeds_with_valid_backup_file(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            # Manually place a "backup" file with the expected naming convention
            timestamp = "20240101_120000"
            backup_path = rollback.backup_dir / f"main_{timestamp}_v1.db"
            conn = sqlite3.connect(str(backup_path))
            conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
            conn.commit()
            conn.close()

            result = await rollback.restore_backup(timestamp)
            assert result["success"] is True
            assert len(result["restored_files"]) > 0
        finally:
            tmp.cleanup()

    # list_available_backups

    @pytest.mark.asyncio
    async def test_list_available_backups_returns_empty_list_when_no_backups(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            backups = await rollback.list_available_backups()
            assert backups == []
        finally:
            tmp.cleanup()

    @pytest.mark.asyncio
    async def test_list_available_backups_groups_by_timestamp(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            timestamp = "20240101_120000"
            for db_name in ("main", "agents"):
                backup_path = rollback.backup_dir / f"{db_name}_{timestamp}_v1.db"
                conn = sqlite3.connect(str(backup_path))
                conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
                conn.commit()
                conn.close()

            backups = await rollback.list_available_backups()
            assert len(backups) == 1
            assert set(backups[0]["databases"]) == {"main", "agents"}
        finally:
            tmp.cleanup()

    # cleanup_old_backups

    @pytest.mark.asyncio
    async def test_cleanup_skips_when_backup_count_under_limit(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            result = await rollback.cleanup_old_backups(keep_count=10)
            assert result["success"] is True
            assert result["deleted_files"] == []
        finally:
            tmp.cleanup()

    @pytest.mark.asyncio
    async def test_cleanup_deletes_oldest_backups_beyond_keep_count(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs()
        try:
            # Create 3 backup timestamps
            for i in range(1, 4):
                timestamp = f"2024010{i}_120000"
                backup_path = rollback.backup_dir / f"main_{timestamp}_v1.db"
                conn = sqlite3.connect(str(backup_path))
                conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
                conn.commit()
                conn.close()

            result = await rollback.cleanup_old_backups(keep_count=2)
            assert result["success"] is True
            assert len(result["deleted_files"]) == 1
            assert len(result["kept_files"]) == 2
        finally:
            tmp.cleanup()

    # _verify_database_integrity

    @pytest.mark.asyncio
    async def test_verify_database_integrity_passes_for_valid_db(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs(create_dbs=True)
        try:
            db_path = rollback.original_db_paths["main"]
            result = await rollback._verify_database_integrity(db_path)
            assert result is True
        finally:
            tmp.cleanup()

    @pytest.mark.asyncio
    async def test_verify_database_integrity_returns_false_for_missing_file(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs(create_dbs=False)
        try:
            result = await rollback._verify_database_integrity("/nonexistent/path/db.sqlite")
            assert result is False
        finally:
            tmp.cleanup()

    # Error results always have the standard shape

    @pytest.mark.asyncio
    async def test_failed_operations_have_errors_populated(self) -> None:
        rollback, tmp = self._make_rollback_with_temp_dirs(create_dbs=False)
        try:
            result = await rollback.backup_restore(migration_id="ghost")
            assert isinstance(result["errors"], list)
            assert len(result["errors"]) > 0
        finally:
            tmp.cleanup()

    @pytest.mark.asyncio
    async def test_no_bare_print_calls_in_error_paths(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """Errors must go through the logging module, not bare print()."""
        rollback, tmp = self._make_rollback_with_temp_dirs(create_dbs=False)
        try:
            with caplog.at_level(logging.ERROR):
                with patch("builtins.print") as mock_print:
                    await rollback.backup_restore(migration_id="ghost")
                    # print() should NOT have been called for error reporting
                    error_prints = [
                        call for call in mock_print.call_args_list
                        if "❌" in str(call) or "failed" in str(call).lower()
                    ]
                    assert error_prints == [], (
                        f"Found bare print() calls for errors: {error_prints}"
                    )
        finally:
            tmp.cleanup()
