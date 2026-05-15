"""Godot project indexer — walks a project tree, parses all .gd files, persists JSON index."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.codegraph.gdscript_parser import GDScriptSymbol, parse_gdscript_file

# Directories skipped during the walk
_SKIP_DIRS = {"addons", ".godot", ".git", "node_modules", ".codegraph-godot"}

_INDEX_DIR_NAME = ".codegraph-godot"
_INDEX_FILE_NAME = "index.json"
_INDEX_VERSION = 1


@dataclass
class IndexResult:
    file_count: int
    symbol_count: int
    duration_ms: int


class GodotProjectIndexer:
    """Builds and queries a persistent symbol index for a Godot project."""

    def __init__(self, project_root: str) -> None:
        self._project_root = Path(project_root).resolve()
        self._index_path = self._project_root / _INDEX_DIR_NAME / _INDEX_FILE_NAME
        self._cached_index: Optional[Dict[str, Any]] = None

    # ── public API ───────────────────────────────────────────────────────────

    def index_project(self) -> IndexResult:
        """Walk project_root, parse all .gd files, write index.json.

        Skips ``addons/``, ``.godot/``, ``.git/``, and ``node_modules/``.
        Overwrites any existing index.
        """
        t0 = time.monotonic()
        gd_files = list(self._collect_gd_files())
        all_symbols: List[GDScriptSymbol] = []

        for gd_file in gd_files:
            try:
                all_symbols.extend(parse_gdscript_file(str(gd_file)))
            except Exception:
                pass  # resilient — skip files that fail to parse

        serialised = [self._symbol_to_dict(s) for s in all_symbols]
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        index = {
            "version": _INDEX_VERSION,
            "project_root": str(self._project_root),
            "indexed_at": datetime.now(timezone.utc).isoformat(),
            "file_count": len(gd_files),
            "symbol_count": len(all_symbols),
            "symbols": serialised,
        }

        self._index_path.parent.mkdir(parents=True, exist_ok=True)
        self._index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
        self._cached_index = index

        return IndexResult(
            file_count=len(gd_files),
            symbol_count=len(all_symbols),
            duration_ms=elapsed_ms,
        )

    def search(
        self,
        query: str,
        symbol_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Case-insensitive substring search over name and file_path.

        Optionally filters by ``symbol_type``.  Returns at most ``limit`` results.
        """
        index = self._load_index()
        if index is None:
            return []

        q = query.lower()
        results: List[Dict[str, Any]] = []

        for sym in index.get("symbols", []):
            if symbol_type and sym.get("symbol_type") != symbol_type:
                continue
            name_match = q in sym.get("name", "").lower()
            path_match = q in sym.get("file_path", "").lower()
            if name_match or path_match:
                results.append(sym)
            if len(results) >= limit:
                break

        return results

    def get_status(self) -> Dict[str, Any]:
        """Return index metadata, or ``{has_index: False, ...}`` when no index exists."""
        index = self._load_index()
        if index is None:
            return {
                "has_index": False,
                "project_root": str(self._project_root),
                "file_count": 0,
                "symbol_count": 0,
                "indexed_at": None,
            }
        return {
            "has_index": True,
            "project_root": str(self._project_root),
            "file_count": index.get("file_count", 0),
            "symbol_count": index.get("symbol_count", 0),
            "indexed_at": index.get("indexed_at"),
        }

    def invalidate(self) -> None:
        """Delete the on-disk index."""
        self._cached_index = None
        try:
            self._index_path.unlink()
        except FileNotFoundError:
            pass

    # ── private helpers ──────────────────────────────────────────────────────

    def _collect_gd_files(self) -> List[Path]:
        """Recursively find all .gd files, skipping _SKIP_DIRS."""
        result: List[Path] = []
        for item in self._project_root.rglob("*.gd"):
            # Check if any ancestor component is a skip dir
            relative = item.relative_to(self._project_root)
            if any(part in _SKIP_DIRS for part in relative.parts[:-1]):
                continue
            result.append(item)
        return result

    def _symbol_to_dict(self, symbol: GDScriptSymbol) -> Dict[str, Any]:
        """Serialise a GDScriptSymbol, making file_path relative to project_root."""
        try:
            rel_path = str(Path(symbol.file_path).resolve().relative_to(self._project_root))
        except ValueError:
            rel_path = symbol.file_path
        return {
            "name": symbol.name,
            "symbol_type": symbol.symbol_type,
            "line": symbol.line,
            "file_path": rel_path,
            "return_type": symbol.return_type,
            "parent_class": symbol.parent_class,
            "is_exported": symbol.is_exported,
            "is_static": symbol.is_static,
            "docstring": symbol.docstring,
        }

    def _load_index(self) -> Optional[Dict[str, Any]]:
        """Return the cached index, loading from disk if needed. Returns None if absent."""
        if self._cached_index is not None:
            return self._cached_index
        if not self._index_path.exists():
            return None
        try:
            self._cached_index = json.loads(self._index_path.read_text(encoding="utf-8"))
            return self._cached_index
        except (json.JSONDecodeError, OSError):
            return None
