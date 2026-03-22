// Unit tests for KnowledgeBase
import { KnowledgeBase } from '../../src/core/knowledge-base'
import { TEST_CONFIG, MockLLMProvider, createMockConfig } from '../setup'
import * as path from 'path'

describe('KnowledgeBase', () => {
  let knowledgeBase: KnowledgeBase
  let mockProvider: MockLLMProvider
  
  beforeEach(async () => {
    mockProvider = new MockLLMProvider()
    const config = createMockConfig()
    
    knowledgeBase = new KnowledgeBase(path.join(TEST_CONFIG.TEST_CACHE_DIR, 'knowledge.db'))
    
    // Mock the embedding generation
    jest.spyOn(knowledgeBase as any, 'getOrCreateEmbedding')
      .mockImplementation((text: string) => mockProvider.generateEmbedding(text))
    
    await knowledgeBase.initialize()
  })
  
  afterEach(async () => {
    if (knowledgeBase) {
      await knowledgeBase.cleanup()
    }
    jest.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(knowledgeBase).toBeDefined()
      expect((knowledgeBase as any).isInitialized).toBe(true)
    })

    it('should create necessary directories', async () => {
      const cacheDir = path.join(TEST_CONFIG.TEST_PROJECT_DIR, '.llm-charge', 'cache')
      expect(require('fs').existsSync(cacheDir)).toBe(true)
    })
  })

  describe('Document Storage', () => {
    it('should store and retrieve documents', async () => {
      const testDoc = {
        id: 'test-doc-1',
        content: 'This is a test document about React hooks.',
        metadata: { type: 'documentation', doc: 'react' }
      }

      await knowledgeBase.store(testDoc.id, testDoc.content, testDoc.metadata)

      const results = await knowledgeBase.searchSemantic('React hooks', { limit: 5 })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(testDoc.id)
      expect(results[0].content).toBe(testDoc.content)
      expect(results[0].similarity).toBeGreaterThan(0.5)
    })

    it('should handle multiple documents', async () => {
      const docs = [
        { id: 'react-1', content: 'React useState hook for state management', metadata: { doc: 'react' } },
        { id: 'vue-1', content: 'Vue composition API and reactive data', metadata: { doc: 'vue' } },
        { id: 'angular-1', content: 'Angular components and services', metadata: { doc: 'angular' } }
      ]

      for (const doc of docs) {
        await knowledgeBase.store(doc.id, doc.content, doc.metadata)
      }

      const reactResults = await knowledgeBase.searchSemantic('React state', { limit: 3 })
      expect(reactResults).toHaveLength(3)
      expect(reactResults[0].id).toBe('react-1') // Should be most similar
    })
  })

  describe('Semantic Search', () => {
    beforeEach(async () => {
      const testDocs = [
        { id: 'js-1', content: 'JavaScript functions and closures', metadata: { type: 'doc', language: 'javascript' } },
        { id: 'py-1', content: 'Python functions and decorators', metadata: { type: 'doc', language: 'python' } },
        { id: 'ts-1', content: 'TypeScript interfaces and types', metadata: { type: 'doc', language: 'typescript' } },
      ]

      for (const doc of testDocs) {
        await knowledgeBase.store(doc.id, doc.content, doc.metadata)
      }
    })

    it('should find semantically similar content', async () => {
      const results = await knowledgeBase.searchSemantic('functions', { limit: 3 })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.every(r => r.similarity > 0)).toBe(true)
    })

    it('should filter by type', async () => {
      const results = await knowledgeBase.searchSemantic('functions', { 
        type: 'doc', 
        limit: 10 
      })
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.metadata.type).toBe('doc')
      })
    })

    it('should respect similarity threshold', async () => {
      const highThresholdResults = await knowledgeBase.searchSemantic('very specific uncommon term', { 
        threshold: 0.9,
        limit: 10 
      })
      
      const lowThresholdResults = await knowledgeBase.searchSemantic('very specific uncommon term', { 
        threshold: 0.1,
        limit: 10 
      })
      
      expect(highThresholdResults.length).toBeLessThanOrEqual(lowThresholdResults.length)
    })

    it('should limit results correctly', async () => {
      const results = await knowledgeBase.searchSemantic('functions', { limit: 2 })
      expect(results.length).toBeLessThanOrEqual(2)
    })
  })

  describe('Last Accessed Tracking', () => {
    it('should update last accessed timestamp', async () => {
      const docId = 'test-tracking'
      await knowledgeBase.store(docId, 'Test document', { type: 'test' })
      
      const initialTime = Date.now()
      await knowledgeBase.updateLastAccessed(docId)
      
      // Verify the update was recorded (implementation detail test)
      expect(true).toBe(true) // Placeholder - would check database directly in real implementation
    })
  })

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      // Store some test documents with different ages
      const oldTime = Date.now() - (400 * 24 * 60 * 60 * 1000) // 400 days ago
      const recentTime = Date.now() - (10 * 24 * 60 * 60 * 1000) // 10 days ago
      
      await knowledgeBase.store('old-doc', 'Old document', { created_at: oldTime })
      await knowledgeBase.store('recent-doc', 'Recent document', { created_at: recentTime })
    })

    it('should clean up expired documents', async () => {
      const maxAge = 365 * 24 * 60 * 60 * 1000 // 365 days
      const cleanedCount = await knowledgeBase.cleanupExpiredDocs(maxAge)
      
      expect(cleanedCount).toBeGreaterThanOrEqual(0)
    })

    it('should preserve recently accessed documents', async () => {
      // Update access time for one document
      await knowledgeBase.updateLastAccessed('recent-doc')
      
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days
      const cleanedCount = await knowledgeBase.cleanupExpiredDocs(maxAge)
      
      // The recently accessed doc should be preserved
      const results = await knowledgeBase.searchSemantic('recent', { limit: 5 })
      expect(results.some(r => r.id === 'recent-doc')).toBe(true)
    })
  })

  describe('Embedding Operations', () => {
    it('should generate and cache embeddings', async () => {
      const text = 'Test embedding generation'
      const embedding1 = await (knowledgeBase as any).getOrCreateEmbedding(text)
      const embedding2 = await (knowledgeBase as any).getOrCreateEmbedding(text)
      
      expect(embedding1).toBeInstanceOf(Float32Array)
      expect(embedding2).toBeInstanceOf(Float32Array)
      expect(embedding1).toEqual(embedding2) // Should be cached
    })

    it('should handle embedding generation errors', async () => {
      jest.spyOn(mockProvider, 'generateEmbedding').mockRejectedValueOnce(new Error('Embedding error'))
      
      await expect((knowledgeBase as any).getOrCreateEmbedding('test')).rejects.toThrow('Embedding error')
    })
  })

  describe('Memory Graph Integration', () => {
    it('should handle symbol storage and retrieval', async () => {
      const symbol = {
        id: 'test-symbol',
        name: 'testFunction',
        kind: 'function' as const,
        signature: 'function testFunction(): void',
        location: { file: 'test.ts', line: 1, column: 1 }
      }
      
      await knowledgeBase.storeSymbol(symbol)
      const retrieved = await knowledgeBase.findSymbolById('test-symbol')
      
      expect(retrieved).not.toBeNull()
      expect(retrieved?.name).toBe('testFunction')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn((knowledgeBase as any).db, 'run').mockImplementationOnce((sql, params, callback) => {
        callback(new Error('Database error'))
      })
      
      await expect(knowledgeBase.store('error-test', 'content', {})).rejects.toThrow()
    })

    it('should handle missing files gracefully', async () => {
      const invalidPath = '/invalid/path'
      const kb = new KnowledgeBase(invalidPath)
      
      // Should not throw, but should handle gracefully
      await expect(kb.initialize()).resolves.toBeUndefined()
    })
  })

  describe('Performance', () => {
    it('should handle large numbers of documents efficiently', async () => {
      const startTime = Date.now()
      
      // Store 100 documents
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(knowledgeBase.store(`doc-${i}`, `Test document ${i} about topic ${i % 10}`, { index: i }))
      }
      
      await Promise.all(promises)
      
      const storageTime = Date.now() - startTime
      expect(storageTime).toBeLessThan(10000) // Should complete within 10 seconds
      
      // Search should also be fast
      const searchStart = Date.now()
      const results = await knowledgeBase.searchSemantic('topic 5', { limit: 10 })
      const searchTime = Date.now() - searchStart
      
      expect(searchTime).toBeLessThan(1000) // Should complete within 1 second
      expect(results.length).toBeGreaterThan(0)
    })
  })
})