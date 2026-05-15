"""HybridRouter — selects the optimal LLM provider per request.

Routing formula (from spec):
    score = (1 - latency_ratio) * 0.4 + (1 - load_ratio) * 0.4 + reliability * 0.2

Complexity hint:
    "simple"  → prefer local providers
    "complex" → prefer cloud providers
"""
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.reasoning.circuit_breaker import CircuitBreaker
from app.reasoning.providers.base import BaseProvider

_FAILURE_THRESHOLD = 3
_RESET_TIMEOUT_SECONDS = 30.0
_MAX_LATENCY_MS = 1000.0  # assumed upper bound for latency normalisation


@dataclass
class RoutingLogEntry:
    prompt_preview: str
    chosen_provider: str
    latency_ms: float
    timestamp: float = field(default_factory=time.time)
    fallback: bool = False


class HybridRouter:
    """Routes prompts to the best available provider."""

    def __init__(self, providers: List[BaseProvider]) -> None:
        self._providers = providers
        self._circuit_breakers: Dict[str, CircuitBreaker] = {
            p.name: CircuitBreaker(_FAILURE_THRESHOLD, _RESET_TIMEOUT_SECONDS)
            for p in providers
        }
        self._routing_log: List[RoutingLogEntry] = []
        self._total_requests: int = 0
        self._local_requests: int = 0

    # ── Public API ────────────────────────────────────────────────────────────

    async def complete(
        self,
        prompt: str,
        *,
        prefer_local: bool = True,
        complexity: str = "simple",
        cost_threshold: Optional[float] = None,
        quality_threshold: Optional[float] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Route `prompt` to the best provider and return its completion."""
        candidates = await self._build_candidate_list(
            prefer_local=prefer_local,
            complexity=complexity,
        )
        if not candidates:
            raise RuntimeError("No providers available — all are down or circuit-open")

        start = time.time()
        result, chosen, used_fallback = await self._try_providers_in_order(
            prompt, candidates, **kwargs
        )
        latency_ms = (time.time() - start) * 1000

        result["latency_ms"] = latency_ms
        self._record_routing(prompt, chosen, latency_ms, used_fallback)
        return result

    def calculate_provider_score(
        self,
        latency_ratio: float,
        load_ratio: float,
        reliability_score: float,
    ) -> float:
        """Weighted scoring formula from the spec."""
        return (
            (1 - latency_ratio) * 0.4
            + (1 - load_ratio) * 0.4
            + reliability_score * 0.2
        )

    def get_routing_log(self) -> List[RoutingLogEntry]:
        return list(self._routing_log)

    def get_stats(self) -> Dict[str, Any]:
        """Return aggregate routing statistics."""
        local_pct = (
            self._local_requests / self._total_requests * 100
            if self._total_requests
            else 0.0
        )
        # Approximate cloud-only baseline cost at $0.01 / request
        cloud_only_cost = self._total_requests * 0.01
        actual_cost = (self._total_requests - self._local_requests) * 0.01
        cost_saved_pct = (
            (cloud_only_cost - actual_cost) / cloud_only_cost * 100
            if cloud_only_cost
            else 0.0
        )
        return {
            "total_requests": self._total_requests,
            "local_requests": self._local_requests,
            "local_percentage": round(local_pct, 2),
            "cost_saved_percentage": round(cost_saved_pct, 2),
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _build_candidate_list(
        self,
        prefer_local: bool,
        complexity: str,
    ) -> List[BaseProvider]:
        """Return available providers sorted by preference."""
        healthy_providers = await self._filter_healthy_providers()
        if not healthy_providers:
            return []

        force_cloud = complexity == "complex"
        force_local = prefer_local and complexity != "complex"

        if force_cloud:
            cloud = [p for p in healthy_providers if not p.is_local]
            local = [p for p in healthy_providers if p.is_local]
            return cloud + local

        if force_local:
            local = [p for p in healthy_providers if p.is_local]
            cloud = [p for p in healthy_providers if not p.is_local]
            return local + cloud

        return healthy_providers

    async def _filter_healthy_providers(self) -> List[BaseProvider]:
        """Return only providers whose circuit breaker allows requests."""
        available = []
        for provider in self._providers:
            cb = self._circuit_breakers[provider.name]
            if cb.allow_request():
                available.append(provider)
        return available

    async def _try_providers_in_order(
        self,
        prompt: str,
        candidates: List[BaseProvider],
        **kwargs: Any,
    ):
        """Attempt each candidate in order, recording circuit-breaker outcomes."""
        primary = candidates[0]
        fallback_used = False

        for index, provider in enumerate(candidates):
            cb = self._circuit_breakers[provider.name]
            try:
                result = await provider.complete(prompt, **kwargs)
                cb.record_success()
                if index > 0:
                    fallback_used = True
                return result, provider.name, fallback_used
            except Exception:
                cb.record_failure()

        raise RuntimeError("All providers failed")

    def _record_routing(
        self,
        prompt: str,
        provider_name: str,
        latency_ms: float,
        fallback: bool,
    ) -> None:
        self._total_requests += 1
        provider = next((p for p in self._providers if p.name == provider_name), None)
        if provider and provider.is_local:
            self._local_requests += 1

        entry = RoutingLogEntry(
            prompt_preview=prompt[:80],
            chosen_provider=provider_name,
            latency_ms=latency_ms,
            fallback=fallback,
        )
        self._routing_log.append(entry)
        # Keep log bounded to the last 1 000 entries
        if len(self._routing_log) > 1000:
            self._routing_log = self._routing_log[-1000:]
