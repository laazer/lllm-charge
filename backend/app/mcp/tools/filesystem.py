"""MCP filesystem tools — read_file, write_file, list_directory with path sandboxing."""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Dict

WORKSPACE_ROOT = str(Path(__file__).parent.parent.parent.parent.parent.resolve())

# Allow the workspace root AND common temp directories (for tests and shell tools)
_ALLOWED_PREFIXES = [
    WORKSPACE_ROOT,
    "/tmp",
    "/private/tmp",          # macOS realpath for /tmp
    "/var/folders",
    "/private/var/folders",  # macOS realpath for /var/folders
    tempfile.gettempdir(),
]


def _check_path_allowed(path: str) -> Path:
    """Resolve path and return it if within an allowed root, else raise PermissionError."""
    resolved = str(Path(path).resolve())
    if any(resolved.startswith(prefix) for prefix in _ALLOWED_PREFIXES):
        return Path(resolved)
    raise PermissionError(f"Path '{path}' is outside the allowed workspace")


async def handle_read_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """Read a file and return its text contents."""
    path = params.get("path", "")
    if not path:
        return {"error": "path parameter is required"}
    try:
        safe = _check_path_allowed(path)
    except PermissionError as exc:
        return {"error": str(exc)}
    if not safe.exists():
        return {"error": f"File not found: {path}"}
    content = safe.read_text(encoding="utf-8", errors="replace")
    return {"path": str(safe), "content": content}


async def handle_write_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """Write text content to a file."""
    path = params.get("path", "")
    content = params.get("content", "")
    if not path:
        return {"error": "path parameter is required"}
    try:
        safe = _check_path_allowed(path)
    except PermissionError as exc:
        return {"error": str(exc)}
    safe.parent.mkdir(parents=True, exist_ok=True)
    safe.write_text(content, encoding="utf-8")
    return {"path": str(safe), "written": True}


async def handle_list_directory(params: Dict[str, Any]) -> Dict[str, Any]:
    """List entries in a directory."""
    path = params.get("path", ".")
    try:
        safe = _check_path_allowed(path)
    except PermissionError as exc:
        return {"error": str(exc)}
    if not safe.is_dir():
        return {"error": f"Not a directory: {path}"}
    entries = [
        {"name": e.name, "type": "dir" if e.is_dir() else "file"}
        for e in sorted(safe.iterdir())
    ]
    return {"path": str(safe), "entries": entries}
