"""MCP agents tools — list_agents and spawn_agent."""
from __future__ import annotations

from typing import Any, Dict


async def handle_list_agents(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from app.database.database import SessionLocal
        from app.database.models.agents import Agent
        db = SessionLocal()
        try:
            agents = db.query(Agent).all()
            return {
                "agents": [
                    {"id": a.id, "name": a.name, "status": getattr(a, "status", "unknown")}
                    for a in agents
                ]
            }
        finally:
            db.close()
    except Exception as exc:
        return {"error": str(exc)}


async def handle_spawn_agent(params: Dict[str, Any]) -> Dict[str, Any]:
    name = params.get("name", "")
    if not name:
        return {"error": "name is required"}
    try:
        import uuid
        from app.database.database import SessionLocal
        from app.database.models.agents import Agent
        db = SessionLocal()
        try:
            agent = Agent(id=str(uuid.uuid4()), name=name)
            db.add(agent)
            db.commit()
            db.refresh(agent)
            return {"id": agent.id, "name": agent.name}
        finally:
            db.close()
    except Exception as exc:
        return {"error": str(exc)}
