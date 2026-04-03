import { EventEmitter } from 'events'
import { z } from 'zod'

export const AgentProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['general', 'specialist', 'coordinator', 'executor']),
  capabilities: z.array(z.string()),
  skills: z.array(z.string()), // References to skill IDs
  model: z.object({
    provider: z.enum(['local', 'openai', 'anthropic', 'hybrid']),
    modelName: z.string(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().optional(),
    systemPrompt: z.string()
  }),
  personality: z.object({
    traits: z.array(z.string()),
    communicationStyle: z.enum(['formal', 'casual', 'technical', 'creative']),
    riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']),
    decisionMaking: z.enum(['analytical', 'intuitive', 'collaborative'])
  }),
  constraints: z.object({
    maxConcurrentTasks: z.number().default(1),
    maxExecutionTime: z.number().default(300000), // 5 minutes
    allowedOperations: z.array(z.string()),
    blockedOperations: z.array(z.string()),
    resourceLimits: z.object({
      maxMemory: z.string().default('512MB'),
      maxCpuTime: z.number().default(60000),
      maxApiCalls: z.number().default(100)
    })
  }),
  learning: z.object({
    learningRate: z.number().min(0).max(1).default(0.1),
    retainFailures: z.boolean().default(true),
    adaptToFeedback: z.boolean().default(true),
    shareKnowledge: z.boolean().default(true)
  }),
  metrics: z.object({
    successRate: z.number().default(0),
    averageExecutionTime: z.number().default(0),
    totalTasks: z.number().default(0),
    costEfficiency: z.number().default(0),
    userSatisfaction: z.number().default(0)
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().default(1),
  tags: z.array(z.string()).default([])
})

export type AgentProfile = z.infer<typeof AgentProfileSchema>

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number().default(1),
  agents: z.array(z.object({
    id: z.string(),
    profileId: z.string(),
    role: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    config: z.record(z.any()).optional()
  })),
  connections: z.array(z.object({
    from: z.string(), // agent ID
    to: z.string(),   // agent ID
    type: z.enum(['data', 'control', 'feedback']),
    condition: z.string().optional(), // When this connection activates
    transform: z.string().optional()  // How data is transformed
  })),
  triggers: z.array(z.object({
    id: z.string(),
    type: z.enum(['manual', 'scheduled', 'event', 'webhook']),
    config: z.record(z.any())
  })),
  variables: z.record(z.any()).default({}),
  metadata: z.object({
    author: z.string(),
    tags: z.array(z.string()),
    category: z.string().optional(),
    estimatedDuration: z.number().optional(),
    costEstimate: z.number().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type Workflow = z.infer<typeof WorkflowSchema>

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['code', 'analysis', 'communication', 'automation', 'creative']),
  implementation: z.object({
    type: z.enum(['function', 'workflow', 'external']),
    code: z.string().optional(),
    workflowId: z.string().optional(),
    externalConfig: z.record(z.any()).optional()
  }),
  inputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().default(true),
    description: z.string()
  })),
  outputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string()
  })),
  examples: z.array(z.object({
    input: z.record(z.any()),
    output: z.record(z.any()),
    description: z.string()
  })),
  performance: z.object({
    successRate: z.number().default(0),
    averageExecutionTime: z.number().default(0),
    totalExecutions: z.number().default(0),
    lastUpdated: z.date().optional()
  }),
  dependencies: z.array(z.string()).default([]), // Other skill IDs
  version: z.number().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string()).default([])
})

export type Skill = z.infer<typeof SkillSchema>

export const LearningRecordSchema = z.object({
  id: z.string(),
  type: z.enum(['success', 'failure', 'improvement', 'feedback']),
  agentId: z.string(),
  workflowId: z.string().optional(),
  skillId: z.string().optional(),
  context: z.object({
    task: z.string(),
    input: z.record(z.any()),
    output: z.record(z.any()).optional(),
    error: z.string().optional(),
    duration: z.number(),
    cost: z.number()
  }),
  insights: z.array(z.string()),
  improvements: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  createdAt: z.date()
})

export type LearningRecord = z.infer<typeof LearningRecordSchema>

export class AgentStudio extends EventEmitter {
  private agents = new Map<string, AgentProfile>()
  private workflows = new Map<string, Workflow>()
  private skills = new Map<string, Skill>()
  private learningRecords = new Map<string, LearningRecord[]>()

  // Agent Profile Management
  async createAgent(profile: Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const agent: AgentProfile = {
      ...profile,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1
    }

    this.agents.set(id, agent)
    this.emit('agent:created', agent)
    return id
  }

