import { jest } from '@jest/globals';
import { OpenClawAgentManager } from '../../../src/agents/openclaw-agent-manager.js';
// Mock filesystem operations
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn(),
    stat: jest.fn()
}));
// Mock child process operations
jest.mock('child_process', () => ({
    spawn: jest.fn(),
    exec: jest.fn()
}));
describe('OpenClawAgentManager', () => {
    let agentManager;
    beforeEach(() => {
        agentManager = new OpenClawAgentManager();
    });
    afterEach(() => {
        agentManager.removeAllListeners();
    });
    describe('Agent Spawning', () => {
        test('should spawn a new agent with basic configuration', async () => {
            const request = {
                name: 'test-agent',
                type: 'code-reviewer',
                capabilities: ['file-analysis', 'code-review'],
                resources: {
                    maxMemory: '512MB',
                    maxCpuTime: 30000,
                    allowedPaths: ['/tmp/test']
                }
            };
            const sessionId = await agentManager.spawnAgent(request);
            expect(sessionId).toBeTruthy();
            expect(sessionId).toMatch(/^agent_session_/);
            const activeAgents = await agentManager.getActiveAgents();
            expect(activeAgents).toHaveLength(1);
            expect(activeAgents[0].name).toBe('test-agent');
            expect(activeAgents[0].type).toBe('code-reviewer');
        });
        test('should apply default resource limits when not specified', async () => {
            const request = {
                name: 'minimal-agent',
                type: 'general-purpose',
                capabilities: ['basic']
            };
            const sessionId = await agentManager.spawnAgent(request);
            const activeAgents = await agentManager.getActiveAgents();
            const agent = activeAgents[0];
            expect(agent.resources.maxMemory).toBe('256MB');
            expect(agent.resources.maxCpuTime).toBe(30000);
            expect(agent.resources.allowedPaths).toEqual([]);
        });
        test('should emit agent-spawned event', async () => {
            const eventPromise = new Promise((resolve) => {
                agentManager.on('agent-spawned', resolve);
            });
            const request = {
                name: 'event-test-agent',
                type: 'test',
                capabilities: ['testing']
            };
            await agentManager.spawnAgent(request);
            const event = await eventPromise;
            expect(event).toEqual(expect.objectContaining({
                sessionId: expect.any(String),
                agentConfig: expect.objectContaining({
                    name: 'event-test-agent',
                    type: 'test'
                })
            }));
        });
        test('should reject spawning agents with invalid names', async () => {
            const request = {
                name: '', // Invalid empty name
                type: 'test',
                capabilities: ['testing']
            };
            await expect(agentManager.spawnAgent(request)).rejects.toThrow('Agent name cannot be empty');
        });
        test('should enforce maximum number of concurrent agents', async () => {
            const maxAgents = 5;
            agentManager = new OpenClawAgentManager({ maxConcurrentAgents: maxAgents });
            // Spawn maximum number of agents
            for (let i = 0; i < maxAgents; i++) {
                await agentManager.spawnAgent({
                    name: `agent-${i}`,
                    type: 'test',
                    capabilities: ['testing']
                });
            }
            // Attempt to spawn one more should fail
            await expect(agentManager.spawnAgent({
                name: 'overflow-agent',
                type: 'test',
                capabilities: ['testing']
            })).rejects.toThrow('Maximum number of concurrent agents reached');
        });
    });
    describe('Agent Session Management', () => {
        let sessionId;
        beforeEach(async () => {
            const request = {
                name: 'session-test-agent',
                type: 'test',
                capabilities: ['testing']
            };
            sessionId = await agentManager.spawnAgent(request);
        });
        test('should get agent session details', async () => {
            const session = await agentManager.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session.sessionId).toBe(sessionId);
            expect(session.agentConfig.name).toBe('session-test-agent');
            expect(session.status).toBe('active');
            expect(session.createdAt).toBeInstanceOf(Date);
        });
        test('should return undefined for non-existent session', async () => {
            const session = await agentManager.getSession('non-existent-session');
            expect(session).toBeUndefined();
        });
        test('should kill an active agent session', async () => {
            const killPromise = new Promise((resolve) => {
                agentManager.on('agent-killed', resolve);
            });
            await agentManager.killSession(sessionId);
            const activeAgents = await agentManager.getActiveAgents();
            expect(activeAgents).toHaveLength(0);
            const event = await killPromise;
            expect(event).toEqual(expect.objectContaining({
                sessionId,
                reason: 'manual-termination'
            }));
        });
        test('should handle killing non-existent session gracefully', async () => {
            await expect(agentManager.killSession('non-existent-session')).resolves.toBeUndefined();
        });
        test('should track agent resource usage', async () => {
            const session = await agentManager.getSession(sessionId);
            expect(session?.usage).toBeDefined();
            expect(session?.usage.memoryUsage).toBeGreaterThanOrEqual(0);
            expect(session?.usage.cpuTime).toBeGreaterThanOrEqual(0);
            expect(session?.usage.networkRequests).toBe(0);
        });
    });
    describe('Agent Communication', () => {
        let sessionId;
        beforeEach(async () => {
            const request = {
                name: 'communication-agent',
                type: 'chat',
                capabilities: ['conversation']
            };
            sessionId = await agentManager.spawnAgent(request);
        });
        test('should send message to agent', async () => {
            const response = await agentManager.sendMessage(sessionId, {
                type: 'task',
                content: 'Analyze this code',
                data: { code: 'console.log("Hello World")' }
            });
            expect(response).toBeDefined();
            expect(response.success).toBe(true);
            expect(response.messageId).toBeTruthy();
        });
        test('should receive response from agent', async () => {
            const responsePromise = new Promise((resolve) => {
                agentManager.on('agent-response', resolve);
            });
            await agentManager.sendMessage(sessionId, {
                type: 'query',
                content: 'What is 2 + 2?'
            });
            const response = await responsePromise;
            expect(response).toEqual(expect.objectContaining({
                sessionId,
                messageId: expect.any(String),
                response: expect.any(String)
            }));
        });
        test('should handle agent errors', async () => {
            const errorPromise = new Promise((resolve) => {
                agentManager.on('agent-error', resolve);
            });
            await agentManager.sendMessage(sessionId, {
                type: 'invalid-task',
                content: 'This should cause an error'
            });
            const error = await errorPromise;
            expect(error).toEqual(expect.objectContaining({
                sessionId,
                error: expect.any(String)
            }));
        });
    });
    describe('Security Policies', () => {
        test('should apply security policy to agent', async () => {
            const securityPolicy = {
                allowedOperations: ['read', 'analyze'],
                blockedOperations: ['write', 'execute'],
                allowedPaths: ['/safe/path'],
                blockedPaths: ['/dangerous/path'],
                networkAccess: false,
                maxMemory: '128MB',
                maxCpuTime: 10000
            };
            const request = {
                name: 'secure-agent',
                type: 'restricted',
                capabilities: ['read-only'],
                securityPolicy
            };
            const sessionId = await agentManager.spawnAgent(request);
            const activeAgents = await agentManager.getActiveAgents();
            const agent = activeAgents[0];
            expect(agent.securityPolicy).toBeDefined();
            expect(agent.securityPolicy?.allowedOperations).toContain('read');
            expect(agent.securityPolicy?.allowedOperations).toContain('analyze');
            expect(agent.securityPolicy?.blockedOperations).toContain('write');
            expect(agent.securityPolicy?.networkAccess).toBe(false);
        });
        test('should enforce security policy restrictions', async () => {
            const securityPolicy = {
                allowedOperations: ['read'],
                blockedOperations: ['write'],
                allowedPaths: ['/safe'],
                blockedPaths: ['/unsafe'],
                networkAccess: false
            };
            const request = {
                name: 'restricted-agent',
                type: 'restricted',
                capabilities: ['limited'],
                securityPolicy
            };
            const sessionId = await agentManager.spawnAgent(request);
            // Attempt to perform blocked operation
            await expect(agentManager.sendMessage(sessionId, {
                type: 'file-operation',
                content: 'write to file',
                data: { operation: 'write', path: '/unsafe/file.txt' }
            })).rejects.toThrow('Operation blocked by security policy');
        });
    });
    describe('Agent Lifecycle Events', () => {
        test('should emit agent lifecycle events', async () => {
            const events = [];
            agentManager.on('agent-spawned', () => events.push('spawned'));
            agentManager.on('agent-ready', () => events.push('ready'));
            agentManager.on('agent-killed', () => events.push('killed'));
            const request = {
                name: 'lifecycle-agent',
                type: 'test',
                capabilities: ['testing']
            };
            const sessionId = await agentManager.spawnAgent(request);
            // Wait for ready event
            await new Promise(resolve => setTimeout(resolve, 100));
            await agentManager.killSession(sessionId);
            expect(events).toEqual(['spawned', 'ready', 'killed']);
        });
        test('should handle agent timeout', async () => {
            const timeoutPromise = new Promise((resolve) => {
                agentManager.on('agent-timeout', resolve);
            });
            const request = {
                name: 'timeout-agent',
                type: 'test',
                capabilities: ['testing'],
                timeout: 100 // Very short timeout for testing
            };
            await agentManager.spawnAgent(request);
            const event = await timeoutPromise;
            expect(event).toEqual(expect.objectContaining({
                sessionId: expect.any(String),
                reason: 'timeout'
            }));
        });
    });
    describe('Performance and Resource Management', () => {
        test('should monitor memory usage', async () => {
            const request = {
                name: 'memory-test-agent',
                type: 'performance',
                capabilities: ['memory-intensive'],
                resources: {
                    maxMemory: '64MB'
                }
            };
            const sessionId = await agentManager.spawnAgent(request);
            // Wait for some resource usage
            await new Promise(resolve => setTimeout(resolve, 100));
            const session = await agentManager.getSession(sessionId);
            expect(session?.usage.memoryUsage).toBeGreaterThanOrEqual(0);
        });
        test('should enforce CPU time limits', async () => {
            const cpuLimitPromise = new Promise((resolve) => {
                agentManager.on('agent-resource-limit', resolve);
            });
            const request = {
                name: 'cpu-test-agent',
                type: 'cpu-intensive',
                capabilities: ['computation'],
                resources: {
                    maxCpuTime: 50 // Very short limit
                }
            };
            await agentManager.spawnAgent(request);
            const event = await cpuLimitPromise;
            expect(event).toEqual(expect.objectContaining({
                sessionId: expect.any(String),
                resource: 'cpu',
                limit: 50
            }));
        });
        test('should cleanup resources on shutdown', async () => {
            const request = {
                name: 'cleanup-agent',
                type: 'test',
                capabilities: ['testing']
            };
            await agentManager.spawnAgent(request);
            const activeAgentsBefore = await agentManager.getActiveAgents();
            expect(activeAgentsBefore).toHaveLength(1);
            await agentManager.shutdown();
            const activeAgentsAfter = await agentManager.getActiveAgents();
            expect(activeAgentsAfter).toHaveLength(0);
        });
    });
    describe('Agent Types and Capabilities', () => {
        test('should handle different agent types', async () => {
            const agentTypes = ['code-reviewer', 'general-purpose', 'data-analyst', 'security-scanner'];
            for (const type of agentTypes) {
                const request = {
                    name: `${type}-agent`,
                    type,
                    capabilities: ['analysis']
                };
                const sessionId = await agentManager.spawnAgent(request);
                const activeAgents = await agentManager.getActiveAgents();
                const agent = activeAgents.find(a => a.name === `${type}-agent`);
                expect(agent?.type).toBe(type);
                await agentManager.killSession(sessionId);
            }
        });
        test('should validate agent capabilities', async () => {
            const validCapabilities = ['file-analysis', 'code-review', 'security-scan', 'data-processing'];
            const request = {
                name: 'capability-test-agent',
                type: 'multi-capability',
                capabilities: validCapabilities
            };
            const sessionId = await agentManager.spawnAgent(request);
            const activeAgents = await agentManager.getActiveAgents();
            const agent = activeAgents[0];
            expect(agent.capabilities).toEqual(expect.arrayContaining(validCapabilities));
        });
        test('should reject invalid capabilities', async () => {
            const request = {
                name: 'invalid-capability-agent',
                type: 'test',
                capabilities: ['invalid-capability']
            };
            await expect(agentManager.spawnAgent(request)).rejects.toThrow('Invalid capability: invalid-capability');
        });
    });
    describe('Error Handling and Recovery', () => {
        test('should handle agent crash gracefully', async () => {
            const crashPromise = new Promise((resolve) => {
                agentManager.on('agent-crashed', resolve);
            });
            const request = {
                name: 'crash-test-agent',
                type: 'unstable',
                capabilities: ['testing']
            };
            const sessionId = await agentManager.spawnAgent(request);
            // Simulate agent crash
            await agentManager.simulateAgentCrash(sessionId);
            const event = await crashPromise;
            expect(event).toEqual(expect.objectContaining({
                sessionId,
                reason: 'crash',
                error: expect.any(String)
            }));
            const activeAgents = await agentManager.getActiveAgents();
            expect(activeAgents).toHaveLength(0);
        });
        test('should attempt agent recovery if enabled', async () => {
            agentManager = new OpenClawAgentManager({ enableAutoRecovery: true });
            const recoveryPromise = new Promise((resolve) => {
                agentManager.on('agent-recovered', resolve);
            });
            const request = {
                name: 'recovery-test-agent',
                type: 'recoverable',
                capabilities: ['testing'],
                recoveryConfig: {
                    enabled: true,
                    maxRetries: 3,
                    retryDelay: 100
                }
            };
            const sessionId = await agentManager.spawnAgent(request);
            await agentManager.simulateAgentCrash(sessionId);
            const event = await recoveryPromise;
            expect(event).toEqual(expect.objectContaining({
                sessionId: expect.any(String),
                attempt: 1
            }));
        });
    });
});
