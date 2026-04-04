/**
 * Integration Tests for CodeGraph API Endpoints
 * Tests the REST API endpoints that expose CodeGraph data
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

describe('CodeGraph API Integration', () => {
  beforeAll(async () => {
    const serverReady = await waitForServer()
    if (!serverReady) {
      console.warn('Server not available, skipping CodeGraph integration tests')
    }
  }, 20000)

  describe('GET /api/codegraph/status', () => {
    it('should return codegraph status with node/edge counts', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/status`)
      expect(response.ok).toBe(true)

      const status = await response.json()
      expect(status).toHaveProperty('totalNodes')
      expect(status).toHaveProperty('totalEdges')
      expect(status).toHaveProperty('filesIndexed')
      expect(status).toHaveProperty('nodesByKind')
      expect(status).toHaveProperty('edgesByKind')
      expect(status).toHaveProperty('isAvailable')
      expect(typeof status.totalNodes).toBe('number')
      expect(typeof status.totalEdges).toBe('number')
    })

    it('should report database availability', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/status`)
      const status = await response.json()
      expect(typeof status.isAvailable).toBe('boolean')
    })
  })

  describe('POST /api/codegraph/search', () => {
    it('should search symbols by name', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Router' }),
      })
      expect(response.ok).toBe(true)

      const results = await response.json()
      expect(Array.isArray(results)).toBe(true)
    })

    it('should filter by kind', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '*', kind: 'class', limit: 5 }),
      })
      expect(response.ok).toBe(true)

      const results = await response.json()
      expect(Array.isArray(results)).toBe(true)
      results.forEach((r: any) => {
        expect(r.kind).toBe('class')
      })
    })

    it('should return symbols with required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '*', limit: 1 }),
      })
      const results = await response.json()

      if (results.length > 0) {
        const symbol = results[0]
        expect(symbol).toHaveProperty('id')
        expect(symbol).toHaveProperty('name')
        expect(symbol).toHaveProperty('kind')
        expect(symbol).toHaveProperty('file')
        expect(symbol).toHaveProperty('line')
      }
    })

    it('should return empty array for nonsense query', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'xyznonexistent99999' }),
      })
      const results = await response.json()
      expect(results).toEqual([])
    })
  })

  describe('GET /api/codegraph/symbol/:id', () => {
    it('should return 404 for non-existent symbol', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/symbol/nonexistent-id`)
      expect(response.status).toBe(404)
    })

    it('should return symbol details with relationships', async () => {
      // First find a real symbol
      const searchResponse = await fetch(`${BASE_URL}/api/codegraph/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '*', kind: 'class', limit: 1 }),
      })
      const searchResults = await searchResponse.json()

      if (searchResults.length > 0) {
        const symbolId = encodeURIComponent(searchResults[0].id)
        const response = await fetch(`${BASE_URL}/api/codegraph/symbol/${symbolId}`)
        expect(response.ok).toBe(true)

        const detail = await response.json()
        expect(detail).toHaveProperty('name')
        expect(detail).toHaveProperty('kind')
        expect(detail).toHaveProperty('relationships')
        expect(detail.relationships).toHaveProperty('incoming')
        expect(detail.relationships).toHaveProperty('outgoing')
      }
    })
  })

  describe('GET /api/codegraph/callers/:id', () => {
    it('should return array of callers', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/callers/any-id`)
      expect(response.ok).toBe(true)
      const callers = await response.json()
      expect(Array.isArray(callers)).toBe(true)
    })
  })

  describe('GET /api/codegraph/callees/:id', () => {
    it('should return array of callees', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/callees/any-id`)
      expect(response.ok).toBe(true)
      const callees = await response.json()
      expect(Array.isArray(callees)).toBe(true)
    })
  })

  describe('GET /api/codegraph/impact/:id', () => {
    it('should return impact analysis', async () => {
      const response = await fetch(`${BASE_URL}/api/codegraph/impact/any-id`)
      expect(response.ok).toBe(true)
      const impact = await response.json()
      expect(impact).toHaveProperty('affected')
      expect(impact).toHaveProperty('totalAffected')
      expect(impact).toHaveProperty('maxDepthReached')
      expect(impact).toHaveProperty('analyzedDepth')
    })
  })
})
