// MCP Integration Export Module
// FEATURE: Centralized exports for all MCP tools and capabilities

export * from './client-tools'
export * from './resource-manager'
export * from './tool-validator'
export * from './session-manager'
export * from './llm-charge-server'

// Re-export commonly used types from SDK
export type {
  Tool,
  Resource,
  CallToolRequest,
  CallToolResult,
  TextContent,
  ImageContent
} from '@modelcontextprotocol/sdk/types.js'

// Convenience factory functions
import { 
  MCPClientManager,
  MCPSkillOrchestrator,
  MCPResourceManager,
  MCPToolValidator,
  MCPSessionManager
} from '.'

export interface MCPFactoryConfig {
  serverCommand?: string
  serverArgs?: string[]
  projectPath?: string
  costTracking?: boolean
  sessionManagement?: boolean
  validation?: {
    enabled: boolean
    level: 'none' | 'basic' | 'strict'
    maxCostPerCall?: number
    maxCallsPerMinute?: number
  }
  caching?: {
    enabled: boolean
    ttl?: number
    maxSize?: number
  }
  resources?: {
    autoDiscovery: boolean
    discoveryInterval?: number
  }
}

export class MCPFactory {
  static async createFullStack(config: MCPFactoryConfig = {}) {
    // Create client manager
    const clientManager = new MCPClientManager({
      serverCommand: config.serverCommand || 'node',
      serverArgs: config.serverArgs || ['dist/src/mcp/llm-charge-server.js'],
      timeout: 30000,
      maxRetries: 3,
      costTracking: config.costTracking ?? true,
      validationLevel: config.validation?.level || 'basic',
      caching: {
        enabled: config.caching?.enabled ?? true,
        ttl: config.caching?.ttl ?? 300,
        maxSize: config.caching?.maxSize ?? 1000
      }
    })

    await clientManager.initialize()

    // Connect to LLM-Charge server
    await clientManager.connectToServer('llm-charge', {
      serverCommand: config.serverCommand || 'node',
      serverArgs: [
        ...(config.serverArgs || ['dist/src/mcp/llm-charge-server.js']),
        ...(config.projectPath ? ['--project', config.projectPath] : [])
      ]
    })

    // Create resource manager
    const resourceManager = new MCPResourceManager(clientManager, {
      autoDiscovery: config.resources?.autoDiscovery ?? true,
      discoveryInterval: config.resources?.discoveryInterval ?? 60000,
      maxResourcesPerServer: 1000,
      cacheResourceList: true,
      enableMetrics: true
    })

    await resourceManager.initialize()

    // Create tool validator
    const toolValidator = new MCPToolValidator({
      maxExecutionTime: 30000,
      maxCostPerCall: config.validation?.maxCostPerCall ?? 1.00,
      maxCallsPerMinute: config.validation?.maxCallsPerMinute ?? 30,
      maxCallsPerHour: 1000,
      allowedAssistants: ['claude', 'cursor', 'other'],
      requiresApproval: false,
      sandboxed: true
    })

    // Create skill orchestrator
    const skillOrchestrator = new MCPSkillOrchestrator(clientManager)

    let sessionManager: MCPSessionManager | undefined

    // Create session manager if enabled
    if (config.sessionManagement !== false) {
      sessionManager = new MCPSessionManager(
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
    }

    return {
      clientManager,
      resourceManager,
      toolValidator,
      skillOrchestrator,
      sessionManager
    }
  }

  static async createMinimal(serverCommand?: string, serverArgs?: string[]) {
    const clientManager = new MCPClientManager({
      serverCommand: serverCommand || 'node',
      serverArgs: serverArgs || ['dist/src/mcp/llm-charge-server.js'],
      timeout: 15000,
      maxRetries: 2,
      costTracking: false,
      validationLevel: 'none',
      caching: { enabled: true, ttl: 180, maxSize: 100 }
    })

    await clientManager.initialize()
    await clientManager.connectToServer('llm-charge', {
      serverCommand: serverCommand || 'node',
      serverArgs: serverArgs || ['dist/src/mcp/llm-charge-server.js']
    })

    return { clientManager }
  }

  static async createForClaude(projectPath?: string) {
    return this.createFullStack({
      projectPath,
      costTracking: true,
      validation: {
        enabled: true,
        level: 'strict',
        maxCostPerCall: 0.50,
        maxCallsPerMinute: 25
      },
      caching: {
        enabled: true,
        ttl: 300,
        maxSize: 1000
      }
    })
  }

  static async createForCursor(projectPath?: string) {
    return this.createFullStack({
      projectPath,
      costTracking: true,
      validation: {
        enabled: true,
        level: 'basic',
        maxCostPerCall: 0.25,
        maxCallsPerMinute: 40
      },
      caching: {
        enabled: true,
        ttl: 180, // Shorter for IDE
        maxSize: 500
      },
      resources: {
        autoDiscovery: true,
        discoveryInterval: 120000 // Less frequent for performance
      }
    })
  }
}