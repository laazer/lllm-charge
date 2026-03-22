// Performance and load tests for LLM-Charge
import { CommonCommandHandler } from '../../src/utils/common-commands'
import { SmartDocsCache } from '../../src/intelligence/smart-docs-cache'
import { KnowledgeBase } from '../../src/core/knowledge-base'
import { TEST_CONFIG, createMockConfig, MockLLMProvider } from '../setup'
import * as path from 'path'
import * as fs from 'fs/promises'

describe('LLM-Charge Performance Tests', () => {
  let testProjectDir: string
  let mockProvider: MockLLMProvider

  beforeAll(async () => {
    testProjectDir = path.join(TEST_CONFIG.TEST_CACHE_DIR, 'perf-test')
    await fs.mkdir(testProjectDir, { recursive: true })
    mockProvider = new MockLLMProvider()
  })

  afterAll(async () => {
    try {
      await fs.rm(testProjectDir, { recursive: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Command Handler Performance', () => {
    let handler: CommonCommandHandler

    beforeEach(() => {
      handler = new CommonCommandHandler()
    })

    it('should handle high-frequency command execution', async () => {
      const commandCount = 100
      const commands = [
        'current directory',
        'list files',
        'git status',
        'npm install'
      ]

      const startTime = Date.now()
      const promises = []

      for (let i = 0; i < commandCount; i++) {
        const command = commands[i % commands.length]
        promises.push(handler.handleCommand(command, testProjectDir))
      }

      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime
      const avgTime = totalTime / commandCount
      const successRate = results.filter(r => r !== null).length / commandCount

      expect(successRate).toBeGreaterThan(0.8) // At least 80% success rate
      expect(avgTime).toBeLessThan(100) // Average under 100ms per command
      expect(totalTime).toBeLessThan(10000) // Total under 10 seconds

      console.log(`🚀 Command Performance:`)
      console.log(`   Commands: ${commandCount}`)
      console.log(`   Total time: ${totalTime}ms`)
      console.log(`   Average time: ${avgTime.toFixed(1)}ms`)
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`)
    })

    it('should maintain performance under concurrent load', async () => {
      const concurrentUsers = 10
      const commandsPerUser = 20
      const totalCommands = concurrentUsers * commandsPerUser

      const startTime = Date.now()
      const userPromises = []

      for (let user = 0; user < concurrentUsers; user++) {
        const userCommands = []
        
        for (let cmd = 0; cmd < commandsPerUser; cmd++) {
          userCommands.push(handler.handleCommand(`list files`, testProjectDir))
        }
        
        userPromises.push(Promise.all(userCommands))
      }

      const allResults = await Promise.all(userPromises)
      const totalTime = Date.now() - startTime
      const flatResults = allResults.flat()
      const successfulResults = flatResults.filter(r => r && r.success).length

      const throughput = totalCommands / (totalTime / 1000) // commands per second
      const successRate = successfulResults / totalCommands

      expect(successRate).toBeGreaterThan(0.7) // 70% success under load
      expect(throughput).toBeGreaterThan(5) // At least 5 commands/sec
      expect(totalTime).toBeLessThan(60000) // Complete within 1 minute

      console.log(`⚡ Concurrent Load Performance:`)
      console.log(`   Users: ${concurrentUsers}`)
      console.log(`   Commands per user: ${commandsPerUser}`)
      console.log(`   Total commands: ${totalCommands}`)
      console.log(`   Total time: ${totalTime}ms`)
      console.log(`   Throughput: ${throughput.toFixed(1)} commands/sec`)
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`)
    })

    it('should handle command pattern matching efficiently', async () => {
      const testPatterns = 1000
      const randomCommands = []

      // Generate diverse test commands
      const templates = [
        'git {{action}}',
        'npm {{action}}',
        '{{action}} files',
        'create {{type}} {{name}}',
        'docker {{command}}'
      ]

      const actions = ['status', 'install', 'build', 'test', 'list', 'show']
      const types = ['file', 'directory', 'component']
      const names = ['test', 'example', 'demo', 'temp']
      const dockerCommands = ['ps', 'build', 'run', 'logs']

      for (let i = 0; i < testPatterns; i++) {
        const template = templates[Math.floor(Math.random() * templates.length)]
        let command = template
          .replace('{{action}}', actions[Math.floor(Math.random() * actions.length)])
          .replace('{{type}}', types[Math.floor(Math.random() * types.length)])
          .replace('{{name}}', names[Math.floor(Math.random() * names.length)])
          .replace('{{command}}', dockerCommands[Math.floor(Math.random() * dockerCommands.length)])
        
        randomCommands.push(command)
      }

      const startTime = Date.now()
      const results = await Promise.all(
        randomCommands.map(cmd => handler.handleCommand(cmd, testProjectDir))
      )
      const patternMatchTime = Date.now() - startTime

      const recognizedCommands = results.filter(r => r !== null).length
      const recognitionRate = recognizedCommands / testPatterns
      const avgMatchTime = patternMatchTime / testPatterns

      expect(avgMatchTime).toBeLessThan(5) // Under 5ms per pattern match
      expect(recognitionRate).toBeGreaterThan(0.3) // At least 30% recognition rate

      console.log(`🔍 Pattern Matching Performance:`)
      console.log(`   Patterns tested: ${testPatterns}`)
      console.log(`   Total match time: ${patternMatchTime}ms`)
      console.log(`   Average match time: ${avgMatchTime.toFixed(2)}ms`)
      console.log(`   Recognition rate: ${(recognitionRate * 100).toFixed(1)}%`)
    })
  })

  describe('Knowledge Base Performance', () => {
    let knowledgeBase: KnowledgeBase

    beforeEach(async () => {
      const config = createMockConfig()
      knowledgeBase = new KnowledgeBase(path.join(testProjectDir, 'knowledge.db'))
      
      // Mock embedding generation for consistent performance
      jest.spyOn(knowledgeBase as any, 'getOrCreateEmbedding')
        .mockImplementation((text: string) => mockProvider.generateEmbedding(text))
      
      await knowledgeBase.initialize()
    })

    afterEach(async () => {
      await knowledgeBase.cleanup()
    })

    it('should handle large-scale document storage efficiently', async () => {
      const documentCount = 1000
      const avgDocSize = 500 // characters

      console.log(`📚 Testing storage of ${documentCount} documents...`)
      
      const startTime = Date.now()
      const storePromises = []

      for (let i = 0; i < documentCount; i++) {
        const content = `Document ${i} content ${'x'.repeat(avgDocSize - 20)}`
        storePromises.push(
          knowledgeBase.store(`doc-${i}`, content, {
            type: 'test',
            index: i,
            category: i % 5 === 0 ? 'important' : 'regular'
          })
        )
      }

      await Promise.all(storePromises)
      const storageTime = Date.now() - startTime

      const avgStorageTime = storageTime / documentCount
      const throughput = documentCount / (storageTime / 1000) // docs per second

      expect(avgStorageTime).toBeLessThan(50) // Under 50ms per document
      expect(throughput).toBeGreaterThan(10) // At least 10 docs/sec
      expect(storageTime).toBeLessThan(120000) // Complete within 2 minutes

      console.log(`💾 Storage Performance:`)
      console.log(`   Documents: ${documentCount}`)
      console.log(`   Total time: ${storageTime}ms`)
      console.log(`   Average time: ${avgStorageTime.toFixed(1)}ms`)
      console.log(`   Throughput: ${throughput.toFixed(1)} docs/sec`)

      // Test search performance on large dataset
      const searchStartTime = Date.now()
      const searchResults = await knowledgeBase.searchSemantic('important document', { limit: 10 })
      const searchTime = Date.now() - searchStartTime

      expect(searchTime).toBeLessThan(1000) // Search under 1 second
      expect(searchResults.length).toBeGreaterThan(0)

      console.log(`🔍 Search Performance:`)
      console.log(`   Search time: ${searchTime}ms`)
      console.log(`   Results found: ${searchResults.length}`)
    })

    it('should handle concurrent read/write operations', async () => {
      const concurrentOperations = 50
      const readsPerWrite = 3

      const operations = []
      
      // Mix of read and write operations
      for (let i = 0; i < concurrentOperations; i++) {
        if (i % (readsPerWrite + 1) === 0) {
          // Write operation
          operations.push(
            knowledgeBase.store(`concurrent-doc-${i}`, `Content for document ${i}`, { type: 'concurrent' })
          )
        } else {
          // Read operation
          operations.push(
            knowledgeBase.searchSemantic(`document ${Math.floor(i / 4)}`, { limit: 5 })
          )
        }
      }

      const startTime = Date.now()
      const results = await Promise.all(operations)
      const totalTime = Date.now() - startTime

      const avgOperationTime = totalTime / concurrentOperations
      const throughput = concurrentOperations / (totalTime / 1000)

      expect(avgOperationTime).toBeLessThan(200) // Under 200ms average
      expect(throughput).toBeGreaterThan(2) // At least 2 operations/sec
      expect(results.length).toBe(concurrentOperations)

      console.log(`🔄 Concurrent Operations Performance:`)
      console.log(`   Operations: ${concurrentOperations}`)
      console.log(`   Total time: ${totalTime}ms`)
      console.log(`   Average time: ${avgOperationTime.toFixed(1)}ms`)
      console.log(`   Throughput: ${throughput.toFixed(1)} ops/sec`)
    })

    it('should maintain performance with large embeddings cache', async () => {
      const cacheSize = 2000 // Number of embeddings to cache
      
      // Generate and cache embeddings
      const startTime = Date.now()
      for (let i = 0; i < cacheSize; i++) {
        await (knowledgeBase as any).getOrCreateEmbedding(`test embedding ${i}`)
      }
      const cachingTime = Date.now() - startTime

      // Test cache performance
      const cacheTestStart = Date.now()
      const cachedResults = await Promise.all([
        (knowledgeBase as any).getOrCreateEmbedding('test embedding 100'),
        (knowledgeBase as any).getOrCreateEmbedding('test embedding 500'),
        (knowledgeBase as any).getOrCreateEmbedding('test embedding 1000')
      ])
      const cacheRetrievalTime = Date.now() - cacheTestStart

      const avgCachingTime = cachingTime / cacheSize
      const avgRetrievalTime = cacheRetrievalTime / 3

      expect(avgCachingTime).toBeLessThan(100) // Under 100ms per embedding
      expect(avgRetrievalTime).toBeLessThan(10) // Cache retrieval under 10ms
      expect(cachedResults.every(r => r instanceof Float32Array)).toBe(true)

      console.log(`🧠 Embedding Cache Performance:`)
      console.log(`   Cache size: ${cacheSize}`)
      console.log(`   Caching time: ${cachingTime}ms`)
      console.log(`   Average caching: ${avgCachingTime.toFixed(1)}ms`)
      console.log(`   Cache retrieval: ${avgRetrievalTime.toFixed(1)}ms`)
    })
  })

  describe('Smart Documentation Cache Performance', () => {
    it('should handle rapid query processing', async () => {
      const mockKnowledgeBase = {
        initialize: jest.fn(),
        store: jest.fn(),
        searchSemantic: jest.fn().mockResolvedValue([]),
        updateLastAccessed: jest.fn(),
        cleanupExpiredDocs: jest.fn().mockResolvedValue(0),
        cleanup: jest.fn()
      } as any

      const mockDocsIntelligence = {
        getDocumentationStatus: jest.fn().mockResolvedValue({
          installed: ['javascript'],
          available: ['javascript', 'react', 'typescript'],
          storage_size: 1024
        }),
        indexDocumentation: jest.fn().mockResolvedValue()
      } as any

      const smartCache = new SmartDocsCache(
        mockDocsIntelligence,
        mockKnowledgeBase,
        testProjectDir
      )

      const queryCount = 200
      const queries = Array.from({ length: queryCount }, (_, i) => {
        const topics = ['React', 'TypeScript', 'JavaScript', 'Python', 'Docker']
        const actions = ['how to', 'what is', 'examples of', 'best practices']
        const topic = topics[i % topics.length]
        const action = actions[Math.floor(i / topics.length) % actions.length]
        return `${action} ${topic} development`
      })

      const startTime = Date.now()
      const promises = queries.map(query => smartCache.processQuery(query))
      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      const avgProcessingTime = totalTime / queryCount
      const throughput = queryCount / (totalTime / 1000)

      expect(avgProcessingTime).toBeLessThan(50) // Under 50ms per query
      expect(throughput).toBeGreaterThan(10) // At least 10 queries/sec
      expect(results.every(r => Array.isArray(r))).toBe(true)

      console.log(`🧠 Smart Cache Performance:`)
      console.log(`   Queries: ${queryCount}`)
      console.log(`   Total time: ${totalTime}ms`)
      console.log(`   Average time: ${avgProcessingTime.toFixed(1)}ms`)
      console.log(`   Throughput: ${throughput.toFixed(1)} queries/sec`)
    })

    it('should efficiently manage download queues under load', async () => {
      const mockKnowledgeBase = {
        initialize: jest.fn(),
        cleanupExpiredDocs: jest.fn().mockResolvedValue(0)
      } as any

      const mockDocsIntelligence = {
        getDocumentationStatus: jest.fn().mockResolvedValue({
          installed: [],
          available: ['react', 'vue', 'angular', 'typescript', 'python'],
          storage_size: 1024
        }),
        indexDocumentation: jest.fn().mockImplementation(async (docs) => {
          // Simulate download time
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      } as any

      const smartCache = new SmartDocsCache(
        mockDocsIntelligence,
        mockKnowledgeBase,
        testProjectDir,
        {
          autoDownload: true,
          minConfidenceThreshold: 0.7,
          maxDocsPerSession: 10,
          backgroundDownload: true,
          expirationDays: 365
        }
      )

      // Simulate multiple queries that would trigger downloads
      const heavyQueries = [
        'React component optimization',
        'Vue composition API',
        'Angular services',
        'TypeScript generics',
        'Python async programming'
      ]

      const startTime = Date.now()
      const queryPromises = []

      // Send queries rapidly
      for (let i = 0; i < 20; i++) {
        const query = heavyQueries[i % heavyQueries.length]
        queryPromises.push(smartCache.processQuery(query))
      }

      await Promise.all(queryPromises)
      
      // Process the download queue
      const downloadResult = await smartCache.processDownloadQueue()
      const totalTime = Date.now() - startTime

      const queueStatus = await smartCache.getQueueStatus()

      expect(downloadResult.downloaded.length + downloadResult.failed.length).toBeGreaterThan(0)
      expect(totalTime).toBeLessThan(30000) // Complete within 30 seconds
      expect(queueStatus.inProgress.length).toBe(0) // All processing complete

      console.log(`📥 Download Queue Performance:`)
      console.log(`   Total time: ${totalTime}ms`)
      console.log(`   Downloaded: ${downloadResult.downloaded.length}`)
      console.log(`   Failed: ${downloadResult.failed.length}`)
      console.log(`   Queue status: ${queueStatus.queued.length} queued`)
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage()
      
      // Simulate heavy operations
      const handler = new CommonCommandHandler()
      const heavyOperations = []

      for (let i = 0; i < 500; i++) {
        heavyOperations.push(handler.handleCommand('list files', testProjectDir))
      }

      await Promise.all(heavyOperations)
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryGrowthMB = memoryGrowth / 1024 / 1024

      // Memory growth should be reasonable (less than 50MB for 500 operations)
      expect(memoryGrowthMB).toBeLessThan(50)

      console.log(`💾 Memory Usage:`)
      console.log(`   Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`)
      console.log(`   Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`)
      console.log(`   Growth: ${memoryGrowthMB.toFixed(1)}MB`)
    })

    it('should handle resource cleanup efficiently', async () => {
      const config = createMockConfig()
      const knowledgeBase = new KnowledgeBase(path.join(testProjectDir, 'knowledge.db'))
      
      // Mock embedding generation
      jest.spyOn(knowledgeBase as any, 'getOrCreateEmbedding')
        .mockImplementation((text: string) => mockProvider.generateEmbedding(text))
      
      await knowledgeBase.initialize()

      // Create temporary resources
      const resourceCount = 100
      for (let i = 0; i < resourceCount; i++) {
        await knowledgeBase.store(`temp-${i}`, `Temporary content ${i}`, { temp: true })
      }

      const cleanupStartTime = Date.now()
      await knowledgeBase.cleanup()
      const cleanupTime = Date.now() - cleanupStartTime

      expect(cleanupTime).toBeLessThan(5000) // Cleanup should complete quickly

      console.log(`🧹 Resource Cleanup:`)
      console.log(`   Resources: ${resourceCount}`)
      console.log(`   Cleanup time: ${cleanupTime}ms`)
    })
  })

  describe('Stress Testing', () => {
    it('should survive extreme load conditions', async () => {
      const handler = new CommonCommandHandler()
      const extremeLoad = 1000
      const batchSize = 50

      console.log(`💪 Stress testing with ${extremeLoad} operations...`)

      let totalSuccessful = 0
      let totalFailed = 0
      const startTime = Date.now()

      // Process in batches to avoid overwhelming the system
      for (let batch = 0; batch < extremeLoad / batchSize; batch++) {
        const batchPromises = []
        
        for (let i = 0; i < batchSize; i++) {
          const commands = ['current directory', 'list files', 'git status']
          const command = commands[(batch * batchSize + i) % commands.length]
          batchPromises.push(handler.handleCommand(command, testProjectDir))
        }

        try {
          const batchResults = await Promise.all(batchPromises)
          totalSuccessful += batchResults.filter(r => r && r.success).length
          totalFailed += batchResults.filter(r => !r || !r.success).length
        } catch (error) {
          totalFailed += batchSize
        }

        // Small delay between batches to prevent system overload
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const totalTime = Date.now() - startTime
      const successRate = totalSuccessful / (totalSuccessful + totalFailed)
      const throughput = extremeLoad / (totalTime / 1000)

      // Under extreme stress, we expect some degradation but system should remain stable
      expect(successRate).toBeGreaterThan(0.6) // At least 60% success rate
      expect(throughput).toBeGreaterThan(1) // At least 1 operation/sec
      expect(totalTime).toBeLessThan(300000) // Complete within 5 minutes

      console.log(`💪 Stress Test Results:`)
      console.log(`   Total operations: ${extremeLoad}`)
      console.log(`   Successful: ${totalSuccessful}`)
      console.log(`   Failed: ${totalFailed}`)
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`)
      console.log(`   Total time: ${(totalTime / 1000).toFixed(1)}s`)
      console.log(`   Throughput: ${throughput.toFixed(1)} ops/sec`)
    })
  })
})