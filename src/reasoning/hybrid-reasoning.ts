// Hybrid reasoning system combining local and API models with intelligent routing
// FEATURE: Smart reasoning orchestration for cost-optimized LLM usage

import { UnifiedIntelligence } from '@/intelligence/unified-intelligence'
import { RLMEngine } from './rlm-engine'
import { LocalLLMRouter } from './local-llm-router'
import { CommonCommandHandler } from '@/utils/common-commands'
import { LLMRequest, LLMResponse, ContextPackage, ReasoningSession } from '@/core/types'

export interface ReasoningRequest {
  query: string
  requiresReasoning?: boolean
  maxSteps?: number
  preferLocal?: boolean
  contextTokens?: number
  complexity?: 'simple' | 'medium' | 'complex'
}

export interface ReasoningResponse {
  answer: string
  reasoning?: ReasoningSession
  context?: ContextPackage
  modelUsed: string
  isLocal: boolean
  cost: number
  tokensUsed: number
  stepsExecuted: number
  confidence: number
}

export class HybridReasoning {
  private commandHandler: CommonCommandHandler

  constructor(
    private intelligence: UnifiedIntelligence,
    private rlmEngine: RLMEngine,
    private router: LocalLLMRouter
  ) {
    this.commandHandler = new CommonCommandHandler()
  }

  async processQuery(request: ReasoningRequest, cwd?: string): Promise<ReasoningResponse> {
    // First, check if this is a simple command that can be handled directly
    const commandResult = await this.commandHandler.handleCommand(request.query, cwd)
    
    if (commandResult) {
      return {
        answer: commandResult.output,
        modelUsed: 'built-in-command',
        isLocal: true,
        cost: 0,
        tokensUsed: 0,
        stepsExecuted: 1,
        confidence: commandResult.success ? 1.0 : 0.5
      }
    }
    const startTime = Date.now()
    
    // Step 1: Build rich context using unified intelligence
    const contextPackage = await this.buildIntelligentContext(request)
    
    // Step 2: Determine reasoning strategy
    const strategy = this.selectReasoningStrategy(request, contextPackage)
    
    // Step 3: Execute reasoning
    let response: ReasoningResponse
    
    switch (strategy.type) {
      case 'direct-local':
        response = await this.executeDirectLocal(request, contextPackage)
        break
      case 'recursive-local':
        response = await this.executeRecursiveLocal(request, contextPackage)
        break
      case 'hybrid':
        response = await this.executeHybrid(request, contextPackage)
        break
      case 'api-fallback':
        response = await this.executeAPIFallback(request, contextPackage)
        break
      default:
        throw new Error(`Unknown strategy: ${strategy.type}`)
    }
    
    // Step 4: Update memory with learnings
    await this.updateMemoryGraph(request, response)
    
    response.context = contextPackage
    return response
  }

  private async buildIntelligentContext(request: ReasoningRequest): Promise<ContextPackage> {
    const maxTokens = request.contextTokens || 3000
    return this.intelligence.buildContextPackage(request.query, maxTokens)
  }

  private selectReasoningStrategy(request: ReasoningRequest, context: ContextPackage): ReasoningStrategy {
    const complexity = request.complexity || this.assessComplexity(request.query, context)
    const requiresReasoning = request.requiresReasoning ?? this.needsReasoning(request.query)
    const contextSize = context.estimatedTokens
    
    // Simple queries with good context -> Direct local
    if (complexity === 'simple' && contextSize < 2000 && !requiresReasoning) {
      return {
        type: 'direct-local',
        confidence: 0.9,
        reason: 'Simple query with adequate context'
      }
    }
    
    // Complex queries that benefit from step-by-step reasoning -> Recursive local
    if (complexity !== 'simple' && requiresReasoning && request.preferLocal !== false) {
      return {
        type: 'recursive-local',
        confidence: 0.8,
        reason: 'Complex query requiring recursive reasoning'
      }
    }
    
    // Mixed complexity -> Hybrid approach
    if (complexity === 'medium' && contextSize > 1500) {
      return {
        type: 'hybrid',
        confidence: 0.7,
        reason: 'Medium complexity query with substantial context'
      }
    }
    
    // Fallback to API for very complex or critical queries
    return {
      type: 'api-fallback',
      confidence: 0.6,
      reason: 'High complexity or insufficient local confidence'
    }
  }

