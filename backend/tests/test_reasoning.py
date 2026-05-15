"""
Tests for MIG-001: Hybrid Reasoning Router

Acceptance criteria:
- HybridRouter.complete() routes to Ollama when prefer_local=True and Ollama is up
- Falls back to cloud provider when local unavailable
- GET /api/providers/status returns live health for each provider
- POST /mcp/call/hybrid_reasoning returns completion with provider metadata
- GET /api/reasoning/stats returns cost-savings percentage vs cloud-only
- Circuit breaker opens after 3 consecutive provider failures
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
import pytest
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run_async(coro):
    """Run an async coroutine synchronously in tests (Python 3.10+ compatible)."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Unit tests — HybridRouter routing logic
# ---------------------------------------------------------------------------

class TestHybridRouterRouting:
    """Tests for HybridRouter.complete() routing decisions."""

    def test_routes_to_ollama_when_prefer_local_and_ollama_healthy(self):
        """Routes to Ollama provider when prefer_local=True and Ollama responds."""
        from app.reasoning.hybrid_router import HybridRouter
        from app.reasoning.providers.ollama import OllamaProvider

        mock_provider = MagicMock(spec=OllamaProvider)
        mock_provider.name = "ollama"
        mock_provider.is_local = True
        mock_provider.complete = AsyncMock(return_value={
            "text": "Hello from Ollama",
            "provider": "ollama",
            "model": "llama2",
        })
        mock_provider.health_check = AsyncMock(return_value=True)

        router = HybridRouter(providers=[mock_provider])
        result = run_async(router.complete("Hello", prefer_local=True))

        assert result["provider"] == "ollama"
        assert result["text"] == "Hello from Ollama"
        mock_provider.complete.assert_called_once()

    def test_falls_back_to_cloud_when_local_unavailable(self):
        """Falls back to cloud provider when all local providers are down."""
        from app.reasoning.hybrid_router import HybridRouter
        from app.reasoning.providers.ollama import OllamaProvider
        from app.reasoning.providers.anthropic import AnthropicProvider

        local_provider = MagicMock(spec=OllamaProvider)
        local_provider.name = "ollama"
        local_provider.is_local = True
        local_provider.health_check = AsyncMock(return_value=False)
        local_provider.complete = AsyncMock(side_effect=RuntimeError("Ollama unavailable"))

        cloud_provider = MagicMock(spec=AnthropicProvider)
        cloud_provider.name = "anthropic"
        cloud_provider.is_local = False
        cloud_provider.health_check = AsyncMock(return_value=True)
        cloud_provider.complete = AsyncMock(return_value={
            "text": "Hello from Claude",
            "provider": "anthropic",
            "model": "claude-3-haiku-20240307",
        })

        router = HybridRouter(providers=[local_provider, cloud_provider])
        result = run_async(router.complete("Hello", prefer_local=True))

        assert result["provider"] == "anthropic"
        assert "Claude" in result["text"]

    def test_prefers_cloud_when_complexity_is_complex(self):
        """Routes complex requests to cloud regardless of prefer_local setting."""
        from app.reasoning.hybrid_router import HybridRouter
        from app.reasoning.providers.ollama import OllamaProvider
        from app.reasoning.providers.anthropic import AnthropicProvider

        local = MagicMock(spec=OllamaProvider)
        local.name = "ollama"
        local.is_local = True
        local.health_check = AsyncMock(return_value=True)
        local.complete = AsyncMock(return_value={"text": "local", "provider": "ollama", "model": "llama2"})

        cloud = MagicMock(spec=AnthropicProvider)
        cloud.name = "anthropic"
        cloud.is_local = False
        cloud.health_check = AsyncMock(return_value=True)
        cloud.complete = AsyncMock(return_value={"text": "cloud", "provider": "anthropic", "model": "claude-3-haiku-20240307"})

        router = HybridRouter(providers=[local, cloud])
        result = run_async(router.complete("Write a compiler", complexity="complex"))

        assert result["provider"] == "anthropic"

    def test_provider_metadata_included_in_result(self):
        """Completion result always includes provider name and latency_ms."""
        from app.reasoning.hybrid_router import HybridRouter
        from app.reasoning.providers.ollama import OllamaProvider

        provider = MagicMock(spec=OllamaProvider)
        provider.name = "ollama"
        provider.is_local = True
        provider.health_check = AsyncMock(return_value=True)
        provider.complete = AsyncMock(return_value={
            "text": "response",
            "provider": "ollama",
            "model": "llama2",
        })

        router = HybridRouter(providers=[provider])
        result = run_async(router.complete("test"))

        assert "provider" in result
        assert "latency_ms" in result

    def test_raises_when_no_providers_available(self):
        """Raises RuntimeError when all providers are down."""
        from app.reasoning.hybrid_router import HybridRouter
        from app.reasoning.providers.ollama import OllamaProvider

        provider = MagicMock(spec=OllamaProvider)
        provider.name = "ollama"
        provider.is_local = True
        provider.health_check = AsyncMock(return_value=False)
        provider.complete = AsyncMock(side_effect=RuntimeError("down"))

        router = HybridRouter(providers=[provider])
        with pytest.raises(RuntimeError):
            run_async(router.complete("test", prefer_local=False))


