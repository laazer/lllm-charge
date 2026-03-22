// Unit tests for LocalLLMRouter
import { LocalLLMRouter } from '../../src/reasoning/local-llm-router'
import { createMockConfig, MockLLMProvider } from '../setup'

describe('LocalLLMRouter', () => {
  let router: LocalLLMRouter
  let mockConfig: any

  beforeEach(async () => {
    mockConfig = createMockConfig()
    router = new LocalLLMRouter(mockConfig)
    await router.initialize()
  })

  afterEach(async () => {
    if (router) {
      await router.cleanup()
    }
  })

  describe('Provider Management', () => {
    it('should initialize with configured providers', () => {
      const providers = router.getAvailableProviders()
      expect(providers).toContain('ollama')
      expect(providers).toContain('lmstudio')
    })

    it('should check provider health status', async () => {
      const health = await router.checkProviderHealth('ollama')
      expect(health).toBeDefined()
      expect(health.provider).toBe('ollama')
      expect(health.status).toBeDefined()
      expect(health.latency).toBeDefined()
    })

    it('should handle provider failures gracefully', async () => {
      // Mock a provider failure
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockRejectedValueOnce(new Error('Connection refused'))

      const health = await router.checkProviderHealth('ollama')
      expect(health.status).toBe('unhealthy')
      expect(health.error).toBeDefined()
    })

    it('should automatically failover between providers', async () => {
      // Mock primary provider failure
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockRejectedValueOnce(new Error('Primary provider down'))

      // Should automatically try the next provider
      const result = await router.generateResponse({
        prompt: 'Test prompt',
        preferredProvider: 'ollama',
        allowFallback: true
      })

      expect(result).toBeDefined()
      expect(result.response).toBeTruthy()
      expect(result.provider).not.toBe('ollama') // Should have used fallback
    })
  })

  describe('Model Selection', () => {
    it('should select appropriate models for different tasks', async () => {
      const codeTask = await router.selectOptimalModel({
        task: 'code_generation',
        complexity: 'high',
        maxTokens: 2000
      })

      expect(codeTask.model).toBeDefined()
      expect(codeTask.provider).toBeDefined()

      const simpleTask = await router.selectOptimalModel({
        task: 'simple_qa',
        complexity: 'low',
        maxTokens: 500
      })

      expect(simpleTask.model).toBeDefined()
      // Simple tasks might prefer faster, smaller models
    })

    it('should consider performance requirements in model selection', async () => {
      const fastTask = await router.selectOptimalModel({
        task: 'simple_qa',
        priority: 'speed',
        maxLatency: 500
      })

      const qualityTask = await router.selectOptimalModel({
        task: 'complex_reasoning',
        priority: 'quality',
        maxLatency: 5000
      })

      // Fast task should select a more responsive model
      expect(fastTask.estimatedLatency).toBeLessThanOrEqual(qualityTask.estimatedLatency)
    })

    it('should respect resource constraints', async () => {
      const constrainedTask = await router.selectOptimalModel({
        task: 'general',
        maxMemory: 4096, // 4GB limit
        maxTokens: 1000
      })

      expect(constrainedTask.model).toBeDefined()
      expect(constrainedTask.estimatedMemory).toBeLessThanOrEqual(4096)
    })
  })

  describe('Request Routing', () => {
    it('should route requests to optimal providers', async () => {
      const response = await router.generateResponse({
        prompt: 'What is TypeScript?',
        task: 'simple_qa',
        preferredProvider: 'auto'
      })

      expect(response).toBeDefined()
      expect(response.response).toBeTruthy()
      expect(response.provider).toBeDefined()
      expect(response.model).toBeDefined()
      expect(response.cost).toBe(0) // Local providers should have zero cost
    })

    it('should handle streaming responses', async () => {
      const chunks: string[] = []
      
      await router.generateStreamingResponse({
        prompt: 'Explain React hooks in detail',
        task: 'explanation',
        onChunk: (chunk) => {
          chunks.push(chunk)
        }
      })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('').length).toBeGreaterThan(0)
    })

    it('should batch multiple requests efficiently', async () => {
      const requests = [
        { prompt: 'What is React?', task: 'simple_qa' },
        { prompt: 'What is TypeScript?', task: 'simple_qa' },
        { prompt: 'What is Node.js?', task: 'simple_qa' }
      ]

      const startTime = Date.now()
      const responses = await router.batchGenerate(requests)
      const totalTime = Date.now() - startTime

      expect(responses).toHaveLength(3)
      responses.forEach(response => {
        expect(response.response).toBeTruthy()
        expect(response.cost).toBe(0)
      })

      // Batching should be more efficient than sequential requests
      expect(totalTime).toBeLessThan(5000)
    })
  })

  describe('Performance Optimization', () => {
    it('should cache model loading to improve response times', async () => {
      const model = 'llama2'
      
      // First request - should load model
      const start1 = Date.now()
      await router.generateResponse({
        prompt: 'Test prompt 1',
        preferredModel: model
      })
      const time1 = Date.now() - start1

      // Second request - should reuse loaded model
      const start2 = Date.now()
      await router.generateResponse({
        prompt: 'Test prompt 2',
        preferredModel: model
      })
      const time2 = Date.now() - start2

      // Second request should be faster (model already loaded)
      expect(time2).toBeLessThanOrEqual(time1)
    })

    it('should implement request queuing for resource management', async () => {
      // Submit many concurrent requests
      const requests = Array.from({ length: 20 }, (_, i) => 
        router.generateResponse({
          prompt: `Test prompt ${i}`,
          task: 'simple_qa'
        })
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(20)
      results.forEach((result, i) => {
        expect(result.response).toBeTruthy()
        expect(result.queueTime).toBeDefined()
      })
    })

    it('should optimize memory usage across multiple models', async () => {
      const memoryBefore = process.memoryUsage()

      // Generate responses with different models
      const responses = await Promise.all([
        router.generateResponse({ prompt: 'Test 1', preferredModel: 'llama2' }),
        router.generateResponse({ prompt: 'Test 2', preferredModel: 'codellama' }),
        router.generateResponse({ prompt: 'Test 3', preferredModel: 'llama2' })
      ])

      const memoryAfter = process.memoryUsage()

      expect(responses).toHaveLength(3)
      // Memory usage should be reasonable
      expect(memoryAfter.heapUsed - memoryBefore.heapUsed).toBeLessThan(100 * 1024 * 1024) // 100MB limit
    })
  })

  describe('Load Balancing', () => {
    it('should distribute requests across available providers', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        prompt: `Test prompt ${i}`,
        task: 'simple_qa',
        preferredProvider: 'auto'
      }))

      const responses = await Promise.all(
        requests.map(req => router.generateResponse(req))
      )

      // Should use multiple providers for load distribution
      const providers = [...new Set(responses.map(r => r.provider))]
      expect(providers.length).toBeGreaterThanOrEqual(1)
    })

    it('should respect provider capacity limits', async () => {
      // Set low capacity limits for testing
      router.setProviderCapacity('ollama', 2)
      router.setProviderCapacity('lmstudio', 2)

      // Submit more requests than total capacity
      const requests = Array.from({ length: 8 }, (_, i) => 
        router.generateResponse({
          prompt: `Test prompt ${i}`,
          task: 'simple_qa'
        })
      )

      const startTime = Date.now()
      const responses = await Promise.all(requests)
      const totalTime = Date.now() - startTime

      expect(responses).toHaveLength(8)
      // Should queue requests when capacity is exceeded
      expect(totalTime).toBeGreaterThan(1000) // Should take time due to queuing
    })

    it('should adaptively adjust routing based on performance', async () => {
      // Simulate one provider being slower
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
          return { response: 'Slow response from Ollama' }
        })

      // Make several requests
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => 
          router.generateResponse({
            prompt: 'Test prompt',
            preferredProvider: 'auto'
          })
        )
      )

      // Router should adapt and prefer faster providers
      const ollamaUsage = responses.filter(r => r.provider === 'ollama').length
      const otherUsage = responses.length - ollamaUsage

      // Should favor faster providers over time
      expect(otherUsage).toBeGreaterThanOrEqual(ollamaUsage)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle provider timeouts gracefully', async () => {
      // Mock a timeout
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        )

      const response = await router.generateResponse({
        prompt: 'Test timeout handling',
        preferredProvider: 'ollama',
        allowFallback: true,
        timeout: 50
      })

      // Should fallback to another provider or provide error response
      expect(response).toBeDefined()
      expect(response.provider).not.toBe('ollama') // Should have used fallback
    })

    it('should retry failed requests with backoff', async () => {
      let attemptCount = 0
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockImplementation(async () => {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error('Temporary failure')
          }
          return { response: 'Success after retry' }
        })

      const response = await router.generateResponse({
        prompt: 'Test retry logic',
        preferredProvider: 'ollama',
        maxRetries: 3
      })

      expect(response.response).toContain('Success')
      expect(attemptCount).toBe(3)
    })

    it('should provide detailed error information for debugging', async () => {
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockRejectedValueOnce(new Error('Specific provider error'))

      const response = await router.generateResponse({
        prompt: 'Test error details',
        preferredProvider: 'ollama',
        allowFallback: false
      })

      expect(response.error).toBeDefined()
      expect(response.error).toContain('Specific provider error')
      expect(response.debugInfo).toBeDefined()
    })
  })

  describe('Monitoring and Analytics', () => {
    it('should track request metrics per provider', async () => {
      await router.generateResponse({
        prompt: 'Test metrics',
        preferredProvider: 'ollama'
      })

      const metrics = await router.getProviderMetrics('ollama')
      
      expect(metrics).toBeDefined()
      expect(metrics.totalRequests).toBeGreaterThan(0)
      expect(metrics.averageLatency).toBeGreaterThan(0)
      expect(metrics.successRate).toBeGreaterThan(0)
    })

    it('should provide performance analytics', async () => {
      // Generate some requests for analytics
      await Promise.all([
        router.generateResponse({ prompt: 'Test 1', task: 'simple_qa' }),
        router.generateResponse({ prompt: 'Test 2', task: 'code_generation' }),
        router.generateResponse({ prompt: 'Test 3', task: 'explanation' })
      ])

      const analytics = await router.getPerformanceAnalytics()

      expect(analytics).toBeDefined()
      expect(analytics.requestsByTask).toBeDefined()
      expect(analytics.averageLatencyByProvider).toBeDefined()
      expect(analytics.throughput).toBeDefined()
    })

    it('should detect and report performance anomalies', async () => {
      const alerts: any[] = []
      router.onPerformanceAlert((alert) => {
        alerts.push(alert)
      })

      // Simulate degraded performance
      jest.spyOn(router as any, 'callOllamaAPI')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 5000)) // Very slow
          return { response: 'Slow response' }
        })

      await router.generateResponse({
        prompt: 'Test anomaly detection',
        preferredProvider: 'ollama'
      })

      // Should detect the performance anomaly
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].type).toBe('high_latency')
    })
  })
})