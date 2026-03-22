import { ReasoningSession } from '@/core/types';
export declare class RLMEngine {
    private config;
    private sessions;
    private pythonPath;
    private rlmScript;
    constructor(config: ReasoningConfig);
    initialize(): Promise<void>;
    startReasoningSession(query: string, context?: string): Promise<string>;
    executeRLMQuery(sessionId: string, query: string, context?: string): Promise<string>;
    getSession(sessionId: string): Promise<ReasoningSession | null>;
    listSessions(): Promise<ReasoningSession[]>;
    stopSession(sessionId: string): Promise<void>;
    private setupRLMBridge;
    private testPythonEnvironment;
    private getEnvironmentKwargs;
    private parseRLMOutput;
    private extractCodeBlocks;
    private generateSessionId;
}