# ---------------------------------------------------------------------------
# Unit tests — Circuit breaker
# ---------------------------------------------------------------------------

class TestCircuitBreaker:
    """Tests for CircuitBreaker open/half-open/closed state machine."""

    def test_circuit_breaker_starts_closed(self):
        """A fresh circuit breaker is in closed (allow) state."""
        from app.reasoning.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=3, reset_timeout_seconds=30)
        assert cb.is_closed
        assert cb.allow_request()

    def test_circuit_opens_after_three_consecutive_failures(self):
        """Circuit breaker opens after failure_threshold consecutive failures."""
        from app.reasoning.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=3, reset_timeout_seconds=30)
        cb.record_failure()
        cb.record_failure()
        assert cb.allow_request(), "Should still be closed after 2 failures"
        cb.record_failure()
        assert not cb.allow_request(), "Should be open after 3 failures"

    def test_success_resets_failure_count(self):
        """A success after failures resets the consecutive failure counter."""
        from app.reasoning.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=3, reset_timeout_seconds=30)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        cb.record_failure()  # counter reset — only 1 failure now
        assert cb.allow_request(), "Should still be closed (failure count reset)"

    def test_circuit_enters_half_open_after_reset_timeout(self):
        """Circuit breaker allows a trial request after reset_timeout elapses."""
        import time
        from app.reasoning.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=3, reset_timeout_seconds=30)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()  # now open
        assert not cb.allow_request()

        # Simulate 30+ seconds elapsing by pushing _opened_at into the past
        cb._opened_at = time.time() - 31
        assert cb.allow_request(), "Should be half-open after timeout"

    def test_circuit_closes_after_successful_trial(self):
        """Circuit breaker closes after a successful request in half-open state."""
        import time
        from app.reasoning.circuit_breaker import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=3, reset_timeout_seconds=0)
        for _ in range(3):
            cb.record_failure()
        cb._opened_at = time.time() - 1  # force half-open

        assert cb.allow_request()  # half-open trial
        cb.record_success()
        assert cb.is_closed


# ---------------------------------------------------------------------------
# Unit tests — Provider score calculation
# ---------------------------------------------------------------------------

class TestProviderScoring:
    """Tests for the routing score formula from the spec."""

    def test_score_formula_weights(self):
        """Score = (1-latencyRatio)*0.4 + (1-loadRatio)*0.4 + reliability*0.2"""
        from app.reasoning.hybrid_router import HybridRouter

        router = HybridRouter(providers=[])
        score = router.calculate_provider_score(
            latency_ratio=0.0,
            load_ratio=0.0,
            reliability_score=1.0,
        )
        assert abs(score - 1.0) < 1e-9

    def test_score_degrades_with_high_latency(self):
        """Higher latency ratio reduces the score."""
        from app.reasoning.hybrid_router import HybridRouter

        router = HybridRouter(providers=[])
        low_latency_score = router.calculate_provider_score(0.1, 0.0, 1.0)
        high_latency_score = router.calculate_provider_score(0.9, 0.0, 1.0)
        assert high_latency_score < low_latency_score

    def test_score_degrades_with_low_reliability(self):
        """Lower reliability reduces the score."""
        from app.reasoning.hybrid_router import HybridRouter

        router = HybridRouter(providers=[])
        reliable_score = router.calculate_provider_score(0.0, 0.0, 1.0)
        unreliable_score = router.calculate_provider_score(0.0, 0.0, 0.5)
        assert unreliable_score < reliable_score


