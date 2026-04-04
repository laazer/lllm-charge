"""Tests for the shared LLM HTTP client."""

from __future__ import annotations

import json
from unittest.mock import patch, MagicMock

import pytest

from blender_pipeline.core.config import LLMConfig
import blender_pipeline.llm_integration._llm_client as client_mod


# ── _build_payload ─────────────────────────────────────────────────


class TestBuildPayload:
    """Tests for _build_payload auto-detecting Ollama vs OpenAI format."""

    def test_ollama_format_when_endpoint_contains_api_generate(self) -> None:
        config = LLMConfig(
            endpoint_url="http://localhost:11434/api/generate",
            model_name="llama3",
            temperature=0.5,
            max_tokens=1024,
        )
        payload = client_mod._build_payload(config, "system msg", "user msg")

        assert payload["model"] == "llama3"
        assert payload["system"] == "system msg"
        assert payload["prompt"] == "user msg"
        assert payload["stream"] is False
        assert payload["options"]["temperature"] == 0.5
        assert payload["options"]["num_predict"] == 1024
        # Must NOT contain OpenAI-style keys
        assert "messages" not in payload
        assert "max_tokens" not in payload

    def test_openai_format_when_endpoint_is_generic(self) -> None:
        config = LLMConfig(
            endpoint_url="https://api.openai.com/v1/chat/completions",
            model_name="gpt-4",
            temperature=0.9,
            max_tokens=2048,
        )
        payload = client_mod._build_payload(config, "sys", "usr")

        assert payload["model"] == "gpt-4"
        assert payload["temperature"] == 0.9
        assert payload["max_tokens"] == 2048
        assert len(payload["messages"]) == 2
        assert payload["messages"][0] == {"role": "system", "content": "sys"}
        assert payload["messages"][1] == {"role": "user", "content": "usr"}
        # Must NOT contain Ollama-style keys
        assert "prompt" not in payload
        assert "options" not in payload

    def test_openai_format_for_lm_studio_endpoint(self) -> None:
        config = LLMConfig(
            endpoint_url="http://localhost:1234/v1/chat/completions",
            model_name="local-model",
        )
        payload = client_mod._build_payload(config, "s", "u")

        assert "messages" in payload
        assert "prompt" not in payload


# ── _build_headers ─────────────────────────────────────────────────


class TestBuildHeaders:
    """Tests for _build_headers with and without API key."""

    def test_headers_without_api_key(self) -> None:
        config = LLMConfig(api_key=None)
        headers = client_mod._build_headers(config)

        assert headers == {"Content-Type": "application/json"}
        assert "Authorization" not in headers

    def test_headers_with_api_key(self) -> None:
        config = LLMConfig(api_key="sk-test-key-123")
        headers = client_mod._build_headers(config)

        assert headers["Content-Type"] == "application/json"
        assert headers["Authorization"] == "Bearer sk-test-key-123"

    def test_headers_with_empty_string_api_key_omits_auth(self) -> None:
        config = LLMConfig(api_key="")
        headers = client_mod._build_headers(config)

        # Empty string is falsy so Authorization should be absent
        assert "Authorization" not in headers


# ── _extract_response_text ─────────────────────────────────────────


class TestExtractResponseText:
    """Tests for _extract_response_text handling various API response shapes."""

    def test_ollama_format_with_response_key(self) -> None:
        data = {"response": "Hello from Ollama"}
        assert client_mod._extract_response_text(data) == "Hello from Ollama"

    def test_openai_format_with_choices_and_message(self) -> None:
        data = {
            "choices": [
                {"message": {"role": "assistant", "content": "Hello from OpenAI"}}
            ]
        }
        assert client_mod._extract_response_text(data) == "Hello from OpenAI"

    def test_openai_format_with_choices_and_text(self) -> None:
        data = {"choices": [{"text": "completion text"}]}
        assert client_mod._extract_response_text(data) == "completion text"

    def test_openai_format_with_message_missing_content(self) -> None:
        data = {"choices": [{"message": {"role": "assistant"}}]}
        assert client_mod._extract_response_text(data) == ""

    def test_plain_content_key(self) -> None:
        data = {"content": "plain content response"}
        assert client_mod._extract_response_text(data) == "plain content response"

    def test_fallback_to_json_dump(self) -> None:
        data = {"unexpected_key": "some value", "other": 42}
        result = client_mod._extract_response_text(data)
        parsed = json.loads(result)
        assert parsed == data

    def test_empty_choices_falls_through_to_content(self) -> None:
        data = {"choices": [], "content": "fallback"}
        assert client_mod._extract_response_text(data) == "fallback"


