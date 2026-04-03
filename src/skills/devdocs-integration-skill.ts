// DevDocs Integration Skill
// Skill for integrating offline documentation from DevDocs.io with code analysis

import { DevDocsMCPExtension } from '../setup/devdocs-mcp-extension.js'

export interface DevDocsSkillConfig {
  projectRoot: string
  supportedLanguages: string[]
  autoDownloadDocs: boolean
  maxSearchResults: number
}

export class DevDocsIntegrationSkill {
  private devDocs: DevDocsMCPExtension
  private config: DevDocsSkillConfig

  constructor(config: DevDocsSkillConfig) {
    this.config = config
    this.devDocs = new DevDocsMCPExtension(config.projectRoot)
  }

  async initialize(): Promise<boolean> {
    console.log('🔧 Initializing DevDocs Integration Skill...')
    
    try {
      const ready = await this.devDocs.initialize()
      
      if (ready && this.config.autoDownloadDocs) {
        console.log('📚 Auto-downloading documentation for supported languages...')
        await this.autoDownloadDocumentation()
      }
      
      console.log('✅ DevDocs Integration Skill ready')
      return ready
    } catch (error) {
      console.error('❌ DevDocs Integration Skill initialization failed:', error)
      return false
    }
  }

  // Skill: Smart Documentation Search
  async searchDocumentationSmart(query: string, language?: string, contextual: boolean = true): Promise<{
    results: Array<{
      title: string
      path: string
      snippet: string
      relevance: number
      language: string
    }>
    suggestions: string[]
    totalFound: number
  }> {
    const results: Array<{
      title: string
      path: string
      snippet: string
      relevance: number
      language: string
    }> = []
    
    const suggestions: string[] = []
    let totalFound = 0
    
    // Search specific language if provided
    if (language) {
      try {
        const langResults = await this.devDocs.searchDocumentation(language, query, this.config.maxSearchResults)
        results.push(...langResults.map(r => ({ ...r, language })))
        totalFound += langResults.length
      } catch (error) {
        suggestions.push(`Documentation for ${language} not available offline - consider downloading`)
      }
    } else {
      // Search across all supported languages
      for (const lang of this.config.supportedLanguages) {
        try {
          const langResults = await this.devDocs.searchDocumentation(lang, query, Math.ceil(this.config.maxSearchResults / this.config.supportedLanguages.length))
          results.push(...langResults.map(r => ({ ...r, language: lang })))
          totalFound += langResults.length
        } catch (error) {
          // Ignore errors for unavailable documentation
        }
      }
    }
    
    // Generate contextual suggestions
    if (contextual) {
      suggestions.push(...this.generateSearchSuggestions(query, results))
    }
    
    return {
      results: results.sort((a, b) => b.relevance - a.relevance),
      suggestions,
      totalFound
    }
  }

  // Skill: Documentation Context Builder
  async buildTaskDocumentationContext(task: string, languages: string[], maxResults: number = 10): Promise<{
    relevantDocs: Array<{
      language: string
      title: string
      content: string
      relevance: number
      actionable: boolean
    }>
    learningPath: string[]
    examples: string[]
    bestPractices: string[]
  }> {
    const context = await this.devDocs.buildDocumentationContext(task, languages, maxResults)
    
    const relevantDocs = context.relevantDocs.map(doc => ({
      ...doc,
      actionable: this.isActionableContent(doc.content, task)
    }))
    
    const learningPath = this.generateLearningPath(task, relevantDocs)
    const examples = this.extractCodeExamples(relevantDocs)
    const bestPractices = this.extractBestPractices(relevantDocs)
    
    return {
      relevantDocs,
      learningPath,
      examples,
      bestPractices
    }
  }

  // Skill: Auto Documentation Management
  async manageDocumentationLibrary(): Promise<{
    downloaded: string[]
    outdated: string[]
    missing: string[]
    recommendations: string[]
  }> {
    const status = await this.devDocs.getDocumentationStatus()
    
    const downloaded: string[] = []
    const outdated: string[] = []
    const missing: string[] = []
    const recommendations: string[] = []
    
    for (const statusItem of status) {
      if (statusItem.enabled) {
        downloaded.push(statusItem.language)
        
        // Check if outdated (older than 30 days)
        const lastUpdated = new Date(statusItem.lastUpdated)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        
        if (lastUpdated < thirtyDaysAgo) {
          outdated.push(statusItem.language)
          recommendations.push(`Consider updating ${statusItem.language} documentation (last updated: ${statusItem.lastUpdated})`)
        }
      } else {
        missing.push(statusItem.language)
        recommendations.push(`Download ${statusItem.language} documentation for offline access`)
      }
    }
    
    // Check for languages in supportedLanguages that aren't in status
    for (const lang of this.config.supportedLanguages) {
      if (!status.some(s => s.language === lang)) {
        missing.push(lang)
        recommendations.push(`Add ${lang} to documentation library`)
      }
    }
    
    return { downloaded, outdated, missing, recommendations }
  }

