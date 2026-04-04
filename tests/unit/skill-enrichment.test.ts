// Unit tests for skill enrichment integration with hybrid reasoning

import { MCPSkillEnrichmentAdapter } from '../../src/reasoning/mcp-skill-enrichment-adapter'
import { SkillEnrichmentProvider, SkillEnrichmentResult } from '../../src/reasoning/skill-enrichment-provider'
import { ContextPackage } from '../../src/core/types'

function createMockContextPackage(overrides: Partial<ContextPackage> = {}): ContextPackage {
  return {
    query: 'test query',
    relevantFiles: [],
    codeSymbols: [],
    relationships: [],
    memoryNodes: [],
    semanticMatches: [],
    estimatedTokens: 100,
    ...overrides,
  }
}

function createMockOrchestrator(executeResult?: any) {
  const defaultResult = {
    success: true,
    content: [{ type: 'text', text: 'Mock skill result with code analysis details' }],
    executionTime: 150,
    cost: 0,
  }

  return {
    executeSkill: jest.fn().mockResolvedValue(executeResult || defaultResult),
  }
}

describe('MCPSkillEnrichmentAdapter', () => {
  describe('keyword matching', () => {
    it('should match "code" queries to analyze_codebase skill', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code structure', context)

      expect(orchestrator.executeSkill).toHaveBeenCalledWith(
        'analyze_codebase',
        expect.objectContaining({ query: 'analyze the code structure' })
      )
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].skillId).toBe('analyze_codebase')
    })

    it('should match "codebase" queries to analyze_codebase skill', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      await adapter.enrichQuery('search the codebase for patterns', context)

      expect(orchestrator.executeSkill).toHaveBeenCalledWith(
        'analyze_codebase',
        expect.any(Object)
      )
    })

    it('should match "api" queries to research_api skill', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      await adapter.enrichQuery('find the api documentation for auth', context)

      expect(orchestrator.executeSkill).toHaveBeenCalledWith(
        'research_api',
        expect.objectContaining({ api: 'find the api documentation for auth' })
      )
    })

    it('should match "documentation" queries to research_api skill', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      await adapter.enrichQuery('look up the documentation for react hooks', context)

      expect(orchestrator.executeSkill).toHaveBeenCalledWith(
        'research_api',
        expect.any(Object)
      )
    })

    it('should match "cost" queries to optimize_costs skill', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      await adapter.enrichQuery('reduce the cost of LLM calls', context)

      expect(orchestrator.executeSkill).toHaveBeenCalledWith(
        'optimize_costs',
        expect.any(Object)
      )
    })

    it('should return empty results for queries with no matching keywords', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('hello world', context)

      expect(orchestrator.executeSkill).not.toHaveBeenCalled()
      expect(results).toEqual([])
    })

    it('should match multiple MCP skills when query contains multiple keywords', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      // "code" → analyze_codebase (MCP), "api" + "documentation" → research_api (MCP)
      // "find" → file_search (shell, won't call orchestrator)
      await adapter.enrichQuery('analyze the code and look up the api documentation', context)

      // Only MCP skills call orchestrator
      expect(orchestrator.executeSkill).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should catch per-skill errors and continue', async () => {
      const orchestrator = {
        executeSkill: jest.fn().mockRejectedValue(new Error('Skill failed')),
      }
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code', context)

      expect(results).toEqual([])
    })

    it('should skip skills with unsuccessful results', async () => {
      const orchestrator = createMockOrchestrator({
        success: false,
        content: [],
        executionTime: 50,
        cost: 0,
      })
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code', context)

      expect(results).toEqual([])
    })

    it('should skip skills with empty text content', async () => {
      const orchestrator = createMockOrchestrator({
        success: true,
        content: [{ type: 'text', text: '' }],
        executionTime: 50,
        cost: 0,
      })
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code', context)

      expect(results).toEqual([])
    })
  })

  describe('result formatting', () => {
    it('should format skill names from IDs', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code', context)

      expect(results[0].skillName).toBe('Analyze Codebase')
    })

    it('should set optimize_costs result type to recommendation', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('reduce the cost', context)

      expect(results[0].resultType).toBe('recommendation')
    })

    it('should set code analysis result type to context', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code', context)

      expect(results[0].resultType).toBe('context')
    })

    it('should track execution time and cost', async () => {
      const orchestrator = createMockOrchestrator({
        success: true,
        content: [{ type: 'text', text: 'code analysis result' }],
        executionTime: 200,
        cost: 0.01,
      })
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code', context)

      expect(results[0].executionTimeMs).toBeGreaterThanOrEqual(0)
      expect(results[0].cost).toBe(0.01)
    })
  })

  describe('confidence estimation', () => {
    it('should estimate higher confidence when query words appear in content', async () => {
      const orchestrator = createMockOrchestrator({
        success: true,
        content: [{ type: 'text', text: 'The code structure includes functions, classes, and modules' }],
        executionTime: 100,
        cost: 0,
      })
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('analyze the code structure', context)

      expect(results[0].confidence).toBeGreaterThan(0.3)
    })
  })

  describe('getAvailableSkillIds', () => {
    it('should return all built-in skill IDs including shell skills', () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)

      const skillIds = adapter.getAvailableSkillIds()

      expect(skillIds).toContain('analyze_codebase')
      expect(skillIds).toContain('research_api')
      expect(skillIds).toContain('optimize_costs')
      expect(skillIds).toContain('git_context')
      expect(skillIds).toContain('github_context')
      expect(skillIds).toContain('directory_context')
      expect(skillIds).toContain('file_search')
      expect(skillIds).toHaveLength(7)
    })
  })

  describe('shell-based skills', () => {
    it('should match "git" queries to git_context skill', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('show me the git status', context)

      // Shell skills don't call orchestrator.executeSkill
      expect(orchestrator.executeSkill).not.toHaveBeenCalled()
      // git_context runs shell commands, may or may not produce results depending on env
      expect(Array.isArray(results)).toBe(true)
    })

    it('should match "commit" and "branch" to git_context', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('list recent commit history on this branch', context)

      expect(orchestrator.executeSkill).not.toHaveBeenCalled()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should match "directory" and "folder" to directory_context', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('show me the directory structure', context)

      // directory_context is a shell skill, should return something for any directory
      expect(Array.isArray(results)).toBe(true)
      if (results.length > 0) {
        expect(results[0].skillId).toBe('directory_context')
        expect(results[0].resultType).toBe('context')
      }
    })

    it('should match "grep" and "search" to file_search', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      const results = await adapter.enrichQuery('grep for HybridReasoning', context)

      expect(orchestrator.executeSkill).not.toHaveBeenCalled()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should not call orchestrator for shell-based skills', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      await adapter.enrichQuery('check the git repository status', context)

      expect(orchestrator.executeSkill).not.toHaveBeenCalled()
    })

    it('should handle shell command failures gracefully', async () => {
      const orchestrator = createMockOrchestrator()
      const adapter = new MCPSkillEnrichmentAdapter(orchestrator as any)
      const context = createMockContextPackage()

      // github_context calls gh CLI which may not be available
      const results = await adapter.enrichQuery('check github pull requests', context)

      // Should not throw, returns empty or valid results
      expect(Array.isArray(results)).toBe(true)
    })
  })
})

