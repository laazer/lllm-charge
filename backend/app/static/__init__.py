"""
Static file serving configuration
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os


def setup_static_files(app: FastAPI) -> None:
    """Setup static file serving for the FastAPI application"""
    
    # Serve React frontend build files
    frontend_dist = os.path.join(os.path.dirname(__file__), "../../../dist")
    if os.path.exists(frontend_dist):
        app.mount("/static", StaticFiles(directory=frontend_dist), name="static")
    
    # Serve dashboard assets
    dashboard_assets = os.path.join(os.path.dirname(__file__), "../../../src/dashboard")
    if os.path.exists(dashboard_assets):
        app.mount("/dashboard", StaticFiles(directory=dashboard_assets), name="dashboard")
    
    # Serve public assets
    public_dir = os.path.join(os.path.dirname(__file__), "../../../public")
    if os.path.exists(public_dir):
        app.mount("/public", StaticFiles(directory=public_dir), name="public")