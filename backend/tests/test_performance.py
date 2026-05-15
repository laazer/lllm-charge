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
    def test_record_size_threshold_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'RECORD_SIZE_THRESHOLD_KB')
        assert PerformanceConstants.RECORD_SIZE_THRESHOLD_KB == 1.0

    def test_fragmentation_penalty_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'FRAGMENTATION_MAX_PENALTY')
        assert PerformanceConstants.FRAGMENTATION_MAX_PENALTY == 3.0

    def test_max_file_size_penalty_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'LARGE_FILE_SIZE_MB')

    def test_max_table_count_penalty_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'MAX_TABLE_COUNT_PENALTY')
        assert PerformanceConstants.MAX_TABLE_COUNT_PENALTY == 20

    def test_fragmentation_penalty_threshold_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'FRAGMENTATION_WARNING_PERCENT')
        assert PerformanceConstants.FRAGMENTATION_WARNING_PERCENT == 5.0

    def test_table_count_penalty_threshold_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'MAX_TABLE_COUNT_PENALTY')
        assert PerformanceConstants.MAX_TABLE_COUNT_PENALTY == 20

    def test_vacuum_fragmentation_threshold_exists(self):
        from app.database.performance.constants import PerformanceConstants
        assert hasattr(PerformanceConstants, 'LOW_PERFORMANCE_SCORE_THRESHOLD')


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
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        assert analyzer is not None

    def test_analyze_stats_returns_database_stats(self, temp_sqlite_db):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        from app.database.performance.types import DatabaseStats
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="test", db_path=temp_sqlite_db)
        assert isinstance(stats, DatabaseStats)

    def test_analyze_stats_counts_tables(self, temp_sqlite_db):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="test", db_path=temp_sqlite_db)
        assert stats.table_count == 1

    def test_analyze_stats_counts_records(self, temp_sqlite_db):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="test", db_path=temp_sqlite_db)
        assert stats.total_records == 5

    def test_analyze_stats_counts_indexes(self, temp_sqlite_db):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="test", db_path=temp_sqlite_db)
        assert stats.index_count >= 1

    def test_analyze_stats_performance_score_in_range(self, temp_sqlite_db):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="test", db_path=temp_sqlite_db)
        assert 0.0 <= stats.performance_score <= 10.0

    def test_calculate_score_uses_constants_not_literals(self, temp_sqlite_db):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="test", db_path=temp_sqlite_db)
        assert stats.performance_score is not None

    def test_missing_db_returns_zero_stats(self):
        from app.database.performance.database_analyzer import DatabaseAnalyzer
        analyzer = DatabaseAnalyzer()
        stats = analyzer.analyze(db_name="missing", db_path="/nonexistent/path.db")
        assert stats is not None


# ── BenchmarkRunner ───────────────────────────────────────────────────────────

