export { LLMChargeServer } from './mcp/llm-charge-server';
export { UnifiedIntelligence } from './intelligence/unified-intelligence';
export { HybridReasoning } from './reasoning/hybrid-reasoning';
export { LocalLLMRouter } from './reasoning/local-llm-router';
export { RLMEngine } from './reasoning/rlm-engine';
export { LLMOptimizationEngine } from './core/llm-optimization';
export { CostTracker } from './utils/cost-tracker';
export { KnowledgeBase } from './core/knowledge-base';
export * from './core/types';
import { LLMChargeConfig } from './core/types';
export declare class LLMCharge {
    private config;
    private projectPath;
    private server;
    private intelligence;
    private reasoning;
    private router;
    private optimizer;
    private costTracker;
    private initialized;
    constructor(config: LLMChargeConfig, projectPath: string);
    initialize(): Promise<void>;
    startMCPServer(): Promise<void>;
    processQuery(query: string, options?: {
        requiresReasoning?: boolean;
        complexity?: 'simple' | 'medium' | 'complex';
        preferLocal?: boolean;
        maxTokens?: number;
    }): Promise<{
        answer: string;
        model: string;
        isLocal: boolean;
        cost: number;
        tokensUsed: number;
        confidence: number;
    }>;
    optimizeSetup(): Promise<{
        report: any;
        applied: boolean;
        savings: {
            cost: number;
            tokens: number;
            latency: number;
        };
    }>;
    getSystemMetrics(): Promise<{
        cost: any;
        performance: any;
        intelligence: any;
        reasoning: any;
    }>;
    searchCodebase(query: string, options?: {
        includeSemanticSearch?: boolean;
        maxResults?: number;
        fileFilter?: string[];
    }): Promise<{
        symbols: any[];
        files: string[];
        semanticMatches: any[];
        relationships: any[];
    }>;
    shutdown(): Promise<void>;
}
export default LLMCharge;
