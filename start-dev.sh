#!/bin/bash
# LLM-Charge Development Server Startup Script
# Starts both backend and frontend together on unified ports

export PATH="/usr/local/opt/node@22/bin:$PATH"

echo "🚀 Starting LLM-Charge Development Environment"
echo ""
echo "Access Points:"
echo "  Frontend (dev):  http://localhost:7892  (or http://192.168.0.113:7892)"
echo "  Backend API:     http://localhost:7891  (or http://192.168.0.113:7891)"
echo "  MCP Tools:       http://localhost:7891/mcp"
echo ""
echo "Starting both backend and frontend..."
echo "  Backend: uv run uvicorn on port 7891"
echo "  Frontend: Vite dev server on port 7892"
echo ""

npm run dev:all
