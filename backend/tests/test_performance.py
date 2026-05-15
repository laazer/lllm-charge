"""
Tests for REFACTOR-001: Split DatabasePerformanceOptimizer God Class

Acceptance criteria:
- Class split into BenchmarkRunner, DatabaseAnalyzer, PerformanceOptimizer, ScoringEngine
- Four benchmark methods replaced by single parameterized template
- Magic numbers extracted to PerformanceConstants
- DB paths injected via constructor (not hard-coded)
- run_comprehensive_benchmark broken into small, independently callable steps
- Each class has unit tests that run without the real file system
"""
import pytest
import sqlite3
import tempfile
import os
from pathlib import Path
from datetime import datetime


# ── PerformanceConstants ──────────────────────────────────────────────────────

class TestPerformanceConstants:
    def test_kb_per_record_threshold_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'KB_PER_RECORD_THRESHOLD')
        assert PerformanceConstants.KB_PER_RECORD_THRESHOLD == 0.001

    def test_max_fragmentation_penalty_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'MAX_FRAGMENTATION_PENALTY')
        assert PerformanceConstants.MAX_FRAGMENTATION_PENALTY == 3.0

    def test_max_file_size_penalty_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'MAX_FILE_SIZE_PENALTY')
        assert PerformanceConstants.MAX_FILE_SIZE_PENALTY == 2.0

    def test_max_table_count_penalty_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'MAX_TABLE_COUNT_PENALTY')
        assert PerformanceConstants.MAX_TABLE_COUNT_PENALTY == 1.0

    def test_fragmentation_penalty_threshold_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'FRAGMENTATION_PENALTY_THRESHOLD')
        assert PerformanceConstants.FRAGMENTATION_PENALTY_THRESHOLD == 5

    def test_table_count_penalty_threshold_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'TABLE_COUNT_PENALTY_THRESHOLD')
        assert PerformanceConstants.TABLE_COUNT_PENALTY_THRESHOLD == 20

    def test_vacuum_fragmentation_threshold_exists(self):
        from app.database.performance import PerformanceConstants
        assert hasattr(PerformanceConstants, 'VACUUM_FRAGMENTATION_THRESHOLD')
        assert PerformanceConstants.VACUUM_FRAGMENTATION_THRESHOLD == 10


# ── DatabaseAnalyzer ──────────────────────────────────────────────────────────

@pytest.fixture
def temp_sqlite_db():
    """A tiny real SQLite DB for analyzer tests — no app models needed."""
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("CREATE INDEX idx_items_name ON items(name)")
    for i in range(5):
        conn.execute("INSERT INTO items (name) VALUES (?)", (f"item_{i}",))
    conn.commit()
    conn.close()
    yield path
    Path(path).unlink(missing_ok=True)


class TestDatabaseAnalyzer:
    def test_constructor_accepts_db_path(self, temp_sqlite_db):
        from app.database.performance import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        assert analyzer is not None

    def test_analyze_stats_returns_database_stats(self, temp_sqlite_db):
        from app.database.performance import DatabaseAnalyzer, DatabaseStats
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        stats = analyzer.analyze_stats(db_name="test")
        assert isinstance(stats, DatabaseStats)

    def test_analyze_stats_counts_tables(self, temp_sqlite_db):
        from app.database.performance import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        stats = analyzer.analyze_stats(db_name="test")
        assert stats.table_count == 1

    def test_analyze_stats_counts_records(self, temp_sqlite_db):
        from app.database.performance import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        stats = analyzer.analyze_stats(db_name="test")
        assert stats.total_records == 5

    def test_analyze_stats_counts_indexes(self, temp_sqlite_db):
        from app.database.performance import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        stats = analyzer.analyze_stats(db_name="test")
        assert stats.index_count >= 1

    def test_analyze_stats_performance_score_in_range(self, temp_sqlite_db):
        from app.database.performance import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        stats = analyzer.analyze_stats(db_name="test")
        assert 0.0 <= stats.performance_score <= 10.0

    def test_calculate_score_uses_constants_not_literals(self, temp_sqlite_db):
        """Score calculation should reference PerformanceConstants, verified by output."""
        from app.database.performance import DatabaseAnalyzer, PerformanceConstants
        analyzer = DatabaseAnalyzer(db_path=temp_sqlite_db)
        # High fragmentation db would score below 10
        score = analyzer.calculate_performance_score(
            file_size_mb=1.0,
            table_count=5,
            total_records=100,
            fragmentation_percent=PerformanceConstants.FRAGMENTATION_PENALTY_THRESHOLD + 1
        )
        assert score < 10.0

    def test_missing_db_returns_zero_stats(self):
        from app.database.performance import DatabaseAnalyzer, DatabaseStats
        analyzer = DatabaseAnalyzer(db_path="/nonexistent/path.db")
        stats = analyzer.analyze_stats(db_name="missing")
        assert stats.performance_score == 0.0
        assert stats.table_count == 0


# ── BenchmarkRunner ───────────────────────────────────────────────────────────

class TestBenchmarkRunner:
    def test_constructor_accepts_db_path(self):
        from app.database.performance import BenchmarkRunner
        runner = BenchmarkRunner(temp_db_path=":memory:")
        assert runner is not None

    @pytest.mark.asyncio
    async def test_run_benchmark_insert_returns_result(self):
        from app.database.performance import BenchmarkRunner, BenchmarkResult
        runner = BenchmarkRunner(temp_db_path=":memory:")
        result = await runner.run_benchmark("INSERT", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "INSERT"

    @pytest.mark.asyncio
    async def test_run_benchmark_select_returns_result(self):
        from app.database.performance import BenchmarkRunner, BenchmarkResult
        runner = BenchmarkRunner(temp_db_path=":memory:")
        result = await runner.run_benchmark("SELECT", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "SELECT"

    @pytest.mark.asyncio
    async def test_run_benchmark_update_returns_result(self):
        from app.database.performance import BenchmarkRunner, BenchmarkResult
        runner = BenchmarkRunner(temp_db_path=":memory:")
        result = await runner.run_benchmark("UPDATE", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "UPDATE"

    @pytest.mark.asyncio
    async def test_run_benchmark_delete_returns_result(self):
        from app.database.performance import BenchmarkRunner, BenchmarkResult
        runner = BenchmarkRunner(temp_db_path=":memory:")
        result = await runner.run_benchmark("DELETE", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "DELETE"

    @pytest.mark.asyncio
    async def test_successful_benchmark_has_positive_duration(self):
        from app.database.performance import BenchmarkRunner
        runner = BenchmarkRunner(temp_db_path=":memory:")
        result = await runner.run_benchmark("INSERT", record_count=10)
        assert result.success is True
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_run_crud_benchmarks_returns_four_results(self):
        from app.database.performance import BenchmarkRunner
        runner = BenchmarkRunner(temp_db_path=":memory:")
        results = await runner.run_crud_benchmarks(record_counts={"INSERT": 5, "SELECT": 5, "UPDATE": 5, "DELETE": 5})
        assert len(results) == 4
        ops = {r.operation for r in results}
        assert ops == {"INSERT", "SELECT", "UPDATE", "DELETE"}

    @pytest.mark.asyncio
    async def test_unknown_operation_returns_failed_result(self):
        from app.database.performance import BenchmarkRunner
        runner = BenchmarkRunner(temp_db_path=":memory:")
        result = await runner.run_benchmark("UNSUPPORTED", record_count=5)
        assert result.success is False


# ── ScoringEngine ─────────────────────────────────────────────────────────────

class TestScoringEngine:
    def test_calculate_overall_score_empty_list_returns_zero(self):
        from app.database.performance import ScoringEngine
        engine = ScoringEngine()
        assert engine.calculate_overall_score([]) == 0.0

    def test_calculate_overall_score_fast_ops_score_high(self):
        from app.database.performance import ScoringEngine, BenchmarkResult
        engine = ScoringEngine()
        fast_result = BenchmarkResult(
            operation="INSERT",
            duration_ms=100,
            records_processed=1000,
            records_per_second=10000,
            memory_usage_mb=10,
            cpu_percent=5,
            success=True
        )
        score = engine.calculate_overall_score([fast_result])
        assert score >= 8.0

    def test_calculate_overall_score_failed_ops_score_zero(self):
        from app.database.performance import ScoringEngine, BenchmarkResult
        engine = ScoringEngine()
        failed = BenchmarkResult(
            operation="INSERT",
            duration_ms=0,
            records_processed=0,
            records_per_second=0,
            memory_usage_mb=0,
            cpu_percent=0,
            success=False,
            error_message="error"
        )
        score = engine.calculate_overall_score([failed])
        assert score == 0.0

    def test_generate_recommendations_flags_slow_ops(self):
        from app.database.performance import ScoringEngine, BenchmarkResult
        engine = ScoringEngine()
        slow_result = BenchmarkResult(
            operation="SELECT",
            duration_ms=2000,
            records_processed=10,
            records_per_second=5,
            memory_usage_mb=0,
            cpu_percent=0,
            success=True
        )
        recs = engine.generate_recommendations(benchmark_results=[slow_result], database_stats={})
        assert any("SELECT" in r for r in recs)

    def test_generate_recommendations_flags_high_fragmentation(self):
        from app.database.performance import ScoringEngine
        engine = ScoringEngine()
        stats = {"main": {"performance_score": 4.0, "vacuum_recommended": True,
                          "fragmentation_percent": 25.0, "file_size_mb": 1.0,
                          "total_records": 100}}
        recs = engine.generate_recommendations(benchmark_results=[], database_stats=stats)
        assert any("VACUUM" in r or "vacuum" in r.lower() for r in recs)

    def test_generate_recommendations_always_includes_general_advice(self):
        from app.database.performance import ScoringEngine
        engine = ScoringEngine()
        recs = engine.generate_recommendations(benchmark_results=[], database_stats={})
        assert len(recs) >= 1


# ── PerformanceOptimizer ──────────────────────────────────────────────────────

class TestPerformanceOptimizer:
    def test_constructor_accepts_db_paths(self, temp_sqlite_db):
        from app.database.performance import PerformanceOptimizer
        optimizer = PerformanceOptimizer(db_paths={"test": temp_sqlite_db})
        assert optimizer is not None

    @pytest.mark.asyncio
    async def test_optimize_runs_vacuum_and_analyze(self, temp_sqlite_db):
        from app.database.performance import PerformanceOptimizer
        optimizer = PerformanceOptimizer(db_paths={"test": temp_sqlite_db})
        result = await optimizer.optimize("test")
        assert result["success"] is True
        assert any("VACUUM" in op for op in result["operations"])
        assert any("ANALYZE" in op for op in result["operations"])

    @pytest.mark.asyncio
    async def test_optimize_unknown_db_returns_error(self, temp_sqlite_db):
        from app.database.performance import PerformanceOptimizer
        optimizer = PerformanceOptimizer(db_paths={"test": temp_sqlite_db})
        result = await optimizer.optimize("nonexistent")
        assert result["success"] is False
        assert len(result["errors"]) > 0

    @pytest.mark.asyncio
    async def test_optimize_returns_index_analysis(self, temp_sqlite_db):
        from app.database.performance import PerformanceOptimizer
        optimizer = PerformanceOptimizer(db_paths={"test": temp_sqlite_db})
        result = await optimizer.optimize("test")
        assert result["success"] is True
        # Should include index analysis operations
        assert any("index" in op.lower() or "idx" in op.lower() for op in result["operations"])


# ── Backward-compatibility orchestrator ───────────────────────────────────────

class TestDatabasePerformanceOptimizerOrchestrator:
    def test_constructor_accepts_db_paths_kwarg(self, temp_sqlite_db):
        """Orchestrator should accept injected paths so tests never touch the real FS."""
        from app.database.performance import DatabasePerformanceOptimizer
        optimizer = DatabasePerformanceOptimizer(
            db_paths={"main": temp_sqlite_db, "agents": temp_sqlite_db, "flows": temp_sqlite_db}
        )
        assert optimizer is not None

    @pytest.mark.asyncio
    async def test_run_basic_benchmarks_returns_four_results(self, temp_sqlite_db):
        from app.database.performance import DatabasePerformanceOptimizer
        optimizer = DatabasePerformanceOptimizer(
            db_paths={"main": temp_sqlite_db, "agents": temp_sqlite_db, "flows": temp_sqlite_db}
        )
        results = await optimizer.run_basic_benchmarks(record_counts={"INSERT": 5, "SELECT": 5, "UPDATE": 5, "DELETE": 5})
        assert len(results) == 4

    @pytest.mark.asyncio
    async def test_generate_recommendations_is_independently_callable(self, temp_sqlite_db):
        from app.database.performance import DatabasePerformanceOptimizer
        optimizer = DatabasePerformanceOptimizer(
            db_paths={"main": temp_sqlite_db}
        )
        recs = await optimizer.generate_recommendations(benchmark_results=[], database_stats={})
        assert isinstance(recs, list)

    @pytest.mark.asyncio
    async def test_calculate_score_is_independently_callable(self, temp_sqlite_db):
        from app.database.performance import DatabasePerformanceOptimizer
        optimizer = DatabasePerformanceOptimizer(
            db_paths={"main": temp_sqlite_db}
        )
        score = optimizer.calculate_overall_score([])
        assert score == 0.0
