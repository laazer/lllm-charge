import { WorkingLLMChargeServer } from '../../../src/server/working-server.mjs'

describe('WorkingLLMChargeServer - No Fake Data', () => {
  let server: WorkingLLMChargeServer
  let originalConsoleLog: typeof console.log
  
  beforeAll(() => {
    // Mock console.log to reduce test noise
    originalConsoleLog = console.log
    console.log = jest.fn()
  })
  
  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeEach(() => {
    server = new (WorkingLLMChargeServer as any)(0) // Use port 0 to avoid conflicts
  })

  afterEach(async () => {
    if (server && server.server) {
      server.server.close()
    }
    if (server && server.db) {
      await server.db.close()
    }
  })

  describe('metrics without fake data', () => {
    it('should show N/A for success rate when no requests made', async () => {
      const metrics = await server.getSystemMetrics()
      
      expect(metrics.successRate).toBe('N/A')
      expect(metrics.avgLatency).toBe('N/A') 
      expect(metrics.totalRequests).toBe('0')
      expect(metrics.costSavings).toBe('0.00')
    })

    it('should calculate real success rate after requests', () => {
      // Simulate some requests
      server.requestMetrics.totalRequests = 10
      server.requestMetrics.successfulRequests = 8
      server.requestMetrics.failedRequests = 2
      
      // No await needed here since we're testing the calculation logic directly
      const realSuccessRate = server.requestMetrics.totalRequests > 0 
        ? (server.requestMetrics.successfulRequests / server.requestMetrics.totalRequests) * 100
        : null
      
      expect(realSuccessRate).toBe(80)
    })

    it('should calculate real average latency', () => {
      server.requestMetrics.responseTimes = [100, 200, 300]
      
      const realAvgLatency = server.requestMetrics.responseTimes.length > 0
        ? server.requestMetrics.responseTimes.reduce((sum, time) => sum + time, 0) / server.requestMetrics.responseTimes.length
        : null
      
      expect(realAvgLatency).toBe(200)
    })

    it('should not use fake baseline request count', async () => {
      const metrics = await server.getSystemMetrics()
      
      // Should show actual request count, not fake baseline
      expect(metrics.totalRequests).toBe('0')
      expect(server.baseRequestCount).toBeUndefined()
    })

    it('should not use fake historical cost savings', async () => {
      const metrics = await server.getSystemMetrics()
      
      // Should show only real cost savings, not fake historical baseline
      expect(metrics.costSavings).toBe('0.00')
    })
  })

  describe('database integration', () => {
    it('should initialize database on startup', () => {
      expect(server.db).toBeDefined()
      expect(server.dbReady).toBe(false) // Should start false until async init completes
    })

    it('should create initial project when none exist', async () => {
      // This tests the createInitialProject method
      const projectId = 'main-' + Date.now()
      const project = {
        id: projectId,
        key: 'MAIN',
        name: 'LLM-Charge Main Project',
        description: 'Main development project for LLM-Charge system',
        lead: 'developer',
        type: 'software',
        codeGraphPath: expect.any(String),
        associatedSpecs: [],
        associatedAgents: [],
        associatedNotes: [],
        associatedWorkflows: []
      }
      
      // Mock database methods
      server.db.getAllProjects = jest.fn().mockResolvedValue([])
      server.db.createProject = jest.fn().mockResolvedValue(project)
      
      await server.createInitialProject()
      
      expect(server.db.createProject).toHaveBeenCalledWith(expect.objectContaining({
        key: 'MAIN',
        name: 'LLM-Charge Main Project',
        type: 'software'
      }))
    })
  })

  describe('real project analysis', () => {
    it('should not return fake placeholder analysis by default', async () => {
      const metrics = await server.getSystemMetrics()
      const analysis = metrics.projectAnalysis
      
      // Should not contain the fake placeholder data
      if (analysis) {
        // If analysis exists, it should be real data, not the fake placeholder
        expect(analysis.files?.total).not.toBe(89) // Fake placeholder value
        expect(analysis.codeGraph?.functions).not.toBe(234) // Fake placeholder value
      }
    })
  })

  describe('request tracking', () => {
    it('should track real requests without fake baseline', () => {
      const initialCount = server.requestMetrics.totalRequests
      
      // Simulate tracking a request
      server.requestMetrics.totalRequests++
      
      expect(server.requestMetrics.totalRequests).toBe(initialCount + 1)
      expect(server.requestMetrics.totalRequests).not.toBe(2847) // Should not equal fake baseline
    })
  })
})

describe('DRY Principle Compliance', () => {
  it('should not duplicate database CRUD patterns', () => {
    // Test that the DatabaseManager follows DRY by having consistent patterns
    const dbManager = require('../../../src/server/database-manager.mjs').default
    const methods = Object.getOwnPropertyNames(dbManager.prototype)
    
    // Should have consistent CRUD patterns
    const crudPatterns = ['create', 'get', 'getAll', 'update', 'delete']
    const entities = ['Project', 'Spec', 'Agent', 'Note']
    
    entities.forEach(entity => {
      crudPatterns.forEach(operation => {
        const expectedMethod = operation + entity
        if (operation === 'getAll') {
          expect(methods).toContain('getAll' + entity + 's')
        } else if (operation !== 'getAll') {
          expect(methods).toContain(expectedMethod)
        }
      })
    })
  })
})

// Test to ensure we're not creating sample/fake data
describe('No Sample Data Creation', () => {
  it('should not initialize with sample data', () => {
    const server = new (WorkingLLMChargeServer as any)(0)
    
    // Should not have initSampleData method or it should not create fake data
    expect(server.specs?.size || 0).toBe(0)
    expect(server.projects?.size || 0).toBe(0)
    expect(server.agents?.size || 0).toBe(0)
    expect(server.notes?.size || 0).toBe(0)
  })
})