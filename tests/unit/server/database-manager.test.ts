const { DatabaseManager } = require('../../../src/server/database-manager.mjs')
import { promises as fs } from 'fs'
import path from 'path'

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager
  let testDbPath: string

  beforeEach(() => {
    testDbPath = './test-data/test-db-' + Date.now() + '.db'
    dbManager = new DatabaseManager(testDbPath)
  })

  afterEach(async () => {
    await dbManager.close()
    try {
      await fs.unlink(testDbPath)
      await fs.rmdir(path.dirname(testDbPath))
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      const result = await dbManager.initialize()
      expect(result).toBe(true)
      expect(dbManager.isReady).toBe(true)
    })

    it('should create necessary tables', async () => {
      await dbManager.initialize()
      
      // Test that tables exist by trying to insert data
      const project = {
        id: 'test-proj-1',
        key: 'TEST',
        name: 'Test Project',
        description: 'Test description',
        lead: 'test@example.com',
        type: 'software'
      }
      
      const created = await dbManager.createProject(project)
      expect(created).toBeTruthy()
      expect(created.id).toBe('test-proj-1')
    })
  })

  describe('project operations', () => {
    beforeEach(async () => {
      await dbManager.initialize()
    })

    it('should create and retrieve projects', async () => {
      const project = {
        id: 'proj-1',
        key: 'DEMO',
        name: 'Demo Project',
        description: 'A test project',
        lead: 'developer@example.com',
        type: 'software',
        codeGraphPath: './src',
        customField: 'custom value'
      }

      const created = await dbManager.createProject(project)
      expect(created).toMatchObject(project)

      const retrieved = await dbManager.getProject('proj-1')
      expect(retrieved).toMatchObject(project)
      expect(retrieved.customField).toBe('custom value')
    })

    it('should update projects', async () => {
      const project = {
        id: 'proj-2',
        key: 'UPDATE',
        name: 'Update Test',
        description: 'Original description',
        lead: 'dev@example.com',
        type: 'software'
      }

      await dbManager.createProject(project)
      
      const updated = await dbManager.updateProject('proj-2', {
        ...project,
        description: 'Updated description'
      })

      expect(updated.description).toBe('Updated description')
    })

    it('should delete projects', async () => {
      const project = {
        id: 'proj-3',
        key: 'DELETE',
        name: 'Delete Test',
        description: 'To be deleted',
        lead: 'dev@example.com',
        type: 'software'
      }

      await dbManager.createProject(project)
      const deleted = await dbManager.deleteProject('proj-3')
      expect(deleted).toBe(true)
      
      const retrieved = await dbManager.getProject('proj-3')
      expect(retrieved).toBeNull()
    })

    it('should list all projects', async () => {
      const projects = [
        { id: 'proj-4', key: 'ONE', name: 'Project One', description: 'First', lead: 'dev@example.com', type: 'software' },
        { id: 'proj-5', key: 'TWO', name: 'Project Two', description: 'Second', lead: 'dev@example.com', type: 'research' }
      ]

      for (const project of projects) {
        await dbManager.createProject(project)
      }

      const allProjects = await dbManager.getAllProjects()
      expect(allProjects).toHaveLength(2)
      expect(allProjects.find((p: any) => p.id === 'proj-4')).toBeTruthy()
      expect(allProjects.find((p: any) => p.id === 'proj-5')).toBeTruthy()
    })
  })

  describe('request metrics', () => {
    beforeEach(async () => {
      await dbManager.initialize()
    })

    it('should log request metrics', async () => {
      await dbManager.logRequest('/api/test', 'GET', 150, 200, true, 0.05)
      
      const metrics = await dbManager.getRequestMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].endpoint).toBe('/api/test')
      expect(metrics[0].responseTime).toBe(150)
    })

    it('should calculate request statistics', async () => {
      // Log multiple requests
      await dbManager.logRequest('/api/test1', 'GET', 100, 200, true, 0.02)
      await dbManager.logRequest('/api/test2', 'POST', 200, 200, true, 0.03)
      await dbManager.logRequest('/api/test3', 'GET', 150, 500, false, 0)

      const stats = await dbManager.getRequestStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.successfulRequests).toBe(2)
      expect(stats.failedRequests).toBe(1)
      expect(stats.avgResponseTime).toBe(150)
      expect(stats.totalCostSaved).toBe(0.05)
    })
  })

  describe('specs operations', () => {
    beforeEach(async () => {
      await dbManager.initialize()
    })

    it('should create and retrieve specs', async () => {
      const spec = {
        id: 'spec-1',
        title: 'Test Spec',
        description: 'A test specification',
        status: 'active',
        priority: 'high',
        projectId: 'proj-1',
        linkedClasses: ['TestClass'],
        tags: ['test', 'spec']
      }

      const created = await dbManager.createSpec(spec)
      expect(created.title).toBe('Test Spec')
      expect(created.linkedClasses).toEqual(['TestClass'])
    })
  })

  describe('agents operations', () => {
    beforeEach(async () => {
      await dbManager.initialize()
    })

    it('should create and retrieve agents', async () => {
      const agent = {
        id: 'agent-1',
        name: 'Test Agent',
        description: 'A test agent',
        primaryRole: 'developer',
        projectId: 'proj-1',
        capabilities: {
          reasoning: 0.9,
          creativity: 0.7
        }
      }

      const created = await dbManager.createAgent(agent)
      expect(created.name).toBe('Test Agent')
      expect(created.capabilities.reasoning).toBe(0.9)
    })
  })
})