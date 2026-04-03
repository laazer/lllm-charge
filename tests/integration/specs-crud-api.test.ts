/**
 * Integration Tests for Specs CRUD API Endpoints
 * Tests create, read, update, delete operations on specs
 * Requires: npm run dev:server:comprehensive (port 3001)
 */

const BASE_URL = 'http://localhost:3001'

const waitForServer = async (maxAttempts = 30): Promise<boolean> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`)
      if (response.ok) return true
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

describe('Specs CRUD API Integration', () => {
  let createdSpecId: string | null = null

  beforeAll(async () => {
    const serverReady = await waitForServer()
    if (!serverReady) {
      console.warn('Server not available, skipping Specs CRUD integration tests')
    }
  }, 20000)

  afterAll(async () => {
    // Clean up any test spec we created
    if (createdSpecId) {
      try {
        await fetch(`${BASE_URL}/api/specs/${createdSpecId}`, { method: 'DELETE' })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('POST /api/specs', () => {
    it('should create a new spec', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Spec',
          description: 'Created by automated test',
          status: 'draft',
          priority: 'low',
          tags: ['test', 'integration', 'automated'],
        }),
      })

      expect(response.status).toBe(201)
      const spec = await response.json()
      expect(spec.title).toBe('Integration Test Spec')
      expect(spec.createdAt).toBeDefined()

      // Save for subsequent tests
      createdSpecId = spec.id
    })

    it('should create spec with default status and priority', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Minimal Spec',
        }),
      })

      expect(response.status).toBe(201)
      const spec = await response.json()
      expect(spec.status).toBe('draft')
      expect(spec.priority).toBe('medium')

      // Clean up
      await fetch(`${BASE_URL}/api/specs/${spec.id}`, { method: 'DELETE' })
    })
  })

  describe('GET /api/specs', () => {
    it('should return all specs as array', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      expect(response.ok).toBe(true)

      const specs = await response.json()
      expect(Array.isArray(specs)).toBe(true)
    })

    it('should include the created test spec', async () => {
      if (!createdSpecId) return

      const response = await fetch(`${BASE_URL}/api/specs`)
      const specs = await response.json()
      const found = specs.find((s: any) => s.id === createdSpecId)
      expect(found).toBeDefined()
      expect(found.title).toBe('Integration Test Spec')
      expect(found.tags).toEqual(['test', 'integration', 'automated'])
    })
  })

  describe('GET /api/specs/:id', () => {
    it('should return a specific spec by id', async () => {
      if (!createdSpecId) return

      const response = await fetch(`${BASE_URL}/api/specs/${createdSpecId}`)
      expect(response.ok).toBe(true)

      const spec = await response.json()
      expect(spec.id).toBe(createdSpecId)
      expect(spec.title).toBe('Integration Test Spec')
      expect(spec.tags).toEqual(['test', 'integration', 'automated'])
    })

    it('should return 404 for non-existent spec', async () => {
      const response = await fetch(`${BASE_URL}/api/specs/nonexistent-spec-12345`)
      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/specs/:id', () => {
    it('should update spec title and status', async () => {
      if (!createdSpecId) return

      const response = await fetch(`${BASE_URL}/api/specs/${createdSpecId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Integration Test Spec',
          status: 'active',
        }),
      })

      expect(response.ok).toBe(true)
      const spec = await response.json()
      expect(spec.title).toBe('Updated Integration Test Spec')
      expect(spec.status).toBe('active')
    })

    it('should update spec tags', async () => {
      if (!createdSpecId) return

      const response = await fetch(`${BASE_URL}/api/specs/${createdSpecId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: ['updated', 'modified'],
        }),
      })

      expect(response.ok).toBe(true)
      const spec = await response.json()
      expect(spec.tags).toEqual(['updated', 'modified'])
    })

    it('should preserve unchanged fields after update', async () => {
      if (!createdSpecId) return

      // Update only priority
      await fetch(`${BASE_URL}/api/specs/${createdSpecId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'high' }),
      })

      // Verify title is unchanged
      const getResponse = await fetch(`${BASE_URL}/api/specs/${createdSpecId}`)
      const spec = await getResponse.json()
      expect(spec.title).toBe('Updated Integration Test Spec')
      expect(spec.priority).toBe('high')
    })
  })

  describe('DELETE /api/specs/:id', () => {
    it('should delete a spec', async () => {
      if (!createdSpecId) return

      const response = await fetch(`${BASE_URL}/api/specs/${createdSpecId}`, {
        method: 'DELETE',
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)

      // Verify it's gone
      const getResponse = await fetch(`${BASE_URL}/api/specs/${createdSpecId}`)
      expect(getResponse.status).toBe(404)

      createdSpecId = null // Already cleaned up
    })
  })
})
