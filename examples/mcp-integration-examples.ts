// MCP Integration Examples for AI Assistants
// FEATURE: Comprehensive examples showing how to integrate MCP tools with Claude, Cursor, etc.

import { 
  MCPClientManager, 
  MCPSkillOrchestrator, 
  MCPResourceManager, 
  MCPToolValidator, 
  MCPSessionManager 
} from '../src/mcp'

// Example 1: Basic MCP Client Setup for Claude Code
export async function setupClaudeCodeIntegration() {
  console.log('🚀 Setting up MCP integration for Claude Code...')
  
  // Create client manager with Claude-optimized configuration
  const clientManager = new MCPClientManager({
    serverCommand: 'node',
    serverArgs: ['dist/src/mcp/llm-charge-server.js'],
    timeout: 30000,
    maxRetries: 3,
    costTracking: true,
    validationLevel: 'strict',
    caching: {
      enabled: true,
      ttl: 300, // 5 minutes
      maxSize: 1000
    }
  })

  await clientManager.initialize()

  // Connect to LLM-Charge MCP server
  await clientManager.connectToServer('llm-charge', {
    serverCommand: 'node',
    serverArgs: ['dist/src/mcp/llm-charge-server.js', '--project', process.cwd()],
    timeout: 30000
  })

  console.log('✅ Connected to LLM-Charge MCP server')
  
  // List available tools
  const tools = await clientManager.listAvailableTools('llm-charge')
  console.log(`📋 Available tools: ${tools['llm-charge']?.length || 0}`)

  return clientManager
}

// Example 2: Advanced Tool Execution with Context
export async function demonstrateContextualToolExecution() {
  const clientManager = await setupClaudeCodeIntegration()
  
  console.log('\n🔧 Demonstrating contextual tool execution...')

  try {
    // 1. Build comprehensive context for a coding task
    const contextResult = await clientManager.executeTool(
      'llm-charge',
      'build_context_package',
      {
        query: 'authentication system implementation',
        maxTokens: 4000,
        includeMemory: true
      },
      {
        assistant: 'claude',
        sessionId: 'demo-session-1',
        preferences: {
          preferLocal: true,
          maxCost: 0.50,
          timeout: 30000
        }
      }
    )

    console.log('📦 Context package built:', {
      success: contextResult.success,
      executionTime: contextResult.executionTime,
      cost: contextResult.cost,
      fromCache: contextResult.fromCache
    })

    // 2. Search for relevant code symbols
    const symbolResult = await clientManager.executeTool(
      'llm-charge', 
      'search_code_symbols',
      {
        query: 'authentication',
        kind: 'function',
        limit: 10
      },
      {
        assistant: 'claude',
        sessionId: 'demo-session-1'
      }
    )

    console.log('🔍 Symbol search completed:', {
      success: symbolResult.success,
      executionTime: symbolResult.executionTime
    })

    // 3. Execute hybrid reasoning for complex analysis
    const reasoningResult = await clientManager.executeTool(
      'llm-charge',
      'hybrid_reasoning',
      {
        query: 'Analyze the security implications of the current authentication system and suggest improvements',
        complexity: 'complex',
        requiresReasoning: true,
        preferLocal: false, // Use cloud for complex reasoning
        maxSteps: 5,
        contextTokens: 3000
      },
      {
        assistant: 'claude',
        sessionId: 'demo-session-1'
      }
    )

    console.log('🧠 Hybrid reasoning completed:', {
      success: reasoningResult.success,
      executionTime: reasoningResult.executionTime,
      cost: reasoningResult.cost
    })

  } catch (error) {
    console.error('❌ Tool execution error:', error)
  }
}

