#!/usr/bin/env python3
"""
Simple test runner to validate FastAPI foundation without external dependencies
"""

import sys
import os

# Add backend directory to path
backend_path = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, backend_path)

def test_imports():
    """Test that all modules can be imported successfully"""
    tests_passed = 0
    tests_total = 0
    
    print("🟢 GREEN PHASE: Testing FastAPI foundation implementation...")
    print("=" * 60)
    
    # Test 1: Import main app
    tests_total += 1
    try:
        from app.main import app
        assert app is not None
        assert app.title == "LLM-Charge Backend"
        assert app.version == "2.0.0"
        print("✅ Test 1 PASSED: FastAPI app creation")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Test 1 FAILED: FastAPI app creation - {e}")
    
    # Test 2: Config settings
    tests_total += 1
    try:
        from app.config import settings
        assert hasattr(settings, 'database_url')
        assert hasattr(settings, 'cors_origins')
        assert hasattr(settings, 'debug')
        print("✅ Test 2 PASSED: Configuration settings")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Test 2 FAILED: Configuration settings - {e}")
    
    # Test 3: Database models
    tests_total += 1
    try:
        from app.database.models.agents import Agent
        from app.database.models.main import Project, Specification
        from app.database.models.flows import Flow
        
        assert Agent is not None
        assert hasattr(Agent, 'id')
        assert hasattr(Agent, 'name')
        assert hasattr(Agent, 'primary_role')
        
        assert Project is not None
        assert hasattr(Project, 'id')
        assert hasattr(Project, 'name')
        
        assert Specification is not None
        assert hasattr(Specification, 'id')
        assert hasattr(Specification, 'title')
        assert hasattr(Specification, 'status')
        
        assert Flow is not None
        assert hasattr(Flow, 'id')
        assert hasattr(Flow, 'name')
        assert hasattr(Flow, 'nodes')
        assert hasattr(Flow, 'edges')
        
        print("✅ Test 3 PASSED: Database models structure")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Test 3 FAILED: Database models - {e}")
    
    # Test 4: MCP integration
    tests_total += 1
    try:
        from app.mcp.server import MCPServer
        from app.mcp.tools import get_available_tools
        
        server = MCPServer()
        assert server is not None
        
        tools = get_available_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0
        
        print("✅ Test 4 PASSED: MCP integration")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Test 4 FAILED: MCP integration - {e}")
    
    # Test 5: WebSocket manager
    tests_total += 1
    try:
        from app.websocket.manager import WebSocketManager
        manager = WebSocketManager()
        assert manager is not None
        print("✅ Test 5 PASSED: WebSocket manager")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Test 5 FAILED: WebSocket manager - {e}")
    
    # Test 6: API routers
    tests_total += 1
    try:
        from app.api import agents, workflows, specs, projects
        
        assert hasattr(agents, 'router')
        assert hasattr(workflows, 'router')
        assert hasattr(specs, 'router')
        assert hasattr(projects, 'router')
        
        print("✅ Test 6 PASSED: API routers")
        tests_passed += 1
    except Exception as e:
        print(f"❌ Test 6 FAILED: API routers - {e}")
    
    print("=" * 60)
    print(f"🎯 TEST RESULTS: {tests_passed}/{tests_total} tests passed")
    
    if tests_passed == tests_total:
        print("🟢 GREEN PHASE SUCCESSFUL: All tests pass!")
        print("✅ FastAPI foundation implemented correctly")
        return True
    else:
        print("❌ Some tests failed - implementation needs fixes")
        return False

if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)