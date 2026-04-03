// Skill enrichment provider interface for hybrid reasoning integration
// Decouples reasoning from specific skill implementations (MCP, OpenClaw, etc.)

import { ContextPackage } from '@/core/types'

export interface SkillEnrichmentResult {
  skillId: string
  skillName: string
  content: string
  resultType: 'context' | 'direct-answer' | 'recommendation'
  confidence: number
  executionTimeMs: number
  cost: number
}

export interface SkillUsageSummary {
  skillId: string
  skillName: string
  executionTimeMs: number
  resultType: string
  cost: number
}

export interface SkillEnrichmentProvider {
  /**
   * Enrich a query with relevant skill results.
   * Returns enrichments that can be appended to the reasoning context.
   * Implementations should be fast (sub-5s) and handle errors gracefully.
   */
  enrichQuery(
    query: string,
    contextPackage: ContextPackage
  ): Promise<SkillEnrichmentResult[]>

  /**
   * Return the list of skill IDs this provider supports.
   */
  getAvailableSkillIds(): string[]
}