# ---------------------------------------------------------------------------
# API route tests — GET /api/providers/status
# ---------------------------------------------------------------------------

class TestProviderStatusAPI:
    """Tests for GET /api/providers/status."""

    def test_status_endpoint_returns_200(self):
        """GET /api/providers/status returns HTTP 200."""
        client = TestClient(app)
        response = client.get("/api/providers/status")
        assert response.status_code == 200

    def test_status_response_contains_providers_list(self):
        """Response body contains a providers list."""
        client = TestClient(app)
        response = client.get("/api/providers/status")
        data = response.json()
        assert "providers" in data

    def test_each_provider_has_required_fields(self):
        """Each provider entry has name, status, and is_local fields."""
        client = TestClient(app)
        response = client.get("/api/providers/status")
        data = response.json()
        for provider in data["providers"]:
            assert "name" in provider
            assert "status" in provider
            assert "is_local" in provider


# ---------------------------------------------------------------------------
# API route tests — POST /mcp/call/hybrid_reasoning
# ---------------------------------------------------------------------------

class TestHybridReasoningEndpoint:
    """Tests for POST /mcp/call/hybrid_reasoning."""

    def test_endpoint_returns_200_with_valid_prompt(self):
        """POST /mcp/call/hybrid_reasoning returns 200 with a prompt."""
        client = TestClient(app)
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {
                "text": "Test response",
                "provider": "ollama",
                "model": "llama2",
                "latency_ms": 50,
            }
            response = client.post(
                "/mcp/call/hybrid_reasoning",
                json={"prompt": "Hello world"},
            )
        assert response.status_code == 200

    def test_response_includes_provider_metadata(self):
        """Response includes provider name in the result."""
        client = TestClient(app)
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {
                "text": "Response",
                "provider": "ollama",
                "model": "llama2",
                "latency_ms": 40,
            }
            response = client.post(
                "/mcp/call/hybrid_reasoning",
                json={"prompt": "Test"},
            )
        data = response.json()
        assert "provider" in data

    def test_missing_prompt_returns_422(self):
        """POST without a prompt returns 422 Unprocessable Entity."""
        client = TestClient(app)
        response = client.post("/mcp/call/hybrid_reasoning", json={})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# API route tests — GET /api/reasoning/stats
# ---------------------------------------------------------------------------

class TestReasoningStatsAPI:
    """Tests for GET /api/reasoning/stats."""

    def test_stats_endpoint_returns_200(self):
        """GET /api/reasoning/stats returns HTTP 200."""
        client = TestClient(app)
        response = client.get("/api/reasoning/stats")
        assert response.status_code == 200

    def test_stats_contains_local_percentage(self):
        """Response includes local_percentage field."""
        client = TestClient(app)
        response = client.get("/api/reasoning/stats")
        data = response.json()
        assert "local_percentage" in data

    def test_stats_contains_cost_saved(self):
        """Response includes cost_saved_percentage field."""
        client = TestClient(app)
        response = client.get("/api/reasoning/stats")
        data = response.json()
        assert "cost_saved_percentage" in data


# ---------------------------------------------------------------------------
# API route tests — GET /api/reasoning/logs
# ---------------------------------------------------------------------------

class TestReasoningLogsAPI:
    """Tests for GET /api/reasoning/logs."""

    def test_logs_endpoint_returns_200(self):
        """GET /api/reasoning/logs returns HTTP 200."""
        client = TestClient(app)
        response = client.get("/api/reasoning/logs")
        assert response.status_code == 200

    def test_logs_response_contains_entries_list(self):
        """Response contains a list of log entries."""
        client = TestClient(app)
        response = client.get("/api/reasoning/logs")
        data = response.json()
        assert "entries" in data
        assert isinstance(data["entries"], list)


# ---------------------------------------------------------------------------
# API route tests — GET /api/reasoning/routing-insights
# ---------------------------------------------------------------------------

class TestRoutingInsightsAPI:
    """Tests for GET /api/reasoning/routing-insights."""

    def test_insights_endpoint_returns_200(self):
        """GET /api/reasoning/routing-insights returns HTTP 200."""
        client = TestClient(app)
        response = client.get("/api/reasoning/routing-insights")
        assert response.status_code == 200

    def test_insights_contains_recommendations(self):
        """Response includes recommendations list."""
        client = TestClient(app)
        response = client.get("/api/reasoning/routing-insights")
        data = response.json()
        assert "recommendations" in data
