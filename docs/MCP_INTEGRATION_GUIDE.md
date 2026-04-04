# MCP Integration Guide for AI Assistants

This guide provides comprehensive instructions for integrating LLM-Charge's Model Context Protocol (MCP) capabilities with AI assistants like Claude Code, Cursor IDE, and other development tools.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Core Components](#core-components)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Overview

LLM-Charge provides a comprehensive MCP implementation that enables AI assistants to:

- **Execute intelligent tools** for code analysis, reasoning, and documentation
- **Manage resources** with automatic discovery and optimization
- **Maintain session context** across multiple interactions
- **Validate and secure** tool executions with cost controls
- **Orchestrate complex workflows** through skill composition

### Key Benefits

- 🚀 **60-80% cost reduction** through intelligent hybrid routing
- ⚡ **Sub-second response times** for common operations
- 🔒 **Enterprise-grade security** with validation and sandboxing  
- 📊 **Real-time cost tracking** and optimization recommendations
- 🎯 **AI assistant optimization** with caching and batching

## Quick Start

### 1. Installation

```bash
npm install @llm-charge/mcp-tools
# or
git clone https://github.com/your-org/lllm-charge.git
cd lllm-charge && npm install
```

### 2. Basic Setup

```typescript
import { MCPClientManager } from '@llm-charge/mcp-tools'

// Create MCP client for Claude Code
const client = new MCPClientManager({
  serverCommand: 'node',
  serverArgs: ['dist/src/mcp/llm-charge-server.js'],
  costTracking: true,
  caching: { enabled: true, ttl: 300 }
})

await client.initialize()
await client.connectToServer('llm-charge', {
  serverCommand: 'node',
  serverArgs: ['dist/src/mcp/llm-charge-server.js', '--project', process.cwd()]
})
```

### 3. Execute Your First Tool

```typescript
// Build context for a coding task
const result = await client.executeTool(
  'llm-charge',
  'build_context_package', 
  {
    query: 'authentication system implementation',
    maxTokens: 4000
  },
  {
    assistant: 'claude',
    preferences: { preferLocal: true, maxCost: 0.50 }
  }
)

console.log('Context built:', result.success, `$${result.cost}`)
```

## Core Components

### MCPClientManager

Central hub for managing MCP server connections and tool execution.

**Key Features:**
- Multi-server connection management
- Automatic retry and error handling
- Cost tracking and optimization
- Result caching with TTL
- Batch execution capabilities

**Usage:**
```typescript
const client = new MCPClientManager({
  timeout: 30000,
  maxRetries: 3,
  validationLevel: 'strict',
  caching: { enabled: true, ttl: 300, maxSize: 1000 }
})

// Connect to multiple servers
await client.connectToServer('llm-charge', config)
await client.connectToServer('codegraph', codegraphConfig)

// Execute tools with context
const result = await client.executeTool(serverId, toolName, args, context)
```

### MCPResourceManager

Intelligent resource discovery and management system.

**Key Features:**
- Automatic resource discovery
- Semantic search capabilities  
- Cost-aware resource access
- Caching and optimization
- Usage analytics

**Usage:**
```typescript
const resourceManager = new MCPResourceManager(client, {
  autoDiscovery: true,
  cacheResourceList: true,
  enableMetrics: true
})

// Discover and search resources
const index = await resourceManager.discoverResources()
const results = await resourceManager.searchResources({
  text: 'authentication',
  sortBy: 'relevance',
  limit: 10
})

// Access resources with caching
const content = await resourceManager.accessResource(resourceUri, true)
```

### MCPSessionManager

Persistent session management for complex workflows.

**Key Features:**
- Multi-user session support
- Conversation history tracking
- Cost and usage monitoring
- Session snapshots and restore
- Analytics and reporting

**Usage:**
```typescript
const sessionManager = new MCPSessionManager(
  clientManager,
  resourceManager, 
  toolValidator,
  { maxSessions: 100, sessionTTL: 3600000 }
)

// Create and manage sessions
const sessionId = await sessionManager.createSession('user-123', 'claude')
const result = await sessionManager.executeToolInSession(
  sessionId, 'llm-charge', 'search_code_symbols', { query: 'auth' }
)
```

### MCPSkillOrchestrator

Compose complex workflows from multiple MCP tools.

**Key Features:**
- Built-in skill templates
- Custom skill composition
- Conditional execution flows
- Result aggregation
- Performance optimization

**Usage:**
```typescript
const orchestrator = new MCPSkillOrchestrator(clientManager)

// Execute built-in skills
await orchestrator.executeSkill('analyze_codebase', { query: 'MCP patterns' })

// Create custom composite skills
const skillId = await orchestrator.createCompositeSkill(
  'Security Audit',
  [
    { toolName: 'search_code_symbols', args: { query: 'password' }},
    { toolName: 'hybrid_reasoning', args: { query: 'security analysis' }}
  ]
)
```

## Integration Examples

### Claude Code Integration

