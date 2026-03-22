// Unified intelligence engine combining CodeGraph and Context+ capabilities
// FEATURE: Enhanced code intelligence with structural and semantic analysis
export class UnifiedIntelligence {
    codeGraph;
    contextPlus;
    memoryGraph;
    embeddingCache;
    constructor(config) {
        this.codeGraph = new CodeGraphEngine(config);
        this.contextPlus = new ContextPlusEngine(config);
        this.memoryGraph = new MemoryGraphEngine(config);
        this.embeddingCache = new Map();
    }
    async initialize(projectPath) {
        await Promise.all([
            this.codeGraph.initialize(projectPath),
            this.contextPlus.initialize(projectPath),
            this.memoryGraph.initialize(projectPath)
        ]);
    }
    async buildContextPackage(query, maxTokens = 4000) {
        const [codeSymbols, semanticMatches, memoryNodes, relationships] = await Promise.all([
            this.findRelevantSymbols(query),
            this.findSemanticMatches(query),
            this.searchMemory(query),
            this.getRelevantRelationships(query)
        ]);
        const relevantFiles = [...new Set([
                ...codeSymbols.map(s => s.file),
                ...semanticMatches.filter(m => m.metadata.file).map(m => m.metadata.file)
            ])];
        const estimatedTokens = this.estimateTokens(codeSymbols, semanticMatches, memoryNodes);
        if (estimatedTokens > maxTokens) {
            return this.pruneContextPackage({
                query,
                relevantFiles,
                codeSymbols,
                relationships,
                memoryNodes,
                semanticMatches,
                estimatedTokens
            }, maxTokens);
        }
        return {
            query,
            relevantFiles,
            codeSymbols,
            relationships,
            memoryNodes,
            semanticMatches,
            estimatedTokens
        };
    }
    async findRelevantSymbols(query) {
        const [codeGraphResults, contextPlusResults] = await Promise.all([
            this.codeGraph.searchSymbols(query),
            this.contextPlus.searchIdentifiers(query)
        ]);
        return this.mergeSymbolResults(codeGraphResults, contextPlusResults);
    }
    async findSemanticMatches(query) {
        const [codeMatches, contextMatches] = await Promise.all([
            this.codeGraph.semanticSearch(query),
            this.contextPlus.semanticCodeSearch(query)
        ]);
        return [
            ...codeMatches.map(m => ({ ...m, source: 'codegraph' })),
            ...contextMatches.map(m => ({ ...m, source: 'contextplus' }))
        ].sort((a, b) => b.similarity - a.similarity);
    }
    async searchMemory(query) {
        return this.memoryGraph.searchNodes(query);
    }
    async getRelevantRelationships(query) {
        const symbols = await this.findRelevantSymbols(query);
        return this.codeGraph.getRelationships(symbols.map(s => s.id));
    }
    async getBlastRadius(symbolId) {
        const [codeGraphRadius, contextPlusRadius] = await Promise.all([
            this.codeGraph.getImpactRadius(symbolId),
            this.contextPlus.getBlastRadius(symbolId)
        ]);
        return {
            files: [...new Set([...codeGraphRadius.files, ...contextPlusRadius.files])],
            symbols: this.mergeSymbolResults(codeGraphRadius.symbols, contextPlusRadius.symbols)
        };
    }
    async getContextTree(path) {
        return this.contextPlus.getContextTree(path);
    }
    async getFileSkeleton(filePath) {
        return this.contextPlus.getFileSkeleton(filePath);
    }
    async updateMemory(nodeId, content, metadata) {
        await this.memoryGraph.upsertNode(nodeId, content, metadata);
    }
    async createMemoryRelation(fromId, toId, type, strength = 1.0) {
        await this.memoryGraph.createRelation(fromId, toId, type, strength);
    }
    mergeSymbolResults(codeGraphResults, contextPlusResults) {
        const merged = new Map();
        for (const symbol of codeGraphResults) {
            merged.set(symbol.id, symbol);
        }
        for (const symbol of contextPlusResults) {
            const existing = merged.get(symbol.id);
            if (existing) {
                merged.set(symbol.id, { ...existing, ...symbol });
            }
            else {
                merged.set(symbol.id, symbol);
            }
        }
        return Array.from(merged.values());
    }
    estimateTokens(symbols, matches, memory) {
        const symbolTokens = symbols.reduce((acc, s) => acc + (s.signature?.length || 50), 0);
        const matchTokens = matches.reduce((acc, m) => acc + m.content.length, 0);
        const memoryTokens = memory.reduce((acc, n) => acc + n.content.length, 0);
        return Math.ceil((symbolTokens + matchTokens + memoryTokens) / 4);
    }
    pruneContextPackage(pkg, maxTokens) {
        const targetTokens = maxTokens * 0.9;
        let currentTokens = pkg.estimatedTokens;
        const pruned = { ...pkg };
        while (currentTokens > targetTokens) {
            if (pruned.semanticMatches.length > 5) {
                pruned.semanticMatches = pruned.semanticMatches.slice(0, -1);
            }
            else if (pruned.codeSymbols.length > 10) {
                pruned.codeSymbols = pruned.codeSymbols.slice(0, -1);
            }
            else if (pruned.memoryNodes.length > 5) {
                pruned.memoryNodes = pruned.memoryNodes.slice(0, -1);
            }
            else {
                break;
            }
            currentTokens = this.estimateTokens(pruned.codeSymbols, pruned.semanticMatches, pruned.memoryNodes);
        }
        pruned.estimatedTokens = currentTokens;
        return pruned;
    }
}