  async updateAgent(id: string, updates: Partial<Omit<AgentProfile, 'id' | 'createdAt'>>): Promise<void> {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent ${id} not found`)
    }

    const updatedAgent: AgentProfile = {
      ...agent,
      ...updates,
      updatedAt: new Date(),
      version: agent.version + 1
    }

    this.agents.set(id, updatedAgent)
    this.emit('agent:updated', updatedAgent)
  }

  async cloneAgent(id: string, name: string): Promise<string> {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent ${id} not found`)
    }

    const { id: _, createdAt: __, updatedAt: ___, version: ____, ...profile } = agent
    return this.createAgent({ ...profile, name })
  }

  // Workflow Management
  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const newWorkflow: Workflow = {
      ...workflow,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.workflows.set(id, newWorkflow)
    this.emit('workflow:created', newWorkflow)
    return id
  }

  async updateWorkflow(id: string, updates: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Promise<void> {
    const workflow = this.workflows.get(id)
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`)
    }

    const updatedWorkflow: Workflow = {
      ...workflow,
      ...updates,
      updatedAt: new Date(),
      version: workflow.version + 1
    }

    this.workflows.set(id, updatedWorkflow)
    this.emit('workflow:updated', updatedWorkflow)
  }

  async exportWorkflowAsMermaid(id: string): Promise<string> {
    const workflow = this.workflows.get(id)
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`)
    }

    let mermaid = `graph TD\n`
    
    // Add nodes (agents)
    for (const agent of workflow.agents) {
      const profile = this.agents.get(agent.profileId)
      const label = profile ? `${profile.name}\\n[${agent.role}]` : agent.role
      mermaid += `  ${agent.id}["${label}"]\n`
    }

    // Add connections
    for (const conn of workflow.connections) {
      const arrow = conn.type === 'control' ? '==>' : conn.type === 'feedback' ? '-..->' : '-->'
      const label = conn.condition ? `|${conn.condition}|` : ''
      mermaid += `  ${conn.from} ${arrow}${label} ${conn.to}\n`
    }

    // Add triggers
    for (const trigger of workflow.triggers) {
      mermaid += `  TRIGGER_${trigger.id}[${trigger.type.toUpperCase()}]\n`
      // Connect trigger to first agent(s)
      const firstAgents = workflow.agents.filter(a => 
        !workflow.connections.some(c => c.to === a.id)
      )
      for (const agent of firstAgents) {
        mermaid += `  TRIGGER_${trigger.id} --> ${agent.id}\n`
      }
    }

    return mermaid
  }

  // Skill Management
  async createSkill(skill: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const newSkill: Skill = {
      ...skill,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.skills.set(id, newSkill)
    this.emit('skill:created', newSkill)
    return id
  }

  async createCodeRefactorSkill(): Promise<string> {
    return this.createSkill({
      name: 'Code Refactoring',
      description: 'Analyzes and refactors code for better maintainability, performance, and readability',
      category: 'code',
      implementation: {
        type: 'function',
        code: `
async function refactorCode(input) {
  const { code, language, goals } = input
  
  // Analyze code structure
  const analysis = await analyzeCode(code, language)
  
  // Apply refactoring patterns
  const refactoredCode = await applyRefactoring(code, analysis, goals)
  
  // Generate summary
  const summary = generateRefactoringSummary(analysis, refactoredCode)
  
  return { refactoredCode, summary, changes: analysis.suggestions }
}
        `
      },
      inputs: [
        { name: 'code', type: 'string', required: true, description: 'Source code to refactor' },
        { name: 'language', type: 'string', required: true, description: 'Programming language' },
        { name: 'goals', type: 'array', required: false, description: 'Refactoring goals (performance, readability, etc.)' }
      ],
      outputs: [
        { name: 'refactoredCode', type: 'string', description: 'Improved code' },
        { name: 'summary', type: 'string', description: 'Summary of changes made' },
        { name: 'changes', type: 'array', description: 'List of specific changes' }
      ],
      examples: [
        {
          input: { code: 'function add(a,b){return a+b}', language: 'javascript' },
          output: { 
            refactoredCode: 'function add(a: number, b: number): number {\n  return a + b;\n}',
            summary: 'Added type annotations and improved formatting'
          },
          description: 'Basic function refactoring with types'
        }
      ],
      performance: {
        successRate: 0,
        averageExecutionTime: 0,
        totalExecutions: 0
      },
      dependencies: [],
      version: 1,
      tags: ['refactoring', 'code-quality']
    })
  }

  async createFileMoveSkill(): Promise<string> {
    return this.createSkill({
      name: 'File Operations',
      description: 'Safely moves, renames, and organizes files with conflict resolution',
      category: 'automation',
      implementation: {
        type: 'function',
        code: `
async function moveFile(input) {
  const { sourcePath, targetPath, options = {} } = input
  
  // Validate paths
  await validatePaths(sourcePath, targetPath)
  
  // Check for conflicts
  const conflicts = await checkConflicts(targetPath)
  
  // Create backup if requested
  if (options.backup) {
    await createBackup(sourcePath)
  }
  
  // Perform move operation
  await fs.move(sourcePath, targetPath, { overwrite: options.overwrite || false })
  
  return { 
    success: true, 
    newPath: targetPath,
    conflicts: conflicts.length,
    backupCreated: !!options.backup
  }
}
        `
      },
      inputs: [
        { name: 'sourcePath', type: 'string', required: true, description: 'Source file path' },
        { name: 'targetPath', type: 'string', required: true, description: 'Target file path' },
        { name: 'options', type: 'object', required: false, description: 'Move options (backup, overwrite, etc.)' }
      ],
      outputs: [
        { name: 'success', type: 'boolean', description: 'Whether operation succeeded' },
        { name: 'newPath', type: 'string', description: 'Final path of moved file' },
        { name: 'conflicts', type: 'number', description: 'Number of conflicts resolved' }
      ],
      examples: [
        {
          input: { sourcePath: '/old/file.txt', targetPath: '/new/file.txt' },
          output: { success: true, newPath: '/new/file.txt', conflicts: 0 },
          description: 'Simple file move operation'
        }
      ],
      performance: {
        successRate: 0,
        averageExecutionTime: 0,
        totalExecutions: 0
      },
      dependencies: [],
      version: 1,
      tags: ['file-system', 'automation']
    })
  }

  // Learning System
  async recordLearning(record: Omit<LearningRecord, 'id'>): Promise<void> {
    const id = `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const learningRecord: LearningRecord = { ...record, id }

    const agentRecords = this.learningRecords.get(record.agentId) || []
    agentRecords.push(learningRecord)
    this.learningRecords.set(record.agentId, agentRecords)

    // Update agent metrics
    await this.updateAgentMetrics(record.agentId, learningRecord)
    
    // Update skill metrics if applicable
    if (record.skillId) {
      await this.updateSkillMetrics(record.skillId, learningRecord)
    }

    this.emit('learning:recorded', learningRecord)
  }

  async incorporateLearning(agentId: string, workflowId?: string): Promise<void> {
    const records = this.learningRecords.get(agentId) || []
    const recentRecords = records.slice(-10) // Last 10 learning records

    // Analyze patterns
    const successPatterns = recentRecords.filter(r => r.type === 'success')
    const failurePatterns = recentRecords.filter(r => r.type === 'failure')

    const insights = this.extractInsights(successPatterns, failurePatterns)
    
    // Update agent based on insights
    if (insights.adjustTemperature) {
      const agent = this.agents.get(agentId)
      if (agent) {
        await this.updateAgent(agentId, {
          model: {
            ...agent.model,
            temperature: Math.max(0, Math.min(2, agent.model.temperature + insights.adjustTemperature))
          }
        })
      }
    }

    // Update workflow if provided
    if (workflowId && insights.workflowChanges) {
      await this.updateWorkflow(workflowId, insights.workflowChanges)
    }

    this.emit('learning:incorporated', { agentId, workflowId, insights })
  }

  // Query Methods
  getAgent(id: string): AgentProfile | undefined {
    return this.agents.get(id)
  }

  getAllAgents(): AgentProfile[] {
    return Array.from(this.agents.values())
  }

  getAgentsByType(type: AgentProfile['type']): AgentProfile[] {
    return this.getAllAgents().filter(agent => agent.type === type)
  }

  searchAgents(query: string): AgentProfile[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllAgents().filter(agent =>
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.description.toLowerCase().includes(lowerQuery) ||
      agent.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    )
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id)
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values())
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  getSkillsByCategory(category: Skill['category']): Skill[] {
    return this.getAllSkills().filter(skill => skill.category === category)
  }

  getLearningHistory(agentId: string, limit: number = 50): LearningRecord[] {
    const records = this.learningRecords.get(agentId) || []
    return records.slice(-limit).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // Analytics
  getAgentPerformanceReport(agentId: string): {
    agent: AgentProfile
    recentPerformance: LearningRecord[]
    trends: {
      successRateChange: number
      executionTimeChange: number
      costEfficiencyChange: number
    }
    recommendations: string[]
  } {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    const recentRecords = this.getLearningHistory(agentId, 20)
    const olderRecords = recentRecords.slice(10)
    const newerRecords = recentRecords.slice(0, 10)

    const trends = this.calculateTrends(olderRecords, newerRecords)
    const recommendations = this.generateRecommendations(agent, recentRecords, trends)

    return {
      agent,
      recentPerformance: newerRecords,
      trends,
      recommendations
    }
  }

  private async updateAgentMetrics(agentId: string, record: LearningRecord): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return

    const isSuccess = record.type === 'success'
    const newTotal = agent.metrics.totalTasks + 1
    const newSuccessRate = ((agent.metrics.successRate * agent.metrics.totalTasks) + (isSuccess ? 1 : 0)) / newTotal
    const newAvgTime = ((agent.metrics.averageExecutionTime * agent.metrics.totalTasks) + record.context.duration) / newTotal
    const newCostEff = ((agent.metrics.costEfficiency * agent.metrics.totalTasks) + (1 / Math.max(0.001, record.context.cost))) / newTotal

    await this.updateAgent(agentId, {
      metrics: {
        ...agent.metrics,
        totalTasks: newTotal,
        successRate: newSuccessRate,
        averageExecutionTime: newAvgTime,
        costEfficiency: newCostEff
      }
    })
  }

  private async updateSkillMetrics(skillId: string, record: LearningRecord): Promise<void> {
    const skill = this.skills.get(skillId)
    if (!skill) return

    const isSuccess = record.type === 'success'
    const newTotal = skill.performance.totalExecutions + 1
    const newSuccessRate = ((skill.performance.successRate * skill.performance.totalExecutions) + (isSuccess ? 1 : 0)) / newTotal
    const newAvgTime = ((skill.performance.averageExecutionTime * skill.performance.totalExecutions) + record.context.duration) / newTotal

    skill.performance = {
      successRate: newSuccessRate,
      averageExecutionTime: newAvgTime,
      totalExecutions: newTotal,
      lastUpdated: new Date()
    }

    this.skills.set(skillId, skill)
  }

  private extractInsights(successes: LearningRecord[], failures: LearningRecord[]): any {
    const insights: any = {}

    // Temperature adjustment based on success/failure patterns
    if (failures.length > successes.length) {
      insights.adjustTemperature = -0.1 // Lower temperature for more deterministic behavior
    } else if (successes.length > failures.length * 2) {
      insights.adjustTemperature = 0.05 // Slightly increase temperature for creativity
    }

    return insights
  }

  private calculateTrends(older: LearningRecord[], newer: LearningRecord[]): any {
    const olderSuccessRate = older.filter(r => r.type === 'success').length / Math.max(1, older.length)
    const newerSuccessRate = newer.filter(r => r.type === 'success').length / Math.max(1, newer.length)

    const olderAvgTime = older.reduce((sum, r) => sum + r.context.duration, 0) / Math.max(1, older.length)
    const newerAvgTime = newer.reduce((sum, r) => sum + r.context.duration, 0) / Math.max(1, newer.length)

    const olderAvgCost = older.reduce((sum, r) => sum + r.context.cost, 0) / Math.max(1, older.length)
    const newerAvgCost = newer.reduce((sum, r) => sum + r.context.cost, 0) / Math.max(1, newer.length)

    return {
      successRateChange: newerSuccessRate - olderSuccessRate,
      executionTimeChange: newerAvgTime - olderAvgTime,
      costEfficiencyChange: (1 / Math.max(0.001, newerAvgCost)) - (1 / Math.max(0.001, olderAvgCost))
    }
  }

  private generateRecommendations(agent: AgentProfile, records: LearningRecord[], trends: any): string[] {
    const recommendations: string[] = []

    if (trends.successRateChange < -0.1) {
      recommendations.push('Consider reducing task complexity or providing additional training')
    }

    if (trends.executionTimeChange > 10000) {
      recommendations.push('Performance degrading - consider optimizing prompts or switching models')
    }

    if (trends.costEfficiencyChange < -0.1) {
      recommendations.push('Cost increasing without proportional benefit - review model selection')
    }

    if (agent.metrics.successRate < 0.7) {
      recommendations.push('Below target success rate - consider retraining or adjusting parameters')
    }

    return recommendations
  }
}