// MCP Client Tools for AI Assistants
// FEATURE: Enhanced MCP client capabilities for Claude, Cursor, and other AI assistants

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { MockMCPClient } from './mock-client'
import { 
  CallToolRequest, 
  ListToolsRequest, 
  ListResourcesRequest,
  ReadResourceRequest,
  Tool,
  Resource,
  TextContent,
  ImageContent
} from '@modelcontextprotocol/sdk/types.js'
import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { CostTracker } from '@/utils/cost-tracker'

export interface MCPClientConfig {
  serverCommand: string
  serverArgs?: string[]
  timeout?: number
  maxRetries?: number
  costTracking?: boolean
  validationLevel?: 'none' | 'basic' | 'strict'
  caching?: {
    enabled: boolean
    ttl: number // seconds
    maxSize: number // items
  }
}

export interface ToolExecutionContext {
  assistant: 'claude' | 'cursor' | 'other'
  sessionId?: string
  userId?: string
  preferences?: {
    preferLocal?: boolean
    maxCost?: number
    timeout?: number
  }
}

export interface ResourceFilter {
  type?: string
  name?: string
  mimeType?: string
  tags?: string[]
  maxSize?: number
}

export interface ToolResult {
  success: boolean
  content: (TextContent | ImageContent)[]
  cost?: number
  executionTime: number
  fromCache?: boolean
  metadata?: Record<string, any>
}

export interface CachedResult {
  result: ToolResult
  timestamp: number
  expires: number
}

export class MCPClientManager extends EventEmitter {
  private clients = new Map<string, Client | MockMCPClient>()
  private processes = new Map<string, ChildProcess>()
  private tools = new Map<string, Tool[]>()
  private resources = new Map<string, Resource[]>()
  private cache = new Map<string, CachedResult>()
  private costTracker?: CostTracker
  private initialized = false

  constructor(private config: MCPClientConfig) {
    super()
    
    if (config.costTracking) {
      this.costTracker = new CostTracker({
        providers: {},
        fallbackStrategy: 'local-first',
        maxCostPerHour: 100,
        trackUsage: true
      })
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    this.emit('initializing')
    this.initialized = true
    this.emit('initialized')
  }

  async connectToServer(serverId: string, config: MCPClientConfig): Promise<void> {
    if (this.clients.has(serverId)) {
      throw new Error(`Server ${serverId} already connected`)
    }

    try {
      // Spawn MCP server process
      const serverProcess = spawn(config.serverCommand, config.serverArgs || [], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.processes.set(serverId, serverProcess)

      // For development/testing, use mock client
      // In production, this would create a real MCP client with stdio transport
      const client = new MockMCPClient()
      this.clients.set(serverId, client)

      // Cache available tools and resources
      await this.refreshServerCapabilities(serverId)

      this.emit('server-connected', serverId)

    } catch (error) {
      this.emit('server-error', serverId, error)
      throw error
    }
  }

  async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId)
    const process = this.processes.get(serverId)

    if (client) {
      await client.close()
      this.clients.delete(serverId)
    }

    if (process) {
      process.kill()
      this.processes.delete(serverId)
    }

    this.tools.delete(serverId)
    this.resources.delete(serverId)
    this.emit('server-disconnected', serverId)
  }

  async listAvailableTools(serverId?: string): Promise<Record<string, Tool[]>> {
    if (serverId) {
      return { [serverId]: this.tools.get(serverId) || [] }
    }

    const allTools: Record<string, Tool[]> = {}
    for (const [id, tools] of this.tools) {
      allTools[id] = tools
    }
    return allTools
  }

  async listAvailableResources(serverId?: string, filter?: ResourceFilter): Promise<Record<string, Resource[]>> {
    if (serverId) {
      const resources = this.resources.get(serverId) || []
      const filtered = filter ? this.filterResources(resources, filter) : resources
      return { [serverId]: filtered }
    }

    const allResources: Record<string, Resource[]> = {}
    for (const [id, resources] of this.resources) {
      const filtered = filter ? this.filterResources(resources, filter) : resources
      allResources[id] = filtered
    }
    return allResources
  }