# ── call_llm ───────────────────────────────────────────────────────


class TestCallLlm:
    """Tests for call_llm dispatching to requests or httpx."""

    def _make_ollama_config(self) -> LLMConfig:
        return LLMConfig(
            endpoint_url="http://localhost:11434/api/generate",
            model_name="llama3",
            timeout_seconds=30,
        )

    def _make_openai_config(self) -> LLMConfig:
        return LLMConfig(
            endpoint_url="https://api.openai.com/v1/chat/completions",
            model_name="gpt-4",
            api_key="sk-test",
            timeout_seconds=60,
        )

    def test_call_llm_with_requests_ollama(self) -> None:
        config = self._make_ollama_config()
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "ollama reply"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(client_mod, "HAS_REQUESTS", True), \
             patch.object(client_mod, "requests") as mock_requests:
            mock_requests.post.return_value = mock_response
            result = client_mod.call_llm(config, "system", "user prompt")

        assert result == "ollama reply"
        mock_requests.post.assert_called_once()
        call_args = mock_requests.post.call_args
        assert call_args[0][0] == config.endpoint_url
        assert call_args[1]["timeout"] == 30
        payload = call_args[1]["json"]
        assert payload["model"] == "llama3"
        assert payload["prompt"] == "user prompt"

    def test_call_llm_with_requests_openai(self) -> None:
        config = self._make_openai_config()
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "gpt reply"}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(client_mod, "HAS_REQUESTS", True), \
             patch.object(client_mod, "requests") as mock_requests:
            mock_requests.post.return_value = mock_response
            result = client_mod.call_llm(config, "sys", "usr")

        assert result == "gpt reply"
        call_args = mock_requests.post.call_args
        headers = call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer sk-test"

    def test_call_llm_raises_for_status(self) -> None:
        config = self._make_ollama_config()
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("HTTP 500")

        with patch.object(client_mod, "HAS_REQUESTS", True), \
             patch.object(client_mod, "requests") as mock_requests:
            mock_requests.post.return_value = mock_response
            with pytest.raises(Exception, match="HTTP 500"):
                client_mod.call_llm(config, "sys", "usr")

    def test_call_llm_with_httpx_when_requests_unavailable(self) -> None:
        config = self._make_ollama_config()
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "httpx reply"}
        mock_response.raise_for_status = MagicMock()

        mock_httpx_client = MagicMock()
        mock_httpx_client.post.return_value = mock_response
        mock_httpx_client.__enter__ = MagicMock(return_value=mock_httpx_client)
        mock_httpx_client.__exit__ = MagicMock(return_value=False)

        mock_httpx = MagicMock()
        mock_httpx.Client.return_value = mock_httpx_client

        with patch.object(client_mod, "HAS_REQUESTS", False), \
             patch.object(client_mod, "HAS_HTTPX", True), \
             patch.object(client_mod, "httpx", mock_httpx):
            result = client_mod.call_llm(config, "system", "user")

        assert result == "httpx reply"
        mock_httpx.Client.assert_called_once_with(timeout=30)
        mock_httpx_client.post.assert_called_once()

    def test_call_llm_raises_runtime_error_when_no_http_library(self) -> None:
        config = self._make_ollama_config()

        with patch.object(client_mod, "HAS_REQUESTS", False), \
             patch.object(client_mod, "HAS_HTTPX", False):
            with pytest.raises(RuntimeError, match="Neither 'requests' nor 'httpx'"):
                client_mod.call_llm(config, "sys", "usr")

    def test_call_llm_prefers_requests_over_httpx(self) -> None:
        """When both libraries are available, requests should be used."""
        config = self._make_ollama_config()
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "from requests"}
        mock_response.raise_for_status = MagicMock()

        mock_httpx = MagicMock()

        with patch.object(client_mod, "HAS_REQUESTS", True), \
             patch.object(client_mod, "HAS_HTTPX", True), \
             patch.object(client_mod, "requests") as mock_requests, \
             patch.object(client_mod, "httpx", mock_httpx):
            mock_requests.post.return_value = mock_response
            result = client_mod.call_llm(config, "sys", "usr")

        assert result == "from requests"
        mock_requests.post.assert_called_once()
        mock_httpx.Client.assert_not_called()
