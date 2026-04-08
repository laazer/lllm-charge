"""
WebSocket connection manager for real-time features
"""
from typing import List, Dict, Any
from fastapi import WebSocket
import logging
import asyncio

logger = logging.getLogger("llm-charge")


class WebSocketManager:
    """Manage WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_count = 0
        logger.info("WebSocket manager initialized")
    
    async def connect(self, websocket: WebSocket):
        """Accept and manage a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_count += 1
        logger.info(f"WebSocket connection established. Total: {self.connection_count}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            self.connection_count -= 1
            logger.info(f"WebSocket connection closed. Total: {self.connection_count}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket"""
        await websocket.send_text(message)
    
    async def broadcast(self, message: str):
        """Broadcast a message to all connected WebSockets"""
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                self.disconnect(connection)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()