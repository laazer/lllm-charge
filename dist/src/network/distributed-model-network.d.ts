import { EventEmitter } from 'events';
import { CostTracker } from '../utils/cost-tracker';
import { HybridIntelligenceRouter } from '../reasoning/hybrid-router';
export interface NetworkNode {
    id: string;
    hostname: string;
    port: number;
    status: 'online' | 'offline' | 'busy' | 'maintenance';
    capabilities: NodeCapabilities;
    resources: NodeResources;
    metadata: NodeMetadata;
    lastSeen: number;
}
export interface NodeCapabilities {
    models: AvailableModel[];
    maxConcurrentRequests: number;
    supportedTasks: TaskType[];
    specializations: string[];
    hardwareSpecs: HardwareSpecs;
}
export interface NodeResources {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage?: number;
    networkBandwidth: number;
    diskSpace: number;
    activeRequests: number;
    queuedRequests: number;
}
export interface NodeMetadata {
    version: string;
    region: string;
    organization: string;
    tags: string[];
    costPerToken: number;
    reliability: number;
    averageLatency: number;
}
export interface AvailableModel {
    name: string;
    provider: string;
    type: 'language' | 'vision' | 'embedding' | 'fine-tuned';
    contextLength: number;
    parametersCount?: number;
    quantization?: string;
    tokensPerSecond: number;
    memoryRequirement: number;
}
export interface HardwareSpecs {
    cpu: {
        cores: number;
        model: string;
        architecture: string;
    };
    memory: {
        total: number;
        available: number;
        type: string;
    };
    gpu?: {
        count: number;
        model: string;
        vram: number;
        computeCapability: string;
    };
    storage: {
        total: number;
        available: number;
        type: 'SSD' | 'HDD' | 'NVMe';
    };
}
export interface TaskRequest {
    id: string;
    prompt: string;
    model: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requirements: TaskRequirements;
    context?: string;
    maxTokens?: number;
    temperature?: number;
    deadline?: number;
}
export interface TaskRequirements {
    minRAM: number;
    minVRAM?: number;
    requiresGPU?: boolean;
    requiresSpecialization?: string[];
    maxLatency?: number;
    maxCost?: number;
    securityLevel: 'public' | 'private' | 'confidential';
}
export interface TaskAssignment {
    taskId: string;
    nodeId: string;
    assignedAt: number;
    estimatedCompletion: number;
    cost: number;
    priority: number;
}
export interface NetworkMetrics {
    totalNodes: number;
    activeNodes: number;
    totalCapacity: number;
    currentLoad: number;
    averageLatency: number;
    totalThroughput: number;
    costSavings: number;
    reliability: number;
    resourceUtilization: ResourceUtilization;
}
export interface ResourceUtilization {
    cpu: number;
    memory: number;
    gpu?: number;
    network: number;
    storage: number;
}
export type TaskType = 'reasoning' | 'code_generation' | 'analysis' | 'writing' | 'general' | 'vision' | 'embedding';
export declare class DistributedModelNetwork extends EventEmitter {
    private nodes;
    private assignments;
    private pendingTasks;
    private costTracker;
    private hybridRouter;
    private discoveryInterval;
    private heartbeatInterval;
    private loadBalancer;
    private securityManager;
    private metrics;
    constructor(costTracker: CostTracker, hybridRouter: HybridIntelligenceRouter);
    initialize(): Promise<void>;
    registerNode(node: Omit<NetworkNode, 'lastSeen'>): Promise<void>;
    unregisterNode(nodeId: string): Promise<void>;
    submitTask(task: TaskRequest): Promise<string>;
    getNetworkStatus(): Promise<NetworkStatus>;
    getNodeRecommendations(task: TaskRequest): Promise<NodeRecommendation[]>;
    optimizeNetwork(): Promise<NetworkOptimization>;
    private startNodeDiscovery;
    private startHeartbeat;
    private executeTask;
    private canHandleTask;
    private calculateNodeScore;
    private initializeMetrics;
    private updateNetworkMetrics;
    private discoverNewNodes;
    private validateExistingNodes;
    private sendHeartbeat;
    private checkNodeHealth;
    private reassignNodeTasks;
    private createSecureConnection;
    private sendTaskToNode;
    private updateTaskMetrics;
    private handleTaskFailure;
    private setupEventHandlers;
    private estimateLatency;
    private estimateCost;
    private explainRecommendation;
    private calculateConfidence;
    private getTopPerformingNodes;
    private getResourceSummary;
    private analyzeNodeUtilization;
    private analyzeTaskDistribution;
    private identifyBottlenecks;
    private identifyCostOptimizations;
    private identifyReliabilityIssues;
    private suggestLoadRebalancing;
    private suggestScaling;
    private suggestOptimizations;
    private estimateOptimizationImpact;
    private calculateTotalThroughput;
    private calculateCostSavings;
    private calculateResourceUtilization;
    cleanup(): Promise<void>;
}
interface NetworkStatus {
    totalNodes: number;
    activeNodes: number;
    queuedTasks: number;
    activeTasks: number;
    metrics: NetworkMetrics;
    topPerformers: NetworkNode[];
    resourceSummary: any;
}
interface NodeRecommendation {
    nodeId: string;
    score: number;
    estimatedLatency: number;
    estimatedCost: number;
    reasoning: string;
    confidence: number;
}
interface NetworkOptimization {
    currentState: any;
    recommendations: any;
    estimatedImpact: any;
}
export {};
