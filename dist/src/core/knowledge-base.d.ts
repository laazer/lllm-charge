export interface CodeSymbol {
    id: string;
    name: string;
    kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'variable' | 'module';
    signature: string;
    location: {
        file: string;
        line: number;
        column: number;
    };
    metadata?: any;
    embedding?: Float32Array;
}
export interface CodeRelation {
    from: string;
    to: string;
    kind: 'calls' | 'extends' | 'implements' | 'imports' | 'contains';
    confidence: number;
    metadata?: any;
}
export interface KnowledgeQuery {
    query: string;
    context?: string;
    includeEmbeddings?: boolean;
    maxResults?: number;
}
export interface QueryResult {
    symbols: CodeSymbol[];
    relations: CodeRelation[];
    confidence: number;
    executionTime: number;
}
interface SemanticSearchOptions {
    type?: string;
    limit?: number;
    threshold?: number;
}
interface SemanticMatch {
    id: string;
    content: string;
    metadata?: any;
    similarity: number;
}
export declare class KnowledgeBase {
    private db;
    private dbPath;
    private embeddingCache;
    constructor(dbPath: string);
    initialize(): Promise<void>;
    private ensureDirectoryExists;
    private initializeDatabase;
    storeSymbol(symbol: CodeSymbol): Promise<void>;
    storeRelation(relation: CodeRelation): Promise<void>;
    findSymbols(query: string, limit?: number): Promise<CodeSymbol[]>;
    findSymbolById(id: string): Promise<CodeSymbol | null>;
    getRelatedSymbols(symbolId: string, maxDepth?: number): Promise<CodeSymbol[]>;
    searchSimilar(query: string, options?: KnowledgeQuery): Promise<QueryResult>;
    getStatistics(): Promise<{
        symbolCount: number;
        relationCount: number;
        lastUpdated: Date;
    }>;
    cleanup(): Promise<void>;
    getOrCreateEmbedding(text: string): Promise<Float32Array>;
    store(id: string, content: string, metadata?: any): Promise<void>;
    searchSemantic(query: string, options?: SemanticSearchOptions): Promise<SemanticMatch[]>;
    updateLastAccessed(id: string): Promise<void>;
    cleanupExpiredDocs(maxAgeMs?: number): Promise<number>;
    private rowToSymbol;
    private getSymbolRelations;
    private getSymbolCount;
    private getRelationCount;
}
export {};
