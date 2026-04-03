import { EventEmitter } from 'events'
import { z } from 'zod'

export const CheckpointSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  name: z.string(),
  description: z.string(),
  state: z.record(z.any()), // Task state data
  context: z.object({
    filesRead: z.array(z.string()),
    filesModified: z.array(z.string()),
    commandsRun: z.array(z.string()),
    apiCallsMade: z.number(),
    tokensUsed: z.number(),
    cost: z.number()
  }),
  metadata: z.object({
    agent: z.string().optional(),
    skill: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    tags: z.array(z.string()),
    parentCheckpoint: z.string().optional()
  }),
  createdAt: z.date(),
  status: z.enum(['active', 'completed', 'failed', 'archived'])
})

export type Checkpoint = z.infer<typeof CheckpointSchema>

export const MemoryTransferSchema = z.object({
  checkpointId: z.string(),
  longTermMemoryId: z.string(),
  transferType: z.enum(['success_pattern', 'failure_pattern', 'workflow', 'knowledge']),
  extractedData: z.record(z.any()),
  transferredAt: z.date()
})

export type MemoryTransfer = z.infer<typeof MemoryTransferSchema>

export class CheckpointManager extends EventEmitter {
  private checkpoints = new Map<string, Checkpoint>()
  private activeCheckpoints = new Map<string, string>() // taskId -> checkpointId
  private memoryTransfers = new Map<string, MemoryTransfer[]>()
  private maxCheckpointsPerTask = 50
  private autoTransferThreshold = 24 * 60 * 60 * 1000 // 24 hours

  async createCheckpoint(
    taskId: string,
    name: string,
    description: string,
    state: Record<string, any>,
    context: Checkpoint['context'],
    metadata: Checkpoint['metadata']
  ): Promise<string> {
    const id = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const checkpoint: Checkpoint = {
      id,
      taskId,
      name,
      description,
      state,
      context,
      metadata,
      createdAt: new Date(),
      status: 'active'
    }

    this.checkpoints.set(id, checkpoint)
    this.activeCheckpoints.set(taskId, id)
    
    // Clean up old checkpoints for this task
    await this.cleanupOldCheckpoints(taskId)
    
    this.emit('checkpoint:created', checkpoint)
    return id
  }

  async updateCheckpoint(id: string, updates: Partial<Omit<Checkpoint, 'id' | 'createdAt'>>): Promise<void> {
    const checkpoint = this.checkpoints.get(id)
    if (!checkpoint) {
      throw new Error(`Checkpoint ${id} not found`)
    }

    const updatedCheckpoint: Checkpoint = {
      ...checkpoint,
      ...updates
    }

    this.checkpoints.set(id, updatedCheckpoint)
    this.emit('checkpoint:updated', updatedCheckpoint)
  }

  async completeCheckpoint(id: string, finalState?: Record<string, any>): Promise<void> {
    const updates: Partial<Checkpoint> = { status: 'completed' }
    if (finalState) {
      updates.state = finalState
    }
    
    await this.updateCheckpoint(id, updates)
    
    // Check if checkpoint should be transferred to long-term memory
    const checkpoint = this.checkpoints.get(id)
    if (checkpoint && this.shouldTransferToLongTerm(checkpoint)) {
      await this.scheduleMemoryTransfer(id)
    }
  }

  async failCheckpoint(id: string, error: string): Promise<void> {
    await this.updateCheckpoint(id, { 
      status: 'failed',
      state: { ...this.checkpoints.get(id)?.state, error }
    })
    
    // Failed checkpoints are also valuable for learning
    await this.scheduleMemoryTransfer(id, 'failure_pattern')
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<Checkpoint> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }

    // Create a new active checkpoint based on the restored one
    const restoredId = await this.createCheckpoint(
      checkpoint.taskId,
      `Restored: ${checkpoint.name}`,
      `Restored from checkpoint ${checkpointId}`,
      checkpoint.state,
      checkpoint.context,
      { ...checkpoint.metadata, parentCheckpoint: checkpointId }
    )

