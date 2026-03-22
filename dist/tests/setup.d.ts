declare global {
    namespace jest {
        interface Matchers<R> {
            toBeWithinRange(floor: number, ceiling: number): R;
            toHaveValidCostMetrics(): R;
        }
    }
}
export declare const TEST_CONFIG: {
    TEST_PROJECT_DIR: string;
    TEST_CACHE_DIR: string;
    TEST_TIMEOUT: number;
    MOCK_LLM_RESPONSE_DELAY: number;
};
export declare class MockLLMProvider {
    private costPerToken;
    generateResponse(prompt: string, options?: any): Promise<string>;
    generateEmbedding(text: string): Promise<number[]>;
    calculateCost(inputTokens: number, outputTokens: number): number;
    private simpleHash;
}
export declare function createMockConfig(): any;
export declare function setupTestDirectories(): Promise<void>;
export declare function cleanupTestDirectories(): Promise<void>;
export declare function generateTestQuery(type?: 'simple' | 'complex' | 'code'): string;
export declare function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    time: number;
}>;
export declare function validateCostMetrics(metrics: any): boolean;
