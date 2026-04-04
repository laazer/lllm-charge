// Adapter that wraps MCPSkillOrchestrator to implement SkillEnrichmentProvider
// Maps queries to relevant skills via keyword matching and executes them with timeouts

import { execSync } from 'child_process'
import { MCPSkillOrchestrator } from '@/mcp/client-tools'
import { SkillEnrichmentProvider, SkillEnrichmentResult } from './skill-enrichment-provider'
import { ContextPackage } from '@/core/types'

type SkillResultType = 'context' | 'direct-answer' | 'recommendation'

const SKILL_TIMEOUT_MS = 30000

const QUERY_SKILL_MAPPING: Record<string, string[]> = {
  'codebase': ['analyze_codebase'],
  'code': ['analyze_codebase'],
  'function': ['analyze_codebase'],
  'class': ['analyze_codebase'],
  'symbol': ['analyze_codebase'],
  'api': ['research_api'],
  'documentation': ['research_api'],
  'docs': ['research_api'],
  'cost': ['optimize_costs'],
  'optimization': ['optimize_costs'],
  'expense': ['optimize_costs'],
  'spending': ['optimize_costs'],
  'git': ['git_context'],
  'commit': ['git_context'],
  'branch': ['git_context'],
  'merge': ['git_context'],
  'diff': ['git_context'],
  'repo': ['git_context'],
  'repository': ['git_context'],
  'pull request': ['github_context'],
  'issue': ['github_context'],
  'github': ['github_context'],
  'file': ['directory_context'],
  'directory': ['directory_context'],
  'folder': ['directory_context'],
  'structure': ['directory_context'],
  'search': ['file_search'],
  'grep': ['file_search'],
  'find': ['file_search'],
  'spec': ['specs_context'],
  'specification': ['specs_context'],
  'requirement': ['specs_context'],
  'agent': ['agents_context'],
  'assistant': ['agents_context'],
  'workflow': ['workflows_context'],
  'automation': ['workflows_context'],
  'pipeline': ['workflows_context'],
  'memory': ['memory_context'],
  'knowledge': ['memory_context'],
  'remember': ['memory_context'],
  'project': ['projects_context'],
  'workspace': ['projects_context'],
  'status': ['system_status'],
  'health': ['system_status'],
  'provider': ['system_status'],
  'model': ['system_status'],
  'package': ['dependency_context'],
  'dependency': ['dependency_context'],
  'install': ['dependency_context'],
  'version': ['dependency_context'],
  'environment': ['environment_context'],
  'node': ['environment_context'],
  'runtime': ['environment_context'],
  'config': ['environment_context'],
}

const SHELL_COMMAND_TIMEOUT_MS = 15000

const SHELL_SKILLS = new Set([
  'git_context', 'github_context', 'directory_context', 'file_search',
  'dependency_context', 'environment_context',
])

export class MCPSkillEnrichmentAdapter implements SkillEnrichmentProvider {
  constructor(private orchestrator: MCPSkillOrchestrator) {}

  async enrichQuery(
    query: string,
    contextPackage: ContextPackage
  ): Promise<SkillEnrichmentResult[]> {
    const matchedSkillIds = this.matchSkillsToQuery(query)
    if (matchedSkillIds.length === 0) return []

    const enrichments: SkillEnrichmentResult[] = []

    for (const skillId of matchedSkillIds) {
      try {
        const startTime = Date.now()

        if (SHELL_SKILLS.has(skillId)) {
          const content = this.executeShellSkill(skillId, query)
          const executionTimeMs = Date.now() - startTime
          if (content.length > 0) {
            enrichments.push({
              skillId,
              skillName: this.formatSkillName(skillId),
              content,
              resultType: 'context',
              confidence: this.estimateConfidence(query, content),
              executionTimeMs,
              cost: 0,
            })
          }
        } else {
          const parameters = this.buildSkillParameters(skillId, query)
          const result = await this.executeWithTimeout(skillId, parameters)
          const executionTimeMs = Date.now() - startTime

          if (result.success) {
            const contentText = this.extractText(result)
            if (contentText.length > 0) {
              enrichments.push({
                skillId,
                skillName: this.formatSkillName(skillId),
                content: contentText,
                resultType: this.determineResultType(skillId),
                confidence: this.estimateConfidence(query, contentText),
                executionTimeMs,
                cost: result.cost || 0,
              })
            }
          }
        }
      } catch (error) {
        console.warn(`Skill enrichment failed for ${skillId}:`, error)
      }
    }

    return enrichments
  }

  getAvailableSkillIds(): string[] {
    return [
      'analyze_codebase', 'research_api', 'optimize_costs',
      'git_context', 'github_context', 'directory_context', 'file_search',
      'specs_context', 'agents_context', 'workflows_context', 'memory_context',
      'projects_context', 'system_status', 'dependency_context', 'environment_context',
    ]
  }

