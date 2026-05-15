/**
 * Test Data Factories
 *
 * Reusable factory functions for creating mock objects in tests.
 * Each factory returns a valid default object that can be overridden with partial data.
 */
export interface MockProject {
    id: string;
    name: string;
    key: string;
    description: string;
    type: string;
    lead: string;
    codeGraphPath: string | null;
    createdAt: string;
    updatedAt: string;
    data: Record<string, unknown>;
}
export interface MockSpec {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    projectId: string | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}
export interface MockAgent {
    id: string;
    name: string;
    description: string;
    primaryRole: string;
    capabilities: {
        reasoning: number;
        creativity: number;
        technical: number;
        communication: number;
    };
    createdAt: string;
    updatedAt: string;
}
export interface MockReasoningLog {
    timestamp: string;
    prompt: string;
    response: string;
    complexity: string;
    localAttempted: boolean;
    localSuccess: boolean;
    fallbackReason: string | null;
    provider: string;
    responseTime: number;
    cost: number;
    tokensUsed: number;
    skillsUsed: Array<{
        skillId: string;
        skillName: string;
        executionTimeMs: number;
        resultType: string;
        cost: number;
    }>;
}
export interface MockMemoryNote {
    id: string;
    title: string;
    content: string;
    tags: string[];
    projectId: string;
    createdAt: string;
    updatedAt: string;
}
export interface MockCodeGraphStatus {
    totalNodes: number;
    totalEdges: number;
    filesIndexed: number;
    nodesByKind: Record<string, number>;
    edgesByKind: Record<string, number>;
    isAvailable: boolean;
    dbPath: string | null;
}
export declare function createMockProject(overrides?: Partial<MockProject>): MockProject;
export declare function createMockSpec(overrides?: Partial<MockSpec>): MockSpec;
export declare function createMockSkillSpec(overrides?: Partial<MockSpec>): MockSpec;
export declare function createMockAgent(overrides?: Partial<MockAgent>): MockAgent;
export declare function createMockReasoningLog(overrides?: Partial<MockReasoningLog>): MockReasoningLog;
export declare function createMockMemoryNote(overrides?: Partial<MockMemoryNote>): MockMemoryNote;
export declare function createMockCodeGraphStatus(overrides?: Partial<MockCodeGraphStatus>): MockCodeGraphStatus;
export declare function createMockFetchResponse(data: unknown, options?: {
    ok?: boolean;
    status?: number;
}): Response;
/**
 * Create multiple mock objects at once.
 */
export declare function createMockProjects(count: number, overrides?: Partial<MockProject>): MockProject[];
export declare function createMockSpecs(count: number, overrides?: Partial<MockSpec>): MockSpec[];
export declare function createMockReasoningLogs(count: number, overrides?: Partial<MockReasoningLog>): MockReasoningLog[];
