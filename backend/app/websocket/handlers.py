"""
WebSocket endpoint handlers
"""
from fastapi import WebSocket, WebSocketDisconnect
from .connection_manager import manager
import json
import logging

logger = logging.getLogger("llm-charge")


async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint handler"""
    await manager.connect(websocket)
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                await handle_websocket_message(websocket, message)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error", 
                    "message": "Internal server error"
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def handle_websocket_message(websocket: WebSocket, message: dict):
    """Handle incoming WebSocket message"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await websocket.send_text(json.dumps({"type": "pong"}))
    
    elif message_type == "subscribe_metrics":
        # Client wants to subscribe to metrics updates
        await websocket.send_text(json.dumps({
            "type": "subscription_confirmed",
            "subscription": "metrics"
        }))
    
    elif message_type == "get_status":
        # Send current system status
        status = {
            "type": "status",
            "data": {
                "connected_clients": manager.get_connection_count(),
                "server_status": "healthy"
            }
        }
        await websocket.send_text(json.dumps(status))
    
    else:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }))