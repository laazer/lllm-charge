import { CodeSymbol, SemanticMatch } from '@/core/types';
export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    symbols?: CodeSymbol[];
    children?: FileTreeNode[];
}
export declare class ContextPlusEngine {
    private config;
    private projectPath;
    private embeddingCache;
    private ollamaUrl;
    private embedModel;
    constructor(config: IntelligenceConfig);
    initialize(projectPath: string): Promise<void>;
    getContextTree(targetPath?: string): Promise<FileTreeNode[]>;
    getFileSkeleton(filePath: string): Promise<CodeSymbol[]>;
    searchIdentifiers(query: string, limit?: number): Promise<CodeSymbol[]>;
    semanticCodeSearch(query: string, limit?: number): Promise<SemanticMatch[]>;
    getBlastRadius(symbolId: string): Promise<{
        files: string[];
        symbols: CodeSymbol[];
    }>;
    semanticNavigate(query: string): Promise<{
        clusters: Array<{
            label: string;
            files: string[];
        }>;
        orphans: string[];
    }>;
    private buildFileTree;
    private extractSymbols;
    private getAllCodeFiles;
    private isCodeFile;
    private extractFileHeader;
    private generateEmbedding;
    private cosineSimilarity;
    private performSpectralClustering;
    private hashString;
    private ensureCacheDirectory;
    private loadEmbeddingCache;
    private getSymbolFromCache;
}