// Example 3: Skill Orchestration for Complex Workflows
export async function demonstrateSkillOrchestration() {
  const clientManager = await setupClaudeCodeIntegration()
  const skillOrchestrator = new MCPSkillOrchestrator(clientManager)
  
  console.log('\n🎭 Demonstrating skill orchestration...')

  try {
    // Execute built-in codebase analysis skill
    const analysisResult = await skillOrchestrator.executeSkill(
      'analyze_codebase',
      {
        query: 'MCP implementation patterns',
        depth: 'detailed'
      }
    )

    console.log('📊 Codebase analysis skill completed:', {
      success: analysisResult.success,
      totalTime: analysisResult.executionTime,
      totalCost: analysisResult.cost,
      steps: analysisResult.metadata?.stepCount
    })

    // Create a custom composite skill
    const customSkillId = await skillOrchestrator.createCompositeSkill(
      'Security Audit Workflow',
      [
        {
          toolName: 'search_code_symbols',
          serverId: 'llm-charge',
          args: { query: 'password OR secret OR token', kind: 'variable' }
        },
        {
          toolName: 'build_context_package', 
          serverId: 'llm-charge',
          args: { query: 'security vulnerability patterns', maxTokens: 3000 }
        },
        {
          toolName: 'hybrid_reasoning',
          serverId: 'llm-charge',
          args: { 
            query: 'Analyze potential security vulnerabilities in the codebase',
            complexity: 'complex',
            requiresReasoning: true
          }
        }
      ]
    )

    console.log(`🆕 Created custom skill: ${customSkillId}`)

    // Execute the custom skill
    const auditResult = await skillOrchestrator.executeSkill(customSkillId, {})
    
    console.log('🔒 Security audit skill completed:', {
      success: auditResult.success,
      totalTime: auditResult.executionTime,
      findings: auditResult.metadata?.individualResults?.length
    })

  } catch (error) {
    console.error('❌ Skill orchestration error:', error)
  }
}

// Example 4: Resource Management and Discovery
export async function demonstrateResourceManagement() {
  const clientManager = await setupClaudeCodeIntegration()
  
  const resourceManager = new MCPResourceManager(clientManager, {
    autoDiscovery: true,
    discoveryInterval: 30000,
    maxResourcesPerServer: 500,
    cacheResourceList: true,
    enableMetrics: true
  })

  await resourceManager.initialize()
  
  console.log('\n📁 Demonstrating resource management...')

  try {
    // Discover all available resources
    const resourceIndex = await resourceManager.discoverResources()
    console.log('📋 Resource discovery completed:', {
      totalResources: resourceIndex.totalResources,
      serverCount: resourceIndex.serverCount,
      categories: Object.keys(resourceIndex.categories).length
    })

    // Search for specific resources
    const searchResults = await resourceManager.searchResources({
      text: 'documentation',
      mimeType: 'text/markdown',
      sortBy: 'relevance',
      limit: 10
    })

    console.log(`🔍 Found ${searchResults.length} documentation resources`)

    // Access a resource (with caching)
    if (searchResults.length > 0) {
      const resourceResult = await resourceManager.accessResource(
        searchResults[0].uri,
        true // use cache
      )

      console.log('📖 Resource accessed:', {
        success: resourceResult.success,
        fromCache: resourceResult.fromCache,
        cost: resourceResult.cost,
        size: resourceResult.content?.length || 0
      })
    }

    // Get resource statistics and optimization recommendations
    const stats = resourceManager.getResourceStatistics()
    const optimization = await resourceManager.optimizeResourceAccess()

    console.log('📊 Resource statistics:', {
      totalResources: stats.totalResources,
      averageCost: stats.averageCost.toFixed(4),
      recommendations: optimization.recommendations.length,
      potentialSavings: optimization.potentialSavings.toFixed(4)
    })

  } catch (error) {
    console.error('❌ Resource management error:', error)
  }
}

