import { LLMProvider, LLMResponse, ProviderCapabilities } from '../types';
export interface ClaudeRequest {
    prompt: string;
    task: 'reasoning' | 'code_generation' | 'analysis' | 'writing' | 'general';
    context?: string;
    maxTokens?: number;
    temperature?: number;
}
export interface ClaudeSkills {
    codeReview: (code: string, language: string) => Promise<CodeReviewResult>;
    architecturalAnalysis: (description: string) => Promise<ArchitecturalAdvice>;
    requirementsAnalysis: (requirements: string) => Promise<RequirementsBreakdown>;
    debuggingAssistance: (error: string, context: string) => Promise<DebuggingAdvice>;
    documentationGeneration: (code: string) => Promise<Documentation>;
    testCaseGeneration: (code: string) => Promise<TestCase[]>;
}
export interface CodeReviewResult {
    issues: CodeIssue[];
    suggestions: CodeSuggestion[];
    overallScore: number;
    securityConcerns: SecurityIssue[];
    performanceRecommendations: PerformanceAdvice[];
}
export interface ArchitecturalAdvice {
    patterns: ArchitecturalPattern[];
    tradeoffs: Tradeoff[];
    recommendations: string[];
    scalabilityConsiderations: string[];
}
export declare class ClaudeProvider implements LLMProvider {
    private apiKey;
    private baseUrl;
    private skills;
    constructor(apiKey: string);
    generateResponse(request: ClaudeRequest): Promise<LLMResponse>;
    getCapabilities(): ProviderCapabilities;
    getSkills(): ClaudeSkills;
    private optimizePrompt;
    private callClaudeAPI;
    private calculateCost;
}
interface CodeIssue {
    line: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion: string;
}
interface CodeSuggestion {
    category: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
}
interface SecurityIssue {
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    remediation: string;
}
interface PerformanceAdvice {
    area: string;
    current: string;
    recommended: string;
    impact: string;
}
interface ArchitecturalPattern {
    name: string;
    description: string;
    applicability: string;
    tradeoffs: string[];
}
interface Tradeoff {
    decision: string;
    pros: string[];
    cons: string[];
    recommendation: string;
}
interface RequirementsBreakdown {
    functionalRequirements: string[];
    nonFunctionalRequirements: string[];
    clarificationsNeeded: string[];
    implementationApproach: string;
}
interface DebuggingAdvice {
    likelyCauses: string[];
    debuggingSteps: string[];
    suggestedFixes: string[];
    preventionTips: string[];
}
interface Documentation {
    overview: string;
    apiDocs: APIDoc[];
    examples: CodeExample[];
    parameters: Parameter[];
    returnValues: ReturnValue[];
}
interface TestCase {
    name: string;
    description: string;
    testCode: string;
    expectedResult: string;
    category: 'unit' | 'integration' | 'performance' | 'edge_case';
}
interface APIDoc {
    method: string;
    description: string;
    parameters: Parameter[];
    returns: ReturnValue;
}
interface CodeExample {
    title: string;
    code: string;
    explanation: string;
}
interface Parameter {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: any;
}
interface ReturnValue {
    type: string;
    description: string;
}
export {};
