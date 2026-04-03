// MCP Session and Context Management System
// FEATURE: Advanced session management for persistent MCP interactions

import { EventEmitter } from 'events'
import { MCPClientManager, ToolExecutionContext, ToolResult } from './client-tools'
import { MCPResourceManager } from './resource-manager'
import { MCPToolValidator, ValidationContext } from './tool-validator'
import { CostTracker } from '@/utils/cost-tracker'

export interface MCPSession {
  id: string
  userId?: string
  assistant: 'claude' | 'cursor' | 'other'
  createdAt: Date
  lastActivity: Date
  context: SessionContext
  preferences: SessionPreferences
  metrics: SessionMetrics
  state: 'active' | 'paused' | 'expired' | 'terminated'
}

export interface SessionContext {
  projectPath?: string
  workingDirectory?: string
  activeTools: string[]
  recentResources: string[]
  conversationHistory: ConversationEntry[]
  sharedVariables: Record<string, any>
  persistentData: Record<string, any>
}

export interface SessionPreferences {
  preferLocal: boolean
  maxCostPerTool: number
  maxCostPerSession: number
  autoCache: boolean
  verboseLogging: boolean
  timeoutSeconds: number
  maxHistoryEntries: number
}

export interface ConversationEntry {
  timestamp: Date
  toolName: string
  arguments: any
  result: ToolResult
  cost: number
  executionTime: number
}

export interface SessionMetrics {
  totalToolCalls: number
  successfulCalls: number
  failedCalls: number
  totalCost: number
  averageExecutionTime: number
  toolUsageFrequency: Record<string, number>
  resourceAccessCount: number
  cachingEffectiveness: number
}

export interface SessionSnapshot {
  sessionId: string
  timestamp: Date
  context: SessionContext
  metrics: SessionMetrics
  size: number // bytes
}

export class MCPSessionManager extends EventEmitter {
  private sessions = new Map<string, MCPSession>()
  private sessionSnapshots = new Map<string, SessionSnapshot[]>()
  private cleanupTimer?: NodeJS.Timeout
  private costTracker: CostTracker
  
  constructor(
    private clientManager: MCPClientManager,
    private resourceManager: MCPResourceManager,
    private toolValidator: MCPToolValidator,
    private config: {
      maxSessions: number
      sessionTTL: number // milliseconds
      snapshotInterval: number // milliseconds
      maxSnapshotsPerSession: number
    }
  ) {
    super()
    
    this.costTracker = new CostTracker({
      providers: {},
      fallbackStrategy: 'local-first',
      maxCostPerHour: 100,
      trackUsage: true
    })
    this.startCleanupTimer()
  }

