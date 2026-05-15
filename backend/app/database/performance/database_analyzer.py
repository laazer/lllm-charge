"""
DatabaseAnalyzer: inspects a SQLite file and returns DatabaseStats.

Separated from benchmarking so analysis can be tested with a real in-memory
SQLite database without touching benchmark I/O.
"""
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict

from .constants import PerformanceConstants
from .scoring_engine import ScoringEngine
from .types import DatabaseStats

logger = logging.getLogger(__name__)


class DatabaseAnalyzer:
    """Reads metadata from SQLite databases and produces DatabaseStats."""

    def __init__(self, scoring_engine: ScoringEngine | None = None) -> None:
        self._scoring_engine = scoring_engine or ScoringEngine()

    def analyze(self, db_name: str, db_path: str) -> DatabaseStats:
        """
        Return stats for the database at *db_path*.

        Returns a zeroed-out DatabaseStats on any error so callers always
        receive a usable object.
        """
        try:
            return self._collect_stats(db_name, db_path)
        except Exception as exc:
            logger.error("Failed to analyse %s: %s", db_name, exc)
            return self._empty_stats(db_name)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _collect_stats(self, db_name: str, db_path: str) -> DatabaseStats:
        file_size_mb = Path(db_path).stat().st_size / (1024 * 1024)

        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.cursor()
            table_count = self._count_objects(cursor, "table")
            index_count = self._count_objects(cursor, "index")
            total_records = self._count_all_records(cursor)
            fragmentation_percent = self._measure_fragmentation(cursor)
        finally:
            conn.close()

        vacuum_recommended = fragmentation_percent > PerformanceConstants.VACUUM_FRAGMENTATION_THRESHOLD

        performance_score = self._scoring_engine.calculate_db_performance_score(
            file_size_mb, table_count, total_records, fragmentation_percent
        )

        return DatabaseStats(
            db_name=db_name,
            file_size_mb=round(file_size_mb, 2),
            table_count=table_count,
            total_records=total_records,
            index_count=index_count,
            fragmentation_percent=round(fragmentation_percent, 2),
            vacuum_recommended=vacuum_recommended,
            last_analyzed=datetime.utcnow(),
            performance_score=round(performance_score, 1),
        )

    @staticmethod
    def _count_objects(cursor: sqlite3.Cursor, object_type: str) -> int:
        cursor.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type=?", (object_type,)
        )
        return cursor.fetchone()[0]

    @staticmethod
    def _count_all_records(cursor: sqlite3.Cursor) -> int:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        total = 0
        for (table_name,) in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                total += cursor.fetchone()[0]
            except sqlite3.Error:
                pass  # table inaccessible — skip
        return total

    @staticmethod
    def _measure_fragmentation(cursor: sqlite3.Cursor) -> float:
        cursor.execute("PRAGMA freelist_count")
        freelist_count = cursor.fetchone()[0]
        cursor.execute("PRAGMA page_count")
        page_count = cursor.fetchone()[0]
        return (freelist_count / max(page_count, 1)) * 100

    @staticmethod
    def _empty_stats(db_name: str) -> DatabaseStats:
        return DatabaseStats(
            db_name=db_name,
            file_size_mb=0.0,
            table_count=0,
            total_records=0,
            index_count=0,
            fragmentation_percent=0.0,
            vacuum_recommended=False,
            last_analyzed=datetime.utcnow(),
            performance_score=0.0,
        )
