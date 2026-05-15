"""Blender asset generation API routes."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.blender.pipeline_bridge import BlenderPipelineBridge

router = APIRouter(prefix="/api/blender", tags=["blender"])

# Singleton bridge — replaced in tests via `patch("app.api.blender._bridge")`
_bridge = BlenderPipelineBridge()


class GenerateRequest(BaseModel):
    prompt: str
    asset_type: str = "mesh"
    style: str = "realistic"
    complexity: str = "medium"


class SmartGenerateRequest(BaseModel):
    prompt: str
    style: Optional[str] = None
    lod: Optional[str] = None
    extra_options: Optional[Dict[str, Any]] = None


async def _require_blender() -> None:
    """Raise 503 if Blender is not available."""
    status = await _bridge.check_availability()
    if not status.get("available"):
        raise HTTPException(
            status_code=503,
            detail={"error": "Blender not available"},
        )


@router.get("/status")
async def blender_status() -> Dict[str, Any]:
    """Return Blender availability and version string."""
    return await _bridge.check_availability()


@router.post("/generate")
async def generate_asset(request: GenerateRequest) -> Dict[str, Any]:
    """Generate a 3D asset from a text prompt."""
    await _require_blender()
    try:
        return await _bridge.generate_asset(
            prompt=request.prompt,
            asset_type=request.asset_type,
            style=request.style,
            complexity=request.complexity,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"error": str(exc)}) from exc


@router.post("/generate/smart")
async def generate_smart_asset(request: SmartGenerateRequest) -> Dict[str, Any]:
    """Smart asset generation with LLM-driven style selection."""
    await _require_blender()
    options: Dict[str, Any] = {}
    if request.style:
        options["style"] = request.style
    if request.lod:
        options["lod"] = request.lod
    if request.extra_options:
        options.update(request.extra_options)

    try:
        return await _bridge.generate_smart(prompt=request.prompt, options=options)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"error": str(exc)}) from exc
