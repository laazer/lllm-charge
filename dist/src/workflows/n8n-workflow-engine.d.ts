import { EventEmitter } from 'events';
import { IWorkflowBase, IConnections } from './types';
export interface WorkflowNode {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
    credentials?: Record<string, string>;
    disabled?: boolean;
    notes?: string;
    color?: string;
    webhookId?: string;
    onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
    continueOnFail?: boolean;
    alwaysOutputData?: boolean;
    executeOnce?: boolean;
    retryOnFail?: boolean;
    maxTries?: number;
    waitBetweenTries?: number;
}
export interface WorkflowConnection {
    node: string;
    type: string;
    index: number;
}
export interface WorkflowDefinition extends IWorkflowBase {
    id?: string;
    name: string;
    active: boolean;
    nodes: WorkflowNode[];
    connections: IConnections;
    settings?: WorkflowSettings;
    staticData?: any;
    tags?: string[];
    triggerCount?: number;
    versionId?: string;
    meta?: WorkflowMeta;
}
export interface WorkflowSettings {
    executionOrder?: 'v0' | 'v1';
    saveManualExecutions?: boolean;
    saveExecutionProgress?: boolean;
    saveDataErrorExecution?: 'all' | 'none';
    saveDataSuccessExecution?: 'all' | 'none';
    callerPolicy?: 'workflowsFromSameOwner' | 'workflowsFromAList' | 'any';
    callerIds?: string;
    errorWorkflow?: string;
    timezone?: string;
    executionTimeout?: number;
}
export interface WorkflowMeta {
    instanceId?: string;
    templateId?: string;
    templateCredsSetupCompleted?: boolean;
    onboardingId?: string;
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: ExecutionStatus;
    mode: ExecutionMode;
    startedAt: Date;
    stoppedAt?: Date;
    finished: boolean;
    data?: any;
    customData?: Record<string, any>;
    workflowData?: WorkflowDefinition;
}
export interface ExecutionData {
    resultData: {
        runData: any;
        pinData?: any;
        lastNodeExecuted?: string;
        error?: ExecutionError;
    };
    executionData?: {
        contextData: any;
        nodeExecutionStack: any[];
        metadata: any;
        waitingExecution: any;
        waitingExecutionSource: any;
    };
}
export interface ExecutionError {
    name: string;
    message: string;
    stack?: string;
    node?: {
        name: string;
        type: string;
        index?: number;
    };
    cause?: ExecutionError;
    context?: any;
    lineNumber?: number;
    timestamp?: Date;
}
export interface NodeType {
    displayName: string;
    name: string;
    icon: string;
    iconUrl?: string;
    group: string[];
    version: number | number[];
    description: string;
    subtitle?: string;
    defaults: {
        name: string;
        color: string;
    };
    inputs: NodeTypeInput[];
    outputs: NodeTypeOutput[];
    properties: NodeProperty[];
    credentials?: NodeCredential[];
    supportsCORS?: boolean;
    polling?: boolean;
    triggerPanel?: {
        header?: string;
        executionsHelp?: {
            active?: string;
            inactive?: string;
        };
        activationHint?: string;
    };
    codex?: {
        resources?: {
            primaryDocumentation?: Array<{
                url: string;
            }>;
        };
        alias?: string[];
    };
}
export interface NodeTypeInput {
    displayName: string;
    type: 'main';
    required?: boolean;
}
export interface NodeTypeOutput {
    displayName: string;
    type: 'main';
}
export interface NodeProperty {
    displayName: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'collection' | 'fixedCollection' | 'multiOptions' | 'options' | 'dateTime' | 'color' | 'json' | 'notice' | 'hidden' | 'resourceLocator' | 'curlImport' | 'credentialsSelect';
    required?: boolean;
    default?: any;
    description?: string;
    placeholder?: string;
    hint?: string;
    displayOptions?: {
        show?: Record<string, any[]>;
        hide?: Record<string, any[]>;
    };
    options?: Array<{
        name: string;
        value: string | number | boolean;
        description?: string;
    }>;
    routing?: {
        request?: {
            method?: string;
            url?: string;
            headers?: Record<string, string>;
            body?: any;
        };
        output?: {
            postReceive?: any[];
        };
    };
}
export interface NodeCredential {
    name: string;
    required?: boolean;
    displayOptions?: {
        show?: Record<string, any[]>;
        hide?: Record<string, any[]>;
    };
}
export type ExecutionStatus = 'new' | 'running' | 'success' | 'error' | 'canceled' | 'waiting' | 'unknown';
export type ExecutionMode = 'cli' | 'error' | 'integrated' | 'internal' | 'manual' | 'retry' | 'trigger' | 'webhook';
export declare class N8nWorkflowEngine extends EventEmitter {
    private workflows;
    private executions;
    private nodeTypes;
    private activeWorkflows;
    private executionQueue;
    private isProcessing;
    private executionCount;
    constructor();
    initialize(): Promise<void>;
    createWorkflow(definition: Omit<WorkflowDefinition, 'id'>): Promise<string>;
    getWorkflow(workflowId: string): Promise<WorkflowDefinition | null>;
    updateWorkflow(workflowId: string, updates: Partial<WorkflowDefinition>): Promise<void>;
    deleteWorkflow(workflowId: string): Promise<void>;
    activateWorkflow(workflowId: string): Promise<void>;
    deactivateWorkflow(workflowId: string): Promise<void>;
    executeWorkflow(workflowId: string, inputData?: any, mode?: ExecutionMode): Promise<string>;
    getExecution(executionId: string): Promise<WorkflowExecution | null>;
    getExecutions(workflowId?: string, limit?: number): Promise<WorkflowExecution[]>;
    cancelExecution(executionId: string): Promise<void>;
    registerNodeType(nodeType: NodeType): void;
    getNodeType(typeName: string): NodeType | null;
    getNodeTypes(): NodeType[];
    createLLMWorkflow(config: LLMWorkflowConfig): Promise<string>;
    executeLLMTask(task: LLMTask): Promise<LLMTaskResult>;
    private processExecutionQueue;
    private executeWorkflowInternal;
    private runWorkflowNodes;
    private executeNode;
    private buildExecutionStack;
    private traverseNodes;
    private buildLLMNodes;
    private buildLLMConnections;
    private initializeBuiltInNodeTypes;
    private executeLLMChainNode;
    private executeHttpRequestNode;
    private executeSetNode;
    private executeIfNode;
    private executeGenericNode;
    private generateWorkflowId;
    private generateExecutionId;
    private validateWorkflow;
    private setupWorkflowTriggers;
    private removeWorkflowTriggers;
    private loadWorkflows;
    private startActiveWorkflows;
    private startExecutionProcessor;
    private waitForExecution;
    private calculateExecutionCost;
    private calculateExecutionDuration;
    private extractTokensUsed;
    cleanup(): Promise<void>;
}
interface LLMWorkflowConfig {
    name: string;
    type: 'reasoning' | 'code_generation' | 'analysis' | 'writing';
    model: string;
    prompt: string;
    context?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    autoActivate?: boolean;
    tags?: string[];
}
interface LLMTask {
    name: string;
    type: 'reasoning' | 'code_generation' | 'analysis' | 'writing';
    model: string;
    prompt: string;
    context?: string;
    inputData?: any;
    timeout?: number;
}
interface LLMTaskResult {
    executionId: string;
    status: ExecutionStatus;
    output: any;
    cost: number;
    duration: number;
    tokensUsed: number;
    model: string;
}
export {};
