// Comprehensive tests for N8n Workflow Engine
import { N8nWorkflowEngine } from '../../../src/workflows/n8n-workflow-engine';
describe('N8nWorkflowEngine', () => {
    let engine;
    let mockWorkflow;
    beforeEach(async () => {
        engine = new N8nWorkflowEngine();
        await engine.initialize();
        mockWorkflow = {
            name: 'Test Workflow',
            active: false,
            nodes: [
                {
                    id: 'start',
                    name: 'Start',
                    type: 'n8n-nodes-base.start',
                    typeVersion: 1,
                    position: [250, 300],
                    parameters: {}
                },
                {
                    id: 'llm',
                    name: 'LLM',
                    type: 'n8n-nodes-base.llmChain',
                    typeVersion: 1,
                    position: [450, 300],
                    parameters: {
                        model: 'claude-3-sonnet',
                        prompt: 'Test prompt'
                    }
                }
            ],
            connections: {
                'Start': {
                    main: [[{ node: 'LLM', type: 'main', index: 0 }]]
                }
            },
            settings: {
                executionOrder: 'v1',
                saveManualExecutions: true
            }
        };
    });
    afterEach(async () => {
        await engine.cleanup();
    });
    describe('Workflow Management', () => {
        test('should create a new workflow', async () => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            expect(workflowId).toBeTruthy();
            expect(workflowId).toMatch(/^workflow_/);
            const retrievedWorkflow = await engine.getWorkflow(workflowId);
            expect(retrievedWorkflow).toBeTruthy();
            expect(retrievedWorkflow.name).toBe('Test Workflow');
            expect(retrievedWorkflow.nodes).toHaveLength(2);
        });
        test('should validate workflow before creation', async () => {
            const invalidWorkflow = {
                ...mockWorkflow,
                name: '' // Invalid: empty name
            };
            await expect(engine.createWorkflow(invalidWorkflow)).rejects.toThrow('Workflow name is required');
        });
        test('should update existing workflow', async () => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            await engine.updateWorkflow(workflowId, {
                name: 'Updated Workflow',
                active: true
            });
            const updatedWorkflow = await engine.getWorkflow(workflowId);
            expect(updatedWorkflow.name).toBe('Updated Workflow');
            expect(updatedWorkflow.active).toBe(true);
        });
        test('should delete workflow and cleanup executions', async () => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            const executionId = await engine.executeWorkflow(workflowId);
            await engine.deleteWorkflow(workflowId);
            const deletedWorkflow = await engine.getWorkflow(workflowId);
            expect(deletedWorkflow).toBeNull();
            const deletedExecution = await engine.getExecution(executionId);
            expect(deletedExecution).toBeNull();
        });
        test('should activate workflow and setup triggers', async () => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            await engine.activateWorkflow(workflowId);
            const workflow = await engine.getWorkflow(workflowId);
            expect(workflow.active).toBe(true);
        });
        test('should deactivate workflow and remove triggers', async () => {
            const workflowId = await engine.createWorkflow({ ...mockWorkflow, active: true });
            await engine.deactivateWorkflow(workflowId);
            const workflow = await engine.getWorkflow(workflowId);
            expect(workflow.active).toBe(false);
        });
    });
    describe('Execution Management', () => {
        let workflowId;
        beforeEach(async () => {
            workflowId = await engine.createWorkflow(mockWorkflow);
        });
        test('should execute workflow and return execution ID', async () => {
            const executionId = await engine.executeWorkflow(workflowId);
            expect(executionId).toBeTruthy();
            expect(executionId).toMatch(/^exec_/);
            const execution = await engine.getExecution(executionId);
            expect(execution).toBeTruthy();
            expect(execution.workflowId).toBe(workflowId);
            expect(execution.status).toBe('new');
        });
        test('should execute workflow with input data', async () => {
            const inputData = { message: 'Test input' };
            const executionId = await engine.executeWorkflow(workflowId, inputData);
            const execution = await engine.getExecution(executionId);
            expect(execution.data).toEqual(inputData);
        });
        test('should process execution queue', async (done) => {
            const executionId = await engine.executeWorkflow(workflowId);
            // Wait for execution to complete
            setTimeout(async () => {
                const execution = await engine.getExecution(executionId);
                expect(execution.status).toBeOneOf(['success', 'error']);
                expect(execution.finished).toBe(true);
                expect(execution.stoppedAt).toBeTruthy();
                done();
            }, 100);
        });
        test('should cancel running execution', async () => {
            const executionId = await engine.executeWorkflow(workflowId);
            await engine.cancelExecution(executionId);
            const execution = await engine.getExecution(executionId);
            expect(execution.status).toBe('canceled');
            expect(execution.finished).toBe(true);
        });
        test('should get executions with optional workflow filter', async () => {
            const execution1 = await engine.executeWorkflow(workflowId);
            const execution2 = await engine.executeWorkflow(workflowId);
            const allExecutions = await engine.getExecutions();
            expect(allExecutions.length).toBeGreaterThanOrEqual(2);
            const workflowExecutions = await engine.getExecutions(workflowId);
            expect(workflowExecutions.length).toBeGreaterThanOrEqual(2);
            expect(workflowExecutions.every(exec => exec.workflowId === workflowId)).toBe(true);
        });
        test('should limit execution results', async () => {
            // Create multiple executions
            for (let i = 0; i < 5; i++) {
                await engine.executeWorkflow(workflowId);
            }
            const executions = await engine.getExecutions(undefined, 3);
            expect(executions).toHaveLength(3);
        });
    });
    describe('Node Type Management', () => {
        test('should register new node type', () => {
            const mockNodeType = {
                displayName: 'Test Node',
                name: 'test-node',
                icon: 'fa:test',
                group: ['test'],
                version: 1,
                description: 'Test node type',
                defaults: { name: 'Test Node', color: '#FF0000' },
                inputs: [{ displayName: 'Input', type: 'main' }],
                outputs: [{ displayName: 'Output', type: 'main' }],
                properties: []
            };
            engine.registerNodeType(mockNodeType);
            const retrievedNodeType = engine.getNodeType('test-node');
            expect(retrievedNodeType).toEqual(mockNodeType);
        });
        test('should get all registered node types', () => {
            const nodeTypes = engine.getNodeTypes();
            expect(nodeTypes).toBeInstanceOf(Array);
            expect(nodeTypes.length).toBeGreaterThan(0);
            // Should include built-in types
            const startNode = nodeTypes.find(nt => nt.name === 'n8n-nodes-base.start');
            expect(startNode).toBeTruthy();
        });
        test('should return null for non-existent node type', () => {
            const nonExistentType = engine.getNodeType('non-existent-node');
            expect(nonExistentType).toBeNull();
        });
    });
    describe('LLM-Specific Methods', () => {
        test('should create LLM workflow from config', async () => {
            const config = {
                name: 'LLM Test Workflow',
                type: 'reasoning',
                model: 'claude-3-sonnet',
                prompt: 'Analyze this data',
                context: 'Test context',
                autoActivate: false,
                timeout: 300000,
                tags: ['test', 'llm']
            };
            const workflowId = await engine.createLLMWorkflow(config);
            const workflow = await engine.getWorkflow(workflowId);
            expect(workflow).toBeTruthy();
            expect(workflow.name).toBe('LLM Test Workflow');
            expect(workflow.tags).toContain('llm');
            expect(workflow.tags).toContain('ai');
            expect(workflow.tags).toContain('test');
        });
        test('should execute LLM task and return result', async () => {
            const task = {
                name: 'Test LLM Task',
                type: 'reasoning',
                model: 'claude-3-sonnet',
                prompt: 'What is 2+2?',
                context: 'Math question',
                inputData: { question: 'What is 2+2?' },
                timeout: 30000
            };
            const result = await engine.executeLLMTask(task);
            expect(result).toBeTruthy();
            expect(result.executionId).toBeTruthy();
            expect(result.status).toBeOneOf(['success', 'error']);
            expect(result.model).toBe('claude-3-sonnet');
            expect(typeof result.cost).toBe('number');
            expect(typeof result.duration).toBe('number');
            expect(typeof result.tokensUsed).toBe('number');
        });
        test('should cleanup temporary workflow after LLM task', async () => {
            const initialWorkflows = (await Promise.all(Array.from({ length: 100 }, (_, i) => engine.getWorkflow(`workflow_${i}`)))).filter(Boolean);
            const task = {
                name: 'Test Cleanup',
                type: 'reasoning',
                model: 'claude-3-sonnet',
                prompt: 'Test prompt',
                timeout: 5000
            };
            await engine.executeLLMTask(task);
            // Workflow should be cleaned up after execution
            const finalWorkflows = (await Promise.all(Array.from({ length: 100 }, (_, i) => engine.getWorkflow(`workflow_${i}`)))).filter(Boolean);
            expect(finalWorkflows.length).toBe(initialWorkflows.length);
        });
    });
    describe('Error Handling', () => {
        test('should handle workflow not found error', async () => {
            await expect(engine.getWorkflow('non-existent-id')).resolves.toBeNull();
        });
        test('should handle execution of non-existent workflow', async () => {
            await expect(engine.executeWorkflow('non-existent-id')).rejects.toThrow('Workflow non-existent-id not found');
        });
        test('should handle workflow validation errors', async () => {
            const invalidWorkflow = {
                name: 'Invalid Workflow',
                active: false,
                nodes: [], // Empty nodes array
                connections: {}
            };
            await expect(engine.createWorkflow(invalidWorkflow)).rejects.toThrow('Workflow must have at least one node');
        });
        test('should handle unknown node type in workflow', async () => {
            const workflowWithUnknownNode = {
                ...mockWorkflow,
                nodes: [
                    ...mockWorkflow.nodes,
                    {
                        id: 'unknown',
                        name: 'Unknown',
                        type: 'unknown-node-type',
                        typeVersion: 1,
                        position: [650, 300],
                        parameters: {}
                    }
                ]
            };
            await expect(engine.createWorkflow(workflowWithUnknownNode)).rejects.toThrow('Unknown node type: unknown-node-type');
        });
    });
    describe('Event Emission', () => {
        test('should emit workflowCreated event', async (done) => {
            engine.once('workflowCreated', (event) => {
                expect(event.workflowId).toBeTruthy();
                expect(event.workflow.name).toBe('Test Workflow');
                done();
            });
            await engine.createWorkflow(mockWorkflow);
        });
        test('should emit workflowUpdated event', async (done) => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            engine.once('workflowUpdated', (event) => {
                expect(event.workflowId).toBe(workflowId);
                expect(event.workflow.name).toBe('Updated Name');
                done();
            });
            await engine.updateWorkflow(workflowId, { name: 'Updated Name' });
        });
        test('should emit executionStarted event', async (done) => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            engine.once('executionStarted', (event) => {
                expect(event.executionId).toBeTruthy();
                expect(event.workflowId).toBe(workflowId);
                done();
            });
            await engine.executeWorkflow(workflowId);
        });
        test('should emit nodeTypeRegistered event', (done) => {
            const mockNodeType = {
                displayName: 'Event Test Node',
                name: 'event-test-node',
                icon: 'fa:test',
                group: ['test'],
                version: 1,
                description: 'Test node for events',
                defaults: { name: 'Event Test', color: '#00FF00' },
                inputs: [],
                outputs: [],
                properties: []
            };
            engine.once('nodeTypeRegistered', (event) => {
                expect(event.nodeType.name).toBe('event-test-node');
                done();
            });
            engine.registerNodeType(mockNodeType);
        });
    });
    describe('Workflow Execution Logic', () => {
        test('should build correct execution stack', async () => {
            const complexWorkflow = {
                name: 'Complex Workflow',
                active: false,
                nodes: [
                    {
                        id: 'trigger',
                        name: 'Trigger',
                        type: 'n8n-nodes-base.webhook',
                        typeVersion: 1,
                        position: [100, 300],
                        parameters: {}
                    },
                    {
                        id: 'condition',
                        name: 'Condition',
                        type: 'n8n-nodes-base.if',
                        typeVersion: 1,
                        position: [300, 300],
                        parameters: {}
                    },
                    {
                        id: 'action1',
                        name: 'Action1',
                        type: 'n8n-nodes-base.set',
                        typeVersion: 1,
                        position: [500, 200],
                        parameters: {}
                    },
                    {
                        id: 'action2',
                        name: 'Action2',
                        type: 'n8n-nodes-base.set',
                        typeVersion: 1,
                        position: [500, 400],
                        parameters: {}
                    }
                ],
                connections: {
                    'Trigger': {
                        main: [[{ node: 'Condition', type: 'main', index: 0 }]]
                    },
                    'Condition': {
                        main: [
                            [{ node: 'Action1', type: 'main', index: 0 }],
                            [{ node: 'Action2', type: 'main', index: 0 }]
                        ]
                    }
                }
            };
            const workflowId = await engine.createWorkflow(complexWorkflow);
            const executionId = await engine.executeWorkflow(workflowId);
            // Wait for execution to process
            await new Promise(resolve => setTimeout(resolve, 200));
            const execution = await engine.getExecution(executionId);
            expect(execution.status).toBeOneOf(['success', 'error']);
        });
        test('should handle node execution errors gracefully', async () => {
            const workflowWithErrorNode = {
                name: 'Error Workflow',
                active: false,
                nodes: [
                    {
                        id: 'start',
                        name: 'Start',
                        type: 'n8n-nodes-base.start',
                        typeVersion: 1,
                        position: [250, 300],
                        parameters: {}
                    },
                    {
                        id: 'error-node',
                        name: 'ErrorNode',
                        type: 'n8n-nodes-base.httpRequest',
                        typeVersion: 1,
                        position: [450, 300],
                        parameters: {
                            url: 'invalid-url',
                            method: 'GET'
                        },
                        onError: 'stopWorkflow'
                    }
                ],
                connections: {
                    'Start': {
                        main: [[{ node: 'ErrorNode', type: 'main', index: 0 }]]
                    }
                }
            };
            const workflowId = await engine.createWorkflow(workflowWithErrorNode);
            const executionId = await engine.executeWorkflow(workflowId);
            // Wait for execution to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            const execution = await engine.getExecution(executionId);
            expect(execution.status).toBe('error');
            expect(execution.finished).toBe(true);
        });
    });
    describe('Performance and Memory Management', () => {
        test('should handle multiple concurrent executions', async () => {
            const workflowId = await engine.createWorkflow(mockWorkflow);
            const executionPromises = [];
            // Start multiple executions concurrently
            for (let i = 0; i < 10; i++) {
                executionPromises.push(engine.executeWorkflow(workflowId, { iteration: i }));
            }
            const executionIds = await Promise.all(executionPromises);
            expect(executionIds).toHaveLength(10);
            expect(new Set(executionIds).size).toBe(10); // All IDs should be unique
            // Wait for all executions to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            // Verify all executions completed
            const executions = await Promise.all(executionIds.map(id => engine.getExecution(id)));
            executions.forEach(execution => {
                expect(execution).toBeTruthy();
                expect(execution.finished).toBe(true);
                expect(execution.status).toBeOneOf(['success', 'error', 'canceled']);
            });
        });
        test('should cleanup resources properly', async () => {
            const initialNodeTypes = engine.getNodeTypes().length;
            // Create and delete multiple workflows
            for (let i = 0; i < 5; i++) {
                const workflowId = await engine.createWorkflow({
                    ...mockWorkflow,
                    name: `Cleanup Test ${i}`
                });
                await engine.executeWorkflow(workflowId);
                await engine.deleteWorkflow(workflowId);
            }
            await engine.cleanup();
            // Verify node types are still available (they should persist)
            const finalNodeTypes = engine.getNodeTypes().length;
            expect(finalNodeTypes).toBe(initialNodeTypes);
        });
    });
});
// Helper function for toBeOneOf matcher
expect.extend({
    toBeOneOf(received, validOptions) {
        const pass = validOptions.includes(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${validOptions}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be one of ${validOptions}`,
                pass: false,
            };
        }
    },
});
