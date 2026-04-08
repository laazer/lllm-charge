"""
Database performance optimization and benchmarking utilities
"""
import asyncio
import time
import statistics
import psutil
import sqlite3
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text, inspect
from sqlalchemy.pool import StaticPool

from app.database.models.main import Project, Specification, Note, Checkpoint
from app.database.models.agents import Agent, AgentTask, AgentLearning, AgentCollaboration
from app.database.models.flows import Flow, FlowExecution, FlowTemplate, FlowVersion, FlowSchedule
from app.database.models.metrics import RequestMetric, PerformanceMetric, CostMetric, QualityMetric, UsageMetric, AlertMetric


@dataclass
class BenchmarkResult:
    """Performance benchmark results"""
    operation: str
    duration_ms: float
    records_processed: int
    records_per_second: float
    memory_usage_mb: float
    cpu_percent: float
    success: bool
    error_message: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class DatabaseStats:
    """Database statistics and metrics"""
    db_name: str
    file_size_mb: float
    table_count: int
    total_records: int
    index_count: int
    fragmentation_percent: float
    vacuum_recommended: bool
    last_analyzed: datetime
    performance_score: float


class DatabasePerformanceOptimizer:
    """Database performance optimization and benchmarking system"""
    
    def __init__(self):
        self.benchmark_results: List[BenchmarkResult] = []
        self.database_paths = {
            "main": "data/llm-charge.db",
            "agents": "data/agents.db", 
            "flows": "data/flows.db"
        }
        
    async def run_comprehensive_benchmark(
        self, 
        include_stress_tests: bool = False,
        record_counts: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """
        Run comprehensive performance benchmarks across all databases
        
        Args:
            include_stress_tests: Whether to include stress testing
            record_counts: Custom record counts for testing
            
        Returns:
            Dictionary with benchmark results and recommendations
        """
        print("🚀 Starting comprehensive database performance benchmark...")
        
        results = {
            "benchmark_timestamp": datetime.utcnow(),
            "database_stats": {},
            "benchmark_results": [],
            "performance_recommendations": [],
            "overall_score": 0.0,
            "errors": []
        }
        
        try:
            # Step 1: Analyze database statistics
            for db_name, db_path in self.database_paths.items():
                if Path(db_path).exists():
                    stats = await self._analyze_database_stats(db_name, db_path)
                    results["database_stats"][db_name] = asdict(stats)
                    print(f"📊 Analyzed {db_name} database: {stats.performance_score:.1f}/10")
            
            # Step 2: Run basic performance benchmarks
            basic_benchmarks = await self._run_basic_benchmarks(record_counts)
            results["benchmark_results"].extend(basic_benchmarks)
            
            # Step 3: Test query performance
            query_benchmarks = await self._run_query_benchmarks()
            results["benchmark_results"].extend(query_benchmarks)
            
            # Step 4: Test concurrent operations
            concurrency_benchmarks = await self._run_concurrency_benchmarks()
            results["benchmark_results"].extend(concurrency_benchmarks)
            
            # Step 5: Run stress tests if requested
            if include_stress_tests:
                stress_benchmarks = await self._run_stress_tests()
                results["benchmark_results"].extend(stress_benchmarks)
            
            # Step 6: Generate performance recommendations
            recommendations = await self._generate_performance_recommendations(results)
            results["performance_recommendations"] = recommendations
            
            # Step 7: Calculate overall performance score
            overall_score = self._calculate_overall_score(results["benchmark_results"])
            results["overall_score"] = overall_score
            
            print(f"✅ Benchmark completed. Overall score: {overall_score:.1f}/10")
            return results
            
        except Exception as e:
            error_msg = f"Benchmark failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return results
    
    async def _analyze_database_stats(self, db_name: str, db_path: str) -> DatabaseStats:
        """Analyze database statistics and health metrics"""
        try:
            # Get file size
            file_size_mb = Path(db_path).stat().st_size / (1024 * 1024)
            
            # Connect and analyze
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Get table count
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            
            # Get index count
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='index'")
            index_count = cursor.fetchone()[0]
            
            # Get total record count (approximate)
            total_records = 0
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            for (table_name,) in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                    count = cursor.fetchone()[0]
                    total_records += count
                except sqlite3.Error:
                    # Skip tables that can't be counted
                    pass
            
            # Check fragmentation
            cursor.execute("PRAGMA freelist_count")
            freelist_count = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA page_count")
            page_count = cursor.fetchone()[0]
            
            fragmentation_percent = (freelist_count / max(page_count, 1)) * 100
            vacuum_recommended = fragmentation_percent > 10
            
            # Calculate performance score
            performance_score = self._calculate_db_performance_score(
                file_size_mb, table_count, total_records, fragmentation_percent
            )
            
            conn.close()
            
            return DatabaseStats(
                db_name=db_name,
                file_size_mb=round(file_size_mb, 2),
                table_count=table_count,
                total_records=total_records,
                index_count=index_count,
                fragmentation_percent=round(fragmentation_percent, 2),
                vacuum_recommended=vacuum_recommended,
                last_analyzed=datetime.utcnow(),
                performance_score=round(performance_score, 1)
            )
            
        except Exception as e:
            print(f"❌ Failed to analyze {db_name}: {e}")
            return DatabaseStats(
                db_name=db_name,
                file_size_mb=0.0,
                table_count=0,
                total_records=0,
                index_count=0,
                fragmentation_percent=0.0,
                vacuum_recommended=False,
                last_analyzed=datetime.utcnow(),
                performance_score=0.0
            )
    
    def _calculate_db_performance_score(
        self, 
        file_size_mb: float, 
        table_count: int, 
        total_records: int, 
        fragmentation_percent: float
    ) -> float:
        """Calculate performance score for database (0-10 scale)"""
        score = 10.0
        
        # Penalize large files without proportional records
        if file_size_mb > 0 and total_records > 0:
            mb_per_record = file_size_mb / total_records
            if mb_per_record > 0.001:  # > 1KB per record is concerning
                score -= min(2.0, mb_per_record * 1000)
        
        # Penalize high fragmentation
        if fragmentation_percent > 5:
            score -= min(3.0, fragmentation_percent / 5)
        
        # Penalize too many tables (complexity)
        if table_count > 20:
            score -= min(1.0, (table_count - 20) / 10)
        
        return max(0.0, score)
    
    async def _run_basic_benchmarks(self, record_counts: Optional[Dict[str, int]] = None) -> List[BenchmarkResult]:
        """Run basic CRUD operation benchmarks"""
        benchmarks = []
        default_counts = {"insert": 100, "select": 500, "update": 50, "delete": 25}
        counts = record_counts or default_counts
        
        # Test INSERT operations
        benchmark = await self._benchmark_insert_operations(counts["insert"])
        benchmarks.append(benchmark)
        
        # Test SELECT operations  
        benchmark = await self._benchmark_select_operations(counts["select"])
        benchmarks.append(benchmark)
        
        # Test UPDATE operations
        benchmark = await self._benchmark_update_operations(counts["update"])
        benchmarks.append(benchmark)
        
        # Test DELETE operations
        benchmark = await self._benchmark_delete_operations(counts["delete"])
        benchmarks.append(benchmark)
        
        return benchmarks
    
    async def _benchmark_insert_operations(self, record_count: int) -> BenchmarkResult:
        """Benchmark INSERT operations"""
        try:
            # Create temporary database
            temp_db = "data/temp_benchmark.db"
            engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool)
            
            # Measure performance
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            start_cpu = psutil.cpu_percent(interval=None)
            
            async with engine.begin() as conn:
                # Create test table
                await conn.execute(text("""
                    CREATE TABLE test_performance (
                        id INTEGER PRIMARY KEY,
                        name TEXT,
                        data TEXT,
                        timestamp DATETIME
                    )
                """))
                
                # Insert test records
                for i in range(record_count):
                    await conn.execute(text("""
                        INSERT INTO test_performance (name, data, timestamp) 
                        VALUES (:name, :data, :timestamp)
                    """), {
                        "name": f"test_record_{i}",
                        "data": f"benchmark_data_{i}" * 10,  # Some bulk data
                        "timestamp": datetime.utcnow()
                    })
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            end_cpu = psutil.cpu_percent(interval=None)
            
            duration_ms = (end_time - start_time) * 1000
            memory_usage = end_memory - start_memory
            cpu_usage = max(0, end_cpu - start_cpu)
            records_per_second = record_count / (duration_ms / 1000) if duration_ms > 0 else 0
            
            # Cleanup
            await engine.dispose()
            if Path(temp_db).exists():
                Path(temp_db).unlink()
            
            return BenchmarkResult(
                operation="INSERT",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=records_per_second,
                memory_usage_mb=memory_usage,
                cpu_percent=cpu_usage,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="INSERT",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _benchmark_select_operations(self, record_count: int) -> BenchmarkResult:
        """Benchmark SELECT operations"""
        try:
            # Use existing database for SELECT tests
            main_db = self.database_paths["main"]
            if not Path(main_db).exists():
                # Create minimal test database
                conn = sqlite3.connect(main_db)
                conn.execute("CREATE TABLE test_select (id INTEGER PRIMARY KEY, name TEXT)")
                for i in range(min(record_count, 100)):
                    conn.execute("INSERT INTO test_select (name) VALUES (?)", (f"test_{i}",))
                conn.commit()
                conn.close()
            
            engine = create_async_engine(f"sqlite+aiosqlite:///{main_db}", poolclass=StaticPool)
            
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            async with engine.begin() as conn:
                # Test various SELECT operations
                for i in range(record_count):
                    # Simple SELECT
                    await conn.execute(text("SELECT COUNT(*) FROM sqlite_master WHERE type='table'"))
                    
                    # More complex SELECT (if tables exist)
                    try:
                        await conn.execute(text("SELECT * FROM projects LIMIT 1"))
                    except:
                        pass
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            duration_ms = (end_time - start_time) * 1000
            memory_usage = end_memory - start_memory
            records_per_second = record_count / (duration_ms / 1000) if duration_ms > 0 else 0
            
            await engine.dispose()
            
            return BenchmarkResult(
                operation="SELECT",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=records_per_second,
                memory_usage_mb=memory_usage,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="SELECT",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _benchmark_update_operations(self, record_count: int) -> BenchmarkResult:
        """Benchmark UPDATE operations"""
        try:
            temp_db = "data/temp_update_benchmark.db"
            engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool)
            
            # Setup test data
            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE test_update (
                        id INTEGER PRIMARY KEY,
                        name TEXT,
                        value INTEGER
                    )
                """))
                
                for i in range(record_count):
                    await conn.execute(text("""
                        INSERT INTO test_update (name, value) VALUES (:name, :value)
                    """), {"name": f"test_{i}", "value": i})
            
            # Benchmark UPDATE operations
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            async with engine.begin() as conn:
                for i in range(record_count):
                    await conn.execute(text("""
                        UPDATE test_update SET value = :new_value WHERE id = :id
                    """), {"new_value": i * 2, "id": i + 1})
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            duration_ms = (end_time - start_time) * 1000
            memory_usage = end_memory - start_memory
            records_per_second = record_count / (duration_ms / 1000) if duration_ms > 0 else 0
            
            await engine.dispose()
            if Path(temp_db).exists():
                Path(temp_db).unlink()
            
            return BenchmarkResult(
                operation="UPDATE",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=records_per_second,
                memory_usage_mb=memory_usage,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="UPDATE",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _benchmark_delete_operations(self, record_count: int) -> BenchmarkResult:
        """Benchmark DELETE operations"""
        try:
            temp_db = "data/temp_delete_benchmark.db"
            engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool)
            
            # Setup test data
            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE test_delete (
                        id INTEGER PRIMARY KEY,
                        name TEXT
                    )
                """))
                
                for i in range(record_count * 2):  # Create more records than we'll delete
                    await conn.execute(text("""
                        INSERT INTO test_delete (name) VALUES (:name)
                    """), {"name": f"test_{i}"})
            
            # Benchmark DELETE operations
            start_time = time.time()
            
            async with engine.begin() as conn:
                for i in range(record_count):
                    await conn.execute(text("DELETE FROM test_delete WHERE id = :id"), {"id": i + 1})
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            records_per_second = record_count / (duration_ms / 1000) if duration_ms > 0 else 0
            
            await engine.dispose()
            if Path(temp_db).exists():
                Path(temp_db).unlink()
            
            return BenchmarkResult(
                operation="DELETE",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=records_per_second,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="DELETE",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _run_query_benchmarks(self) -> List[BenchmarkResult]:
        """Run complex query performance benchmarks"""
        benchmarks = []
        
        # Test JOIN operations
        join_benchmark = await self._benchmark_join_queries()
        benchmarks.append(join_benchmark)
        
        # Test aggregation queries
        agg_benchmark = await self._benchmark_aggregation_queries()
        benchmarks.append(agg_benchmark)
        
        # Test full-text search (if available)
        search_benchmark = await self._benchmark_search_queries()
        benchmarks.append(search_benchmark)
        
        return benchmarks
    
    async def _benchmark_join_queries(self) -> BenchmarkResult:
        """Benchmark JOIN query performance"""
        try:
            # Use main database for realistic JOIN tests
            main_db = self.database_paths["main"]
            if not Path(main_db).exists():
                return BenchmarkResult(
                    operation="JOIN",
                    duration_ms=0,
                    records_processed=0,
                    records_per_second=0,
                    memory_usage_mb=0,
                    cpu_percent=0,
                    success=False,
                    error_message="Main database not found"
                )
            
            engine = create_async_engine(f"sqlite+aiosqlite:///{main_db}", poolclass=StaticPool)
            
            start_time = time.time()
            queries_executed = 0
            
            async with engine.begin() as conn:
                # Test various JOIN scenarios
                join_queries = [
                    "SELECT COUNT(*) FROM sqlite_master m1 JOIN sqlite_master m2 ON m1.type = m2.type",
                    # Add more complex JOINs based on actual schema
                ]
                
                for query in join_queries:
                    try:
                        await conn.execute(text(query))
                        queries_executed += 1
                    except Exception:
                        # Skip queries that don't work with current schema
                        pass
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            
            await engine.dispose()
            
            return BenchmarkResult(
                operation="JOIN",
                duration_ms=duration_ms,
                records_processed=queries_executed,
                records_per_second=queries_executed / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="JOIN",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _benchmark_aggregation_queries(self) -> BenchmarkResult:
        """Benchmark aggregation query performance"""
        try:
            main_db = self.database_paths["main"]
            if not Path(main_db).exists():
                return BenchmarkResult(
                    operation="AGGREGATION",
                    duration_ms=0,
                    records_processed=0,
                    records_per_second=0,
                    memory_usage_mb=0,
                    cpu_percent=0,
                    success=False,
                    error_message="Main database not found"
                )
            
            engine = create_async_engine(f"sqlite+aiosqlite:///{main_db}", poolclass=StaticPool)
            
            start_time = time.time()
            queries_executed = 0
            
            async with engine.begin() as conn:
                # Test aggregation functions
                agg_queries = [
                    "SELECT COUNT(*) FROM sqlite_master",
                    "SELECT type, COUNT(*) FROM sqlite_master GROUP BY type",
                    "SELECT MAX(LENGTH(name)), MIN(LENGTH(name)), AVG(LENGTH(name)) FROM sqlite_master",
                ]
                
                for query in agg_queries:
                    try:
                        await conn.execute(text(query))
                        queries_executed += 1
                    except Exception:
                        pass
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            
            await engine.dispose()
            
            return BenchmarkResult(
                operation="AGGREGATION",
                duration_ms=duration_ms,
                records_processed=queries_executed,
                records_per_second=queries_executed / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="AGGREGATION",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _benchmark_search_queries(self) -> BenchmarkResult:
        """Benchmark full-text search performance"""
        try:
            temp_db = "data/temp_search_benchmark.db"
            engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool)
            
            # Create test data with searchable content
            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE VIRTUAL TABLE search_test USING fts5(title, content)
                """))
                
                # Insert test documents
                test_docs = [
                    ("Performance Testing", "Database performance optimization and benchmarking"),
                    ("Query Analysis", "SQL query performance analysis and optimization"),
                    ("Index Management", "Database index management and maintenance"),
                    ("Backup Systems", "Database backup and recovery systems"),
                    ("Migration Tools", "Database migration and schema management"),
                ]
                
                for title, content in test_docs:
                    await conn.execute(text("""
                        INSERT INTO search_test (title, content) VALUES (:title, :content)
                    """), {"title": title, "content": content})
            
            start_time = time.time()
            searches_executed = 0
            
            async with engine.begin() as conn:
                # Test various search patterns
                search_terms = ["performance", "database", "optimization", "management", "systems"]
                
                for term in search_terms:
                    try:
                        await conn.execute(text("""
                            SELECT * FROM search_test WHERE search_test MATCH :term
                        """), {"term": term})
                        searches_executed += 1
                    except Exception:
                        pass
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            
            await engine.dispose()
            if Path(temp_db).exists():
                Path(temp_db).unlink()
            
            return BenchmarkResult(
                operation="SEARCH",
                duration_ms=duration_ms,
                records_processed=searches_executed,
                records_per_second=searches_executed / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="SEARCH",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _run_concurrency_benchmarks(self) -> List[BenchmarkResult]:
        """Run concurrent operation benchmarks"""
        benchmarks = []
        
        # Test concurrent reads
        concurrent_read_benchmark = await self._benchmark_concurrent_reads()
        benchmarks.append(concurrent_read_benchmark)
        
        # Test concurrent writes
        concurrent_write_benchmark = await self._benchmark_concurrent_writes()
        benchmarks.append(concurrent_write_benchmark)
        
        return benchmarks
    
    async def _benchmark_concurrent_reads(self) -> BenchmarkResult:
        """Benchmark concurrent read operations"""
        try:
            main_db = self.database_paths["main"]
            if not Path(main_db).exists():
                # Create minimal test database
                conn = sqlite3.connect(main_db)
                conn.execute("CREATE TABLE concurrent_test (id INTEGER PRIMARY KEY, data TEXT)")
                for i in range(50):
                    conn.execute("INSERT INTO concurrent_test (data) VALUES (?)", (f"data_{i}",))
                conn.commit()
                conn.close()
            
            concurrent_tasks = 5
            queries_per_task = 20
            
            async def read_task():
                engine = create_async_engine(f"sqlite+aiosqlite:///{main_db}", poolclass=StaticPool)
                async with engine.begin() as conn:
                    for _ in range(queries_per_task):
                        await conn.execute(text("SELECT COUNT(*) FROM sqlite_master"))
                await engine.dispose()
            
            start_time = time.time()
            
            # Run concurrent read tasks
            tasks = [read_task() for _ in range(concurrent_tasks)]
            await asyncio.gather(*tasks)
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            total_queries = concurrent_tasks * queries_per_task
            
            return BenchmarkResult(
                operation="CONCURRENT_READ",
                duration_ms=duration_ms,
                records_processed=total_queries,
                records_per_second=total_queries / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="CONCURRENT_READ",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _benchmark_concurrent_writes(self) -> BenchmarkResult:
        """Benchmark concurrent write operations"""
        try:
            temp_db = "data/temp_concurrent_write_benchmark.db"
            
            # Create separate databases for each write task to avoid locking
            concurrent_tasks = 3
            writes_per_task = 10
            
            async def write_task(task_id: int):
                task_db = f"data/temp_write_task_{task_id}.db"
                engine = create_async_engine(f"sqlite+aiosqlite:///{task_db}", poolclass=StaticPool)
                
                async with engine.begin() as conn:
                    await conn.execute(text("""
                        CREATE TABLE task_test (id INTEGER PRIMARY KEY, data TEXT)
                    """))
                    
                    for i in range(writes_per_task):
                        await conn.execute(text("""
                            INSERT INTO task_test (data) VALUES (:data)
                        """), {"data": f"task_{task_id}_record_{i}"})
                
                await engine.dispose()
                if Path(task_db).exists():
                    Path(task_db).unlink()
            
            start_time = time.time()
            
            # Run concurrent write tasks
            tasks = [write_task(i) for i in range(concurrent_tasks)]
            await asyncio.gather(*tasks)
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            total_writes = concurrent_tasks * writes_per_task
            
            return BenchmarkResult(
                operation="CONCURRENT_WRITE",
                duration_ms=duration_ms,
                records_processed=total_writes,
                records_per_second=total_writes / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="CONCURRENT_WRITE",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _run_stress_tests(self) -> List[BenchmarkResult]:
        """Run stress tests with high load"""
        benchmarks = []
        
        # High-volume insert test
        stress_insert = await self._stress_test_inserts()
        benchmarks.append(stress_insert)
        
        # Memory pressure test
        memory_stress = await self._stress_test_memory()
        benchmarks.append(memory_stress)
        
        return benchmarks
    
    async def _stress_test_inserts(self) -> BenchmarkResult:
        """Stress test with high-volume inserts"""
        try:
            record_count = 1000
            temp_db = "data/temp_stress_insert.db"
            engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool)
            
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE stress_test (
                        id INTEGER PRIMARY KEY,
                        data1 TEXT,
                        data2 TEXT,
                        data3 TEXT,
                        timestamp DATETIME
                    )
                """))
                
                # Batch insert for better performance
                batch_size = 100
                for batch_start in range(0, record_count, batch_size):
                    batch_data = []
                    for i in range(batch_start, min(batch_start + batch_size, record_count)):
                        batch_data.append({
                            "data1": f"stress_test_data_1_{i}" * 5,
                            "data2": f"stress_test_data_2_{i}" * 3,
                            "data3": f"stress_test_data_3_{i}" * 2,
                            "timestamp": datetime.utcnow()
                        })
                    
                    # Execute batch
                    for data in batch_data:
                        await conn.execute(text("""
                            INSERT INTO stress_test (data1, data2, data3, timestamp) 
                            VALUES (:data1, :data2, :data3, :timestamp)
                        """), data)
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            duration_ms = (end_time - start_time) * 1000
            memory_usage = end_memory - start_memory
            records_per_second = record_count / (duration_ms / 1000) if duration_ms > 0 else 0
            
            await engine.dispose()
            if Path(temp_db).exists():
                Path(temp_db).unlink()
            
            return BenchmarkResult(
                operation="STRESS_INSERT",
                duration_ms=duration_ms,
                records_processed=record_count,
                records_per_second=records_per_second,
                memory_usage_mb=memory_usage,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="STRESS_INSERT",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _stress_test_memory(self) -> BenchmarkResult:
        """Stress test memory usage with large operations"""
        try:
            temp_db = "data/temp_memory_stress.db"
            engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db}", poolclass=StaticPool)
            
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            peak_memory = start_memory
            
            async with engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE memory_test (
                        id INTEGER PRIMARY KEY,
                        large_data TEXT
                    )
                """))
                
                # Create large text data to stress memory
                large_text = "X" * 10000  # 10KB per record
                
                for i in range(100):  # 1MB total
                    await conn.execute(text("""
                        INSERT INTO memory_test (large_data) VALUES (:data)
                    """), {"data": large_text})
                    
                    # Check peak memory usage
                    current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                    peak_memory = max(peak_memory, current_memory)
                
                # Perform memory-intensive queries
                await conn.execute(text("""
                    SELECT COUNT(*), LENGTH(GROUP_CONCAT(large_data, '|')) FROM memory_test
                """))
            
            end_time = time.time()
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            duration_ms = (end_time - start_time) * 1000
            memory_usage = peak_memory - start_memory
            
            await engine.dispose()
            if Path(temp_db).exists():
                Path(temp_db).unlink()
            
            return BenchmarkResult(
                operation="MEMORY_STRESS",
                duration_ms=duration_ms,
                records_processed=100,
                records_per_second=100 / (duration_ms / 1000) if duration_ms > 0 else 0,
                memory_usage_mb=memory_usage,
                cpu_percent=0,
                success=True
            )
            
        except Exception as e:
            return BenchmarkResult(
                operation="MEMORY_STRESS",
                duration_ms=0,
                records_processed=0,
                records_per_second=0,
                memory_usage_mb=0,
                cpu_percent=0,
                success=False,
                error_message=str(e)
            )
    
    async def _generate_performance_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Analyze database stats
        for db_name, stats in results["database_stats"].items():
            if stats["performance_score"] < 7:
                recommendations.append(f"🔧 {db_name} database performance is below optimal ({stats['performance_score']}/10)")
            
            if stats["vacuum_recommended"]:
                recommendations.append(f"🧹 Run VACUUM on {db_name} database to reduce fragmentation ({stats['fragmentation_percent']:.1f}%)")
            
            if stats["file_size_mb"] > 50 and stats["total_records"] < 10000:
                recommendations.append(f"📦 {db_name} database may have inefficient storage (large file, few records)")
        
        # Analyze benchmark results
        benchmark_results = results["benchmark_results"]
        
        # Find slow operations
        slow_operations = [b for b in benchmark_results if b.get("duration_ms", 0) > 1000]
        for op in slow_operations:
            recommendations.append(f"⚠️  {op['operation']} operations are slow ({op['duration_ms']:.0f}ms)")
        
        # Find low throughput operations
        low_throughput = [b for b in benchmark_results if b.get("records_per_second", 0) < 50 and b.get("success")]
        for op in low_throughput:
            recommendations.append(f"📉 {op['operation']} throughput is low ({op['records_per_second']:.1f} rec/sec)")
        
        # Memory usage recommendations
        high_memory = [b for b in benchmark_results if b.get("memory_usage_mb", 0) > 100]
        for op in high_memory:
            recommendations.append(f"🧠 {op['operation']} operations use high memory ({op['memory_usage_mb']:.1f} MB)")
        
        # General recommendations
        if len([b for b in benchmark_results if not b.get("success", True)]) > 0:
            recommendations.append("❌ Some benchmark operations failed - check database connectivity and permissions")
        
        # Index recommendations
        recommendations.append("📚 Consider adding indexes for frequently queried columns")
        recommendations.append("🔄 Schedule regular database maintenance (ANALYZE, VACUUM)")
        recommendations.append("📊 Monitor query patterns and optimize based on actual usage")
        
        return recommendations
    
    def _calculate_overall_score(self, benchmark_results: List[Dict[str, Any]]) -> float:
        """Calculate overall performance score (0-10)"""
        if not benchmark_results:
            return 0.0
        
        scores = []
        
        for result in benchmark_results:
            if not result.get("success"):
                scores.append(0.0)
                continue
            
            # Score based on records per second (normalized)
            rps = result.get("records_per_second", 0)
            if rps > 1000:
                score = 10.0
            elif rps > 500:
                score = 8.0
            elif rps > 100:
                score = 6.0
            elif rps > 50:
                score = 4.0
            elif rps > 10:
                score = 2.0
            else:
                score = 1.0
            
            # Adjust for duration (penalize very slow operations)
            duration = result.get("duration_ms", 0)
            if duration > 5000:
                score *= 0.5
            elif duration > 2000:
                score *= 0.7
            elif duration > 1000:
                score *= 0.9
            
            scores.append(score)
        
        return round(statistics.mean(scores) if scores else 0.0, 1)
    
    async def optimize_database(self, db_name: str) -> Dict[str, Any]:
        """
        Perform database optimization operations including index_optimization
        
        Args:
            db_name: Database name to optimize
            
        Returns:
            Dictionary with optimization results
        """
        results = {
            "database": db_name,
            "optimization_timestamp": datetime.utcnow(),
            "operations": [],
            "success": False,
            "errors": []
        }
        
        try:
            db_path = self.database_paths.get(db_name)
            if not db_path or not Path(db_path).exists():
                results["errors"].append(f"Database {db_name} not found")
                return results
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Run VACUUM to reduce fragmentation
            print(f"🧹 Running VACUUM on {db_name}...")
            cursor.execute("VACUUM")
            results["operations"].append("VACUUM completed")
            
            # Run ANALYZE to update statistics
            print(f"📊 Running ANALYZE on {db_name}...")
            cursor.execute("ANALYZE")
            results["operations"].append("ANALYZE completed")
            
            # Perform index_optimization
            print(f"🔍 Running index_optimization on {db_name}...")
            index_optimization_results = await self._perform_index_optimization(cursor)
            results["operations"].extend(index_optimization_results)
            
            conn.commit()
            conn.close()
            
            results["success"] = True
            print(f"✅ Database optimization completed for {db_name}")
            
        except Exception as e:
            error_msg = f"Optimization failed for {db_name}: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
        
        return results
    
    async def _perform_index_optimization(self, cursor: sqlite3.Cursor) -> List[str]:
        """
        Perform index_optimization analysis and recommendations
        
        Args:
            cursor: Database cursor for executing queries
            
        Returns:
            List of optimization operations performed
        """
        operations = []
        
        try:
            # Get all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            for (table_name,) in tables:
                try:
                    # Check existing indexes for this table
                    cursor.execute(f"""
                        SELECT sql FROM sqlite_master 
                        WHERE type='index' AND tbl_name='{table_name}' AND sql IS NOT NULL
                    """)
                    existing_indexes = cursor.fetchall()
                    
                    # Get table info to understand columns
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    columns = cursor.fetchall()
                    
                    # Analyze index effectiveness
                    for index_sql in existing_indexes:
                        index_name = self._extract_index_name(index_sql[0])
                        if index_name:
                            # Check index usage statistics
                            cursor.execute(f"PRAGMA index_info({index_name})")
                            index_info = cursor.fetchall()
                            operations.append(f"Analyzed index {index_name} on table {table_name}")
                    
                    # Suggest missing indexes for foreign key columns
                    for col_info in columns:
                        col_name = col_info[1]  # Column name is second element
                        if 'id' in col_name.lower() and col_name != 'id':
                            # Likely a foreign key, check if it has an index
                            has_index = any(col_name in str(idx[0]).lower() for idx in existing_indexes)
                            if not has_index:
                                operations.append(f"Recommended: CREATE INDEX idx_{table_name}_{col_name} ON {table_name}({col_name})")
                    
                    operations.append(f"index_optimization completed for table {table_name}: {len(existing_indexes)} indexes found")
                    
                except sqlite3.Error as e:
                    operations.append(f"index_optimization warning for {table_name}: {str(e)}")
            
        except Exception as e:
            operations.append(f"index_optimization error: {str(e)}")
        
        return operations
    
    def _extract_index_name(self, index_sql: str) -> Optional[str]:
        """Extract index name from CREATE INDEX SQL"""
        try:
            # Simple extraction for CREATE INDEX statements
            parts = index_sql.split()
            if len(parts) > 2 and parts[0].upper() == 'CREATE' and parts[1].upper() == 'INDEX':
                return parts[2]
        except Exception:
            pass
        return None
    
    async def quick_performance_check(self) -> Dict[str, Any]:
        """
        Quick performance health check
        
        Returns:
            Dictionary with performance summary
        """
        results = {
            "check_timestamp": datetime.utcnow(),
            "database_status": {},
            "quick_benchmarks": [],
            "health_score": 0.0,
            "recommendations": []
        }
        
        try:
            print("⚡ Running quick performance check...")
            
            # Check database file sizes and basic stats
            for db_name, db_path in self.database_paths.items():
                if Path(db_path).exists():
                    file_size = Path(db_path).stat().st_size / (1024 * 1024)
                    results["database_status"][db_name] = {
                        "exists": True,
                        "size_mb": round(file_size, 2)
                    }
                else:
                    results["database_status"][db_name] = {
                        "exists": False,
                        "size_mb": 0
                    }
            
            # Run minimal benchmarks
            quick_insert = await self._benchmark_insert_operations(10)
            results["quick_benchmarks"].append(asdict(quick_insert))
            
            quick_select = await self._benchmark_select_operations(50)
            results["quick_benchmarks"].append(asdict(quick_select))
            
            # Calculate health score
            successful_benchmarks = [b for b in results["quick_benchmarks"] if b["success"]]
            if successful_benchmarks:
                avg_rps = statistics.mean([b["records_per_second"] for b in successful_benchmarks])
                results["health_score"] = min(10.0, max(0.0, avg_rps / 100))
            
            # Generate quick recommendations
            if results["health_score"] < 5:
                results["recommendations"].append("Performance is below average - consider running full benchmark")
            
            if any(not db["exists"] for db in results["database_status"].values()):
                results["recommendations"].append("Some databases are missing - check system configuration")
            
            print(f"✅ Quick check completed. Health score: {results['health_score']:.1f}/10")
            
        except Exception as e:
            print(f"❌ Quick performance check failed: {e}")
        
        return results


# Convenience functions for direct usage
async def run_benchmark(include_stress: bool = False) -> Dict[str, Any]:
    """Run comprehensive performance benchmark"""
    optimizer = DatabasePerformanceOptimizer()
    return await optimizer.run_comprehensive_benchmark(include_stress_tests=include_stress)


async def optimize_all_databases() -> List[Dict[str, Any]]:
    """Optimize all databases"""
    optimizer = DatabasePerformanceOptimizer()
    results = []
    
    for db_name in optimizer.database_paths.keys():
        result = await optimizer.optimize_database(db_name)
        results.append(result)
    
    return results


async def quick_check() -> Dict[str, Any]:
    """Quick performance health check"""
    optimizer = DatabasePerformanceOptimizer()
    return await optimizer.quick_performance_check()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database performance optimization utility")
    parser.add_argument("--benchmark", action="store_true", help="Run comprehensive benchmark")
    parser.add_argument("--stress", action="store_true", help="Include stress tests in benchmark")
    parser.add_argument("--optimize", help="Optimize specific database")
    parser.add_argument("--optimize-all", action="store_true", help="Optimize all databases")
    parser.add_argument("--quick", action="store_true", help="Quick performance check")
    
    args = parser.parse_args()
    
    async def main():
        if args.benchmark:
            print("🚀 Starting comprehensive benchmark...")
            results = await run_benchmark(include_stress=args.stress)
            print(f"\n📊 Benchmark Results:")
            print(f"Overall Score: {results['overall_score']}/10")
            print(f"Recommendations: {len(results['performance_recommendations'])}")
            for rec in results['performance_recommendations'][:5]:  # Show first 5
                print(f"  • {rec}")
        
        elif args.optimize:
            print(f"🔧 Optimizing {args.optimize} database...")
            optimizer = DatabasePerformanceOptimizer()
            result = await optimizer.optimize_database(args.optimize)
            print(f"Success: {result['success']}")
            if result['operations']:
                print("Operations:")
                for op in result['operations']:
                    print(f"  • {op}")
        
        elif args.optimize_all:
            print("🔧 Optimizing all databases...")
            results = await optimize_all_databases()
            for result in results:
                print(f"{result['database']}: {'✅' if result['success'] else '❌'}")
        
        elif args.quick:
            print("⚡ Quick performance check...")
            results = await quick_check()
            print(f"Health Score: {results['health_score']:.1f}/10")
            if results['recommendations']:
                print("Recommendations:")
                for rec in results['recommendations']:
                    print(f"  • {rec}")
        
        else:
            parser.print_help()
    
    asyncio.run(main())