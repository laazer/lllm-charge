import { EventEmitter } from 'events'
import { z } from 'zod'

export const TaskComplexitySchema = z.object({
  level: z.enum(['simple', 'moderate', 'complex', 'expert']),
  factors: z.object({
    codeAnalysis: z.boolean().default(false),
    multiStep: z.boolean().default(false),
    domainExpertise: z.boolean().default(false),
    creative: z.boolean().default(false),
    reasoning: z.boolean().default(false),
    largeContext: z.boolean().default(false)
  }),
  estimatedTokens: z.number(),
  estimatedTime: z.number() // milliseconds
})

export type TaskComplexity = z.infer<typeof TaskComplexitySchema>

export const ModelCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['local', 'openai', 'anthropic', 'google', 'hybrid']),
  type: z.enum(['chat', 'completion', 'embedding', 'code', 'reasoning']),
  capabilities: z.object({
    maxTokens: z.number(),
    contextLength: z.number(),
    codeUnderstanding: z.number().min(0).max(10),
    reasoning: z.number().min(0).max(10),
    creativity: z.number().min(0).max(10),
    speed: z.number().min(0).max(10),
    accuracy: z.number().min(0).max(10),
    costEfficiency: z.number().min(0).max(10)
  }),
  pricing: z.object({
    inputTokenCost: z.number(), // per 1k tokens
    outputTokenCost: z.number(), // per 1k tokens
    requestCost: z.number().default(0) // per request
  }),
  availability: z.object({
    local: z.boolean().default(false),
    cloud: z.boolean().default(true),
    latency: z.number(), // average ms
    uptime: z.number().min(0).max(1) // 0-1 score
  }),
  specializations: z.array(z.enum(['code', 'math', 'writing', 'analysis', 'planning', 'debugging'])).default([])
})

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>

export const RoutingDecisionSchema = z.object({
  selectedModel: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  expectedCost: z.number(),
  expectedLatency: z.number(),
  fallbacks: z.array(z.string()),
  mcpIntegration: z.object({
    useClaudeCode: z.boolean().default(false),
    useCursor: z.boolean().default(false),
    tools: z.array(z.string()).default([])
  }).optional()
})

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>

export const McpIntegrationSchema = z.object({
  claudeCode: z.object({
    available: z.boolean().default(false),
    capabilities: z.array(z.string()).default([]),
    costMultiplier: z.number().default(1.5) // MCP calls are more expensive
  }),
  cursor: z.object({
    available: z.boolean().default(false),
    capabilities: z.array(z.string()).default([]),
    costMultiplier: z.number().default(1.3)
  }),
  tools: z.record(z.object({
    description: z.string(),
    costPerUse: z.number(),
    complexity: z.enum(['simple', 'moderate', 'complex'])
  })).default({})
})

export type McpIntegration = z.infer<typeof McpIntegrationSchema>

export class BetterModelRouter extends EventEmitter {
  private models = new Map<string, ModelCapability>()
  private mcpIntegration: McpIntegration
  private usageHistory: Array<{
    task: string
    complexity: TaskComplexity
    model: string
    success: boolean
    actualCost: number
    actualLatency: number
    timestamp: Date
  }> = []

  constructor() {
    super()
    this.mcpIntegration = {
      claudeCode: { available: false, capabilities: [], costMultiplier: 1.5 },
      cursor: { available: false, capabilities: [], costMultiplier: 1.3 },
      tools: {}
    }
    this.initializeDefaultModels()
  }

