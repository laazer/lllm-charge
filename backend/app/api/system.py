"""System introspect API route."""
from __future__ import annotations

import sys
import time
from typing import Any, Dict, List

import fastapi
from fastapi import APIRouter

router = APIRouter(prefix="/api/system", tags=["system"])

_SERVER_START_TIME: float = time.time()

_MODULES_LOADED: List[str] = [
    "fastapi",
    "sqlalchemy",
    "pydantic",
    "apscheduler",
    "httpx",
]


@router.get("/introspect")
def system_introspect() -> Dict[str, Any]:
    """Return server version, Python version, FastAPI version, loaded modules, and uptime."""
    return {
        "version": "2.0.0",
        "python_version": sys.version,
        "fastapi_version": fastapi.__version__,
        "uptime_seconds": time.time() - _SERVER_START_TIME,
        "modules": _MODULES_LOADED,
        "modules_loaded": _MODULES_LOADED,
    }
