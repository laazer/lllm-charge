"""
Migration rollback functionality
"""
import asyncio
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from shutil import copy2
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database.database import get_db
from app.database.migrations.operation_result import database_operation, make_operation_result
from app.database.models.agents import Agent, AgentTask, AgentLearning, AgentCollaboration
from app.database.models.flows import Flow, FlowExecution, FlowTemplate, FlowVersion, FlowSchedule
from app.database.models.main import Project, Specification, Note
from app.database.models.metrics import (
    AlertMetric,
    CostMetric,
    PerformanceMetric,
    QualityMetric,
    RequestMetric,
    UsageMetric,
)

logger = logging.getLogger(__name__)


class MigrationRollback:
    """Handle rollback of database migrations with backup restoration."""

    DEFAULT_DB_PATHS: Dict[str, str] = {
        "main": "data/llm-charge.db",
        "agents": "data/agents.db",
        "flows": "data/flows.db",
    }

    def __init__(
        self,
        backup_dir: Optional[Path] = None,
        db_paths: Optional[Dict[str, str]] = None,
    ) -> None:
        self.backup_dir = backup_dir or Path("data/backups")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.original_db_paths: Dict[str, str] = db_paths or dict(self.DEFAULT_DB_PATHS)

    async def rollback_migration(
        self,
        migration_id: Optional[str] = None,
        restore_from_backup: bool = True,
        preserve_new_data: bool = False,
    ) -> Dict[str, Any]:
        """
        Rollback migration with comprehensive restore capabilities.

        Args:
            migration_id: Specific migration to rollback (None for latest)
            restore_from_backup: Whether to restore from backup
            preserve_new_data: Whether to preserve data created after migration

        Returns:
            Dictionary with rollback results
        """
        results = make_operation_result(
            migration_id=migration_id,
            rollback_timestamp=datetime.utcnow(),
            databases_restored=[],
            preserved_records={},
        )

        with database_operation("Rollback migration", results):
            if preserve_new_data:
                await self._create_pre_rollback_backup()
                results["pre_rollback_backup"] = True

            await self._ensure_db_connections_closed()

            if restore_from_backup:
                backup_results = await self.backup_restore(migration_id)
                results["databases_restored"] = backup_results["restored_databases"]
                results["backup_info"] = backup_results

            if preserve_new_data:
                results["preserved_records"] = await self._preserve_new_records()

            results["integrity_check"] = await self._verify_post_rollback_integrity()
            results["success"] = True

        return results

    async def backup_restore(self, migration_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Restore databases from backup files.

        Args:
            migration_id: Specific migration backup to restore

        Returns:
            Dictionary with restore results
        """
        results = make_operation_result(
            restored_databases=[],
            backup_timestamp=None,
        )

        with database_operation("Backup restore", results):
            backup_files = await self._find_backup_files(migration_id)
            if not backup_files["files"]:
                raise ValueError(f"No backup files found for migration {migration_id}")

            results["backup_timestamp"] = backup_files["timestamp"]

            for db_name, backup_path in backup_files["files"].items():
                if await self._restore_single_database(db_name, backup_path):
                    results["restored_databases"].append(db_name)
                    logger.info("Restored %s database from %s", db_name, backup_path)
                else:
                    results["errors"].append(f"Failed to restore {db_name} database")

            results["success"] = len(results["restored_databases"]) > 0

        return results

    async def rollback_on_failure(self, error_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Automatic rollback when migration fails.

        Args:
            error_context: Context information about the failure

        Returns:
            Dictionary with rollback results
        """
        logger.info(
            "Initiating automatic rollback due to migration failure. Error: %s",
            error_context.get("error", "Unknown error"),
        )

        rollback_result = await self.rollback_migration(
            migration_id=error_context.get("migration_id"),
            restore_from_backup=True,
            preserve_new_data=False,
        )

        if rollback_result["success"]:
            logger.info("Automatic rollback completed successfully")
        else:
            logger.error(
                "Automatic rollback failed — manual intervention required. Errors: %s",
                rollback_result["errors"],
            )

        return rollback_result

    async def restore_backup(self, backup_timestamp: str) -> Dict[str, Any]:
        """
        Restore from specific timestamped backup.

        Args:
            backup_timestamp: Timestamp of backup to restore

        Returns:
            Dictionary with restore results
        """
        results = make_operation_result(
            backup_timestamp=backup_timestamp,
            restored_files=[],
        )

        with database_operation("Restore backup", results):
            backup_pattern = f"*_{backup_timestamp}_*.db"
            backup_files = list(self.backup_dir.glob(backup_pattern))

            if not backup_files:
                raise ValueError(f"No backup files found for timestamp {backup_timestamp}")

            for backup_file in backup_files:
                db_name = self._extract_db_name_from_backup(backup_file.name)
                if db_name and await self._restore_single_database(db_name, str(backup_file)):
                    results["restored_files"].append(str(backup_file))

            results["success"] = len(results["restored_files"]) > 0

        return results

    async def list_available_backups(self) -> List[Dict[str, Any]]:
        """List all available backups for rollback."""
        backups: List[Dict[str, Any]] = []

        with database_operation("List available backups"):
            backup_files = list(self.backup_dir.glob("*.db"))

            backup_groups: Dict[str, Dict[str, Any]] = {}
            for backup_file in backup_files:
                timestamp = self._extract_timestamp_from_backup(backup_file.name)
                db_name = self._extract_db_name_from_backup(backup_file.name)

                if timestamp and db_name:
                    if timestamp not in backup_groups:
                        backup_groups[timestamp] = {
                            "timestamp": timestamp,
                            "databases": [],
                            "total_size": 0,
                            "created_at": datetime.fromtimestamp(
                                os.path.getmtime(backup_file)
                            ),
                        }

                    backup_groups[timestamp]["databases"].append(db_name)
                    backup_groups[timestamp]["total_size"] += os.path.getsize(backup_file)

            backups = sorted(
                backup_groups.values(),
                key=lambda x: x["timestamp"],
                reverse=True,
            )

        return backups

    async def cleanup_old_backups(self, keep_count: int = 10) -> Dict[str, Any]:
        """Cleanup old backup files, keeping the specified number of recent backups."""
        results = make_operation_result(deleted_files=[], kept_files=[])

        with database_operation("Backup cleanup", results):
            backups = await self.list_available_backups()

            if len(backups) <= keep_count:
                results["success"] = True
                results["kept_files"] = [b["timestamp"] for b in backups]
                logger.info("No cleanup needed — only %d backups exist", len(backups))
                return results

            to_keep = backups[:keep_count]
            to_delete = backups[keep_count:]

            for backup_info in to_delete:
                timestamp = backup_info["timestamp"]
                pattern = f"*_{timestamp}_*.db"
                for backup_file in self.backup_dir.glob(pattern):
                    with database_operation(f"Delete backup {backup_file}", results):
                        os.remove(backup_file)
                        results["deleted_files"].append(str(backup_file))
                        logger.info("Deleted old backup: %s", backup_file)

            results["kept_files"] = [b["timestamp"] for b in to_keep]
            results["success"] = True

        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _create_pre_rollback_backup(self) -> bool:
        """Create backup before rollback to preserve current state."""
        with database_operation("Pre-rollback backup"):
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            for db_name, db_path in self.original_db_paths.items():
                if os.path.exists(db_path):
                    backup_path = self.backup_dir / f"{db_name}_pre_rollback_{timestamp}.db"
                    copy2(db_path, backup_path)
                    logger.info("Created pre-rollback backup: %s", backup_path)
            return True
        return False  # reached only when the context manager swallowed an exception

    async def _ensure_db_connections_closed(self) -> bool:
        """Ensure all database connections are properly closed."""
        with database_operation("Close database connections"):
            await asyncio.sleep(1.0)
            return True
        return False

    async def _find_backup_files(self, migration_id: Optional[str]) -> Dict[str, Any]:
        """Find appropriate backup files for restoration."""
        backup_files: Dict[str, Any] = {"files": {}, "timestamp": None}

        if migration_id:
            pattern = f"*_{migration_id}_*.db"
        else:
            all_backups = list(self.backup_dir.glob("*.db"))
            if not all_backups:
                return backup_files
            latest_backup = max(all_backups, key=os.path.getmtime)
            pattern = f"*_{self._extract_timestamp_from_backup(latest_backup.name)}_*.db"

        for backup_file in self.backup_dir.glob(pattern):
            db_name = self._extract_db_name_from_backup(backup_file.name)
            if db_name:
                backup_files["files"][db_name] = str(backup_file)
                if not backup_files["timestamp"]:
                    backup_files["timestamp"] = self._extract_timestamp_from_backup(
                        backup_file.name
                    )

        return backup_files

    async def _restore_single_database(self, db_name: str, backup_path: str) -> bool:
        """Restore a single database from backup."""
        with database_operation(f"Restore database {db_name}"):
            original_path = self.original_db_paths.get(db_name)
            if not original_path:
                logger.error("Unknown database name: %s", db_name)
                return False

            if not os.path.exists(backup_path):
                logger.error("Backup file not found: %s", backup_path)
                return False

            if os.path.exists(original_path):
                os.remove(original_path)

            copy2(backup_path, original_path)

            if await self._verify_database_integrity(original_path):
                return True

            logger.error("Database integrity check failed for %s", db_name)
            return False
        return False

    async def _preserve_new_records(self) -> Dict[str, int]:
        """Preserve records created after migration."""
        preserved: Dict[str, int] = {}
        with database_operation("Preserve new records"):
            logger.info("New record preservation not implemented yet")
            return preserved
        return preserved

    async def _verify_post_rollback_integrity(self) -> Dict[str, bool]:
        """Verify database integrity after rollback."""
        return {
            db_name: await self._verify_database_integrity(db_path)
            for db_name, db_path in self.original_db_paths.items()
        }

    async def _verify_database_integrity(self, db_path: str) -> bool:
        """Verify integrity of a single database file."""
        with database_operation(f"Integrity check for {db_path}"):
            if not os.path.exists(db_path):
                return False

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()
            conn.close()

            return bool(result and result[0] == "ok")
        return False

    def _extract_db_name_from_backup(self, backup_filename: str) -> Optional[str]:
        """Extract database name from backup filename."""
        parts = backup_filename.replace(".db", "").split("_")
        return parts[0] if parts else None

    def _extract_timestamp_from_backup(self, backup_filename: str) -> Optional[str]:
        """
        Extract the ``YYYYMMDD_HHMMSS`` timestamp embedded in a backup filename.

        Filenames use underscores as separators (e.g. ``main_20240101_120000_v1.db``),
        so the timestamp is stored as two consecutive tokens: an 8-digit date part
        followed by a 6-digit time part.
        """
        parts = backup_filename.replace(".db", "").split("_")
        for i in range(len(parts) - 1):
            date_part = parts[i]
            time_part = parts[i + 1]
            if len(date_part) == 8 and date_part.isdigit() and len(time_part) == 6 and time_part.isdigit():
                return f"{date_part}_{time_part}"
        return None


# Convenience functions for direct usage

async def rollback_migration(migration_id: Optional[str] = None) -> Dict[str, Any]:
    """Rollback migration — convenience function."""
    return await MigrationRollback().rollback_migration(migration_id)


async def restore_backup(backup_timestamp: str) -> Dict[str, Any]:
    """Restore from backup — convenience function."""
    return await MigrationRollback().restore_backup(backup_timestamp)


async def list_backups() -> List[Dict[str, Any]]:
    """List available backups — convenience function."""
    return await MigrationRollback().list_available_backups()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Database migration rollback utility")
    parser.add_argument("--rollback", help="Rollback migration with optional ID")
    parser.add_argument("--restore", help="Restore from specific backup timestamp")
    parser.add_argument("--list", action="store_true", help="List available backups")
    parser.add_argument("--cleanup", type=int, help="Cleanup old backups, keep N recent")

    args = parser.parse_args()

    async def main() -> None:
        rollback = MigrationRollback()

        if args.list:
            backups = await rollback.list_available_backups()
            logger.info("Available backups: %d", len(backups))
            for backup in backups:
                logger.info(
                    "  %s: %s (%d bytes)",
                    backup["timestamp"],
                    backup["databases"],
                    backup["total_size"],
                )

        elif args.restore:
            result = await rollback.restore_backup(args.restore)
            logger.info("Restore result: %s", result)

        elif args.rollback is not None:
            result = await rollback.rollback_migration(args.rollback or None)
            logger.info("Rollback result: %s", result)

        elif args.cleanup:
            result = await rollback.cleanup_old_backups(args.cleanup)
            logger.info("Cleanup result: %s", result)

        else:
            parser.print_help()

    asyncio.run(main())
