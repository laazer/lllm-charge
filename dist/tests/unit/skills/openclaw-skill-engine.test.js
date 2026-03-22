import { jest } from '@jest/globals';
import { OpenClawSkillEngine } from '../../../src/skills/openclaw-skill-engine.js';
// Mock filesystem operations
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn(),
    stat: jest.fn(),
    access: jest.fn()
}));
// Mock child process operations
jest.mock('child_process', () => ({
    spawn: jest.fn(),
    exec: jest.fn()
}));
// Mock VM for sandboxed execution
jest.mock('vm', () => ({
    createContext: jest.fn(() => ({})),
    runInContext: jest.fn(),
    Script: jest.fn().mockImplementation(function (code) {
        this.runInContext = jest.fn(() => 'mocked result');
    })
}));
describe('OpenClawSkillEngine', () => {
    let skillEngine;
    beforeEach(() => {
        skillEngine = new OpenClawSkillEngine();
    });
    afterEach(() => {
        skillEngine.removeAllListeners();
    });
    describe('Skill Installation', () => {
        test('should install skill from SKILL.md file', async () => {
            const skillRequest = {
                name: 'code-analyzer',
                source: 'local',
                path: '/test/skills/code-analyzer/SKILL.md'
            };
            const fs = await import('fs/promises');
            const mockSkillContent = `
# Code Analyzer Skill

## Description
Analyzes code for quality and security issues.

## Commands
- analyze-code: Analyzes the provided code
- check-security: Performs security analysis

## Usage
\`\`\`
skill code-analyzer analyze-code --file="./src/app.js"
\`\`\`

## Capabilities
- Static code analysis
- Security vulnerability detection
- Code quality metrics
`;
            fs.readFile.mockResolvedValue(mockSkillContent);
            fs.stat.mockResolvedValue({ isFile: () => true });
            await skillEngine.installSkill(skillRequest.name, skillRequest.path);
            const installedSkills = await skillEngine.getInstalledSkills();
            expect(installedSkills).toHaveLength(1);
            expect(installedSkills[0].name).toBe('code-analyzer');
            expect(installedSkills[0].commands).toContain('analyze-code');
            expect(installedSkills[0].commands).toContain('check-security');
        });
        test('should install skill from npm registry', async () => {
            const skillRequest = {
                name: 'npm-skill',
                source: 'npm',
                package: '@openclaw/skill-npm',
                version: '1.0.0'
            };
            await skillEngine.installSkill(skillRequest.name, skillRequest.package, skillRequest.version);
            const installedSkills = await skillEngine.getInstalledSkills();
            expect(installedSkills.some(skill => skill.name === 'npm-skill')).toBe(true);
        });
        test('should emit skill-installed event', async () => {
            const eventPromise = new Promise((resolve) => {
                skillEngine.on('skill-installed', resolve);
            });
            const skillRequest = {
                name: 'event-test-skill',
                source: 'local',
                path: '/test/skills/event-test/SKILL.md'
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue('# Event Test Skill\n## Commands\n- test: Test command');
            fs.stat.mockResolvedValue({ isFile: () => true });
            await skillEngine.installSkill(skillRequest.name, skillRequest.path);
            const event = await eventPromise;
            expect(event).toEqual(expect.objectContaining({
                skillName: 'event-test-skill',
                version: expect.any(String)
            }));
        });
        test('should reject invalid skill definitions', async () => {
            const fs = await import('fs/promises');
            const invalidSkillContent = `
# Invalid Skill
No commands defined
`;
            fs.readFile.mockResolvedValue(invalidSkillContent);
            fs.stat.mockResolvedValue({ isFile: () => true });
            await expect(skillEngine.installSkill('invalid-skill', '/test/invalid/SKILL.md')).rejects.toThrow('Invalid skill definition: No commands found');
        });
    });
    describe('Skill Validation', () => {
        test('should validate skill definition structure', async () => {
            const skillDefinition = {
                name: 'validation-test-skill',
                description: 'A skill for testing validation',
                commands: ['validate', 'test'],
                capabilities: ['validation', 'testing'],
                version: '1.0.0',
                author: 'test-author',
                dependencies: [],
                sandboxConfig: {
                    allowFileAccess: true,
                    allowNetworkAccess: false,
                    maxMemory: '128MB',
                    maxExecutionTime: 5000
                }
            };
            const result = await skillEngine.validateSkill(skillDefinition);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });
        test('should detect missing required fields', async () => {
            const incompleteSkill = {
                name: 'incomplete-skill',
                // Missing description, commands, etc.
            };
            const result = await skillEngine.validateSkill(incompleteSkill);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required field: description');
            expect(result.errors).toContain('Missing required field: commands');
        });
        test('should validate command syntax', async () => {
            const skillDefinition = {
                name: 'command-test-skill',
                description: 'Testing command validation',
                commands: ['valid-command', 'invalid command with spaces', ''],
                capabilities: ['testing'],
                version: '1.0.0',
                author: 'test'
            };
            const result = await skillEngine.validateSkill(skillDefinition);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid command name: "invalid command with spaces"');
            expect(result.errors).toContain('Empty command name found');
        });
        test('should validate dependency versions', async () => {
            const skillDefinition = {
                name: 'dependency-test-skill',
                description: 'Testing dependency validation',
                commands: ['test'],
                capabilities: ['testing'],
                version: '1.0.0',
                author: 'test',
                dependencies: [
                    { name: 'valid-dep', version: '^1.0.0' },
                    { name: 'invalid-dep', version: 'not-a-version' }
                ]
            };
            const result = await skillEngine.validateSkill(skillDefinition);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid version format for dependency "invalid-dep"');
        });
    });
    describe('Skill Execution', () => {
        let testSkill;
        beforeEach(async () => {
            testSkill = {
                name: 'execution-test-skill',
                description: 'A skill for testing execution',
                commands: ['echo', 'calculate', 'file-process'],
                capabilities: ['text-processing', 'calculation'],
                version: '1.0.0',
                author: 'test-author',
                sandboxConfig: {
                    allowFileAccess: true,
                    allowNetworkAccess: false,
                    maxMemory: '128MB',
                    maxExecutionTime: 5000
                }
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(testSkill));
            fs.stat.mockResolvedValue({ isFile: () => true });
            await skillEngine.installSkill(testSkill.name, '/test/execution-skill/SKILL.md');
        });
        test('should execute skill command successfully', async () => {
            const result = await skillEngine.executeSkill('execution-test-skill', 'echo', {
                message: 'Hello, World!'
            });
            expect(result.success).toBe(true);
            expect(result.output).toBeDefined();
            expect(result.executionTime).toBeGreaterThan(0);
            expect(result.memoryUsed).toBeGreaterThanOrEqual(0);
        });
        test('should handle skill execution errors', async () => {
            const result = await skillEngine.executeSkill('execution-test-skill', 'nonexistent-command', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('Command not found: nonexistent-command');
        });
        test('should enforce execution timeouts', async () => {
            // Mock a long-running command
            const longRunningSkill = {
                ...testSkill,
                name: 'timeout-test-skill',
                sandboxConfig: {
                    ...testSkill.sandboxConfig,
                    maxExecutionTime: 100 // Very short timeout
                }
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(longRunningSkill));
            await skillEngine.installSkill(longRunningSkill.name, '/test/timeout-skill/SKILL.md');
            const result = await skillEngine.executeSkill('timeout-test-skill', 'echo', {
                delay: 200 // Longer than timeout
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Execution timeout exceeded');
        });
        test('should enforce memory limits', async () => {
            const memoryLimitSkill = {
                ...testSkill,
                name: 'memory-limit-skill',
                sandboxConfig: {
                    ...testSkill.sandboxConfig,
                    maxMemory: '1MB' // Very small limit
                }
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(memoryLimitSkill));
            await skillEngine.installSkill(memoryLimitSkill.name, '/test/memory-skill/SKILL.md');
            const result = await skillEngine.executeSkill('memory-limit-skill', 'calculate', {
                operation: 'memory-intensive'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Memory limit exceeded');
        });
        test('should provide execution context to skills', async () => {
            const context = {
                workingDirectory: '/test/workspace',
                environment: {
                    NODE_ENV: 'test',
                    CUSTOM_VAR: 'test-value'
                },
                allowedPaths: ['/test/workspace', '/tmp'],
                userId: 'test-user',
                sessionId: 'test-session'
            };
            const result = await skillEngine.executeSkill('execution-test-skill', 'echo', {
                message: 'context test'
            }, context);
            expect(result.success).toBe(true);
            expect(result.context).toBeDefined();
            expect(result.context?.workingDirectory).toBe('/test/workspace');
        });
    });
    describe('Sandbox Security', () => {
        test('should prevent file access outside allowed paths', async () => {
            const restrictedSkill = {
                name: 'restricted-skill',
                description: 'Restricted file access skill',
                commands: ['read-file'],
                capabilities: ['file-access'],
                version: '1.0.0',
                author: 'test',
                sandboxConfig: {
                    allowFileAccess: true,
                    allowedPaths: ['/safe/path'],
                    maxMemory: '128MB',
                    maxExecutionTime: 5000
                }
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(restrictedSkill));
            await skillEngine.installSkill(restrictedSkill.name, '/test/restricted/SKILL.md');
            const result = await skillEngine.executeSkill('restricted-skill', 'read-file', {
                path: '/unsafe/path/file.txt'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('File access denied: path not allowed');
        });
        test('should prevent network access when disabled', async () => {
            const noNetworkSkill = {
                name: 'no-network-skill',
                description: 'No network access skill',
                commands: ['fetch-data'],
                capabilities: ['data-processing'],
                version: '1.0.0',
                author: 'test',
                sandboxConfig: {
                    allowNetworkAccess: false,
                    maxMemory: '128MB',
                    maxExecutionTime: 5000
                }
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(noNetworkSkill));
            await skillEngine.installSkill(noNetworkSkill.name, '/test/no-network/SKILL.md');
            const result = await skillEngine.executeSkill('no-network-skill', 'fetch-data', {
                url: 'https://api.example.com/data'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network access denied');
        });
        test('should isolate skill execution environments', async () => {
            const skill1Result = await skillEngine.executeSkill('execution-test-skill', 'echo', {
                variable: 'skill1-value'
            });
            const skill2Result = await skillEngine.executeSkill('execution-test-skill', 'echo', {
                variable: 'skill2-value'
            });
            expect(skill1Result.success).toBe(true);
            expect(skill2Result.success).toBe(true);
            // Ensure no variable bleeding between executions
            expect(skill1Result.output).not.toContain('skill2-value');
            expect(skill2Result.output).not.toContain('skill1-value');
        });
    });
    describe('Skill Management', () => {
        test('should list installed skills', async () => {
            const skills = await skillEngine.getInstalledSkills();
            expect(Array.isArray(skills)).toBe(true);
            // Should include skills installed in previous tests
            const skillNames = skills.map(skill => skill.name);
            expect(skillNames).toContain('execution-test-skill');
        });
        test('should uninstall skill', async () => {
            const skillName = 'uninstall-test-skill';
            const testSkill = {
                name: skillName,
                description: 'Skill for uninstall testing',
                commands: ['test'],
                capabilities: ['testing'],
                version: '1.0.0',
                author: 'test'
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(testSkill));
            await skillEngine.installSkill(skillName, '/test/uninstall/SKILL.md');
            const beforeUninstall = await skillEngine.getInstalledSkills();
            expect(beforeUninstall.some(skill => skill.name === skillName)).toBe(true);
            await skillEngine.uninstallSkill(skillName);
            const afterUninstall = await skillEngine.getInstalledSkills();
            expect(afterUninstall.some(skill => skill.name === skillName)).toBe(false);
        });
        test('should update skill to new version', async () => {
            const skillName = 'update-test-skill';
            // Install v1.0.0
            const skillV1 = {
                name: skillName,
                description: 'Skill for update testing',
                commands: ['old-command'],
                capabilities: ['testing'],
                version: '1.0.0',
                author: 'test'
            };
            const fs = await import('fs/promises');
            fs.readFile.mockResolvedValue(JSON.stringify(skillV1));
            await skillEngine.installSkill(skillName, '/test/update/v1/SKILL.md');
            // Update to v2.0.0
            const skillV2 = {
                ...skillV1,
                version: '2.0.0',
                commands: ['new-command', 'old-command']
            };
            fs.readFile.mockResolvedValue(JSON.stringify(skillV2));
            await skillEngine.updateSkill(skillName, '/test/update/v2/SKILL.md');
            const skills = await skillEngine.getInstalledSkills();
            const updatedSkill = skills.find(skill => skill.name === skillName);
            expect(updatedSkill?.version).toBe('2.0.0');
            expect(updatedSkill?.commands).toContain('new-command');
        });
        test('should get skill metadata', async () => {
            const metadata = await skillEngine.getSkillMetadata('execution-test-skill');
            expect(metadata).toBeDefined();
            expect(metadata?.name).toBe('execution-test-skill');
            expect(metadata?.description).toBeDefined();
            expect(metadata?.installedAt).toBeInstanceOf(Date);
            expect(metadata?.lastUsed).toBeInstanceOf(Date);
            expect(metadata?.usageCount).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Skill Discovery', () => {
        test('should discover skills in directory', async () => {
            const fs = await import('fs/promises');
            fs.readdir.mockResolvedValue(['skill1', 'skill2', 'skill3']);
            fs.stat.mockResolvedValue({ isDirectory: () => true });
            const discoveredSkills = await skillEngine.discoverSkills('/test/skills-directory');
            expect(discoveredSkills).toHaveLength(3);
            expect(discoveredSkills.map(s => s.name)).toEqual(['skill1', 'skill2', 'skill3']);
        });
        test('should search skills by capability', async () => {
            const skills = await skillEngine.searchSkills({ capability: 'text-processing' });
            expect(Array.isArray(skills)).toBe(true);
            skills.forEach(skill => {
                expect(skill.capabilities).toContain('text-processing');
            });
        });
        test('should search skills by author', async () => {
            const skills = await skillEngine.searchSkills({ author: 'test-author' });
            expect(Array.isArray(skills)).toBe(true);
            skills.forEach(skill => {
                expect(skill.author).toBe('test-author');
            });
        });
    });
    describe('Performance Optimization', () => {
        test('should cache skill execution results', async () => {
            const start1 = Date.now();
            const result1 = await skillEngine.executeSkill('execution-test-skill', 'calculate', {
                operation: 'factorial',
                number: 5
            });
            const duration1 = Date.now() - start1;
            const start2 = Date.now();
            const result2 = await skillEngine.executeSkill('execution-test-skill', 'calculate', {
                operation: 'factorial',
                number: 5
            });
            const duration2 = Date.now() - start2;
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result1.output).toBe(result2.output);
            expect(duration2).toBeLessThan(duration1); // Cached execution should be faster
        });
        test('should preload frequently used skills', async () => {
            await skillEngine.preloadSkill('execution-test-skill');
            const preloadedSkills = await skillEngine.getPreloadedSkills();
            expect(preloadedSkills).toContain('execution-test-skill');
        });
        test('should track skill usage statistics', async () => {
            await skillEngine.executeSkill('execution-test-skill', 'echo', { message: 'stats test' });
            const stats = await skillEngine.getUsageStatistics('execution-test-skill');
            expect(stats).toBeDefined();
            expect(stats.totalExecutions).toBeGreaterThan(0);
            expect(stats.averageExecutionTime).toBeGreaterThan(0);
            expect(stats.lastUsed).toBeInstanceOf(Date);
        });
    });
    describe('Error Handling and Recovery', () => {
        test('should handle skill runtime errors gracefully', async () => {
            const result = await skillEngine.executeSkill('execution-test-skill', 'echo', {
                throwError: true
            });
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.stackTrace).toBeDefined();
        });
        test('should recover from skill crashes', async () => {
            const crashPromise = new Promise((resolve) => {
                skillEngine.on('skill-crashed', resolve);
            });
            await skillEngine.executeSkill('execution-test-skill', 'crash', {});
            const event = await crashPromise;
            expect(event).toEqual(expect.objectContaining({
                skillName: 'execution-test-skill',
                command: 'crash',
                error: expect.any(String)
            }));
        });
        test('should maintain skill registry integrity after errors', async () => {
            // Cause an error
            await skillEngine.executeSkill('execution-test-skill', 'invalid-command', {});
            // Verify registry is still intact
            const skills = await skillEngine.getInstalledSkills();
            expect(skills.some(skill => skill.name === 'execution-test-skill')).toBe(true);
        });
    });
});
