"""
Main FastAPI application for LLM-Charge Backend
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import time
import traceback
import os

# Import configuration and database
from app.config import settings
from app.database.database import init_database

# Import API routers
from app.api import agents, workflows, specs, projects
from app.api.cron import router as cron_router
from app.api.buddies import router as buddies_router
from app.api.memory import router as memory_router
from app.api.health import health_router, api_router as health_api_router
from app.api.reasoning import router as reasoning_router
from app.api.mcp_router import router as mcp_api_router
from app.api.agent_runner import router as agent_runner_router
from app.api.devdocs import router as devdocs_router
from app.api.blender import router as blender_router
from app.api.codegraph import router as codegraph_router
from app.api.filesystem import router as filesystem_router
from app.api.tools import router as tools_router
from app.api.assets import router as assets_router
from app.api.system import router as system_router

# Import WebSocket manager
from app.websocket.manager import websocket_manager

# Import core components
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import LLMChargeException

# Set up logging
setup_logging(level="INFO" if not settings.debug else "DEBUG")
logger = get_logger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting LLM-Charge FastAPI backend...")
    start_time = time.time()
    
    try:
        # Initialize database
        init_database()
        logger.info("✅ Database initialized")
        
        startup_time = time.time() - start_time
        logger.info(f"🚀 LLM-Charge backend startup complete in {startup_time:.2f}s")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down LLM-Charge backend...")
    try:
        logger.info("👋 LLM-Charge backend shutdown complete")
        
    except Exception as e:
        logger.error(f"❌ Shutdown error: {e}")


# Create FastAPI application with lifespan
app = FastAPI(
    title="LLM-Charge Backend",
    description="Python backend for LLM-Charge platform with multi-modal AI, workflow automation, and cost optimization",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add GZip middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for frontend
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include API routers
app.include_router(health_router)
app.include_router(health_api_router)
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(specs.router, prefix="/api/specs", tags=["specs"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(reasoning_router, tags=["reasoning"])
app.include_router(cron_router)
app.include_router(buddies_router)
app.include_router(memory_router)
app.include_router(mcp_api_router)
app.include_router(agent_runner_router)
app.include_router(devdocs_router)
app.include_router(blender_router)
app.include_router(codegraph_router)
app.include_router(filesystem_router)
app.include_router(tools_router)
app.include_router(assets_router)
app.include_router(system_router)


async def database_health():
    """Check database health and connectivity"""
    try:
        from app.api.deps import get_db
        from sqlalchemy import text
        
        # Test database connectivity with SELECT 1 query
        db = next(get_db())
        try:
            result = db.execute(text("SELECT 1"))
            if result.scalar() == 1:
                db.close()
                return {
                    "status": "healthy",
                    "database": "connected", 
                    "timestamp": int(time.time())
                }
            else:
                db.close()
                return {"status": "unhealthy", "error": "Database query failed"}
        except Exception as db_error:
            db.close()
            raise db_error
            
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


@app.get("/health")
async def health_check():
    """Health check endpoint with system status"""
    try:
        # Check database connectivity using dedicated health function
        db_health_result = await database_health()
        db_status = db_health_result.get("status", "unhealthy")
        
        overall_status = "healthy" if db_status == "healthy" else "degraded"

        return {
            "status": overall_status,
            "version": "2.0.0",
            "service": "llm-charge-backend",
            "timestamp": int(time.time()),
            "components": {
                "database": db_status,
                "mcp_server": "healthy",
            },
            "uptime_seconds": int(time.time() - start_time) if 'start_time' in locals() else 0
        }
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "unhealthy",
            "version": "2.0.0",
            "service": "llm-charge-backend",
            "timestamp": int(time.time()),
            "error": "Health check failed"
        }


@app.get("/health/database")
async def database_health_endpoint():
    """Dedicated database health check endpoint"""
    return await database_health()


@app.get("/")
async def root():
    """Root endpoint with comprehensive API information"""
    return {
        "message": "LLM-Charge FastAPI Backend",
        "description": "Python backend for LLM-Charge platform with multi-modal AI, workflow automation, and cost optimization",
        "version": "2.0.0",
        "timestamp": int(time.time()),
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc", 
            "health": "/health",
            "agents": "/api/agents",
            "workflows": "/api/workflows",
            "specs": "/api/specs",
            "projects": "/api/projects",
            "mcp_tools": "/mcp/tools",
            "websocket": "/ws"
        },
        "features": [
            "Agent Management with CRUD operations",
            "Workflow Automation Engine",
            "Project and Specification Management", 
            "Model Context Protocol (MCP) Integration",
            "Real-time WebSocket Communication",
            "Comprehensive Error Handling",
            "Production-ready Logging"
        ],
        "status": "running"
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo the received message for testing
            await websocket_manager.send_personal_message(f"Echo: {data}", websocket)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)


@app.exception_handler(LLMChargeException)
async def llmcharge_exception_handler(request: Request, exc: LLMChargeException):
    """Handle custom LLM-Charge exceptions"""
    logger.warning(f"LLM-Charge exception: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "error_code": exc.__class__.__name__,
            "details": exc.details
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    logger.warning(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": exc.errors()
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    error_id = int(time.time())
    logger.error(f"Unhandled exception (ID: {error_id}): {exc}\n{traceback.format_exc()}")
    
    # Don't expose internal details in production
    detail = "Internal server error" if not settings.debug else str(exc)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": detail,
            "error_id": error_id,
            "timestamp": int(time.time())
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )