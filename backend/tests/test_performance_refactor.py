"""
Tests for REFACTOR-001: Split DatabasePerformanceOptimizer God Class

Covers each of the four new classes in isolation:
  - PerformanceConstants  — named constants, no logic
  - ScoringEngine         — pure score / recommendation logic, no I/O
  - DatabaseAnalyzer      — SQLite analysis via real in-memory DB
  - PerformanceOptimizer  — VACUUM/ANALYZE/index ops on a real temp DB
"""
import sqlite3
import tempfile
from pathlib import Path

import pytest

from app.database.performance.constants import PerformanceConstants
from app.database.performance.database_analyzer import DatabaseAnalyzer
from app.database.performance.performance_optimizer import PerformanceOptimizer
from app.database.performance.scoring_engine import ScoringEngine
from app.database.performance.types import BenchmarkResult, DatabaseStats


# ---------------------------------------------------------------------------
# PerformanceConstants
# ---------------------------------------------------------------------------

class TestPerformanceConstants:
    def test_fragmentation_critical_exceeds_warning(self) -> None:
        assert (
            PerformanceConstants.VACUUM_FRAGMENTATION_THRESHOLD
            > PerformanceConstants.FRAGMENTATION_WARNING_PERCENT
        )

    def test_rps_thresholds_are_ordered(self) -> None:
        assert (
            PerformanceConstants.RPS_EXCELLENT
            > PerformanceConstants.RPS_GOOD
            > PerformanceConstants.RPS_ACCEPTABLE
            > PerformanceConstants.RPS_BELOW_AVERAGE
            > PerformanceConstants.RPS_POOR
            > 0
        )

    def test_default_counts_are_positive(self) -> None:
        for attr in ("DEFAULT_INSERT_COUNT", "DEFAULT_SELECT_COUNT",
                     "DEFAULT_UPDATE_COUNT", "DEFAULT_DELETE_COUNT"):
            assert getattr(PerformanceConstants, attr) > 0

    def test_duration_penalties_are_ordered(self) -> None:
        assert (
            PerformanceConstants.DURATION_CRITICAL_MS
            > PerformanceConstants.DURATION_SLOW_MS
            > PerformanceConstants.DURATION_MODERATE_MS
            > 0
        )


# ---------------------------------------------------------------------------
# ScoringEngine — pure logic, no I/O
# ---------------------------------------------------------------------------

class TestScoringEngine:
    def setup_method(self) -> None:
        self.engine = ScoringEngine()

    # calculate_db_performance_score

    def test_perfect_database_scores_ten(self) -> None:
        score = self.engine.calculate_db_performance_score(
            file_size_mb=1.0,
            table_count=5,
            total_records=10_000,
            fragmentation_percent=0.0,
        )
        assert score == pytest.approx(10.0)

    def test_high_fragmentation_lowers_score(self) -> None:
        score_clean = self.engine.calculate_db_performance_score(0.5, 3, 5000, 0.0)
        score_frag = self.engine.calculate_db_performance_score(0.5, 3, 5000, 50.0)
        assert score_frag < score_clean

    def test_many_tables_lowers_score(self) -> None:
        score_few = self.engine.calculate_db_performance_score(1.0, 5, 10_000, 0.0)
        score_many = self.engine.calculate_db_performance_score(1.0, 50, 10_000, 0.0)
        assert score_many < score_few

    def test_score_never_goes_below_zero(self) -> None:
        score = self.engine.calculate_db_performance_score(
            file_size_mb=1000.0,
            table_count=500,
            total_records=1,
            fragmentation_percent=100.0,
        )
        assert score >= 0.0

    # calculate_overall_score

    def test_empty_results_returns_zero(self) -> None:
        assert self.engine.calculate_overall_score([]) == 0.0

    def test_all_failed_returns_zero(self) -> None:
        results = [{"success": False} for _ in range(3)]
        assert self.engine.calculate_overall_score(results) == 0.0

    def test_high_rps_yields_high_score(self) -> None:
        results = [{"success": True, "records_per_second": 2000.0, "duration_ms": 100.0}]
        assert self.engine.calculate_overall_score(results) == pytest.approx(10.0)

    def test_slow_duration_penalises_score(self) -> None:
        fast = [{"success": True, "records_per_second": 600.0, "duration_ms": 100.0}]
        slow = [{"success": True, "records_per_second": 600.0, "duration_ms": 6000.0}]
        assert self.engine.calculate_overall_score(slow) < self.engine.calculate_overall_score(fast)

    # generate_recommendations

    def test_vacuum_recommended_produces_recommendation(self) -> None:
        results = {
            "database_stats": {
                "main": {
                    "performance_score": 9.0,
                    "vacuum_recommended": True,
                    "fragmentation_percent": 15.0,
                    "file_size_mb": 1.0,
                    "total_records": 1000,
                }
            },
            "benchmark_results": [],
        }
        recs = self.engine.generate_recommendations(results)
        assert any("VACUUM" in r for r in recs)

    def test_low_score_produces_recommendation(self) -> None:
        results = {
            "database_stats": {
                "main": {
                    "performance_score": 4.0,
                    "vacuum_recommended": False,
                    "fragmentation_percent": 2.0,
                    "file_size_mb": 1.0,
                    "total_records": 1000,
                }
            },
            "benchmark_results": [],
        }
        recs = self.engine.generate_recommendations(results)
        assert any("below optimal" in r for r in recs)

    def test_slow_operation_appears_in_recommendations(self) -> None:
        results = {
            "database_stats": {},
            "benchmark_results": [
                {"operation": "INSERT", "duration_ms": 5000.0, "records_per_second": 10.0, "success": True}
            ],
        }
        recs = self.engine.generate_recommendations(results)
        assert any("INSERT" in r and "slow" in r for r in recs)


