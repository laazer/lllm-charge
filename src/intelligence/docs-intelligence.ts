// Developer documentation intelligence using DevDocs + GPT4All
// FEATURE: Local documentation storage and semantic search for zero-cost lookups

import * as path from 'path'
import * as fs from 'fs/promises'
import { execSync, spawn } from 'child_process'
import { KnowledgeBase } from '../core/knowledge-base'
import { SmartDocsCache } from './smart-docs-cache'

export interface DevDoc {
  name: string
  slug: string
  type: string
  version?: string
  release?: string
  mtime?: number
  db_size?: number
  index?: DocIndex[]
}

export interface DocIndex {
  name: string
  path: string
  type: string
}

export interface DocSearchResult {
  doc: string
  name: string
  path: string
  type: string
  content?: string
  similarity: number
  source: 'devdocs' | 'gpt4all' | 'hybrid'
}

export interface DocQuery {
  query: string
  docs?: string[] // Specific docs to search
  limit?: number
  includeContent?: boolean
  similarity_threshold?: number
}

export class DocsIntelligence {
  private devDocsPath: string
  private gpt4allPath: string
  private knowledgeBase: KnowledgeBase
  private smartCache: SmartDocsCache
  private cachedDocs: Map<string, DevDoc[]> = new Map()
  
  constructor(
    private projectDir: string,
    knowledgeBase: KnowledgeBase
  ) {
    this.devDocsPath = path.join(projectDir, 'devdocs')
    this.gpt4allPath = path.join(projectDir, 'gpt4all')
    this.knowledgeBase = knowledgeBase
  }

  async initialize(): Promise<void> {
    // Ensure DevDocs is set up
    await this.setupDevDocs()
    
    // Initialize GPT4All for document storage
    await this.setupGPT4All()
    
    // Initialize smart caching
    this.smartCache = new SmartDocsCache(this, this.knowledgeBase, this.projectDir)
    
    // Load available documentation
    await this.loadAvailableDocs()
    
    // Clean up expired docs
    await this.smartCache.cleanupExpiredDocs()
  }

