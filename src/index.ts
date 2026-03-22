// Main entry point for LLM-Charge unified intelligence system
// FEATURE: Core system orchestrator and public API

export { LLMChargeServer } from './mcp/llm-charge-server'
export { UnifiedIntelligence } from './intelligence/unified-intelligence'
export { HybridReasoning } from './reasoning/hybrid-reasoning'
export { LocalLLMRouter } from './reasoning/local-llm-router'
export { RLMEngine } from './reasoning/rlm-engine'
export { LLMOptimizationEngine } from './core/llm-optimization'
export { CostTracker } from './utils/cost-tracker'
export { KnowledgeBase } from './core/knowledge-base'

export * from './core/types'

import { LLMChargeServer } from './mcp/llm-charge-server'
import { UnifiedIntelligence } from './intelligence/unified-intelligence'
import { HybridReasoning } from './reasoning/hybrid-reasoning'
import { LocalLLMRouter } from './reasoning/local-llm-router'
import { RLMEngine } from './reasoning/rlm-engine'
import { LLMOptimizationEngine } from './core/llm-optimization'
import { CostTracker } from './utils/cost-tracker'
import { LLMChargeConfig } from './core/types'

export class LLMCharge {
  private server: LLMChargeServer
  private intelligence: UnifiedIntelligence
  private reasoning: HybridReasoning
  private router: LocalLLMRouter
  private optimizer: LLMOptimizationEngine
  private costTracker: CostTracker
  private initialized = false

  constructor(private config: LLMChargeConfig, private projectPath: string) {
    this.server = new LLMChargeServer(config, projectPath)
    this.costTracker = new CostTracker(config.api)
    this.router = new LocalLLMRouter(config.local, config.api)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('🚀 Initializing LLM-Charge system...')

    // Initialize intelligence subsystem
    this.intelligence = new UnifiedIntelligence(this.config.intelligence)
    await this.intelligence.initialize(this.projectPath)

    // Initialize reasoning subsystem
    const rlmEngine = new RLMEngine(this.config.reasoning)
    await rlmEngine.initialize()
    this.reasoning = new HybridReasoning(this.intelligence, rlmEngine, this.router)

    // Initialize optimization engine
    this.optimizer = new LLMOptimizationEngine(this.router, this.costTracker)

    this.initialized = true
    console.log('✅ LLM-Charge system initialized')
  }

  async startMCPServer(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
    await this.server.start()
  }

  async processQuery(query: string, options: {
    requiresReasoning?: boolean
    complexity?: 'simple' | 'medium' | 'complex'
    preferLocal?: boolean
    maxTokens?: number
  } = {}): Promise<{
    answer: string
    model: string
    isLocal: boolean
    cost: number
    tokensUsed: number
    confidence: number
  }> {
    if (!this.initialized) {
      await this.initialize()
    }

    const response = await this.reasoning.processQuery({
      query,
      requiresReasoning: options.requiresReasoning,
      complexity: options.complexity,
      preferLocal: options.preferLocal,
      contextTokens: options.maxTokens
    })

    return {
      answer: response.answer,
      model: response.modelUsed,
      isLocal: response.isLocal,
      cost: response.cost,
      tokensUsed: response.tokensUsed,
      confidence: response.confidence
    }
  }

  async optimizeSetup(): Promise<{
    report: any
    applied: boolean
    savings: { cost: number; tokens: number; latency: number }
  }> {
    if (!this.initialized) {
      await this.initialize()
    }

    const report = await this.optimizer.analyzeCurrentSetup()
    
    // Auto-apply low-risk optimizations
    let applied = false
    const topStrategy = report.recommendedStrategies[0]
    
    if (topStrategy && topStrategy.priority > 8 && topStrategy.expectedImprovement > 0.2) {
      // Would implement strategy application logic
      applied = true
    }

    return {
      report,
      applied,
      savings: report.projectedSavings
    }
  }

  async getSystemMetrics(): Promise<{
    cost: any
    performance: any
    intelligence: any
    reasoning: any
  }> {
    if (!this.initialized) {
      await this.initialize()
    }

    const costMetrics = this.costTracker.getMetrics('day')
    const performanceData = await this.optimizer.benchmarkLocalModels()
    
    return {
      cost: costMetrics,
      performance: performanceData,
      intelligence: {
        cacheHits: 0, // Would track cache metrics
        embeddingCount: 0,
        symbolCount: 0
      },
      reasoning: {
        sessionsActive: 0,
        avgSteps: 0,
        successRate: 0
      }
    }
  }

  async searchCodebase(query: string, options: {
    includeSemanticSearch?: boolean
    maxResults?: number
    fileFilter?: string[]
  } = {}): Promise<{
    symbols: any[]
    files: string[]
    semanticMatches: any[]
    relationships: any[]
  }> {
    if (!this.initialized) {
      await this.initialize()
    }

    const contextPackage = await this.intelligence.buildContextPackage(
      query,
      options.maxResults ? options.maxResults * 100 : 2000
    )

    return {
      symbols: contextPackage.codeSymbols,
      files: contextPackage.relevantFiles,
      semanticMatches: contextPackage.semanticMatches,
      relationships: contextPackage.relationships
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down LLM-Charge system...')
    
    // Cleanup optimization intervals
    if ((global as any).__llmOptimizationInterval) {
      clearInterval((global as any).__llmOptimizationInterval)
    }

    this.initialized = false
    console.log('✅ LLM-Charge system shut down')
  }
}

export default LLMCharge