  private matchSkillsToQuery(query: string): string[] {
    const queryLower = query.toLowerCase()
    const matchedSkills = new Set<string>()

    for (const [keyword, skillIds] of Object.entries(QUERY_SKILL_MAPPING)) {
      if (queryLower.includes(keyword)) {
        skillIds.forEach(id => matchedSkills.add(id))
      }
    }

    return Array.from(matchedSkills)
  }

  private buildSkillParameters(
    skillId: string,
    query: string
  ): Record<string, any> {
    switch (skillId) {
      case 'analyze_codebase':
        return { query }
      case 'research_api':
        return { api: query, query }
      case 'optimize_costs':
        return {}
      default:
        return { query }
    }
  }

  private async executeWithTimeout(
    skillId: string,
    parameters: Record<string, any>
  ): Promise<{ success: boolean; content: any[]; cost?: number }> {
    return Promise.race([
      this.orchestrator.executeSkill(skillId, parameters),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Skill ${skillId} timed out after ${SKILL_TIMEOUT_MS}ms`)), SKILL_TIMEOUT_MS)
      ),
    ])
  }

  private extractText(result: { content: any[] }): string {
    return result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
      .trim()
  }

  private formatSkillName(skillId: string): string {
    return skillId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private determineResultType(skillId: string): SkillResultType {
    if (skillId === 'optimize_costs') return 'recommendation'
    return 'context'
  }

  private estimateConfidence(query: string, content: string): number {
    if (!content || content.length === 0) return 0

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (queryWords.length === 0) return 0.5

    const contentLower = content.toLowerCase()
    const matchCount = queryWords.filter(word => contentLower.includes(word)).length

    return Math.min(matchCount / queryWords.length, 1.0)
  }

  private executeShellSkill(skillId: string, query: string): string {
    switch (skillId) {
      case 'git_context': {
        const parts: string[] = []
        const status = this.runShellCommand('git status --short')
        if (status) parts.push(`Status:\n${status}`)
        const branch = this.runShellCommand('git branch --show-current')
        if (branch) parts.push(`Branch: ${branch.trim()}`)
        const log = this.runShellCommand('git log --oneline -10')
        if (log) parts.push(`Recent commits:\n${log}`)
        const diffStat = this.runShellCommand('git diff --stat')
        if (diffStat) parts.push(`Uncommitted changes:\n${diffStat}`)
        return parts.join('\n') || ''
      }

      case 'github_context': {
        const parts: string[] = []
        const prList = this.runShellCommand('gh pr list --limit 5 2>/dev/null')
        if (prList) parts.push(`Open PRs:\n${prList}`)
        const issueList = this.runShellCommand('gh issue list --limit 5 2>/dev/null')
        if (issueList) parts.push(`Open issues:\n${issueList}`)
        return parts.join('\n') || ''
      }

      case 'directory_context': {
        const parts: string[] = []
        const topLevel = this.runShellCommand('ls -la')
        if (topLevel) parts.push(`Root directory:\n${topLevel}`)
        const srcListing = this.runShellCommand('ls -la src/ 2>/dev/null')
        if (srcListing) parts.push(`Source directory:\n${srcListing}`)
        return parts.join('\n') || ''
      }

      case 'file_search': {
        const searchTerms = query.match(/(?:search|grep|find)\s+(?:for\s+)?["']?(\w+)["']?/i)
        const searchTerm = searchTerms?.[1] || query.split(/\s+/).pop() || ''
        if (!searchTerm) return ''
        const grepResult = this.runShellCommand(
          `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" -l "${searchTerm}" src/ 2>/dev/null | head -15`
        )
        return grepResult ? `Files containing "${searchTerm}":\n${grepResult}` : ''
      }

      case 'dependency_context': {
        const pkgJson = this.runShellCommand('cat package.json 2>/dev/null')
        if (!pkgJson) return 'No package.json found'
        try {
          const pkg = JSON.parse(pkgJson)
          const deps = Object.keys(pkg.dependencies || {}).slice(0, 15)
          const devDeps = Object.keys(pkg.devDependencies || {}).slice(0, 10)
          return [
            `Package: ${pkg.name}@${pkg.version}`,
            `Dependencies (${Object.keys(pkg.dependencies || {}).length}): ${deps.join(', ')}`,
            `Dev Dependencies (${Object.keys(pkg.devDependencies || {}).length}): ${devDeps.join(', ')}`,
            `Scripts: ${Object.keys(pkg.scripts || {}).join(', ')}`,
          ].join('\n')
        } catch {
          return 'Could not parse package.json'
        }
      }

      case 'environment_context': {
        return [
          `Node: ${process.version}`,
          `Platform: ${process.platform} ${process.arch}`,
          `CWD: ${process.cwd()}`,
          `Uptime: ${Math.floor(process.uptime())}s`,
          `Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        ].join('\n')
      }

      default:
        return ''
    }
  }

  private runShellCommand(command: string): string {
    try {
      return execSync(command, {
        encoding: 'utf-8',
        timeout: SHELL_COMMAND_TIMEOUT_MS,
        maxBuffer: 1024 * 64,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
    } catch {
      return ''
    }
  }
}