  async createSession(
    userId?: string,
    assistant: 'claude' | 'cursor' | 'other' = 'other',
    preferences?: Partial<SessionPreferences>
  ): Promise<string> {
    // Check session limits
    if (this.sessions.size >= this.config.maxSessions) {
      await this.cleanupExpiredSessions()
      
      if (this.sessions.size >= this.config.maxSessions) {
        throw new Error('Maximum number of sessions reached')
      }
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const defaultPreferences: SessionPreferences = {
      preferLocal: true,
      maxCostPerTool: 0.10,
      maxCostPerSession: 5.00,
      autoCache: true,
      verboseLogging: false,
      timeoutSeconds: 300,
      maxHistoryEntries: 100
    }

    const session: MCPSession = {
      id: sessionId,
      userId,
      assistant,
      createdAt: now,
      lastActivity: now,
      context: {
        activeTools: [],
        recentResources: [],
        conversationHistory: [],
        sharedVariables: {},
        persistentData: {}
      },
      preferences: { ...defaultPreferences, ...preferences },
      metrics: {
        totalToolCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalCost: 0,
        averageExecutionTime: 0,
        toolUsageFrequency: {},
        resourceAccessCount: 0,
        cachingEffectiveness: 0
      },
      state: 'active'
    }

    this.sessions.set(sessionId, session)
    this.sessionSnapshots.set(sessionId, [])
    
    this.emit('session-created', sessionId, userId, assistant)
    
    // Create initial snapshot
    await this.createSessionSnapshot(sessionId)
    
    return sessionId
  }

  async executeToolInSession(
    sessionId: string,
    serverId: string,
    toolName: string,
    args: any
  ): Promise<ToolResult> {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (session.state !== 'active') {
      throw new Error(`Session ${sessionId} is not active`)
    }

    const startTime = Date.now()
    
    // Update last activity
    session.lastActivity = new Date()

    // Create validation context
    const validationContext: ValidationContext = {
      toolName,
      serverId,
      userId: session.userId,
      sessionId,
      assistant: session.assistant,
      previousCalls: session.metrics.totalToolCalls,
      currentCost: session.metrics.totalCost
    }

    // Validate tool execution
    const availableTools = await this.clientManager.listAvailableTools(serverId)
    const tool = availableTools[serverId]?.find(t => t.name === toolName)
    
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`)
    }

    const validation = await this.toolValidator.validateToolCall(tool, args, validationContext)
    if (!validation.valid) {
      const errorMsg = validation.errors.map(e => e.message).join('; ')
      throw new Error(`Validation failed: ${errorMsg}`)
    }

    // Check session cost limits
    const estimatedCost = validation.cost || 0
    if (session.metrics.totalCost + estimatedCost > session.preferences.maxCostPerSession) {
      throw new Error(`Session cost limit exceeded (${session.metrics.totalCost + estimatedCost} > ${session.preferences.maxCostPerSession})`)
    }

    // Create execution context
    const executionContext: ToolExecutionContext = {
      assistant: session.assistant,
      sessionId,
      userId: session.userId,
      preferences: {
        preferLocal: session.preferences.preferLocal,
        maxCost: session.preferences.maxCostPerTool,
        timeout: session.preferences.timeoutSeconds * 1000
      }
    }

    try {
      // Execute tool
      const result = await this.clientManager.executeTool(serverId, toolName, args, executionContext)
      const executionTime = Date.now() - startTime
      const cost = result.cost || estimatedCost

      // Update session context and metrics
      this.updateSessionAfterExecution(session, toolName, args, result, cost, executionTime)

      // Record in conversation history
      const conversationEntry: ConversationEntry = {
        timestamp: new Date(),
        toolName,
        arguments: args,
        result,
        cost,
        executionTime
      }

      session.context.conversationHistory.push(conversationEntry)
      
      // Maintain history size limit
      if (session.context.conversationHistory.length > session.preferences.maxHistoryEntries) {
        session.context.conversationHistory.shift()
      }

      // Track costs
      this.costTracker.recordRequest({
        isLocal: true,
        cost,
        tokens: 0,
        model: `mcp-${serverId}-${toolName}`,
        latencyMs: executionTime
      })

      this.emit('tool-executed-in-session', sessionId, toolName, result)
      
      return result

    } catch (error) {
      session.metrics.failedCalls++
      this.emit('tool-execution-error', sessionId, toolName, error)
      throw error
    }
  }

  async accessResourceInSession(
    sessionId: string,
    resourceUri: string
  ): Promise<any> {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.lastActivity = new Date()

    const result = await this.resourceManager.accessResource(
      resourceUri,
      session.preferences.autoCache
    )

    // Update session metrics
    session.metrics.resourceAccessCount++
    session.context.recentResources.push(resourceUri)

    // Maintain recent resources list
    if (session.context.recentResources.length > 20) {
      session.context.recentResources.shift()
    }

    this.emit('resource-accessed-in-session', sessionId, resourceUri)
    
    return result
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.state = 'paused'
      session.lastActivity = new Date()
      this.emit('session-paused', sessionId)
    }
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.state = 'active'
      session.lastActivity = new Date()
      this.emit('session-resumed', sessionId)
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      // Create final snapshot
      await this.createSessionSnapshot(sessionId)
      
      session.state = 'terminated'
      this.emit('session-terminated', sessionId)
      
      // Remove from active sessions after delay
      setTimeout(() => {
        this.sessions.delete(sessionId)
      }, 60000) // 1 minute delay for cleanup
    }
  }

  getSession(sessionId: string): MCPSession | null {
    return this.sessions.get(sessionId) || null
  }

  getUserSessions(userId: string): MCPSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId)
  }

  getActiveSessionsCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.state === 'active').length
  }

  async createSessionSnapshot(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const snapshot: SessionSnapshot = {
      sessionId,
      timestamp: new Date(),
      context: JSON.parse(JSON.stringify(session.context)), // Deep copy
      metrics: { ...session.metrics },
      size: JSON.stringify(session).length
    }

    let snapshots = this.sessionSnapshots.get(sessionId) || []
    snapshots.push(snapshot)

    // Maintain snapshot limit
    if (snapshots.length > this.config.maxSnapshotsPerSession) {
      snapshots = snapshots.slice(-this.config.maxSnapshotsPerSession)
    }

    this.sessionSnapshots.set(sessionId, snapshots)
    this.emit('snapshot-created', sessionId, snapshot)
  }

  async restoreSessionFromSnapshot(
    sessionId: string,
    snapshotIndex: number = -1 // -1 for latest
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    const snapshots = this.sessionSnapshots.get(sessionId)
    
    if (!session || !snapshots || snapshots.length === 0) {
      throw new Error(`No snapshots available for session ${sessionId}`)
    }

    const snapshot = snapshotIndex === -1 
      ? snapshots[snapshots.length - 1]
      : snapshots[snapshotIndex]

    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotIndex} not found`)
    }

