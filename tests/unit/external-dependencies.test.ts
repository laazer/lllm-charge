import { jest } from '@jest/globals'
import { EventEmitter } from 'events'
import nock from 'nock'
import { HybridRouter } from '../../src/core/hybrid-router.js'
import { CostTracker } from '../../src/core/cost-tracker.js'
import { SmartDocsCache } from '../../src/intelligence/smart-docs-cache.js'
import { LocalLLMRouter } from '../../src/providers/local-llm-router.js'

// Mock external HTTP requests
beforeAll(() => {
  nock.disableNetConnect()
  nock.enableNetConnect('127.0.0.1')
})

afterAll(() => {
  nock.enableNetConnect()
  nock.cleanAll()
})

describe('External Dependencies Testing', () => {
  describe('HTTP API Dependencies', () => {
    describe('OpenAI API Integration', () => {
      test('should handle OpenAI API success response', async () => {
        const openaiScope = nock('https://api.openai.com')
          .post('/v1/chat/completions')
          .reply(200, {
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1234567890,
            model: 'gpt-3.5-turbo',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you today?'
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 8,
              total_tokens: 18
            }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('openai', {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-3.5-turbo'
        })

        expect(result.success).toBe(true)
        expect(result.response).toContain('Hello!')
        expect(result.tokensUsed).toBe(18)
        expect(openaiScope.isDone()).toBe(true)
      })

      test('should handle OpenAI API rate limiting', async () => {
        const openaiScope = nock('https://api.openai.com')
          .post('/v1/chat/completions')
          .reply(429, {
            error: {
              message: 'Rate limit exceeded',
              type: 'requests',
              param: null,
              code: 'rate_limit_exceeded'
            }
          })
          .post('/v1/chat/completions')
          .reply(200, {
            id: 'chatcmpl-retry',
            object: 'chat.completion',
            created: 1234567890,
            model: 'gpt-3.5-turbo',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'Retry successful'
              },
              finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('openai', {
          messages: [{ role: 'user', content: 'Test retry' }],
          model: 'gpt-3.5-turbo'
        }, { retryOnRateLimit: true, maxRetries: 1 })

        expect(result.success).toBe(true)
        expect(result.response).toBe('Retry successful')
        expect(openaiScope.isDone()).toBe(true)
      })

      test('should handle OpenAI API authentication errors', async () => {
        const openaiScope = nock('https://api.openai.com')
          .post('/v1/chat/completions')
          .reply(401, {
            error: {
              message: 'Invalid API key provided',
              type: 'invalid_request_error',
              param: null,
              code: 'invalid_api_key'
            }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('openai', {
          messages: [{ role: 'user', content: 'Test auth' }],
          model: 'gpt-3.5-turbo'
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid API key')
        expect(openaiScope.isDone()).toBe(true)
      })

      test('should handle OpenAI API network timeouts', async () => {
        const openaiScope = nock('https://api.openai.com')
          .post('/v1/chat/completions')
          .delay(35000) // 35 second delay
          .reply(200, { choices: [] })

        const router = new HybridRouter()
        const startTime = Date.now()
        const result = await router.routeToProvider('openai', {
          messages: [{ role: 'user', content: 'Test timeout' }],
          model: 'gpt-3.5-turbo'
        }, { timeout: 30000 })

        const elapsed = Date.now() - startTime
        expect(elapsed).toBeLessThan(32000) // Should timeout before 32s
        expect(result.success).toBe(false)
        expect(result.error).toContain('timeout')

        openaiScope.done()
      })

      test('should handle OpenAI API partial responses', async () => {
        const openaiScope = nock('https://api.openai.com')
          .post('/v1/chat/completions')
          .reply(200, {
            id: 'chatcmpl-partial',
            object: 'chat.completion',
            created: 1234567890,
            model: 'gpt-3.5-turbo',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'This response was cut off due to length lim'
              },
              finish_reason: 'length'
            }],
            usage: { prompt_tokens: 20, completion_tokens: 100, total_tokens: 120 }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('openai', {
          messages: [{ role: 'user', content: 'Write a long response' }],
          model: 'gpt-3.5-turbo'
        })

        expect(result.success).toBe(true)
        expect(result.finishReason).toBe('length')
        expect(result.truncated).toBe(true)
        expect(openaiScope.isDone()).toBe(true)
      })
    })

    describe('Anthropic API Integration', () => {
      test('should handle Anthropic API success response', async () => {
        const anthropicScope = nock('https://api.anthropic.com')
          .post('/v1/messages')
          .reply(200, {
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            content: [{
              type: 'text',
              text: 'Hello! I\'m Claude, how can I assist you today?'
            }],
            model: 'claude-3-haiku-20240307',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
              input_tokens: 12,
              output_tokens: 11
            }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('anthropic', {
          messages: [{ role: 'user', content: 'Hello Claude' }],
          model: 'claude-3-haiku',
          max_tokens: 1000
        })

        expect(result.success).toBe(true)
        expect(result.response).toContain('Claude')
        expect(result.tokensUsed).toBe(23)
        expect(anthropicScope.isDone()).toBe(true)
      })

      test('should handle Anthropic API usage limits', async () => {
        const anthropicScope = nock('https://api.anthropic.com')
          .post('/v1/messages')
          .reply(429, {
            type: 'error',
            error: {
              type: 'rate_limit_error',
              message: 'Rate limit exceeded'
            }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('anthropic', {
          messages: [{ role: 'user', content: 'Test limit' }],
          model: 'claude-3-sonnet',
          max_tokens: 1000
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Rate limit exceeded')
        expect(anthropicScope.isDone()).toBe(true)
      })

      test('should handle Anthropic API content filtering', async () => {
        const anthropicScope = nock('https://api.anthropic.com')
          .post('/v1/messages')
          .reply(400, {
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message: 'Content filtered due to policy violation'
            }
          })

        const router = new HybridRouter()
        const result = await router.routeToProvider('anthropic', {
          messages: [{ role: 'user', content: 'Harmful content example' }],
          model: 'claude-3-sonnet',
          max_tokens: 1000
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Content filtered')
        expect(result.filtered).toBe(true)
        expect(anthropicScope.isDone()).toBe(true)
      })
    })

    describe('Local LLM Dependencies', () => {
      test('should handle Ollama service availability', async () => {
        const ollamaScope = nock('http://localhost:11434')
          .get('/api/tags')
          .reply(200, {
            models: [
              { name: 'llama2:latest', size: 3826793677 },
              { name: 'codellama:latest', size: 3826793677 }
            ]
          })
          .post('/api/generate')
          .reply(200, {
            model: 'llama2',
            created_at: '2024-01-01T12:00:00Z',
            response: 'Hello from Ollama!',
            done: true,
            context: [1, 2, 3],
            total_duration: 5000000000,
            load_duration: 400000000,
            prompt_eval_count: 10,
            prompt_eval_duration: 300000000,
            eval_count: 5,
            eval_duration: 200000000
          })

        const router = new LocalLLMRouter()
        const models = await router.getAvailableModels('ollama')
        expect(models).toContain('llama2:latest')

        const result = await router.generateCompletion('llama2', 'Hello Ollama')
        expect(result.success).toBe(true)
        expect(result.response).toBe('Hello from Ollama!')
        expect(ollamaScope.isDone()).toBe(true)
      })

      test('should handle Ollama service unavailability', async () => {
        const ollamaScope = nock('http://localhost:11434')
          .get('/api/tags')
          .replyWithError({ code: 'ECONNREFUSED', message: 'Connection refused' })

        const router = new LocalLLMRouter()
        const models = await router.getAvailableModels('ollama')
        expect(models).toEqual([])
        
        const result = await router.generateCompletion('llama2', 'Test unavailable')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Connection refused')
        expect(ollamaScope.isDone()).toBe(true)
      })

      test('should handle LM Studio integration', async () => {
        const lmStudioScope = nock('http://localhost:1234')
          .get('/v1/models')
          .reply(200, {
            object: 'list',
            data: [
              { id: 'local-model', object: 'model', created: 1234567890, owned_by: 'lm-studio' }
            ]
          })
          .post('/v1/completions')
          .reply(200, {
            id: 'cmpl-local',
            object: 'text_completion',
            created: 1234567890,
            model: 'local-model',
            choices: [{
              text: 'Response from LM Studio',
              index: 0,
              finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 }
          })

        const router = new LocalLLMRouter()
        const models = await router.getAvailableModels('lm-studio')
        expect(models).toContain('local-model')

        const result = await router.generateCompletion('local-model', 'Test LM Studio')
        expect(result.success).toBe(true)
        expect(result.response).toBe('Response from LM Studio')
        expect(lmStudioScope.isDone()).toBe(true)
      })
    })
  })

  describe('Database Dependencies', () => {
    test('should handle SQLite database operations', async () => {
      const mockDb = {
        prepare: jest.fn(() => ({
          run: jest.fn(),
          get: jest.fn(() => ({ id: 1, name: 'test' })),
          all: jest.fn(() => [{ id: 1, name: 'test1' }, { id: 2, name: 'test2' }])
        })),
        exec: jest.fn(),
        close: jest.fn()
      }

      const costTracker = new CostTracker()
      ;(costTracker as any).db = mockDb

      await costTracker.recordCost('test-call', 0.05, 'gpt-3.5-turbo')
      expect(mockDb.prepare).toHaveBeenCalled()

      const costs = await costTracker.getCosts('24h')
      expect(costs.totalCost).toBeGreaterThanOrEqual(0)
    })

    test('should handle database connection failures', async () => {
      const mockDb = {
        prepare: jest.fn(() => {
          throw new Error('SQLITE_CANTOPEN: unable to open database file')
        })
      }

      const costTracker = new CostTracker()
      ;(costTracker as any).db = mockDb

      const result = await costTracker.recordCost('test-call', 0.05, 'gpt-3.5-turbo')
      expect(result.success).toBe(false)
      expect(result.error).toContain('unable to open database')
    })

    test('should handle database corruption', async () => {
      const mockDb = {
        prepare: jest.fn(() => {
          throw new Error('SQLITE_CORRUPT: database disk image is malformed')
        })
      }

      const costTracker = new CostTracker()
      ;(costTracker as any).db = mockDb

      const result = await costTracker.initializeDatabase()
      expect(result.success).toBe(false)
      expect(result.requiresRecovery).toBe(true)
    })
  })

  describe('File System Dependencies', () => {
    test('should handle file system permissions', async () => {
      const fs = await import('fs/promises')
      
      // Mock permission denied error
      ;(fs.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      )

      const docsCache = new SmartDocsCache()
      const result = await docsCache.cacheDocs('test-framework', 'test content')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('permission denied')
    })

    test('should handle disk space limitations', async () => {
      const fs = await import('fs/promises')
      
      // Mock disk full error
      ;(fs.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      )

      const docsCache = new SmartDocsCache()
      const result = await docsCache.cacheDocs('large-framework', 'x'.repeat(1000000))
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('no space left')
    })

    test('should handle concurrent file access', async () => {
      const fs = await import('fs/promises')
      
      // Mock file busy error
      ;(fs.readFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      )

      const docsCache = new SmartDocsCache()
      const result = await docsCache.loadCachedDocs('concurrent-test')
      
      expect(result.success).toBe(false)
      expect(result.retry).toBe(true)
    })

    test('should handle file corruption', async () => {
      const fs = await import('fs/promises')
      
      // Mock corrupted JSON file
      ;(fs.readFile as jest.Mock).mockResolvedValue('{"incomplete": json')

      const docsCache = new SmartDocsCache()
      const result = await docsCache.loadCachedDocs('corrupted-test')
      
      expect(result.success).toBe(false)
      expect(result.corrupted).toBe(true)
      expect(result.requiresRedownload).toBe(true)
    })
  })

  describe('Network Dependencies', () => {
    test('should handle DNS resolution failures', async () => {
      const scope = nock('https://nonexistent-domain.invalid')
        .get('/api/test')
        .replyWithError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND nonexistent-domain.invalid' })

      const router = new HybridRouter()
      const result = await router.testProviderConnection('https://nonexistent-domain.invalid/api/test')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('ENOTFOUND')
      expect(scope.isDone()).toBe(true)
    })

    test('should handle SSL certificate errors', async () => {
      const scope = nock('https://self-signed.badssl.com')
        .get('/api/test')
        .replyWithError({ code: 'CERT_HAS_EXPIRED', message: 'certificate has expired' })

      const router = new HybridRouter()
      const result = await router.testProviderConnection('https://self-signed.badssl.com/api/test')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('certificate has expired')
      expect(scope.isDone()).toBe(true)
    })

    test('should handle proxy configuration issues', async () => {
      // Mock proxy authentication failure
      const scope = nock('https://api.example.com')
        .get('/test')
        .reply(407, {
          error: 'Proxy Authentication Required',
          message: 'The proxy requires authentication'
        })

      const router = new HybridRouter()
      const result = await router.testProviderConnection('https://api.example.com/test', {
        proxy: 'http://proxy.company.com:8080'
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Proxy Authentication Required')
      expect(scope.isDone()).toBe(true)
    })

    test('should handle network interruptions', async () => {
      const scope = nock('https://api.example.com')
        .get('/test')
        .replyWithError({ code: 'ECONNRESET', message: 'socket hang up' })

      const router = new HybridRouter()
      const result = await router.testProviderConnection('https://api.example.com/test', {
        retryOnNetworkError: true,
        maxRetries: 2
      })
      
      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(2)
      expect(scope.isDone()).toBe(true)
    })
  })

  describe('Process Dependencies', () => {
    test('should handle child process spawn failures', async () => {
      const { spawn } = await import('child_process')
      
      // Mock spawn failure
      ;(spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = new EventEmitter()
        setTimeout(() => {
          mockProcess.emit('error', new Error('ENOENT: spawn git ENOENT'))
        }, 10)
        return mockProcess
      })

      const router = new HybridRouter()
      const result = await router.executeShellCommand('git status')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('ENOENT')
    })

    test('should handle process memory limits', async () => {
      const { spawn } = await import('child_process')
      
      // Mock process that exceeds memory limit
      ;(spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = new EventEmitter()
        setTimeout(() => {
          mockProcess.emit('error', new Error('Process exceeded memory limit'))
        }, 10)
        return mockProcess
      })

      const router = new HybridRouter()
      const result = await router.executeShellCommand('node memory-intensive-script.js', {
        maxMemory: '512MB'
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('memory limit')
    })

    test('should handle process timeouts', async () => {
      const { spawn } = await import('child_process')
      
      // Mock long-running process
      ;(spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = new EventEmitter()
        // Never emit 'close' event to simulate hanging process
        return mockProcess
      })

      const router = new HybridRouter()
      const startTime = Date.now()
      const result = await router.executeShellCommand('sleep 60', { timeout: 1000 })
      const elapsed = Date.now() - startTime
      
      expect(elapsed).toBeLessThan(1500)
      expect(result.success).toBe(false)
      expect(result.timedOut).toBe(true)
    })
  })

  describe('External Service Dependencies', () => {
    test('should handle Docker service unavailability', async () => {
      const dockerScope = nock('http://localhost:2375')
        .get('/containers/json')
        .replyWithError({ code: 'ECONNREFUSED', message: 'Docker daemon not running' })

      const router = new HybridRouter()
      const result = await router.checkDockerContainers()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Docker daemon not running')
      expect(dockerScope.isDone()).toBe(true)
    })

    test('should handle Redis connection failures', async () => {
      // Mock Redis connection
      const mockRedis = {
        connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused')),
        get: jest.fn(),
        set: jest.fn(),
        quit: jest.fn()
      }

      const costTracker = new CostTracker()
      ;(costTracker as any).redis = mockRedis

      const result = await costTracker.connectToCache()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Connection refused')
    })

    test('should handle webhook delivery failures', async () => {
      const webhookScope = nock('https://webhook.example.com')
        .post('/alerts')
        .reply(503, { error: 'Service temporarily unavailable' })

      const router = new HybridRouter()
      const result = await router.sendWebhook('https://webhook.example.com/alerts', {
        alert: 'High cost threshold exceeded',
        timestamp: new Date().toISOString()
      })

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(503)
      expect(webhookScope.isDone()).toBe(true)
    })
  })

  describe('Recovery and Fallback Mechanisms', () => {
    test('should implement circuit breaker for failing services', async () => {
      let callCount = 0
      const failingScope = nock('https://unreliable-api.com')
        .persist()
        .post('/api/generate')
        .reply(() => {
          callCount++
          if (callCount <= 3) {
            return [500, { error: 'Internal server error' }]
          }
          return [200, { response: 'Success after failures' }]
        })

      const router = new HybridRouter()
      router.enableCircuitBreaker('unreliable-api.com', {
        failureThreshold: 3,
        timeout: 1000
      })

      // First 3 calls should fail and trip circuit breaker
      for (let i = 0; i < 3; i++) {
        const result = await router.routeToProvider('unreliable', {
          messages: [{ role: 'user', content: 'test' }]
        })
        expect(result.success).toBe(false)
      }

      // 4th call should be blocked by circuit breaker
      const blockedResult = await router.routeToProvider('unreliable', {
        messages: [{ role: 'user', content: 'test' }]
      })
      expect(blockedResult.success).toBe(false)
      expect(blockedResult.circuitBreakerOpen).toBe(true)

      // After timeout, circuit should allow test call
      await new Promise(resolve => setTimeout(resolve, 1100))
      const recoveryResult = await router.routeToProvider('unreliable', {
        messages: [{ role: 'user', content: 'test' }]
      })
      expect(recoveryResult.success).toBe(true)

      nock.cleanAll()
    })

    test('should implement graceful degradation', async () => {
      // Primary service fails
      const primaryScope = nock('https://primary-api.com')
        .post('/v1/chat')
        .reply(503, { error: 'Service unavailable' })

      // Fallback service succeeds
      const fallbackScope = nock('https://fallback-api.com')
        .post('/v1/completions')
        .reply(200, {
          choices: [{ text: 'Fallback response' }],
          usage: { total_tokens: 10 }
        })

      const router = new HybridRouter()
      const result = await router.routeToProvider('primary', {
        messages: [{ role: 'user', content: 'test' }],
        fallbackProvider: 'fallback'
      })

      expect(result.success).toBe(true)
      expect(result.response).toBe('Fallback response')
      expect(result.usedFallback).toBe(true)
      expect(primaryScope.isDone()).toBe(true)
      expect(fallbackScope.isDone()).toBe(true)
    })

    test('should implement retry with exponential backoff', async () => {
      let attemptCount = 0
      const retryScope = nock('https://retry-api.com')
        .persist()
        .post('/api/generate')
        .reply(() => {
          attemptCount++
          if (attemptCount < 3) {
            return [429, { error: 'Rate limit exceeded', retry_after: 1 }]
          }
          return [200, { response: 'Success after retries' }]
        })

      const router = new HybridRouter()
      const startTime = Date.now()
      const result = await router.routeToProvider('retry', {
        messages: [{ role: 'user', content: 'test' }]
      }, {
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 100,
          backoffMultiplier: 2,
          maxDelay: 1000
        }
      })

      const elapsed = Date.now() - startTime
      expect(result.success).toBe(true)
      expect(result.response).toBe('Success after retries')
      expect(result.retryCount).toBe(2)
      expect(elapsed).toBeGreaterThan(300) // Should have waited for backoff

      nock.cleanAll()
    })

    test('should implement health check monitoring', async () => {
      const healthScope = nock('https://monitored-api.com')
        .get('/health')
        .reply(200, { status: 'healthy', uptime: 12345 })
        .get('/health')
        .reply(503, { status: 'unhealthy', error: 'Database connection lost' })
        .get('/health')
        .reply(200, { status: 'healthy', uptime: 12400 })

      const router = new HybridRouter()
      router.startHealthMonitoring('monitored-api.com', {
        interval: 100,
        unhealthyThreshold: 1,
        healthyThreshold: 1
      })

      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(router.getServiceHealth('monitored-api.com')).toBe('healthy')

      // Wait for unhealthy check
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(router.getServiceHealth('monitored-api.com')).toBe('unhealthy')

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(router.getServiceHealth('monitored-api.com')).toBe('healthy')

      router.stopHealthMonitoring('monitored-api.com')
      nock.cleanAll()
    })
  })

  describe('Resource Management', () => {
    test('should implement connection pooling', async () => {
      const poolScope = nock('https://pooled-api.com')
        .persist()
        .post('/api/generate')
        .reply(200, { response: 'Pooled response' })

      const router = new HybridRouter()
      router.enableConnectionPooling('pooled-api.com', {
        maxConnections: 5,
        idleTimeout: 5000,
        connectionTimeout: 1000
      })

      // Make multiple concurrent requests
      const promises = Array(10).fill(0).map(() =>
        router.routeToProvider('pooled', {
          messages: [{ role: 'user', content: 'test' }]
        })
      )

      const results = await Promise.all(promises)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      const poolStats = router.getConnectionPoolStats('pooled-api.com')
      expect(poolStats.activeConnections).toBeLessThanOrEqual(5)
      expect(poolStats.totalRequests).toBe(10)

      nock.cleanAll()
    })

    test('should implement request queuing under load', async () => {
      const queueScope = nock('https://queued-api.com')
        .persist()
        .post('/api/generate')
        .delay(100) // Simulate slow responses
        .reply(200, { response: 'Queued response' })

      const router = new HybridRouter()
      router.enableRequestQueuing('queued-api.com', {
        maxQueueSize: 10,
        maxConcurrent: 3,
        timeout: 5000
      })

      // Submit more requests than concurrent limit
      const promises = Array(8).fill(0).map((_, i) =>
        router.routeToProvider('queued', {
          messages: [{ role: 'user', content: `request ${i}` }]
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(promises)
      const elapsed = Date.now() - startTime

      // Should queue requests and process in batches
      expect(results.every(r => r.success)).toBe(true)
      expect(elapsed).toBeGreaterThan(200) // At least 2 batches
      expect(elapsed).toBeLessThan(400)    // But not sequential

      const queueStats = router.getQueueStats('queued-api.com')
      expect(queueStats.totalProcessed).toBe(8)
      expect(queueStats.maxQueueSize).toBeLessThanOrEqual(5)

      nock.cleanAll()
    })

    test('should implement memory pressure handling', async () => {
      // Mock memory usage monitoring
      const originalMemory = process.memoryUsage
      process.memoryUsage = jest.fn(() => ({
        rss: 500 * 1024 * 1024,    // 500MB
        heapTotal: 400 * 1024 * 1024, // 400MB
        heapUsed: 380 * 1024 * 1024,  // 380MB (95% heap usage)
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      }))

      const router = new HybridRouter()
      router.enableMemoryMonitoring({
        heapThreshold: 0.9,        // 90% heap usage
        cleanupInterval: 1000,
        forcedGcThreshold: 0.95
      })

      const memoryStatus = router.getMemoryStatus()
      expect(memoryStatus.underPressure).toBe(true)
      expect(memoryStatus.heapUsagePercent).toBeGreaterThan(0.9)

      // Should trigger cache cleanup
      await router.handleMemoryPressure()
      expect(router.getCacheSize()).toBeLessThan(1000)

      process.memoryUsage = originalMemory
    })
  })
})