"""CodeGraph API routes — status, search, switch, sync, and Godot integration."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.codegraph.godot_indexer import GodotProjectIndexer

# Default project directory — patched in tests via CODEGRAPH_PROJECT_DIR
CODEGRAPH_PROJECT_DIR = str(Path(__file__).parent.parent.parent.parent.resolve())

router = APIRouter(prefix="/api/codegraph", tags=["codegraph"])


# ── request/response models ──────────────────────────────────────────────────

class CodeGraphSearchRequest(BaseModel):
    query: str
    type: Optional[str] = None
    limit: Optional[int] = 20


class CodeGraphSwitchRequest(BaseModel):
    project_path: Optional[str] = None
    project_id: Optional[str] = None
    projectId: Optional[str] = None  # Handle camelCase from frontend


class GodotIndexRequest(BaseModel):
    project_path: str


class GodotSearchRequest(BaseModel):
    query: str
    symbol_type: Optional[str] = None
    project_path: Optional[str] = None
    limit: Optional[int] = 20


# ── helpers ──────────────────────────────────────────────────────────────────

def _has_index(project_dir: str) -> bool:
    return (Path(project_dir) / ".codegraph").is_dir()


def _has_godot_index(project_dir: str) -> bool:
    return (Path(project_dir) / ".codegraph-godot" / "index.json").is_file()


def _run_search(query: str, project_dir: str, limit: int) -> List[Dict[str, Any]]:
    """Run `codegraph search` and return parsed results, or empty list on error."""
    try:
        result = subprocess.run(
            ["codegraph", "search", query, "--json"],
            capture_output=True,
            text=True,
            cwd=project_dir,
            timeout=10,
        )
        if result.returncode != 0:
            return []
        raw = json.loads(result.stdout)
        items = raw if isinstance(raw, list) else raw.get("results", [])
        return items[:limit]
    except (subprocess.SubprocessError, json.JSONDecodeError, FileNotFoundError):
        return []


def _merge_results(
    cg_results: List[Dict[str, Any]],
    godot_results: List[Dict[str, Any]],
    limit: int,
) -> List[Dict[str, Any]]:
    """Merge and de-duplicate results from both indices on (name, file_path)."""
    seen: set[tuple[str, str]] = set()
    merged: List[Dict[str, Any]] = []

    for item in cg_results + godot_results:
        key = (item.get("name", ""), item.get("file_path", ""))
        if key not in seen:
            seen.add(key)
            merged.append(item)
        if len(merged) >= limit:
            break

    return merged


# ── existing codegraph routes ─────────────────────────────────────────────────

@router.get("/status")
def codegraph_status() -> Dict[str, Any]:
    """Return whether a .codegraph/ index exists for the active project."""
    has_index = _has_index(CODEGRAPH_PROJECT_DIR)
    return {
        "has_index": has_index,
        "project_dir": CODEGRAPH_PROJECT_DIR,
        "status": "ready" if has_index else "no_index",
    }


@router.post("/search")
def codegraph_search(request: CodeGraphSearchRequest) -> Dict[str, Any]:
    """Search the codegraph index, merging Godot results when available."""
    limit = request.limit or 20
    sources: List[str] = []
    cg_results: List[Dict[str, Any]] = []

    if _has_index(CODEGRAPH_PROJECT_DIR):
        cg_results = _run_search(request.query, CODEGRAPH_PROJECT_DIR, limit)
        sources.append("codegraph")

    # Merge Godot results when a Godot index exists
    godot_results: List[Dict[str, Any]] = []
    if _has_godot_index(CODEGRAPH_PROJECT_DIR):
        indexer = GodotProjectIndexer(CODEGRAPH_PROJECT_DIR)
        godot_results = indexer.search(request.query, limit=limit)
        sources.append("godot")

    if not sources:
        return {
            "status": "no_index",
            "results": [],
            "query": request.query,
            "sources": sources,
        }

    results = _merge_results(cg_results, godot_results, limit)
    return {
        "status": "ok",
        "results": results,
        "query": request.query,
        "total": len(results),
        "sources": sources,
    }


@router.post("/switch")
def codegraph_switch(request: CodeGraphSwitchRequest) -> Dict[str, Any]:
    """Switch the active codegraph project directory."""
    global CODEGRAPH_PROJECT_DIR
    from sqlalchemy.orm import Session
    from app.database.database import SessionLocal
    from app.database.models.main import Project

    # Handle both project_path and project_id (projectId from frontend)
    project_path = request.project_path

    if not project_path and (request.project_id or request.projectId):
        # Look up the project path from the database
        project_id = request.project_id or request.projectId
        try:
            db = SessionLocal()
            project = db.query(Project).filter(Project.id == project_id).first()
            db.close()

            if project:
                # Use codegraph_path if set, otherwise try to infer from workspace
                if project.codegraph_path:
                    project_path = project.codegraph_path
                else:
                    # Fallback: assume project is in workspace with name matching project.name
                    # This helps blobert find /Users/jacobbrandt/workspace/blobert
                    workspace_root = Path(CODEGRAPH_PROJECT_DIR).parent.resolve()
                    inferred_path = workspace_root / project.name.lower()
                    if inferred_path.exists():
                        project_path = str(inferred_path)
        except Exception:
            pass  # Fall through to error handling below

    if not project_path:
        return {
            "success": False,
            "status": "error",
            "error": "Either project_path or project_id is required"
        }

    CODEGRAPH_PROJECT_DIR = project_path
    return {
        "success": True,
        "status": "switched",
        "projectRoot": CODEGRAPH_PROJECT_DIR,
        "project_dir": CODEGRAPH_PROJECT_DIR,
        "has_index": _has_index(CODEGRAPH_PROJECT_DIR),
        "filesIndexed": 0
    }


@router.post("/sync")
def codegraph_sync() -> Dict[str, Any]:
    """Trigger a background re-index of the current project."""
    try:
        subprocess.Popen(
            ["codegraph", "init", "-i"],
            cwd=CODEGRAPH_PROJECT_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {"status": "indexing", "project_dir": CODEGRAPH_PROJECT_DIR}
    except FileNotFoundError:
        return {"status": "codegraph_not_installed", "project_dir": CODEGRAPH_PROJECT_DIR}


# ── Godot-specific routes ─────────────────────────────────────────────────────

@router.get("/godot/status")
def godot_status() -> Dict[str, Any]:
    """Return the Godot index status for the active project."""
    indexer = GodotProjectIndexer(CODEGRAPH_PROJECT_DIR)
    return indexer.get_status()


@router.post("/godot/index")
def godot_index(request: GodotIndexRequest) -> Dict[str, Any]:
    """Trigger (re-)indexing of a Godot project and return stats."""
    indexer = GodotProjectIndexer(request.project_path)
    result = indexer.index_project()
    return {
        "status": "indexed",
        "project_path": request.project_path,
        "file_count": result.file_count,
        "symbol_count": result.symbol_count,
        "duration_ms": result.duration_ms,
    }


@router.post("/godot/search")
def godot_search(request: GodotSearchRequest) -> Dict[str, Any]:
    """Search GDScript symbols in the Godot index."""
    project_dir = request.project_path or CODEGRAPH_PROJECT_DIR
    indexer = GodotProjectIndexer(project_dir)

    status = indexer.get_status()
    if not status["has_index"]:
        return {
            "status": "no_index",
            "query": request.query,
            "symbol_type": request.symbol_type,
            "results": [],
            "total": 0,
        }

    limit = request.limit or 20
    results = indexer.search(
        request.query,
        symbol_type=request.symbol_type,
        limit=limit,
    )
    return {
        "status": "ok",
        "query": request.query,
        "symbol_type": request.symbol_type,
        "results": results,
        "total": len(results),
    }
