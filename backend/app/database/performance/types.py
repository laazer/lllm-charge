"""
Shared data types for database performance benchmarking.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class BenchmarkResult:
    """Performance benchmark results for a single operation."""
    operation: str
    duration_ms: float
    records_processed: int
    records_per_second: float
    memory_usage_mb: float
    cpu_percent: float
    success: bool
    error_message: Optional[str] = None
    timestamp: Optional[datetime] = None

    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class DatabaseStats:
    """Statistics and health metrics for a single database."""
    db_name: str
    file_size_mb: float
    table_count: int
    total_records: int
    index_count: int
    fragmentation_percent: float
    vacuum_recommended: bool
    last_analyzed: datetime
    performance_score: float
