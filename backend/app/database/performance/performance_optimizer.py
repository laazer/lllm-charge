"""
PerformanceOptimizer: runs VACUUM/ANALYZE and index optimisation on SQLite databases.
"""
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .types import DatabaseStats

logger = logging.getLogger(__name__)


class PerformanceOptimizer:
    """Applies optimisation operations (VACUUM, ANALYZE, index recommendations) to databases."""

    def __init__(self, database_paths: Dict[str, str]) -> None:
        self._database_paths = database_paths

    async def optimize_database(self, db_name: str) -> Dict[str, Any]:
        """
        Run VACUUM, ANALYZE, and index optimisation on the named database.

        Returns a result dict with keys: database, optimization_timestamp,
        operations, success, errors.
        """
        results: Dict[str, Any] = {
            "database": db_name,
            "optimization_timestamp": datetime.utcnow(),
            "operations": [],
            "success": False,
            "errors": [],
        }

        db_path = self._database_paths.get(db_name)
        if not db_path or not Path(db_path).exists():
            results["errors"].append(f"Database {db_name} not found")
            return results

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            logger.info("Running VACUUM on %s…", db_name)
            cursor.execute("VACUUM")
            results["operations"].append("VACUUM completed")

            logger.info("Running ANALYZE on %s…", db_name)
            cursor.execute("ANALYZE")
            results["operations"].append("ANALYZE completed")

            index_ops = self._perform_index_optimization(cursor)
            results["operations"].extend(index_ops)

            conn.commit()
            conn.close()
            results["success"] = True

        except Exception as exc:
            error_msg = f"Optimisation failed for {db_name}: {exc}"
            results["errors"].append(error_msg)
            logger.error(error_msg)

        return results

    async def quick_performance_check(self) -> Dict[str, Any]:
        """Return a lightweight health summary for all databases."""
        results: Dict[str, Any] = {
            "check_timestamp": datetime.utcnow(),
            "database_status": {},
            "quick_benchmarks": [],
            "health_score": 0.0,
            "recommendations": [],
        }

        for db_name, db_path in self._database_paths.items():
            if Path(db_path).exists():
                size_mb = round(Path(db_path).stat().st_size / (1024 * 1024), 2)
                results["database_status"][db_name] = {"exists": True, "size_mb": size_mb}
            else:
                results["database_status"][db_name] = {"exists": False, "size_mb": 0}

        if any(not db["exists"] for db in results["database_status"].values()):
            results["recommendations"].append(
                "Some databases are missing — check system configuration"
            )

        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _perform_index_optimization(self, cursor: sqlite3.Cursor) -> List[str]:
        operations: List[str] = []
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            for (table_name,) in tables:
                ops = self._analyze_table_indexes(cursor, table_name)
                operations.extend(ops)
        except Exception as exc:
            operations.append(f"index_optimization error: {exc}")
        return operations

    def _analyze_table_indexes(
        self, cursor: sqlite3.Cursor, table_name: str
    ) -> List[str]:
        operations: List[str] = []
        try:
            cursor.execute("""
                SELECT sql FROM sqlite_master
                WHERE type='index' AND tbl_name=? AND sql IS NOT NULL
            """, (table_name,))
            existing_indexes = cursor.fetchall()

            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()

            for (index_sql,) in existing_indexes:
                index_name = self._extract_index_name(index_sql)
                if index_name:
                    cursor.execute(f"PRAGMA index_info({index_name})")
                    operations.append(f"Analysed index {index_name} on {table_name}")

            for col_info in columns:
                col_name = col_info[1]
                if "id" in col_name.lower() and col_name != "id":
                    has_index = any(col_name in str(idx[0]).lower() for idx in existing_indexes)
                    if not has_index:
                        operations.append(
                            f"Recommended: CREATE INDEX idx_{table_name}_{col_name} "
                            f"ON {table_name}({col_name})"
                        )

            operations.append(
                f"index_optimization completed for {table_name}: "
                f"{len(existing_indexes)} indexes found"
            )

        except sqlite3.Error as exc:
            operations.append(f"index_optimization warning for {table_name}: {exc}")
        return operations

    @staticmethod
    def _extract_index_name(index_sql: str) -> Optional[str]:
        try:
            parts = index_sql.split()
            if (
                len(parts) > 2
                and parts[0].upper() == "CREATE"
                and parts[1].upper() == "INDEX"
            ):
                return parts[2]
        except Exception:
            pass
        return None