// Example 5: Session Management for Persistent Workflows
export async function demonstrateSessionManagement() {
  const clientManager = await setupClaudeCodeIntegration()
  const resourceManager = new MCPResourceManager(clientManager, {
    autoDiscovery: true,
    discoveryInterval: 60000,
    maxResourcesPerServer: 1000,
    cacheResourceList: true,
    enableMetrics: true
  })

  const toolValidator = new MCPToolValidator({
    maxExecutionTime: 30000,
    maxCostPerCall: 1.00,
    maxCallsPerMinute: 20,
    maxCallsPerHour: 500,
    allowedAssistants: ['claude', 'cursor'],
    requiresApproval: false,
    sandboxed: true
  })

  const sessionManager = new MCPSessionManager(
    clientManager,
    resourceManager,
    toolValidator,
    {
      maxSessions: 100,
      sessionTTL: 3600000, // 1 hour
      snapshotInterval: 300000, // 5 minutes
      maxSnapshotsPerSession: 20
    }
  )

  console.log('\n🔄 Demonstrating session management...')

  try {
    // Create a new session for Claude Code
    const sessionId = await sessionManager.createSession(
      'claude-user-123',
      'claude',
      {
        preferLocal: true,
        maxCostPerTool: 0.25,
        maxCostPerSession: 2.00,
        autoCache: true,
        verboseLogging: true
      }
    )

    console.log(`📝 Created session: ${sessionId}`)

    // Execute multiple tools within the session context
    const tools = [
      { name: 'get_system_status', args: {} },
      { name: 'get_cost_metrics', args: { timeframe: 'hour' } },
      { name: 'search_developer_docs', args: { query: 'TypeScript interfaces' } }
    ]

    for (const tool of tools) {
      const result = await sessionManager.executeToolInSession(
        sessionId,
        'llm-charge',
        tool.name,
        tool.args
      )

      console.log(`⚡ Executed ${tool.name}:`, {
        success: result.success,
        cost: result.cost,
        fromCache: result.fromCache
      })
    }

    // Create session snapshot
    await sessionManager.createSessionSnapshot(sessionId)

    // Get session analytics
    const analytics = sessionManager.getSessionAnalytics()
    console.log('📊 Session analytics:', {
      totalSessions: analytics.totalSessions,
      activeSessions: analytics.activeSessions,
      totalCost: analytics.totalCost.toFixed(4),
      mostUsedTools: analytics.mostUsedTools.slice(0, 3)
    })

    // Export session for backup/analysis
    const sessionExport = await sessionManager.exportSession(sessionId)
    console.log('💾 Session exported:', {
      conversationEntries: sessionExport.session.context.conversationHistory.length,
      snapshots: sessionExport.snapshots.length,
      totalCost: sessionExport.session.metrics.totalCost.toFixed(4)
    })

    // Clean up
    await sessionManager.terminateSession(sessionId)

  } catch (error) {
    console.error('❌ Session management error:', error)
  }
}

// Example 6: Claude Code Specific Integration
export async function claudeCodeSpecificExample() {
  console.log('\n🤖 Claude Code Specific Integration Example...')

  const clientManager = await setupClaudeCodeIntegration()

  try {
    // Simulate Claude Code requesting project analysis
    const projectAnalysis = await clientManager.batchExecuteTools([
      {
        serverId: 'llm-charge',
        toolName: 'get_context_tree',
        args: { maxDepth: 3 },
        context: { assistant: 'claude' }
      },
      {
        serverId: 'llm-charge', 
        toolName: 'search_code_symbols',
        args: { query: 'export', limit: 20 },
        context: { assistant: 'claude' }
      },
      {
        serverId: 'llm-charge',
        toolName: 'get_system_status',
        args: {},
        context: { assistant: 'claude' }
      }
    ])

    console.log('📋 Batch project analysis completed:', {
      toolsExecuted: projectAnalysis.length,
      allSuccessful: projectAnalysis.every(r => r.success),
      totalCost: projectAnalysis.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(4)
    })

    // Find best tool for a specific task
    const bestTool = await clientManager.findBestToolForTask(
      'find functions related to authentication',
      { assistant: 'claude' }
    )

    if (bestTool) {
      console.log('🎯 Best tool recommendation:', {
        tool: bestTool.toolName,
        server: bestTool.serverId,
        confidence: (bestTool.confidence * 100).toFixed(1) + '%'
      })

      // Execute the recommended tool
      const result = await clientManager.executeTool(
        bestTool.serverId,
        bestTool.toolName,
        { query: 'authentication' },
        { assistant: 'claude' }
      )

      console.log('⚡ Recommended tool executed:', {
        success: result.success,
        executionTime: result.executionTime
      })
    }

  } catch (error) {
    console.error('❌ Claude Code integration error:', error)
  }
}