    this.emit('checkpoint:restored', { original: checkpoint, restored: restoredId })
    return this.checkpoints.get(restoredId)!
  }

  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id)
  }

  getTaskCheckpoints(taskId: string): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(cp => cp.taskId === taskId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  getActiveCheckpoint(taskId: string): Checkpoint | undefined {
    const checkpointId = this.activeCheckpoints.get(taskId)
    return checkpointId ? this.checkpoints.get(checkpointId) : undefined
  }

  async createTaskCheckpoint(
    taskId: string,
    progress: {
      step: number
      totalSteps: number
      stepName: string
      stepDescription: string
    },
    state: Record<string, any>,
    context: Checkpoint['context']
  ): Promise<string> {
    return this.createCheckpoint(
      taskId,
      `Step ${progress.step}: ${progress.stepName}`,
      progress.stepDescription,
      { ...state, progress },
      context,
      {
        priority: 'medium',
        tags: ['task-progress'],
        agent: state.agent,
        skill: state.skill
      }
    )
  }

  async scheduleMemoryTransfer(
    checkpointId: string,
    transferType: MemoryTransfer['transferType'] = 'success_pattern'
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }

    // Extract relevant data based on transfer type
    const extractedData = this.extractDataForTransfer(checkpoint, transferType)
    
    const transfer: MemoryTransfer = {
      checkpointId,
      longTermMemoryId: `ltm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      transferType,
      extractedData,
      transferredAt: new Date()
    }

    const existing = this.memoryTransfers.get(checkpointId) || []
    existing.push(transfer)
    this.memoryTransfers.set(checkpointId, existing)

    this.emit('memory:transfer-scheduled', transfer)
  }

  async getMemoryTransfers(checkpointId: string): Promise<MemoryTransfer[]> {
    return this.memoryTransfers.get(checkpointId) || []
  }

  async searchCheckpoints(query: {
    taskId?: string
    status?: Checkpoint['status']
    agent?: string
    skill?: string
    tags?: string[]
    dateRange?: { start: Date; end: Date }
  }): Promise<Checkpoint[]> {
    let results = Array.from(this.checkpoints.values())

    if (query.taskId) {
      results = results.filter(cp => cp.taskId === query.taskId)
    }
    
    if (query.status) {
      results = results.filter(cp => cp.status === query.status)
    }
    
    if (query.agent) {
      results = results.filter(cp => cp.metadata.agent === query.agent)
    }
    
    if (query.skill) {
      results = results.filter(cp => cp.metadata.skill === query.skill)
    }
    
    if (query.tags && query.tags.length > 0) {
      results = results.filter(cp => 
        query.tags!.some(tag => cp.metadata.tags.includes(tag))
      )
    }
    
    if (query.dateRange) {
      results = results.filter(cp => 
        cp.createdAt >= query.dateRange!.start && 
        cp.createdAt <= query.dateRange!.end
      )
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async generateTaskSummary(taskId: string): Promise<string> {
    const checkpoints = this.getTaskCheckpoints(taskId)
    if (checkpoints.length === 0) {
      return 'No checkpoints found for this task'
    }

    const latest = checkpoints[0]
    const totalCost = checkpoints.reduce((sum, cp) => sum + cp.context.cost, 0)
    const totalTokens = checkpoints.reduce((sum, cp) => sum + cp.context.tokensUsed, 0)
    const totalApiCalls = checkpoints.reduce((sum, cp) => sum + cp.context.apiCallsMade, 0)

    let summary = `**Task Summary: ${taskId}**\n\n`
    summary += `**Status:** ${latest.status}\n`
    summary += `**Checkpoints:** ${checkpoints.length}\n`
    summary += `**Total Cost:** $${totalCost.toFixed(4)}\n`
    summary += `**Total Tokens:** ${totalTokens.toLocaleString()}\n`
    summary += `**API Calls:** ${totalApiCalls}\n\n`

    summary += `**Recent Progress:**\n`
    checkpoints.slice(0, 5).forEach((cp, i) => {
      summary += `${i + 1}. ${cp.name} (${cp.status})\n`
    })

    return summary
  }

  private shouldTransferToLongTerm(checkpoint: Checkpoint): boolean {
    const age = Date.now() - checkpoint.createdAt.getTime()
    return (
      checkpoint.status === 'completed' &&
      age > this.autoTransferThreshold
    ) || checkpoint.metadata.priority === 'critical'
  }

  private extractDataForTransfer(checkpoint: Checkpoint, transferType: MemoryTransfer['transferType']): Record<string, any> {
    const baseData = {
      taskId: checkpoint.taskId,
      agent: checkpoint.metadata.agent,
      skill: checkpoint.metadata.skill,
      tags: checkpoint.metadata.tags,
      context: checkpoint.context
    }

    switch (transferType) {
      case 'success_pattern':
        return {
          ...baseData,
          successPattern: {
            approach: checkpoint.description,
            finalState: checkpoint.state,
            costEffectiveness: checkpoint.context.cost / checkpoint.context.tokensUsed
          }
        }
      
      case 'failure_pattern':
        return {
          ...baseData,
          failurePattern: {
            approach: checkpoint.description,
            errorState: checkpoint.state,
            error: checkpoint.state.error
          }
        }
      
      case 'workflow':
        return {
          ...baseData,
          workflow: {
            steps: checkpoint.state.progress,
            duration: Date.now() - checkpoint.createdAt.getTime(),
            filesInvolved: [
              ...checkpoint.context.filesRead,
              ...checkpoint.context.filesModified
            ]
          }
        }
      
      default:
        return baseData
    }
  }

  private async cleanupOldCheckpoints(taskId: string): Promise<void> {
    const taskCheckpoints = this.getTaskCheckpoints(taskId)
    
    if (taskCheckpoints.length > this.maxCheckpointsPerTask) {
      const toRemove = taskCheckpoints.slice(this.maxCheckpointsPerTask)
      
      for (const checkpoint of toRemove) {
        // Archive instead of delete to preserve references
        if (checkpoint.status !== 'archived') {
          await this.updateCheckpoint(checkpoint.id, { status: 'archived' })
        }
      }
    }
  }
}