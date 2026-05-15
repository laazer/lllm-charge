"""
BenchmarkRunner: executes CRUD, query, concurrency, and stress benchmarks.

The four CRUD benchmarks (INSERT/SELECT/UPDATE/DELETE) now share a single
_run_crud_benchmark template method, eliminating ~250 lines of copy-pasted
boilerplate.
"""
import asyncio
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import psutil
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from .constants import PerformanceConstants
from .types import BenchmarkResult

logger = logging.getLogger(__name__)


@dataclass
class _CrudBenchmarkSpec:
    """Parameters that distinguish each CRUD benchmark from the others."""
    operation: str
    db_path: str
    setup_sql: Optional[str]
    workload_factory: Callable[[Any, int], Any]  # (conn, record_count) → coroutine
    record_count: int
    measure_memory: bool = True
    measure_cpu: bool = False


class BenchmarkRunner:
    """Runs CRUD, query, concurrency, and stress benchmarks against SQLite databases."""

    def __init__(self, database_paths: Dict[str, str]) -> None:
        self._database_paths = database_paths

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run_basic_benchmarks(
        self, record_counts: Optional[Dict[str, int]] = None
    ) -> List[BenchmarkResult]:
        counts = record_counts or {
            "insert": PerformanceConstants.DEFAULT_INSERT_COUNT,
            "select": PerformanceConstants.DEFAULT_SELECT_COUNT,
            "update": PerformanceConstants.DEFAULT_UPDATE_COUNT,
            "delete": PerformanceConstants.DEFAULT_DELETE_COUNT,
        }
        return [
            await self._benchmark_insert(counts["insert"]),
            await self._benchmark_select(counts["select"]),
            await self._benchmark_update(counts["update"]),
            await self._benchmark_delete(counts["delete"]),
        ]

    async def run_query_benchmarks(self) -> List[BenchmarkResult]:
        return [
            await self._benchmark_join_queries(),
            await self._benchmark_aggregation_queries(),
            await self._benchmark_search_queries(),
        ]

    async def run_concurrency_benchmarks(self) -> List[BenchmarkResult]:
        return [
            await self._benchmark_concurrent_reads(),
            await self._benchmark_concurrent_writes(),
        ]

    async def run_stress_tests(self) -> List[BenchmarkResult]:
        return [
            await self._stress_test_inserts(),
            await self._stress_test_memory(),
        ]

    # ------------------------------------------------------------------
    # CRUD benchmarks — all delegate to one template method
    # ------------------------------------------------------------------

    async def _benchmark_insert(self, record_count: int) -> BenchmarkResult:
        temp_db = "data/temp_benchmark.db"
        return await self._run_crud_benchmark(
            operation="INSERT",
            db_path=temp_db,
            setup_coro=self._create_performance_table,
            workload_coro=self._insert_workload,
            record_count=record_count,
            cleanup_db=temp_db,
            measure_cpu=True,
        )

    async def _benchmark_select(self, record_count: int) -> BenchmarkResult:
        main_db = self._database_paths["main"]
        self._ensure_select_test_data(main_db, record_count)
        return await self._run_crud_benchmark(
            operation="SELECT",
            db_path=main_db,
            setup_coro=None,
            workload_coro=self._select_workload,
            record_count=record_count,
        )

    async def _benchmark_update(self, record_count: int) -> BenchmarkResult:
        temp_db = "data/temp_update_benchmark.db"
        return await self._run_crud_benchmark(
            operation="UPDATE",
            db_path=temp_db,
            setup_coro=self._create_update_test_data,
            workload_coro=self._update_workload,
            record_count=record_count,
            cleanup_db=temp_db,
        )

    async def _benchmark_delete(self, record_count: int) -> BenchmarkResult:
        temp_db = "data/temp_delete_benchmark.db"
        return await self._run_crud_benchmark(
            operation="DELETE",
            db_path=temp_db,
            setup_coro=self._create_delete_test_data,
            workload_coro=self._delete_workload,
            record_count=record_count,
            cleanup_db=temp_db,
        )

    # ------------------------------------------------------------------
    # Template method — shared boilerplate for all four CRUD benchmarks
    # ------------------------------------------------------------------

    async def _run_crud_benchmark(
        self,
        operation: str,
        db_path: str,
        setup_coro: Optional[Callable],
        workload_coro: Callable,
        record_count: int,
        cleanup_db: Optional[str] = None,
        measure_cpu: bool = False,
    ) -> BenchmarkResult:
        try:
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{db_path}", poolclass=StaticPool
            )

            if setup_coro is not None:
                async with engine.begin() as conn:
                    await setup_coro(conn, record_count)

            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            start_cpu = psutil.cpu_percent(interval=None) if measure_cpu else 0.0

            async with engine.begin() as conn:
                await workload_coro(conn, record_count)

            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            end_cpu = psutil.cpu_percent(interval=None) if measure_cpu else 0.0

            duration_ms = (end_time - start_time) * 1000
            memory_usage = end_memory - start_memory
            cpu_usage = max(0.0, end_cpu - start_cpu) if measure_cpu else 0.0
            rps = record_count / (duration_ms / 1000) if duration_ms > 0 else 0.0

            await engine.dispose()
            self._cleanup_db(cleanup_db)

            return BenchmarkResult(
                operation=operation,
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=rps,
                memory_usage_mb=memory_usage,
                cpu_percent=cpu_usage,
                success=True,
            )

        except Exception as exc:
            logger.error("Benchmark %s failed: %s", operation, exc)
            return BenchmarkResult(
                operation=operation,
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(exc),
            )

    # ------------------------------------------------------------------
    # Setup / workload coroutines
    # ------------------------------------------------------------------

    @staticmethod
    async def _create_performance_table(conn: Any, _record_count: int) -> None:
        await conn.execute(text("""
            CREATE TABLE test_performance (
                id INTEGER PRIMARY KEY,
                name TEXT,
                data TEXT,
                timestamp DATETIME
            )
        """))

    @staticmethod
    async def _insert_workload(conn: Any, record_count: int) -> None:
        from datetime import datetime as _dt
        for i in range(record_count):
            await conn.execute(text("""
                INSERT INTO test_performance (name, data, timestamp)
                VALUES (:name, :data, :timestamp)
            """), {
                "name": f"test_record_{i}",
                "data": f"benchmark_data_{i}" * 10,
                "timestamp": _dt.utcnow(),
            })

    @staticmethod
    async def _select_workload(conn: Any, record_count: int) -> None:
        for _ in range(record_count):
            await conn.execute(text("SELECT COUNT(*) FROM sqlite_master WHERE type='table'"))
            try:
                await conn.execute(text("SELECT * FROM projects LIMIT 1"))
            except Exception:
                pass  # table may not exist in test databases

    @staticmethod
    async def _create_update_test_data(conn: Any, record_count: int) -> None:
        await conn.execute(text("""
            CREATE TABLE test_update (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)
        """))
        for i in range(record_count):
            await conn.execute(
                text("INSERT INTO test_update (name, value) VALUES (:name, :value)"),
                {"name": f"test_{i}", "value": i},
            )

    @staticmethod
    async def _update_workload(conn: Any, record_count: int) -> None:
        for i in range(record_count):
            await conn.execute(
                text("UPDATE test_update SET value = :new_value WHERE id = :id"),
                {"new_value": i * 2, "id": i + 1},
            )

    @staticmethod
    async def _create_delete_test_data(conn: Any, record_count: int) -> None:
        await conn.execute(text("""
            CREATE TABLE test_delete (id INTEGER PRIMARY KEY, name TEXT)
        """))
        for i in range(record_count * 2):
            await conn.execute(
                text("INSERT INTO test_delete (name) VALUES (:name)"),
                {"name": f"test_{i}"},
            )

    @staticmethod
    async def _delete_workload(conn: Any, record_count: int) -> None:
        for i in range(record_count):
            await conn.execute(
                text("DELETE FROM test_delete WHERE id = :id"), {"id": i + 1}
            )

    # ------------------------------------------------------------------
    # Query benchmarks
    # ------------------------------------------------------------------

    async def _benchmark_join_queries(self) -> BenchmarkResult:
        return await self._run_query_benchmark(
            operation="JOIN",
            queries=[
                "SELECT COUNT(*) FROM sqlite_master m1 JOIN sqlite_master m2 ON m1.type = m2.type",
            ],
        )

    async def _benchmark_aggregation_queries(self) -> BenchmarkResult:
        return await self._run_query_benchmark(
            operation="AGGREGATION",
            queries=[
                "SELECT COUNT(*) FROM sqlite_master",
                "SELECT type, COUNT(*) FROM sqlite_master GROUP BY type",
                "SELECT MAX(LENGTH(name)), MIN(LENGTH(name)), AVG(LENGTH(name)) FROM sqlite_master",
            ],
        )

    async def _run_query_benchmark(
        self, operation: str, queries: List[str]
    ) -> BenchmarkResult:
        main_db = self._database_paths["main"]
        if not Path(main_db).exists():
            return self._missing_db_result(operation)

        try:
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{main_db}", poolclass=StaticPool
            )
            start_time = time.time()
            queries_executed = 0

            async with engine.begin() as conn:
                for query in queries:
                    try:
                        await conn.execute(text(query))
                        queries_executed += 1
                    except Exception:
                        pass

            duration_ms = (time.time() - start_time) * 1000
            await engine.dispose()

            return BenchmarkResult(
                operation=operation,
                duration_ms=duration_ms,
                records_processed=queries_executed,
                records_per_second=queries_executed / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True,
            )

        except Exception as exc:
            return BenchmarkResult(
                operation=operation,
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(exc),
            )

    async def _benchmark_search_queries(self) -> BenchmarkResult:
        temp_db = "data/temp_search_benchmark.db"
        try:
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool
            )

            async with engine.begin() as conn:
                await conn.execute(text("CREATE VIRTUAL TABLE search_test USING fts5(title, content)"))
                for title, content in [
                    ("Performance Testing", "Database performance optimization and benchmarking"),
                    ("Query Analysis", "SQL query performance analysis and optimization"),
                    ("Index Management", "Database index management and maintenance"),
                    ("Backup Systems", "Database backup and recovery systems"),
                    ("Migration Tools", "Database migration and schema management"),
                ]:
                    await conn.execute(
                        text("INSERT INTO search_test (title, content) VALUES (:title, :content)"),
                        {"title": title, "content": content},
                    )

            start_time = time.time()
            searches_executed = 0

            async with engine.begin() as conn:
                for term in ["performance", "database", "optimization", "management", "systems"]:
                    try:
                        await conn.execute(
                            text("SELECT * FROM search_test WHERE search_test MATCH :term"),
                            {"term": term},
                        )
                        searches_executed += 1
                    except Exception:
                        pass

            duration_ms = (time.time() - start_time) * 1000
            await engine.dispose()
            self._cleanup_db(temp_db)

            return BenchmarkResult(
                operation="SEARCH",
                duration_ms=duration_ms,
                records_processed=searches_executed,
                records_per_second=searches_executed / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True,
            )

        except Exception as exc:
            return BenchmarkResult(
                operation="SEARCH", duration_ms=0, records_processed=0,
                records_per_second=0, memory_usage_mb=0, cpu_percent=0,
                success=False, error_message=str(exc),
            )

    # ------------------------------------------------------------------
    # Concurrency benchmarks
    # ------------------------------------------------------------------

    async def _benchmark_concurrent_reads(self) -> BenchmarkResult:
        main_db = self._database_paths["main"]
        self._ensure_concurrent_test_data(main_db)
        tasks_count = PerformanceConstants.CONCURRENT_READ_TASKS
        queries_per_task = PerformanceConstants.CONCURRENT_READ_QUERIES_PER_TASK

        async def read_task() -> None:
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{main_db}", poolclass=StaticPool
            )
            async with engine.begin() as conn:
                for _ in range(queries_per_task):
                    await conn.execute(text("SELECT COUNT(*) FROM sqlite_master"))
            await engine.dispose()

        try:
            start_time = time.time()
            await asyncio.gather(*[read_task() for _ in range(tasks_count)])
            duration_ms = (time.time() - start_time) * 1000
            total_queries = tasks_count * queries_per_task

            return BenchmarkResult(
                operation="CONCURRENT_READ",
                duration_ms=duration_ms,
                records_processed=total_queries,
                records_per_second=total_queries / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0, cpu_percent=0, success=True,
            )
        except Exception as exc:
            return BenchmarkResult(
                operation="CONCURRENT_READ", duration_ms=0, records_processed=0,
                records_per_second=0, memory_usage_mb=0, cpu_percent=0,
                success=False, error_message=str(exc),
            )

    async def _benchmark_concurrent_writes(self) -> BenchmarkResult:
        tasks_count = PerformanceConstants.CONCURRENT_WRITE_TASKS
        writes_per_task = PerformanceConstants.CONCURRENT_WRITE_RECORDS_PER_TASK

        async def write_task(task_id: int) -> None:
            task_db = f"data/temp_write_task_{task_id}.db"
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{task_db}", poolclass=StaticPool
            )
            async with engine.begin() as conn:
                await conn.execute(text("CREATE TABLE task_test (id INTEGER PRIMARY KEY, data TEXT)"))
                for i in range(writes_per_task):
                    await conn.execute(
                        text("INSERT INTO task_test (data) VALUES (:data)"),
                        {"data": f"task_{task_id}_record_{i}"},
                    )
            await engine.dispose()
            self._cleanup_db(task_db)

        try:
            start_time = time.time()
            await asyncio.gather(*[write_task(i) for i in range(tasks_count)])
            duration_ms = (time.time() - start_time) * 1000
            total_writes = tasks_count * writes_per_task

            return BenchmarkResult(
                operation="CONCURRENT_WRITE",
                duration_ms=duration_ms,
                records_processed=total_writes,
                records_per_second=total_writes / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0, cpu_percent=0, success=True,
            )
        except Exception as exc:
            return BenchmarkResult(
                operation="CONCURRENT_WRITE", duration_ms=0, records_processed=0,
                records_per_second=0, memory_usage_mb=0, cpu_percent=0,
                success=False, error_message=str(exc),
            )

    # ------------------------------------------------------------------
    # Stress tests
    # ------------------------------------------------------------------

    async def _stress_test_inserts(self) -> BenchmarkResult:
        record_count = PerformanceConstants.STRESS_INSERT_RECORD_COUNT
        batch_size = PerformanceConstants.STRESS_INSERT_BATCH_SIZE
        temp_db = "data/temp_stress_insert.db"

        try:
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool
            )
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024

            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE stress_test (
                        id INTEGER PRIMARY KEY,
                        data1 TEXT, data2 TEXT, data3 TEXT, timestamp DATETIME
                    )
                """))
                from datetime import datetime as _dt
                for batch_start in range(0, record_count, batch_size):
                    for i in range(batch_start, min(batch_start + batch_size, record_count)):
                        await conn.execute(text("""
                            INSERT INTO stress_test (data1, data2, data3, timestamp)
                            VALUES (:data1, :data2, :data3, :timestamp)
                        """), {
                            "data1": f"stress_1_{i}" * 5,
                            "data2": f"stress_2_{i}" * 3,
                            "data3": f"stress_3_{i}" * 2,
                            "timestamp": _dt.utcnow(),
                        })

            duration_ms = (time.time() - start_time) * 1000
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            await engine.dispose()
            self._cleanup_db(temp_db)

            return BenchmarkResult(
                operation="STRESS_INSERT",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=record_count / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=end_memory - start_memory,
                cpu_percent=0, success=True,
            )
        except Exception as exc:
            return BenchmarkResult(
                operation="STRESS_INSERT", duration_ms=0, records_processed=0,
                records_per_second=0, memory_usage_mb=0, cpu_percent=0,
                success=False, error_message=str(exc),
            )

    async def _stress_test_memory(self) -> BenchmarkResult:
        record_count = PerformanceConstants.STRESS_MEMORY_RECORD_COUNT
        large_text = "X" * PerformanceConstants.STRESS_MEMORY_RECORD_SIZE_BYTES
        temp_db = "data/temp_memory_stress.db"

        try:
            engine = create_async_engine(
                f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool
            )
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            peak_memory = start_memory

            async with engine.begin() as conn:
                await conn.execute(text("CREATE TABLE memory_test (id INTEGER PRIMARY KEY, large_data TEXT)"))
                for _ in range(record_count):
                    await conn.execute(
                        text("INSERT INTO memory_test (large_data) VALUES (:data)"),
                        {"data": large_text},
                    )
                    peak_memory = max(peak_memory, psutil.Process().memory_info().rss / 1024 / 1024)
                await conn.execute(text(
                    "SELECT COUNT(*), LENGTH(GROUP_CONCAT(large_data, '|')) FROM memory_test"
                ))

            duration_ms = (time.time() - start_time) * 1000
            await engine.dispose()
            self._cleanup_db(temp_db)

            return BenchmarkResult(
                operation="MEMORY_STRESS",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=record_count / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=peak_memory - start_memory,
                cpu_percent=0, success=True,
            )
        except Exception as exc:
            return BenchmarkResult(
                operation="MEMORY_STRESS", duration_ms=0, records_processed=0,
                records_per_second=0, memory_usage_mb=0, cpu_percent=0,
                success=False, error_message=str(exc),
            )

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _cleanup_db(db_path: Optional[str]) -> None:
        if db_path and Path(db_path).exists():
            try:
                Path(db_path).unlink()
            except OSError as exc:
                logger.warning("Could not remove temp database %s: %s", db_path, exc)

    @staticmethod
    def _missing_db_result(operation: str) -> BenchmarkResult:
        return BenchmarkResult(
            operation=operation, duration_ms=0, records_processed=0,
            records_per_second=0, memory_usage_mb=0, cpu_percent=0,
            success=False, error_message="Main database not found",
        )

    def _ensure_select_test_data(self, main_db: str, record_count: int) -> None:
        import sqlite3 as _sqlite3
        if not Path(main_db).exists():
            conn = _sqlite3.connect(main_db)
            conn.execute("CREATE TABLE test_select (id INTEGER PRIMARY KEY, name TEXT)")
            for i in range(min(record_count, 100)):
                conn.execute("INSERT INTO test_select (name) VALUES (?)", (f"test_{i}",))
            conn.commit()
            conn.close()

    def _ensure_concurrent_test_data(self, main_db: str) -> None:
        import sqlite3 as _sqlite3
        if not Path(main_db).exists():
            conn = _sqlite3.connect(main_db)
            conn.execute("CREATE TABLE concurrent_test (id INTEGER PRIMARY KEY, data TEXT)")
            for i in range(50):
                conn.execute("INSERT INTO concurrent_test (data) VALUES (?)", (f"data_{i}",))
            conn.commit()
            conn.close()
