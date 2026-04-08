"""
MCP (Model Context Protocol) server implementation
"""
import logging

logger = logging.getLogger("llm-charge")


class MCPServer:
    """MCP server for LLM-Charge integration"""
    
    def __init__(self):
        self.tools = []
        self.initialized = False
        logger.info("MCP server initialized")
    
    def register_tool(self, tool):
        """Register a tool with the MCP server"""
        self.tools.append(tool)
    
    def get_tools(self):
        """Get all registered tools"""
        return self.tools
    
    def start(self):
        """Start the MCP server"""
        self.initialized = True
        logger.info("MCP server started")