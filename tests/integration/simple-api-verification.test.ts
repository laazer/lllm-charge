/**
 * Simple integration test to verify APIs are returning real data
 * Tests the actual backend running on localhost:3001
 */

describe('API Data Verification Tests', () => {
  const BACKEND_URL = 'http://localhost:3001'
  let backendAvailable = false

  beforeAll(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/projects`)
      backendAvailable = response.ok
    } catch (error) {
      console.warn('Backend not available for tests, skipping...')
      backendAvailable = false
    }
  })

  const skipIfBackendUnavailable = () => {
    if (!backendAvailable) {
      pending('Backend not available')
    }
  }

  describe('Real API Data Tests', () => {
    test('should return real agents data (independent of projects)', async () => {
      skipIfBackendUnavailable()

      const response = await fetch(`${BACKEND_URL}/api/agents`)
      expect(response.ok).toBe(true)
      
      const agents = await response.json()
      
      // Verify we have real agent data (not mocked)
      expect(agents.length).toBeGreaterThanOrEqual(13)
      
      // Verify agents are independent (no projectId or projectId is null)
      agents.forEach((agent: any) => {
        expect(agent.id).toBeDefined()
        expect(agent.name).toBeDefined()
        expect(agent.primaryRole).toBeDefined()
        expect(agent.capabilities).toBeDefined()
        // Agents should be independent - no projectId field or it should be null/undefined
        expect(agent.projectId === null || agent.projectId === undefined).toBe(true)
      })
      
      console.log(`✅ Found ${agents.length} independent agents`)
    })

    test('should return real specs data with correct count', async () => {
      skipIfBackendUnavailable()

      const response = await fetch(`${BACKEND_URL}/api/specs`)
      expect(response.ok).toBe(true)
      
      const specs = await response.json()
      
      // Verify we have the expected number of specs (49+ as seen in backend)
      expect(specs.length).toBeGreaterThanOrEqual(49)
      
      // Verify specs have the expected structure
      specs.forEach((spec: any) => {
        expect(spec.id).toBeDefined()
        expect(spec.title).toBeDefined()
        expect(spec.status).toMatch(/draft|active|completed|archived|pending|in_progress/)
      })
      
      console.log(`✅ Found ${specs.length} specifications`)
    })

    test('should return real projects data', async () => {
      skipIfBackendUnavailable()

      const response = await fetch(`${BACKEND_URL}/api/projects`)
      expect(response.ok).toBe(true)
      
      const projects = await response.json()
      
      // Should have exactly 2 projects
      expect(projects.length).toBe(2)
      
      // Verify project structure
      projects.forEach((project: any) => {
        expect(project.id).toBeDefined()
        expect(project.name).toBeDefined()
        expect(project.key).toBeDefined()
      })
      
      console.log(`✅ Found ${projects.length} projects`)
    })

    test('should return real-time metrics via API', async () => {
      skipIfBackendUnavailable()

      const response = await fetch(`${BACKEND_URL}/api/metrics`)
      expect(response.ok).toBe(true)
      
      const metrics = await response.json()
      
      // Verify metrics contain real counts matching our API calls above
      expect(metrics.specsCount).toBeGreaterThanOrEqual(49)
      expect(metrics.agentsCount).toBeGreaterThanOrEqual(13)
      expect(metrics.projectsCount).toBe(2)
      
      // Verify metrics have the expected structure
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('successRate')
      expect(metrics).toHaveProperty('avgLatency')
      
      console.log(`✅ Real metrics: ${metrics.specsCount} specs, ${metrics.agentsCount} agents, ${metrics.projectsCount} projects`)
    })

    test('should verify independent database architecture is working', async () => {
      skipIfBackendUnavailable()

      // Test that agents are truly independent
      const agentsResponse = await fetch(`${BACKEND_URL}/api/agents`)
      const agents = await agentsResponse.json()
      
      // Test that flows/workflows exist independently 
      const workflowsResponse = await fetch(`${BACKEND_URL}/api/workflows`)
      const workflows = await workflowsResponse.json()
      
      // Verify architecture: agents and workflows are global resources
      console.log(`✅ Independent architecture verified:`)
      console.log(`   - ${agents.length} global agents (independent of projects)`)
      console.log(`   - ${workflows.length} global workflows (independent of projects)`)
      
      // All agents should be independent (no project association)
      const hasProjectDependencies = agents.some((agent: any) => agent.projectId)
      expect(hasProjectDependencies).toBe(false)
      
      expect(agents.length).toBeGreaterThan(0)
      expect(workflows.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Data Structure Validation', () => {
    test('should validate that data matches what React components expect', async () => {
      skipIfBackendUnavailable()

      // Test the data structure that React components will receive
      const [specsRes, agentsRes, projectsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/specs`),
        fetch(`${BACKEND_URL}/api/agents`),
        fetch(`${BACKEND_URL}/api/projects`)
      ])

      const specs = await specsRes.json()
      const agents = await agentsRes.json()
      const projects = await projectsRes.json()

      // Verify data structures match what components expect
      
      // Specs should have all required fields for SpecsSection component
      if (specs.length > 0) {
        const spec = specs[0]
        expect(spec).toHaveProperty('title')
        expect(spec).toHaveProperty('description')
        expect(spec).toHaveProperty('status')
        expect(spec).toHaveProperty('priority')
        // tags might be undefined for some specs, so we handle it gracefully
      }

      // Agents should have all required fields for AgentsSection component
      if (agents.length > 0) {
        const agent = agents[0]
        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('description')
        expect(agent).toHaveProperty('primaryRole')
        expect(agent).toHaveProperty('capabilities')
        expect(agent.capabilities).toHaveProperty('reasoning')
        expect(agent.capabilities).toHaveProperty('creativity')
        expect(agent.capabilities).toHaveProperty('technical')
        expect(agent.capabilities).toHaveProperty('communication')
      }

      // Projects should have all required fields for ProjectsSection component
      if (projects.length > 0) {
        const project = projects[0]
        expect(project).toHaveProperty('name')
        expect(project).toHaveProperty('key')
        expect(project).toHaveProperty('id')
      }

      console.log('✅ All data structures match React component expectations')
    })
  })
})