```typescript
// Optimized for Claude Code's workflow
const claudeClient = new MCPClientManager({
  serverCommand: 'node',
  serverArgs: ['dist/src/mcp/llm-charge-server.js'],
  timeout: 30000,
  validationLevel: 'strict',
  caching: { enabled: true, ttl: 300, maxSize: 1000 }
})

// Project analysis workflow
async function analyzeProject() {
  const results = await claudeClient.batchExecuteTools([
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
    }
  ])

  return results
}

// Smart tool recommendation
const bestTool = await claudeClient.findBestToolForTask(
  'find authentication functions',
  { assistant: 'claude' }
)
```

### Cursor IDE Integration

```typescript
// Optimized for IDE responsiveness
const cursorClient = new MCPClientManager({
  timeout: 15000, // Shorter for IDE
  validationLevel: 'basic',
  caching: { ttl: 180, maxSize: 500 } // Shorter TTL
})

// Quick file analysis
async function quickAnalyze(filePath: string) {
  return await cursorClient.executeTool(
    'llm-charge',
    'get_file_skeleton',
    { filePath },
    { 
      assistant: 'cursor',
      preferences: { timeout: 5000 } // Fast response
    }
  )
}

// Rapid documentation lookup
async function quickDocLookup(concept: string, language: string) {
  return await cursorClient.executeTool(
    'llm-charge',
    'quick_doc_lookup',
    { api_or_concept: concept, language_or_tool: language },
    { assistant: 'cursor' }
  )
}
```

### Custom AI Assistant Integration

```typescript
// Generic integration template
class CustomAssistantMCP {
  private client: MCPClientManager
  private session: MCPSessionManager

  async initialize(assistantType: string) {
    this.client = new MCPClientManager({
      // Configure for your assistant's needs
      timeout: 20000,
      costTracking: true,
      validationLevel: 'basic'
    })

    await this.client.connectToServer('llm-charge', serverConfig)
    
    this.session = new MCPSessionManager(
      this.client, resourceManager, toolValidator, sessionConfig
    )
  }

  async executeWithContext(toolName: string, args: any, userId?: string) {
    // Create or reuse session
    let sessionId = this.getOrCreateSession(userId)
    
    // Execute with full context
    return await this.session.executeToolInSession(
      sessionId, 'llm-charge', toolName, args
    )
  }

  async optimizeForAssistant() {
    // Get recommendations specific to your assistant
    const recommendations = await this.client.optimizeToolSelection(
      await this.client.listAvailableTools(),
      { assistant: 'custom' }
    )
    
    return recommendations
  }
}
```

## Available MCP Tools

### Intelligence & Analysis Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `build_context_package` | Comprehensive context building | Project analysis, code understanding |
| `search_code_symbols` | Structural code search | Finding functions, classes, methods |
| `get_context_tree` | Hierarchical project view | Architecture analysis |
| `get_file_skeleton` | Function signatures only | Quick file overview |
| `get_blast_radius` | Impact analysis | Change assessment |
| `semantic_navigate` | Semantic code browsing | Code exploration |

### Reasoning & Processing Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `hybrid_reasoning` | Intelligent local/cloud routing | Complex problem solving |
| `start_rlm_session` | Recursive reasoning | Multi-step analysis |
| `get_reasoning_session` | Session status | Progress tracking |

### Memory & Learning Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `update_memory` | Knowledge graph updates | Learning from interactions |
| `create_memory_relation` | Link knowledge nodes | Building understanding |
| `search_memory` | Semantic memory search | Context retrieval |

### Cost & Performance Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `get_cost_metrics` | Detailed cost analysis | Budget monitoring |
| `optimize_local_usage` | Usage optimization | Cost reduction |
| `get_system_status` | System health check | Monitoring |

### Documentation Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `search_developer_docs` | Semantic doc search | API reference |
| `install_developer_docs` | Doc installation | Offline access |
| `quick_doc_lookup` | Fast API lookup | Quick reference |

### Utility Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `execute_common_command` | Zero-cost commands | Basic operations |
| `list_available_commands` | Command reference | Discovery |

## Best Practices

### Performance Optimization

1. **Use Caching Strategically**
   ```typescript
   // Enable caching for repeated queries
   const client = new MCPClientManager({
     caching: {
       enabled: true,
       ttl: 300, // 5 minutes for development
       maxSize: 1000
     }
   })
   ```

2. **Batch Related Operations**
   ```typescript
   // More efficient than individual calls
   const results = await client.batchExecuteTools([
     { serverId: 'llm-charge', toolName: 'tool1', args: {} },
     { serverId: 'llm-charge', toolName: 'tool2', args: {} }
   ])
   ```

3. **Choose Appropriate Timeouts**
   ```typescript
   // IDE integration - fast response
   { timeout: 5000 }
   
   // Complex analysis - allow more time  
   { timeout: 30000 }
   ```

### Cost Management

1. **Set Cost Limits**
   ```typescript
   const context = {
     preferences: {
       maxCost: 0.25, // Per tool call
       preferLocal: true // Use local models when possible
     }
   }
   ```

2. **Monitor Usage**
   ```typescript
   // Track costs across sessions
   const analytics = sessionManager.getSessionAnalytics()
   console.log(`Total cost: $${analytics.totalCost}`)
   ```

