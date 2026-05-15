"""Anthropic (Claude) provider — cloud inference via Messages API."""
import os
from typing import Any, Dict

import httpx

from app.reasoning.providers.base import BaseProvider

_ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
_DEFAULT_MODEL = "claude-3-haiku-20240307"
_REQUEST_TIMEOUT = 60.0


class AnthropicProvider(BaseProvider):
    """HTTP client for the Anthropic Messages API (no SDK dependency)."""

    name: str = "anthropic"
    is_local: bool = False

    def __init__(
        self,
        api_key: str | None = None,
        model: str = _DEFAULT_MODEL,
    ) -> None:
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self._model = model

    def _build_headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self._api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

    async def complete(self, prompt: str, **kwargs: Any) -> Dict[str, Any]:
        """Send a message to the Anthropic Messages API."""
        payload = {
            "model": self._model,
            "max_tokens": kwargs.get("max_tokens", 1024),
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            response = await client.post(
                _ANTHROPIC_API_URL,
                headers=self._build_headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            text = data["content"][0]["text"] if data.get("content") else ""
            return {
                "text": text,
                "provider": self.name,
                "model": self._model,
            }

    async def health_check(self) -> bool:
        """Return True when we can reach api.anthropic.com (no key needed)."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get("https://api.anthropic.com/v1/models")
                # 401 means the API is reachable (key invalid but server responds)
                return response.status_code in (200, 401)
        except Exception:
            return False
