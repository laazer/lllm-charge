"""
ScoringEngine: calculates performance scores and generates recommendations.

Separated from benchmarking so scoring logic can be unit-tested without
running any database operations.
"""
import logging
import statistics
from typing import Any, Dict, List

from .constants import PerformanceConstants

logger = logging.getLogger(__name__)


class ScoringEngine:
    """Calculates performance scores and generates human-readable recommendations."""

    def calculate_db_performance_score(
        self,
        file_size_mb: float,
        table_count: int,
        total_records: int,
        fragmentation_percent: float,
    ) -> float:
        """Return a 0-10 score for a single database based on its stats."""
        score = 10.0

        if file_size_mb > 0 and total_records > 0:
            mb_per_record = file_size_mb / total_records
            if mb_per_record > PerformanceConstants.RECORD_SIZE_THRESHOLD_KB / 1000:
                score -= min(
                    PerformanceConstants.FRAGMENTATION_PENALTY_WEIGHT,
                    mb_per_record * 1000,
                )

        if fragmentation_percent > PerformanceConstants.FRAGMENTATION_WARNING_PERCENT:
            score -= min(
                PerformanceConstants.FRAGMENTATION_MAX_PENALTY,
                fragmentation_percent / PerformanceConstants.FRAGMENTATION_WARNING_PERCENT,
            )

        if table_count > PerformanceConstants.MAX_TABLE_COUNT_PENALTY:
            score -= min(
                PerformanceConstants.COMPLEXITY_MAX_PENALTY,
                (table_count - PerformanceConstants.MAX_TABLE_COUNT_PENALTY) / 10,
            )

        return max(0.0, score)

    def calculate_overall_score(self, benchmark_results: List[Dict[str, Any]]) -> float:
        """Return a 0-10 mean score across all benchmark results."""
        if not benchmark_results:
            return 0.0

        scores = [self._score_single_result(result) for result in benchmark_results]
        return round(statistics.mean(scores), 1)

    def generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Return a list of human-readable optimisation recommendations."""
        recommendations: List[str] = []

        for db_name, stats in results.get("database_stats", {}).items():
            if stats["performance_score"] < PerformanceConstants.LOW_PERFORMANCE_SCORE_THRESHOLD:
                recommendations.append(
                    f"🔧 {db_name} database performance is below optimal "
                    f"({stats['performance_score']}/10)"
                )
            if stats["vacuum_recommended"]:
                recommendations.append(
                    f"🧹 Run VACUUM on {db_name} database to reduce fragmentation "
                    f"({stats['fragmentation_percent']:.1f}%)"
                )
            if (
                stats["file_size_mb"] > PerformanceConstants.LARGE_FILE_SIZE_MB
                and stats["total_records"] < PerformanceConstants.FEW_RECORDS_THRESHOLD
            ):
                recommendations.append(
                    f"📦 {db_name} database may have inefficient storage "
                    "(large file, few records)"
                )

        benchmark_results = results.get("benchmark_results", [])

        for op in benchmark_results:
            if op.get("duration_ms", 0) > PerformanceConstants.SLOW_OPERATION_THRESHOLD_MS:
                recommendations.append(
                    f"⚠️  {op['operation']} operations are slow ({op['duration_ms']:.0f}ms)"
                )

        for op in benchmark_results:
            if (
                op.get("records_per_second", 0) < PerformanceConstants.LOW_THROUGHPUT_THRESHOLD_RPS
                and op.get("success")
            ):
                recommendations.append(
                    f"📉 {op['operation']} throughput is low "
                    f"({op['records_per_second']:.1f} rec/sec)"
                )

        for op in benchmark_results:
            if op.get("memory_usage_mb", 0) > PerformanceConstants.HIGH_MEMORY_THRESHOLD_MB:
                recommendations.append(
                    f"🧠 {op['operation']} operations use high memory "
                    f"({op['memory_usage_mb']:.1f} MB)"
                )

        failed_count = sum(1 for b in benchmark_results if not b.get("success", True))
        if failed_count > 0:
            recommendations.append(
                "❌ Some benchmark operations failed — check database connectivity and permissions"
            )

        recommendations.append("📚 Consider adding indexes for frequently queried columns")
        recommendations.append("🔄 Schedule regular database maintenance (ANALYZE, VACUUM)")
        recommendations.append("📊 Monitor query patterns and optimise based on actual usage")

        return recommendations

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _score_single_result(self, result: Dict[str, Any]) -> float:
        if not result.get("success"):
            return 0.0

        rps = result.get("records_per_second", 0)
        score = self._rps_to_score(rps)

        duration = result.get("duration_ms", 0)
        score *= self._duration_penalty_factor(duration)

        return score

    @staticmethod
    def _rps_to_score(rps: float) -> float:
        if rps > PerformanceConstants.RPS_EXCELLENT:
            return 10.0
        if rps > PerformanceConstants.RPS_GOOD:
            return 8.0
        if rps > PerformanceConstants.RPS_ACCEPTABLE:
            return 6.0
        if rps > PerformanceConstants.RPS_BELOW_AVERAGE:
            return 4.0
        if rps > PerformanceConstants.RPS_POOR:
            return 2.0
        return 1.0

    @staticmethod
    def _duration_penalty_factor(duration_ms: float) -> float:
        if duration_ms > PerformanceConstants.DURATION_CRITICAL_MS:
            return 0.5
        if duration_ms > PerformanceConstants.DURATION_SLOW_MS:
            return 0.7
        if duration_ms > PerformanceConstants.DURATION_MODERATE_MS:
            return 0.9
        return 1.0