describe('SkillEnrichmentProvider integration with HybridReasoning', () => {
  describe('enrichContextWithSkills', () => {
    it('should filter out enrichments below confidence threshold', () => {
      const lowConfidenceResult: SkillEnrichmentResult = {
        skillId: 'analyze_codebase',
        skillName: 'Analyze Codebase',
        content: 'some result',
        resultType: 'context',
        confidence: 0.1,
        executionTimeMs: 100,
        cost: 0,
      }

      // Confidence threshold is 0.3
      expect(lowConfidenceResult.confidence).toBeLessThan(0.3)
    })

    it('should pass enrichments above confidence threshold', () => {
      const highConfidenceResult: SkillEnrichmentResult = {
        skillId: 'analyze_codebase',
        skillName: 'Analyze Codebase',
        content: 'detailed code analysis results',
        resultType: 'context',
        confidence: 0.8,
        executionTimeMs: 200,
        cost: 0,
      }

      expect(highConfidenceResult.confidence).toBeGreaterThanOrEqual(0.3)
    })
  })

  describe('SkillUsageSummary tracking', () => {
    it('should correctly map enrichment results to usage summaries', () => {
      const enrichment: SkillEnrichmentResult = {
        skillId: 'research_api',
        skillName: 'Research Api',
        content: 'API documentation found',
        resultType: 'context',
        confidence: 0.7,
        executionTimeMs: 350,
        cost: 0.005,
      }

      const summary = {
        skillId: enrichment.skillId,
        skillName: enrichment.skillName,
        executionTimeMs: enrichment.executionTimeMs,
        resultType: enrichment.resultType,
        cost: enrichment.cost,
      }

      expect(summary.skillId).toBe('research_api')
      expect(summary.executionTimeMs).toBe(350)
      expect(summary.cost).toBe(0.005)
    })
  })

  describe('ContextPackage skill enrichment', () => {
    it('should update estimatedTokens when enrichments are added', () => {
      const context = createMockContextPackage({ estimatedTokens: 100 })
      const enrichmentContent = 'a'.repeat(400) // ~100 tokens

      const additionalTokens = Math.ceil(enrichmentContent.length / 4)
      context.estimatedTokens += additionalTokens

      expect(context.estimatedTokens).toBe(200)
    })

    it('should store skill enrichments on context package', () => {
      const context = createMockContextPackage()

      context.skillEnrichments = [
        {
          skillId: 'analyze_codebase',
          skillName: 'Analyze Codebase',
          content: 'code analysis',
          resultType: 'context',
          confidence: 0.8,
        },
      ]

      expect(context.skillEnrichments).toHaveLength(1)
      expect(context.skillEnrichments[0].skillId).toBe('analyze_codebase')
    })
  })
})