  private async executeDirectLocal(request: ReasoningRequest, context: ContextPackage): Promise<ReasoningResponse> {
    const llmRequest: LLMRequest = {
      prompt: this.buildEnhancedPrompt(request.query, context),
      maxTokens: 1000,
      temperature: 0.3,
      preferLocal: true
    }
    
    const llmResponse = await this.router.processRequest(llmRequest)
    
    return {
      answer: llmResponse.content,
      modelUsed: llmResponse.model,
      isLocal: llmResponse.isLocal,
      cost: llmResponse.cost || 0,
      tokensUsed: llmResponse.tokens.total,
      stepsExecuted: 1,
      confidence: 0.85
    }
  }

  private async executeRecursiveLocal(request: ReasoningRequest, context: ContextPackage): Promise<ReasoningResponse> {
    const contextText = this.formatContextForRLM(context)
    const sessionId = await this.rlmEngine.startReasoningSession(request.query, contextText)
    const session = await this.rlmEngine.getSession(sessionId)
    
    if (!session) {
      throw new Error('Failed to start RLM session')
    }
    
    return {
      answer: session.result || 'No result available',
      reasoning: session,
      modelUsed: 'local-rlm',
      isLocal: true,
      cost: 0,
      tokensUsed: this.estimateRLMTokens(session),
      stepsExecuted: session.iterations.length,
      confidence: 0.8
    }
  }

  private async executeHybrid(request: ReasoningRequest, context: ContextPackage): Promise<ReasoningResponse> {
    // Use local model for initial analysis, API for final synthesis
    const initialRequest: LLMRequest = {
      prompt: `Analyze this query and context, identify key points and potential approaches:\n\nQuery: ${request.query}\n\nContext: ${this.formatContextForPrompt(context)}`,
      maxTokens: 800,
      temperature: 0.2,
      preferLocal: true
    }
    
    const initialResponse = await this.router.processRequest(initialRequest)
    
    const finalRequest: LLMRequest = {
      prompt: `Based on this analysis, provide a comprehensive answer:\n\nOriginal Query: ${request.query}\n\nAnalysis: ${initialResponse.content}`,
      maxTokens: 1200,
      temperature: 0.3,
      preferLocal: false
    }
    
    const finalResponse = await this.router.processRequest(finalRequest)
    
    return {
      answer: finalResponse.content,
      modelUsed: `${initialResponse.model} + ${finalResponse.model}`,
      isLocal: false,
      cost: (initialResponse.cost || 0) + (finalResponse.cost || 0),
      tokensUsed: initialResponse.tokens.total + finalResponse.tokens.total,
      stepsExecuted: 2,
      confidence: 0.9
    }
  }

  private async executeAPIFallback(request: ReasoningRequest, context: ContextPackage): Promise<ReasoningResponse> {
    const llmRequest: LLMRequest = {
      prompt: this.buildEnhancedPrompt(request.query, context),
      maxTokens: 2000,
      temperature: 0.2,
      preferLocal: false
    }
    
    const llmResponse = await this.router.processRequest(llmRequest)
    
    return {
      answer: llmResponse.content,
      modelUsed: llmResponse.model,
      isLocal: false,
      cost: llmResponse.cost || 0,
      tokensUsed: llmResponse.tokens.total,
      stepsExecuted: 1,
      confidence: 0.95
    }
  }

