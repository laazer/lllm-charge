import { DocsIntelligence } from './docs-intelligence';
import { KnowledgeBase } from '../core/knowledge-base';
export interface DocsUsagePattern {
    language?: string;
    framework?: string;
    tools?: string[];
    libraries?: string[];
    confidence: number;
}
export interface SmartCacheConfig {
    autoDownload: boolean;
    minConfidenceThreshold: number;
    maxDocsPerSession: number;
    backgroundDownload: boolean;
    expirationDays: number;
}
export declare class SmartDocsCache {
    private docsIntelligence;
    private knowledgeBase;
    private projectPath;
    private config;
    private downloadQueue;
    private downloadInProgress;
    private lastProjectScan?;
    private detectedPatterns;
    constructor(docsIntelligence: DocsIntelligence, knowledgeBase: KnowledgeBase, projectPath: string, config?: SmartCacheConfig);
    processQuery(query: string): Promise<string[]>;
    detectNeededDocs(query: string): Promise<string[]>;
    private analyzeQueryPatterns;
    private analyzeProjectPatterns;
    private filterMissingDocs;
    private queueDocsForDownload;
    processDownloadQueue(): Promise<{
        downloaded: string[];
        failed: string[];
    }>;
    cleanupExpiredDocs(): Promise<void>;
    getQueueStatus(): Promise<{
        queued: string[];
        inProgress: string[];
    }>;
    private calculatePatternConfidence;
    private mapDependencyToDoc;
    private isLanguage;
    private isFramework;
    private isTool;
    private isLibrary;
    private fileExists;
}
