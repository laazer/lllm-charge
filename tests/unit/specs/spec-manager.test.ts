import { SpecManager, Spec } from '../../../src/specs/spec-manager'

describe('SpecManager', () => {
  let specManager: SpecManager

  beforeEach(() => {
    specManager = new SpecManager()
  })

  describe('Spec Creation', () => {
    it('should create a new spec successfully', async () => {
      const specData = {
        title: 'User Authentication API',
        description: 'REST API endpoints for user authentication',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'draft' as const,
        priority: 'high' as const,
        tags: ['auth', 'api'],
        comments: []
      }

      const specId = await specManager.createSpec(specData)
      expect(specId).toBeDefined()
      expect(typeof specId).toBe('string')
      expect(specId.startsWith('spec-')).toBe(true)
    })

    it('should retrieve created spec', async () => {
      const specData = {
        title: 'Test Spec',
        description: 'A test specification',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'draft' as const,
        priority: 'medium' as const,
        tags: ['test'],
        comments: []
      }

      const specId = await specManager.createSpec(specData)
      const retrieved = specManager.getSpec(specId)
      
      expect(retrieved).toBeDefined()
      expect(retrieved!.title).toBe('Test Spec')
      expect(retrieved!.status).toBe('draft')
      expect(retrieved!.id).toBe(specId)
      expect(retrieved!.createdAt).toBeInstanceOf(Date)
      expect(retrieved!.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('Spec Updates', () => {
    it('should update spec successfully', async () => {
      const specData = {
        title: 'Original Title',
        description: 'Original description',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'draft' as const,
        priority: 'low' as const,
        tags: ['original'],
        comments: []
      }

      const specId = await specManager.createSpec(specData)
      
      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
        status: 'active' as const
      }

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1))
      await specManager.updateSpec(specId, updates)
      const updated = specManager.getSpec(specId)
      
      expect(updated!.title).toBe('Updated Title')
      expect(updated!.description).toBe('Updated description')
      expect(updated!.status).toBe('active')
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(updated!.createdAt.getTime())
    })
  })

  describe('Spec Search and Filtering', () => {
    beforeEach(async () => {
      // Create multiple specs for testing
      await specManager.createSpec({
        title: 'API Spec 1',
        description: 'First API specification',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'draft',
        priority: 'high',
        tags: ['api', 'backend'],
        comments: []
      })

      await specManager.createSpec({
        title: 'Feature Spec 1',
        description: 'First feature specification',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'active',
        priority: 'medium',
        tags: ['feature', 'frontend'],
        comments: []
      })

      await specManager.createSpec({
        title: 'Bug Fix Spec',
        description: 'Bug fix specification',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'active',
        priority: 'high',
        tags: ['bug', 'backend'],
        comments: []
      })
    })

    it('should search specs by title', () => {
      const results = specManager.searchSpecs('API')
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('API Spec 1')
    })

    it('should filter specs by status', () => {
      const results = specManager.getSpecsByStatus('active')
      expect(results.length).toBe(2)
      expect(results.every(spec => spec.status === 'active')).toBe(true)
    })

    it('should get all specs', () => {
      const results = specManager.getAllSpecs()
      expect(results.length).toBe(3)
    })
  })

  describe('Code Linking', () => {
    it('should link spec to code successfully', async () => {
      const specId = await specManager.createSpec({
        title: 'Login Function',
        description: 'User login functionality',
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        status: 'draft',
        priority: 'high',
        tags: ['auth'],
        comments: []
      })

      await specManager.linkToCode(specId, 'loginUser', 'src/auth/login.ts', 25, 'function')
      
      const spec = specManager.getSpec(specId)
      const codeLinks = specManager.getCodeLinks(specId)
      
      expect(codeLinks.length).toBe(1)
      expect(codeLinks[0].symbol).toBe('loginUser')
      expect(codeLinks[0].file).toBe('src/auth/login.ts')
      expect(codeLinks[0].line).toBe(25)
      expect(codeLinks[0].type).toBe('function')
      expect(spec!.linkedMethods).toContain('loginUser')
    })
  })
})