  private initializeDefaultModels(): void {
    // Local Models
    this.registerModel({
      id: 'ollama-codellama',
      name: 'Code Llama (Ollama)',
      provider: 'local',
      type: 'code',
      capabilities: {
        maxTokens: 4096,
        contextLength: 16384,
        codeUnderstanding: 8,
        reasoning: 6,
        creativity: 5,
        speed: 7,
        accuracy: 7,
        costEfficiency: 10
      },
      pricing: {
        inputTokenCost: 0,
        outputTokenCost: 0,
        requestCost: 0
      },
      availability: {
        local: true,
        cloud: false,
        latency: 2000,
        uptime: 0.95
      },
      specializations: ['code', 'debugging']
    })

    this.registerModel({
      id: 'ollama-mistral',
      name: 'Mistral (Ollama)',
      provider: 'local',
      type: 'chat',
      capabilities: {
        maxTokens: 8192,
        contextLength: 32768,
        codeUnderstanding: 6,
        reasoning: 7,
        creativity: 7,
        speed: 6,
        accuracy: 7,
        costEfficiency: 10
      },
      pricing: {
        inputTokenCost: 0,
        outputTokenCost: 0
      },
      availability: {
        local: true,
        cloud: false,
        latency: 3000,
        uptime: 0.95
      },
      specializations: ['writing', 'analysis']
    })

    // Cloud Models
    this.registerModel({
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      type: 'chat',
      capabilities: {
        maxTokens: 8192,
        contextLength: 200000,
        codeUnderstanding: 9,
        reasoning: 9,
        creativity: 8,
        speed: 8,
        accuracy: 9,
        costEfficiency: 6
      },
      pricing: {
        inputTokenCost: 0.003,
        outputTokenCost: 0.015
      },
      availability: {
        local: false,
        cloud: true,
        latency: 1500,
        uptime: 0.99
      },
      specializations: ['code', 'reasoning', 'analysis', 'writing']
    })

    this.registerModel({
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      type: 'chat',
      capabilities: {
        maxTokens: 4096,
        contextLength: 128000,
        codeUnderstanding: 8,
        reasoning: 9,
        creativity: 9,
        speed: 7,
        accuracy: 9,
        costEfficiency: 5
      },
      pricing: {
        inputTokenCost: 0.01,
        outputTokenCost: 0.03
      },
      availability: {
        local: false,
        cloud: true,
        latency: 2000,
        uptime: 0.98
      },
      specializations: ['reasoning', 'creativity', 'planning']
    })

    // Hybrid/Specialized
    this.registerModel({
      id: 'local-with-claude-fallback',
      name: 'Local + Claude Fallback',
      provider: 'hybrid',
      type: 'chat',
      capabilities: {
        maxTokens: 8192,
        contextLength: 32768,
        codeUnderstanding: 8,
        reasoning: 8,
        creativity: 7,
        speed: 8,
        accuracy: 8,
        costEfficiency: 8
      },
      pricing: {
        inputTokenCost: 0.001, // Average between local (0) and cloud
        outputTokenCost: 0.005
      },
      availability: {
        local: true,
        cloud: true,
        latency: 2500,
        uptime: 0.97
      },
      specializations: ['code', 'analysis']
    })
  }

  registerModel(model: ModelCapability): void {
    this.models.set(model.id, model)
    this.emit('model:registered', model)
  }

  async detectMcpCapabilities(): Promise<void> {
    // Check for Claude Code availability
    try {
      // This would be actual MCP detection logic
      const claudeCodeAvailable = await this.checkClaudeCodeAvailability()
      this.mcpIntegration.claudeCode.available = claudeCodeAvailable
      if (claudeCodeAvailable) {
        this.mcpIntegration.claudeCode.capabilities = [
          'file_operations', 'git_integration', 'terminal_access', 
          'code_analysis', 'project_navigation'
        ]
      }
    } catch (error) {
      this.mcpIntegration.claudeCode.available = false
    }

    // Check for Cursor availability
    try {
      const cursorAvailable = await this.checkCursorAvailability()
      this.mcpIntegration.cursor.available = cursorAvailable
      if (cursorAvailable) {
        this.mcpIntegration.cursor.capabilities = [
          'code_completion', 'refactoring', 'code_navigation',
          'symbol_search', 'quick_fixes'
        ]
      }
    } catch (error) {
      this.mcpIntegration.cursor.available = false
    }

    this.emit('mcp:capabilities-detected', this.mcpIntegration)
  }

  analyzeTaskComplexity(task: string, context?: any): TaskComplexity {
    const factors = {
      codeAnalysis: this.containsCodeKeywords(task),
      multiStep: this.isMultiStepTask(task),
      domainExpertise: this.requiresDomainExpertise(task),
      creative: this.isCreativeTask(task),
      reasoning: this.requiresReasoning(task),
      largeContext: context?.fileCount > 10 || context?.codebaseSize > 100000
    }

    const complexityScore = Object.values(factors).filter(Boolean).length
    let level: TaskComplexity['level']
    
    if (complexityScore <= 1) level = 'simple'
    else if (complexityScore <= 3) level = 'moderate'
    else if (complexityScore <= 5) level = 'complex'
    else level = 'expert'

    const estimatedTokens = this.estimateTokenRequirement(task, factors, context)
    const estimatedTime = this.estimateExecutionTime(level, factors)

    return { level, factors, estimatedTokens, estimatedTime }
  }

