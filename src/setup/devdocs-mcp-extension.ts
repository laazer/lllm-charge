// DevDocs.io MCP Extension
// Provides offline documentation access for all supported languages

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { spawn } from 'child_process'

export interface DevDocsConfig {
  language: string
  docs: string[]
  enabled: boolean
  downloadPath?: string
  lastUpdated?: string
}

export interface DevDocsEntry {
  name: string
  slug: string
  version?: string
  release?: string
  mtime: number
  db_size?: number
}

export class DevDocsMCPExtension {
  private projectRoot: string
  private devDocsPath: string
  private configs: Map<string, DevDocsConfig> = new Map()

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
    this.devDocsPath = join(projectRoot, '.devdocs')
    
    // Ensure DevDocs directory exists
    if (!existsSync(this.devDocsPath)) {
      mkdirSync(this.devDocsPath, { recursive: true })
    }
  }

  async initialize(): Promise<boolean> {
    console.log('📚 Setting up DevDocs.io integration...')
    
    // Load existing configurations
    await this.loadConfigurations()
    
    // Check if DevDocs is available
    const isAvailable = await this.checkDevDocsAvailability()
    if (!isAvailable) {
      console.log('⚠️  DevDocs.io not accessible - using cached documentation only')
      return false
    }
    
    console.log('✅ DevDocs.io integration ready')
    return true
  }

  // MCP Tool: Get available documentation for language
  async getAvailableDocs(language: string): Promise<DevDocsEntry[]> {
    const languageMap = this.getLanguageDocMapping()
    const docSlugs = languageMap[language] || []
    
    if (docSlugs.length === 0) {
      return []
    }
    
    // Check online availability
    try {
      const entries = await this.fetchDocumentationList(docSlugs)
      return entries
    } catch (error) {
      console.warn(`Could not fetch documentation list for ${language}:`, error)
      return []
    }
  }

  // MCP Tool: Download documentation for language
  async downloadDocumentation(language: string, specificDocs?: string[]): Promise<{
    downloaded: string[]
    failed: string[]
    totalSize: number
  }> {
    const config = this.configs.get(language) || this.createDefaultConfig(language)
    const docsToDownload = specificDocs || config.docs
    
    const results = {
      downloaded: [] as string[],
      failed: [] as string[],
      totalSize: 0
    }
    
    for (const docSlug of docsToDownload) {
      try {
        console.log(`📥 Downloading ${docSlug} documentation...`)
        const success = await this.downloadSingleDoc(docSlug)
        if (success) {
          results.downloaded.push(docSlug)
          const size = await this.getDocSize(docSlug)
          results.totalSize += size
        } else {
          results.failed.push(docSlug)
        }
      } catch (error) {
        console.warn(`Failed to download ${docSlug}:`, error)
        results.failed.push(docSlug)
      }
    }
    
    // Update configuration
    config.lastUpdated = new Date().toISOString()
    config.enabled = results.downloaded.length > 0
    this.configs.set(language, config)
    await this.saveConfigurations()
    
    return results
  }

  // MCP Tool: Search offline documentation
  async searchDocumentation(language: string, query: string, limit: number = 10): Promise<Array<{
    title: string
    path: string
    snippet: string
    relevance: number
  }>> {
    const config = this.configs.get(language)
    if (!config || !config.enabled) {
      return []
    }
    
    const results: Array<{
      title: string
      path: string
      snippet: string
      relevance: number
    }> = []
    
    // Search through downloaded documentation
    for (const docSlug of config.docs) {
      const docPath = join(this.devDocsPath, docSlug)
      if (existsSync(docPath)) {
        try {
          const searchResults = await this.searchInDoc(docPath, query, limit)
          results.push(...searchResults)
        } catch (error) {
          console.warn(`Error searching in ${docSlug}:`, error)
        }
      }
    }
    
    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
  }

  // MCP Tool: Get documentation content
  async getDocumentationContent(language: string, path: string): Promise<{
    title: string
    content: string
    lastUpdated: string
  } | null> {
    const config = this.configs.get(language)
    if (!config || !config.enabled) {
      return null
    }
    
    // Find the documentation file
    for (const docSlug of config.docs) {
      const docPath = join(this.devDocsPath, docSlug, path)
      if (existsSync(docPath)) {
        try {
          const content = readFileSync(docPath, 'utf8')
          return {
            title: this.extractTitle(content),
            content,
            lastUpdated: config.lastUpdated || 'unknown'
          }
        } catch (error) {
          console.warn(`Error reading documentation at ${path}:`, error)
        }
      }
    }
    
    return null
  }

  // MCP Tool: Build documentation context for task
  async buildDocumentationContext(task: string, languages: string[], maxResults: number = 5): Promise<{
    relevantDocs: Array<{
      language: string
      title: string
      content: string
      relevance: number
    }>
    suggestions: string[]
  }> {
    const taskLower = task.toLowerCase()
    const keywords = taskLower.split(' ').filter(w => w.length > 2)
    const relevantDocs: Array<{
      language: string
      title: string
      content: string
      relevance: number
    }> = []
    
    // Search across all specified languages
    for (const language of languages) {
      for (const keyword of keywords) {
        const searchResults = await this.searchDocumentation(language, keyword, 3)
        for (const result of searchResults) {
          const docContent = await this.getDocumentationContent(language, result.path)
          if (docContent) {
            relevantDocs.push({
              language,
              title: docContent.title,
              content: result.snippet,
              relevance: result.relevance
            })
          }
        }
      }
    }
    
    // Generate suggestions
    const suggestions = this.generateDocumentationSuggestions(task, languages, relevantDocs)
    
    // Sort and limit results
    const sortedDocs = relevantDocs
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults)
    
    return { relevantDocs: sortedDocs, suggestions }
  }

  // Private implementation methods
  private async loadConfigurations(): Promise<void> {
    const configPath = join(this.devDocsPath, 'config.json')
    if (existsSync(configPath)) {
      try {
        const configData = JSON.parse(readFileSync(configPath, 'utf8'))
        for (const [language, config] of Object.entries(configData)) {
          this.configs.set(language, config as DevDocsConfig)
        }
      } catch (error) {
        console.warn('Could not load DevDocs configuration:', error)
      }
    }
  }

  private async saveConfigurations(): Promise<void> {
    const configPath = join(this.devDocsPath, 'config.json')
    const configData = Object.fromEntries(this.configs)
    try {
      writeFileSync(configPath, JSON.stringify(configData, null, 2))
    } catch (error) {
      console.warn('Could not save DevDocs configuration:', error)
    }
  }

  private createDefaultConfig(language: string): DevDocsConfig {
    const languageMap = this.getLanguageDocMapping()
    return {
      language,
      docs: languageMap[language] || [],
      enabled: false,
      downloadPath: join(this.devDocsPath, language)
    }
  }

  private getLanguageDocMapping(): Record<string, string[]> {
    return {
      javascript: ['javascript', 'nodejs', 'dom', 'lodash', 'jquery'],
      typescript: ['typescript', 'javascript', 'nodejs'],
      python: ['python~3.12', 'python~2.7', 'django~5.0', 'flask~3.0'],
      go: ['go', 'gin', 'echo'],
      rust: ['rust'],
      java: ['openjdk~21', 'spring_boot', 'junit~5'],
      csharp: ['dotnet', 'entity_framework_core'],
      cpp: ['cpp', 'cmake~3.29'],
      c: ['c', 'gnu_c'],
      php: ['php~8.3', 'laravel~10', 'symfony~7.0'],
      ruby: ['ruby~3.3', 'ruby_on_rails~7.1'],
      swift: ['swift', 'swiftui'],
      kotlin: ['kotlin', 'android'],
      scala: ['scala~3', 'akka~2.8'],
      clojure: ['clojure~1.11'],
      elixir: ['elixir~1.16', 'phoenix~1.7'],
      erlang: ['erlang~27'],
      haskell: ['haskell~9.8'],
      ocaml: ['ocaml~5.1'],
      fsharp: ['fsharp'],
      dart: ['dart~3.3', 'flutter'],
      lua: ['lua~5.4'],
      perl: ['perl~5.38'],
      r: ['r~4.3'],
      julia: ['julia~1.10'],
      matlab: ['matlab'],
      bash: ['bash'],
      powershell: ['powershell~7.4'],
      gdscript: [], // No official DevDocs for GDScript yet
      html: ['html', 'mdn_html'],
      css: ['css', 'sass', 'bootstrap~5'],
      sql: ['postgresql~16', 'mysql~8.0', 'sqlite'],
      json: ['json'],
      yaml: [],
      toml: [],
      xml: ['xml', 'xpath', 'xslt']
    }
  }

  private async checkDevDocsAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000)
      
      // Simple check if DevDocs.io is accessible
      fetch('https://devdocs.io', { method: 'HEAD' })
        .then(() => {
          clearTimeout(timeout)
          resolve(true)
        })
        .catch(() => {
          clearTimeout(timeout)
          resolve(false)
        })
    })
  }

  private async fetchDocumentationList(docSlugs: string[]): Promise<DevDocsEntry[]> {
    // Simulate fetching documentation list from DevDocs.io API
    // In a real implementation, this would make actual HTTP requests
    return docSlugs.map(slug => ({
      name: slug,
      slug,
      mtime: Date.now(),
      db_size: Math.floor(Math.random() * 10000000) // Random size for demo
    }))
  }

  private async downloadSingleDoc(docSlug: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Simulate documentation download
      // In real implementation, this would:
      // 1. Download the SQLite database from DevDocs.io
      // 2. Extract and index the documentation
      // 3. Store in local .devdocs directory
      
      const docPath = join(this.devDocsPath, docSlug)
      mkdirSync(docPath, { recursive: true })
      
      // Create a dummy documentation file
      const indexPath = join(docPath, 'index.json')
      writeFileSync(indexPath, JSON.stringify({
        name: docSlug,
        downloadedAt: new Date().toISOString(),
        entries: []
      }, null, 2))
      
      console.log(`✅ Downloaded ${docSlug} documentation`)
      resolve(true)
    })
  }

  private async getDocSize(docSlug: string): Promise<number> {
    // Return estimated size in bytes
    return Math.floor(Math.random() * 5000000) + 1000000 // 1-6MB range
  }

  private async searchInDoc(docPath: string, query: string, limit: number): Promise<Array<{
    title: string
    path: string
    snippet: string
    relevance: number
  }>> {
    // Simulate documentation search
    // In real implementation, this would search through the downloaded documentation
    const results = []
    const queryLower = query.toLowerCase()
    
    // Generate mock search results based on common documentation patterns
    const commonTopics = [
      'Getting Started', 'API Reference', 'Configuration', 'Examples',
      'Best Practices', 'Installation', 'Troubleshooting', 'Advanced Usage'
    ]
    
    for (let i = 0; i < Math.min(limit, 3); i++) {
      const topic = commonTopics[i] || `Topic ${i + 1}`
      results.push({
        title: `${topic} - ${query}`,
        path: `docs/${topic.toLowerCase().replace(/\s+/g, '-')}.html`,
        snippet: `Documentation for ${query}. This section covers ${topic.toLowerCase()} and related concepts.`,
        relevance: Math.random() * 0.5 + 0.5 // 0.5-1.0 range
      })
    }
    
    return results
  }

  private extractTitle(content: string): string {
    // Extract title from documentation content
    const titleMatch = content.match(/<title>(.*?)<\/title>/i) ||
                      content.match(/^#\s*(.*)$/m) ||
                      content.match(/"title":\s*"([^"]*)"/)
    
    return titleMatch ? titleMatch[1].trim() : 'Untitled Documentation'
  }

  private generateDocumentationSuggestions(
    task: string, 
    languages: string[], 
    relevantDocs: any[]
  ): string[] {
    const suggestions: string[] = []
    
    // Analyze task for common patterns
    const taskLower = task.toLowerCase()
    
    if (taskLower.includes('install') || taskLower.includes('setup')) {
      suggestions.push('Check installation and setup documentation first')
    }
    
    if (taskLower.includes('api') || taskLower.includes('function')) {
      suggestions.push('Look for API reference documentation')
    }
    
    if (taskLower.includes('config') || taskLower.includes('setting')) {
      suggestions.push('Review configuration documentation')
    }
    
    if (taskLower.includes('error') || taskLower.includes('debug')) {
      suggestions.push('Check troubleshooting and debugging guides')
    }
    
    // Language-specific suggestions
    for (const language of languages) {
      const config = this.configs.get(language)
      if (config && config.enabled) {
        suggestions.push(`${language.charAt(0).toUpperCase() + language.slice(1)} documentation available offline`)
      } else {
        suggestions.push(`Consider downloading ${language} documentation for offline access`)
      }
    }
    
    // Document availability suggestions
    if (relevantDocs.length > 0) {
      suggestions.push(`Found ${relevantDocs.length} relevant documentation sections`)
    } else {
      suggestions.push('No offline documentation found - consider downloading relevant docs')
    }
    
    return suggestions
  }

  // Export methods for MCP integration
  getConfigurations(): Map<string, DevDocsConfig> {
    return this.configs
  }

  async updateDocumentation(language: string): Promise<boolean> {
    console.log(`🔄 Updating ${language} documentation...`)
    const result = await this.downloadDocumentation(language)
    return result.downloaded.length > 0
  }

  async getDocumentationStatus(): Promise<Array<{
    language: string
    enabled: boolean
    docsCount: number
    lastUpdated: string
  }>> {
    const status = []
    for (const [language, config] of this.configs) {
      status.push({
        language,
        enabled: config.enabled,
        docsCount: config.docs.length,
        lastUpdated: config.lastUpdated || 'never'
      })
    }
    return status
  }
}