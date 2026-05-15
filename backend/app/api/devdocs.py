"""
API routes for offline DevDocs documentation search.

GET  /api/devdocs/languages  — list cached language indexes
POST /api/devdocs/search     — search entries in a cached language index
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.devdocs.cache import DevDocsCache

router = APIRouter(prefix="/api/devdocs", tags=["devdocs"])

_cache = DevDocsCache()


class SearchRequest(BaseModel):
    query: str
    language: str
    limit: Optional[int] = 20


@router.get("/languages")
def list_languages():
    """Return all languages that have a cached DevDocs index."""
    languages = _cache.list_languages()
    return {"languages": languages, "total": len(languages)}


@router.post("/search")
def search_docs(payload: SearchRequest):
    """Search the cached index for a language and return matching entries."""
    results = _cache.search(payload.language, payload.query, limit=payload.limit or 20)
    return {"results": results, "total": len(results), "language": payload.language, "query": payload.query}
