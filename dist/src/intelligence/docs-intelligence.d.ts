import { KnowledgeBase } from '../core/knowledge-base';
export interface DevDoc {
    name: string;
    slug: string;
    type: string;
    version?: string;
    release?: string;
    mtime?: number;
    db_size?: number;
    index?: DocIndex[];
}
export interface DocIndex {
    name: string;
    path: string;
    type: string;
}
export interface DocSearchResult {
    doc: string;
    name: string;
    path: string;
    type: string;
    content?: string;
    similarity: number;
    source: 'devdocs' | 'gpt4all' | 'hybrid';
}
export interface DocQuery {
    query: string;
    docs?: string[];
    limit?: number;
    includeContent?: boolean;
    similarity_threshold?: number;
}
export declare class DocsIntelligence {
    private projectDir;
    private devDocsPath;
    private gpt4allPath;
    private knowledgeBase;
    private smartCache;
    private cachedDocs;
    constructor(projectDir: string, knowledgeBase: KnowledgeBase);
    initialize(): Promise<void>;
    searchDocs(query: DocQuery): Promise<DocSearchResult[]>;
    indexDocumentation(docs: string[]): Promise<void>;
    getAvailableDocumentations(): Promise<DevDoc[]>;
    getDocumentationStatus(): Promise<{
        installed: string[];
        available: string[];
        storage_size: number;
    }>;
    private setupDevDocs;
    private setupGPT4All;
    private loadAvailableDocs;
    private searchSemanticDocs;
    private searchDevDocs;
    private downloadDocumentation;
    private processDocs;
    private getInstalledDocs;
    private calculateStorageSize;
    private deduplicateResults;
    private calculateKeywordSimilarity;
    private fileExists;
}
