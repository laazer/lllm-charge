"""LiteLLM proxy provider — routes to any LiteLLM-compatible endpoint."""
from typing import Any, Dict

import httpx

from app.reasoning.providers.base import BaseProvider

_DEFAULT_ENDPOINT = "http://localhost:4000"
_DEFAULT_MODEL = "gpt-3.5-turbo"
_REQUEST_TIMEOUT = 30.0


class LiteLLMProvider(BaseProvider):
    """HTTP client for the LiteLLM proxy's OpenAI-compatible /chat/completions."""

    name: str = "litellm"
    is_local: bool = False

    def __init__(
        self,
        endpoint: str = _DEFAULT_ENDPOINT,
        model: str = _DEFAULT_MODEL,
    ) -> None:
        self._endpoint = endpoint.rstrip("/")
        self._model = model

    async def complete(self, prompt: str, **kwargs: Any) -> Dict[str, Any]:
        """Send a chat-completion request to the LiteLLM proxy."""
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{self._endpoint}/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"] if data.get("choices") else ""
            return {
                "text": text,
                "provider": self.name,
                "model": self._model,
            }

    async def health_check(self) -> bool:
        """Return True when the LiteLLM proxy health endpoint responds."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._endpoint}/health")
                return response.status_code == 200
        except Exception:
            return False
