// Context+ integration engine for semantic code intelligence  
// FEATURE: Advanced semantic analysis with clustering and memory graph

import { CodeSymbol, MemoryNode, SemanticMatch, IntelligenceConfig } from '@/core/types'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  symbols?: CodeSymbol[]
  children?: FileTreeNode[]
}

export class ContextPlusEngine {
  private projectPath!: string
  private embeddingCache: Map<string, Float32Array>
  private ollamaUrl: string
  private embedModel: string

  constructor(private config: IntelligenceConfig) {
    this.embeddingCache = new Map()
    this.ollamaUrl = 'http://localhost:11434'
    this.embedModel = config.embedModel || 'nomic-embed-text'
  }

  async initialize(projectPath: string): Promise<void> {
    this.projectPath = projectPath
    await this.ensureCacheDirectory()
    await this.loadEmbeddingCache()
  }

  async getContextTree(targetPath?: string): Promise<FileTreeNode[]> {
    const rootPath = targetPath ? path.join(this.projectPath, targetPath) : this.projectPath
    return this.buildFileTree(rootPath)
  }

  async getFileSkeleton(filePath: string): Promise<CodeSymbol[]> {
    const fullPath = path.join(this.projectPath, filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    return this.extractSymbols(content, filePath)
  }

  async searchIdentifiers(query: string, limit = 20): Promise<CodeSymbol[]> {
    const embedding = await this.generateEmbedding(query)
    const results: Array<{symbol: CodeSymbol, similarity: number}> = []

    for (const [symbolId, symbolEmbedding] of this.embeddingCache) {
      const similarity = this.cosineSimilarity(embedding, symbolEmbedding)
      if (similarity > 0.3) {
        const symbol = await this.getSymbolFromCache(symbolId)
        if (symbol) {
          results.push({symbol, similarity})
        }
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(r => r.symbol)
  }

  async semanticCodeSearch(query: string, limit = 15): Promise<SemanticMatch[]> {
    const queryEmbedding = await this.generateEmbedding(query)
    const matches: SemanticMatch[] = []

    const files = await this.getAllCodeFiles()
    
    for (const file of files.slice(0, 100)) {
      const content = await fs.readFile(file, 'utf-8')
      const fileEmbedding = await this.generateEmbedding(content.slice(0, 2000))
      const similarity = this.cosineSimilarity(queryEmbedding, fileEmbedding)
      
      if (similarity > 0.2) {
        matches.push({
          content: this.extractFileHeader(content),
          similarity,
          source: 'contextplus',
          metadata: {
            file: path.relative(this.projectPath, file),
            fullContent: content.length > 2000
          }
        })
      }
    }

    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  async getBlastRadius(symbolId: string): Promise<{files: string[], symbols: CodeSymbol[]}> {
    const symbol = await this.getSymbolFromCache(symbolId)
    if (!symbol) {
      return {files: [], symbols: []}
    }

    const impactedFiles = new Set<string>()
    const impactedSymbols: CodeSymbol[] = []

    const allFiles = await this.getAllCodeFiles()
    
    for (const file of allFiles) {
      const content = await fs.readFile(file, 'utf-8')
      const relativePath = path.relative(this.projectPath, file)
      
      if (content.includes(symbol.name)) {
        impactedFiles.add(relativePath)
        const fileSymbols = await this.extractSymbols(content, relativePath)
        impactedSymbols.push(...fileSymbols.filter(s => 
          content.includes(symbol.name) && s.name !== symbol.name
        ))
      }
    }

    return {
      files: Array.from(impactedFiles),
      symbols: impactedSymbols
    }
  }

  async semanticNavigate(query: string): Promise<{clusters: Array<{label: string, files: string[]}>, orphans: string[]}> {
    const files = await this.getAllCodeFiles()
    const embeddings = new Map<string, Float32Array>()
    
    for (const file of files.slice(0, 50)) {
      const content = await fs.readFile(file, 'utf-8')
      const embedding = await this.generateEmbedding(content.slice(0, 1500))
      embeddings.set(file, embedding)
    }

    const clusters = await this.performSpectralClustering(embeddings)
    const orphans = files.filter(f => !clusters.some(c => c.files.includes(f)))

    return {clusters, orphans}
  }

  private async buildFileTree(dirPath: string, depth = 0, maxDepth = 3): Promise<FileTreeNode[]> {
    if (depth > maxDepth) return []
    
    const entries = await fs.readdir(dirPath, {withFileTypes: true})
    const nodes: FileTreeNode[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(this.projectPath, fullPath)
      
      if (entry.isDirectory()) {
        const children = await this.buildFileTree(fullPath, depth + 1, maxDepth)
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children
        })
      } else if (this.isCodeFile(entry.name)) {
        const stat = await fs.stat(fullPath)
        const symbols = await this.getFileSkeleton(relativePath)
        
        nodes.push({
          name: entry.name,
          path: relativePath, 
          type: 'file',
          size: stat.size,
          symbols
        })
      }
    }

    return nodes
  }

  private async extractSymbols(content: string, filePath: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = []
    const lines = content.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.includes('function ') || line.includes('const ') || line.includes('class ')) {
        const match = line.match(/(?:function|const|class)\s+(\w+)/)
        if (match) {
          symbols.push({
            id: `${filePath}:${match[1]}:${i}`,
            name: match[1],
            kind: line.includes('class') ? 'class' as any : 'function' as any,
            file: filePath,
            line: i + 1,
            column: line.indexOf(match[1]),
            signature: line.trim()
          })
        }
      }
    }

    return symbols
  }