  private buildEnhancedPrompt(query: string, context: ContextPackage): string {
    const sections = []
    
    if (context.relevantFiles.length > 0) {
      sections.push(`Relevant Files:\n${context.relevantFiles.join('\n')}`)
    }
    
    if (context.codeSymbols.length > 0) {
      const symbols = context.codeSymbols.slice(0, 10).map(s => 
        `- ${s.name} (${s.kind}) in ${s.file}:${s.line}${s.signature ? `\n  ${s.signature}` : ''}`
      ).join('\n')
      sections.push(`Key Code Symbols:\n${symbols}`)
    }
    
    if (context.semanticMatches.length > 0) {
      const matches = context.semanticMatches.slice(0, 5).map(m =>
        `- ${m.content} (similarity: ${m.similarity.toFixed(2)})`
      ).join('\n')
      sections.push(`Semantic Matches:\n${matches}`)
    }
    
    if (context.memoryNodes.length > 0) {
      const memories = context.memoryNodes.slice(0, 3).map(n =>
        `- ${n.type}: ${n.content.slice(0, 200)}...`
      ).join('\n')
      sections.push(`Related Knowledge:\n${memories}`)
    }
    
    const contextText = sections.length > 0 ? sections.join('\n\n') : 'No specific context available.'
    
    return `Context:\n${contextText}\n\nQuery: ${query}\n\nPlease provide a comprehensive answer based on the context provided.`
  }

  private formatContextForRLM(context: ContextPackage): string {
    return `
Project Context:
- Files: ${context.relevantFiles.join(', ')}
- Symbols: ${context.codeSymbols.length} code symbols found
- Memory: ${context.memoryNodes.length} related concepts
- Semantic matches: ${context.semanticMatches.length} relevant matches

Use this context to understand the codebase structure and relationships when answering the query.
`
  }

  private formatContextForPrompt(context: ContextPackage): string {
    return [
      `Files: ${context.relevantFiles.slice(0, 5).join(', ')}`,
      `Symbols: ${context.codeSymbols.slice(0, 3).map(s => s.name).join(', ')}`,
      `Memory: ${context.memoryNodes.slice(0, 2).map(n => n.content.slice(0, 100)).join('; ')}`
    ].join('\n')
  }

  private assessComplexity(query: string, context: ContextPackage): 'simple' | 'medium' | 'complex' {
    let score = 0
    
    // Query complexity indicators
    const complexWords = ['analyze', 'compare', 'design', 'implement', 'refactor', 'optimize', 'debug', 'explain why']
    score += complexWords.filter(word => query.toLowerCase().includes(word)).length
    
    // Context complexity
    score += Math.min(context.codeSymbols.length / 10, 2)
    score += Math.min(context.relevantFiles.length / 5, 2) 
    score += Math.min(context.relationships.length / 15, 1)
    
    if (score < 2) return 'simple'
    if (score < 5) return 'medium'
    return 'complex'
  }

  private needsReasoning(query: string): boolean {
    const reasoningIndicators = [
      'why', 'how', 'what if', 'compare', 'analyze', 'explain',
      'step by step', 'process', 'algorithm', 'solve', 'debug'
    ]
    
    return reasoningIndicators.some(indicator => 
      query.toLowerCase().includes(indicator)
    )
  }

  private estimateRLMTokens(session: ReasoningSession): number {
    return session.iterations.reduce((total, iter) => 
      total + this.estimateTokens(iter.prompt) + this.estimateTokens(iter.response)
    , 0)
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private async updateMemoryGraph(request: ReasoningRequest, response: ReasoningResponse): Promise<void> {
    const memoryId = `query_${Date.now()}`
    const content = `Query: ${request.query}\nAnswer: ${response.answer.slice(0, 500)}`
    
    await this.intelligence.updateMemory(memoryId, content, {
      type: 'reasoning_result',
      complexity: request.complexity,
      cost: response.cost,
      confidence: response.confidence,
      modelUsed: response.modelUsed
    })
  }
}

interface ReasoningStrategy {
  type: 'direct-local' | 'recursive-local' | 'hybrid' | 'api-fallback'
  confidence: number
  reason: string
}