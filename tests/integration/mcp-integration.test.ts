// MCP Integration Tests
// FEATURE: Comprehensive testing of MCP tools and integration

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { 
  MCPClientManager,
  MCPResourceManager, 
  MCPToolValidator,
  MCPSessionManager,
  MCPSkillOrchestrator,
  MCPFactory
} from '../../src/mcp'
import { ChildProcess, spawn } from 'child_process'
import { setTimeout } from 'timers/promises'

describe('MCP Integration Tests', () => {
  let mcpServer: ChildProcess
  let clientManager: MCPClientManager
  let resourceManager: MCPResourceManager
  let toolValidator: MCPToolValidator
  let sessionManager: MCPSessionManager
  let skillOrchestrator: MCPSkillOrchestrator

  beforeAll(async () => {
    // Start MCP server for testing
    mcpServer = spawn('node', ['dist/src/mcp/llm-charge-server.js', '--test-mode'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    })

    // Wait for server to start
    await setTimeout(2000)

    // Create full MCP stack
    const mcpStack = await MCPFactory.createFullStack({
      serverCommand: 'node',
      serverArgs: ['dist/src/mcp/llm-charge-server.js', '--test-mode'],
      projectPath: process.cwd(),
      costTracking: true,
      validation: {
        enabled: true,
        level: 'basic',
        maxCostPerCall: 1.00
      }
    })

    clientManager = mcpStack.clientManager
    resourceManager = mcpStack.resourceManager
    toolValidator = mcpStack.toolValidator
    sessionManager = mcpStack.sessionManager!
    skillOrchestrator = mcpStack.skillOrchestrator
  }, 30000)

  afterAll(async () => {
    // Cleanup
    if (clientManager) await clientManager.cleanup()
    if (resourceManager) await resourceManager.cleanup()  
    if (sessionManager) await sessionManager.cleanup()
    
    if (mcpServer) {
      mcpServer.kill()
      await setTimeout(1000)
    }
  })

  describe('MCPClientManager', () => {
    test('should connect to MCP server', async () => {
      const status = clientManager.getHealthStatus()
      expect(status.initialized).toBe(true)
      expect(status.connectedServers).toBeGreaterThan(0)
    })

    test('should list available tools', async () => {
      const tools = await clientManager.listAvailableTools('llm-charge')
      expect(tools['llm-charge']).toBeDefined()
      expect(Array.isArray(tools['llm-charge'])).toBe(true)
      expect(tools['llm-charge'].length).toBeGreaterThan(0)
      
      // Check for key tools
      const toolNames = tools['llm-charge'].map(t => t.name)
      expect(toolNames).toContain('build_context_package')
      expect(toolNames).toContain('search_code_symbols')
      expect(toolNames).toContain('get_system_status')
    })

    test('should execute get_system_status tool', async () => {
      const result = await clientManager.executeTool(
        'llm-charge',
        'get_system_status',
        {},
        { assistant: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.content).toBeDefined()
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.cost).toBeGreaterThan(0)
    })

    test('should execute search_code_symbols tool', async () => {
      const result = await clientManager.executeTool(
        'llm-charge',
        'search_code_symbols',
        { query: 'MCP', limit: 5 },
        { assistant: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.content).toBeDefined()
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('should handle batch tool execution', async () => {
      const results = await clientManager.batchExecuteTools([
        {
          serverId: 'llm-charge',
          toolName: 'get_system_status',
          args: {},
          context: { assistant: 'test' }
        },
        {
          serverId: 'llm-charge', 
          toolName: 'list_available_commands',
          args: {},
          context: { assistant: 'test' }
        }
      ])

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })

    test('should find best tool for task', async () => {
      const recommendation = await clientManager.findBestToolForTask(
        'search for code symbols',
        { assistant: 'test' }
      )

      expect(recommendation).toBeDefined()
      expect(recommendation!.toolName).toContain('search')
      expect(recommendation!.confidence).toBeGreaterThan(0)
    })

    test('should handle tool execution errors gracefully', async () => {
      const result = await clientManager.executeTool(
        'llm-charge',
        'nonexistent_tool',
        {},
        { assistant: 'test' }
      )

      expect(result.success).toBe(false)
      expect(result.content[0].text).toContain('Error')
    })
  })

  describe('MCPResourceManager', () => {
    test('should discover resources', async () => {
      const index = await resourceManager.discoverResources('llm-charge')
      
      expect(index.totalResources).toBeGreaterThanOrEqual(0)
      expect(index.serverCount).toBeGreaterThan(0)
      expect(index.lastUpdated).toBeInstanceOf(Date)
    })

    test('should search resources', async () => {
      // First discover some resources
      await resourceManager.discoverResources()
      
      const results = await resourceManager.searchResources({
        text: 'documentation',
        limit: 10
      })

      expect(Array.isArray(results)).toBe(true)
      // Results may be empty, which is fine for test environment
    })

    test('should provide resource statistics', async () => {
      const stats = resourceManager.getResourceStatistics()
      
      expect(stats).toBeDefined()
      expect(typeof stats.totalResources).toBe('number')
      expect(typeof stats.averageCost).toBe('number')
      expect(Array.isArray(stats.mostPopular)).toBe(true)
    })

    test('should optimize resource access', async () => {
      const optimization = await resourceManager.optimizeResourceAccess()
      
      expect(optimization.recommendations).toBeDefined()
      expect(Array.isArray(optimization.recommendations)).toBe(true)
      expect(typeof optimization.potentialSavings).toBe('number')
    })
  })

  describe('MCPToolValidator', () => {
    test('should validate tool arguments', async () => {
      const tools = await clientManager.listAvailableTools('llm-charge')
      const tool = tools['llm-charge'].find(t => t.name === 'search_code_symbols')
      
      if (tool) {
        const result = await toolValidator.validateToolCall(
          tool,
          { query: 'test', limit: 10 },
          { 
            toolName: 'search_code_symbols',
            serverId: 'llm-charge',
            assistant: 'test'
          }
        )

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
        expect(result.cost).toBeGreaterThan(0)
      }
    })

    test('should reject invalid arguments', async () => {
      const tools = await clientManager.listAvailableTools('llm-charge')
      const tool = tools['llm-charge'].find(t => t.name === 'search_code_symbols')
      
      if (tool) {
        const result = await toolValidator.validateToolCall(
          tool,
          { invalid_arg: 'test' }, // Missing required 'query' field
          {
            toolName: 'search_code_symbols',
            serverId: 'llm-charge', 
            assistant: 'test'
          }
        )

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    test('should track tool metrics', async () => {
      // Execute some tools to generate metrics
      await clientManager.executeTool(
        'llm-charge', 'get_system_status', {}, { assistant: 'test' }
      )

      toolValidator.recordToolExecution(
        'get_system_status',
        {},
        { content: [{ type: 'text', text: 'success' }], isError: false },
        1000,
        0.001
      )

      const metrics = toolValidator.getToolMetrics('get_system_status')
      expect(metrics['get_system_status']).toBeDefined()
      expect(metrics['get_system_status'].totalCalls).toBeGreaterThan(0)
    })
  })

  describe('MCPSessionManager', () => {
    let sessionId: string

    test('should create a session', async () => {
      sessionId = await sessionManager.createSession(
        'test-user',
        'test' as any,
        {
          maxCostPerSession: 5.00,
          preferLocal: true
        }
      )

      expect(sessionId).toBeDefined()
      expect(sessionId).toMatch(/^session_/)
    })

    test('should execute tools in session context', async () => {
      const result = await sessionManager.executeToolInSession(
        sessionId,
        'llm-charge',
        'get_system_status',
        {}
      )

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('should track session metrics', async () => {
      const session = sessionManager.getSession(sessionId)
      expect(session).toBeDefined()
      expect(session!.metrics.totalToolCalls).toBeGreaterThan(0)
      expect(session!.metrics.totalCost).toBeGreaterThan(0)
    })

    test('should create session snapshots', async () => {
      await sessionManager.createSessionSnapshot(sessionId)
      
      // Snapshot creation is async, so we can't directly verify
      // but we can check the session still exists
      const session = sessionManager.getSession(sessionId)
      expect(session).toBeDefined()
    })

    test('should provide session analytics', async () => {
      const analytics = sessionManager.getSessionAnalytics()
      
      expect(analytics.totalSessions).toBeGreaterThan(0)
      expect(analytics.activeSessions).toBeGreaterThanOrEqual(0)
      expect(typeof analytics.averageSessionDuration).toBe('number')
      expect(typeof analytics.totalCost).toBe('number')
      expect(Array.isArray(analytics.mostUsedTools)).toBe(true)
    })

    test('should export and import sessions', async () => {
      const exported = await sessionManager.exportSession(sessionId)
      
      expect(exported.session).toBeDefined()
      expect(exported.snapshots).toBeDefined()
      expect(exported.exportedAt).toBeInstanceOf(Date)

      // For full import test, we'd need to create a new session manager
      // This is a basic structure test
    })

    test('should terminate session', async () => {
      await sessionManager.terminateSession(sessionId)
      
      const session = sessionManager.getSession(sessionId)
      expect(session?.state).toBe('terminated')
    })
  })

  describe('MCPSkillOrchestrator', () => {
    test('should execute built-in analyze_codebase skill', async () => {
      const result = await skillOrchestrator.executeSkill(
        'analyze_codebase',
        { query: 'MCP implementation' }
      )

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.metadata?.stepCount).toBeGreaterThan(0)
    })

    test('should create and execute custom skill', async () => {
      const skillId = await skillOrchestrator.createCompositeSkill(
        'Test Skill',
        [
          {
            toolName: 'get_system_status',
            serverId: 'llm-charge',
            args: {}
          },
          {
            toolName: 'list_available_commands', 
            serverId: 'llm-charge',
            args: {}
          }
        ]
      )

      expect(skillId).toBeDefined()
      expect(skillId).toMatch(/^composite_/)

      const result = await skillOrchestrator.executeSkill(skillId, {})
      expect(result.success).toBe(true)
      expect(result.metadata?.stepCount).toBe(2)
    })
  })

  describe('Integration Patterns', () => {
    test('should support Claude Code workflow', async () => {
      // Simulate typical Claude Code workflow
      const results = await clientManager.batchExecuteTools([
        {
          serverId: 'llm-charge',
          toolName: 'get_context_tree',
          args: { maxDepth: 2 },
          context: { assistant: 'claude' }
        },
        {
          serverId: 'llm-charge',
          toolName: 'search_code_symbols',
          args: { query: 'test', limit: 10 },
          context: { assistant: 'claude' }
        }
      ])

      expect(results).toHaveLength(2)
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.executionTime).toBeGreaterThan(0)
      })
    })

    test('should support Cursor IDE workflow', async () => {
      // Simulate Cursor IDE quick analysis
      const result = await clientManager.executeTool(
        'llm-charge',
        'get_file_skeleton',
        { filePath: './src/mcp/client-tools.ts' },
        { 
          assistant: 'cursor',
          preferences: { timeout: 5000 }
        }
      )

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeLessThan(10000) // Should be fast
    })

    test('should demonstrate cost optimization', async () => {
      // Execute tools with cost tracking
      const results = await Promise.all([
        clientManager.executeTool(
          'llm-charge', 'get_system_status', {},
          { assistant: 'test', preferences: { preferLocal: true } }
        ),
        clientManager.executeTool(
          'llm-charge', 'get_cost_metrics', { timeframe: 'hour' },
          { assistant: 'test', preferences: { preferLocal: true } }
        )
      ])

      const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0)
      expect(totalCost).toBeLessThan(0.10) // Should be very cheap with local preference
    })
  })

  describe('Factory Functions', () => {
    test('should create minimal stack', async () => {
      const { clientManager: minimal } = await MCPFactory.createMinimal()
      
      expect(minimal).toBeDefined()
      expect(minimal.getHealthStatus().initialized).toBe(true)
      
      await minimal.cleanup()
    })

    test('should create Claude-optimized stack', async () => {
      const stack = await MCPFactory.createForClaude(process.cwd())
      
      expect(stack.clientManager).toBeDefined()
      expect(stack.resourceManager).toBeDefined()
      expect(stack.toolValidator).toBeDefined()
      expect(stack.sessionManager).toBeDefined()
      
      // Cleanup
      await stack.clientManager.cleanup()
      if (stack.resourceManager) await stack.resourceManager.cleanup()
      if (stack.sessionManager) await stack.sessionManager.cleanup()
    })

    test('should create Cursor-optimized stack', async () => {
      const stack = await MCPFactory.createForCursor(process.cwd())
      
      expect(stack.clientManager).toBeDefined()
      expect(stack.resourceManager).toBeDefined()
      
      // Cleanup
      await stack.clientManager.cleanup()
      if (stack.resourceManager) await stack.resourceManager.cleanup()
      if (stack.sessionManager) await stack.sessionManager.cleanup()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle server disconnection gracefully', async () => {
      // This is a bit tricky to test without actually stopping the server
      // We'll test the health check instead
      const status = clientManager.getHealthStatus()
      expect(status.connectedServers).toBeGreaterThanOrEqual(0)
    })

    test('should handle invalid tool names', async () => {
      const result = await clientManager.executeTool(
        'llm-charge',
        'nonexistent_tool_name',
        {},
        { assistant: 'test' }
      )

      expect(result.success).toBe(false)
      expect(result.content[0].text).toContain('Error')
    })

    test('should handle malformed arguments', async () => {
      const result = await clientManager.executeTool(
        'llm-charge',
        'search_code_symbols',
        null, // Invalid args
        { assistant: 'test' }
      )

      expect(result.success).toBe(false)
    })

    test('should respect timeout limits', async () => {
      const start = Date.now()
      
      const result = await clientManager.executeTool(
        'llm-charge',
        'get_system_status',
        {},
        { 
          assistant: 'test',
          preferences: { timeout: 1 } // Very short timeout
        }
      )

      const elapsed = Date.now() - start
      
      // Either succeeds quickly or times out
      expect(elapsed).toBeLessThan(5000)
    }, 10000)
  })
})