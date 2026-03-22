// Intelligent Hybrid Router for Claude + Local Models
import { ClaudeProvider } from './providers/claude-provider'
import { LocalLLMRouter } from './local-llm-router'
import { KnowledgeBase } from '../core/knowledge-base'

export interface TaskRequest {
  query: string
  context?: string
  task: 'reasoning' | 'code_generation' | 'analysis' | 'writing' | 'general'
  priority: 'speed' | 'quality' | 'cost'
  privacy: 'public' | 'private' | 'sensitive'
  complexity?: 'low' | 'medium' | 'high'
  maxLatency?: number
  maxCost?: number
}

export interface ProviderChoice {
  provider: 'claude' | 'local'
  model?: string
  reasoning: string
  estimatedCost: number
  estimatedLatency: number
  confidence: number
}

export interface RoutingMetrics {
  totalRequests: number
  claudeRequests: number
  localRequests: number
  averageCost: number
  averageLatency: number
  costSavings: number
  successRate: number
  userSatisfaction: number
}

export class HybridIntelligenceRouter {
  private claudeProvider: ClaudeProvider
  private localRouter: LocalLLMRouter
  private knowledgeBase: KnowledgeBase
  private routingMetrics: RoutingMetrics
  private learningData: RoutingDecision[]

  constructor(
    claudeApiKey: string,
    localConfig: any,
    knowledgeBase: KnowledgeBase
  ) {
    this.claudeProvider = new ClaudeProvider(claudeApiKey)
    this.localRouter = new LocalLLMRouter(localConfig)
    this.knowledgeBase = knowledgeBase
    this.routingMetrics = this.initializeMetrics()
    this.learningData = []
  }

  async initialize(): Promise<void> {
    await this.localRouter.initialize()
    await this.loadRoutingHistory()
  }

  async routeRequest(request: TaskRequest): Promise<ProviderChoice> {
    const analysis = await this.analyzeRequest(request)
    const decision = await this.makeRoutingDecision(analysis, request)
    
    // Learn from this decision for future improvements
    this.recordRoutingDecision(request, decision, analysis)
    
    return decision
  }

  async processRequest(request: TaskRequest): Promise<any> {
    const choice = await this.routeRequest(request)
    const startTime = Date.now()

    try {
      let response
      if (choice.provider === 'claude') {
        response = await this.claudeProvider.generateResponse({
          prompt: request.query,
          task: request.task,
          context: request.context
        })
      } else {
        response = await this.localRouter.generateResponse({
          prompt: request.query,
          task: request.task,
          preferredModel: choice.model
        })
      }

      // Update metrics
      await this.updateMetrics(choice, response, Date.now() - startTime)
      
      return {
        ...response,
        routingDecision: choice
      }
    } catch (error) {
      // Handle fallback routing
      return await this.handleFailover(request, choice, error)
    }
  }

  private async analyzeRequest(request: TaskRequest): Promise<RequestAnalysis> {
    const analysis: RequestAnalysis = {
      complexity: await this.assessComplexity(request),
      domain: await this.identifyDomain(request),
      requiredCapabilities: await this.analyzeRequiredCapabilities(request),
      knowledgeAvailable: await this.checkKnowledgeAvailability(request),
      userPreferences: await this.getUserPreferences(request),
      contextSize: request.context?.length || 0,
      urgency: this.assessUrgency(request)
    }

    return analysis
  }