// Example 7: Cursor IDE Integration
export async function cursorIDEIntegrationExample() {
  console.log('\n📝 Cursor IDE Integration Example...')

  const clientManager = new MCPClientManager({
    serverCommand: 'node',
    serverArgs: ['dist/src/mcp/llm-charge-server.js'],
    timeout: 15000, // Shorter timeout for IDE responsiveness
    maxRetries: 2,
    costTracking: true,
    validationLevel: 'basic', // Less strict for IDE usage
    caching: {
      enabled: true,
      ttl: 180, // 3 minutes - shorter for IDE
      maxSize: 500
    }
  })

  await clientManager.initialize()
  await clientManager.connectToServer('llm-charge', {
    serverCommand: 'node',
    serverArgs: ['dist/src/mcp/llm-charge-server.js'],
    timeout: 15000
  })

  try {
    // Simulate Cursor requesting quick code analysis
    const quickAnalysis = await clientManager.executeTool(
      'llm-charge',
      'get_file_skeleton',
      { filePath: './src/mcp/client-tools.ts' },
      { assistant: 'cursor' }
    )

    console.log('🔍 Quick file analysis for Cursor:', {
      success: quickAnalysis.success,
      executionTime: quickAnalysis.executionTime,
      responseSize: quickAnalysis.content[0]?.type === 'text' 
        ? quickAnalysis.content[0].text.length 
        : 0
    })

    // Rapid documentation lookup
    const docLookup = await clientManager.executeTool(
      'llm-charge',
      'quick_doc_lookup',
      { 
        api_or_concept: 'async/await',
        language_or_tool: 'typescript',
        include_examples: true
      },
      { assistant: 'cursor' }
    )

    console.log('📚 Quick documentation lookup:', {
      success: docLookup.success,
      executionTime: docLookup.executionTime,
      fromCache: docLookup.fromCache
    })

  } catch (error) {
    console.error('❌ Cursor IDE integration error:', error)
  }
}

// Main demonstration function
export async function runAllMCPExamples() {
  console.log('🎯 Starting comprehensive MCP integration examples...\n')
  
  try {
    await demonstrateContextualToolExecution()
    await demonstrateSkillOrchestration() 
    await demonstrateResourceManagement()
    await demonstrateSessionManagement()
    await claudeCodeSpecificExample()
    await cursorIDEIntegrationExample()
    
    console.log('\n✅ All MCP integration examples completed successfully!')
    
  } catch (error) {
    console.error('\n❌ MCP examples failed:', error)
  }
}

// Example usage patterns for AI assistants
export const MCPUsagePatterns = {
  
  // Pattern: Quick Analysis (for IDE integration)
  async quickAnalysis(clientManager: MCPClientManager, filePath: string) {
    return await clientManager.executeTool('llm-charge', 'get_file_skeleton', 
      { filePath }, 
      { assistant: 'cursor', preferences: { timeout: 5000 } }
    )
  },

  // Pattern: Deep Reasoning (for complex problems)  
  async deepReasoning(clientManager: MCPClientManager, query: string) {
    return await clientManager.executeTool('llm-charge', 'hybrid_reasoning',
      { query, complexity: 'complex', requiresReasoning: true },
      { assistant: 'claude', preferences: { preferLocal: false } }
    )
  },

  // Pattern: Cost-Optimized Batch (for multiple related queries)
  async costOptimizedBatch(clientManager: MCPClientManager, queries: string[]) {
    const batchRequests = queries.map(query => ({
      serverId: 'llm-charge',
      toolName: 'search_code_symbols', 
      args: { query, limit: 10 },
      context: { assistant: 'claude', preferences: { preferLocal: true } }
    }))
    
    return await clientManager.batchExecuteTools(batchRequests)
  },

  // Pattern: Documentation Research (for learning/reference)
  async documentationResearch(clientManager: MCPClientManager, technology: string) {
    const skillOrchestrator = new MCPSkillOrchestrator(clientManager)
    return await skillOrchestrator.executeSkill('research_api', { api: technology })
  }
}

// Run examples if called directly
if (require.main === module) {
  runAllMCPExamples().catch(console.error)
}