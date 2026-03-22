// Integration tests for LLM-Charge MCP Server
import { LLMChargeServer } from '../../src/mcp/llm-charge-server'
import { TEST_CONFIG, createMockConfig, MockLLMProvider } from '../setup'
import * as path from 'path'
import * as fs from 'fs/promises'

describe('LLM-Charge MCP Server Integration', () => {
  let server: LLMChargeServer
  let testProjectDir: string
  let mockProvider: MockLLMProvider

  beforeEach(async () => {
    testProjectDir = path.join(TEST_CONFIG.TEST_CACHE_DIR, 'mcp-server-test')
    await fs.mkdir(testProjectDir, { recursive: true })
    
    // Create test project structure
    await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true })
    await fs.writeFile(
      path.join(testProjectDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: { 'react': '^18.0.0', 'typescript': '^5.0.0' }
      })
    )
    
    await fs.writeFile(
      path.join(testProjectDir, 'src', 'App.tsx'),
      `
import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App
      `.trim()
    )

    mockProvider = new MockLLMProvider()
    const config = createMockConfig()
    
    server = new LLMChargeServer(config, testProjectDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(testProjectDir, { recursive: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Server Initialization', () => {
    it('should initialize all components successfully', async () => {
      expect(server).toBeDefined()
      
      // Server should be able to start (we won't actually start it to avoid conflicts)
      expect(server).toHaveProperty('start')
    })
  })

  describe('Intelligence Tools', () => {
    beforeEach(async () => {
      // Mock the server's internal components for testing
      const mockIntelligence = {
        buildContextPackage: jest.fn().mockResolvedValue({
          relevantFiles: ['src/App.tsx'],
          codeSymbols: [
            { name: 'App', kind: 'function', file: 'src/App.tsx', line: 3 },
            { name: 'useState', kind: 'import', file: 'src/App.tsx', line: 1 }
          ],
          semanticMatches: [
            { content: 'React functional component', similarity: 0.9 }
          ],
          memoryNodes: [],
          relationships: [],
          estimatedTokens: 500
        }),
        searchCodeSymbols: jest.fn().mockResolvedValue([
          { name: 'App', kind: 'function', file: 'src/App.tsx', line: 3, similarity: 0.95 }
        ])
      }

      // Inject mock
      ;(server as any).intelligence = mockIntelligence
    })

    it('should build context packages', async () => {
      const handler = (server as any).handleBuildContextPackage.bind(server)
      const result = await handler({ query: 'React component', maxTokens: 2000 })
      
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0].text).toContain('Context Package')
    })

    it('should search code symbols', async () => {
      const handler = (server as any).handleSearchCodeSymbols.bind(server)
      const result = await handler({ query: 'App component', limit: 5 })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Code Symbols Found')
    })
  })

  describe('Documentation Tools', () => {
    beforeEach(async () => {
      // Mock documentation intelligence
      const mockDocsIntelligence = {
        searchDocs: jest.fn().mockResolvedValue([
          {
            doc: 'react',
            name: 'useState Hook',
            path: '/react/hooks/useState',
            type: 'hook',
            content: 'useState is a React Hook that lets you add state to functional components.',
            similarity: 0.9,
            source: 'devdocs'
          }
        ]),
        getDocumentationStatus: jest.fn().mockResolvedValue({
          installed: ['react', 'javascript'],
          available: ['react', 'javascript', 'typescript', 'python'],
          storage_size: 1024 * 1024 * 5 // 5MB
        }),
        indexDocumentation: jest.fn().mockResolvedValue(undefined),
        getAvailableDocumentations: jest.fn().mockResolvedValue([
          { name: 'React', slug: 'react', type: 'framework' },
          { name: 'JavaScript', slug: 'javascript', type: 'language' }
        ])
      }

      ;(server as any).docsIntelligence = mockDocsIntelligence
    })

    it('should search developer documentation', async () => {
      const handler = (server as any).handleDocsTool.bind(server)
      const result = await handler('search_developer_docs', { 
        query: 'React useState hook',
        limit: 5 
      })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Found 1 documentation results')
      expect(result.content[0].text).toContain('useState Hook')
    })

    it('should install developer documentation', async () => {
      const handler = (server as any).handleDocsTool.bind(server)
      const result = await handler('install_developer_docs', { 
        docs: ['typescript', 'python'] 
      })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Installing documentation')
    })

    it('should show documentation status', async () => {
      const handler = (server as any).handleDocsTool.bind(server)
      const result = await handler('get_documentation_status', {})
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Smart Documentation System Status')
      expect(result.content[0].text).toContain('react')
      expect(result.content[0].text).toContain('javascript')
    })

    it('should perform quick doc lookups', async () => {
      const handler = (server as any).handleDocsTool.bind(server)
      const result = await handler('quick_doc_lookup', { 
        api_or_concept: 'useState',
        language_or_tool: 'react' 
      })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Quick Documentation Lookup')
      expect(result.content[0].text).toContain('useState')
    })
  })

  describe('Reasoning Tools', () => {
    beforeEach(async () => {
      // Mock reasoning system
      const mockReasoning = {
        processQuery: jest.fn().mockResolvedValue({
          answer: 'This is a test reasoning response about React useState.',
          modelUsed: 'test-model',
          isLocal: true,
          cost: 0,
          tokensUsed: 150,
          stepsExecuted: 1,
          confidence: 0.85
        })
      }

      const mockRLMEngine = {
        startReasoningSession: jest.fn().mockResolvedValue('session-123'),
        getSession: jest.fn().mockResolvedValue({
          id: 'session-123',
          query: 'Test reasoning query',
          status: 'completed',
          result: 'Reasoning complete',
          iterations: [
            { prompt: 'Step 1', response: 'Response 1', timestamp: Date.now() }
          ]
        })
      }

      ;(server as any).reasoning = mockReasoning
      ;(server as any).rlmEngine = mockRLMEngine
    })

    it('should handle hybrid reasoning requests', async () => {
      const handler = (server as any).handleHybridReasoning.bind(server)
      const result = await handler({ 
        query: 'How to optimize React performance?',
        requiresReasoning: true 
      })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Reasoning Response')
      expect(result.content[0].text).toContain('test-model')
    })

    it('should start RLM reasoning sessions', async () => {
      const handler = (server as any).handleStartRLMSession.bind(server)
      const result = await handler({ 
        query: 'Complex problem solving',
        maxSteps: 5 
      })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('RLM Session Started')
      expect(result.content[0].text).toContain('session-123')
    })
  })

  describe('Common Command Tools', () => {
    beforeEach(async () => {
      const mockCommandHandler = {
        handleCommand: jest.fn().mockResolvedValue({
          success: true,
          output: 'Command executed successfully',
          command: 'git status',
          executionTime: 150
        }),
        getAvailableCommands: jest.fn().mockReturnValue([
          {
            pattern: 'git status',
            description: 'Show git repository status',
            examples: ['git status', 'status']
          }
        ])
      }

      ;(server as any).commandHandler = mockCommandHandler
    })

    it('should execute common commands', async () => {
      const handler = (server as any).handleExecuteCommonCommand.bind(server)
      const result = await handler({ 
        command: 'git status',
        workingDirectory: testProjectDir 
      })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Command executed successfully')
      expect(result.content[0].text).toContain('$0.00') // Zero cost
    })

    it('should list available commands', async () => {
      const handler = (server as any).handleListAvailableCommands.bind(server)
      const result = await handler({})
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Common Commands Available')
    })
  })

  describe('Cost Tracking', () => {
    beforeEach(async () => {
      const mockCostTracker = {
        getMetrics: jest.fn().mockResolvedValue({
          totalRequests: 25,
          localRequests: 20,
          apiRequests: 5,
          totalCost: 0.15,
          localCost: 0.00,
          apiCost: 0.15,
          avgLatency: 1200,
          costSavings: 0.45,
          timeframe: 'day'
        }),
        trackRequest: jest.fn(),
        optimizeUsage: jest.fn().mockResolvedValue({
          recommendations: [
            'Use local models for simple queries',
            'Enable smart caching for documentation'
          ],
          potentialSavings: 0.25
        })
      }

      ;(server as any).costTracker = mockCostTracker
    })

    it('should provide cost metrics', async () => {
      const handler = (server as any).handleGetCostMetrics.bind(server)
      const result = await handler({ timeframe: 'day' })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Cost Metrics')
      expect(result.content[0].text).toContain('$0.15')
      expect(result.content[0].text).toContain('75.0%') // Local request percentage
    })

    it('should provide optimization recommendations', async () => {
      const handler = (server as any).handleOptimizeLocalUsage.bind(server)
      const result = await handler({ analysisDepth: 'detailed' })
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('Usage Optimization Analysis')
      expect(result.content[0].text).toContain('local models')
    })
  })

  describe('System Status', () => {
    it('should provide comprehensive system status', async () => {
      // Mock all system components
      const mockStatus = {
        intelligence: { initialized: true, memoryNodes: 150 },
        reasoning: { sessions: 5, avgResponseTime: 1200 },
        documentation: { installed: 3, cached: 250 },
        commands: { patterns: 45, successRate: 0.95 },
        cost: { dailySavings: 2.50, totalSavings: 15.75 }
      }

      jest.spyOn(server as any, 'getSystemStatus').mockResolvedValue(mockStatus)

      const handler = (server as any).handleGetSystemStatus.bind(server)
      const result = await handler({})
      
      expect(result).toHaveProperty('content')
      expect(result.content[0].text).toContain('LLM-Charge System Status')
    })
  })

  describe('Error Handling', () => {
    it('should handle tool errors gracefully', async () => {
      // Mock a failing component
      const failingIntelligence = {
        buildContextPackage: jest.fn().mockRejectedValue(new Error('Context build failed'))
      }

      ;(server as any).intelligence = failingIntelligence

      const handler = (server as any).handleBuildContextPackage.bind(server)
      const result = await handler({ query: 'test query' })
      
      expect(result).toHaveProperty('isError', true)
      expect(result.content[0].text).toContain('Error executing')
    })

    it('should handle missing parameters', async () => {
      const handler = (server as any).handleSearchCodeSymbols.bind(server)
      const result = await handler({}) // Missing required 'query' parameter
      
      expect(result).toHaveProperty('isError', true)
    })

    it('should handle unknown tools', async () => {
      const mockRequest = {
        params: { 
          name: 'unknown_tool',
          arguments: {}
        }
      }

      try {
        await (server as any).server.requestHandler(mockRequest)
      } catch (error) {
        expect((error as Error).message).toContain('Unknown tool')
      }
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests efficiently', async () => {
      const mockIntelligence = {
        buildContextPackage: jest.fn().mockResolvedValue({
          relevantFiles: [],
          codeSymbols: [],
          semanticMatches: [],
          memoryNodes: [],
          relationships: [],
          estimatedTokens: 100
        })
      }

      ;(server as any).intelligence = mockIntelligence

      const handler = (server as any).handleBuildContextPackage.bind(server)
      
      const startTime = Date.now()
      const promises = Array.from({ length: 10 }, () => 
        handler({ query: 'concurrent test', maxTokens: 1000 })
      )
      
      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime
      
      expect(results).toHaveLength(10)
      expect(results.every(r => r.content && r.content.length > 0)).toBe(true)
      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should maintain performance with large context packages', async () => {
      const largeContextPackage = {
        relevantFiles: Array.from({ length: 100 }, (_, i) => `file${i}.ts`),
        codeSymbols: Array.from({ length: 500 }, (_, i) => ({
          name: `Symbol${i}`,
          kind: 'function',
          file: `file${i % 10}.ts`,
          line: i
        })),
        semanticMatches: Array.from({ length: 50 }, (_, i) => ({
          content: `Semantic match ${i}`,
          similarity: 0.8 - (i * 0.01)
        })),
        memoryNodes: [],
        relationships: [],
        estimatedTokens: 5000
      }

      const mockIntelligence = {
        buildContextPackage: jest.fn().mockResolvedValue(largeContextPackage)
      }

      ;(server as any).intelligence = mockIntelligence

      const handler = (server as any).handleBuildContextPackage.bind(server)
      const startTime = Date.now()
      
      const result = await handler({ query: 'large context test' })
      const executionTime = Date.now() - startTime
      
      expect(result).toHaveProperty('content')
      expect(executionTime).toBeLessThan(2000) // Should handle large contexts efficiently
    })
  })
})