# ---------------------------------------------------------------------------
# DatabaseAnalyzer — uses a real in-memory/temp SQLite file
# ---------------------------------------------------------------------------

class TestDatabaseAnalyzer:
    def _make_temp_db(self, table_count: int = 3, records_per_table: int = 10) -> str:
        tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tf.close()
        conn = sqlite3.connect(tf.name)
        for i in range(table_count):
            conn.execute(f"CREATE TABLE t_{i} (id INTEGER PRIMARY KEY, val TEXT)")
            for j in range(records_per_table):
                conn.execute(f"INSERT INTO t_{i} (val) VALUES (?)", (f"v_{j}",))
        conn.commit()
        conn.close()
        return tf.name

    def test_returns_correct_table_count(self) -> None:
        db_path = self._make_temp_db(table_count=4)
        try:
            stats = DatabaseAnalyzer().analyze("test", db_path)
            assert stats.table_count == 4
        finally:
            Path(db_path).unlink(missing_ok=True)

    def test_total_records_matches_inserted(self) -> None:
        db_path = self._make_temp_db(table_count=2, records_per_table=5)
        try:
            stats = DatabaseAnalyzer().analyze("test", db_path)
            assert stats.total_records == 10
        finally:
            Path(db_path).unlink(missing_ok=True)

    def test_returns_zeroed_stats_on_missing_file(self) -> None:
        stats = DatabaseAnalyzer().analyze("ghost", "/nonexistent/path/db.sqlite")
        assert stats.db_name == "ghost"
        assert stats.file_size_mb == 0.0
        assert stats.performance_score == 0.0

    def test_performance_score_is_in_valid_range(self) -> None:
        db_path = self._make_temp_db()
        try:
            stats = DatabaseAnalyzer().analyze("test", db_path)
            assert 0.0 <= stats.performance_score <= 10.0
        finally:
            Path(db_path).unlink(missing_ok=True)

    def test_low_fragmentation_does_not_recommend_vacuum(self) -> None:
        db_path = self._make_temp_db()
        try:
            stats = DatabaseAnalyzer().analyze("test", db_path)
            # Fresh database should not need vacuum
            assert stats.vacuum_recommended is False
        finally:
            Path(db_path).unlink(missing_ok=True)

    def test_custom_scoring_engine_is_used(self) -> None:
        """Injected ScoringEngine is called — verifiable because a custom one always returns 0."""

        class ZeroScoringEngine(ScoringEngine):
            def calculate_db_performance_score(self, *args, **kwargs) -> float:
                return 0.0

        db_path = self._make_temp_db()
        try:
            stats = DatabaseAnalyzer(scoring_engine=ZeroScoringEngine()).analyze("test", db_path)
            assert stats.performance_score == 0.0
        finally:
            Path(db_path).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# PerformanceOptimizer — uses a real temp SQLite file
# ---------------------------------------------------------------------------

class TestPerformanceOptimizer:
    def _make_optimizer_with_db(self) -> tuple[PerformanceOptimizer, str]:
        tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tf.close()
        conn = sqlite3.connect(tf.name)
        conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, owner_id INTEGER)")
        conn.execute("INSERT INTO items (name, owner_id) VALUES ('a', 1)")
        conn.commit()
        conn.close()
        optimizer = PerformanceOptimizer({"main": tf.name})
        return optimizer, tf.name

    @pytest.mark.asyncio
    async def test_optimize_database_succeeds_on_existing_db(self) -> None:
        optimizer, db_path = self._make_optimizer_with_db()
        try:
            result = await optimizer.optimize_database("main")
            assert result["success"] is True
            assert "VACUUM completed" in result["operations"]
            assert "ANALYZE completed" in result["operations"]
        finally:
            Path(db_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_optimize_missing_database_returns_error(self) -> None:
        optimizer = PerformanceOptimizer({"main": "/nonexistent/db.sqlite"})
        result = await optimizer.optimize_database("main")
        assert result["success"] is False
        assert result["errors"]

    @pytest.mark.asyncio
    async def test_optimize_unknown_db_name_returns_error(self) -> None:
        optimizer = PerformanceOptimizer({"main": "/tmp/x.db"})
        result = await optimizer.optimize_database("nonexistent")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_index_recommendations_generated_for_foreign_key_columns(self) -> None:
        optimizer, db_path = self._make_optimizer_with_db()
        try:
            result = await optimizer.optimize_database("main")
            # owner_id column should trigger a missing-index recommendation
            index_ops = [op for op in result["operations"] if "owner_id" in op]
            assert index_ops, "Expected index recommendation for owner_id column"
        finally:
            Path(db_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_quick_performance_check_reports_existing_db(self) -> None:
        optimizer, db_path = self._make_optimizer_with_db()
        try:
            check = await optimizer.quick_performance_check()
            assert check["database_status"]["main"]["exists"] is True
            assert check["database_status"]["main"]["size_mb"] >= 0
        finally:
            Path(db_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_quick_check_flags_missing_db(self) -> None:
        optimizer = PerformanceOptimizer({"main": "/nonexistent/db.sqlite"})
        check = await optimizer.quick_performance_check()
        assert check["database_status"]["main"]["exists"] is False
        assert check["recommendations"]
