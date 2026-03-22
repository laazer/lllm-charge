import { CostMetrics, APIConfig } from '@/core/types';
export interface CostEvent {
    timestamp: Date;
    isLocal: boolean;
    cost: number;
    tokens: number;
    model: string;
    latencyMs: number;
    query?: string;
    success: boolean;
}
export interface OptimizationReport {
    totalSavings: number;
    localSuccessRate: number;
    recommendedModels: string[];
    costTrends: {
        hourly: number[];
        daily: number[];
    };
    suggestions: string[];
}
export declare class CostTracker {
    private apiConfig;
    private events;
    private persistPath;
    constructor(apiConfig: APIConfig);
    recordRequest(event: Omit<CostEvent, 'timestamp' | 'success'>): void;
    recordFailure(isLocal: boolean, model: string, query?: string): void;
    getMetrics(timeframe?: 'hour' | 'day' | 'week'): CostMetrics;
    analyzeUsage(depth?: 'basic' | 'detailed'): OptimizationReport;
    getHourlyCost(): number;
    private calculateSavedCosts;
    private estimateAPICost;
    private analyzeModelUsage;
    private getCostTrends;
    private generateSuggestions;
    private checkCostThresholds;
    private getCutoffDate;
    private persistData;
    private loadHistoricalData;
}