  async executeTool(
    serverId: string, 
    toolName: string, 
    args: Record<string, any>,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const cacheKey = this.getCacheKey(serverId, toolName, args)
    
    // Check cache first
    if (this.config.caching?.enabled) {
      const cached = this.cache.get(cacheKey)
      if (cached && cached.expires > Date.now()) {
        this.emit('tool-cache-hit', serverId, toolName)
        return { ...cached.result, fromCache: true }
      }
    }

    const client = this.clients.get(serverId)
    if (!client) {
      throw new Error(`Server ${serverId} not connected`)
    }

    // Validate tool exists
    const serverTools = this.tools.get(serverId) || []
    const tool = serverTools.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not available on server ${serverId}`)
    }

    try {
      // Validate arguments if strict validation enabled
      if (this.config.validationLevel === 'strict') {
        this.validateToolArguments(tool, args)
      }

      // Apply context preferences
      const executionArgs = this.applyContextPreferences(args, context)

      // Execute tool
      const result = await client.callTool({
        name: toolName,
        arguments: executionArgs
      })

      const executionTime = Date.now() - startTime

      const toolResult: ToolResult = {
        success: true,
        content: result.content as any,
        executionTime,
        metadata: {
          serverId,
          toolName,
          model: result.model,
          isError: result.isError
        }
      }

      // Track costs if enabled
      if (this.costTracker) {
        const cost = this.estimateToolCost(toolName, executionArgs, executionTime)
        toolResult.cost = cost
        this.costTracker.recordRequest({
          isLocal: true,
          cost,
          tokens: 0, // MCP tools don't use tokens directly
          model: `mcp-${serverId}`,
          latencyMs: executionTime
        })
      }

      // Cache result if enabled
      if (this.config.caching?.enabled) {
        this.cacheResult(cacheKey, toolResult)
      }

      this.emit('tool-executed', serverId, toolName, executionTime)
      return toolResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.emit('tool-error', serverId, toolName, error, executionTime)
      
      return {
        success: false,
        content: [{
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        executionTime
      }
    }
  }

  async readResource(serverId: string, resourceUri: string): Promise<ToolResult> {
    const startTime = Date.now()
    const client = this.clients.get(serverId)
    
    if (!client) {
      throw new Error(`Server ${serverId} not connected`)
    }

    try {
      const result = await client.readResource({
        uri: resourceUri
      })

      const executionTime = Date.now() - startTime

      return {
        success: true,
        content: result.contents as any,
        executionTime,
        metadata: {
          serverId,
          resourceUri,
          mimeType: result.contents[0]?.mimeType
        }
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      return {
        success: false,
        content: [{
          type: 'text',
          text: `Error reading resource ${resourceUri}: ${error instanceof Error ? error.message : String(error)}`
        }],
        executionTime
      }
    }
  }

  async batchExecuteTools(requests: Array<{
    serverId: string
    toolName: string
    args: Record<string, any>
    context?: ToolExecutionContext
  }>): Promise<ToolResult[]> {
    const promises = requests.map(req => 
      this.executeTool(req.serverId, req.toolName, req.args, req.context)
    )

    return Promise.all(promises)
  }

  async findBestToolForTask(task: string, context?: ToolExecutionContext): Promise<{
    serverId: string
    toolName: string
    confidence: number
  } | null> {
    // Simple keyword-based matching - could be enhanced with ML
    const allTools = await this.listAvailableTools()
    let bestMatch: { serverId: string, toolName: string, confidence: number } | null = null

    for (const [serverId, tools] of Object.entries(allTools)) {
      for (const tool of tools) {
        const confidence = this.calculateToolRelevance(task, tool)
        if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = { serverId, toolName: tool.name, confidence }
        }
      }
    }

    return bestMatch
  }

  async optimizeToolSelection(
    availableTools: Array<{ serverId: string, toolName: string }>,
    context?: ToolExecutionContext
  ): Promise<{ serverId: string, toolName: string }[]> {
    // Sort by cost, latency, and success rate
    const toolStats = await this.getToolStatistics()
    
    return availableTools.sort((a, b) => {
      const aStats = toolStats[`${a.serverId}:${a.toolName}`] || {}
      const bStats = toolStats[`${b.serverId}:${b.toolName}`] || {}
      
      const aScore = (aStats.successRate || 0.5) - (aStats.avgCost || 0.1) - (aStats.avgLatency || 1000) / 10000
      const bScore = (bStats.successRate || 0.5) - (bStats.avgCost || 0.1) - (bStats.avgLatency || 1000) / 10000
      
      return bScore - aScore
    })
  }

  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {
      initialized: this.initialized,
      connectedServers: this.clients.size,
      availableTools: 0,
      availableResources: 0,
      cacheSize: this.cache.size,
      uptime: process.uptime()
    }

    for (const tools of this.tools.values()) {
      status.availableTools += tools.length
    }

    for (const resources of this.resources.values()) {
      status.availableResources += resources.length
    }

    return status
  }

  private async refreshServerCapabilities(serverId: string): Promise<void> {
    const client = this.clients.get(serverId)
    if (!client) return

    try {
      // Refresh tools
      const toolsResponse = await client.listTools()
      this.tools.set(serverId, toolsResponse.tools)

      // Refresh resources
      const resourcesResponse = await client.listResources()
      this.resources.set(serverId, resourcesResponse.resources)

    } catch (error) {
      this.emit('refresh-error', serverId, error)
    }
  }

  private filterResources(resources: Resource[], filter: ResourceFilter): Resource[] {
    return resources.filter(resource => {
      if (filter.type && !resource.uri.includes(filter.type)) return false
      if (filter.name && !resource.name?.includes(filter.name)) return false
      if (filter.mimeType && resource.mimeType !== filter.mimeType) return false
      // Additional filtering logic...
      return true
    })
  }

  private validateToolArguments(tool: Tool, args: Record<string, any>): void {
    // Basic JSON schema validation
    const schema = tool.inputSchema
    if (!schema || typeof schema !== 'object') return

    const required = (schema as any).required || []
    for (const field of required) {
      if (!(field in args)) {
        throw new Error(`Required argument '${field}' missing for tool ${tool.name}`)
      }
    }
  }

  private applyContextPreferences(
    args: Record<string, any>, 
    context?: ToolExecutionContext
  ): Record<string, any> {
    if (!context?.preferences) return args

    const enhanced = { ...args }
    
    if (context.preferences.preferLocal !== undefined) {
      enhanced.preferLocal = context.preferences.preferLocal
    }
    
    if (context.preferences.timeout !== undefined) {
      enhanced.timeout = context.preferences.timeout
    }

    return enhanced
  }

  private getCacheKey(serverId: string, toolName: string, args: Record<string, any>): string {
    const argsHash = Buffer.from(JSON.stringify(args)).toString('base64')
    return `${serverId}:${toolName}:${argsHash}`
  }

  private cacheResult(cacheKey: string, result: ToolResult): void {
    if (!this.config.caching?.enabled) return

    const ttl = this.config.caching.ttl * 1000 // convert to ms
    const expires = Date.now() + ttl

    // Evict oldest entries if cache is full
    if (this.cache.size >= (this.config.caching.maxSize || 1000)) {
      const oldestKey = Array.from(this.cache.keys())[0]
      this.cache.delete(oldestKey)
    }

    this.cache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now(),
      expires
    })
  }

  private calculateToolRelevance(task: string, tool: Tool): number {
    // Simple keyword matching - could be enhanced with embeddings
    const taskWords = task.toLowerCase().split(/\s+/)
    const toolText = `${tool.name} ${tool.description || ''}`.toLowerCase()
    
    let matches = 0
    for (const word of taskWords) {
      if (toolText.includes(word)) matches++
    }
    
    return matches / taskWords.length
  }

  private estimateToolCost(toolName: string, args: Record<string, any>, executionTime: number): number {
    // Simple cost model - could be enhanced with actual pricing data
    const baseCost = 0.001 // $0.001 per tool call
    const timeCost = executionTime / 1000 * 0.0001 // $0.0001 per second
    const complexityCost = Object.keys(args).length * 0.0001 // complexity factor
    
    return baseCost + timeCost + complexityCost
  }

  private async getToolStatistics(): Promise<Record<string, any>> {
    // Would integrate with actual metrics storage
    return {}
  }

  async cleanup(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      await this.disconnectFromServer(serverId)
    }
    
    this.cache.clear()
    this.initialized = false
    this.emit('cleanup-complete')
  }
}

export class MCPSkillOrchestrator {
  private clientManager: MCPClientManager
  private activeSkills = new Map<string, any>()
  private skillTemplates = new Map<string, any>()

  constructor(clientManager: MCPClientManager) {
    this.clientManager = clientManager
    this.initializeBuiltInSkills()
  }

  async executeSkill(skillId: string, parameters: Record<string, any>): Promise<ToolResult> {
    const skill = this.skillTemplates.get(skillId)
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`)
    }

    const executionPlan = await this.planSkillExecution(skill, parameters)
    return await this.executeSkillPlan(executionPlan)
  }

  async createCompositeSkill(
    name: string,
    steps: Array<{
      toolName: string
      serverId: string
      args: Record<string, any>
      condition?: string
    }>
  ): Promise<string> {
    const skillId = `composite_${Date.now()}`
    
    this.skillTemplates.set(skillId, {
      name,
      type: 'composite',
      steps,
      created: new Date()
    })

    return skillId
  }

  private initializeBuiltInSkills(): void {
    // Code Analysis Skill
    this.skillTemplates.set('analyze_codebase', {
      name: 'Analyze Codebase',
      description: 'Comprehensive codebase analysis using multiple MCP tools',
      steps: [
        { toolName: 'build_context_package', serverId: 'llm-charge', args: { query: '{query}' }},
        { toolName: 'search_code_symbols', serverId: 'llm-charge', args: { query: '{query}' }},
        { toolName: 'get_context_tree', serverId: 'llm-charge', args: {}}
      ]
    })

    // Documentation Research Skill  
    this.skillTemplates.set('research_api', {
      name: 'Research API Documentation',
      description: 'Find and analyze API documentation',
      steps: [
        { toolName: 'search_developer_docs', serverId: 'llm-charge', args: { query: '{api}' }},
        { toolName: 'quick_doc_lookup', serverId: 'llm-charge', args: { api_or_concept: '{api}' }}
      ]
    })

    // Cost Optimization Skill
    this.skillTemplates.set('optimize_costs', {
      name: 'Optimize Costs',
      description: 'Analyze and optimize LLM usage costs',
      steps: [
        { toolName: 'get_cost_metrics', serverId: 'llm-charge', args: {}},
        { toolName: 'optimize_local_usage', serverId: 'llm-charge', args: { analysisDepth: 'detailed' }}
      ]
    })
  }

  private async planSkillExecution(skill: any, parameters: Record<string, any>): Promise<any> {
    const plan = {
      skillId: skill.name,
      steps: skill.steps.map((step: any) => ({
        ...step,
        args: this.substituteParameters(step.args, parameters)
      }))
    }

    return plan
  }

  private async executeSkillPlan(plan: any): Promise<ToolResult> {
    const results: ToolResult[] = []
    
    for (const step of plan.steps) {
      const result = await this.clientManager.executeTool(
        step.serverId,
        step.toolName, 
        step.args
      )
      results.push(result)
      
      // Stop on first error
      if (!result.success) break
    }

    return this.combineResults(results)
  }

  private substituteParameters(args: Record<string, any>, parameters: Record<string, any>): Record<string, any> {
    const result = { ...args }
    
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
        const paramName = value.slice(1, -1)
        if (paramName in parameters) {
          result[key] = parameters[paramName]
        }
      }
    }

    return result
  }

  private combineResults(results: ToolResult[]): ToolResult {
    const combinedContent = results.flatMap(r => r.content)
    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0)
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0)
    
    return {
      success: results.every(r => r.success),
      content: combinedContent,
      executionTime: totalTime,
      cost: totalCost,
      metadata: {
        stepCount: results.length,
        individualResults: results
      }
    }
  }
}