import { EventEmitter } from 'events';
import { CostTracker } from '../utils/cost-tracker';
import { HybridIntelligenceRouter } from '../reasoning/hybrid-router';
import { LocalLLMRouter } from '../reasoning/local-llm-router';
export interface DashboardMetrics {
    realTime: RealTimeMetrics;
    costs: CostMetrics;
    performance: PerformanceMetrics;
    models: ModelMetrics;
    optimization: OptimizationMetrics;
    alerts: Alert[];
}
export interface RealTimeMetrics {
    currentRequests: number;
    requestsPerSecond: number;
    activeConnections: number;
    queueLength: number;
    systemLoad: SystemLoad;
    lastUpdated: number;
}
export interface CostMetrics {
    totalSavings: number;
    monthlySavings: number;
    costPerRequest: number;
    savingsPercentage: number;
    costTrends: TimeSeries[];
    providerCostBreakdown: ProviderCostBreakdown[];
}
export interface PerformanceMetrics {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    successRate: number;
    errorRate: number;
    responseTimeTrends: TimeSeries[];
}
export interface ModelMetrics {
    activeModels: ActiveModel[];
    modelUtilization: ModelUtilization[];
    modelPerformance: ModelPerformance[];
    loadBalancing: LoadBalancingMetrics;
}
export interface OptimizationMetrics {
    routingEfficiency: number;
    cacheHitRate: number;
    localModelUtilization: number;
    claudeUsageOptimization: number;
    recommendations: OptimizationRecommendation[];
}
export interface Alert {
    id: string;
    type: 'cost' | 'performance' | 'error' | 'optimization' | 'system';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: number;
    acknowledged: boolean;
    data?: any;
}
export interface SystemLoad {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    gpu?: number;
}
export interface TimeSeries {
    timestamp: number;
    value: number;
    label?: string;
}
export interface ActiveModel {
    name: string;
    provider: string;
    status: 'active' | 'loading' | 'idle' | 'error';
    requests: number;
    averageLatency: number;
    memoryUsage: number;
}
export interface ModelUtilization {
    modelName: string;
    utilizationPercentage: number;
    requestCount: number;
    averageResponseTime: number;
    costEfficiency: number;
}
export interface ModelPerformance {
    modelName: string;
    qualityScore: number;
    speedScore: number;
    costScore: number;
    overallScore: number;
    recentTrends: TimeSeries[];
}
export interface LoadBalancingMetrics {
    distribution: ProviderDistribution[];
    failoverEvents: number;
    queueMetrics: QueueMetrics;
}
export interface ProviderDistribution {
    provider: string;
    percentage: number;
    requestCount: number;
    averageLatency: number;
}
export interface QueueMetrics {
    currentLength: number;
    averageWaitTime: number;
    peakLength: number;
    processingRate: number;
}
export interface OptimizationRecommendation {
    type: 'cost' | 'performance' | 'routing' | 'scaling';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedImpact: string;
    implementationEffort: 'low' | 'medium' | 'high';
    action?: () => Promise<void>;
}
export interface ProviderCostBreakdown {
    provider: string;
    totalCost: number;
    requestCount: number;
    averageCostPerRequest: number;
    trend: 'increasing' | 'decreasing' | 'stable';
}
export declare class RealTimeDashboard extends EventEmitter {
    private costTracker;
    private hybridRouter;
    private localRouter;
    private updateInterval;
    private metrics;
    private alerts;
    private subscribers;
    constructor(costTracker: CostTracker, hybridRouter: HybridIntelligenceRouter, localRouter: LocalLLMRouter);
    initialize(): Promise<void>;
    getMetrics(): Promise<DashboardMetrics>;
    getLiveMetrics(): Promise<RealTimeMetrics>;
    getCostAnalysis(timeframe?: '1h' | '24h' | '7d' | '30d'): Promise<CostMetrics>;
    getPerformanceAnalysis(): Promise<PerformanceMetrics>;
    getModelAnalysis(): Promise<ModelMetrics>;
    getOptimizationInsights(): Promise<OptimizationMetrics>;
    subscribeToUpdates(websocket: WebSocket): void;
    createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<Alert>;
    acknowledgeAlert(alertId: string): Promise<void>;
    getActiveAlerts(): Promise<Alert[]>;
    getDeveloperDashboard(): Promise<DeveloperDashboardView>;
    getExecutiveDashboard(): Promise<ExecutiveDashboardView>;
    private updateAllMetrics;
    private startRealTimeUpdates;
    private setupAlertMonitoring;
    private broadcastUpdate;
    private initializeMetrics;
    private getCurrentRequestCount;
    private getRequestsPerSecond;
    private getQueueLength;
    private getSystemLoad;
    private calculateSavingsPercentage;
    private formatTimeSeries;
    private formatProviderBreakdown;
    private getResponseTimeTrends;
    private getActiveModels;
    private getModelUtilization;
    private getModelPerformance;
    private getLoadBalancingMetrics;
    private calculateRoutingEfficiency;
    private getCacheHitRate;
    private getLocalModelUtilization;
    private getClaudeOptimizationScore;
    private generateOptimizationRecommendations;
    private analyzeTrend;
    private getRecentActivity;
    private getQuickActions;
    private calculateProductivityIncrease;
    private getTotalRequests;
    private getUsageTrends;
    private setupMetricsCollection;
    cleanup(): Promise<void>;
}
interface DeveloperDashboardView {
    costSavings: {
        totalSaved: number;
        percentage: number;
        trend: 'up' | 'down' | 'stable';
    };
    responseTime: {
        average: number;
        p95: number;
        trend: 'up' | 'down' | 'stable';
    };
    successRate: number;
    topModels: ModelPerformance[];
    recentActivity: any[];
    quickActions: any[];
}
interface ExecutiveDashboardView {
    monthlyROI: {
        costSavings: number;
        performanceGain: number;
        productivityIncrease: number;
    };
    keyMetrics: {
        totalRequests: number;
        successRate: number;
        costPerRequest: number;
        averageResponseTime: number;
    };
    optimizationOpportunities: OptimizationRecommendation[];
    trends: {
        costs: TimeSeries[];
        performance: TimeSeries[];
        usage: TimeSeries[];
    };
}
export {};
