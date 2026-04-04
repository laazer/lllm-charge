// End-to-end integration tests for complete LLM-Charge workflow
import { LLMChargeServer } from '../../src/mcp/llm-charge-server';
import { HybridReasoning } from '../../src/reasoning/hybrid-reasoning';
import { DocsIntelligence } from '../../src/intelligence/docs-intelligence';
import { CommonCommandHandler } from '../../src/utils/common-commands';
import { TEST_CONFIG, createMockConfig, MockLLMProvider } from '../setup';
import * as path from 'path';
import * as fs from 'fs/promises';
describe('End-to-End LLM-Charge Integration', () => {
    let testProjectDir;
    let mockProvider;
    beforeAll(async () => {
        testProjectDir = path.join(TEST_CONFIG.TEST_CACHE_DIR, 'e2e-test');
        await fs.mkdir(testProjectDir, { recursive: true });
        mockProvider = new MockLLMProvider();
        // Create comprehensive test project
        await createTestProject(testProjectDir);
    });
    afterAll(async () => {
        try {
            await fs.rm(testProjectDir, { recursive: true });
        }
        catch (error) {
            // Ignore cleanup errors
        }
    });
    describe('Complete Development Workflow', () => {
        it('should handle a typical development query workflow', async () => {
            const config = createMockConfig();
            const server = new LLMChargeServer(config, testProjectDir);
            // Simulate a complete development workflow
            const workflow = [
                {
                    step: 'Check project status',
                    tool: 'execute_common_command',
                    args: { command: 'git status' }
                },
                {
                    step: 'Search React documentation',
                    tool: 'search_developer_docs',
                    args: { query: 'React useState hook patterns' }
                },
                {
                    step: 'Analyze codebase structure',
                    tool: 'build_context_package',
                    args: { query: 'React component patterns in this project' }
                },
                {
                    step: 'Get optimization recommendations',
                    tool: 'get_cost_metrics',
                    args: { timeframe: 'day' }
                }
            ];
            // Mock the server components
            await mockServerComponents(server);
            for (const step of workflow) {
                console.log(`Executing: ${step.step}`);
                let result;
                if (step.tool === 'execute_common_command') {
                    result = await server.handleExecuteCommonCommand(step.args);
                }
                else if (step.tool === 'search_developer_docs') {
                    result = await server.handleDocsTool('search_developer_docs', step.args);
                }
                else if (step.tool === 'build_context_package') {
                    result = await server.handleBuildContextPackage(step.args);
                }
                else if (step.tool === 'get_cost_metrics') {
                    result = await server.handleGetCostMetrics(step.args);
                }
                expect(result).toBeDefined();
                expect(result.content).toBeDefined();
                expect(result.content[0].type).toBe('text');
                expect(result.content[0].text.length).toBeGreaterThan(0);
            }
        });
        it('should demonstrate cost savings across multiple operations', async () => {
            const commonCommands = [
                'git status',
                'npm install',
                'list files',
                'current directory',
                'make build'
            ];
            const handler = new CommonCommandHandler();
            let totalCost = 0;
            let totalTime = 0;
            let successfulCommands = 0;
            for (const command of commonCommands) {
                const startTime = Date.now();
                const result = await handler.handleCommand(command, testProjectDir);
                const executionTime = Date.now() - startTime;
                if (result) {
                    totalCost += result.cost || 0;
                    totalTime += executionTime;
                    successfulCommands++;
                    expect(result.cost).toBe(0); // All commands should be zero cost
                    expect(result.executionTime).toBeGreaterThanOrEqual(0);
                }
            }
            expect(successfulCommands).toBeGreaterThan(0);
            expect(totalCost).toBe(0); // Total cost should be zero
            expect(totalTime).toBeLessThan(5000); // All commands should complete quickly
            // Calculate theoretical API savings
            const apiCostPerCommand = 0.005;
            const theoreticalCost = successfulCommands * apiCostPerCommand;
            const actualSavings = theoreticalCost - totalCost;
            expect(actualSavings).toBeGreaterThan(0);
            console.log(`💰 Cost savings: $${actualSavings.toFixed(3)} for ${successfulCommands} commands`);
        });
    });
    describe('Smart Documentation Integration', () => {
        it('should auto-detect and cache documentation needs', async () => {
            const mockKnowledgeBase = createMockKnowledgeBase();
            const docsIntelligence = new DocsIntelligence(testProjectDir, mockKnowledgeBase);
            // Mock the setup methods
            jest.spyOn(docsIntelligence, 'setupDevDocs').mockResolvedValue();
            jest.spyOn(docsIntelligence, 'setupGPT4All').mockResolvedValue();
            jest.spyOn(docsIntelligence, 'loadAvailableDocs').mockResolvedValue([]);
            await docsIntelligence.initialize();
            // Test queries that should trigger auto-detection
            const testQueries = [
                { query: 'How to use React hooks?', expectedDocs: ['react'] },
                { query: 'TypeScript interface syntax', expectedDocs: ['typescript'] },
                { query: 'Docker compose commands', expectedDocs: ['docker'] },
                { query: 'Git rebase interactive mode', expectedDocs: ['git'] }
            ];
            for (const { query, expectedDocs } of testQueries) {
                // Mock the smart cache behavior
                const mockSearchResults = expectedDocs.map(doc => ({
                    doc,
                    name: `${doc} documentation`,
                    path: `/${doc}/`,
                    type: 'doc',
                    similarity: 0.9,
                    source: 'devdocs'
                }));
                jest.spyOn(docsIntelligence, 'searchSemanticDocs').mockResolvedValue(mockSearchResults);
                jest.spyOn(docsIntelligence, 'searchDevDocs').mockResolvedValue([]);
                const results = await docsIntelligence.searchDocs({ query, limit: 5 });
                expect(results.length).toBeGreaterThan(0);
                expect(results.some(r => expectedDocs.includes(r.doc))).toBe(true);
            }
        });
        it('should handle 365-day expiration and cleanup', async () => {
            const mockKnowledgeBase = createMockKnowledgeBase();
            // Mock documents with different ages
            const oldDocs = 5;
            const recentDocs = 3;
            mockKnowledgeBase.cleanupExpiredDocs.mockResolvedValue(oldDocs);
            const docsIntelligence = new DocsIntelligence(testProjectDir, mockKnowledgeBase);
            // Mock setup
            jest.spyOn(docsIntelligence, 'setupDevDocs').mockResolvedValue();
            jest.spyOn(docsIntelligence, 'setupGPT4All').mockResolvedValue();
            jest.spyOn(docsIntelligence, 'loadAvailableDocs').mockResolvedValue([]);
            await docsIntelligence.initialize();
            // Verify cleanup was called with 365-day expiration
            const expectedExpiration = 365 * 24 * 60 * 60 * 1000;
            expect(mockKnowledgeBase.cleanupExpiredDocs).toHaveBeenCalledWith(expectedExpiration);
            console.log(`🧹 Cleaned up ${oldDocs} expired documentation entries`);
        });
    });
    describe('Hybrid Reasoning Integration', () => {
        it('should route queries intelligently between local and API', async () => {
            const mockIntelligence = createMockIntelligence();
            const mockRLMEngine = createMockRLMEngine();
            const mockRouter = createMockLLMRouter();
            const hybridReasoning = new HybridReasoning(mockIntelligence, mockRLMEngine, mockRouter);
            const testQueries = [
                {
                    query: 'What is the current directory?',
                    complexity: 'simple',
                    expectedStrategy: 'direct-local'
                },
                {
                    query: 'Explain the architectural trade-offs between React and Vue for large applications',
                    complexity: 'complex',
                    requiresReasoning: true,
                    expectedStrategy: 'recursive-local'
                },
                {
                    query: 'How can I optimize this React component performance?',
                    complexity: 'medium',
                    expectedStrategy: 'hybrid'
                }
            ];
            for (const testCase of testQueries) {
                const result = await hybridReasoning.processQuery(testCase, testProjectDir);
                expect(result).toBeDefined();
                expect(result.answer).toBeTruthy();
                expect(result.modelUsed).toBeTruthy();
                expect(result.cost).toBeGreaterThanOrEqual(0);
                expect(result.tokensUsed).toBeGreaterThanOrEqual(0);
                expect(result.stepsExecuted).toBeGreaterThan(0);
                expect(result.confidence).toBeWithinRange(0, 1);
                console.log(`Query: "${testCase.query}"`);
                console.log(`Strategy used: ${result.modelUsed}`);
                console.log(`Cost: $${result.cost.toFixed(3)}`);
                console.log(`Local: ${result.isLocal}`);
                console.log('');
            }
        });
    });
    describe('Performance and Scalability', () => {
        it('should handle high-volume operations efficiently', async () => {
            const handler = new CommonCommandHandler();
            const numOperations = 50;
            const operations = Array.from({ length: numOperations }, (_, i) => ({
                command: i % 2 === 0 ? 'current directory' : 'list files',
                index: i
            }));
            const startTime = Date.now();
            const promises = operations.map(op => handler.handleCommand(op.command, testProjectDir));
            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            const avgTime = totalTime / numOperations;
            expect(results.every(r => r !== null)).toBe(true);
            expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
            expect(avgTime).toBeLessThan(200); // Average under 200ms per operation
            console.log(`⚡ Performance: ${numOperations} operations in ${totalTime}ms (avg: ${avgTime.toFixed(1)}ms)`);
        });
        it('should maintain memory efficiency with large contexts', async () => {
            const initialMemory = process.memoryUsage();
            // Simulate processing large amounts of data
            const largeOperations = [];
            for (let i = 0; i < 20; i++) {
                largeOperations.push(createMockKnowledgeBase().store(`large-doc-${i}`, 'x'.repeat(10000), // 10KB per document
                { type: 'test', index: i }));
            }
            await Promise.all(largeOperations);
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            // Memory increase should be reasonable (less than 100MB)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
            console.log(`📊 Memory usage: +${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });
    });
    describe('Error Recovery and Resilience', () => {
        it('should recover gracefully from component failures', async () => {
            const config = createMockConfig();
            const server = new LLMChargeServer(config, testProjectDir);
            // Mock a failing intelligence component
            const failingIntelligence = {
                buildContextPackage: jest.fn()
                    .mockRejectedValueOnce(new Error('Network timeout'))
                    .mockResolvedValueOnce({
                    relevantFiles: [],
                    codeSymbols: [],
                    semanticMatches: [],
                    memoryNodes: [],
                    relationships: [],
                    estimatedTokens: 0
                })
            };
            server.intelligence = failingIntelligence;
            // First call should handle error gracefully
            const failedResult = await server.handleBuildContextPackage({ query: 'test' });
            expect(failedResult.isError).toBe(true);
            // Second call should succeed
            const successResult = await server.handleBuildContextPackage({ query: 'test' });
            expect(successResult.isError).toBeFalsy();
        });
        it('should handle resource constraints gracefully', async () => {
            const handler = new CommonCommandHandler();
            // Simulate resource-intensive operations
            const heavyCommands = Array.from({ length: 100 }, () => 'list files');
            let successCount = 0;
            let errorCount = 0;
            for (const command of heavyCommands) {
                try {
                    const result = await handler.handleCommand(command, testProjectDir);
                    if (result && result.success) {
                        successCount++;
                    }
                    else {
                        errorCount++;
                    }
                }
                catch (error) {
                    errorCount++;
                }
            }
            // Should handle most operations successfully even under load
            const successRate = successCount / (successCount + errorCount);
            expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
            console.log(`🎯 Success rate under load: ${(successRate * 100).toFixed(1)}%`);
        });
    });
    describe('Real-World Usage Scenarios', () => {
        it('should handle typical developer day workflow', async () => {
            const realWorldScenario = [
                { action: 'Check project status', command: 'git status' },
                { action: 'Install dependencies', command: 'npm install' },
                { action: 'Look up React documentation', query: 'React useEffect cleanup' },
                { action: 'Build project', command: 'npm run build' },
                { action: 'Run tests', command: 'npm test' },
                { action: 'Check documentation for TypeScript', query: 'TypeScript generic constraints' },
                { action: 'Commit changes', command: 'commit and push with message "Add feature"' }
            ];
            const handler = new CommonCommandHandler();
            const mockDocsIntelligence = createMockDocsIntelligence();
            let totalCost = 0;
            let totalTime = 0;
            let operations = 0;
            for (const step of realWorldScenario) {
                const startTime = Date.now();
                operations++;
                if (step.command) {
                    const result = await handler.handleCommand(step.command, testProjectDir);
                    if (result) {
                        totalCost += result.cost || 0;
                        console.log(`✅ ${step.action}: ${result.success ? 'Success' : 'Failed'} (${result.executionTime}ms)`);
                    }
                }
                else if (step.query) {
                    const results = await mockDocsIntelligence.searchDocs({ query: step.query, limit: 3 });
                    console.log(`📚 ${step.action}: Found ${results.length} results`);
                }
                totalTime += Date.now() - startTime;
            }
            const avgTimePerOperation = totalTime / operations;
            const theoreticalAPICost = operations * 0.006; // Average API cost per operation
            const actualSavings = theoreticalAPICost - totalCost;
            expect(totalCost).toBeLessThan(0.01); // Should be nearly zero
            expect(avgTimePerOperation).toBeLessThan(1000); // Average under 1 second
            expect(actualSavings).toBeGreaterThan(0.03); // Significant savings
            console.log(`\n📊 Real-World Scenario Results:`);
            console.log(`   Operations: ${operations}`);
            console.log(`   Total time: ${totalTime}ms`);
            console.log(`   Avg time per operation: ${avgTimePerOperation.toFixed(0)}ms`);
            console.log(`   Actual cost: $${totalCost.toFixed(3)}`);
            console.log(`   Theoretical API cost: $${theoreticalAPICost.toFixed(3)}`);
            console.log(`   💰 Savings: $${actualSavings.toFixed(3)} (${((actualSavings / theoreticalAPICost) * 100).toFixed(1)}%)`);
        });
    });
    // Helper functions
    async function createTestProject(projectDir) {
        // Create package.json
        await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
            name: 'e2e-test-project',
            dependencies: {
                'react': '^18.0.0',
                'typescript': '^5.0.0',
                'express': '^4.18.0'
            },
            scripts: {
                'build': 'tsc',
                'test': 'jest',
                'dev': 'node server.js'
            }
        }, null, 2));
        // Create source files
        await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
        await fs.writeFile(path.join(projectDir, 'src', 'App.tsx'), `
import React, { useState, useEffect } from 'react'
import express from 'express'

function App() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    fetch('/api/data')
      .then(response => response.json())
      .then(setData)
  }, [])
  
  return <div>Data: {JSON.stringify(data)}</div>
}

export default App
      `.trim());
        await fs.writeFile(path.join(projectDir, 'src', 'server.ts'), `
import express from 'express'

const app = express()

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from server!' })
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
      `.trim());
        // Create TypeScript config
        await fs.writeFile(path.join(projectDir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: {
                target: 'ES2020',
                module: 'commonjs',
                jsx: 'react',
                strict: true,
                esModuleInterop: true
            }
        }, null, 2));
        // Create git repository structure
        await fs.mkdir(path.join(projectDir, '.git'), { recursive: true });
        await fs.writeFile(path.join(projectDir, '.gitignore'), 'node_modules/\n*.log\n');
    }
    function createMockKnowledgeBase() {
        return {
            initialize: jest.fn(),
            store: jest.fn(),
            searchSemantic: jest.fn().mockResolvedValue([]),
            updateLastAccessed: jest.fn(),
            cleanupExpiredDocs: jest.fn().mockResolvedValue(0),
            cleanup: jest.fn()
        };
    }
    function createMockIntelligence() {
        return {
            buildContextPackage: jest.fn().mockResolvedValue({
                relevantFiles: [],
                codeSymbols: [],
                semanticMatches: [],
                memoryNodes: [],
                relationships: [],
                estimatedTokens: 100
            }),
            updateMemory: jest.fn()
        };
    }
    function createMockRLMEngine() {
        return {
            startReasoningSession: jest.fn().mockResolvedValue('session-123'),
            getSession: jest.fn().mockResolvedValue({
                id: 'session-123',
                iterations: [],
                result: 'Mock reasoning result'
            })
        };
    }
    function createMockLLMRouter() {
        return {
            processRequest: jest.fn().mockResolvedValue({
                content: 'Mock LLM response',
                model: 'test-model',
                isLocal: true,
                cost: 0,
                tokens: { total: 100, prompt: 50, completion: 50 }
            })
        };
    }
    function createMockDocsIntelligence() {
        return {
            searchDocs: jest.fn().mockResolvedValue([
                {
                    doc: 'react',
                    name: 'Mock React Doc',
                    path: '/react/hooks',
                    type: 'hook',
                    similarity: 0.9,
                    source: 'devdocs'
                }
            ])
        };
    }
    async function mockServerComponents(server) {
        // Mock all server components for testing
        server.intelligence = createMockIntelligence();
        server.docsIntelligence = createMockDocsIntelligence();
        server.reasoning = {
            processQuery: jest.fn().mockResolvedValue({
                answer: 'Mock reasoning response',
                modelUsed: 'test-model',
                isLocal: true,
                cost: 0,
                tokensUsed: 100,
                stepsExecuted: 1,
                confidence: 0.85
            })
        };
        server.commandHandler = new CommonCommandHandler();
        server.costTracker = {
            getMetrics: jest.fn().mockResolvedValue({
                totalRequests: 10,
                localRequests: 8,
                apiRequests: 2,
                totalCost: 0.02,
                timeframe: 'day'
            })
        };
    }
});