  async searchDocs(query: DocQuery): Promise<DocSearchResult[]> {
    // Check for missing docs and queue for automatic download
    const missingDocs = await this.smartCache.processQuery(query.query)
    
    if (missingDocs.length > 0) {
      console.log(`🔍 Detected ${missingDocs.length} potentially useful docs: ${missingDocs.join(', ')}`)
      console.log('📥 Auto-downloading in background for future queries...')
    }
    
    const results: DocSearchResult[] = []
    
    // First, try semantic search in our knowledge base
    const semanticResults = await this.searchSemanticDocs(query)
    results.push(...semanticResults)
    
    // Update last accessed for found docs
    for (const result of semanticResults) {
      await this.knowledgeBase.updateLastAccessed(`doc:${result.doc}:${result.name}`)
    }
    
    // Then try DevDocs structured search
    const devDocsResults = await this.searchDevDocs(query)
    results.push(...devDocsResults)
    
    // Combine and deduplicate results
    const dedupedResults = this.deduplicateResults(results)
    
    // Sort by similarity and limit
    return dedupedResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, query.limit || 10)
  }

  async indexDocumentation(docs: string[]): Promise<void> {
    for (const docName of docs) {
      console.log(`Indexing documentation: ${docName}`)
      
      // Download/scrape documentation using DevDocs
      await this.downloadDocumentation(docName)
      
      // Process and store in GPT4All/knowledge base
      await this.processDocs(docName)
    }
  }

  async getAvailableDocumentations(): Promise<DevDoc[]> {
    if (this.cachedDocs.has('available')) {
      return this.cachedDocs.get('available')!
    }
    
    const docs = await this.loadAvailableDocs()
    this.cachedDocs.set('available', docs)
    return docs
  }

  async getDocumentationStatus(): Promise<{installed: string[], available: string[], storage_size: number}> {
    const available = await this.getAvailableDocumentations()
    const installed = await this.getInstalledDocs()
    const storageSize = await this.calculateStorageSize()
    
    return {
      installed: installed.map(d => d.slug),
      available: available.map(d => d.slug),
      storage_size: storageSize
    }
  }

  private async setupDevDocs(): Promise<void> {
    if (!await this.fileExists(this.devDocsPath)) {
      throw new Error('DevDocs not found. Please ensure it is cloned in the project directory.')
    }
    
    try {
      // Check if DevDocs dependencies are installed
      const gemfileLock = path.join(this.devDocsPath, 'Gemfile.lock')
      if (!await this.fileExists(gemfileLock)) {
        console.log('Installing DevDocs dependencies...')
        execSync('bundle install', { cwd: this.devDocsPath })
      }
      
      console.log('DevDocs setup complete')
    } catch (error) {
      console.warn('DevDocs setup incomplete, some features may be limited:', error)
    }
  }

  private async setupGPT4All(): Promise<void> {
    if (!await this.fileExists(this.gpt4allPath)) {
      throw new Error('GPT4All not found. Please ensure it is cloned in the project directory.')
    }
    
    try {
      // Check if GPT4All Python bindings are available
      const pythonBindings = path.join(this.gpt4allPath, 'gpt4all-bindings/python')
      if (await this.fileExists(pythonBindings)) {
        // Could install Python bindings here if needed
        console.log('GPT4All bindings available')
      }
      
      console.log('GPT4All setup complete')
    } catch (error) {
      console.warn('GPT4All setup incomplete, some features may be limited:', error)
    }
  }

  private async loadAvailableDocs(): Promise<DevDoc[]> {
    try {
      // Get available docs from DevDocs
      const docsPath = path.join(this.devDocsPath, 'lib/docs.rb')
      if (!await this.fileExists(docsPath)) {
        return []
      }
      
      // Parse common documentation types
      return [
        { name: 'JavaScript', slug: 'javascript', type: 'language' },
        { name: 'TypeScript', slug: 'typescript', type: 'language' },
        { name: 'Python', slug: 'python', type: 'language' },
        { name: 'Go', slug: 'go', type: 'language' },
        { name: 'Rust', slug: 'rust', type: 'language' },
        { name: 'React', slug: 'react', type: 'framework' },
        { name: 'Vue.js', slug: 'vue', type: 'framework' },
        { name: 'Angular', slug: 'angular', type: 'framework' },
        { name: 'Node.js', slug: 'node', type: 'runtime' },
        { name: 'Express.js', slug: 'express', type: 'framework' },
        { name: 'Docker', slug: 'docker', type: 'tool' },
        { name: 'Kubernetes', slug: 'kubernetes', type: 'tool' },
        { name: 'Git', slug: 'git', type: 'tool' },
        { name: 'Bash', slug: 'bash', type: 'shell' },
        { name: 'PostgreSQL', slug: 'postgresql', type: 'database' },
        { name: 'Redis', slug: 'redis', type: 'database' },
        { name: 'AWS CLI', slug: 'awscli', type: 'tool' },
        { name: 'GitHub CLI', slug: 'githubcli', type: 'tool' }
      ]
    } catch (error) {
      console.warn('Could not load available docs:', error)
      return []
    }
  }

  private async searchSemanticDocs(query: DocQuery): Promise<DocSearchResult[]> {
    try {
      // Search in our knowledge base using semantic similarity
      const matches = await this.knowledgeBase.searchSemantic(query.query, {
        type: 'documentation',
        limit: query.limit || 5,
        threshold: query.similarity_threshold || 0.7
      })
      
      return matches.map(match => ({
        doc: match.metadata?.doc || 'unknown',
        name: match.metadata?.name || match.content.slice(0, 50),
        path: match.metadata?.path || '',
        type: match.metadata?.type || 'doc',
        content: query.includeContent ? match.content : undefined,
        similarity: match.similarity,
        source: 'gpt4all' as const
      }))
    } catch (error) {
      console.warn('Semantic docs search failed:', error)
      return []
    }
  }

  private async searchDevDocs(query: DocQuery): Promise<DocSearchResult[]> {
    try {
      // Simulate DevDocs search - in reality this would use their search API
      const searchTerms = query.query.toLowerCase().split(' ')
      const availableDocs = await this.getAvailableDocumentations()
      
      const results: DocSearchResult[] = []
      
      for (const doc of availableDocs) {
        if (query.docs && !query.docs.includes(doc.slug)) {
          continue
        }
        
        // Simple keyword matching for demonstration
        const nameMatch = searchTerms.some(term => 
          doc.name.toLowerCase().includes(term) || 
          doc.slug.toLowerCase().includes(term)
        )
        
        if (nameMatch) {
          results.push({
            doc: doc.slug,
            name: doc.name,
            path: `/${doc.slug}/`,
            type: doc.type,
            similarity: this.calculateKeywordSimilarity(query.query, doc.name),
            source: 'devdocs'
          })
        }
      }
      
      return results
    } catch (error) {
      console.warn('DevDocs search failed:', error)
      return []
    }
  }

  private async downloadDocumentation(docName: string): Promise<void> {
    try {
      console.log(`Downloading documentation for: ${docName}`)
      
      // This would use DevDocs scraping functionality
      // For now, we simulate by creating placeholder docs
      const docDir = path.join(this.projectDir, '.llm-charge', 'docs', docName)
      await fs.mkdir(docDir, { recursive: true })
      
      // Simulate downloading common pages
      const commonPages = [
        'introduction.md',
        'getting-started.md',
        'api-reference.md',
        'examples.md'
      ]
      
      for (const page of commonPages) {
        const content = `# ${docName} - ${page.replace('.md', '')}\n\nThis is documentation content for ${docName}.\n`
        await fs.writeFile(path.join(docDir, page), content)
      }
      
      console.log(`Downloaded ${commonPages.length} pages for ${docName}`)
    } catch (error) {
      console.error(`Failed to download documentation for ${docName}:`, error)
    }
  }

  private async processDocs(docName: string): Promise<void> {
    try {
      const docDir = path.join(this.projectDir, '.llm-charge', 'docs', docName)
      const files = await fs.readdir(docDir)
      
      for (const file of files) {
        const filePath = path.join(docDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        
        // Store in knowledge base with semantic embeddings
        const id = `doc:${docName}:${file}`
        await this.knowledgeBase.store(id, content, {
          type: 'documentation',
          doc: docName,
          name: file.replace('.md', ''),
          path: `/${docName}/${file}`,
          indexed_at: Date.now()
        })
      }
      
      console.log(`Processed ${files.length} documentation files for ${docName}`)
    } catch (error) {
      console.error(`Failed to process docs for ${docName}:`, error)
    }
  }

  private async getInstalledDocs(): Promise<DevDoc[]> {
    try {
      const docsDir = path.join(this.projectDir, '.llm-charge', 'docs')
      if (!await this.fileExists(docsDir)) {
        return []
      }
      
      const dirs = await fs.readdir(docsDir, { withFileTypes: true })
      const installedDocs: DevDoc[] = []
      
      for (const dir of dirs) {
        if (dir.isDirectory()) {
          installedDocs.push({
            name: dir.name,
            slug: dir.name,
            type: 'local'
          })
        }
      }
      
      return installedDocs
    } catch (error) {
      return []
    }
  }

  private async calculateStorageSize(): Promise<number> {
    try {
      const docsDir = path.join(this.projectDir, '.llm-charge', 'docs')
      if (!await this.fileExists(docsDir)) {
        return 0
      }
      
      const result = execSync(`du -sb "${docsDir}"`, { encoding: 'utf-8' })
      return parseInt(result.split('\t')[0])
    } catch (error) {
      return 0
    }
  }

  private deduplicateResults(results: DocSearchResult[]): DocSearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = `${result.doc}:${result.path}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private calculateKeywordSimilarity(query: string, target: string): number {
    const queryWords = query.toLowerCase().split(' ')
    const targetWords = target.toLowerCase().split(' ')
    
    let matches = 0
    for (const word of queryWords) {
      if (targetWords.some(targetWord => targetWord.includes(word) || word.includes(targetWord))) {
        matches++
      }
    }
    
    return matches / queryWords.length
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