    // Restore context
    session.context = JSON.parse(JSON.stringify(snapshot.context))
    session.lastActivity = new Date()

    this.emit('session-restored', sessionId, snapshot.timestamp)
  }

  getSessionAnalytics(): {
    totalSessions: number
    activeSessions: number
    averageSessionDuration: number
    totalCost: number
    mostUsedTools: Array<{ name: string, usage: number }>
    costDistribution: Record<string, number>
  } {
    const sessions = Array.from(this.sessions.values())
    const now = Date.now()
    
    const activeSessions = sessions.filter(s => s.state === 'active').length
    
    const averageSessionDuration = sessions.reduce((sum, session) => {
      const duration = session.lastActivity.getTime() - session.createdAt.getTime()
      return sum + duration
    }, 0) / sessions.length

    const totalCost = sessions.reduce((sum, session) => sum + session.metrics.totalCost, 0)

    // Aggregate tool usage
    const toolUsage = new Map<string, number>()
    for (const session of sessions) {
      for (const [tool, count] of Object.entries(session.metrics.toolUsageFrequency)) {
        toolUsage.set(tool, (toolUsage.get(tool) || 0) + count)
      }
    }

    const mostUsedTools = Array.from(toolUsage.entries())
      .map(([name, usage]) => ({ name, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10)

    // Cost distribution by assistant
    const costDistribution: Record<string, number> = {}
    for (const session of sessions) {
      const key = session.assistant
      costDistribution[key] = (costDistribution[key] || 0) + session.metrics.totalCost
    }

    return {
      totalSessions: sessions.length,
      activeSessions,
      averageSessionDuration,
      totalCost,
      mostUsedTools,
      costDistribution
    }
  }

  async exportSession(sessionId: string): Promise<{
    session: MCPSession
    snapshots: SessionSnapshot[]
    exportedAt: Date
  }> {
    const session = this.sessions.get(sessionId)
    const snapshots = this.sessionSnapshots.get(sessionId) || []

    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    return {
      session: JSON.parse(JSON.stringify(session)), // Deep copy
      snapshots: JSON.parse(JSON.stringify(snapshots)),
      exportedAt: new Date()
    }
  }

  async importSession(sessionData: {
    session: MCPSession
    snapshots: SessionSnapshot[]
  }): Promise<string> {
    const sessionId = sessionData.session.id
    
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    this.sessions.set(sessionId, sessionData.session)
    this.sessionSnapshots.set(sessionId, sessionData.snapshots)

    this.emit('session-imported', sessionId)
    return sessionId
  }

  private updateSessionAfterExecution(
    session: MCPSession,
    toolName: string,
    args: any,
    result: ToolResult,
    cost: number,
    executionTime: number
  ): void {
    // Update metrics
    session.metrics.totalToolCalls++
    if (result.success) {
      session.metrics.successfulCalls++
    } else {
      session.metrics.failedCalls++
    }
    
    session.metrics.totalCost += cost
    session.metrics.averageExecutionTime = (
      session.metrics.averageExecutionTime * (session.metrics.totalToolCalls - 1) + executionTime
    ) / session.metrics.totalToolCalls

    // Update tool usage frequency
    session.metrics.toolUsageFrequency[toolName] = (session.metrics.toolUsageFrequency[toolName] || 0) + 1

    // Track active tools
    if (!session.context.activeTools.includes(toolName)) {
      session.context.activeTools.push(toolName)
    }

    // Update caching effectiveness
    if (result.fromCache) {
      session.metrics.cachingEffectiveness = (session.metrics.cachingEffectiveness + 1) / 2
    } else {
      session.metrics.cachingEffectiveness = session.metrics.cachingEffectiveness * 0.9
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 60000) // Check every minute
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now()
    const expiredSessions: string[] = []

    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastActivity = now - session.lastActivity.getTime()
      
      if (timeSinceLastActivity > this.config.sessionTTL) {
        session.state = 'expired'
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      await this.terminateSession(sessionId)
    }

    if (expiredSessions.length > 0) {
      this.emit('sessions-cleaned-up', expiredSessions.length)
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    for (const sessionId of this.sessions.keys()) {
      await this.terminateSession(sessionId)
    }

    this.sessions.clear()
    this.sessionSnapshots.clear()
    this.emit('cleanup-complete')
  }
}