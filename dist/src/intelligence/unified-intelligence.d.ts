import { CodeSymbol, CodeRelation, MemoryNode, ContextPackage, SemanticMatch } from '@/core/types';
export declare class UnifiedIntelligence {
    private codeGraph;
    private contextPlus;
    private memoryGraph;
    private embeddingCache;
    constructor(config: IntelligenceConfig);
    initialize(projectPath: string): Promise<void>;
    buildContextPackage(query: string, maxTokens?: number): Promise<ContextPackage>;
    findRelevantSymbols(query: string): Promise<CodeSymbol[]>;
    findSemanticMatches(query: string): Promise<SemanticMatch[]>;
    searchMemory(query: string): Promise<MemoryNode[]>;
    getRelevantRelationships(query: string): Promise<CodeRelation[]>;
    getBlastRadius(symbolId: string): Promise<{
        files: string[];
        symbols: CodeSymbol[];
    }>;
    getContextTree(path?: string): Promise<FileTreeNode[]>;
    getFileSkeleton(filePath: string): Promise<CodeSymbol[]>;
    updateMemory(nodeId: string, content: string, metadata?: Record<string, any>): Promise<void>;
    createMemoryRelation(fromId: string, toId: string, type: string, strength?: number): Promise<void>;
    private mergeSymbolResults;
    private estimateTokens;
    private pruneContextPackage;
}
