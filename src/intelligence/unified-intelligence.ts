// Unified intelligence engine combining CodeGraph and Context+ capabilities
// FEATURE: Enhanced code intelligence with structural and semantic analysis

import { CodeSymbol, CodeRelation, MemoryNode, ContextPackage, SemanticMatch } from '@/core/types'

export class UnifiedIntelligence {
  private codeGraph: CodeGraphEngine
  private contextPlus: ContextPlusEngine
  private memoryGraph: MemoryGraphEngine
  private embeddingCache: Map<string, Float32Array>

  constructor(config: IntelligenceConfig) {
    this.codeGraph = new CodeGraphEngine(config)
    this.contextPlus = new ContextPlusEngine(config) 
    this.memoryGraph = new MemoryGraphEngine(config)
    this.embeddingCache = new Map()
  }

  async initialize(projectPath: string): Promise<void> {
    await Promise.all([
      this.codeGraph.initialize(projectPath),
      this.contextPlus.initialize(projectPath),
      this.memoryGraph.initialize(projectPath)
    ])
  }

  async buildContextPackage(query: string, maxTokens = 4000): Promise<ContextPackage> {
    const [
      codeSymbols,
      semanticMatches, 
      memoryNodes,
      relationships
    ] = await Promise.all([
      this.findRelevantSymbols(query),
      this.findSemanticMatches(query),
      this.searchMemory(query),
      this.getRelevantRelationships(query)
    ])

    const relevantFiles = [...new Set([
      ...codeSymbols.map(s => s.file),
      ...semanticMatches.filter(m => m.metadata.file).map(m => m.metadata.file)
    ])]

    const estimatedTokens = this.estimateTokens(codeSymbols, semanticMatches, memoryNodes)

    if (estimatedTokens > maxTokens) {
      return this.pruneContextPackage({
        query,
        relevantFiles,
        codeSymbols,
        relationships,
        memoryNodes,
        semanticMatches,
        estimatedTokens
      }, maxTokens)
    }

    return {
      query,
      relevantFiles,
      codeSymbols,
      relationships,
      memoryNodes,
      semanticMatches,
      estimatedTokens
    }
  }

  async findRelevantSymbols(query: string): Promise<CodeSymbol[]> {
    const [codeGraphResults, contextPlusResults] = await Promise.all([
      this.codeGraph.searchSymbols(query),
      this.contextPlus.searchIdentifiers(query)
    ])

    return this.mergeSymbolResults(codeGraphResults, contextPlusResults)
  }

  async findSemanticMatches(query: string): Promise<SemanticMatch[]> {
    const [codeMatches, contextMatches] = await Promise.all([
      this.codeGraph.semanticSearch(query),
      this.contextPlus.semanticCodeSearch(query)
    ])

    return [
      ...codeMatches.map(m => ({ ...m, source: 'codegraph' as const })),
      ...contextMatches.map(m => ({ ...m, source: 'contextplus' as const }))
    ].sort((a, b) => b.similarity - a.similarity)
  }

  async searchMemory(query: string): Promise<MemoryNode[]> {
    return this.memoryGraph.searchNodes(query)
  }

  async getRelevantRelationships(query: string): Promise<CodeRelation[]> {
    const symbols = await this.findRelevantSymbols(query)
    return this.codeGraph.getRelationships(symbols.map(s => s.id))
  }

  async getBlastRadius(symbolId: string): Promise<{files: string[], symbols: CodeSymbol[]}> {
    const [codeGraphRadius, contextPlusRadius] = await Promise.all([
      this.codeGraph.getImpactRadius(symbolId),
      this.contextPlus.getBlastRadius(symbolId)
    ])

    return {
      files: [...new Set([...codeGraphRadius.files, ...contextPlusRadius.files])],
      symbols: this.mergeSymbolResults(codeGraphRadius.symbols, contextPlusRadius.symbols)
    }
  }

  async getContextTree(path?: string): Promise<FileTreeNode[]> {
    return this.contextPlus.getContextTree(path)
  }

  async getFileSkeleton(filePath: string): Promise<CodeSymbol[]> {
    return this.contextPlus.getFileSkeleton(filePath)
  }

  async updateMemory(nodeId: string, content: string, metadata?: Record<string, any>): Promise<void> {
    await this.memoryGraph.upsertNode(nodeId, content, metadata)
  }

  async createMemoryRelation(fromId: string, toId: string, type: string, strength = 1.0): Promise<void> {
    await this.memoryGraph.createRelation(fromId, toId, type, strength)
  }

  private mergeSymbolResults(codeGraphResults: CodeSymbol[], contextPlusResults: CodeSymbol[]): CodeSymbol[] {
    const merged = new Map<string, CodeSymbol>()
    
    for (const symbol of codeGraphResults) {
      merged.set(symbol.id, symbol)
    }
    
    for (const symbol of contextPlusResults) {
      const existing = merged.get(symbol.id)
      if (existing) {
        merged.set(symbol.id, { ...existing, ...symbol })
      } else {
        merged.set(symbol.id, symbol)
      }
    }
    
    return Array.from(merged.values())
  }

  private estimateTokens(
    symbols: CodeSymbol[], 
    matches: SemanticMatch[], 
    memory: MemoryNode[]
  ): number {
    const symbolTokens = symbols.reduce((acc, s) => acc + (s.signature?.length || 50), 0)
    const matchTokens = matches.reduce((acc, m) => acc + m.content.length, 0)
    const memoryTokens = memory.reduce((acc, n) => acc + n.content.length, 0)
    
    return Math.ceil((symbolTokens + matchTokens + memoryTokens) / 4)
  }

  private pruneContextPackage(pkg: ContextPackage, maxTokens: number): ContextPackage {
    const targetTokens = maxTokens * 0.9
    let currentTokens = pkg.estimatedTokens
    
    const pruned = { ...pkg }
    
    while (currentTokens > targetTokens) {
      if (pruned.semanticMatches.length > 5) {
        pruned.semanticMatches = pruned.semanticMatches.slice(0, -1)
      } else if (pruned.codeSymbols.length > 10) {
        pruned.codeSymbols = pruned.codeSymbols.slice(0, -1)
      } else if (pruned.memoryNodes.length > 5) {
        pruned.memoryNodes = pruned.memoryNodes.slice(0, -1)
      } else {
        break
      }
      
      currentTokens = this.estimateTokens(pruned.codeSymbols, pruned.semanticMatches, pruned.memoryNodes)
    }
    
    pruned.estimatedTokens = currentTokens
    return pruned
  }
}