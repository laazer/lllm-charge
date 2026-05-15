"""
Named constants for database performance thresholds and defaults.

Centralising these eliminates the magic numbers that were scattered across
DatabasePerformanceOptimizer and makes each threshold configurable in tests.
"""


class PerformanceConstants:
    # Scoring thresholds
    RECORD_SIZE_THRESHOLD_KB: float = 1.0          # >1 KB per record triggers a score penalty
    FRAGMENTATION_PENALTY_WEIGHT: float = 2.0       # Max score deduction for record-size penalty
    FRAGMENTATION_WARNING_PERCENT: float = 5.0      # Fragmentation above this starts deductions
    FRAGMENTATION_MAX_PENALTY: float = 3.0          # Max score deduction for fragmentation
    MAX_TABLE_COUNT_PENALTY: int = 20               # Tables above this count trigger complexity penalty
    COMPLEXITY_MAX_PENALTY: float = 1.0             # Max score deduction for too many tables

    # Overall score bands (records per second → score mapping)
    RPS_EXCELLENT: float = 1000.0    # Score 10
    RPS_GOOD: float = 500.0          # Score 8
    RPS_ACCEPTABLE: float = 100.0    # Score 6
    RPS_BELOW_AVERAGE: float = 50.0  # Score 4
    RPS_POOR: float = 10.0           # Score 2
    # Anything below RPS_POOR → score 1

    # Duration penalty thresholds (milliseconds)
    DURATION_CRITICAL_MS: float = 5000.0   # Penalty factor 0.5
    DURATION_SLOW_MS: float = 2000.0       # Penalty factor 0.7
    DURATION_MODERATE_MS: float = 1000.0   # Penalty factor 0.9

    # Recommendation thresholds
    SLOW_OPERATION_THRESHOLD_MS: float = 1000.0
    LOW_THROUGHPUT_THRESHOLD_RPS: float = 50.0
    HIGH_MEMORY_THRESHOLD_MB: float = 100.0
    LOW_PERFORMANCE_SCORE_THRESHOLD: float = 7.0
    LARGE_FILE_SIZE_MB: float = 50.0
    FEW_RECORDS_THRESHOLD: int = 10_000

    # Default benchmark record counts
    DEFAULT_INSERT_COUNT: int = 100
    DEFAULT_SELECT_COUNT: int = 500
    DEFAULT_UPDATE_COUNT: int = 50
    DEFAULT_DELETE_COUNT: int = 25

    # Stress test settings
    STRESS_INSERT_RECORD_COUNT: int = 1000
    STRESS_INSERT_BATCH_SIZE: int = 100
    STRESS_MEMORY_RECORD_COUNT: int = 100
    STRESS_MEMORY_RECORD_SIZE_BYTES: int = 10_000

    # Concurrency settings
    CONCURRENT_READ_TASKS: int = 5
    CONCURRENT_READ_QUERIES_PER_TASK: int = 20
    CONCURRENT_WRITE_TASKS: int = 3
    CONCURRENT_WRITE_RECORDS_PER_TASK: int = 10

    # Vacuum recommendation
    VACUUM_FRAGMENTATION_THRESHOLD: float = 10.0
