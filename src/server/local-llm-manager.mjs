// Using Node.js built-in fetch (available in Node 18+)

/**
 * LocalLLMManager - Handles all local LLM provider integrations
 * Supports Ollama, LM Studio, vLLM, and llama.cpp
 */
export default class LocalLLMManager {
  constructor() {
    this.providers = new Map()
    this.healthStatus = new Map()
    this.capabilities = new Map()
    
    // Initialize provider configurations from config/router.json
    this.initializeProviders()
    
    // Start health monitoring
    this.startHealthMonitoring()
  }

  async initializeProviders() {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const configPath = path.resolve('./config/router.json')
      const configData = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configData)
      
      // Register local providers from config
      for (const [name, settings] of Object.entries(config.providers.local || {})) {
        this.providers.set(name, {
          type: name,
          endpoint: settings.endpoint,
          models: settings.models || [],
          costPerToken: settings.costPerToken || 0,
          maxConcurrency: settings.maxConcurrency || 1,
          timeout: 120000
        })
        
        // Initialize health status as unknown
        this.healthStatus.set(name, { 
          status: 'unknown', 
          lastCheck: null, 
          latency: null,
          error: null 
        })
      }
      
      console.log(`✅ Initialized ${this.providers.size} local LLM providers`)
    } catch (error) {
      console.error('❌ Failed to load router config:', error.message)
      // Fallback to default configuration
      this.setupDefaultProviders()
    }
  }

  setupDefaultProviders() {
    // Default LM Studio configuration (primary)
    this.providers.set('lm-studio', {
      type: 'lm-studio',
      endpoint: 'http://localhost:1234',
      models: ['local-model', 'llama-3.2-3b-instruct', 'qwen2.5-coder-7b-instruct'],
      costPerToken: 0,
      maxConcurrency: 4,
      timeout: 30000,
      default: true
    })
    
    // Ollama configuration (secondary)
    this.providers.set('ollama', {
      type: 'ollama',
      endpoint: 'http://localhost:11434',
      models: ['llama3.2', 'codellama', 'mistral'],
      costPerToken: 0,
      maxConcurrency: 4,
      timeout: 30000
    })
    
    this.healthStatus.set('lm-studio', { status: 'unknown', lastCheck: null, latency: null, error: null })
    this.healthStatus.set('ollama', { status: 'unknown', lastCheck: null, latency: null, error: null })
    
    console.log('✅ Using default local LLM provider configuration (LM Studio primary)')
  }

  startHealthMonitoring() {
    // Check provider health every 30 seconds
    setInterval(() => {
      this.checkAllProviderHealth()
    }, 30000)
    
    // Initial health check
    setTimeout(() => {
      this.checkAllProviderHealth()
    }, 2000)
  }

  async checkAllProviderHealth() {
    for (const [name, provider] of this.providers) {
      try {
        await this.checkProviderHealth(name, provider)
      } catch (error) {
        console.warn(`⚠️ Health check failed for ${name}:`, error.message)
      }
    }
  }

  async checkProviderHealth(name, provider) {
    const startTime = Date.now()
    
    try {
      let healthUrl
      let expectedResponse
      
      switch (provider.type) {
        case 'ollama':
          healthUrl = `${provider.endpoint}/api/tags`
          expectedResponse = (data) => Array.isArray(data.models)
          break
          
        case 'lm-studio':
          healthUrl = `${provider.endpoint}/v1/models`
          expectedResponse = (data) => Array.isArray(data.data)
          break
          
        case 'vllm':
          healthUrl = `${provider.endpoint}/v1/models`
          expectedResponse = (data) => Array.isArray(data.data)
          break
          
        case 'llamacpp':
          healthUrl = `${provider.endpoint}/v1/models`
          expectedResponse = (data) => Array.isArray(data.data)
          break
          
        default:
          throw new Error(`Unknown provider type: ${provider.type}`)
      }
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        timeout: provider.timeout,
        headers: { 'Content-Type': 'application/json' }
      })
      
      const latency = Date.now() - startTime
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (expectedResponse && !expectedResponse(data)) {
        throw new Error('Invalid response format')
      }
      
      // Update models from actual provider response
      if (provider.type === 'ollama' && data.models) {
        provider.models = data.models.map(model => model.name)
      } else if (data.data && Array.isArray(data.data)) {
        provider.models = data.data.map(model => model.id)
      }
      
      this.healthStatus.set(name, {
        status: 'healthy',
        lastCheck: new Date(),
        latency,
        error: null,
        models: provider.models
      })
      
      console.log(`✅ ${name} is healthy (${latency}ms) - ${provider.models.length} models available`)
      
    } catch (error) {
      const latency = Date.now() - startTime
      
      this.healthStatus.set(name, {
        status: 'unhealthy',
        lastCheck: new Date(),
        latency,
        error: error.message
      })
      
      console.log(`❌ ${name} is unhealthy: ${error.message}`)
    }
  }

  async generateCompletion(providerName, request) {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
    }
    
    const health = this.healthStatus.get(providerName)
    if (health?.status !== 'healthy') {
      throw new Error(`Provider ${providerName} is not healthy: ${health?.error || 'Unknown error'}`)
    }
    
    const startTime = Date.now()
    
    try {
      let response
      
      switch (provider.type) {
        case 'ollama':
          response = await this.callOllama(provider, request)
          break
          
        case 'lm-studio':
          response = await this.callLMStudio(provider, request)
          break
          
        case 'vllm':
          response = await this.callVLLM(provider, request)
          break
          
        case 'llamacpp':
          response = await this.callLlamaCpp(provider, request)
          break
          
        default:
          throw new Error(`Unsupported provider type: ${provider.type}`)
      }
      
      const latency = Date.now() - startTime
      response.latencyMs = latency
      response.provider = providerName
      response.isLocal = true
      response.cost = 0
      
      return response
      
    } catch (error) {
      throw new Error(`${providerName} generation failed: ${error.message}`)
    }
  }

  async callOllama(provider, request) {
    const url = `${provider.endpoint}/api/generate`
    
    const fullPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt

    const payload = {
      model: request.model || provider.models[0],
      prompt: fullPrompt,
      system: request.systemPrompt || undefined,
      options: {
        temperature: request.temperature || 0.7,
        num_predict: request.maxTokens || 1000
      },
      stream: false
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: provider.timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    return {
      content: data.response,
      model: payload.model,
      tokens: {
        prompt: data.prompt_eval_count || this.estimateTokens(payload.prompt),
        completion: data.eval_count || this.estimateTokens(data.response),
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      metadata: {
        evalDuration: data.eval_duration,
        loadDuration: data.load_duration
      }
    }
  }

  async callLMStudio(provider, request) {
    const url = `${provider.endpoint}/v1/chat/completions`
    
    const messages = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    const payload = {
      model: request.model || provider.models[0] || 'local-model',
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
      stream: false
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: provider.timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const choice = data.choices[0]
    
    return {
      content: choice.message.content,
      model: data.model || payload.model,
      tokens: {
        prompt: data.usage?.prompt_tokens || this.estimateTokens(payload.messages[0].content),
        completion: data.usage?.completion_tokens || this.estimateTokens(choice.message.content),
        total: data.usage?.total_tokens || 0
      },
      metadata: {
        finishReason: choice.finish_reason
      }
    }
  }

  async callVLLM(provider, request) {
    const url = `${provider.endpoint}/v1/completions`
    
    const payload = {
      model: request.model || provider.models[0],
      prompt: request.prompt,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
      stream: false
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: provider.timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const choice = data.choices[0]
    
    return {
      content: choice.text,
      model: data.model || payload.model,
      tokens: {
        prompt: data.usage?.prompt_tokens || this.estimateTokens(payload.prompt),
        completion: data.usage?.completion_tokens || this.estimateTokens(choice.text),
        total: data.usage?.total_tokens || 0
      },
      metadata: {
        finishReason: choice.finish_reason
      }
    }
  }

  async callLlamaCpp(provider, request) {
    const url = `${provider.endpoint}/v1/chat/completions`
    
    const payload = {
      model: request.model || provider.models[0] || 'llama-model',
      messages: [
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
      stream: false
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: provider.timeout
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const choice = data.choices[0]
    
    return {
      content: choice.message.content,
      model: data.model || payload.model,
      tokens: {
        prompt: data.usage?.prompt_tokens || this.estimateTokens(payload.messages[0].content),
        completion: data.usage?.completion_tokens || this.estimateTokens(choice.message.content),
        total: data.usage?.total_tokens || 0
      },
      metadata: {
        finishReason: choice.finish_reason
      }
    }
  }

  estimateTokens(text) {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  // API Methods for dashboard integration

  getProviderStatus() {
    const status = {}
    
    for (const [name, health] of this.healthStatus) {
      const provider = this.providers.get(name)
      status[name] = {
        type: provider.type,
        endpoint: provider.endpoint,
        status: health.status,
        lastCheck: health.lastCheck,
        latency: health.latency,
        error: health.error,
        models: health.models || provider.models,
        maxConcurrency: provider.maxConcurrency
      }
    }
    
    return status
  }

  getProviderModels(providerName) {
    const provider = this.providers.get(providerName)
    const health = this.healthStatus.get(providerName)
    
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
    }
    
    return {
      provider: providerName,
      models: health?.models || provider.models,
      status: health?.status || 'unknown'
    }
  }

  async testProvider(providerName, testPrompt = "Hello, how are you?") {
    try {
      const startTime = Date.now()
      const response = await this.generateCompletion(providerName, {
        prompt: testPrompt,
        maxTokens: 50,
        temperature: 0.7
      })
      const duration = Date.now() - startTime
      
      return {
        success: true,
        provider: providerName,
        duration,
        response: response.content.substring(0, 100) + (response.content.length > 100 ? '...' : ''),
        tokens: response.tokens
      }
    } catch (error) {
      return {
        success: false,
        provider: providerName,
        error: error.message
      }
    }
  }
}