3. **Use Local-First Strategy**
   ```typescript
   // Prefer local models for common tasks
   const result = await client.executeTool(
     'llm-charge',
     'search_code_symbols',
     args,
     { preferences: { preferLocal: true } }
   )
   ```

### Security Considerations

1. **Input Validation**
   ```typescript
   const validator = new MCPToolValidator({
     maxCostPerCall: 1.00,
     maxCallsPerMinute: 20,
     allowedAssistants: ['claude', 'cursor'],
     sandboxed: true
   })
   ```

2. **Session Management**
   ```typescript
   // Use user-specific sessions
   const sessionId = await sessionManager.createSession(
     userId, // Unique user identifier
     'claude',
     { maxCostPerSession: 5.00 }
   )
   ```

3. **Rate Limiting**
   ```typescript
   // Built-in rate limiting
   const policy = {
     maxCallsPerMinute: 20,
     maxCallsPerHour: 500
   }
   ```

### Error Handling

```typescript
try {
  const result = await client.executeTool(serverId, toolName, args)
  
  if (!result.success) {
    console.log('Tool execution failed:', result.content[0]?.text)
    // Handle gracefully
  }
  
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000))
  } else {
    // Log and fallback
    console.error('MCP error:', error)
  }
}
```

## Troubleshooting

### Common Issues

**Connection Failures**
```typescript
// Check server status
const status = await client.executeTool('llm-charge', 'get_system_status', {})
console.log('Server status:', status)

// Verify server command
const healthCheck = client.getHealthStatus()
console.log('Client health:', healthCheck)
```

**High Costs**
```typescript
// Monitor cost metrics  
const metrics = await client.executeTool(
  'llm-charge', 'get_cost_metrics', { timeframe: 'hour' }
)

// Get optimization recommendations
const optimization = await client.executeTool(
  'llm-charge', 'optimize_local_usage', { analysisDepth: 'detailed' }
)
```

**Performance Issues**
```typescript
// Check tool execution times
client.on('tool-executed', (serverId, toolName, executionTime) => {
  if (executionTime > 10000) {
    console.warn(`Slow tool execution: ${toolName} took ${executionTime}ms`)
  }
})

// Monitor cache effectiveness
const cacheStats = client.getCacheStatistics()
console.log('Cache hit rate:', cacheStats.hitRate)
```

### Debug Mode

```typescript
// Enable verbose logging
const client = new MCPClientManager({
  debug: true,
  logLevel: 'verbose'
})

// Monitor all events
client.on('tool-executed', (serverId, toolName, time) => {
  console.log(`✅ ${toolName} completed in ${time}ms`)
})

client.on('tool-error', (serverId, toolName, error) => {
  console.error(`❌ ${toolName} failed:`, error)
})
```

## API Reference

### MCPClientManager API

```typescript
interface MCPClientManager {
  // Connection Management
  connectToServer(serverId: string, config: MCPClientConfig): Promise<void>
  disconnectFromServer(serverId: string): Promise<void>
  
  // Tool Execution  
  executeTool(serverId: string, toolName: string, args: any, context?: ToolExecutionContext): Promise<ToolResult>
  batchExecuteTools(requests: ToolRequest[]): Promise<ToolResult[]>
  
  // Discovery
  listAvailableTools(serverId?: string): Promise<Record<string, Tool[]>>
  findBestToolForTask(task: string, context?: ToolExecutionContext): Promise<ToolRecommendation | null>
  
  // Resource Management
  listAvailableResources(serverId?: string, filter?: ResourceFilter): Promise<Record<string, Resource[]>>
  readResource(serverId: string, resourceUri: string): Promise<ToolResult>
  
  // Optimization
  optimizeToolSelection(tools: ToolReference[], context?: ToolExecutionContext): Promise<ToolReference[]>
  
  // Status & Health
  getHealthStatus(): Record<string, any>
  cleanup(): Promise<void>
}
```

### Core Types

```typescript
interface ToolExecutionContext {
  assistant: 'claude' | 'cursor' | 'other'
  sessionId?: string
  userId?: string
  preferences?: {
    preferLocal?: boolean
    maxCost?: number
    timeout?: number
  }
}

interface ToolResult {
  success: boolean
  content: (TextContent | ImageContent)[]
  cost?: number
  executionTime: number
  fromCache?: boolean
  metadata?: Record<string, any>
}

interface MCPClientConfig {
  serverCommand: string
  serverArgs?: string[]
  timeout?: number
  maxRetries?: number
  costTracking?: boolean
  validationLevel?: 'none' | 'basic' | 'strict'
  caching?: {
    enabled: boolean
    ttl: number
    maxSize: number
  }
}
```

## Support and Community

- **GitHub Issues**: [Report bugs and request features](https://github.com/your-org/lllm-charge/issues)
- **Documentation**: [Full API documentation](https://docs.llm-charge.com)
- **Examples**: [Integration examples repository](https://github.com/your-org/lllm-charge-examples)
- **Discord**: [Join our community](https://discord.gg/llm-charge) (coming soon)

---

**Built with ❤️ for the AI development community**

*This guide covers LLM-Charge v1.0. For the latest features and updates, visit our [documentation site](https://docs.llm-charge.com).*