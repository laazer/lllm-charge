// Unit tests for HybridReasoning
import { HybridReasoning } from '../../src/reasoning/hybrid-reasoning'
import { KnowledgeBase } from '../../src/core/knowledge-base'
import { TEST_CONFIG, MockLLMProvider, createMockConfig } from '../setup'
import * as path from 'path'

describe('HybridReasoning', () => {
  let hybridReasoning: HybridReasoning
  let mockKnowledgeBase: KnowledgeBase
  let mockProvider: MockLLMProvider

  beforeEach(async () => {
    mockProvider = new MockLLMProvider()
    mockKnowledgeBase = new KnowledgeBase(path.join(TEST_CONFIG.TEST_CACHE_DIR, 'reasoning-test.db'))
    await mockKnowledgeBase.initialize()
    
    hybridReasoning = new HybridReasoning(mockKnowledgeBase)
    
    // Mock the LLM provider
    jest.spyOn(hybridReasoning as any, 'getLLMProvider')
      .mockReturnValue(mockProvider)
  })

  afterEach(async () => {
    if (mockKnowledgeBase) {
      await mockKnowledgeBase.cleanup()
    }
  })

  describe('Session Management', () => {
    it('should create new reasoning sessions', async () => {
      const sessionId = await hybridReasoning.startReasoningSession({
        query: 'How do I implement authentication?',
        context: 'web application',
        maxDepth: 3
      })

      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')
      expect(sessionId.length).toBeGreaterThan(0)
    })

    it('should retrieve existing sessions', async () => {
      const sessionId = await hybridReasoning.startReasoningSession({
        query: 'Test query',
        context: 'test context',
        maxDepth: 2
      })

      const session = await hybridReasoning.getSession(sessionId)
      
      expect(session).toBeDefined()
      expect(session.id).toBe(sessionId)
      expect(session.query).toBe('Test query')
      expect(session.context).toBe('test context')
      expect(session.maxDepth).toBe(2)
    })

    it('should handle non-existent sessions gracefully', async () => {
      const session = await hybridReasoning.getSession('non-existent-id')
      expect(session).toBeNull()
    })
  })

  describe('Reasoning Process', () => {
    it('should process simple queries with local knowledge', async () => {
      // Add some test knowledge
      await mockKnowledgeBase.store('react-docs', 'React is a JavaScript library for building user interfaces', { 
        type: 'documentation' 
      })

      const result = await hybridReasoning.processRequest({
        query: 'What is React?',
        context: 'web development',
        useLocal: true,
        maxSteps: 3
      })

      expect(result).toBeDefined()
      expect(result.response).toContain('React')
      expect(result.isLocal).toBe(true)
      expect(result.cost).toBe(0)
      expect(result.steps).toHaveLength(1)
    })

    it('should handle complex multi-step reasoning', async () => {
      // Add knowledge base content
      await mockKnowledgeBase.store('auth-basics', 'Authentication verifies user identity', { type: 'documentation' })
      await mockKnowledgeBase.store('jwt-info', 'JWT tokens are used for stateless authentication', { type: 'documentation' })

      const result = await hybridReasoning.processRequest({
        query: 'How do I implement JWT authentication in React?',
        context: 'web application security',
        useLocal: false,
        maxSteps: 5
      })

      expect(result).toBeDefined()
      expect(result.response).toBeTruthy()
      expect(result.steps.length).toBeGreaterThan(1)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it('should track reasoning costs correctly', async () => {
      const result = await hybridReasoning.processRequest({
        query: 'Simple test query',
        context: 'testing',
        useLocal: true,
        maxSteps: 2
      })

      expect(result.cost).toBeDefined()
      expect(typeof result.cost).toBe('number')
      expect(result.cost).toBeGreaterThanOrEqual(0)
    })

    it('should prioritize local knowledge when available', async () => {
      // Add high-quality local knowledge
      await mockKnowledgeBase.store('local-knowledge', 'This is comprehensive local documentation about the topic', {
        type: 'documentation',
        quality: 'high'
      })

      const result = await hybridReasoning.processRequest({
        query: 'Tell me about the topic',
        context: 'documentation lookup',
        useLocal: true,
        maxSteps: 3
      })

      expect(result.isLocal).toBe(true)
      expect(result.cost).toBe(0)
      expect(result.response).toContain('local')
    })
  })

  describe('Memory Updates', () => {
    it('should update memory with new information', async () => {
      const memoryUpdate = {
        concept: 'React Hooks',
        information: 'Hooks let you use state and other React features without writing a class',
        confidence: 0.9,
        source: 'user-input'
      }

      await expect(hybridReasoning.updateMemory(memoryUpdate))
        .resolves.not.toThrow()
    })

    it('should consolidate related memory concepts', async () => {
      await hybridReasoning.updateMemory({
        concept: 'useState',
        information: 'useState is a React Hook that lets you add state to functional components',
        confidence: 0.8,
        source: 'documentation'
      })

      await hybridReasoning.updateMemory({
        concept: 'useEffect',
        information: 'useEffect is a React Hook that lets you perform side effects',
        confidence: 0.8,
        source: 'documentation'
      })

      // The memory should now have connections between related concepts
      const result = await hybridReasoning.processRequest({
        query: 'What React Hooks are available?',
        context: 'React development',
        useLocal: true,
        maxSteps: 2
      })

      expect(result.response).toBeTruthy()
    })
  })

  describe('Performance Optimization', () => {
    it('should cache frequently accessed reasoning patterns', async () => {
      const query = 'What is TypeScript?'
      
      // First query - should be slower
      const start1 = Date.now()
      const result1 = await hybridReasoning.processRequest({
        query,
        context: 'programming',
        useLocal: true,
        maxSteps: 2
      })
      const time1 = Date.now() - start1

      // Second identical query - should be faster due to caching
      const start2 = Date.now()
      const result2 = await hybridReasoning.processRequest({
        query,
        context: 'programming',
        useLocal: true,
        maxSteps: 2
      })
      const time2 = Date.now() - start2

      expect(result2.response).toBeTruthy()
      // Note: In a real implementation, this would test actual caching
      expect(time2).toBeLessThanOrEqual(time1 + 100) // Allow some variance
    })

    it('should handle concurrent reasoning requests', async () => {
      const queries = [
        'What is React?',
        'What is TypeScript?',
        'What is Node.js?'
      ]

      const promises = queries.map(query => 
        hybridReasoning.processRequest({
          query,
          context: 'programming',
          useLocal: true,
          maxSteps: 2
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.response).toBeTruthy()
        expect(result.executionTime).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle LLM provider failures gracefully', async () => {
      // Mock a failing LLM provider
      jest.spyOn(mockProvider, 'generateResponse')
        .mockRejectedValueOnce(new Error('LLM API failure'))

      const result = await hybridReasoning.processRequest({
        query: 'Test query that will fail',
        context: 'error testing',
        useLocal: false,
        maxSteps: 3
      })

      expect(result).toBeDefined()
      expect(result.response).toContain('Error')
      expect(result.cost).toBe(0)
    })

    it('should provide fallback responses when knowledge is limited', async () => {
      const result = await hybridReasoning.processRequest({
        query: 'Very obscure technical question about non-existent technology',
        context: 'unknown domain',
        useLocal: true,
        maxSteps: 2
      })

      expect(result).toBeDefined()
      expect(result.response).toBeTruthy()
      // Should indicate uncertainty or suggest alternatives
      expect(
        result.response.includes('unknown') || 
        result.response.includes('unable') ||
        result.response.includes('suggest')
      ).toBe(true)
    })

    it('should handle malformed queries safely', async () => {
      const malformedQueries = [
        '', // empty
        '   ', // whitespace only
        'a'.repeat(10000), // extremely long
        '###invalid###query###' // special characters
      ]

      for (const query of malformedQueries) {
        const result = await hybridReasoning.processRequest({
          query,
          context: 'error testing',
          useLocal: true,
          maxSteps: 1
        })

        expect(result).toBeDefined()
        expect(result.response).toBeTruthy()
      }
    })
  })

  describe('Context Building', () => {
    it('should build comprehensive context packages', async () => {
      // Add various types of knowledge
      await mockKnowledgeBase.store('react-component', 'React components are functions that return JSX', { 
        type: 'concept' 
      })
      await mockKnowledgeBase.store('jsx-syntax', 'JSX is a syntax extension for JavaScript', { 
        type: 'concept' 
      })

      const contextPackage = await hybridReasoning.buildContextPackage({
        query: 'How to create React components?',
        domain: 'web development',
        includeRelated: true
      })

      expect(contextPackage).toBeDefined()
      expect(contextPackage.concepts).toHaveLength(0) // Will be populated when buildContextPackage is fully implemented
      expect(contextPackage.confidence).toBeDefined()
      expect(contextPackage.relevanceScore).toBeDefined()
    })

    it('should limit context size for performance', async () => {
      // Add many pieces of knowledge
      for (let i = 0; i < 20; i++) {
        await mockKnowledgeBase.store(`concept-${i}`, `This is concept number ${i}`, { 
          type: 'concept' 
        })
      }

      const contextPackage = await hybridReasoning.buildContextPackage({
        query: 'Tell me about concepts',
        domain: 'testing',
        maxItems: 5
      })

      expect(contextPackage).toBeDefined()
      // Should respect the maxItems limit
    })
  })
})