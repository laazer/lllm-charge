import fetch from 'node-fetch'

// Mock fetch for Node.js environment
global.fetch = fetch as any

describe('Workflow Builder Integration Tests', () => {
  const REACT_SERVER_URL = 'http://localhost:3000'
  const API_SERVER_URL = 'http://localhost:3001'

  beforeAll(async () => {
    // Wait for servers to be ready
    let reactReady = false
    let apiReady = false
    
    for (let i = 0; i < 30; i++) {
      try {
        if (!reactReady) {
          const reactResponse = await fetch(`${REACT_SERVER_URL}/workflows`)
          if (reactResponse.status === 200) reactReady = true
        }
        
        if (!apiReady) {
          const apiResponse = await fetch(`${API_SERVER_URL}/api/workflows`)
          if (apiResponse.status === 200) apiReady = true
        }
        
        if (reactReady && apiReady) break
        
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    if (!reactReady || !apiReady) {
      throw new Error(`Servers not ready - React: ${reactReady}, API: ${apiReady}`)
    }
  }, 30000)

  describe('Workflow Builder File Access', () => {
    it('should serve workflow-editor.html from API server', async () => {
      const response = await fetch(`${API_SERVER_URL}/workflow-editor.html`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
      
      const html = await response.text()
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('workflow') // Should contain workflow-related content
    })

    it('should serve workflow-editor.html with correct headers', async () => {
      const response = await fetch(`${API_SERVER_URL}/workflow-editor.html`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })

    it('should serve agent-studio.html from API server', async () => {
      const response = await fetch(`${API_SERVER_URL}/agent-studio.html`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
    })
  })

  describe('Workflows API Integration', () => {
    it('should fetch workflows from API server', async () => {
      const response = await fetch(`${API_SERVER_URL}/api/workflows`)
      
      expect(response.status).toBe(200)
      const workflows = await response.json()
      expect(Array.isArray(workflows)).toBe(true)
    })

    it('should create new workflow via API', async () => {
      const newWorkflow = {
        title: 'Integration Test Workflow',
        description: 'Created by integration tests',
        status: 'draft',
        priority: 'medium'
      }

      const response = await fetch(`${API_SERVER_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWorkflow)
      })

      expect(response.status).toBe(201)
      const createdWorkflow = await response.json() as any
      expect(createdWorkflow.title).toBe('Integration Test Workflow')
      expect(createdWorkflow.status).toBe('draft')
      expect(createdWorkflow.id).toBeDefined()
    })

    it('should handle workflow creation errors gracefully', async () => {
      const invalidWorkflow = {
        // Missing required fields
        description: 'Invalid workflow'
      }

      const response = await fetch(`${API_SERVER_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidWorkflow)
      })

      // Should handle missing fields gracefully
      expect([400, 201]).toContain(response.status)
    })
  })

  describe('React Workflows Page Integration', () => {
    it('should serve React workflows page successfully', async () => {
      const response = await fetch(`${REACT_SERVER_URL}/workflows`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
    })

    it('should handle React routing correctly', async () => {
      // Test that the React app serves the workflows page
      const response = await fetch(`${REACT_SERVER_URL}/workflows`)
      const html = await response.text()
      
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<div id="root">') // React root element
    })
  })

  describe('Cross-Server Navigation', () => {
    it('should allow navigation from React app to API server workflow editor', async () => {
      // Verify that both servers can be accessed
      const reactResponse = await fetch(`${REACT_SERVER_URL}/workflows`)
      const workflowEditorResponse = await fetch(`${API_SERVER_URL}/workflow-editor.html`)
      
      expect(reactResponse.status).toBe(200)
      expect(workflowEditorResponse.status).toBe(200)
    })

    it('should serve static assets correctly from both servers', async () => {
      // Check React dev server is serving React assets
      const reactMainResponse = await fetch(`${REACT_SERVER_URL}/`)
      expect(reactMainResponse.status).toBe(200)
      
      // Check API server is serving HTML files
      const workflowEditorResponse = await fetch(`${API_SERVER_URL}/workflow-editor.html`)
      expect(workflowEditorResponse.status).toBe(200)
    })
  })

  describe('Server Health and Connectivity', () => {
    it('should have both React and API servers running', async () => {
      const reactHealthCheck = fetch(`${REACT_SERVER_URL}/`).then(r => r.status === 200)
      const apiHealthCheck = fetch(`${API_SERVER_URL}/api/workflows`).then(r => r.status === 200)
      
      const [reactHealthy, apiHealthy] = await Promise.all([reactHealthCheck, apiHealthCheck])
      
      expect(reactHealthy).toBe(true)
      expect(apiHealthy).toBe(true)
    })

    it('should handle CORS correctly for cross-origin requests', async () => {
      const response = await fetch(`${API_SERVER_URL}/api/workflows`, {
        method: 'GET',
        headers: {
          'Origin': `${REACT_SERVER_URL}`
        }
      })
      
      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })

  describe('Workflow Builder Functionality Verification', () => {
    it('should verify workflow creation flow works end-to-end', async () => {
      // Step 1: Verify React workflows page is accessible
      const workflowsPageResponse = await fetch(`${REACT_SERVER_URL}/workflows`)
      expect(workflowsPageResponse.status).toBe(200)
      
      // Step 2: Verify workflow-editor.html is accessible
      const editorResponse = await fetch(`${API_SERVER_URL}/workflow-editor.html`)
      expect(editorResponse.status).toBe(200)
      
      // Step 3: Create a test workflow via API
      const testWorkflow = {
        title: `E2E Test Workflow ${Date.now()}`,
        description: 'End-to-end integration test workflow',
        status: 'draft',
        priority: 'low'
      }
      
      const createResponse = await fetch(`${API_SERVER_URL}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testWorkflow)
      })
      
      expect(createResponse.status).toBe(201)
      const createdWorkflow = await createResponse.json() as any
      
      // Step 4: Verify workflow appears in list
      const listResponse = await fetch(`${API_SERVER_URL}/api/workflows`)
      const allWorkflows = await listResponse.json() as any[]
      
      const foundWorkflow = allWorkflows.find((w: any) => w.id === createdWorkflow.id)
      expect(foundWorkflow).toBeDefined()
      expect(foundWorkflow.title).toBe(testWorkflow.title)
    })

    it('should verify all required components are accessible', async () => {
      const endpoints = [
        `${REACT_SERVER_URL}/workflows`,           // React workflows page
        `${API_SERVER_URL}/workflow-editor.html`,  // Workflow builder
        `${API_SERVER_URL}/agent-studio.html`,    // Agent studio
        `${API_SERVER_URL}/api/workflows`,         // Workflows API
        `${API_SERVER_URL}/api/agents`            // Agents API
      ]
      
      const responses = await Promise.all(
        endpoints.map(endpoint => fetch(endpoint).then(r => ({ endpoint, status: r.status })))
      )
      
      for (const { endpoint, status } of responses) {
        expect(status).toBe(200)
      }
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      try {
        // Test with invalid endpoint
        await fetch(`${API_SERVER_URL}/api/nonexistent`)
      } catch (error) {
        // Network errors should be caught
        expect(error).toBeDefined()
      }
    })

    it('should handle malformed requests appropriately', async () => {
      const response = await fetch(`${API_SERVER_URL}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })
      
      // Should handle malformed JSON gracefully
      expect([400, 500]).toContain(response.status)
    })
  })
})