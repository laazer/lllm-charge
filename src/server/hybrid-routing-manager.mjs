/**
 * HybridRoutingManager - Integrates the Hybrid Router with the dashboard
 * Bridges the TypeScript HybridIntelligenceRouter with the JavaScript server
 */
export default class HybridRoutingManager {
  constructor(localLLMManager) {
    this.localLLMManager = localLLMManager
    this.routingConfig = {
      defaultStrategy: 'cost-optimized',
      costThreshold: 0.10,
      qualityThreshold: 0.85,
      timeoutMs: 30000,
      retryAttempts: 3
    }
    
    this.metrics = {
      totalRequests: 0,
      localRequests: 0,
      cloudRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      costSaved: 0,
      averageLatency: 0,
      successRate: 100.0,
      routingDecisions: []
    }
    
    // Load routing configuration
    this.loadRoutingConfig()
  }

  async loadRoutingConfig() {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const configPath = path.resolve('./config/router.json')
      const configData = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configData)
      
      if (config.routing) {
        this.routingConfig = { ...this.routingConfig, ...config.routing }
        console.log('✅ Loaded hybrid routing configuration')
      }
    } catch (error) {
      console.warn('⚠️ Using default routing configuration:', error.message)
    }
  }

  /**
   * Intelligent routing decision based on request characteristics
   */
  async routeRequest(request) {
    const startTime = Date.now()
    this.metrics.totalRequests++
    
    try {
      const decision = await this.makeRoutingDecision(request)
      const result = await this.executeRequest(request, decision)
      
      const latency = Date.now() - startTime
      this.updateMetrics(result, latency, decision)
      
      return {
        ...result,
        latencyMs: latency,
        routingDecision: decision
      }
    } catch (error) {
      console.error('❌ Hybrid routing failed:', error)
      throw error
    }
  }

  /**
   * Make intelligent routing decision
   */
  async makeRoutingDecision(request) {
    const complexity = this.assessComplexity(request.prompt)
    const urgency = request.maxLatency ? 'high' : 'normal'
    const costConstraint = request.maxCost || this.routingConfig.costThreshold
    
    // Check local provider health, prioritizing LM Studio
    const providerStatus = this.localLLMManager.getProviderStatus()
    const healthyProviders = Object.entries(providerStatus)
      .filter(([name, status]) => status.status === 'healthy')
      .sort((a, b) => {
        // Prioritize LM Studio first, then sort by latency
        if (a[0] === 'lm-studio') return -1
        if (b[0] === 'lm-studio') return 1
        return (a[1].latency || 0) - (b[1].latency || 0)
      })
      .map(([name, status]) => status)
    
    const decision = {
      provider: 'local',
      model: null,
      reasoning: '',
      estimatedCost: 0,
      estimatedLatency: 0,
      confidence: 0.8
    }

    // Strategy: Cost-Optimized (default)
    if (this.routingConfig.defaultStrategy === 'cost-optimized') {
      if (healthyProviders.length > 0 && complexity < 0.7) {
        decision.provider = 'local'
        decision.model = healthyProviders[0].models?.[0] || 'default'
        decision.reasoning = 'Cost-optimized routing: Local provider available and complexity is manageable'
        decision.estimatedCost = 0
        decision.estimatedLatency = healthyProviders[0].latency || 2000
        decision.confidence = 0.9
      } else {
        decision.provider = 'cloud'
        decision.reasoning = complexity >= 0.7 
          ? 'High complexity task requires cloud provider'
          : 'No healthy local providers available'
        decision.estimatedCost = this.estimateCloudCost(request.prompt, request.maxTokens)
        decision.estimatedLatency = 800
        decision.confidence = 0.8
      }
    }

    // Strategy: Local-First
    else if (this.routingConfig.defaultStrategy === 'local-first') {
      if (healthyProviders.length > 0) {
        decision.provider = 'local'
        decision.model = this.selectBestLocalModel(healthyProviders, request)
        decision.reasoning = 'Local-first strategy: Prefer local providers when available'
        decision.estimatedCost = 0
        decision.estimatedLatency = healthyProviders[0].latency || 2000
        decision.confidence = 0.8
      } else {
        decision.provider = 'cloud'
        decision.reasoning = 'Local-first fallback: No healthy local providers available'
        decision.estimatedCost = this.estimateCloudCost(request.prompt, request.maxTokens)
        decision.estimatedLatency = 800
        decision.confidence = 0.6
      }
    }

    // Strategy: Hybrid
    else if (this.routingConfig.defaultStrategy === 'hybrid') {
      const useLocal = this.shouldUseLocal(request, complexity, healthyProviders)
      
      if (useLocal) {
        decision.provider = 'local'
        decision.model = this.selectBestLocalModel(healthyProviders, request)
        decision.reasoning = 'Hybrid routing: Local provider selected based on task characteristics'
        decision.estimatedCost = 0
        decision.estimatedLatency = healthyProviders[0].latency || 2000
        decision.confidence = 0.85
      } else {
        decision.provider = 'cloud'
        decision.reasoning = 'Hybrid routing: Cloud provider selected for optimal quality'
        decision.estimatedCost = this.estimateCloudCost(request.prompt, request.maxTokens)
        decision.estimatedLatency = 800
        decision.confidence = 0.9
      }
    }

    // Store decision for learning
    this.metrics.routingDecisions.push({
      timestamp: new Date(),
      request: {
        promptLength: request.prompt.length,
        complexity,
        urgency,
        costConstraint
      },
      decision: { ...decision },
      healthyProviders: healthyProviders.length
    })

    // Keep only last 100 decisions
    if (this.metrics.routingDecisions.length > 100) {
      this.metrics.routingDecisions = this.metrics.routingDecisions.slice(-100)
    }

    return decision
  }

  /**
   * Execute request based on routing decision
   */
  async executeRequest(request, decision) {
    if (decision.provider === 'local') {
      // Find best available local provider
      const providerStatus = this.localLLMManager.getProviderStatus()
      const healthyProviders = Object.entries(providerStatus)
        .filter(([name, status]) => status.status === 'healthy')
        .sort((a, b) => {
          // Prioritize LM Studio first, then sort by latency
          if (a[0] === 'lm-studio') return -1
          if (b[0] === 'lm-studio') return 1
          return (a[1].latency || 0) - (b[1].latency || 0)
        })

      if (healthyProviders.length === 0) {
        throw new Error('No healthy local providers available')
      }

      const [providerName, providerInfo] = healthyProviders[0]
      
      const response = await this.localLLMManager.generateCompletion(providerName, {
        prompt: request.prompt,
        maxTokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        model: decision.model || providerInfo.models?.[0]
      })

      this.metrics.localRequests++
      return {
        ...response,
        routedProvider: 'local',
        actualProvider: providerName,
        cost: 0
      }
    } else {
      // Cloud provider fallback - for now, return a simulated response
      // In a real implementation, this would call actual cloud APIs
      this.metrics.cloudRequests++
      
      const estimatedTokens = this.estimateTokens(request.prompt) + (request.maxTokens || 1000)
      const cost = this.estimateCloudCost(request.prompt, request.maxTokens)
      
      return {
        content: `[Cloud Provider Response] This would be a response from a cloud provider for: "${request.prompt.substring(0, 50)}..."`,
        model: 'gpt-4o-mini',
        isLocal: false,
        routedProvider: 'cloud',
        actualProvider: 'openai-simulation',
        tokens: {
          prompt: this.estimateTokens(request.prompt),
          completion: request.maxTokens || 1000,
          total: estimatedTokens
        },
        cost: cost,
        metadata: {
          provider: 'openai',
          simulated: true
        }
      }
    }
  }

  /**
   * Assess request complexity
   */
  assessComplexity(prompt) {
    const complexityIndicators = [
      'analyze', 'complex', 'detailed', 'comprehensive', 'elaborate',
      'compare', 'contrast', 'explain why', 'reasoning', 'logic',
      'algorithm', 'implement', 'debug', 'optimize', 'architecture'
    ]
    
    const matches = complexityIndicators.filter(word => 
      prompt.toLowerCase().includes(word)
    ).length
    
    const lengthFactor = Math.min(prompt.length / 1000, 1) // Normalize by 1000 chars
    const complexity = (matches / complexityIndicators.length) * 0.7 + lengthFactor * 0.3
    
    return Math.min(complexity, 1.0)
  }

  /**
   * Determine if should use local provider in hybrid mode
   */
  shouldUseLocal(request, complexity, healthyProviders) {
    if (healthyProviders.length === 0) return false
    
    // Factors favoring local:
    // - Lower complexity
    // - Cost constraints
    // - Privacy requirements
    // - Good local provider performance
    
    const costWeight = request.maxCost && request.maxCost < 0.05 ? 0.3 : 0.1
    const complexityWeight = complexity < 0.5 ? 0.3 : -0.2
    const privacyWeight = request.privacy === 'sensitive' ? 0.4 : 0
    const performanceWeight = healthyProviders[0].latency < 2000 ? 0.2 : 0
    
    const localScore = costWeight + complexityWeight + privacyWeight + performanceWeight
    return localScore > 0.3
  }

  /**
   * Select best local model for request
   */
  selectBestLocalModel(healthyProviders, request) {
    // Prioritize LM Studio as the default provider
    const lmStudioProvider = healthyProviders.find(p => p.type === 'lm-studio')
    
    if (lmStudioProvider) {
      const models = lmStudioProvider.models || []
      
      // Prefer code models for code-related tasks
      if (request.prompt.toLowerCase().includes('code') || request.prompt.includes('```')) {
        const codeModel = models.find(m => m.toLowerCase().includes('code') || m.toLowerCase().includes('coder'))
        if (codeModel) return codeModel
      }
      
      // Default to first LM Studio model
      return models[0] || 'local-model'
    }
    
    // Fallback to other healthy providers
    const provider = healthyProviders[0]
    const models = provider.models || []
    
    // Prefer code models for code-related tasks
    if (request.prompt.toLowerCase().includes('code') || request.prompt.includes('```')) {
      const codeModel = models.find(m => m.toLowerCase().includes('code') || m.toLowerCase().includes('coder'))
      if (codeModel) return codeModel
    }
    
    // Default to first available model
    return models[0] || 'default'
  }

  /**
   * Estimate cloud provider cost
   */
  estimateCloudCost(prompt, maxTokens = 1000) {
    const promptTokens = this.estimateTokens(prompt)
    const totalTokens = promptTokens + maxTokens
    
    // Using GPT-4o-mini pricing as baseline: $0.15/$0.60 per 1M tokens
    const inputCost = (promptTokens / 1000000) * 0.15
    const outputCost = (maxTokens / 1000000) * 0.60
    
    return inputCost + outputCost
  }

  /**
   * Estimate token count from text
   */
  estimateTokens(text) {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  /**
   * Update routing metrics
   */
  updateMetrics(result, latency, decision) {
    this.metrics.totalTokens += result.tokens?.total || 0
    this.metrics.totalCost += result.cost || 0
    
    if (result.isLocal || result.routedProvider === 'local') {
      // Estimate what this would have cost with cloud provider
      const estimatedCloudCost = this.estimateCloudCost(
        '', // We don't have the original prompt here
        result.tokens?.completion || 1000
      )
      this.metrics.costSaved += estimatedCloudCost
    }

    // Update average latency
    const totalLatency = this.metrics.averageLatency * (this.metrics.totalRequests - 1)
    this.metrics.averageLatency = (totalLatency + latency) / this.metrics.totalRequests
  }

  /**
   * Get routing metrics and statistics
   */
  getRoutingMetrics() {
    const localPercentage = this.metrics.totalRequests > 0 
      ? (this.metrics.localRequests / this.metrics.totalRequests) * 100 
      : 0
      
    const cloudPercentage = this.metrics.totalRequests > 0
      ? (this.metrics.cloudRequests / this.metrics.totalRequests) * 100
      : 0

    return {
      ...this.metrics,
      localPercentage: Math.round(localPercentage * 10) / 10,
      cloudPercentage: Math.round(cloudPercentage * 10) / 10,
      avgCostPerRequest: this.metrics.totalRequests > 0 
        ? this.metrics.totalCost / this.metrics.totalRequests 
        : 0,
      costSavingsPercentage: this.metrics.totalCost > 0
        ? Math.round((this.metrics.costSaved / (this.metrics.totalCost + this.metrics.costSaved)) * 100 * 10) / 10
        : 0
    }
  }

  /**
   * Get recent routing decisions for analysis
   */
  getRoutingDecisions() {
    return this.metrics.routingDecisions.slice(-20) // Last 20 decisions
  }

  /**
   * Update routing configuration
   */
  updateRoutingConfig(newConfig) {
    this.routingConfig = { ...this.routingConfig, ...newConfig }
    console.log('✅ Updated routing configuration:', this.routingConfig)
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      localRequests: 0,
      cloudRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      costSaved: 0,
      averageLatency: 0,
      successRate: 100.0,
      routingDecisions: []
    }
    console.log('✅ Reset routing metrics')
  }
}