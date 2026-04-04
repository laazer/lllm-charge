"""Shared LLM HTTP client used by all llm_integration modules."""

from __future__ import annotations

import json
import logging
from typing import Optional

from blender_pipeline.core.config import LLMConfig

logger = logging.getLogger(__name__)

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    requests = None  # type: ignore[assignment]
    HAS_REQUESTS = False

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    httpx = None  # type: ignore[assignment]
    HAS_HTTPX = False


def call_llm(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
) -> str:
    """Send a prompt to the configured LLM endpoint and return the response text."""
    payload = _build_payload(config, system_prompt, user_prompt)
    headers = _build_headers(config)
    url = config.endpoint_url

    if HAS_REQUESTS:
        response = requests.post(
            url, json=payload, headers=headers, timeout=config.timeout_seconds
        )
        response.raise_for_status()
        return _extract_response_text(response.json())

    if HAS_HTTPX:
        with httpx.Client(timeout=config.timeout_seconds) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return _extract_response_text(response.json())

    raise RuntimeError(
        "Neither 'requests' nor 'httpx' is installed. Install one: pip install requests"
    )


def _build_payload(config: LLMConfig, system_prompt: str, user_prompt: str) -> dict:
    """Build the request payload, auto-detecting API format (OpenAI-compatible vs Ollama)."""
    if "/api/generate" in config.endpoint_url:
        return {
            "model": config.model_name,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
            "options": {"temperature": config.temperature, "num_predict": config.max_tokens},
        }
    return {
        "model": config.model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }


def _build_headers(config: LLMConfig) -> dict:
    """Build HTTP headers, including auth if an API key is set."""
    headers = {"Content-Type": "application/json"}
    if config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    return headers


def _extract_response_text(response_data: dict) -> str:
    """Extract the generated text from various API response formats."""
    if "response" in response_data:
        return response_data["response"]
    if "choices" in response_data and response_data["choices"]:
        choice = response_data["choices"][0]
        if "message" in choice:
            return choice["message"].get("content", "")
        return choice.get("text", "")
    if "content" in response_data:
        return response_data["content"]
    logger.warning("Could not extract text from LLM response: %s", response_data)
    return json.dumps(response_data)
