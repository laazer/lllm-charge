// N8n-Inspired Workflow Engine for LLM Task Orchestration
import { EventEmitter } from 'events'
import { IWorkflowBase, IConnections, INodeExecutionData, IWorkflowExecuteAdditionalData } from './types'

export interface WorkflowNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: Record<string, any>
  credentials?: Record<string, string>
  disabled?: boolean
  notes?: string
  color?: string
  webhookId?: string
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput'
  continueOnFail?: boolean
  alwaysOutputData?: boolean
  executeOnce?: boolean
  retryOnFail?: boolean
  maxTries?: number
  waitBetweenTries?: number
}

export interface WorkflowConnection {
  node: string
  type: string
  index: number
}

export interface WorkflowDefinition extends IWorkflowBase {
  id?: string
  name: string
  active: boolean
  nodes: WorkflowNode[]
  connections: IConnections
  settings?: WorkflowSettings
  staticData?: any
  tags?: string[]
  triggerCount?: number
  versionId?: string
  meta?: WorkflowMeta
}

export interface WorkflowSettings {
  executionOrder?: 'v0' | 'v1'
  saveManualExecutions?: boolean
  saveExecutionProgress?: boolean
  saveDataErrorExecution?: 'all' | 'none'
  saveDataSuccessExecution?: 'all' | 'none'
  callerPolicy?: 'workflowsFromSameOwner' | 'workflowsFromAList' | 'any'
  callerIds?: string
  errorWorkflow?: string
  timezone?: string
  executionTimeout?: number
}

export interface WorkflowMeta {
  instanceId?: string
  templateId?: string
  templateCredsSetupCompleted?: boolean
  onboardingId?: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  mode: ExecutionMode
  startedAt: Date
  stoppedAt?: Date
  finished: boolean
  data?: any
  customData?: Record<string, any>
  workflowData?: WorkflowDefinition
}

export interface ExecutionData {
  resultData: {
    runData: any
    pinData?: any
    lastNodeExecuted?: string
    error?: ExecutionError
  }
  executionData?: {
    contextData: any
    nodeExecutionStack: any[]
    metadata: any
    waitingExecution: any
    waitingExecutionSource: any
  }
}

export interface ExecutionError {
  name: string
  message: string
  stack?: string
  node?: {
    name: string
    type: string
    index?: number
  }
  cause?: ExecutionError
  context?: any
  lineNumber?: number
  timestamp?: Date
}

export interface NodeType {
  displayName: string
  name: string
  icon: string
  iconUrl?: string
  group: string[]
  version: number | number[]
  description: string
  subtitle?: string
  defaults: {
    name: string
    color: string
  }
  inputs: NodeTypeInput[]
  outputs: NodeTypeOutput[]
  properties: NodeProperty[]
  credentials?: NodeCredential[]
  supportsCORS?: boolean
  polling?: boolean
  triggerPanel?: {
    header?: string
    executionsHelp?: {
      active?: string
      inactive?: string
    }
    activationHint?: string
  }
  codex?: {
    resources?: {
      primaryDocumentation?: Array<{
        url: string
      }>
    }
    alias?: string[]
  }
}

export interface NodeTypeInput {
  displayName: string
  type: 'main'
  required?: boolean
}

export interface NodeTypeOutput {
  displayName: string
  type: 'main'
}

export interface NodeProperty {
  displayName: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'collection' | 'fixedCollection' | 'multiOptions' | 'options' | 'dateTime' | 'color' | 'json' | 'notice' | 'hidden' | 'resourceLocator' | 'curlImport' | 'credentialsSelect'
  required?: boolean
  default?: any
  description?: string
  placeholder?: string
  hint?: string
  displayOptions?: {
    show?: Record<string, any[]>
    hide?: Record<string, any[]>
  }
  options?: Array<{
    name: string
    value: string | number | boolean
    description?: string
  }>
  routing?: {
    request?: {
      method?: string
      url?: string
      headers?: Record<string, string>
      body?: any
    }
    output?: {
      postReceive?: any[]
    }
  }
}

export interface NodeCredential {
  name: string
  required?: boolean
  displayOptions?: {
    show?: Record<string, any[]>
    hide?: Record<string, any[]>
  }
}

export type ExecutionStatus = 'new' | 'running' | 'success' | 'error' | 'canceled' | 'waiting' | 'unknown'
export type ExecutionMode = 'cli' | 'error' | 'integrated' | 'internal' | 'manual' | 'retry' | 'trigger' | 'webhook'

