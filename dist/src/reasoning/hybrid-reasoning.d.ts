import { UnifiedIntelligence } from '@/intelligence/unified-intelligence';
import { RLMEngine } from './rlm-engine';
import { LocalLLMRouter } from './local-llm-router';
import { ContextPackage, ReasoningSession } from '@/core/types';
import { SkillEnrichmentProvider, SkillUsageSummary } from './skill-enrichment-provider';
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
    executionTimeMs?: number;
    skillsUsed?: SkillUsageSummary[];
}
export declare class HybridReasoning {
    private intelligence;
    private rlmEngine;
    private router;
    private skillProvider?;
    private commandHandler;
    constructor(intelligence: UnifiedIntelligence, rlmEngine: RLMEngine, router: LocalLLMRouter, skillProvider?: SkillEnrichmentProvider | undefined);
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
    private enrichContextWithSkills;
    private updateMemoryGraph;
}
