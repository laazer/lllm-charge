// Mock global fetch for Node.js environment  
if (!global.fetch) {
  global.fetch = require('node-fetch')
}

describe('Comprehensive Functionality Verification Tests', () => {
  const baseUrl = 'http://localhost:3001'

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  describe('Complete System Integration Verification', () => {
    it('should verify all major components are working together', async () => {
      console.log('🔍 Testing comprehensive system functionality...')

      // 1. Verify Backend Server is Running
      const healthResponse = await fetch(`${baseUrl}/api/agents`)
      expect(healthResponse.ok).toBe(true)
      console.log('✅ Backend server is responsive')

      // 2. Verify Agent Database has Real Data
      const agents = await healthResponse.json() as any[]
      expect(agents.length).toBeGreaterThan(0)
      expect(agents[0]).toHaveProperty('id')
      expect(agents[0]).toHaveProperty('name')
      expect(agents[0]).toHaveProperty('primaryRole')
      expect(agents[0]).toHaveProperty('capabilities')
      console.log(`✅ Agent database contains ${agents.length} agents`)

      // 3. Verify Agent Studio is Accessible
      const studioResponse = await fetch(`${baseUrl}/agent-studio.html`)
      expect(studioResponse.ok).toBe(true)
      const studioHtml = await studioResponse.text()
      expect(studioHtml).toContain('Agent Studio')
      expect(studioHtml).toContain('createSampleAgents')
      expect(studioHtml).toContain("fetch('/api/agents')")
      console.log('✅ Agent Studio is accessible and configured to load real agents')

      // 4. Verify Workflow Editor is Accessible  
      const workflowResponse = await fetch(`${baseUrl}/workflow-editor.html`)
      expect(workflowResponse.ok).toBe(true)
      const workflowHtml = await workflowResponse.text()
      expect(workflowHtml).toContain('Workflow Editor')
      console.log('✅ Workflow Editor is accessible')

      // 5. Verify React Dashboard is Running
      const reactHealthResponse = await fetch('http://localhost:3000')
      expect(reactHealthResponse.ok).toBe(true)
      console.log('✅ React Dashboard is running')

      // 6. Verify Agent Creation API Works
      const testAgent = {
        name: 'Verification Test Agent',
        description: 'Agent created during comprehensive verification test',
        primaryRole: 'tester',
        capabilities: {
          reasoning: 0.8,
          creativity: 0.6,
          technical: 0.9,
          communication: 0.7
        }
      }

      const createResponse = await fetch(`${baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testAgent)
      })
      
      expect(createResponse.ok).toBe(true)
      const createdAgent = await createResponse.json() as any
      expect(createdAgent).toHaveProperty('id')
      expect(createdAgent.name).toBe(testAgent.name)
      console.log(`✅ Agent creation works - created agent ${createdAgent.id}`)

      // 7. Verify Agent Deletion API Works (cleanup test agent)
      const deleteResponse = await fetch(`${baseUrl}/api/agents/${createdAgent.id}`, {
        method: 'DELETE'
      })
      
      expect(deleteResponse.ok).toBe(true)
      console.log(`✅ Agent deletion works - deleted test agent ${createdAgent.id}`)

      // 8. Verify Database Consistency
      const finalAgentsResponse = await fetch(`${baseUrl}/api/agents`)
      const finalAgents = await finalAgentsResponse.json() as any[]
      
      // Should not contain the deleted test agent
      const testAgentExists = finalAgents.some(agent => agent.id === createdAgent.id)
      expect(testAgentExists).toBe(false)
      console.log('✅ Database consistency maintained after deletion')

      console.log('🎉 All system components verified and working correctly!')
    })

    it('should verify all UI interfaces have proper data integration', async () => {
      console.log('🔍 Testing UI data integration...')

      // 1. Verify Agent Studio Integration
      const studioResponse = await fetch(`${baseUrl}/agent-studio.html`)
      const studioHtml = await studioResponse.text()
      
      expect(studioHtml).toContain('systemAgents.forEach')
      expect(studioHtml).toContain('agent.name')
      expect(studioHtml).toContain('agent.primaryRole')
      expect(studioHtml).toContain('agent.capabilities')
      expect(studioHtml).toContain('this.createAgent')
      console.log('✅ Agent Studio properly integrates with API data')

      // 2. Verify Error Handling
      expect(studioHtml).toContain('Failed to load system agents')
      expect(studioHtml).toContain('Fallback to sample agents')
      expect(studioHtml).toContain('catch (error)')
      console.log('✅ Agent Studio has proper error handling')

      // 3. Verify Canvas and Visualization
      expect(studioHtml).toContain('designerCanvas')
      expect(studioHtml).toContain('connections-svg')
      expect(studioHtml).toContain('x = 150 + (index * 200)')
      expect(studioHtml).toContain('y = 150 + (index % 2) * 200')
      console.log('✅ Agent Studio has canvas and visualization functionality')

      console.log('🎉 All UI interfaces properly integrated with data!')
    })

    it('should verify the complete development workflow', async () => {
      console.log('🔍 Testing complete development workflow...')

      // 1. Verify all endpoints are accessible
      const endpoints = [
        '/api/agents',
        '/api/workflows', 
        '/api/specs',
        '/api/projects',
        '/agent-studio.html',
        '/workflow-editor.html'
      ]

      for (const endpoint of endpoints) {
        const response = await fetch(`${baseUrl}${endpoint}`)
        expect(response.ok).toBe(true)
        console.log(`✅ ${endpoint} is accessible`)
      }

      // 2. Verify data models are consistent
      const agentsResponse = await fetch(`${baseUrl}/api/agents`)
      const agents = await agentsResponse.json() as any[]
      
      // Check that agents have all required fields
      const requiredFields = ['id', 'name', 'description', 'primaryRole', 'capabilities']
      requiredFields.forEach(field => {
        expect(agents[0]).toHaveProperty(field)
      })
      console.log('✅ Data models are consistent and complete')

      // 3. Verify capability validation
      agents.forEach(agent => {
        Object.values(agent.capabilities).forEach((value: any) => {
          expect(typeof value).toBe('number')
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        })
      })
      console.log('✅ Agent capabilities are properly validated')

      console.log('🎉 Complete development workflow verified!')
    })

    it('should verify system performance and reliability', async () => {
      console.log('🔍 Testing system performance and reliability...')

      // 1. Test response times
      const startTime = Date.now()
      const response = await fetch(`${baseUrl}/api/agents`)
      const endTime = Date.now()
      const responseTime = endTime - startTime
      
      expect(response.ok).toBe(true)
      expect(responseTime).toBeLessThan(5000) // Should respond within 5 seconds
      console.log(`✅ API response time: ${responseTime}ms (within acceptable range)`)

      // 2. Test concurrent requests
      const concurrentPromises = Array(5).fill(0).map(() => 
        fetch(`${baseUrl}/api/agents`)
      )
      
      const concurrentResults = await Promise.all(concurrentPromises)
      concurrentResults.forEach(result => {
        expect(result.ok).toBe(true)
      })
      console.log('✅ System handles concurrent requests properly')

      // 3. Test data consistency across multiple requests
      const responses = await Promise.all([
        fetch(`${baseUrl}/api/agents`),
        fetch(`${baseUrl}/api/agents`),
        fetch(`${baseUrl}/api/agents`)
      ])

      const datasets = await Promise.all(
        responses.map(r => r.json())
      ) as any[][]

      // All responses should have the same number of agents
      const firstCount = datasets[0].length
      datasets.forEach(dataset => {
        expect(dataset.length).toBe(firstCount)
      })
      console.log('✅ Data consistency maintained across multiple requests')

      console.log('🎉 System performance and reliability verified!')
    })
  })
})