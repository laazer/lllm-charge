import { EventEmitter } from 'events';
export interface SkillDefinition {
    name: string;
    version: string;
    description: string;
    author: string;
    category: SkillCategory;
    metadata: SkillMetadata;
    requirements: SkillRequirements;
    parameters: SkillParameter[];
    commands: SkillCommand[];
    hooks: SkillHooks;
    security: SkillSecurity;
}
export interface SkillMetadata {
    emoji: string;
    tags: string[];
    documentation: string;
    examples: SkillExample[];
    requires: {
        anyBins?: string[];
        allBins?: string[];
        services?: string[];
        permissions?: string[];
    };
}
export interface SkillRequirements {
    runtime: 'node' | 'python' | 'bash' | 'docker';
    minVersion?: string;
    dependencies: string[];
    systemRequirements: SystemRequirements;
}
export interface SystemRequirements {
    os?: string[];
    architecture?: string[];
    minMemory?: number;
    minDisk?: number;
    networkAccess?: boolean;
    gpuRequired?: boolean;
}
export interface SkillParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file' | 'url';
    description: string;
    required: boolean;
    default?: any;
    validation?: ParameterValidation;
}
export interface ParameterValidation {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
    custom?: string;
}
export interface SkillCommand {
    name: string;
    description: string;
    usage: string;
    parameters: string[];
    examples: string[];
    permissions: string[];
    pty?: boolean;
    background?: boolean;
    timeout?: number;
}
export interface SkillHooks {
    beforeExecute?: string;
    afterExecute?: string;
    onError?: string;
    onSuccess?: string;
    cleanup?: string;
}
export interface SkillSecurity {
    sandboxed: boolean;
    allowedPaths: string[];
    blockedPaths: string[];
    allowedNetworks: string[];
    environmentVariables: Record<string, string>;
    capabilities: string[];
    policies: SecurityPolicy[];
}
export interface SecurityPolicy {
    action: 'allow' | 'deny' | 'prompt';
    resource: string;
    conditions: Record<string, any>;
}
export interface SkillExample {
    title: string;
    description: string;
    code: string;
    expectedOutput?: string;
}
export interface SkillExecution {
    id: string;
    skillName: string;
    command: string;
    parameters: Record<string, any>;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: number;
    endTime?: number;
    output: string;
    error?: string;
    exitCode?: number;
    resources: ExecutionResources;
}
export interface ExecutionResources {
    cpuTime: number;
    memoryUsage: number;
    diskUsage: number;
    networkRequests: number;
}
export interface SkillRegistry {
    installed: Map<string, SkillDefinition>;
    available: Map<string, SkillPackage>;
    categories: Map<SkillCategory, string[]>;
    dependencies: Map<string, string[]>;
}
export interface SkillPackage {
    name: string;
    version: string;
    description: string;
    author: string;
    downloadUrl: string;
    checksum: string;
    size: number;
    lastUpdated: number;
    popularity: number;
    rating: number;
}
export type SkillCategory = 'coding' | 'productivity' | 'communication' | 'media' | 'development' | 'system' | 'ai' | 'automation' | 'security' | 'monitoring';
export declare class OpenClawSkillEngine extends EventEmitter {
    private registry;
    private executions;
    private processes;
    private skillsPath;
    private sandboxManager;
    private policyEngine;
    constructor(skillsPath?: string);
    initialize(): Promise<void>;
    installSkill(skillName: string, version?: string): Promise<void>;
    uninstallSkill(skillName: string): Promise<void>;
    executeSkill(skillName: string, command: string, parameters?: Record<string, any>, options?: ExecutionOptions): Promise<string>;
    getAvailableSkills(): Promise<SkillPackage[]>;
    getInstalledSkills(): Promise<SkillDefinition[]>;
    getSkillsByCategory(category: SkillCategory): Promise<SkillDefinition[]>;
    searchSkills(query: string): Promise<SkillDefinition[]>;
    getSkillUsage(skillName: string): Promise<SkillUsageStats>;
    optimizeSkills(): Promise<SkillOptimizationResult>;
    private ensureSkillsDirectory;
    private loadInstalledSkills;
    private loadSkillDefinition;
    private parseMarkdownSkillDefinition;
    private parseFrontMatter;
    private parseCommands;
    private inferCategory;
    private runSkillCommand;
    private executeCommandDirect;
    private buildCommandArgs;
    private generateExecutionId;
    private refreshAvailableSkills;
    private validateSkillDependencies;
    private downloadSkillPackage;
    private installSkillDependencies;
    private validateSkill;
    private findSkillDependents;
    private cleanupSkillFiles;
    private validateParameters;
    private calculateAverageExecutionTime;
    private getPopularCommands;
    private findUnusedSkills;
    private findFrequentlyUsedSkills;
    private findResourceIntensiveSkills;
    private findOutdatedSkills;
    private findDependencyConflicts;
    cleanup(): Promise<void>;
}
interface ExecutionOptions {
    timeout?: number;
    background?: boolean;
    userId?: string;
    workspace?: string;
    environment?: Record<string, string>;
}
interface SkillUsageStats {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastUsed: number;
    popularCommands: string[];
}
interface SkillOptimizationResult {
    analysis: {
        unusedSkills: SkillDefinition[];
        frequentlyUsed: SkillDefinition[];
        resourceHogs: SkillDefinition[];
        outdatedSkills: SkillDefinition[];
        dependencyConflicts: any;
    };
    recommendations: Array<{
        action: string;
        skill: string;
        reason?: string;
        currentVersion?: string;
        latestVersion?: string;
        issue?: string;
        suggestion?: string;
    }>;
}
export {};
