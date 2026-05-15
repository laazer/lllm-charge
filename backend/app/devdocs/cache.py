"""DevDocs cache — stores and searches offline developer documentation indexes."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

KNOWN_LANGUAGES = ["python", "javascript", "typescript", "go", "rust", "bash", "css", "html"]

_DEFAULT_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "devdocs",
)

# Pre-seeded index entries bundled with the app so searches work without
# an internet connection on the first call.
_BUILTIN_INDEXES: Dict[str, List[Dict[str, Any]]] = {
    "python": [
        {"name": "asyncio.run", "path": "asyncio#asyncio.run", "type": "Method"},
        {"name": "asyncio.gather", "path": "asyncio#asyncio.gather", "type": "Method"},
        {"name": "asyncio.sleep", "path": "asyncio#asyncio.sleep", "type": "Method"},
        {"name": "os.path", "path": "os.path", "type": "Module"},
        {"name": "list", "path": "stdtypes#list", "type": "class"},
        {"name": "dict", "path": "stdtypes#dict", "type": "class"},
        {"name": "str", "path": "stdtypes#str", "type": "class"},
        {"name": "pathlib.Path", "path": "pathlib", "type": "class"},
        {"name": "dataclasses.dataclass", "path": "dataclasses", "type": "decorator"},
        {"name": "typing.Optional", "path": "typing#typing.Optional", "type": "class"},
    ],
    "javascript": [
        {"name": "Promise", "path": "global_objects/promise", "type": "class"},
        {"name": "Array.prototype.map", "path": "global_objects/array/map", "type": "Method"},
        {"name": "fetch", "path": "global_objects/fetch", "type": "Function"},
        {"name": "JSON.parse", "path": "global_objects/json/parse", "type": "Method"},
        {"name": "console.log", "path": "global_objects/console/log", "type": "Method"},
    ],
}


class DevDocsCache:
    """Reads and searches DevDocs JSON indexes from a local directory."""

    def __init__(self, cache_dir: Optional[str] = None) -> None:
        self._using_default = cache_dir is None
        self.cache_dir = Path(cache_dir or _DEFAULT_CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        # Only auto-seed built-in indexes in the default cache location.
        # Tests supply a custom cache_dir and seed their own data.
        if self._using_default:
            self._ensure_builtin_indexes()

    # ── Index management ────────────────────────────────────────────────────

    def _ensure_builtin_indexes(self) -> None:
        """Seed the cache with built-in indexes if they don't exist yet."""
        for lang, entries in _BUILTIN_INDEXES.items():
            lang_dir = self.cache_dir / lang
            index_path = lang_dir / "index.json"
            if not index_path.exists():
                lang_dir.mkdir(parents=True, exist_ok=True)
                index_path.write_text(json.dumps({"entries": entries}), encoding="utf-8")

    def _load_index(self, language: str) -> Optional[List[Dict[str, Any]]]:
        """Load the cached index for a language; return None if not found."""
        index_path = self.cache_dir / language / "index.json"
        if not index_path.exists():
            return None
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
            return data.get("entries", [])
        except Exception as exc:
            logger.warning("Failed to load devdocs index for %s: %s", language, exc)
            return None

    def list_languages(self) -> List[str]:
        """Return languages that have a cached index.json."""
        langs: List[str] = []
        if not self.cache_dir.exists():
            return langs
        for child in self.cache_dir.iterdir():
            if child.is_dir() and (child / "index.json").exists():
                langs.append(child.name)
        return sorted(langs)

    async def get_or_fetch(self, language: str) -> Dict[str, Any]:
        """Return the index dict for a language (loads from disk; async for compat)."""
        entries = self._load_index(language) or []
        return {"entries": entries}

    # ── Search ──────────────────────────────────────────────────────────────

    def search(self, language: str, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search entries whose name or path contains *query* (case-insensitive)."""
        entries = self._load_index(language)
        if entries is None:
            return []
        query_lower = query.lower()
        results = [
            entry for entry in entries
            if query_lower in entry.get("name", "").lower()
            or query_lower in entry.get("path", "").lower()
        ]
        return results[:limit]


_cache_singleton: Optional[DevDocsCache] = None


def get_cache() -> DevDocsCache:
    global _cache_singleton
    if _cache_singleton is None:
        _cache_singleton = DevDocsCache()
    return _cache_singleton
