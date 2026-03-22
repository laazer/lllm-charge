import { LocalLLMRouter } from '@/reasoning/local-llm-router';
import { CostTracker } from '@/utils/cost-tracker';
export interface OptimizationStrategy {
    name: string;
    description: string;
    priority: number;
    applicableModels: string[];
    expectedImprovement: number;
}
export interface ModelPerformance {
    model: string;
    provider: string;
    avgLatency: number;
    successRate: number;
    tokenThroughput: number;
    memoryUsage: number;
    qualityScore: number;
    costEfficiency: number;
    lastBenchmark: Date;
}
export interface OptimizationReport {
    currentPerformance: ModelPerformance[];
    recommendedStrategies: OptimizationStrategy[];
    projectedSavings: {
        tokens: number;
        cost: number;
        latency: number;
    };
    implementationPlan: string[];
}
export declare class LLMOptimizationEngine {
    private router;
    private costTracker;
    private performanceHistory;
    private optimizationStrategies;
    private benchmarkCache;
    constructor(router: LocalLLMRouter, costTracker: CostTracker);
    analyzeCurrentSetup(): Promise<OptimizationReport>;
    benchmarkLocalModels(): Promise<ModelPerformance[]>;
    optimizeForWorkload(workloadType: 'code' | 'reasoning' | 'general'): Promise<{
        recommendedModel: string;
        optimalSettings: Record<string, any>;
        expectedPerformance: ModelPerformance;
    }>;
    calibrateModelThresholds(): Promise<{
        complexityThresholds: Record<string, number>;
        contextSizeThresholds: Record<string, number>;
        qualityThresholds: Record<string, number>;
    }>;
    enableAdaptiveRouting(): Promise<void>;
    private benchmarkModel;
    private generateBenchmarkPrompts;
    private generateWorkloadSpecificPrompts;
    private identifyOptimizationOpportunities;
    private calculateProjectedSavings;
    private generateImplementationPlan;
    private initializeStrategies;
    private getAvailableModels;
    private optimizeModelSettings;
    private benchmarkModelWithSettings;
    private calculateWorkloadScore;
    private assessResponseQuality;
    private calculateCostEfficiency;
    private hashPrompts;
    private updatePerformanceHistory;
    private assessModelCapabilities;
    private getRecentPerformanceMetrics;
    private adjustRoutingWeights;
}
