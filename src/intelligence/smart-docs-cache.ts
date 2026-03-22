// Intelligent documentation caching with automatic detection and 365-day expiration
// FEATURE: Auto-detects needed docs from code context and user queries

import { DocsIntelligence } from './docs-intelligence'
import { KnowledgeBase } from '../core/knowledge-base'
import * as path from 'path'
import * as fs from 'fs/promises'

export interface DocsUsagePattern {
  language?: string
  framework?: string
  tools?: string[]
  libraries?: string[]
  confidence: number
}

export interface SmartCacheConfig {
  autoDownload: boolean
  minConfidenceThreshold: number
  maxDocsPerSession: number
  backgroundDownload: boolean
  expirationDays: number
}

export class SmartDocsCache {
  private downloadQueue: Set<string> = new Set()
  private downloadInProgress: Set<string> = new Set()
  private lastProjectScan?: Date
  private detectedPatterns: DocsUsagePattern[] = []

  constructor(
    private docsIntelligence: DocsIntelligence,
    private knowledgeBase: KnowledgeBase,
    private projectPath: string,
    private config: SmartCacheConfig = {
      autoDownload: true,
      minConfidenceThreshold: 0.8,
      maxDocsPerSession: 5,
      backgroundDownload: true,
      expirationDays: 365
    }
  ) {}

  async processQuery(query: string): Promise<string[]> {
    const detectedDocs = await this.detectNeededDocs(query)
    const missingDocs = await this.filterMissingDocs(detectedDocs)
    
    if (missingDocs.length > 0 && this.config.autoDownload) {
      await this.queueDocsForDownload(missingDocs)
    }
    
    return missingDocs
  }

  async detectNeededDocs(query: string): Promise<string[]> {
    const patterns = await this.analyzeQueryPatterns(query)
    const projectPatterns = await this.analyzeProjectPatterns()
    
    // Combine query and project context
    const allPatterns = [...patterns, ...projectPatterns]
    const docsNeeded: string[] = []
    
    for (const pattern of allPatterns) {
      if (pattern.confidence >= this.config.minConfidenceThreshold) {
        if (pattern.language) docsNeeded.push(pattern.language)
        if (pattern.framework) docsNeeded.push(pattern.framework)
        if (pattern.tools) docsNeeded.push(...pattern.tools)
        if (pattern.libraries) docsNeeded.push(...pattern.libraries)
      }
    }
    
    return [...new Set(docsNeeded)].slice(0, this.config.maxDocsPerSession)
  }

  private async analyzeQueryPatterns(query: string): Promise<DocsUsagePattern[]> {
    const patterns: DocsUsagePattern[] = []
    const lowerQuery = query.toLowerCase()
    
    // Language detection patterns
    const languagePatterns = {
      javascript: /\b(javascript|js|node|npm|yarn|es6|es2015|babel)\b/i,
      typescript: /\b(typescript|ts|tsc|tsconfig)\b/i,
      python: /\b(python|py|pip|conda|flask|django|fastapi)\b/i,
      react: /\b(react|jsx|tsx|usestate|useeffect|component|hooks?)\b/i,
      vue: /\b(vue|vuejs|nuxt|vite)\b/i,
      angular: /\b(angular|ng|typescript|component|service|directive)\b/i,
      go: /\b(golang?|go\s+mod|goroutine|channel)\b/i,
      rust: /\b(rust|cargo|rustup|crate)\b/i,
      docker: /\b(docker|dockerfile|container|image|compose)\b/i,
      kubernetes: /\b(kubernetes|k8s|kubectl|helm|pod|deployment)\b/i,
      git: /\b(git|github|gitlab|commit|branch|merge|rebase)\b/i,
      bash: /\b(bash|shell|script|command|terminal)\b/i
    }
    
    for (const [docName, pattern] of Object.entries(languagePatterns)) {
      const matches = lowerQuery.match(pattern)
      if (matches) {
        const confidence = this.calculatePatternConfidence(matches, query)
        
        if (this.isFramework(docName)) {
          patterns.push({ framework: docName, confidence })
        } else if (this.isTool(docName)) {
          patterns.push({ tools: [docName], confidence })
        } else {
          patterns.push({ language: docName, confidence })
        }
      }
    }
    
    return patterns
  }

