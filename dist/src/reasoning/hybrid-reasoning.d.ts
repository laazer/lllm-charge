import { UnifiedIntelligence } from '@/intelligence/unified-intelligence';
import { RLMEngine } from './rlm-engine';
import { LocalLLMRouter } from './local-llm-router';
import { ContextPackage, ReasoningSession } from '@/core/types';
export interface ReasoningRequest {
    query: string;
    requiresReasoning?: boolean;
    maxSteps?: number;
    preferLocal?: boolean;
    contextTokens?: number;
    complexity?: 'simple' | 'medium' | 'complex';
}
export interface ReasoningResponse {
    answer: string;
    reasoning?: ReasoningSession;
    context?: ContextPackage;
    modelUsed: string;
    isLocal: boolean;
    cost: number;
    tokensUsed: number;
    stepsExecuted: number;
    confidence: number;
}
export declare class HybridReasoning {
    private intelligence;
    private rlmEngine;
    private router;
    private commandHandler;
    constructor(intelligence: UnifiedIntelligence, rlmEngine: RLMEngine, router: LocalLLMRouter);
    processQuery(request: ReasoningRequest, cwd?: string): Promise<ReasoningResponse>;
    private buildIntelligentContext;
    private selectReasoningStrategy;
    private executeDirectLocal;
    private executeRecursiveLocal;
    private executeHybrid;
    private executeAPIFallback;
    private buildEnhancedPrompt;
    private formatContextForRLM;
    private formatContextForPrompt;
    private assessComplexity;
    private needsReasoning;
    private estimateRLMTokens;
    private estimateTokens;
    private updateMemoryGraph;
}
