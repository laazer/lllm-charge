"""Assets API routes — list, preview, download, info."""
from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

# Directory where assets are stored — patched in tests
ASSETS_DIR = str(Path(__file__).parent.parent.parent.parent / "data" / "assets")

router = APIRouter(prefix="/api/assets", tags=["assets"])


def _ensure_assets_dir() -> Path:
    assets_path = Path(ASSETS_DIR)
    assets_path.mkdir(parents=True, exist_ok=True)
    return assets_path


def _asset_path(asset_id: str) -> Path:
    """Resolve asset file path; raises 403 on traversal, 404 if missing."""
    assets_path = _ensure_assets_dir()
    resolved = (assets_path / asset_id).resolve()
    if not str(resolved).startswith(str(assets_path.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"Asset not found: {asset_id}")
    return resolved


def _file_metadata(filepath: Path) -> Dict[str, Any]:
    stat = filepath.stat()
    mime, _ = mimetypes.guess_type(filepath.name)
    ext = filepath.suffix.lstrip(".").lower()
    return {
        "name": filepath.name,
        "id": filepath.name,
        "size": stat.st_size,
        "modified": stat.st_mtime,
        "type": ext,
        "mime_type": mime or "application/octet-stream",
    }


@router.get("")
def list_assets(
    type: Optional[str] = Query(None, description="Filter by file extension"),
    project: Optional[str] = Query(None, description="Filter by project tag"),
) -> Dict[str, Any]:
    """List assets from the assets directory."""
    assets_path = _ensure_assets_dir()
    files: List[Dict[str, Any]] = []

    for entry in sorted(assets_path.iterdir()):
        if not entry.is_file():
            continue
        ext = entry.suffix.lstrip(".").lower()
        if type and ext != type.lower().lstrip("."):
            continue
        files.append(_file_metadata(entry))

    return {"assets": files, "total": len(files)}


@router.get("/{asset_id}/info")
def asset_info(asset_id: str) -> Dict[str, Any]:
    """Return metadata for a specific asset."""
    filepath = _asset_path(asset_id)
    return _file_metadata(filepath)


@router.get("/{asset_id}/download")
def download_asset(asset_id: str) -> FileResponse:
    """Download an asset file."""
    filepath = _asset_path(asset_id)
    mime, _ = mimetypes.guess_type(filepath.name)
    return FileResponse(
        path=str(filepath),
        filename=filepath.name,
        media_type=mime or "application/octet-stream",
    )


@router.get("/{asset_id}/preview")
def preview_asset(asset_id: str) -> FileResponse:
    """Serve an asset preview (same as download for now)."""
    filepath = _asset_path(asset_id)
    mime, _ = mimetypes.guess_type(filepath.name)
    return FileResponse(
        path=str(filepath),
        media_type=mime or "application/octet-stream",
    )