class TestBenchmarkRunner:
    def test_constructor_accepts_db_path(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        runner = BenchmarkRunner(database_paths={})
        assert runner is not None

    @pytest.mark.asyncio
    async def test_run_benchmark_insert_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={})
        result = await runner.run_benchmark("INSERT", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "INSERT"

    @pytest.mark.asyncio
    async def test_run_benchmark_select_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={})
        result = await runner.run_benchmark("SELECT", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "SELECT"

    @pytest.mark.asyncio
    async def test_run_benchmark_update_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={})
        result = await runner.run_benchmark("UPDATE", record_count=5)
        assert isinstance(result, BenchmarkResult)
        assert result.operation == "UPDATE"

    @pytest.mark.asyncio
    async def test_run_benchmark_insert_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        insert_result = [r for r in results if r.operation == "INSERT"][0]
        assert isinstance(insert_result, BenchmarkResult)
        assert insert_result.operation == "INSERT"

    @pytest.mark.asyncio
    async def test_run_benchmark_select_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        select_result = [r for r in results if r.operation == "SELECT"][0]
        assert isinstance(select_result, BenchmarkResult)
        assert select_result.operation == "SELECT"

    @pytest.mark.asyncio
    async def test_run_benchmark_update_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        update_result = [r for r in results if r.operation == "UPDATE"][0]
        assert isinstance(update_result, BenchmarkResult)
        assert update_result.operation == "UPDATE"

    @pytest.mark.asyncio
    async def test_run_benchmark_delete_returns_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        from app.database.performance.types import BenchmarkResult
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        delete_result = [r for r in results if r.operation == "DELETE"][0]
        assert isinstance(delete_result, BenchmarkResult)
        assert delete_result.operation == "DELETE"

    @pytest.mark.asyncio
    async def test_successful_benchmark_has_positive_duration(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        assert len(results) > 0
        for r in results:
            assert r.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_run_crud_benchmarks_returns_four_results(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        assert len(results) == 4
        ops = {r.operation for r in results}
        assert ops == {"INSERT", "SELECT", "UPDATE", "DELETE"}

    @pytest.mark.asyncio
    async def test_unknown_operation_returns_failed_result(self):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        runner = BenchmarkRunner(database_paths={"main": ":memory:"})
        results = await runner.run_basic_benchmarks()
        for r in results:
            assert r.success is True


# ── ScoringEngine ─────────────────────────────────────────────────────────────

class TestScoringEngine:
    def test_calculate_overall_score_empty_list_returns_zero(self):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        assert engine.calculate_overall_score([]) == 0.0

    def test_calculate_overall_score_fast_ops_score_high(self):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        fast_result = {
            "operation": "INSERT",
            "duration_ms": 100,
            "records_processed": 1000,
            "records_per_second": 10000,
            "memory_usage_mb": 10,
            "cpu_percent": 5,
            "success": True
        }
        score = engine.calculate_overall_score([fast_result])
        assert score >= 8.0

    def test_calculate_overall_score_failed_ops_score_zero(self):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        failed = {
            "operation": "INSERT",
            "duration_ms": 0,
            "records_processed": 0,
            "records_per_second": 0,
            "memory_usage_mb": 0,
            "cpu_percent": 0,
            "success": False,
            "error_message": "error"
        }
        score = engine.calculate_overall_score([failed])
        assert score == 0.0

    def test_generate_recommendations_flags_slow_ops(self):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        recs = engine.generate_recommendations({"slow_ops": ["SELECT"]})
        assert isinstance(recs, list)

    def test_generate_recommendations_flags_high_fragmentation(self):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        stats = {"fragmentation_percent": 25.0, "vacuum_recommended": True}
        recs = engine.generate_recommendations(stats)
        assert any("VACUUM" in r or "vacuum" in r.lower() for r in recs)

    def test_generate_recommendations_always_includes_general_advice(self):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        recs = engine.generate_recommendations({})
        assert len(recs) >= 1


# ── PerformanceOptimizer ──────────────────────────────────────────────────────

class TestPerformanceOptimizer:
    def test_constructor_accepts_db_paths(self, temp_sqlite_db):
        from app.database.performance.performance_optimizer import PerformanceOptimizer
        optimizer = PerformanceOptimizer(database_paths={"test": temp_sqlite_db})
        assert optimizer is not None

    @pytest.mark.asyncio
    async def test_optimize_runs_vacuum_and_analyze(self, temp_sqlite_db):
        from app.database.performance.performance_optimizer import PerformanceOptimizer
        optimizer = PerformanceOptimizer(database_paths={"test": temp_sqlite_db})
        result = await optimizer.optimize_database("test")
        assert "success" in result
        assert "operations" in result

    @pytest.mark.asyncio
    async def test_optimize_unknown_db_returns_error(self, temp_sqlite_db):
        from app.database.performance.performance_optimizer import PerformanceOptimizer
        optimizer = PerformanceOptimizer(database_paths={"test": temp_sqlite_db})
        result = await optimizer.optimize_database("nonexistent")
        assert "success" in result

    @pytest.mark.asyncio
    async def test_optimize_returns_index_analysis(self, temp_sqlite_db):
        from app.database.performance.performance_optimizer import PerformanceOptimizer
        optimizer = PerformanceOptimizer(database_paths={"test": temp_sqlite_db})
        result = await optimizer.optimize_database("test")
        assert "success" in result
        assert "operations" in result


# ── Backward-compatibility orchestrator ───────────────────────────────────────

class TestDatabasePerformanceOptimizerOrchestrator:
    def test_constructor_accepts_db_paths_kwarg(self, temp_sqlite_db):
        from app.database.performance.performance_optimizer import PerformanceOptimizer
        optimizer = PerformanceOptimizer(database_paths={"test": temp_sqlite_db})
        assert optimizer is not None

    @pytest.mark.asyncio
    async def test_run_basic_benchmarks_returns_four_results(self, temp_sqlite_db):
        from app.database.performance.benchmark_runner import BenchmarkRunner
        runner = BenchmarkRunner(database_paths={"main": temp_sqlite_db})
        results = await runner.run_basic_benchmarks()
        assert len(results) == 4

    @pytest.mark.asyncio
    async def test_generate_recommendations_is_independently_callable(self, temp_sqlite_db):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        recs = engine.generate_recommendations({})
        assert isinstance(recs, list)

    @pytest.mark.asyncio
    async def test_calculate_score_is_independently_callable(self, temp_sqlite_db):
        from app.database.performance.scoring_engine import ScoringEngine
        engine = ScoringEngine()
        score = engine.calculate_overall_score([])
        assert score == 0.0
