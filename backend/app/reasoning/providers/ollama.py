"""Ollama provider — local inference via HTTP API."""
from typing import Any, Dict

import httpx

from app.reasoning.providers.base import BaseProvider

_DEFAULT_ENDPOINT = "http://localhost:11434"
_DEFAULT_MODEL = "llama2"
_REQUEST_TIMEOUT = 30.0


class OllamaProvider(BaseProvider):
    """HTTP client for Ollama `/api/generate` and `/api/chat` endpoints."""

    name: str = "ollama"
    is_local: bool = True

    def __init__(
        self,
        endpoint: str = _DEFAULT_ENDPOINT,
        model: str = _DEFAULT_MODEL,
    ) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._model = model

    async def complete(self, prompt: str, **kwargs: Any) -> Dict[str, Any]:
        """Send a generate request to Ollama and return the completion."""
        payload = {"model": self._model, "prompt": prompt, "stream": False}
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            response = await client.post(f"{self._endpoint}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            return {
                "text": data.get("response", ""),
                "provider": self.name,
                "model": self._model,
            }

    async def health_check(self) -> bool:
        """Return True when Ollama responds with HTTP 200 on /api/tags."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._endpoint}/api/tags")
                return response.status_code == 200
        except Exception:
            return False
