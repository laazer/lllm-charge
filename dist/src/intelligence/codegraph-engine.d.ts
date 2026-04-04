import { CodeSymbol, CodeRelation, SemanticMatch } from '@/core/types';
export declare class CodeGraphEngine {
    private config;
    private db;
    private parser;
    private languages;
    private projectPath;
    constructor(config: any);
    initialize(projectPath: string): Promise<void>;
    searchSymbols(query: string, limit?: number): Promise<CodeSymbol[]>;
    semanticSearch(query: string, limit?: number): Promise<SemanticMatch[]>;
    getRelationships(symbolIds: string[]): Promise<CodeRelation[]>;
    getImpactRadius(symbolId: string, depth?: number): Promise<{
        files: string[];
        symbols: CodeSymbol[];
    }>;
    getCallers(symbolId: string): Promise<CodeSymbol[]>;
    getCallees(symbolId: string): Promise<CodeSymbol[]>;
    private initializeDatabase;
    private createTables;
    private initializeParser;
    private indexProject;
    private mapRowToSymbol;
    private mapRowToRelation;
    private getSymbolById;
    private generateEmbedding;
}
