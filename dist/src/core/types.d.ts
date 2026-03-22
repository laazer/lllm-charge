export interface LLMChargeConfig {
    intelligence: IntelligenceConfig;
    reasoning: ReasoningConfig;
    local: LocalLLMConfig;
    api: APIConfig;
    cache: CacheConfig;
}
export interface IntelligenceConfig {
    enableCodeGraph: boolean;
    enableContextPlus: boolean;
    enableSemanticSearch: boolean;
    enableMemoryGraph: boolean;
    cacheDir: string;
    maxFileSize: number;
    embedModel: string;
}
export interface ReasoningConfig {
    enableRLM: boolean;
    maxDepth: number;
    environment: 'local' | 'docker' | 'modal' | 'e2b' | 'prime';
    timeoutMs: number;
    maxIterations: number;
}
export interface LocalLLMConfig {
    provider: 'ollama' | 'vllm' | 'llamacpp' | 'lmstudio';
    baseUrl: string;
    models: {
        primary: string;
        reasoning: string;
        embedding: string;
        chat: string;
    };
    maxTokens: number;
    temperature: number;
}
export interface APIConfig {
    providers: {
        openai?: {
            apiKey: string;
            baseUrl?: string;
        };
        anthropic?: {
            apiKey: string;
        };
        google?: {
            apiKey: string;
        };
    };
    fallbackStrategy: 'local-first' | 'hybrid' | 'cost-optimized';
    maxCostPerHour: number;
    trackUsage: boolean;
}
export interface CacheConfig {
    enableEmbeddingCache: boolean;
    enableContextCache: boolean;
    enableResultCache: boolean;
    ttlSeconds: number;
    maxSizeMB: number;
}
export interface CodeSymbol {
    id: string;
    name: string;
    kind: NodeKind;
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    signature?: string;
    docstring?: string;
    embedding?: Float32Array;
}
export interface CodeRelation {
    from: string;
    to: string;
    kind: EdgeKind;
    confidence: number;
    metadata?: Record<string, any>;
}
export declare enum NodeKind {
    File = "file",
    Module = "module",
    Class = "class",
    Function = "function",
    Method = "method",
    Variable = "variable",
    Interface = "interface",
    Type = "type",
    Import = "import",
    Export = "export",
    Signal = "signal",
    Node = "node",
    Scene = "scene",
    Script = "script"
}
export declare enum EdgeKind {
    Contains = "contains",
    Calls = "calls",
    Imports = "imports",
    Extends = "extends",
    Implements = "implements",
    References = "references",
    Returns = "returns",
    DependsOn = "depends_on"
}
export interface MemoryNode {
    id: string;
    type: 'concept' | 'file' | 'symbol' | 'note';
    content: string;
    embedding?: Float32Array;
    metadata: Record<string, any>;
    created: Date;
    accessed: Date;
    accessCount: number;
}
export interface MemoryEdge {
    from: string;
    to: string;
    type: 'relates_to' | 'depends_on' | 'implements' | 'references' | 'similar_to';
    strength: number;
    decay: number;
    created: Date;
}
export interface LLMRequest {
    prompt: string;
    context?: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
    preferLocal?: boolean;
}
export interface LLMResponse {
    content: string;
    model: string;
    isLocal: boolean;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    cost?: number;
    latencyMs: number;
    metadata?: Record<string, any>;
}
export interface ReasoningSession {
    id: string;
    query: string;
    iterations: ReasoningIteration[];
    environment: string;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'completed' | 'failed' | 'timeout';
    result?: string;
}
export interface ReasoningIteration {
    step: number;
    prompt: string;
    response: string;
    codeBlocks: CodeBlock[];
    executions: ExecutionResult[];
    duration: number;
}
export interface CodeBlock {
    language: string;
    code: string;
    isExecutable: boolean;
}
export interface ExecutionResult {
    code: string;
    output: string;
    error?: string;
    duration: number;
}
export interface CostMetrics {
    totalRequests: number;
    localRequests: number;
    apiRequests: number;
    totalTokens: number;
    localTokens: number;
    apiTokens: number;
    estimatedCost: number;
    costSaved: number;
    avgLatency: number;
}
export interface ContextPackage {
    query: string;
    relevantFiles: string[];
    codeSymbols: CodeSymbol[];
    relationships: CodeRelation[];
    memoryNodes: MemoryNode[];
    semanticMatches: SemanticMatch[];
    estimatedTokens: number;
}
export interface SemanticMatch {
    content: string;
    similarity: number;
    source: 'codegraph' | 'contextplus' | 'memory';
    metadata: Record<string, any>;
}
