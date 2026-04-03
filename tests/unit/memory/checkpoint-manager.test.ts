import { CheckpointManager } from '../../../src/memory/checkpoint-manager'

describe('CheckpointManager', () => {
  let checkpointManager: CheckpointManager

  beforeEach(() => {
    checkpointManager = new CheckpointManager()
  })

  describe('Checkpoint Creation', () => {
    it('should create a checkpoint successfully', async () => {
      const taskId = 'task-123'
      const checkpointId = await checkpointManager.createCheckpoint(
        taskId,
        'Initial Setup',
        'Created project structure and basic configuration',
        { 
          files: ['package.json', 'tsconfig.json'],
          status: 'in_progress'
        },
        {
          filesRead: ['package.json'],
          filesModified: ['tsconfig.json'],
          commandsRun: ['npm init', 'tsc --init'],
          apiCallsMade: 2,
          tokensUsed: 150,
          cost: 0.05
        },
        {
          tags: ['setup', 'initialization'],
          priority: 'high' as const
        }
      )

      expect(checkpointId).toBeDefined()
      expect(typeof checkpointId).toBe('string')
      expect(checkpointId.startsWith('checkpoint-')).toBe(true)
    })

    it('should retrieve created checkpoint', async () => {
      const taskId = 'task-456'
      const checkpointId = await checkpointManager.createCheckpoint(
        taskId,
        'Test Checkpoint',
        'A checkpoint for testing purposes',
        { testData: true },
        {
          filesRead: [],
          filesModified: [],
          commandsRun: [],
          apiCallsMade: 0,
          tokensUsed: 0,
          cost: 0
        },
        { 
          tags: ['test'],
          priority: 'medium' as const
        }
      )

      const retrieved = checkpointManager.getCheckpoint(checkpointId)
      
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(checkpointId)
      expect(retrieved!.taskId).toBe(taskId)
      expect(retrieved!.name).toBe('Test Checkpoint')
      expect(retrieved!.description).toBe('A checkpoint for testing purposes')
      expect(retrieved!.state.testData).toBe(true)
      expect(retrieved!.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('Checkpoint Updates', () => {
    it('should update checkpoint', async () => {
      const taskId = 'task-789'
      const checkpointId = await checkpointManager.createCheckpoint(
        taskId,
        'Update Test',
        'Testing checkpoint updates',
        { step: 1, completed: false },
        {
          filesRead: [],
          filesModified: [],
          commandsRun: [],
          apiCallsMade: 0,
          tokensUsed: 0,
          cost: 0
        },
        { 
          tags: ['update-test'],
          priority: 'medium' as const
        }
      )

      await checkpointManager.updateCheckpoint(checkpointId, {
        state: { step: 2, completed: true },
        status: 'completed' as const
      })

      const updated = checkpointManager.getCheckpoint(checkpointId)
      expect(updated!.state.step).toBe(2)
      expect(updated!.state.completed).toBe(true)
      expect(updated!.status).toBe('completed')
    })
  })

  describe('Checkpoint Queries', () => {
    it('should get checkpoints by task', async () => {
      const taskId = 'task-query'
      await checkpointManager.createCheckpoint(
        taskId,
        'Query Test',
        'Testing queries',
        { test: true },
        {
          filesRead: [],
          filesModified: [],
          commandsRun: [],
          apiCallsMade: 0,
          tokensUsed: 0,
          cost: 0
        },
        { tags: ['query'], priority: 'low' as const }
      )

      const checkpoints = checkpointManager.getTaskCheckpoints(taskId)
      expect(checkpoints.length).toBe(1)
      expect(checkpoints[0].taskId).toBe(taskId)
    })
  })

  describe('Checkpoint Restoration', () => {
    it('should create and restore checkpoint', async () => {
      const taskId = 'task-restore'
      const initialState = {
        counter: 5,
        data: ['item1', 'item2'],
        config: { debug: true }
      }

      const checkpointId = await checkpointManager.createCheckpoint(
        taskId,
        'Save Point',
        'Saving current state before risky operation',
        initialState,
        {
          filesRead: [],
          filesModified: [],
          commandsRun: [],
          apiCallsMade: 0,
          tokensUsed: 0,
          cost: 0
        },
        { 
          tags: ['savepoint'],
          priority: 'high' as const
        }
      )

      const restored = await checkpointManager.restoreFromCheckpoint(checkpointId)
      expect(restored.state.counter).toBe(5)
      expect(restored.state.data).toEqual(['item1', 'item2'])
      expect(restored.state.config.debug).toBe(true)
    })
  })
})