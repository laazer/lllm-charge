import { EventEmitter } from 'events';
export interface AgentConfig {
    id: string;
    name: string;
    type: 'coding' | 'analysis' | 'reasoning' | 'creative' | 'specialized';
    model: string;
    provider: 'local' | 'claude' | 'openai' | 'custom';
    capabilities: AgentCapabilities;
    constraints: AgentConstraints;
    workspace: WorkspaceConfig;
    security: SecurityConfig;
}
export interface AgentCapabilities {
    maxTokens: number;
    contextWindow: number;
    supportedTasks: string[];
    tools: ToolConfig[];
    skills: string[];
    multiModal: boolean;
    reasoning: boolean;
    codeExecution: boolean;
}
export interface AgentConstraints {
    maxExecutionTime: number;
    maxConcurrentTasks: number;
    resourceLimits: ResourceLimits;
    rateLimits: RateLimits;
    securityLevel: 'sandbox' | 'limited' | 'elevated';
    allowedDomains?: string[];
}
export interface ResourceLimits {
    memory: number;
    cpu: number;
    storage: number;
    networkBandwidth: number;
}
export interface RateLimits {
    requestsPerMinute: number;
    tokensPerHour: number;
    costPerHour: number;
}
export interface WorkspaceConfig {
    path: string;
    isolated: boolean;
    readonly: boolean;
    allowedPaths: string[];
    blockedPaths: string[];
    mountPoints?: MountPoint[];
}
export interface MountPoint {
    hostPath: string;
    containerPath: string;
    readonly: boolean;
}
export interface SecurityConfig {
    sandboxed: boolean;
    networkAccess: boolean;
    fileSystemAccess: 'none' | 'readonly' | 'limited' | 'full';
    environmentVariables: Record<string, string>;
    allowedBinaries: string[];
    policies: PolicyRule[];
}
export interface PolicyRule {
    action: 'allow' | 'deny' | 'prompt';
    resource: string;
    conditions?: Record<string, any>;
}
export interface ToolConfig {
    name: string;
    enabled: boolean;
    configuration: Record<string, any>;
    permissions: string[];
}
export interface AgentSession {
    id: string;
    agentId: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    startTime: number;
    endTime?: number;
    context: SessionContext;
    messages: SessionMessage[];
    resources: SessionResources;
    metrics: SessionMetrics;
}
export interface SessionContext {
    task: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    parentSessionId?: string;
    childSessionIds: string[];
    workspace: string;
    environment: Record<string, string>;
}
export interface SessionMessage {
    id: string;
    timestamp: number;
    type: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    metadata?: Record<string, any>;
}
export interface SessionResources {
    cpuTime: number;
    memoryPeak: number;
    diskUsage: number;
    networkRequests: number;
    tokensUsed: number;
    cost: number;
}
export interface SessionMetrics {
    latency: number;
    throughput: number;
    errorRate: number;
    successRate: number;
    qualityScore: number;
    efficiency: number;
}
export interface AgentSpawnRequest {
    agentId: string;
    task: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    timeout?: number;
    workspace?: string;
    environment?: Record<string, string>;
    parentSessionId?: string;
    attachments?: AttachmentConfig[];
}
export interface AttachmentConfig {
    type: 'file' | 'url' | 'text' | 'image';
    path?: string;
    content?: string;
    metadata?: Record<string, any>;
}
export interface AgentResponse {
    sessionId: string;
    status: 'success' | 'error' | 'timeout' | 'cancelled';
    result?: any;
    error?: string;
    metrics: SessionMetrics;
    artifacts?: Artifact[];
}
export interface Artifact {
    id: string;
    type: 'file' | 'code' | 'document' | 'image' | 'data';
    path: string;
    content?: string;
    metadata: Record<string, any>;
}
export declare class OpenClawAgentManager extends EventEmitter {
    private agents;
    private sessions;
    private processes;
    private connections;
    private skillRegistry;
    private policyEngine;
    private sandboxManager;
    constructor();
    initialize(): Promise<void>;
    registerAgent(config: AgentConfig): Promise<void>;
    spawnAgent(request: AgentSpawnRequest): Promise<string>;
    getSessionStatus(sessionId: string): Promise<AgentSession | null>;
    killSession(sessionId: string): Promise<void>;
    pauseSession(sessionId: string): Promise<void>;
    resumeSession(sessionId: string): Promise<void>;
    getActiveAgents(): Promise<AgentConfig[]>;
    getSessionMetrics(sessionId: string): Promise<SessionMetrics | null>;
    optimizeAgentPerformance(): Promise<OptimizationResult>;
    private executeAgent;
    private executeSandboxedAgent;
    private executeDirectAgent;
    private validateAgentConfig;
    private setupAgentWorkspace;
    private loadDefaultAgents;
    private setupCleanupHandlers;
    private generateSessionId;
    private generateMessageId;
    private generateAgentScript;
    private updateSessionMetrics;
    private analyzeAgentUtilization;
    private analyzeResourceEfficiency;
    private identifyPerformanceBottlenecks;
    private analyzeErrorPatterns;
    private suggestConfigurationChanges;
    private suggestResourceReallocation;
    private suggestSkillOptimizations;
    private estimateOptimizationImpact;
    cleanup(): Promise<void>;
}
interface OptimizationResult {
    analysis: any;
    recommendations: any;
    estimatedImpact: any;
}
export {};
