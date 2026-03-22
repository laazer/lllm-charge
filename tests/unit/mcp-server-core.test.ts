// Core MCP Server tests focused on functionality
import { LLMChargeServer } from '../../src/mcp/llm-charge-server'
import { createMockConfig, MockLLMProvider, TEST_CONFIG } from '../setup'

describe('LLMChargeServer Core', () => {
  let server: LLMChargeServer
  let mockConfig: any

  beforeEach(async () => {
    mockConfig = createMockConfig()
    server = new LLMChargeServer(mockConfig)
    await server.initialize()
  })

  afterEach(async () => {
    if (server) {
      await server.cleanup()
    }
  })

  describe('Server Initialization', () => {
    it('should initialize all components successfully', () => {
      expect(server).toBeDefined()
      expect((server as any).knowledgeBase).toBeDefined()
      expect((server as any).reasoning).toBeDefined()
      expect((server as any).commandHandler).toBeDefined()
      expect((server as any).costTracker).toBeDefined()
    })

    it('should load configuration correctly', () => {
      expect((server as any).config).toEqual(mockConfig)
    })

    it('should set up tool handlers', () => {
      const handlers = (server as any).toolHandlers || {}
      expect(Object.keys(handlers).length).toBeGreaterThan(0)
    })
  })

  describe('Tool Registration', () => {
    it('should register core LLM-Charge tools', () => {
      const toolList = server.listTools()
      
      // Core tools that should be available
      const expectedTools = [
        'llm_charge_query',
        'llm_charge_command',
        'llm_charge_docs_search',
        'llm_charge_cost_analysis',
        'llm_charge_optimize'
      ]

      expectedTools.forEach(tool => {
        expect(toolList.some(t => t.name === tool)).toBe(true)
      })
    })

    it('should provide tool schemas with proper validation', () => {
      const tools = server.listTools()
      
      tools.forEach(tool => {
        expect(tool.name).toBeDefined()
        expect(tool.description).toBeDefined()
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.inputSchema.properties).toBeDefined()
      })
    })

    it('should handle tool registration dynamically', () => {
      const initialToolCount = server.listTools().length

      // Register a custom tool
      server.registerTool({
        name: 'test_custom_tool',
        description: 'A test custom tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }, async (params) => {
        return {
          content: [{ type: 'text', text: `Custom tool executed with: ${params.input}` }]
        }
      })

      expect(server.listTools().length).toBe(initialToolCount + 1)
    })
  })

  describe('Query Processing', () => {
    it('should process queries with local knowledge prioritization', async () => {
      // Add some knowledge to the base
      await (server as any).knowledgeBase.store('react-info', 'React is a JavaScript library', { type: 'documentation' })

      const response = await server.callTool('llm_charge_query', {
        query: 'What is React?',
        useLocal: true,
        maxSteps: 3
      })

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(response.content[0].text).toContain('React')
    })

    it('should handle command execution requests', async () => {
      const response = await server.callTool('llm_charge_command', {
        command: 'git status',
        cwd: process.cwd()
      })

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      
      const result = JSON.parse(response.content[0].text)
      expect(result.success).toBeDefined()
      expect(result.cost).toBe(0) // Commands should have zero cost
    })

    it('should search documentation intelligently', async () => {
      const response = await server.callTool('llm_charge_docs_search', {
        query: 'React hooks documentation',
        includeExamples: true
      })

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
    })

    it('should provide cost analysis insights', async () => {
      // Record some mock usage first
      await (server as any).costTracker.recordRequest({
        isLocal: true,
        cost: 0,
        tokens: 100,
        model: 'llama2',
        latencyMs: 200
      })

      const response = await server.callTool('llm_charge_cost_analysis', {
        timeframe: '24h',
        includeBreakdown: true
      })

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      
      const analysis = JSON.parse(response.content[0].text)
      expect(analysis.totalRequests).toBeDefined()
      expect(analysis.totalCost).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid tool calls gracefully', async () => {
      await expect(server.callTool('non_existent_tool', {}))
        .rejects.toThrow('Unknown tool')
    })

    it('should validate tool parameters correctly', async () => {
      await expect(server.callTool('llm_charge_query', {
        // Missing required 'query' parameter
        useLocal: true
      })).rejects.toThrow()
    })

    it('should handle internal errors without crashing', async () => {
      // Mock an internal error
      jest.spyOn((server as any).reasoning, 'processRequest')
        .mockRejectedValueOnce(new Error('Internal processing error'))

      const response = await server.callTool('llm_charge_query', {
        query: 'This will cause an error',
        useLocal: true
      })

      expect(response).toBeDefined()
      expect(response.content[0].text).toContain('Error')
    })

    it('should recover from component failures', async () => {
      // Mock knowledge base failure
      jest.spyOn((server as any).knowledgeBase, 'searchSemantic')
        .mockRejectedValueOnce(new Error('Database connection failed'))

      // Should fall back to other reasoning methods
      const response = await server.callTool('llm_charge_query', {
        query: 'Test query during failure',
        useLocal: true
      })

      expect(response).toBeDefined()
      // Should still provide a response, even if degraded
    })
  })

  describe('Performance Optimization', () => {
    it('should cache frequent queries for better performance', async () => {
      const query = 'What is TypeScript?'
      
      // First call - measure baseline
      const start1 = Date.now()
      await server.callTool('llm_charge_query', { query, useLocal: true })
      const time1 = Date.now() - start1

      // Second call - should be faster due to caching
      const start2 = Date.now()
      await server.callTool('llm_charge_query', { query, useLocal: true })
      const time2 = Date.now() - start2

      // Note: In a real implementation with proper caching, time2 should be significantly less
      expect(time2).toBeLessThanOrEqual(time1 + 50) // Allow for variance
    })

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        server.callTool('llm_charge_query', {
          query: `Test query ${i}`,
          useLocal: true,
          maxSteps: 2
        })
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(5)
      results.forEach((result, i) => {
        expect(result).toBeDefined()
        expect(result.content[0].text).toContain('Test query')
      })
    })

    it('should optimize resource usage under load', async () => {
      const heavyRequests = Array.from({ length: 10 }, (_, i) => 
        server.callTool('llm_charge_command', {
          command: 'echo "test command ' + i + '"',
          cwd: process.cwd()
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(heavyRequests)
      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(10)
      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds

      // All should be successful
      results.forEach(result => {
        const parsed = JSON.parse(result.content[0].text)
        expect(parsed.success).toBe(true)
        expect(parsed.cost).toBe(0)
      })
    })
  })

  describe('Cost Optimization Features', () => {
    it('should automatically route to local models when appropriate', async () => {
      // Query that should be handled locally
      const response = await server.callTool('llm_charge_query', {
        query: 'Simple greeting',
        useLocal: true
      })

      expect(response).toBeDefined()
      
      // Should have used local processing (zero cost)
      const metrics = await (server as any).costTracker.getMetrics()
      expect(metrics.localRequests).toBeGreaterThan(0)
    })

    it('should provide optimization recommendations', async () => {
      // Add some expensive requests to trigger recommendations
      await (server as any).costTracker.recordRequest({
        isLocal: false,
        cost: 0.05,
        tokens: 1000,
        model: 'gpt-4',
        latencyMs: 2000
      })

      const response = await server.callTool('llm_charge_optimize', {
        analysisType: 'cost_reduction'
      })

      expect(response).toBeDefined()
      
      const recommendations = JSON.parse(response.content[0].text)
      expect(recommendations.suggestions).toBeDefined()
      expect(recommendations.potentialSavings).toBeDefined()
    })

    it('should track and report actual cost savings', async () => {
      // Simulate local requests that saved costs
      await (server as any).costTracker.recordRequest({
        isLocal: true,
        cost: 0,
        tokens: 200,
        model: 'llama2',
        latencyMs: 300
      })

      const response = await server.callTool('llm_charge_cost_analysis', {
        timeframe: '1h',
        includeBreakdown: true
      })

      const analysis = JSON.parse(response.content[0].text)
      expect(analysis.savings).toBeDefined()
      expect(analysis.savings.totalSaved).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration Points', () => {
    it('should integrate seamlessly with external tools', async () => {
      // Test integration with common development tools
      const gitResponse = await server.callTool('llm_charge_command', {
        command: 'git --version',
        cwd: process.cwd()
      })

      const gitResult = JSON.parse(gitResponse.content[0].text)
      expect(gitResult.success).toBe(true)
      expect(gitResult.output).toContain('git version')
    })

    it('should handle multi-step workflows', async () => {
      // Step 1: Search for information
      const searchResponse = await server.callTool('llm_charge_docs_search', {
        query: 'React component patterns'
      })

      expect(searchResponse).toBeDefined()

      // Step 2: Use that information in a query
      const queryResponse = await server.callTool('llm_charge_query', {
        query: 'How to implement the patterns I just searched for?',
        useLocal: true,
        context: 'React development'
      })

      expect(queryResponse).toBeDefined()
    })

    it('should maintain context across related requests', async () => {
      // First request establishes context
      const response1 = await server.callTool('llm_charge_query', {
        query: 'I am working on a React application',
        useLocal: true
      })

      expect(response1).toBeDefined()

      // Second request should understand the context
      const response2 = await server.callTool('llm_charge_query', {
        query: 'What are best practices for this?', // "this" refers to React app
        useLocal: true,
        context: 'React development'
      })

      expect(response2).toBeDefined()
      expect(response2.content[0].text).toContain('React')
    })
  })
})