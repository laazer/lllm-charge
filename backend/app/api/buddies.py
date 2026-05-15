"""
API routes for Buddy chat agents.

Buddies are persistent AI agents with a conversation history.  Each chat
turn is stored in the database and the assembled history is passed to the
HybridRouter for context-aware responses.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.database.models.buddies import Buddy, BuddyMessage

router = APIRouter(prefix="/api/buddies", tags=["buddies"])

_CONTEXT_WINDOW = 20  # last N messages sent to the LLM


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class BuddyCreate(BaseModel):
    name: str
    role: Optional[str] = "assistant"
    persona: Optional[str] = ""
    model: Optional[str] = ""


class BuddyResponse(BaseModel):
    id: str
    name: str
    role: str
    persona: str
    model: str
    message_count: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    prefer_local: Optional[bool] = True


class MessageResponse(BaseModel):
    id: str
    buddy_id: str
    role: str
    content: str
    timestamp: datetime


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _buddy_to_response(buddy: Buddy) -> BuddyResponse:
    return BuddyResponse(
        id=buddy.id,
        name=buddy.name,
        role=buddy.role or "assistant",
        persona=buddy.persona or "",
        model=buddy.model or "",
        message_count=buddy.message_count or 0,
        created_at=buddy.created_at,
        updated_at=buddy.updated_at,
    )


def _message_to_response(msg: BuddyMessage) -> MessageResponse:
    return MessageResponse(
        id=msg.id,
        buddy_id=msg.buddy_id,
        role=msg.role,
        content=msg.content,
        timestamp=msg.timestamp or msg.created_at,
    )


def _load_context_messages(buddy_id: str, db: Session) -> List[Dict[str, str]]:
    """Return the last N messages formatted for the LLM."""
    messages = (
        db.query(BuddyMessage)
        .filter(BuddyMessage.buddy_id == buddy_id)
        .order_by(BuddyMessage.timestamp.desc())
        .limit(_CONTEXT_WINDOW)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(messages)]


async def _call_hybrid_router(system_prompt: str, messages: List[Dict[str, str]], prefer_local: bool) -> Dict[str, Any]:
    """Assemble a prompt and call HybridRouter.complete()."""
    from app.reasoning.hybrid_router import HybridRouter
    router_instance = HybridRouter()
    assembled = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
    full_prompt = f"System: {system_prompt}\n\n{assembled}" if system_prompt else assembled
    return await router_instance.complete(full_prompt, prefer_local=prefer_local)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("")
def list_buddies(db: Session = Depends(get_db)):
    buddies = db.query(Buddy).order_by(Buddy.created_at.desc()).all()
    return {"buddies": [_buddy_to_response(b) for b in buddies], "total": len(buddies)}


@router.post("", status_code=201)
def create_buddy(payload: BuddyCreate, db: Session = Depends(get_db)):
    buddy = Buddy(
        id=str(uuid.uuid4()),
        name=payload.name,
        role=payload.role or "assistant",
        persona=payload.persona or "",
        model=payload.model or "",
        message_count=0,
    )
    db.add(buddy)
    db.commit()
    db.refresh(buddy)
    return _buddy_to_response(buddy)


@router.get("/{buddy_id}")
def get_buddy(buddy_id: str, db: Session = Depends(get_db)):
    buddy = db.query(Buddy).filter(Buddy.id == buddy_id).first()
    if not buddy:
        raise HTTPException(status_code=404, detail="Buddy not found")
    return _buddy_to_response(buddy)


@router.delete("/{buddy_id}", status_code=204)
def delete_buddy(buddy_id: str, db: Session = Depends(get_db)):
    buddy = db.query(Buddy).filter(Buddy.id == buddy_id).first()
    if not buddy:
        raise HTTPException(status_code=404, detail="Buddy not found")
    db.query(BuddyMessage).filter(BuddyMessage.buddy_id == buddy_id).delete()
    db.delete(buddy)
    db.commit()


@router.post("/{buddy_id}/chat")
def chat_with_buddy(buddy_id: str, payload: ChatRequest, db: Session = Depends(get_db)):
    """Send a user message to a buddy and receive an LLM-generated reply."""
    buddy = db.query(Buddy).filter(Buddy.id == buddy_id).first()
    if not buddy:
        raise HTTPException(status_code=404, detail="Buddy not found")

    # Persist user message
    user_msg = BuddyMessage(
        id=str(uuid.uuid4()),
        buddy_id=buddy_id,
        role="user",
        content=payload.message,
        timestamp=datetime.utcnow(),
    )
    db.add(user_msg)
    db.commit()

    # Build context and call HybridRouter
    context = _load_context_messages(buddy_id, db)
    start_ms = time.monotonic()
    try:
        result = asyncio.get_event_loop().run_until_complete(
            _call_hybrid_router(buddy.persona or "", context, payload.prefer_local or True)
        )
        reply_text = result.get("text", "")
        provider = result.get("provider", "unknown")
        latency_ms = result.get("latency_ms", round((time.monotonic() - start_ms) * 1000))
    except Exception:
        reply_text = "I'm not able to respond right now."
        provider = "none"
        latency_ms = round((time.monotonic() - start_ms) * 1000)

    # Persist assistant reply
    assistant_msg = BuddyMessage(
        id=str(uuid.uuid4()),
        buddy_id=buddy_id,
        role="assistant",
        content=reply_text,
        timestamp=datetime.utcnow(),
    )
    db.add(assistant_msg)
    buddy.message_count = (buddy.message_count or 0) + 2
    db.commit()

    return {"message": reply_text, "provider": provider, "latency_ms": latency_ms}


@router.get("/{buddy_id}/messages")
def get_buddy_messages(
    buddy_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    buddy = db.query(Buddy).filter(Buddy.id == buddy_id).first()
    if not buddy:
        raise HTTPException(status_code=404, detail="Buddy not found")

    query = db.query(BuddyMessage).filter(BuddyMessage.buddy_id == buddy_id)
    total = query.count()
    messages = (
        query.order_by(BuddyMessage.timestamp.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "messages": [_message_to_response(m) for m in messages],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