  // Skill: Documentation Quality Assessment
  async assessDocumentationQuality(language: string): Promise<{
    coverage: number
    completeness: number
    recency: number
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    improvements: string[]
  }> {
    const improvements: string[] = []
    let coverage = 0
    let completeness = 0
    let recency = 0
    
    try {
      // Get available docs for language
      const availableDocs = await this.devDocs.getAvailableDocs(language)
      const configs = this.devDocs.getConfigurations()
      const langConfig = configs.get(language)
      
      // Calculate coverage (how many available docs are downloaded)
      if (availableDocs.length > 0 && langConfig) {
        coverage = langConfig.docs.length / availableDocs.length
      }
      
      // Calculate completeness (estimate based on doc count)
      if (langConfig) {
        completeness = Math.min(langConfig.docs.length / 3, 1) // 3+ docs considered complete
      }
      
      // Calculate recency (how recent the documentation is)
      if (langConfig && langConfig.lastUpdated && langConfig.lastUpdated !== 'never') {
        const lastUpdate = new Date(langConfig.lastUpdated)
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
        recency = Math.max(0, 1 - (daysSinceUpdate / 90)) // 90 days = 0 recency
      }
      
      // Generate improvements
      if (coverage < 0.5) {
        improvements.push('Download more available documentation sources')
      }
      if (completeness < 0.5) {
        improvements.push('Add core documentation (API reference, getting started guide)')
      }
      if (recency < 0.5) {
        improvements.push('Update documentation to latest versions')
      }
      
    } catch (error) {
      improvements.push(`Unable to assess documentation for ${language} - may not be available`)
    }
    
    // Calculate overall quality
    const overallScore = (coverage + completeness + recency) / 3
    let quality: 'excellent' | 'good' | 'fair' | 'poor'
    
    if (overallScore >= 0.8) quality = 'excellent'
    else if (overallScore >= 0.6) quality = 'good'
    else if (overallScore >= 0.4) quality = 'fair'
    else quality = 'poor'
    
    return { coverage, completeness, recency, quality, improvements }
  }

  // Private helper methods
  private async autoDownloadDocumentation(): Promise<void> {
    for (const language of this.config.supportedLanguages) {
      try {
        const availableDocs = await this.devDocs.getAvailableDocs(language)
        if (availableDocs.length > 0) {
          // Download top 2 most relevant docs for each language
          const topDocs = availableDocs.slice(0, 2).map(doc => doc.slug)
          await this.devDocs.downloadDocumentation(language, topDocs)
          console.log(`📥 Downloaded documentation for ${language}: ${topDocs.join(', ')}`)
        }
      } catch (error) {
        console.warn(`⚠️  Could not auto-download documentation for ${language}:`, error.message)
      }
    }
  }

  private generateSearchSuggestions(query: string, results: any[]): string[] {
    const suggestions: string[] = []
    
    if (results.length === 0) {
      suggestions.push('Try broader search terms or download more documentation')
      suggestions.push('Check if the language documentation is available offline')
    }
    
    if (query.length < 3) {
      suggestions.push('Use more specific search terms for better results')
    }
    
    const languages = [...new Set(results.map(r => r.language))]
    if (languages.length > 1) {
      suggestions.push(`Results span ${languages.length} languages: ${languages.join(', ')}`)
    }
    
    return suggestions
  }

  private isActionableContent(content: string, task: string): boolean {
    // Simple heuristic to determine if content contains actionable information
    const actionableKeywords = ['function', 'method', 'class', 'example', 'code', 'implementation', 'usage']
    const taskKeywords = task.toLowerCase().split(' ')
    
    const contentLower = content.toLowerCase()
    const hasActionableKeywords = actionableKeywords.some(keyword => contentLower.includes(keyword))
    const hasTaskKeywords = taskKeywords.some(keyword => contentLower.includes(keyword))
    
    return hasActionableKeywords && hasTaskKeywords
  }

  private generateLearningPath(task: string, relevantDocs: any[]): string[] {
    const path: string[] = []
    
    // Basic learning path structure
    path.push('1. Understand the basics and core concepts')
    
    if (relevantDocs.some(doc => doc.title.toLowerCase().includes('getting started'))) {
      path.push('2. Follow getting started guide')
    }
    
    path.push('3. Study relevant API documentation')
    path.push('4. Review code examples and best practices')
    
    if (relevantDocs.some(doc => doc.title.toLowerCase().includes('advanced'))) {
      path.push('5. Explore advanced usage patterns')
    }
    
    return path
  }

  private extractCodeExamples(relevantDocs: any[]): string[] {
    const examples: string[] = []
    
    relevantDocs.forEach(doc => {
      // Simple extraction of code-like content
      if (doc.content.includes('```') || doc.content.includes('function') || doc.content.includes('class')) {
        examples.push(`Code example from ${doc.title}`)
      }
    })
    
    return examples.slice(0, 5) // Limit to 5 examples
  }

  private extractBestPractices(relevantDocs: any[]): string[] {
    const practices: string[] = []
    
    relevantDocs.forEach(doc => {
      if (doc.title.toLowerCase().includes('best practice') || 
          doc.content.toLowerCase().includes('recommended') ||
          doc.content.toLowerCase().includes('should')) {
        practices.push(`Best practice from ${doc.title}`)
      }
    })
    
    return practices.slice(0, 5) // Limit to 5 practices
  }

  // Public API
  getExtension(): DevDocsMCPExtension {
    return this.devDocs
  }
}

export default DevDocsIntegrationSkill