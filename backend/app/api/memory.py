"""
API routes for the memory note and checkpoint system.

Notes are tagged text fragments; checkpoints are named context snapshots.
Both are stored in SQLite and returned in reverse-chronological order.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.database.models.memory import MemoryCheckpoint, MemoryNote

router = APIRouter(prefix="/api/memory", tags=["memory"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class NoteCreate(BaseModel):
    title: str
    content: Optional[str] = ""
    tags: Optional[List[str]] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    tags: List[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class CheckpointCreate(BaseModel):
    label: str
    context_snapshot: Optional[str] = "{}"


class CheckpointResponse(BaseModel):
    id: str
    label: str
    context_snapshot: str
    created_at: Optional[datetime]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _note_to_response(note: MemoryNote) -> NoteResponse:
    tags = [t.strip() for t in (note.tags or "").split(",") if t.strip()]
    return NoteResponse(
        id=note.id,
        title=note.title,
        content=note.content or "",
        tags=tags,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def _checkpoint_to_response(cp: MemoryCheckpoint) -> CheckpointResponse:
    return CheckpointResponse(
        id=cp.id,
        label=cp.label,
        context_snapshot=cp.context_snapshot or "{}",
        created_at=cp.created_at,
    )


# ---------------------------------------------------------------------------
# Notes routes
# ---------------------------------------------------------------------------


@router.get("/notes")
def list_notes(
    db: Session = Depends(get_db),
    tag: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    tag_filter = tag or tags
    query = db.query(MemoryNote)
    if tag_filter:
        query = query.filter(MemoryNote.tags.contains(tag_filter))
    if search:
        query = query.filter(
            MemoryNote.title.ilike(f"%{search}%") | MemoryNote.content.ilike(f"%{search}%")
        )
    notes = query.order_by(MemoryNote.created_at.desc()).all()
    return {"notes": [_note_to_response(n) for n in notes], "total": len(notes)}


@router.post("/notes", status_code=201)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    note = MemoryNote(
        id=str(uuid.uuid4()),
        title=payload.title,
        content=payload.content or "",
        tags=",".join(payload.tags) if payload.tags else "",
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_response(note)


# ---------------------------------------------------------------------------
# Checkpoints routes
# ---------------------------------------------------------------------------


@router.get("/checkpoints")
def list_checkpoints(db: Session = Depends(get_db)):
    checkpoints = (
        db.query(MemoryCheckpoint)
        .order_by(MemoryCheckpoint.created_at.desc())
        .all()
    )
    return {"checkpoints": [_checkpoint_to_response(c) for c in checkpoints], "total": len(checkpoints)}


@router.post("/checkpoints", status_code=201)
def create_checkpoint(payload: CheckpointCreate, db: Session = Depends(get_db)):
    checkpoint = MemoryCheckpoint(
        id=str(uuid.uuid4()),
        label=payload.label,
        context_snapshot=payload.context_snapshot or "{}",
    )
    db.add(checkpoint)
    db.commit()
    db.refresh(checkpoint)
    return _checkpoint_to_response(checkpoint)
