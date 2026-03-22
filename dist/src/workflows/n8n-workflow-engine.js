// N8n-Inspired Workflow Engine for LLM Task Orchestration
import { EventEmitter } from 'events';
export class N8nWorkflowEngine extends EventEmitter {
    workflows = new Map();
    executions = new Map();
    nodeTypes = new Map();
    activeWorkflows = new Set();
    executionQueue = [];
    isProcessing = false;
    executionCount = 0;
    constructor() {
        super();
        this.initializeBuiltInNodeTypes();
    }
    async initialize() {
        await this.loadWorkflows();
        await this.startActiveWorkflows();
        this.startExecutionProcessor();
        console.log('N8n Workflow Engine initialized');
    }
    // Workflow Management
    async createWorkflow(definition) {
        const workflowId = this.generateWorkflowId();
        const workflow = {
            id: workflowId,
            ...definition
        };
        // Validate workflow
        await this.validateWorkflow(workflow);
        this.workflows.set(workflowId, workflow);
        if (workflow.active) {
            await this.activateWorkflow(workflowId);
        }
        this.emit('workflowCreated', { workflowId, workflow });
        return workflowId;
    }
    async getWorkflow(workflowId) {
        return this.workflows.get(workflowId) || null;
    }
    async updateWorkflow(workflowId, updates) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }
        const updatedWorkflow = { ...workflow, ...updates };
        await this.validateWorkflow(updatedWorkflow);
        this.workflows.set(workflowId, updatedWorkflow);
        // Handle activation changes
        if (updates.active !== undefined) {
            if (updates.active) {
                await this.activateWorkflow(workflowId);
            }
            else {
                await this.deactivateWorkflow(workflowId);
            }
        }
        this.emit('workflowUpdated', { workflowId, workflow: updatedWorkflow });
    }
    async deleteWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow)
            return;
        await this.deactivateWorkflow(workflowId);
        this.workflows.delete(workflowId);
        // Clean up executions
        for (const [execId, execution] of this.executions) {
            if (execution.workflowId === workflowId) {
                this.executions.delete(execId);
            }
        }
        this.emit('workflowDeleted', { workflowId });
    }
    async activateWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }
        this.activeWorkflows.add(workflowId);
        workflow.active = true;
        // Setup triggers
        await this.setupWorkflowTriggers(workflow);
        this.emit('workflowActivated', { workflowId });
    }
    async deactivateWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow)
            return;
        this.activeWorkflows.delete(workflowId);
        workflow.active = false;
        // Remove triggers
        await this.removeWorkflowTriggers(workflow);
        this.emit('workflowDeactivated', { workflowId });
    }
    // Execution Management
    async executeWorkflow(workflowId, inputData, mode = 'manual') {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }
        const executionId = this.generateExecutionId();
        const execution = {
            id: executionId,
            workflowId,
            status: 'new',
            mode,
            startedAt: new Date(),
            finished: false,
            data: inputData,
            workflowData: workflow
        };
        this.executions.set(executionId, execution);
        this.executionQueue.push(execution);
        if (!this.isProcessing) {
            this.processExecutionQueue();
        }
        this.emit('executionStarted', { executionId, workflowId });
        return executionId;
    }
    async getExecution(executionId) {
        return this.executions.get(executionId) || null;
    }
    async getExecutions(workflowId, limit = 100) {
        const allExecutions = Array.from(this.executions.values());
        const filtered = workflowId
            ? allExecutions.filter(exec => exec.workflowId === workflowId)
            : allExecutions;
        return filtered
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
            .slice(0, limit);
    }
    async cancelExecution(executionId) {
        const execution = this.executions.get(executionId);
        if (!execution)
            return;
        execution.status = 'canceled';
        execution.stoppedAt = new Date();
        execution.finished = true;
        // Remove from queue if not yet processed
        const queueIndex = this.executionQueue.findIndex(exec => exec.id === executionId);
        if (queueIndex > -1) {
            this.executionQueue.splice(queueIndex, 1);
        }
        this.emit('executionCanceled', { executionId });
    }
    // Node Type Management
    registerNodeType(nodeType) {
        this.nodeTypes.set(nodeType.name, nodeType);
        this.emit('nodeTypeRegistered', { nodeType });
    }
    getNodeType(typeName) {
        return this.nodeTypes.get(typeName) || null;
    }
    getNodeTypes() {
        return Array.from(this.nodeTypes.values());
    }
    // LLM-Specific Methods
    async createLLMWorkflow(config) {
        const workflowDefinition = {
            name: config.name,
            active: config.autoActivate || false,
            nodes: this.buildLLMNodes(config),
            connections: this.buildLLMConnections(config),
            settings: {
                executionOrder: 'v1',
                saveManualExecutions: true,
                saveExecutionProgress: true,
                executionTimeout: config.timeout || 300000
            },
            tags: ['llm', 'ai', ...config.tags || []]
        };
        return await this.createWorkflow(workflowDefinition);
    }
    async executeLLMTask(task) {
        const workflowId = await this.createLLMWorkflow({
            name: `LLM Task: ${task.name}`,
            type: task.type,
            model: task.model,
            prompt: task.prompt,
            context: task.context,
            autoActivate: false,
            timeout: task.timeout
        });
        const executionId = await this.executeWorkflow(workflowId, task.inputData);
        // Wait for execution to complete
        const result = await this.waitForExecution(executionId);
        // Clean up temporary workflow
        await this.deleteWorkflow(workflowId);
        return {
            executionId,
            status: result.status,
            output: result.data,
            cost: this.calculateExecutionCost(result),
            duration: this.calculateExecutionDuration(result),
            tokensUsed: this.extractTokensUsed(result),
            model: task.model
        };
    }
    // Private Methods
    async processExecutionQueue() {
        if (this.isProcessing || this.executionQueue.length === 0)
            return;
        this.isProcessing = true;
        try {
            while (this.executionQueue.length > 0) {
                const execution = this.executionQueue.shift();
                await this.executeWorkflowInternal(execution);
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    async executeWorkflowInternal(execution) {
        execution.status = 'running';
        this.emit('executionStatusChanged', { executionId: execution.id, status: 'running' });
        try {
            const result = await this.runWorkflowNodes(execution);
            execution.status = 'success';
            execution.data = result;
            execution.stoppedAt = new Date();
            execution.finished = true;
            this.emit('executionCompleted', { executionId: execution.id, result });
        }
        catch (error) {
            execution.status = 'error';
            execution.data = { error: error.message };
            execution.stoppedAt = new Date();
            execution.finished = true;
            this.emit('executionError', { executionId: execution.id, error });
        }
    }
    async runWorkflowNodes(execution) {
        const workflow = execution.workflowData;
        const nodeExecutionStack = this.buildExecutionStack(workflow);
        const executionData = {};
        for (const node of nodeExecutionStack) {
            const nodeResult = await this.executeNode(node, executionData, execution);
            executionData[node.name] = nodeResult;
            // Handle node errors
            if (nodeResult.error && node.onError === 'stopWorkflow') {
                throw new Error(`Node ${node.name} failed: ${nodeResult.error}`);
            }
        }
        return executionData;
    }
    async executeNode(node, executionData, execution) {
        const nodeType = this.nodeTypes.get(node.type);
        if (!nodeType) {
            throw new Error(`Unknown node type: ${node.type}`);
        }
        // Simulate node execution based on type
        switch (node.type) {
            case 'n8n-nodes-base.llmChain':
                return await this.executeLLMChainNode(node, executionData);
            case 'n8n-nodes-base.httpRequest':
                return await this.executeHttpRequestNode(node, executionData);
            case 'n8n-nodes-base.set':
                return this.executeSetNode(node, executionData);
            case 'n8n-nodes-base.if':
                return this.executeIfNode(node, executionData);
            default:
                // Generic node execution
                return await this.executeGenericNode(node, executionData);
        }
    }
    buildExecutionStack(workflow) {
        // Build execution order based on connections (simplified)
        const visited = new Set();
        const stack = [];
        // Start with trigger nodes
        const triggerNodes = workflow.nodes.filter(node => node.type.includes('trigger') || node.type.includes('webhook'));
        for (const triggerNode of triggerNodes) {
            this.traverseNodes(workflow, triggerNode, visited, stack);
        }
        // Add any remaining nodes
        for (const node of workflow.nodes) {
            if (!visited.has(node.name)) {
                stack.push(node);
            }
        }
        return stack;
    }
    traverseNodes(workflow, node, visited, stack) {
        if (visited.has(node.name))
            return;
        visited.add(node.name);
        stack.push(node);
        // Add connected nodes
        const connections = workflow.connections[node.name] || {};
        for (const outputType of Object.keys(connections)) {
            for (const connection of connections[outputType] || []) {
                for (const targetConnection of connection) {
                    const targetNode = workflow.nodes.find(n => n.name === targetConnection.node);
                    if (targetNode) {
                        this.traverseNodes(workflow, targetNode, visited, stack);
                    }
                }
            }
        }
    }
    buildLLMNodes(config) {
        const nodes = [];
        // Start node
        nodes.push({
            id: 'start',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
        });
        // LLM Chain node
        nodes.push({
            id: 'llm',
            name: 'LLM',
            type: 'n8n-nodes-base.llmChain',
            typeVersion: 1,
            position: [450, 300],
            parameters: {
                model: config.model,
                prompt: config.prompt,
                temperature: config.temperature || 0.7,
                maxTokens: config.maxTokens || 1000
            }
        });
        // Set result node
        nodes.push({
            id: 'result',
            name: 'Result',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [650, 300],
            parameters: {
                values: {
                    output: '={{ $json.response }}',
                    model: config.model,
                    timestamp: '={{ $now }}'
                }
            }
        });
        return nodes;
    }
    buildLLMConnections(config) {
        return {
            'Start': {
                main: [[{ node: 'LLM', type: 'main', index: 0 }]]
            },
            'LLM': {
                main: [[{ node: 'Result', type: 'main', index: 0 }]]
            }
        };
    }
    initializeBuiltInNodeTypes() {
        // Register basic node types
        const nodeTypes = [
            {
                displayName: 'Start',
                name: 'n8n-nodes-base.start',
                icon: 'fa:play',
                group: ['trigger'],
                version: 1,
                description: 'Starts the workflow',
                defaults: { name: 'Start', color: '#00FF00' },
                inputs: [],
                outputs: [{ displayName: 'Output', type: 'main' }],
                properties: []
            },
            {
                displayName: 'LLM Chain',
                name: 'n8n-nodes-base.llmChain',
                icon: 'fa:brain',
                group: ['ai'],
                version: 1,
                description: 'Execute LLM requests',
                defaults: { name: 'LLM Chain', color: '#FF6600' },
                inputs: [{ displayName: 'Input', type: 'main' }],
                outputs: [{ displayName: 'Output', type: 'main' }],
                properties: [
                    {
                        displayName: 'Model',
                        name: 'model',
                        type: 'string',
                        default: 'claude-3-sonnet',
                        required: true
                    },
                    {
                        displayName: 'Prompt',
                        name: 'prompt',
                        type: 'string',
                        default: '',
                        required: true
                    }
                ]
            },
            {
                displayName: 'Set',
                name: 'n8n-nodes-base.set',
                icon: 'fa:pen',
                group: ['transform'],
                version: 1,
                description: 'Set node values',
                defaults: { name: 'Set', color: '#0000FF' },
                inputs: [{ displayName: 'Input', type: 'main' }],
                outputs: [{ displayName: 'Output', type: 'main' }],
                properties: []
            }
        ];
        for (const nodeType of nodeTypes) {
            this.registerNodeType(nodeType);
        }
    }
    // Node execution methods (simplified implementations)
    async executeLLMChainNode(node, executionData) {
        // Simulate LLM execution
        return {
            response: `LLM response for: ${node.parameters.prompt}`,
            model: node.parameters.model,
            tokens: 150
        };
    }
    async executeHttpRequestNode(node, executionData) {
        // Simulate HTTP request
        return { status: 200, data: 'HTTP response' };
    }
    executeSetNode(node, executionData) {
        return { ...node.parameters.values };
    }
    executeIfNode(node, executionData) {
        // Simulate conditional logic
        return { condition: true };
    }
    async executeGenericNode(node, executionData) {
        // Generic node execution
        return { nodeType: node.type, parameters: node.parameters };
    }
    // Utility methods
    generateWorkflowId() {
        return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async validateWorkflow(workflow) {
        // Basic workflow validation
        if (!workflow.name) {
            throw new Error('Workflow name is required');
        }
        if (!workflow.nodes || workflow.nodes.length === 0) {
            throw new Error('Workflow must have at least one node');
        }
        // Validate node types exist
        for (const node of workflow.nodes) {
            if (!this.nodeTypes.has(node.type)) {
                throw new Error(`Unknown node type: ${node.type}`);
            }
        }
    }
    async setupWorkflowTriggers(workflow) {
        // Setup triggers for active workflows
        const triggerNodes = workflow.nodes.filter(node => node.type.includes('trigger') || node.type.includes('webhook'));
        for (const triggerNode of triggerNodes) {
            // Setup trigger based on type
            console.log(`Setting up trigger for ${triggerNode.type}`);
        }
    }
    async removeWorkflowTriggers(workflow) {
        // Remove triggers when deactivating workflows
        console.log(`Removing triggers for workflow ${workflow.id}`);
    }
    async loadWorkflows() {
        // Load existing workflows from storage
        console.log('Loading workflows from storage');
    }
    async startActiveWorkflows() {
        for (const [id, workflow] of this.workflows) {
            if (workflow.active) {
                await this.activateWorkflow(id);
            }
        }
    }
    startExecutionProcessor() {
        // Start background processor for execution queue
        setInterval(() => {
            if (!this.isProcessing && this.executionQueue.length > 0) {
                this.processExecutionQueue();
            }
        }, 1000);
    }
    async waitForExecution(executionId) {
        return new Promise((resolve) => {
            const checkExecution = () => {
                const execution = this.executions.get(executionId);
                if (execution && execution.finished) {
                    resolve(execution);
                }
                else {
                    setTimeout(checkExecution, 100);
                }
            };
            checkExecution();
        });
    }
    calculateExecutionCost(execution) {
        // Calculate cost based on execution data
        return 0.01; // Placeholder
    }
    calculateExecutionDuration(execution) {
        if (!execution.stoppedAt)
            return 0;
        return execution.stoppedAt.getTime() - execution.startedAt.getTime();
    }
    extractTokensUsed(execution) {
        // Extract token usage from execution data
        return 0; // Placeholder
    }
    async cleanup() {
        // Deactivate all workflows
        for (const workflowId of this.activeWorkflows) {
            await this.deactivateWorkflow(workflowId);
        }
        // Cancel running executions
        for (const execution of this.executions.values()) {
            if (execution.status === 'running') {
                await this.cancelExecution(execution.id);
            }
        }
        console.log('N8n Workflow Engine cleaned up');
    }
}
