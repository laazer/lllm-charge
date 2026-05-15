"""Abstract base class for all LLM providers."""
from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseProvider(ABC):
    """Common interface every provider must implement."""

    name: str = "base"
    is_local: bool = False

    @abstractmethod
    async def complete(self, prompt: str, **kwargs: Any) -> Dict[str, Any]:
        """Return a completion dict with at least `text`, `provider`, and `model`."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True when the provider is reachable and ready."""