export class N8nWorkflowEngine extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private executions: Map<string, WorkflowExecution> = new Map()
  private nodeTypes: Map<string, NodeType> = new Map()
  private activeWorkflows: Set<string> = new Set()
  private executionQueue: WorkflowExecution[] = []
  private isProcessing = false
  private executionCount = 0

  constructor() {
    super()
    this.initializeBuiltInNodeTypes()
  }

  async initialize(): Promise<void> {
    await this.loadWorkflows()
    await this.startActiveWorkflows()
    this.startExecutionProcessor()
    console.log('N8n Workflow Engine initialized')
  }

  // Workflow Management
  async createWorkflow(definition: Omit<WorkflowDefinition, 'id'>): Promise<string> {
    const workflowId = this.generateWorkflowId()
    const workflow: WorkflowDefinition = {
      id: workflowId,
      ...definition
    }

    // Validate workflow
    await this.validateWorkflow(workflow)

    this.workflows.set(workflowId, workflow)
    
    if (workflow.active) {
      await this.activateWorkflow(workflowId)
    }

    this.emit('workflowCreated', { workflowId, workflow })
    return workflowId
  }

  async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
    return this.workflows.get(workflowId) || null
  }

  async updateWorkflow(workflowId: string, updates: Partial<WorkflowDefinition>): Promise<void> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    const updatedWorkflow = { ...workflow, ...updates }
    await this.validateWorkflow(updatedWorkflow)

    this.workflows.set(workflowId, updatedWorkflow)

    // Handle activation changes
    if (updates.active !== undefined) {
      if (updates.active) {
        await this.activateWorkflow(workflowId)
      } else {
        await this.deactivateWorkflow(workflowId)
      }
    }

    this.emit('workflowUpdated', { workflowId, workflow: updatedWorkflow })
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) return

    await this.deactivateWorkflow(workflowId)
    this.workflows.delete(workflowId)

    // Clean up executions
    for (const [execId, execution] of this.executions) {
      if (execution.workflowId === workflowId) {
        this.executions.delete(execId)
      }
    }

    this.emit('workflowDeleted', { workflowId })
  }

  async activateWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    this.activeWorkflows.add(workflowId)
    workflow.active = true

    // Setup triggers
    await this.setupWorkflowTriggers(workflow)

    this.emit('workflowActivated', { workflowId })
  }

  async deactivateWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) return

    this.activeWorkflows.delete(workflowId)
    workflow.active = false

    // Remove triggers
    await this.removeWorkflowTriggers(workflow)

    this.emit('workflowDeactivated', { workflowId })
  }

  // Execution Management
  async executeWorkflow(
    workflowId: string, 
    inputData?: any, 
    mode: ExecutionMode = 'manual'
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    const executionId = this.generateExecutionId()
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'new',
      mode,
      startedAt: new Date(),
      finished: false,
      data: inputData,
      workflowData: workflow
    }

    this.executions.set(executionId, execution)
    this.executionQueue.push(execution)

    if (!this.isProcessing) {
      this.processExecutionQueue()
    }

    this.emit('executionStarted', { executionId, workflowId })
    return executionId
  }

  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null
  }

  async getExecutions(workflowId?: string, limit = 100): Promise<WorkflowExecution[]> {
    const allExecutions = Array.from(this.executions.values())
    
    const filtered = workflowId 
      ? allExecutions.filter(exec => exec.workflowId === workflowId)
      : allExecutions

    return filtered
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit)
  }

  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) return

    execution.status = 'canceled'
    execution.stoppedAt = new Date()
    execution.finished = true

    // Remove from queue if not yet processed
    const queueIndex = this.executionQueue.findIndex(exec => exec.id === executionId)
    if (queueIndex > -1) {
      this.executionQueue.splice(queueIndex, 1)
    }

    this.emit('executionCanceled', { executionId })
  }

  // Node Type Management
  registerNodeType(nodeType: NodeType): void {
    this.nodeTypes.set(nodeType.name, nodeType)
    this.emit('nodeTypeRegistered', { nodeType })
  }

  getNodeType(typeName: string): NodeType | null {
    return this.nodeTypes.get(typeName) || null
  }

  getNodeTypes(): NodeType[] {
    return Array.from(this.nodeTypes.values())
  }

  // LLM-Specific Methods
  async createLLMWorkflow(config: LLMWorkflowConfig): Promise<string> {
    const workflowDefinition: Omit<WorkflowDefinition, 'id'> = {
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
    }

    return await this.createWorkflow(workflowDefinition)
  }

  async executeLLMTask(task: LLMTask): Promise<LLMTaskResult> {
    const workflowId = await this.createLLMWorkflow({
      name: `LLM Task: ${task.name}`,
      type: task.type,
      model: task.model,
      prompt: task.prompt,
      context: task.context,
      autoActivate: false,
      timeout: task.timeout
    })

    const executionId = await this.executeWorkflow(workflowId, task.inputData)
    
    // Wait for execution to complete
    const result = await this.waitForExecution(executionId)
    
    // Clean up temporary workflow
    await this.deleteWorkflow(workflowId)
    
    return {
      executionId,
      status: result.status,
      output: result.data,
      cost: this.calculateExecutionCost(result),
      duration: this.calculateExecutionDuration(result),
      tokensUsed: this.extractTokensUsed(result),
      model: task.model
    }
  }

  // Private Methods
  private async processExecutionQueue(): Promise<void> {
    if (this.isProcessing || this.executionQueue.length === 0) return

    this.isProcessing = true

    try {
      while (this.executionQueue.length > 0) {
        const execution = this.executionQueue.shift()!
        await this.executeWorkflowInternal(execution)
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async executeWorkflowInternal(execution: WorkflowExecution): Promise<void> {
    execution.status = 'running'
    this.emit('executionStatusChanged', { executionId: execution.id, status: 'running' })

    try {
      const result = await this.runWorkflowNodes(execution)
      
      execution.status = 'success'
      execution.data = result
      execution.stoppedAt = new Date()
      execution.finished = true

      this.emit('executionCompleted', { executionId: execution.id, result })
    } catch (error) {
      execution.status = 'error'
      execution.data = { error: error.message }
      execution.stoppedAt = new Date()
      execution.finished = true

      this.emit('executionError', { executionId: execution.id, error })
    }
  }

  private async runWorkflowNodes(execution: WorkflowExecution): Promise<any> {
    const workflow = execution.workflowData!
    const nodeExecutionStack = this.buildExecutionStack(workflow)
    const executionData: Record<string, any> = {}

    for (const node of nodeExecutionStack) {
      const nodeResult = await this.executeNode(node, executionData, execution)
      executionData[node.name] = nodeResult

      // Handle node errors
      if (nodeResult.error && node.onError === 'stopWorkflow') {
        throw new Error(`Node ${node.name} failed: ${nodeResult.error}`)
      }
    }

    return executionData
  }

  private async executeNode(
    node: WorkflowNode, 
    executionData: Record<string, any>,
    execution: WorkflowExecution
  ): Promise<any> {
    const nodeType = this.nodeTypes.get(node.type)
    if (!nodeType) {
      throw new Error(`Unknown node type: ${node.type}`)
    }

    // Simulate node execution based on type
    switch (node.type) {
      case 'n8n-nodes-base.llmChain':
        return await this.executeLLMChainNode(node, executionData)
      case 'n8n-nodes-base.httpRequest':
        return await this.executeHttpRequestNode(node, executionData)
      case 'n8n-nodes-base.set':
        return this.executeSetNode(node, executionData)
      case 'n8n-nodes-base.if':
        return this.executeIfNode(node, executionData)
      default:
        // Generic node execution
        return await this.executeGenericNode(node, executionData)
    }
  }

  private buildExecutionStack(workflow: WorkflowDefinition): WorkflowNode[] {
    // Build execution order based on connections (simplified)
    const visited = new Set<string>()
    const stack: WorkflowNode[] = []
    
    // Start with trigger nodes
    const triggerNodes = workflow.nodes.filter(node => 
      node.type.includes('trigger') || node.type.includes('webhook')
    )
    
    for (const triggerNode of triggerNodes) {
      this.traverseNodes(workflow, triggerNode, visited, stack)
    }
    
    // Add any remaining nodes
    for (const node of workflow.nodes) {
      if (!visited.has(node.name)) {
        stack.push(node)
      }
    }
    
    return stack
  }

  private traverseNodes(
    workflow: WorkflowDefinition,
    node: WorkflowNode,
    visited: Set<string>,
    stack: WorkflowNode[]
  ): void {
    if (visited.has(node.name)) return

    visited.add(node.name)
    stack.push(node)

    // Add connected nodes
    const connections = workflow.connections[node.name] || {}
    for (const outputType of Object.keys(connections)) {
      for (const connection of connections[outputType] || []) {
        for (const targetConnection of connection) {
          const targetNode = workflow.nodes.find(n => n.name === targetConnection.node)
          if (targetNode) {
            this.traverseNodes(workflow, targetNode, visited, stack)
          }
        }
      }
    }
  }

  private buildLLMNodes(config: LLMWorkflowConfig): WorkflowNode[] {
    const nodes: WorkflowNode[] = []

    // Start node
    nodes.push({
      id: 'start',
      name: 'Start',
      type: 'n8n-nodes-base.start',
      typeVersion: 1,
      position: [250, 300],
      parameters: {}
    })

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
    })

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
    })

    return nodes
  }

  private buildLLMConnections(config: LLMWorkflowConfig): IConnections {
    return {
      'Start': {
        main: [[{ node: 'LLM', type: 'main', index: 0 }]]
      },
      'LLM': {
        main: [[{ node: 'Result', type: 'main', index: 0 }]]
      }
    }
  }

  private initializeBuiltInNodeTypes(): void {
    // Register basic node types
    const nodeTypes: NodeType[] = [
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
    ]

    for (const nodeType of nodeTypes) {
      this.registerNodeType(nodeType)
    }
  }

  // Node execution methods (simplified implementations)
  private async executeLLMChainNode(node: WorkflowNode, executionData: Record<string, any>): Promise<any> {
    // Simulate LLM execution
    return {
      response: `LLM response for: ${node.parameters.prompt}`,
      model: node.parameters.model,
      tokens: 150
    }
  }

  private async executeHttpRequestNode(node: WorkflowNode, executionData: Record<string, any>): Promise<any> {
    // Simulate HTTP request
    return { status: 200, data: 'HTTP response' }
  }

  private executeSetNode(node: WorkflowNode, executionData: Record<string, any>): any {
    return { ...node.parameters.values }
  }

  private executeIfNode(node: WorkflowNode, executionData: Record<string, any>): any {
    // Simulate conditional logic
    return { condition: true }
  }

  private async executeGenericNode(node: WorkflowNode, executionData: Record<string, any>): Promise<any> {
    // Generic node execution
    return { nodeType: node.type, parameters: node.parameters }
  }

  // Utility methods
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async validateWorkflow(workflow: WorkflowDefinition): Promise<void> {
    // Basic workflow validation
    if (!workflow.name) {
      throw new Error('Workflow name is required')
    }
    
    if (!workflow.nodes || workflow.nodes.length === 0) {
      throw new Error('Workflow must have at least one node')
    }

    // Validate node types exist
    for (const node of workflow.nodes) {
      if (!this.nodeTypes.has(node.type)) {
        throw new Error(`Unknown node type: ${node.type}`)
      }
    }
  }

  private async setupWorkflowTriggers(workflow: WorkflowDefinition): Promise<void> {
    // Setup triggers for active workflows
    const triggerNodes = workflow.nodes.filter(node => 
      node.type.includes('trigger') || node.type.includes('webhook')
    )

    for (const triggerNode of triggerNodes) {
      // Setup trigger based on type
      console.log(`Setting up trigger for ${triggerNode.type}`)
    }
  }

  private async removeWorkflowTriggers(workflow: WorkflowDefinition): Promise<void> {
    // Remove triggers when deactivating workflows
    console.log(`Removing triggers for workflow ${workflow.id}`)
  }

  private async loadWorkflows(): Promise<void> {
    // Load existing workflows from storage
    console.log('Loading workflows from storage')
  }

  private async startActiveWorkflows(): Promise<void> {
    for (const [id, workflow] of this.workflows) {
      if (workflow.active) {
        await this.activateWorkflow(id)
      }
    }
  }

  private startExecutionProcessor(): void {
    // Start background processor for execution queue
    setInterval(() => {
      if (!this.isProcessing && this.executionQueue.length > 0) {
        this.processExecutionQueue()
      }
    }, 1000)
  }

  private async waitForExecution(executionId: string): Promise<WorkflowExecution> {
    return new Promise((resolve) => {
      const checkExecution = () => {
        const execution = this.executions.get(executionId)
        if (execution && execution.finished) {
          resolve(execution)
        } else {
          setTimeout(checkExecution, 100)
        }
      }
      checkExecution()
    })
  }

  private calculateExecutionCost(execution: WorkflowExecution): number {
    // Calculate cost based on execution data
    return 0.01 // Placeholder
  }

  private calculateExecutionDuration(execution: WorkflowExecution): number {
    if (!execution.stoppedAt) return 0
    return execution.stoppedAt.getTime() - execution.startedAt.getTime()
  }

  private extractTokensUsed(execution: WorkflowExecution): number {
    // Extract token usage from execution data
    return 0 // Placeholder
  }

  async cleanup(): Promise<void> {
    // Deactivate all workflows
    for (const workflowId of this.activeWorkflows) {
      await this.deactivateWorkflow(workflowId)
    }

    // Cancel running executions
    for (const execution of this.executions.values()) {
      if (execution.status === 'running') {
        await this.cancelExecution(execution.id)
      }
    }

    console.log('N8n Workflow Engine cleaned up')
  }
}

// Supporting interfaces
interface LLMWorkflowConfig {
  name: string
  type: 'reasoning' | 'code_generation' | 'analysis' | 'writing'
  model: string
  prompt: string
  context?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  autoActivate?: boolean
  tags?: string[]
}

interface LLMTask {
  name: string
  type: 'reasoning' | 'code_generation' | 'analysis' | 'writing'
  model: string
  prompt: string
  context?: string
  inputData?: any
  timeout?: number
}

interface LLMTaskResult {
  executionId: string
  status: ExecutionStatus
  output: any
  cost: number
  duration: number
  tokensUsed: number
  model: string
}