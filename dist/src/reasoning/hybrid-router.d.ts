import { KnowledgeBase } from '../core/knowledge-base';
export interface TaskRequest {
    query: string;
    context?: string;
    task: 'reasoning' | 'code_generation' | 'analysis' | 'writing' | 'general';
    priority: 'speed' | 'quality' | 'cost';
    privacy: 'public' | 'private' | 'sensitive';
    complexity?: 'low' | 'medium' | 'high';
    maxLatency?: number;
    maxCost?: number;
}
export interface ProviderChoice {
    provider: 'claude' | 'local';
    model?: string;
    reasoning: string;
    estimatedCost: number;
    estimatedLatency: number;
    confidence: number;
}
export interface RoutingMetrics {
    totalRequests: number;
    claudeRequests: number;
    localRequests: number;
    averageCost: number;
    averageLatency: number;
    costSavings: number;
    successRate: number;
    userSatisfaction: number;
}
export declare class HybridIntelligenceRouter {
    private claudeProvider;
    private localRouter;
    private knowledgeBase;
    private routingMetrics;
    private learningData;
    constructor(claudeApiKey: string, localConfig: any, knowledgeBase: KnowledgeBase);
    initialize(): Promise<void>;
    routeRequest(request: TaskRequest): Promise<ProviderChoice>;
    processRequest(request: TaskRequest): Promise<any>;
    private analyzeRequest;
    private makeRoutingDecision;
    private assessComplexity;
    private identifyDomain;
    private requiresClaudeSkills;
    private handleFailover;
    private recordRoutingDecision;
    getRoutingMetrics(): Promise<RoutingMetrics>;
    optimizeRouting(): Promise<RoutingOptimization>;
    private initializeMetrics;
    private estimateClaudeCost;
    private analyzeRequiredCapabilities;
    private checkKnowledgeAvailability;
    private getUserPreferences;
    private assessUrgency;
    private selectOptimalLocalModel;
    private selectFastLocalModel;
    private assessLocalCapability;
    private updateMetrics;
    private loadRoutingHistory;
    private analyzeAccuracyByComplexity;
    private analyzeCostTrends;
    private analyzeLatencyPatterns;
    private analyzeUserSatisfaction;
    private suggestRoutingRules;
    private suggestModelOptimizations;
    private identifyCostOptimizations;
    private estimateOptimizationImpact;
}
interface RoutingOptimization {
    currentPerformance: any;
    recommendedOptimizations: any;
    estimatedImpact: any;
}
export {};