  private async analyzeProjectPatterns(): Promise<DocsUsagePattern[]> {
    // Only scan project once per session or when files change
    if (this.lastProjectScan && (Date.now() - this.lastProjectScan.getTime() < 5 * 60 * 1000)) {
      return this.detectedPatterns
    }
    
    const patterns: DocsUsagePattern[] = []
    
    try {
      // Check package.json for dependencies
      const packageJsonPath = path.join(this.projectPath, 'package.json')
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
        
        for (const dep of Object.keys(deps)) {
          const docName = this.mapDependencyToDoc(dep)
          if (docName) {
            patterns.push({
              language: this.isLanguage(docName) ? docName : undefined,
              framework: this.isFramework(docName) ? docName : undefined,
              libraries: this.isLibrary(docName) ? [docName] : undefined,
              confidence: 0.9
            })
          }
        }
      }
      
      // Check for common config files
      const configFiles = [
        { file: 'tsconfig.json', doc: 'typescript', confidence: 0.95 },
        { file: 'Dockerfile', doc: 'docker', confidence: 0.9 },
        { file: 'docker-compose.yml', doc: 'docker', confidence: 0.9 },
        { file: 'go.mod', doc: 'go', confidence: 0.95 },
        { file: 'Cargo.toml', doc: 'rust', confidence: 0.95 },
        { file: 'requirements.txt', doc: 'python', confidence: 0.9 },
        { file: 'Pipfile', doc: 'python', confidence: 0.9 },
        { file: '.gitignore', doc: 'git', confidence: 0.7 }
      ]
      
      for (const { file, doc, confidence } of configFiles) {
        if (await this.fileExists(path.join(this.projectPath, file))) {
          if (this.isFramework(doc)) {
            patterns.push({ framework: doc, confidence })
          } else if (this.isTool(doc)) {
            patterns.push({ tools: [doc], confidence })
          } else {
            patterns.push({ language: doc, confidence })
          }
        }
      }
      
      this.detectedPatterns = patterns
      this.lastProjectScan = new Date()
      
    } catch (error) {
      console.warn('Error analyzing project patterns:', error)
    }
    
    return patterns
  }

  private async filterMissingDocs(docs: string[]): Promise<string[]> {
    const status = await this.docsIntelligence.getDocumentationStatus()
    return docs.filter(doc => !status.installed.includes(doc))
  }

  private async queueDocsForDownload(docs: string[]): Promise<void> {
    const newDocs = docs.filter(doc => 
      !this.downloadQueue.has(doc) && !this.downloadInProgress.has(doc)
    )
    
    newDocs.forEach(doc => this.downloadQueue.add(doc))
    
    if (this.config.backgroundDownload && newDocs.length > 0) {
      // Don't await - run in background
      this.processDownloadQueue().catch(error => {
        console.warn('Background download failed:', error)
      })
    }
  }

  async processDownloadQueue(): Promise<{downloaded: string[], failed: string[]}> {
    const downloaded: string[] = []
    const failed: string[] = []
    const toProcess = Array.from(this.downloadQueue).slice(0, this.config.maxDocsPerSession)
    
    for (const doc of toProcess) {
      this.downloadQueue.delete(doc)
      this.downloadInProgress.add(doc)
      
      try {
        console.log(`📚 Auto-downloading documentation: ${doc}`)
        await this.docsIntelligence.indexDocumentation([doc])
        downloaded.push(doc)
        console.log(`✅ Successfully cached documentation: ${doc}`)
      } catch (error) {
        console.warn(`❌ Failed to download documentation for ${doc}:`, error)
        failed.push(doc)
      } finally {
        this.downloadInProgress.delete(doc)
      }
    }
    
    return { downloaded, failed }
  }

  async cleanupExpiredDocs(): Promise<void> {
    const maxAge = this.config.expirationDays * 24 * 60 * 60 * 1000
    const cleaned = await this.knowledgeBase.cleanupExpiredDocs(maxAge)
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired documentation entries`)
    }
  }

  async getQueueStatus(): Promise<{queued: string[], inProgress: string[]}> {
    return {
      queued: Array.from(this.downloadQueue),
      inProgress: Array.from(this.downloadInProgress)
    }
  }

  private calculatePatternConfidence(matches: RegExpMatchArray, query: string): number {
    const matchCount = matches.length
    const queryLength = query.split(' ').length
    
    // More matches in shorter queries = higher confidence
    let confidence = Math.min(1.0, (matchCount / queryLength) * 2)
    
    // Boost confidence for exact matches
    if (matches.some(match => match === match.toLowerCase())) {
      confidence += 0.2
    }
    
    return Math.min(1.0, confidence)
  }

  private mapDependencyToDoc(dep: string): string | null {
    const depMap: Record<string, string> = {
      'react': 'react',
      '@types/react': 'react', 
      'vue': 'vue',
      'angular': 'angular',
      'express': 'express',
      'fastapi': 'python',
      'flask': 'python',
      'django': 'python',
      'typescript': 'typescript',
      'eslint': 'javascript',
      'prettier': 'javascript',
      'webpack': 'javascript',
      'vite': 'vue',
      'next': 'react',
      'nuxt': 'vue'
    }
    
    return depMap[dep] || null
  }

  private isLanguage(doc: string): boolean {
    return ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'csharp'].includes(doc)
  }

  private isFramework(doc: string): boolean {
    return ['react', 'vue', 'angular', 'express', 'fastapi', 'flask', 'django'].includes(doc)
  }

  private isTool(doc: string): boolean {
    return ['docker', 'kubernetes', 'git', 'bash', 'npm', 'yarn'].includes(doc)
  }

  private isLibrary(doc: string): boolean {
    return ['lodash', 'axios', 'moment', 'jquery'].includes(doc)
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}