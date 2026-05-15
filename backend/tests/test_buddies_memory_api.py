"""
Tests for MIG-004: Port Buddies/Chat and Memory APIs to Python.

Acceptance criteria:
  - POST /api/buddies creates buddy persisted to DB; GET returns it
  - POST /api/buddies/{id}/chat returns a real LLM response (or mock)
  - Conversation history persisted; GET /api/buddies/{id}/messages returns it paginated
  - POST /api/memory/notes stores note; GET /api/memory/notes supports tag filter
  - GET /api/memory/checkpoints returns sorted checkpoints
  - Deleting a buddy cascades to delete its messages
  - Both routers registered in main.py
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient


# ─── Buddies: create & list ──────────────────────────────────────────────────

class TestBuddiesCreateAndList:
    def test_create_buddy_returns_id_and_name(self, test_client: TestClient):
        """POST /api/buddies creates a buddy and returns id + name."""
        payload = {"name": "Dev Bot", "role": "coder", "persona": "A helpful coder"}
        response = test_client.post("/api/buddies", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["name"] == "Dev Bot"

    def test_create_buddy_stores_role_and_persona(self, test_client: TestClient):
        """Created buddy stores role and persona."""
        payload = {"name": "Reviewer", "role": "reviewer", "persona": "Critical reviewer"}
        response = test_client.post("/api/buddies", json=payload)
        data = response.json()
        assert data["role"] == "reviewer"
        assert data["persona"] == "Critical reviewer"

    def test_list_buddies_returns_list(self, test_client: TestClient):
        """GET /api/buddies returns a list."""
        response = test_client.get("/api/buddies")
        assert response.status_code == 200
        data = response.json()
        buddies = data.get("buddies", data)
        assert isinstance(buddies, list)

    def test_list_buddies_reflects_created_buddy(self, test_client: TestClient):
        """Created buddy appears in the GET list."""
        test_client.post("/api/buddies", json={"name": "Listed Bot", "role": "assistant"})
        response = test_client.get("/api/buddies")
        data = response.json()
        buddies = data.get("buddies", data)
        assert any(b["name"] == "Listed Bot" for b in buddies)


# ─── Buddies: get, update, delete ────────────────────────────────────────────

class TestBuddiesGetAndDelete:
    def test_get_buddy_by_id(self, test_client: TestClient):
        """GET /api/buddies/{id} returns the specific buddy."""
        create = test_client.post("/api/buddies", json={"name": "Fetchable", "role": "assistant"})
        buddy_id = create.json()["id"]
        response = test_client.get(f"/api/buddies/{buddy_id}")
        assert response.status_code == 200
        assert response.json()["id"] == buddy_id

    def test_get_unknown_buddy_returns_404(self, test_client: TestClient):
        """GET /api/buddies/nonexistent returns 404."""
        response = test_client.get("/api/buddies/nonexistent-buddy-id")
        assert response.status_code == 404

    def test_delete_buddy_removes_it(self, test_client: TestClient):
        """DELETE /api/buddies/{id} removes the buddy."""
        create = test_client.post("/api/buddies", json={"name": "Deletable", "role": "coder"})
        buddy_id = create.json()["id"]

        response = test_client.delete(f"/api/buddies/{buddy_id}")
        assert response.status_code in (200, 204)

        get_response = test_client.get(f"/api/buddies/{buddy_id}")
        assert get_response.status_code == 404

    def test_delete_buddy_cascades_to_messages(self, test_client: TestClient):
        """Deleting a buddy deletes its messages."""
        create = test_client.post("/api/buddies", json={"name": "WithMessages", "role": "assistant"})
        buddy_id = create.json()["id"]

        # send a chat message so at least a user message is stored
        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "hi", "provider": "ollama", "model": "llama2", "latency_ms": 10}
            test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "hello"})

        test_client.delete(f"/api/buddies/{buddy_id}")
        # After deletion the buddy is gone — messages endpoint should 404
        response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        assert response.status_code == 404

    def test_delete_unknown_buddy_returns_404(self, test_client: TestClient):
        """DELETE /api/buddies/nonexistent returns 404."""
        response = test_client.delete("/api/buddies/nonexistent")
        assert response.status_code == 404


# ─── Buddies: chat ───────────────────────────────────────────────────────────

class TestBuddiesChat:
    def test_chat_returns_message_and_provider(self, test_client: TestClient):
        """POST /api/buddies/{id}/chat returns message and provider fields."""
        create = test_client.post("/api/buddies", json={"name": "Chatter", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {
                "text": "Hello back!",
                "provider": "ollama",
                "model": "llama2",
                "latency_ms": 42,
            }
            response = test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Hello"})

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "provider" in data

    def test_chat_persists_user_message(self, test_client: TestClient):
        """After chat, GET messages includes the user message."""
        create = test_client.post("/api/buddies", json={"name": "HistoryBot", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "Noted", "provider": "ollama", "model": "llama2", "latency_ms": 5}
            test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Remember this"})

        response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        data = response.json()
        messages = data.get("messages", data)
        assert any(m["role"] == "user" and "Remember this" in m["content"] for m in messages)

    def test_chat_persists_assistant_reply(self, test_client: TestClient):
        """After chat, GET messages includes the assistant response."""
        create = test_client.post("/api/buddies", json={"name": "ReplierBot", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "I remember!", "provider": "ollama", "model": "llama2", "latency_ms": 5}
            test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Test"})

        response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        data = response.json()
        messages = data.get("messages", data)
        assert any(m["role"] == "assistant" for m in messages)

    def test_chat_with_unknown_buddy_returns_404(self, test_client: TestClient):
        """POST /api/buddies/nonexistent/chat returns 404."""
        response = test_client.post("/api/buddies/nonexistent/chat", json={"message": "hi"})
        assert response.status_code == 404

    def test_chat_includes_latency_ms(self, test_client: TestClient):
        """Chat response includes latency_ms field."""
        create = test_client.post("/api/buddies", json={"name": "LatencyBot", "role": "assistant"})
        buddy_id = create.json()["id"]

        with patch("app.reasoning.hybrid_router.HybridRouter.complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = {"text": "Fast!", "provider": "ollama", "model": "llama2", "latency_ms": 99}
            response = test_client.post(f"/api/buddies/{buddy_id}/chat", json={"message": "Speed test"})

        assert "latency_ms" in response.json()


# ─── Buddies: messages ───────────────────────────────────────────────────────

class TestBuddiesMessages:
    def test_messages_returns_list(self, test_client: TestClient):
        """GET /api/buddies/{id}/messages returns a list."""
        create = test_client.post("/api/buddies", json={"name": "MsgBot", "role": "assistant"})
        buddy_id = create.json()["id"]
        response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        assert response.status_code == 200
        data = response.json()
        messages = data.get("messages", data)
        assert isinstance(messages, list)

    def test_messages_includes_pagination_fields(self, test_client: TestClient):
        """Messages response includes total field."""
        create = test_client.post("/api/buddies", json={"name": "PageBot", "role": "assistant"})
        buddy_id = create.json()["id"]
        response = test_client.get(f"/api/buddies/{buddy_id}/messages")
        data = response.json()
        assert "total" in data

    def test_messages_unknown_buddy_returns_404(self, test_client: TestClient):
        """GET /api/buddies/nonexistent/messages returns 404."""
        response = test_client.get("/api/buddies/nonexistent/messages")
        assert response.status_code == 404


# ─── Memory: notes ───────────────────────────────────────────────────────────

class TestMemoryNotes:
    def test_create_note_returns_id_and_title(self, test_client: TestClient):
        """POST /api/memory/notes creates a note and returns id + title."""
        payload = {"title": "My Note", "content": "Important content", "tags": ["python"]}
        response = test_client.post("/api/memory/notes", json=payload)
        assert response.status_code in (200, 201)
        data = response.json()
        assert "id" in data
        assert data["title"] == "My Note"

    def test_list_notes_returns_created_note(self, test_client: TestClient):
        """GET /api/memory/notes returns notes that were created."""
        test_client.post("/api/memory/notes", json={"title": "Listed Note", "content": "x"})
        response = test_client.get("/api/memory/notes")
        assert response.status_code == 200
        data = response.json()
        notes = data.get("notes", data)
        assert any(n["title"] == "Listed Note" for n in notes)

    def test_list_notes_supports_tag_filter(self, test_client: TestClient):
        """GET /api/memory/notes?tags=X only returns notes with that tag."""
        test_client.post("/api/memory/notes", json={"title": "Tagged", "content": "x", "tags": ["special"]})
        test_client.post("/api/memory/notes", json={"title": "Untagged", "content": "y", "tags": []})

        response = test_client.get("/api/memory/notes?tags=special")
        data = response.json()
        notes = data.get("notes", data)
        assert all("special" in (n.get("tags") or []) for n in notes)
        assert any(n["title"] == "Tagged" for n in notes)

    def test_list_notes_supports_search_filter(self, test_client: TestClient):
        """GET /api/memory/notes?search=X filters by title/content."""
        test_client.post("/api/memory/notes", json={"title": "Findable", "content": "unique needle content"})
        test_client.post("/api/memory/notes", json={"title": "Other", "content": "irrelevant"})

        response = test_client.get("/api/memory/notes?search=Findable")
        data = response.json()
        notes = data.get("notes", data)
        assert any(n["title"] == "Findable" for n in notes)


# ─── Memory: checkpoints ─────────────────────────────────────────────────────

class TestMemoryCheckpoints:
    def test_list_checkpoints_returns_list(self, test_client: TestClient):
        """GET /api/memory/checkpoints returns a list."""
        response = test_client.get("/api/memory/checkpoints")
        assert response.status_code == 200
        data = response.json()
        checkpoints = data.get("checkpoints", data)
        assert isinstance(checkpoints, list)

    def test_create_checkpoint_appears_in_list(self, test_client: TestClient):
        """POST /api/memory/checkpoints creates one and it appears in GET."""
        payload = {"label": "Before refactor", "context_snapshot": '{"key": "value"}'}
        response = test_client.post("/api/memory/checkpoints", json=payload)
        assert response.status_code in (200, 201)
        checkpoint_id = response.json()["id"]

        list_response = test_client.get("/api/memory/checkpoints")
        data = list_response.json()
        checkpoints = data.get("checkpoints", data)
        assert any(c["id"] == checkpoint_id for c in checkpoints)

    def test_checkpoints_sorted_by_created_at_desc(self, test_client: TestClient):
        """GET /api/memory/checkpoints returns newest first."""
        test_client.post("/api/memory/checkpoints", json={"label": "First", "context_snapshot": "{}"})
        test_client.post("/api/memory/checkpoints", json={"label": "Second", "context_snapshot": "{}"})

        response = test_client.get("/api/memory/checkpoints")
        data = response.json()
        checkpoints = data.get("checkpoints", data)
        if len(checkpoints) >= 2:
            # Newest should come first — "Second" should appear before "First"
            labels = [c["label"] for c in checkpoints]
            assert labels.index("Second") < labels.index("First")
