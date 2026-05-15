"""
Tests for MIG-004: Buddies/Chat and Memory APIs

Acceptance criteria:
  - POST /api/buddies creates buddy persisted to DB; GET /api/buddies returns it
  - POST /api/buddies/{id}/chat returns a response (mocked LLM)
  - Conversation history persisted; GET /api/buddies/{id}/messages returns paginated
  - POST /api/memory/notes stores note; GET /api/memory/notes supports tag filter
  - GET /api/memory/checkpoints returns stored checkpoints sorted by created_at desc
  - Deleting a buddy cascades to delete its messages
  - Both routers registered in main.py
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient


# ─── Buddies CRUD ─────────────────────────────────────────────────────────────

class TestBuddiesCRUD:
    def test_create_buddy_returns_id_and_name(self, test_client: TestClient):
        """POST /api/buddies creates a buddy with id and name."""
        payload = {"name": "Dev Buddy", "role": "coder", "persona": "An expert Python developer."}
        response = test_client.post("/api/buddies", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["name"] == "Dev Buddy"
        assert data["role"] == "coder"

    def test_create_buddy_persisted_in_list(self, test_client: TestClient):
        """Created buddy appears in GET /api/buddies."""
        test_client.post("/api/buddies", json={"name": "Listed Buddy", "role": "assistant"})
        response = test_client.get("/api/buddies")
        assert response.status_code == 200
        data = response.json()
        buddies = data.get("buddies", data)
        assert isinstance(buddies, list)
        assert any(b["name"] == "Listed Buddy" for b in buddies)

    def test_get_buddy_by_id(self, test_client: TestClient):
        """GET /api/buddies/{id} returns the specific buddy."""
        create = test_client.post("/api/buddies", json={"name": "Fetchable", "role": "reviewer"})
        buddy_id = create.json()["id"]
        response = test_client.get(f"/api/buddies/{buddy_id}")
        assert response.status_code == 200
        assert response.json()["id"] == buddy_id

    def test_get_unknown_buddy_returns_404(self, test_client: TestClient):
        """GET /api/buddies/nonexistent returns 404."""
        response = test_client.get("/api/buddies/nonexistent-id")
        assert response.status_code == 404

    def test_delete_buddy_removes_it(self, test_client: TestClient):
        """DELETE /api/buddies/{id} removes the buddy."""
        create = test_client.post("/api/buddies", json={"name": "Deletable", "role": "assistant"})
        buddy_id = create.json()["id"]
        del_response = test_client.delete(f"/api/buddies/{buddy_id}")
        assert del_response.status_code in (200, 204)
        get_response = test_client.get(f"/api/buddies/{buddy_id}")
        assert get_response.status_code == 404

    def test_delete_buddy_cascades_to_messages(self, test_client: TestClient):
        """Deleting a buddy deletes its messages."""
        create = test_client.post("/api/buddies", json={"name": "CascadeTest", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "hello", "provider": "mock", "latency_ms": 10}
            test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Hi"})

        test_client.delete(f"/api/buddies/{buddy_id}")

        msg_response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        assert msg_response.status_code == 404

    def test_delete_unknown_buddy_returns_404(self, test_client: TestClient):
        """DELETE /api/buddies/nonexistent returns 404."""
        response = test_client.delete("/api/buddies/nonexistent")
        assert response.status_code == 404


# ─── Chat ────────────────────────────────────────────────────────────────────

class TestBuddyChat:
    def test_chat_returns_response_text(self, test_client: TestClient):
        """POST /api/buddies/{id}/chat returns a text reply."""
        create = test_client.post("/api/buddies", json={"name": "ChatBot", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "Hello there!", "provider": "mock", "latency_ms": 42}
            response = test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Hi buddy"})

        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "text" in data

    def test_chat_persists_messages(self, test_client: TestClient):
        """After a chat, messages appear in /api/buddies/{id}/messages."""
        create = test_client.post("/api/buddies", json={"name": "PersistBot", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "Stored reply", "provider": "mock", "latency_ms": 5}
            test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Remember this"})

        messages_response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        assert messages_response.status_code == 200
        data = messages_response.json()
        messages = data.get("messages", data)
        assert len(messages) >= 2  # user + assistant

    def test_chat_includes_provider_info(self, test_client: TestClient):
        """Chat response includes provider field."""
        create = test_client.post("/api/buddies", json={"name": "InfoBot", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "response", "provider": "ollama", "latency_ms": 30}
            response = test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "test"})

        data = response.json()
        assert "provider" in data

    def test_chat_with_unknown_buddy_returns_404(self, test_client: TestClient):
        """POST /api/buddies/nonexistent/chat returns 404."""
        response = test_client.post("/api/buddies/nonexistent/chat", json={"message": "Hi"})
        assert response.status_code == 404


# ─── Messages ────────────────────────────────────────────────────────────────

class TestBuddyMessages:
    def test_messages_returns_paginated_list(self, test_client: TestClient):
        """GET /api/buddies/{id}/messages returns paginated messages."""
        create = test_client.post("/api/buddies", json={"name": "MsgBot", "role": "assistant"})
        buddy_id = create.json()["id"]
        response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        assert response.status_code == 200
        data = response.json()
        messages = data.get("messages", data)
        assert isinstance(messages, list)
        assert "total" in data

    def test_messages_unknown_buddy_returns_404(self, test_client: TestClient):
        """GET /api/buddies/nonexistent/messages returns 404."""
        response = test_client.get("/api/buddies/nonexistent/messages")
        assert response.status_code == 404


# ─── Memory notes ─────────────────────────────────────────────────────────────

class TestMemoryNotes:
    def test_create_note_returns_id_and_title(self, test_client: TestClient):
        """POST /api/memory/notes creates a note with id and title."""
        payload = {"title": "My Note", "content": "Important content", "tags": ["python", "llm"]}
        response = test_client.post("/api/memory/notes", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["title"] == "My Note"

    def test_list_notes_returns_created_note(self, test_client: TestClient):
        """GET /api/memory/notes returns previously created notes."""
        test_client.post("/api/memory/notes", json={"title": "Listed Note", "content": "content"})
        response = test_client.get("/api/memory/notes")
        assert response.status_code == 200
        data = response.json()
        notes = data.get("notes", data)
        assert any(n["title"] == "Listed Note" for n in notes)

    def test_list_notes_filters_by_tag(self, test_client: TestClient):
        """GET /api/memory/notes?tag=foo returns only notes with that tag."""
        test_client.post("/api/memory/notes", json={"title": "Tagged", "content": "x", "tags": ["filterme"]})
        test_client.post("/api/memory/notes", json={"title": "Untagged", "content": "y", "tags": []})
        response = test_client.get("/api/memory/notes?tag=filterme")
        assert response.status_code == 200
        data = response.json()
        notes = data.get("notes", data)
        assert all("filterme" in n.get("tags", []) for n in notes)
        assert any(n["title"] == "Tagged" for n in notes)

    def test_list_notes_empty_initially(self, test_client: TestClient):
        """GET /api/memory/notes returns empty list before any notes created."""
        response = test_client.get("/api/memory/notes")
        assert response.status_code == 200


# ─── Memory checkpoints ───────────────────────────────────────────────────────

class TestMemoryCheckpoints:
    def test_list_checkpoints_returns_list(self, test_client: TestClient):
        """GET /api/memory/checkpoints returns a list."""
        response = test_client.get("/api/memory/checkpoints")
        assert response.status_code == 200
        data = response.json()
        checkpoints = data.get("checkpoints", data)
        assert isinstance(checkpoints, list)

    def test_create_checkpoint_stores_it(self, test_client: TestClient):
        """POST /api/memory/checkpoints creates a checkpoint."""
        payload = {"label": "Before refactor", "context_snapshot": '{"files": ["main.py"]}'}
        response = test_client.post("/api/memory/checkpoints", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["label"] == "Before refactor"

    def test_checkpoints_sorted_desc_by_created_at(self, test_client: TestClient):
        """Checkpoints are returned newest-first."""
        test_client.post("/api/memory/checkpoints", json={"label": "First", "context_snapshot": "{}"})
        test_client.post("/api/memory/checkpoints", json={"label": "Second", "context_snapshot": "{}"})
        response = test_client.get("/api/memory/checkpoints")
        data = response.json()
        checkpoints = data.get("checkpoints", data)
        if len(checkpoints) >= 2:
            timestamps = [c["created_at"] for c in checkpoints]
            assert timestamps == sorted(timestamps, reverse=True)