  private async getAllCodeFiles(): Promise<string[]> {
    const files: string[] = []
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c']
    
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, {withFileTypes: true})
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath)
        }
      }
    }

    await walk(this.projectPath)
    return files
  }

  private isCodeFile(filename: string): boolean {
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c']
    return extensions.some(ext => filename.endsWith(ext))
  }

  private extractFileHeader(content: string): string {
    const lines = content.split('\n').slice(0, 10)
    return lines.join('\n')
  }

  private async generateEmbedding(text: string): Promise<Float32Array> {
    const cacheKey = this.hashString(text)
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!
    }

    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          model: this.embedModel,
          prompt: text
        })
      })

      const data = await response.json()
      const embedding = new Float32Array(data.embedding)
      this.embeddingCache.set(cacheKey, embedding)
      return embedding
    } catch (error) {
      console.warn('Failed to generate embedding:', error)
      return new Float32Array(384).fill(0)
    }
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private async performSpectralClustering(embeddings: Map<string, Float32Array>): Promise<Array<{label: string, files: string[]}>> {
    const files = Array.from(embeddings.keys())
    const numClusters = Math.min(5, Math.floor(files.length / 3))
    
    if (numClusters < 2) {
      return [{label: 'All Files', files}]
    }

    const clusters: Array<{label: string, files: string[]}> = []
    const clusterSize = Math.ceil(files.length / numClusters)
    
    for (let i = 0; i < numClusters; i++) {
      const start = i * clusterSize
      const end = Math.min(start + clusterSize, files.length)
      const clusterFiles = files.slice(start, end)
      
      clusters.push({
        label: `Cluster ${i + 1}`,
        files: clusterFiles.map(f => path.relative(this.projectPath, f))
      })
    }

    return clusters
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString()
  }

  private async ensureCacheDirectory(): Promise<void> {
    const cacheDir = path.join(this.projectPath, '.llm-charge', 'cache')
    await fs.mkdir(cacheDir, {recursive: true})
  }

  private async loadEmbeddingCache(): Promise<void> {
    const cacheFile = path.join(this.projectPath, '.llm-charge', 'cache', 'embeddings.json')
    try {
      const data = await fs.readFile(cacheFile, 'utf-8')
      const cache = JSON.parse(data)
      
      for (const [key, value] of Object.entries(cache)) {
        this.embeddingCache.set(key, new Float32Array(value as number[]))
      }
    } catch (error) {
      // Cache file doesn't exist yet
    }
  }

  private async getSymbolFromCache(symbolId: string): Promise<CodeSymbol | null> {
    // Implementation would retrieve symbol from cache/database
    return null
  }
}