  async routeRequest(
    task: string, 
    context?: any,
    preferences?: {
      maxCost?: number
      maxLatency?: number
      preferLocal?: boolean
      requireMcp?: boolean
    }
  ): Promise<RoutingDecision> {
    const complexity = this.analyzeTaskComplexity(task, context)
    const candidates = this.findSuitableModels(complexity, preferences)
    
    // Score each candidate
    const scoredCandidates = candidates.map(model => ({
      model,
      score: this.scoreModel(model, complexity, preferences)
    })).sort((a, b) => b.score - a.score)

    if (scoredCandidates.length === 0) {
      throw new Error('No suitable models available for this task')
    }

    const selectedModel = scoredCandidates[0].model
    const fallbacks = scoredCandidates.slice(1, 3).map(c => c.model.id)
    
    // Determine MCP integration needs
    const mcpIntegration = this.determineMcpIntegration(task, complexity, selectedModel)
    
    const decision: RoutingDecision = {
      selectedModel: selectedModel.id,
      reason: this.generateReason(selectedModel, complexity, preferences),
      confidence: this.calculateConfidence(scoredCandidates[0].score, complexity),
      expectedCost: this.calculateExpectedCost(selectedModel, complexity, mcpIntegration),
      expectedLatency: this.calculateExpectedLatency(selectedModel, complexity, mcpIntegration),
      fallbacks,
      mcpIntegration
    }

    this.emit('routing:decision', { task, complexity, decision })
    return decision
  }

  async executeWithFallback(
    task: string,
    decision: RoutingDecision,
    context?: any
  ): Promise<{
    result: any
    actualModel: string
    cost: number
    latency: number
    success: boolean
  }> {
    const startTime = Date.now()
    const currentModel = decision.selectedModel
    const modelsToTry = [decision.selectedModel, ...decision.fallbacks]

    for (const modelId of modelsToTry) {
      try {
        const model = this.models.get(modelId)
        if (!model) continue

        this.emit('execution:started', { task, model: modelId })

        const result = await this.executeTask(task, model, decision.mcpIntegration, context)
        const latency = Date.now() - startTime
        const cost = this.calculateActualCost(model, result, decision.mcpIntegration)

        // Record successful execution
        this.recordUsage({
          task,
          complexity: this.analyzeTaskComplexity(task, context),
          model: modelId,
          success: true,
          actualCost: cost,
          actualLatency: latency,
          timestamp: new Date()
        })

        this.emit('execution:completed', { task, model: modelId, result, cost, latency })

        return {
          result,
          actualModel: modelId,
          cost,
          latency,
          success: true
        }
      } catch (error) {
        this.emit('execution:failed', { task, model: modelId, error })
        
        // Record failed execution
        this.recordUsage({
          task,
          complexity: this.analyzeTaskComplexity(task, context),
          model: modelId,
          success: false,
          actualCost: 0,
          actualLatency: Date.now() - startTime,
          timestamp: new Date()
        })

        // Continue to next model
        continue
      }
    }

    throw new Error('All models failed to execute the task')
  }

  getModelRecommendations(taskType: string): {
    recommended: ModelCapability[]
    reasons: string[]
  } {
    const allModels = Array.from(this.models.values())
    
    // Filter based on task type
    let suitableModels = allModels.filter(model => {
      switch (taskType) {
        case 'code':
          return model.specializations.includes('code') || model.type === 'code'
        case 'reasoning':
          return model.capabilities.reasoning >= 7
        case 'creative':
          return model.capabilities.creativity >= 7
        case 'analysis':
          return model.specializations.includes('analysis')
        default:
          return true
      }
    })

    // Sort by overall capability score
    suitableModels = suitableModels.sort((a, b) => {
      const scoreA = this.calculateOverallScore(a)
      const scoreB = this.calculateOverallScore(b)
      return scoreB - scoreA
    })

    const reasons = suitableModels.slice(0, 3).map(model => 
      `${model.name}: ${this.getModelStrengths(model).join(', ')}`
    )

    return {
      recommended: suitableModels.slice(0, 3),
      reasons
    }
  }

  getUsageAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): {
    totalRequests: number
    successRate: number
    averageCost: number
    averageLatency: number
    modelUsage: Record<string, number>
    costSavings: number
  } {
    const cutoff = new Date()
    switch (timeframe) {
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1)
        break
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7)
        break
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1)
        break
    }

    const recentUsage = this.usageHistory.filter(u => u.timestamp >= cutoff)
    const totalRequests = recentUsage.length
    const successfulRequests = recentUsage.filter(u => u.success)
    const successRate = totalRequests > 0 ? successfulRequests.length / totalRequests : 0

    const totalCost = recentUsage.reduce((sum, u) => sum + u.actualCost, 0)
    const totalLatency = recentUsage.reduce((sum, u) => sum + u.actualLatency, 0)
    
    const averageCost = totalRequests > 0 ? totalCost / totalRequests : 0
    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0

    const modelUsage: Record<string, number> = {}
    recentUsage.forEach(usage => {
      modelUsage[usage.model] = (modelUsage[usage.model] || 0) + 1
    })

    // Calculate cost savings compared to always using most expensive cloud model
    const expensiveCloudModel = Array.from(this.models.values())
      .filter(m => m.provider !== 'local')
      .sort((a, b) => b.pricing.inputTokenCost - a.pricing.inputTokenCost)[0]
    
    const potentialCost = recentUsage.reduce((sum, usage) => {
      return sum + (expensiveCloudModel?.pricing.inputTokenCost || 0) * (usage.complexity.estimatedTokens / 1000)
    }, 0)
    
    const costSavings = potentialCost - totalCost

    return {
      totalRequests,
      successRate,
      averageCost,
      averageLatency,
      modelUsage,
      costSavings
    }
  }

  // Private helper methods
  private findSuitableModels(
    complexity: TaskComplexity, 
    preferences?: any
  ): ModelCapability[] {
    let candidates = Array.from(this.models.values())

    // Filter by availability
    candidates = candidates.filter(model => {
      if (preferences?.preferLocal && model.availability.local) return true
      if (!preferences?.preferLocal && model.availability.cloud) return true
      return model.availability.local || model.availability.cloud
    })

    // Filter by capability requirements
    candidates = candidates.filter(model => {
      if (complexity.factors.codeAnalysis && model.capabilities.codeUnderstanding < 6) return false
      if (complexity.factors.reasoning && model.capabilities.reasoning < 7) return false
      if (complexity.factors.creative && model.capabilities.creativity < 6) return false
      if (complexity.factors.largeContext && model.capabilities.contextLength < complexity.estimatedTokens) return false
      return true
    })

    return candidates
  }

  private scoreModel(
    model: ModelCapability, 
    complexity: TaskComplexity, 
    preferences?: any
  ): number {
    let score = 0

    // Capability scoring
    if (complexity.factors.codeAnalysis) {
      score += model.capabilities.codeUnderstanding * 2
    }
    if (complexity.factors.reasoning) {
      score += model.capabilities.reasoning * 2
    }
    if (complexity.factors.creative) {
      score += model.capabilities.creativity * 1.5
    }
    
    // Speed and accuracy always matter
    score += model.capabilities.speed
    score += model.capabilities.accuracy * 1.5

    // Cost efficiency (more important for simple tasks)
    const costWeight = complexity.level === 'simple' ? 2 : 1
    score += model.capabilities.costEfficiency * costWeight

    // Preference adjustments
    if (preferences?.preferLocal && model.availability.local) {
      score += 10
    }
    if (preferences?.maxCost && this.calculateExpectedCost(model, complexity) > preferences.maxCost) {
      score -= 20
    }
    if (preferences?.maxLatency && model.availability.latency > preferences.maxLatency) {
      score -= 10
    }

    // Specialization bonus
    const relevantSpecializations = this.getRelevantSpecializations(complexity)
    const matchingSpecs = model.specializations.filter(spec => 
      relevantSpecializations.includes(spec)
    ).length
    score += matchingSpecs * 3

    return Math.max(0, score)
  }

  private determineMcpIntegration(
    task: string, 
    complexity: TaskComplexity, 
    model: ModelCapability
  ): RoutingDecision['mcpIntegration'] {
    const needsFileOperations = task.toLowerCase().includes('file') || 
                               task.toLowerCase().includes('read') ||
                               task.toLowerCase().includes('write')
    const needsGitOperations = task.toLowerCase().includes('git') ||
                              task.toLowerCase().includes('commit') ||
                              task.toLowerCase().includes('branch')
    const needsCodeAnalysis = complexity.factors.codeAnalysis

    const integration: RoutingDecision['mcpIntegration'] = {
      useClaudeCode: false,
      useCursor: false,
      tools: []
    }

    // Decide on Claude Code integration
    if (this.mcpIntegration.claudeCode.available && 
        (needsFileOperations || needsGitOperations || needsCodeAnalysis)) {
      integration!.useClaudeCode = true
      if (needsFileOperations) integration!.tools.push('file_operations')
      if (needsGitOperations) integration!.tools.push('git_integration')
      if (needsCodeAnalysis) integration!.tools.push('code_analysis')
    }

    // Decide on Cursor integration
    if (this.mcpIntegration.cursor.available && 
        (complexity.factors.codeAnalysis || task.toLowerCase().includes('refactor'))) {
      integration!.useCursor = true
      integration!.tools.push('code_completion', 'refactoring')
    }

    return integration
  }

  private async checkClaudeCodeAvailability(): Promise<boolean> {
    // Mock implementation - would actually check MCP connection
    return Math.random() > 0.3 // 70% chance of being available
  }

  private async checkCursorAvailability(): Promise<boolean> {
    // Mock implementation - would actually check MCP connection
    return Math.random() > 0.5 // 50% chance of being available
  }

  private containsCodeKeywords(task: string): boolean {
    const codeKeywords = ['code', 'function', 'class', 'method', 'variable', 'debug', 'refactor', 'implement', 'api']
    return codeKeywords.some(keyword => task.toLowerCase().includes(keyword))
  }

  private isMultiStepTask(task: string): boolean {
    const multiStepIndicators = ['then', 'after', 'next', 'also', 'and', 'steps', 'process', 'workflow']
    return multiStepIndicators.some(indicator => task.toLowerCase().includes(indicator)) ||
           task.split(/[.!?]/).length > 2
  }

  private requiresDomainExpertise(task: string): boolean {
    const domainKeywords = ['security', 'performance', 'architecture', 'algorithm', 'optimization', 'best practices']
    return domainKeywords.some(keyword => task.toLowerCase().includes(keyword))
  }

  private isCreativeTask(task: string): boolean {
    const creativeKeywords = ['create', 'design', 'generate', 'invent', 'brainstorm', 'innovative', 'creative']
    return creativeKeywords.some(keyword => task.toLowerCase().includes(keyword))
  }

  private requiresReasoning(task: string): boolean {
    const reasoningKeywords = ['analyze', 'compare', 'evaluate', 'decide', 'recommend', 'explain', 'why', 'how']
    return reasoningKeywords.some(keyword => task.toLowerCase().includes(keyword))
  }

  private estimateTokenRequirement(task: string, factors: any, context?: any): number {
    let baseTokens = task.length * 0.3 // Rough token estimation
    
    if (factors.codeAnalysis) baseTokens *= 2
    if (factors.multiStep) baseTokens *= 1.5
    if (factors.largeContext) baseTokens += (context?.codebaseSize || 0) * 0.001
    
    return Math.ceil(baseTokens)
  }

  private estimateExecutionTime(level: TaskComplexity['level'], factors: any): number {
    const baseTimes = { simple: 5000, moderate: 15000, complex: 45000, expert: 120000 }
    let time = baseTimes[level]
    
    if (factors.multiStep) time *= 1.3
    if (factors.reasoning) time *= 1.2
    if (factors.largeContext) time *= 1.4
    
    return time
  }

  private calculateExpectedCost(
    model: ModelCapability, 
    complexity: TaskComplexity, 
    mcpIntegration?: RoutingDecision['mcpIntegration']
  ): number {
    let cost = (complexity.estimatedTokens / 1000) * model.pricing.inputTokenCost
    cost += (complexity.estimatedTokens * 0.5 / 1000) * model.pricing.outputTokenCost // Assume 50% output ratio
    cost += model.pricing.requestCost

    if (mcpIntegration?.useClaudeCode) {
      cost *= this.mcpIntegration.claudeCode.costMultiplier
    }
    if (mcpIntegration?.useCursor) {
      cost *= this.mcpIntegration.cursor.costMultiplier
    }

    return cost
  }

  private calculateExpectedLatency(
    model: ModelCapability, 
    complexity: TaskComplexity, 
    mcpIntegration?: RoutingDecision['mcpIntegration']
  ): number {
    let latency = model.availability.latency
    
    // Add complexity-based latency
    const complexityMultiplier = { simple: 1, moderate: 1.2, complex: 1.5, expert: 2 }
    latency *= complexityMultiplier[complexity.level]
    
    // Add MCP overhead
    if (mcpIntegration?.useClaudeCode || mcpIntegration?.useCursor) {
      latency += 500 // MCP communication overhead
    }

    return latency
  }

  private calculateActualCost(
    model: ModelCapability, 
    result: any, 
    mcpIntegration?: RoutingDecision['mcpIntegration']
  ): number {
    // This would calculate actual cost based on real usage
    // For now, return estimated cost
    return this.calculateExpectedCost(model, result.complexity || { estimatedTokens: 1000 }, mcpIntegration)
  }

  private async executeTask(
    task: string, 
    model: ModelCapability, 
    mcpIntegration?: RoutingDecision['mcpIntegration'], 
    context?: any
  ): Promise<any> {
    // Mock implementation - would actually execute the task
    await new Promise(resolve => setTimeout(resolve, model.availability.latency))
    
    if (Math.random() > model.availability.uptime) {
      throw new Error(`Model ${model.name} is currently unavailable`)
    }

    return {
      result: `Task completed by ${model.name}`,
      model: model.id,
      mcpUsed: mcpIntegration?.useClaudeCode || mcpIntegration?.useCursor || false,
      complexity: this.analyzeTaskComplexity(task, context)
    }
  }

  private recordUsage(usage: typeof this.usageHistory[0]): void {
    this.usageHistory.push(usage)
    
    // Keep only last 1000 records
    if (this.usageHistory.length > 1000) {
      this.usageHistory.shift()
    }

    this.emit('usage:recorded', usage)
  }

  private generateReason(
    model: ModelCapability, 
    complexity: TaskComplexity, 
    preferences?: any
  ): string {
    const reasons = []
    
    if (model.provider === 'local') {
      reasons.push('cost-effective local execution')
    }
    
    if (complexity.factors.codeAnalysis && model.capabilities.codeUnderstanding >= 8) {
      reasons.push('strong code understanding capabilities')
    }
    
    if (complexity.factors.reasoning && model.capabilities.reasoning >= 8) {
      reasons.push('excellent reasoning abilities')
    }
    
    if (model.capabilities.speed >= 8) {
      reasons.push('fast response time')
    }
    
    if (preferences?.preferLocal && model.availability.local) {
      reasons.push('matches local preference')
    }

    return reasons.length > 0 ? reasons.join(', ') : 'best overall match for task requirements'
  }

  private calculateConfidence(score: number, complexity: TaskComplexity): number {
    let baseConfidence = Math.min(score / 100, 0.9) // Normalize score to 0-0.9
    
    // Reduce confidence for very complex tasks
    if (complexity.level === 'expert') {
      baseConfidence *= 0.8
    } else if (complexity.level === 'complex') {
      baseConfidence *= 0.9
    }
    
    return Math.max(0.1, baseConfidence) // Minimum 10% confidence
  }

  private getRelevantSpecializations(complexity: TaskComplexity): string[] {
    const relevant = []
    
    if (complexity.factors.codeAnalysis) relevant.push('code', 'debugging')
    if (complexity.factors.reasoning) relevant.push('analysis', 'planning')
    if (complexity.factors.creative) relevant.push('writing')
    if (complexity.factors.domainExpertise) relevant.push('analysis')
    
    return relevant
  }

  private calculateOverallScore(model: ModelCapability): number {
    return (
      model.capabilities.codeUnderstanding +
      model.capabilities.reasoning +
      model.capabilities.creativity +
      model.capabilities.speed +
      model.capabilities.accuracy +
      model.capabilities.costEfficiency
    ) / 6
  }

  private getModelStrengths(model: ModelCapability): string[] {
    const strengths = []
    
    if (model.capabilities.codeUnderstanding >= 8) strengths.push('code analysis')
    if (model.capabilities.reasoning >= 8) strengths.push('logical reasoning')
    if (model.capabilities.creativity >= 8) strengths.push('creative tasks')
    if (model.capabilities.speed >= 8) strengths.push('fast responses')
    if (model.capabilities.costEfficiency >= 8) strengths.push('cost effective')
    if (model.provider === 'local') strengths.push('zero cost')
    
    return strengths
  }
}