"""Filesystem browse API route with workspace sandboxing."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Workspace root used as sandbox boundary — patched in tests
WORKSPACE_ROOT = str(Path(__file__).parent.parent.parent.parent.resolve())

router = APIRouter(prefix="/api/filesystem", tags=["filesystem"])


class BrowseRequest(BaseModel):
    path: str


def _resolve_safe_path(path: str) -> Path:
    """Resolve *path* and verify it sits inside WORKSPACE_ROOT.

    Raises HTTPException 403 when the resolved path escapes the workspace.
    """
    try:
        resolved = Path(path).resolve()
        workspace = Path(WORKSPACE_ROOT).resolve()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid path: {exc}") from exc

    if not str(resolved).startswith(str(workspace)):
        raise HTTPException(
            status_code=403,
            detail=f"Path '{path}' is outside the allowed workspace",
        )
    return resolved


def _entry_metadata(entry: os.DirEntry) -> Dict[str, Any]:
    """Return a metadata dict for a single directory entry."""
    try:
        stat = entry.stat()
        return {
            "name": entry.name,
            "type": "dir" if entry.is_dir() else "file",
            "size": stat.st_size if entry.is_file() else None,
            "modified": stat.st_mtime,
        }
    except OSError:
        return {"name": entry.name, "type": "unknown", "size": None, "modified": None}


@router.post("/browse")
def browse_directory(request: BrowseRequest) -> Dict[str, Any]:
    """List directory contents with file metadata.

    Returns 403 when *path* is outside the workspace, 404 when it doesn't exist.
    """
    resolved = _resolve_safe_path(request.path)

    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {request.path}")

    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {request.path}")

    entries: List[Dict[str, Any]] = sorted(
        (_entry_metadata(e) for e in os.scandir(resolved)),
        key=lambda e: (e["type"] != "dir", e["name"].lower()),
    )
    return {"path": str(resolved), "entries": entries}
