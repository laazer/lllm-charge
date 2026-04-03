// Mock global fetch for Node.js environment  
if (!global.fetch) {
  global.fetch = require('node-fetch')
}

describe('Agent Studio Integration Tests', () => {
  const baseUrl = 'http://localhost:3001'

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  describe('Agent Studio Accessibility', () => {
    it('should serve agent studio HTML page', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      
      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
    })

    it('should have agent studio content in HTML', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('Agent Studio')
      expect(html).toContain('Agent Templates')
      expect(html).toContain('Agent Designer Canvas')
      expect(html).toContain('Agent Properties')
    })
  })

  describe('Agent API Integration', () => {
    it('should return agents from API endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/agents`)
      
      expect(response.ok).toBe(true)
      
      const agents = await response.json() as any[]
      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBeGreaterThan(0)
      
      // Verify agent structure
      const firstAgent = agents[0]
      expect(firstAgent).toHaveProperty('id')
      expect(firstAgent).toHaveProperty('name')
      expect(firstAgent).toHaveProperty('description')
      expect(firstAgent).toHaveProperty('primaryRole')
      expect(firstAgent).toHaveProperty('capabilities')
    })

    it('should have agents with proper capabilities structure', async () => {
      const response = await fetch(`${baseUrl}/api/agents`)
      const agents = await response.json() as any[]
      
      for (const agent of agents) {
        expect(agent.capabilities).toHaveProperty('reasoning')
        expect(agent.capabilities).toHaveProperty('creativity')
        expect(agent.capabilities).toHaveProperty('technical')
        expect(agent.capabilities).toHaveProperty('communication')
        
        // Verify capability values are between 0 and 1
        Object.values(agent.capabilities).forEach((value: any) => {
          expect(typeof value).toBe('number')
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        })
      }
    })
  })

  describe('Agent Studio JavaScript Functionality', () => {
    it('should contain createSampleAgents function in HTML', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('createSampleAgents()')
      expect(html).toContain("fetch('/api/agents')")
      expect(html).toContain('systemAgents.forEach')
    })

    it('should have proper agent creation logic', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      // Verify agent creation from API data
      expect(html).toContain('agent.name')
      expect(html).toContain('agent.primaryRole')
      expect(html).toContain('agent.capabilities')
      expect(html).toContain('this.createAgent')
    })

    it('should have fallback for when no agents exist', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('systemAgents.length === 0')
      expect(html).toContain('Fallback to sample agents')
      expect(html).toContain('Code Assistant')
    })
  })

  describe('Agent Studio Templates', () => {
    it('should contain predefined agent templates', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      const expectedTemplates = [
        'Code Assistant',
        'Research Agent', 
        'Project Manager',
        'Creative Writer',
        'Data Analyst',
        'QA Tester'
      ]
      
      expectedTemplates.forEach(template => {
        expect(html).toContain(template)
      })
    })

    it('should have agent template cards with capabilities', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('reasoning:')
      expect(html).toContain('creativity:')
      expect(html).toContain('technical:')
      expect(html).toContain('communication:')
    })
  })

  describe('Agent Studio Real Data Integration', () => {
    it('should verify agents from API can be loaded by studio', async () => {
      // Get agents from API
      const response = await fetch(`${baseUrl}/api/agents`)
      const agents = await response.json() as any[]
      
      expect(agents.length).toBeGreaterThan(0)
      
      // Verify each agent has required fields for studio integration
      agents.forEach((agent: any) => {
        expect(agent).toHaveProperty('id')
        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('primaryRole')
        expect(agent).toHaveProperty('capabilities')
        
        // Verify studio can use these fields
        expect(typeof agent.name).toBe('string')
        expect(typeof agent.primaryRole).toBe('string')
        expect(typeof agent.capabilities).toBe('object')
      })
    })

    it('should have consistent agent roles between API and studio templates', async () => {
      const response = await fetch(`${baseUrl}/api/agents`)
      const agents = await response.json() as any[]
      
      const apiRoles = [...new Set(agents.map((agent: any) => agent.primaryRole))] as string[]
      
      // Get studio HTML to check template roles
      const studioResponse = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await studioResponse.text()
      
      // Basic verification that studio supports various roles
      expect(html).toContain('role:')
      expect(apiRoles.length).toBeGreaterThan(0)
      
      // Verify common roles are supported
      const commonRoles = ['developer', 'analyst', 'manager', 'architect', 'data']
      const hasCommonRoles = apiRoles.some(role => commonRoles.includes(role))
      expect(hasCommonRoles).toBe(true)
    })
  })

  describe('Agent Studio Error Handling', () => {
    it('should handle API fetch errors gracefully in JavaScript', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('catch (error)')
      expect(html).toContain('Failed to load system agents')
      expect(html).toContain('Fallback to sample agents')
      expect(html).toContain('console.error')
    })

    it('should provide user feedback through notifications', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('showNotification')
      expect(html).toContain('Reloaded agents from database')
      expect(html).toContain('Failed to save workflow')
    })
  })

  describe('Agent Studio Canvas Functionality', () => {
    it('should have canvas and agent positioning logic', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('designerCanvas')
      expect(html).toContain('x = 150 + (index * 200)')
      expect(html).toContain('y = 150 + (index % 2) * 200')
      expect(html).toContain('this.createAgent')
    })

    it('should support agent connections and workflow visualization', async () => {
      const response = await fetch(`${baseUrl}/agent-studio.html`)
      const html = await response.text()
      
      expect(html).toContain('connections-svg')
      expect(html).toContain('connections')
      expect(html).toContain('arrowhead')
      expect(html).toContain('isConnecting')
    })
  })
})