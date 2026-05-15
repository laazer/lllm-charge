"""Circuit breaker for provider resilience.

Opens after `failure_threshold` consecutive failures; allows a single trial
request after `reset_timeout_seconds` elapses (half-open state); closes again
on a successful trial.
"""
import time
from enum import Enum, auto


class CircuitState(Enum):
    CLOSED = auto()
    OPEN = auto()
    HALF_OPEN = auto()


class CircuitBreaker:
    """Three-state circuit breaker: closed → open → half-open → closed."""

    def __init__(self, failure_threshold: int = 3, reset_timeout_seconds: float = 30.0) -> None:
        self._failure_threshold = failure_threshold
        self._reset_timeout_seconds = reset_timeout_seconds
        self._consecutive_failures = 0
        self._state = CircuitState.CLOSED
        self._opened_at: float = 0.0

    # ── State queries ────────────────────────────────────────────────────────

    @property
    def is_closed(self) -> bool:
        return self._state == CircuitState.CLOSED

    def allow_request(self) -> bool:
        """Return True when the breaker allows a request to proceed."""
        if self._state == CircuitState.CLOSED:
            return True
        if self._state == CircuitState.OPEN:
            if time.time() - self._opened_at >= self._reset_timeout_seconds:
                self._state = CircuitState.HALF_OPEN
                return True
            return False
        # HALF_OPEN — allow the single trial
        return True

    # ── State transitions ────────────────────────────────────────────────────

    def record_success(self) -> None:
        """Reset the breaker to closed state after a successful call."""
        self._consecutive_failures = 0
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        """Record a failure; open the breaker once the threshold is exceeded."""
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._failure_threshold:
            self._state = CircuitState.OPEN
            self._opened_at = time.time()
