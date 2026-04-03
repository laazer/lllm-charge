// Enhanced LLM-Charge Server with Full MCP Integration
// Combines the working server functionality with comprehensive MCP tools

import { IndependentDatabaseManager } from './independent-database-manager.mjs'
import http from 'http'
import path from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { WebSocket, WebSocketServer } from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class EnhancedMCPServer {
  constructor(port = 3001) {
    this.port = port
    this.dbManager = new IndependentDatabaseManager()
    this.server = null
    this.wss = null
    this.clients = new Set()
    
    // Enhanced MCP Tools Registry
    this.mcpTools = this.createComprehensiveMCPTools()
    this.mcpResources = this.createMCPResources()
  }

  createComprehensiveMCPTools() {
    return {
      // === CODE INTELLIGENCE & ANALYSIS ===
      build_context_package: {
        name: 'build_context_package',
        description: 'Build context-aware package with intelligent code analysis and semantic understanding',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Context query or task description' },
            includeTests: { type: 'boolean', description: 'Include test files in analysis' },
            maxFiles: { type: 'number', description: 'Maximum files to include (default: 50)' }
          },
          required: ['query']
        },
        implementation: async (args) => {
          const { query, includeTests = false, maxFiles = 50 } = args
          return {
            contextPackage: {
              query,
              relevantFiles: await this.analyzeCodebase(query, includeTests, maxFiles),
              symbols: await this.extractSymbols(query),
              dependencies: await this.analyzeDependencies(query),
              recommendations: await this.generateRecommendations(query)
            }
          }
        }
      },

      search_code_symbols: {
        name: 'search_code_symbols',
        description: 'Search for code symbols across the codebase using structural and semantic analysis',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for code symbols' },
            kind: { type: 'string', description: 'Filter by symbol kind (function, class, method, etc.)' },
            limit: { type: 'number', description: 'Maximum results to return (default: 20)' }
          },
          required: ['query']
        },
        implementation: async (args) => {
          const { query, kind, limit = 20 } = args
          return {
            symbols: await this.searchSymbols(query, kind, limit),
            totalFound: await this.countSymbols(query, kind),
            searchTime: Date.now()
          }
        }
      },

      get_context_tree: {
        name: 'get_context_tree',
        description: 'Get hierarchical view of project structure with symbol information',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Specific path to focus on (optional)' },
            maxDepth: { type: 'number', description: 'Maximum depth to traverse (default: 3)' }
          }
        },
        implementation: async (args) => {
          const { path = '.', maxDepth = 3 } = args
          return {
            tree: await this.buildContextTree(path, maxDepth),
            metadata: {
              totalFiles: await this.countFiles(path),
              totalSymbols: await this.countSymbolsInPath(path),
              languages: await this.detectLanguages(path)
            }
          }
        }
      },

      get_blast_radius: {
        name: 'get_blast_radius',
        description: 'Find all files and symbols that would be affected by changes to a symbol',
        inputSchema: {
          type: 'object',
          properties: {
            symbolId: { type: 'string', description: 'ID of the symbol to analyze' },
            depth: { type: 'number', description: 'Analysis depth (default: 2)' }
          },
          required: ['symbolId']
        },
        implementation: async (args) => {
          const { symbolId, depth = 2 } = args
          return {
            affectedFiles: await this.analyzeBlastRadius(symbolId, depth),
            riskLevel: await this.assessChangeRisk(symbolId),
            recommendations: await this.getChangeRecommendations(symbolId)
          }
        }
      },

      // === DEVDOCS INTEGRATION ===
      search_developer_docs: {
        name: 'search_developer_docs',
        description: 'Search through cached developer documentation for specific technologies',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            language: { type: 'string', description: 'Programming language or technology' },
            limit: { type: 'number', description: 'Maximum results (default: 10)' }
          },
          required: ['query']
        },
        implementation: async (args) => {
          const { query, language, limit = 10 } = args
          return {
            results: await this.searchDevDocs(query, language, limit),
            availableLanguages: await this.getAvailableDocLanguages()
          }
        }
      },

      install_developer_docs: {
        name: 'install_developer_docs',
        description: 'Download and cache developer documentation for offline use',
        inputSchema: {
          type: 'object',
          properties: {
            languages: { type: 'array', items: { type: 'string' }, description: 'List of languages/technologies to install' },
            force: { type: 'boolean', description: 'Force reinstall if already exists' }
          },
          required: ['languages']
        },
        implementation: async (args) => {
          const { languages, force = false } = args
          return {
            installed: await this.installDevDocs(languages, force),
            totalSize: await this.calculateDocsSize(languages),
            installTime: Date.now()
          }
        }
      },

      // === HYBRID REASONING & COST OPTIMIZATION ===
      hybrid_reasoning: {
        name: 'hybrid_reasoning',
        description: 'Execute complex reasoning tasks with cost optimization and quality assurance',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Reasoning task description' },
            complexity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task complexity level' },
            costLimit: { type: 'number', description: 'Maximum cost in USD (default: 0.50)' },
            qualityThreshold: { type: 'number', description: 'Minimum quality score 0-1 (default: 0.8)' }
          },
          required: ['task']
        },
        implementation: async (args) => {
          const { task, complexity = 'medium', costLimit = 0.50, qualityThreshold = 0.8 } = args
          return {
            result: await this.executeHybridReasoning(task, complexity, costLimit, qualityThreshold),
            actualCost: await this.getLastReasoningCost(),
            qualityScore: await this.getLastQualityScore(),
            modelUsed: await this.getSelectedModel()
          }
        }
      },

      get_cost_metrics: {
        name: 'get_cost_metrics',
        description: 'Get detailed cost tracking metrics and optimization recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            timeframe: { type: 'string', enum: ['hour', 'day', 'week', 'month'], description: 'Timeframe for metrics' }
          }
        },
        implementation: async (args) => {
          const { timeframe = 'day' } = args
          return {
            metrics: await this.getCostMetrics(timeframe),
            savings: await this.calculateSavings(timeframe),
            recommendations: await this.getOptimizationRecommendations()
          }
        }
      },

      optimize_local_usage: {
        name: 'optimize_local_usage',
        description: 'Analyze usage patterns and optimize local LLM routing for maximum cost savings',
        inputSchema: {
          type: 'object',
          properties: {
            targetSavings: { type: 'number', description: 'Target savings percentage (default: 75)' },
            qualityThreshold: { type: 'number', description: 'Minimum quality to maintain (default: 0.8)' }
          }
        },
        implementation: async (args) => {
          const { targetSavings = 75, qualityThreshold = 0.8 } = args
          return {
            optimizationPlan: await this.createOptimizationPlan(targetSavings, qualityThreshold),
            estimatedSavings: await this.calculatePotentialSavings(targetSavings),
            recommendations: await this.getRoutingRecommendations()
          }
        }
      },

      // === MEMORY & CONTEXT MANAGEMENT ===
      update_memory: {
        name: 'update_memory',
        description: 'Update semantic memory with new information and create connections',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to add to memory' },
            type: { type: 'string', enum: ['fact', 'code', 'pattern', 'solution'], description: 'Type of memory' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' }
          },
          required: ['content', 'type']
        },
        implementation: async (args) => {
          const { content, type, tags = [] } = args
          return {
            memoryId: await this.updateMemory(content, type, tags),
            connections: await this.findRelatedMemories(content),
            confidence: await this.calculateMemoryConfidence(content)
          }
        }
      },

      search_memory: {
        name: 'search_memory',
        description: 'Search semantic memory with advanced similarity matching',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            type: { type: 'string', enum: ['fact', 'code', 'pattern', 'solution'], description: 'Filter by memory type' },
            limit: { type: 'number', description: 'Maximum results (default: 10)' },
            threshold: { type: 'number', description: 'Similarity threshold 0-1 (default: 0.7)' }
          },
          required: ['query']
        },
        implementation: async (args) => {
          const { query, type, limit = 10, threshold = 0.7 } = args
          return {
            results: await this.searchMemory(query, type, limit, threshold),
            relatedConcepts: await this.getRelatedConcepts(query),
            searchStats: await this.getSearchStats(query)
          }
        }
      },

      // === SYSTEM STATUS & MONITORING ===
      get_system_status: {
        name: 'get_system_status',
        description: 'Get comprehensive system status including all components and health metrics',
        inputSchema: {
          type: 'object',
          properties: {
            includeMetrics: { type: 'boolean', description: 'Include performance metrics (default: true)' }
          }
        },
        implementation: async (args) => {
          const { includeMetrics = true } = args
          return {
            status: await this.getSystemStatus(includeMetrics),
            databases: await this.getDatabaseStatus(),
            llmProviders: await this.getLLMProviderStatus(),
            performance: includeMetrics ? await this.getPerformanceMetrics() : null
          }
        }
      },

      // === WORKFLOW & SPEC MANAGEMENT (EXISTING) ===
      create_workflow: {
        name: 'create_workflow',
        description: 'Create a new workflow with nodes and connections',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Workflow name' },
            description: { type: 'string', description: 'Workflow description' },
            nodes: { type: 'array', description: 'Array of workflow nodes' },
            connections: { type: 'array', description: 'Array of node connections' }
          },
          required: ['name']
        },
        implementation: async (args) => {
          const workflow = await this.dbManager.createWorkflow(args)
          return { workflow }
        }
      },

      create_spec: {
        name: 'create_spec',
        description: 'Create a new specification document',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Specification title' },
            description: { type: 'string', description: 'Specification description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
          },
          required: ['title', 'description']
        },
        implementation: async (args) => {
          const spec = await this.dbManager.createSpec(args)
          return { spec }
        }
      }
    }
  }

  createMCPResources() {
    return [
      {
        uri: 'workflow://list',
        name: 'Workflows',
        description: 'List of all workflows',
        mimeType: 'application/json'
      },
      {
        uri: 'spec://list',
        name: 'Specifications',
        description: 'List of all specifications',
        mimeType: 'application/json'
      },
      {
        uri: 'agent://list',
        name: 'Agents',
        description: 'List of all agents',
        mimeType: 'application/json'
      },
      {
        uri: 'codegraph://status',
        name: 'CodeGraph Status',
        description: 'CodeGraph analysis status and statistics',
        mimeType: 'application/json'
      },
      {
        uri: 'devdocs://available',
        name: 'Available Documentation',
        description: 'List of available developer documentation',
        mimeType: 'application/json'
      },
      {
        uri: 'memory://recent',
        name: 'Recent Memory',
        description: 'Recently updated memory entries',
        mimeType: 'application/json'
      },
      {
        uri: 'cost://metrics',
        name: 'Cost Metrics',
        description: 'Real-time cost tracking and optimization metrics',
        mimeType: 'application/json'
      }
    ]
  }

  async start() {
    try {
      // Initialize database manager first
      await this.dbManager.initialize()
      
      console.log('🚀 Starting Enhanced MCP Server with comprehensive toolset...')
      
      // Start HTTP server
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res)
      })

      // Start WebSocket server
      this.wss = new WebSocketServer({ server: this.server })
      this.setupWebSocketHandlers()

      // Start server
      this.server.listen(this.port, () => {
        console.log(`✅ Enhanced MCP Server running on port ${this.port}`)
        console.log(`   🔗 HTTP: http://localhost:${this.port}`)
        console.log(`   🌐 WebSocket: ws://localhost:${this.port}`)
        console.log(`   🛠️  MCP Tools: ${Object.keys(this.mcpTools).length} available`)
        console.log(`   📊 MCP Resources: ${this.mcpResources.length} available`)
        this.logAvailableTools()
      })

    } catch (error) {
      console.error('❌ Failed to start Enhanced MCP Server:', error)
      throw error
    }
  }

  logAvailableTools() {
    console.log('\n🛠️  Available MCP Tools:')
    console.log('   === CODE INTELLIGENCE ===')
    console.log('   • build_context_package - Context-aware code analysis')
    console.log('   • search_code_symbols - Symbol search with semantic understanding')
    console.log('   • get_context_tree - Hierarchical project structure')
    console.log('   • get_blast_radius - Impact analysis for changes')
    
    console.log('\n   === DOCUMENTATION ===')
    console.log('   • search_developer_docs - DevDocs offline search')
    console.log('   • install_developer_docs - Download documentation')
    
    console.log('\n   === HYBRID REASONING ===')
    console.log('   • hybrid_reasoning - Cost-optimized reasoning')
    console.log('   • get_cost_metrics - Real-time cost tracking')
    console.log('   • optimize_local_usage - LLM routing optimization')
    
    console.log('\n   === MEMORY & CONTEXT ===')
    console.log('   • update_memory - Semantic memory management')
    console.log('   • search_memory - Advanced similarity search')
    
    console.log('\n   === WORKFLOW & SPECS ===')
    console.log('   • create_workflow - Visual workflow creation')
    console.log('   • create_spec - Specification management')
    console.log('   • get_system_status - Comprehensive system health\n')
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`)
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    try {
      // MCP Tools endpoint
      if (url.pathname === '/mcp/tools') {
        const tools = Object.values(this.mcpTools).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ tools }))
        return
      }

      // MCP Resources endpoint  
      if (url.pathname === '/mcp/resources') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ resources: this.mcpResources }))
        return
      }

      // MCP Tool call endpoint
      if (url.pathname.startsWith('/mcp/call/')) {
        const toolName = url.pathname.split('/mcp/call/')[1]
        const tool = this.mcpTools[toolName]
        
        if (!tool) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Tool '${toolName}' not found` }))
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk.toString())
          req.on('end', async () => {
            try {
              const args = JSON.parse(body)
              const result = await tool.implementation(args)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(result))
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: error.message }))
            }
          })
          return
        }
      }

      // Delegate to database manager for other endpoints
      await this.dbManager.handleRequest(req, res)
      
    } catch (error) {
      console.error('Request handling error:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('📱 Client connected to Enhanced MCP Server')
      this.clients.add(ws)

      ws.on('close', () => {
        console.log('📱 Client disconnected from Enhanced MCP Server')
        this.clients.delete(ws)
      })

      // Send initial metrics
      this.sendMetrics(ws)
    })

    // Broadcast metrics every 3 seconds
    setInterval(() => {
      this.broadcastMetrics()
    }, 3000)
  }

  async sendMetrics(ws) {
    try {
      const metrics = await this.getEnhancedMetrics()
      ws.send(JSON.stringify({
        type: 'metrics_update',
        data: metrics
      }))
    } catch (error) {
      console.error('Error sending metrics:', error)
    }
  }

  async broadcastMetrics() {
    if (this.clients.size > 0) {
      try {
        const metrics = await this.getEnhancedMetrics()
        const message = JSON.stringify({
          type: 'metrics',
          data: metrics
        })

        this.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message)
          }
        })
      } catch (error) {
        console.error('Error broadcasting metrics:', error)
      }
    }
  }

  async getEnhancedMetrics() {
    return {
      timestamp: new Date().toISOString(),
      mcpTools: Object.keys(this.mcpTools).length,
      mcpResources: this.mcpResources.length,
      databaseStatus: await this.getDatabaseStatus(),
      systemStatus: 'operational',
      // Add database counts
      ...(await this.dbManager.getBasicMetrics())
    }
  }

  // Placeholder implementations for advanced MCP tools
  // These would be implemented with actual functionality in production

  async analyzeCodebase(query, includeTests, maxFiles) {
    // Implementation for code analysis would go here
    return { analyzed: true, query, includeTests, maxFiles }
  }

  async searchSymbols(query, kind, limit) {
    // Implementation for symbol search would go here
    return { symbols: [], query, kind, limit }
  }

  async getDatabaseStatus() {
    return {
      main: 'connected',
      agents: 'connected', 
      flows: 'connected'
    }
  }

  async getLLMProviderStatus() {
    return {
      ollama: 'available',
      lmStudio: 'not_configured'
    }
  }

  async getPerformanceMetrics() {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
  }

  // Add more placeholder implementations as needed...
  async searchDevDocs() { return { results: [] } }
  async installDevDocs() { return { installed: [] } }
  async executeHybridReasoning() { return { result: 'placeholder' } }
  async getCostMetrics() { return { totalCost: 0 } }
  async updateMemory() { return { memoryId: 'mem_' + Date.now() } }
  async searchMemory() { return { results: [] } }
  async getSystemStatus() { return { status: 'operational' } }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EnhancedMCPServer()
  await server.start()
}