  private async makeRoutingDecision(
    analysis: RequestAnalysis, 
    request: TaskRequest
  ): Promise<ProviderChoice> {
    // Privacy first - sensitive data stays local
    if (request.privacy === 'sensitive') {
      return {
        provider: 'local',
        model: await this.selectOptimalLocalModel(analysis),
        reasoning: 'Privacy requirement: sensitive data must stay local',
        estimatedCost: 0,
        estimatedLatency: 500,
        confidence: 0.9
      }
    }

    // Speed priority - use local if possible
    if (request.priority === 'speed' && request.maxLatency && request.maxLatency < 1000) {
      if (analysis.knowledgeAvailable && analysis.complexity !== 'high') {
        return {
          provider: 'local',
          model: await this.selectFastLocalModel(),
          reasoning: 'Speed priority: local model can handle this quickly',
          estimatedCost: 0,
          estimatedLatency: 300,
          confidence: 0.85
        }
      }
    }

    // Cost priority - prefer local when quality is sufficient
    if (request.priority === 'cost') {
      const localCapability = await this.assessLocalCapability(analysis)
      if (localCapability > 0.7) {
        return {
          provider: 'local',
          model: await this.selectOptimalLocalModel(analysis),
          reasoning: 'Cost priority: local model has sufficient capability',
          estimatedCost: 0,
          estimatedLatency: 400,
          confidence: localCapability
        }
      }
    }

    // Quality priority or complex tasks - consider Claude
    if (request.priority === 'quality' || analysis.complexity === 'high') {
      const costEstimate = this.estimateClaudeCost(request)
      if (!request.maxCost || costEstimate <= request.maxCost) {
        return {
          provider: 'claude',
          reasoning: 'Quality priority: Claude excels at complex reasoning',
          estimatedCost: costEstimate,
          estimatedLatency: 2000,
          confidence: 0.95
        }
      }
    }

    // Specific Claude strengths
    if (this.requiresClaudeSkills(analysis)) {
      return {
        provider: 'claude',
        reasoning: 'Task requires Claude-specific capabilities',
        estimatedCost: this.estimateClaudeCost(request),
        estimatedLatency: 2000,
        confidence: 0.9
      }
    }

    // Default to local with fallback
    return {
      provider: 'local',
      model: await this.selectOptimalLocalModel(analysis),
      reasoning: 'Default local processing with Claude fallback available',
      estimatedCost: 0,
      estimatedLatency: 500,
      confidence: 0.75
    }
  }

  private async assessComplexity(request: TaskRequest): Promise<'low' | 'medium' | 'high'> {
    if (request.complexity) return request.complexity

    const complexityIndicators = {
      high: [
        'analyze architecture', 'design system', 'multi-step reasoning',
        'complex algorithm', 'performance optimization', 'security analysis',
        'code review', 'architectural decision'
      ],
      medium: [
        'explain code', 'generate tests', 'refactor', 'debug',
        'write function', 'api design'
      ],
      low: [
        'simple question', 'format code', 'basic explanation',
        'quick fix', 'syntax help'
      ]
    }

    const query = request.query.toLowerCase()

    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => query.includes(indicator))) {
        return level as 'low' | 'medium' | 'high'
      }
    }

    // Use query length and structure as fallback
    if (request.query.length > 500 || request.query.split('?').length > 2) {
      return 'high'
    } else if (request.query.length > 100) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  private async identifyDomain(request: TaskRequest): Promise<string> {
    const domainKeywords = {
      'web_development': ['react', 'html', 'css', 'javascript', 'frontend'],
      'backend': ['api', 'server', 'database', 'nodejs', 'express'],
      'mobile': ['ios', 'android', 'swift', 'kotlin', 'react native'],
      'data_science': ['python', 'pandas', 'machine learning', 'data analysis'],
      'devops': ['docker', 'kubernetes', 'deployment', 'ci/cd'],
      'security': ['authentication', 'encryption', 'vulnerability', 'security']
    }

    const query = request.query.toLowerCase()
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return domain
      }
    }

    return 'general'
  }

  private requiresClaudeSkills(analysis: RequestAnalysis): boolean {
    const claudeStrengths = [
      'complex_reasoning', 'ethical_considerations', 'creative_writing',
      'architectural_analysis', 'comprehensive_code_review',
      'multi_modal_analysis', 'safety_analysis'
    ]

    return analysis.requiredCapabilities.some(cap => 
      claudeStrengths.includes(cap)
    )
  }

  private async handleFailover(
    request: TaskRequest, 
    originalChoice: ProviderChoice, 
    error: Error
  ): Promise<any> {
    console.log(`Failover triggered: ${originalChoice.provider} failed with ${error.message}`)

    // Try alternative provider
    const fallbackChoice: ProviderChoice = originalChoice.provider === 'claude' 
      ? {
          provider: 'local',
          model: await this.selectOptimalLocalModel(await this.analyzeRequest(request)),
          reasoning: 'Fallback to local due to Claude failure',
          estimatedCost: 0,
          estimatedLatency: 500,
          confidence: 0.6
        }
      : {
          provider: 'claude',
          reasoning: 'Fallback to Claude due to local failure',
          estimatedCost: this.estimateClaudeCost(request),
          estimatedLatency: 2000,
          confidence: 0.8
        }

    try {
      if (fallbackChoice.provider === 'claude') {
        return await this.claudeProvider.generateResponse({
          prompt: request.query,
          task: request.task,
          context: request.context
        })
      } else {
        return await this.localRouter.generateResponse({
          prompt: request.query,
          task: request.task,
          preferredModel: fallbackChoice.model
        })
      }
    } catch (fallbackError) {
      return {
        response: `Both providers failed. Original: ${error.message}, Fallback: ${fallbackError.message}`,
        provider: 'error',
        cost: 0,
        tokens: 0,
        executionTime: 0,
        isLocal: false,
        error: 'Total system failure'
      }
    }
  }

  // Learning and optimization methods
  private recordRoutingDecision(
    request: TaskRequest, 
    choice: ProviderChoice, 
    analysis: RequestAnalysis
  ): void {
    this.learningData.push({
      timestamp: Date.now(),
      request,
      choice,
      analysis,
      outcome: null // Will be updated when response is evaluated
    })

    // Keep only recent decisions for learning
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-800)
    }
  }

  async getRoutingMetrics(): Promise<RoutingMetrics> {
    return this.routingMetrics
  }

  async optimizeRouting(): Promise<RoutingOptimization> {
    const recentDecisions = this.learningData.slice(-100)
    
    const analysis = {
      accuracyByComplexity: this.analyzeAccuracyByComplexity(recentDecisions),
      costEfficiencyTrends: this.analyzeCostTrends(recentDecisions),
      latencyPatterns: this.analyzeLatencyPatterns(recentDecisions),
      userSatisfactionCorrelation: this.analyzeUserSatisfaction(recentDecisions)
    }

    const optimizations = {
      routingRuleAdjustments: this.suggestRoutingRules(analysis),
      modelSelectionImprovements: this.suggestModelOptimizations(analysis),
      costOptimizationOpportunities: this.identifyCostOptimizations(analysis)
    }

    return {
      currentPerformance: analysis,
      recommendedOptimizations: optimizations,
      estimatedImpact: this.estimateOptimizationImpact(optimizations)
    }
  }

  // Utility methods
  private initializeMetrics(): RoutingMetrics {
    return {
      totalRequests: 0,
      claudeRequests: 0,
      localRequests: 0,
      averageCost: 0,
      averageLatency: 0,
      costSavings: 0,
      successRate: 0,
      userSatisfaction: 0
    }
  }

  private estimateClaudeCost(request: TaskRequest): number {
    const baseTokens = Math.ceil(request.query.length / 4)
    const contextTokens = Math.ceil((request.context?.length || 0) / 4)
    const estimatedOutputTokens = Math.min(baseTokens * 2, 1000)
    
    const inputCost = ((baseTokens + contextTokens) / 1000) * 0.003
    const outputCost = (estimatedOutputTokens / 1000) * 0.015
    
    return inputCost + outputCost
  }

  // Placeholder methods for implementation
  private async analyzeRequiredCapabilities(request: TaskRequest): Promise<string[]> { return [] }
  private async checkKnowledgeAvailability(request: TaskRequest): Promise<boolean> { return true }
  private async getUserPreferences(request: TaskRequest): Promise<any> { return {} }
  private assessUrgency(request: TaskRequest): 'low' | 'medium' | 'high' { return 'medium' }
  private async selectOptimalLocalModel(analysis: RequestAnalysis): Promise<string> { return 'llama2' }
  private async selectFastLocalModel(): Promise<string> { return 'llama2' }
  private async assessLocalCapability(analysis: RequestAnalysis): Promise<number> { return 0.8 }
  private async updateMetrics(choice: ProviderChoice, response: any, latency: number): Promise<void> {}
  private async loadRoutingHistory(): Promise<void> {}
  private analyzeAccuracyByComplexity(decisions: RoutingDecision[]): any { return {} }
  private analyzeCostTrends(decisions: RoutingDecision[]): any { return {} }
  private analyzeLatencyPatterns(decisions: RoutingDecision[]): any { return {} }
  private analyzeUserSatisfaction(decisions: RoutingDecision[]): any { return {} }
  private suggestRoutingRules(analysis: any): any { return {} }
  private suggestModelOptimizations(analysis: any): any { return {} }
  private identifyCostOptimizations(analysis: any): any { return {} }
  private estimateOptimizationImpact(optimizations: any): any { return {} }
}

// Supporting interfaces
interface RequestAnalysis {
  complexity: 'low' | 'medium' | 'high'
  domain: string
  requiredCapabilities: string[]
  knowledgeAvailable: boolean
  userPreferences: any
  contextSize: number
  urgency: 'low' | 'medium' | 'high'
}

interface RoutingDecision {
  timestamp: number
  request: TaskRequest
  choice: ProviderChoice
  analysis: RequestAnalysis
  outcome: RoutingOutcome | null
}

interface RoutingOutcome {
  actualLatency: number
  actualCost: number
  qualityScore: number
  userSatisfaction: number
  success: boolean
}

interface RoutingOptimization {
  currentPerformance: any
  recommendedOptimizations: any
  estimatedImpact: any
}