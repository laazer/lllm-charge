import { exec } from 'child_process'
import { promisify } from 'util'
import fetch from 'node-fetch'

const execAsync = promisify(exec)

describe('Dashboard Integration Tests', () => {
  const baseUrl = 'http://localhost:3001'
  let serverProcess: any

  beforeAll(async () => {
    console.log('🚀 Starting server for dashboard integration tests...')
    // Give server time to start if not already running
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 30000)

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill()
    }
  })

  describe('Dashboard API Endpoints', () => {
    test('should serve dashboard HTML', async () => {
      const response = await fetch(baseUrl)
      expect(response.status).toBe(200)
      
      const html = await response.text()
      expect(html).toContain('LLM-Charge Dashboard')
      expect(html).toContain('specs-section')
      expect(html).toContain('projects-section')
      expect(html).toContain('agents-section')
      expect(html).toContain('specs-content')
    })

    test('should serve JavaScript modules', async () => {
      const modules = [
        '/js/dashboard-class.js',
        '/js/modals.js', 
        '/js/graph-viewers.js',
        '/js/mcp-tools.js',
        '/js/utils.js'
      ]

      for (const module of modules) {
        const response = await fetch(`${baseUrl}${module}`)
        expect(response.status).toBe(200)
        
        const js = await response.text()
        expect(js.length).toBeGreaterThan(0)
        console.log(`✅ Module ${module}: ${js.length} characters`)
      }
    })

    test('should return specs data from API', async () => {
      const response = await fetch(`${baseUrl}/api/specs`)
      expect(response.status).toBe(200)
      
      const specs = await response.json()
      expect(Array.isArray(specs)).toBe(true)
      expect(specs.length).toBeGreaterThan(0)
      
      const firstSpec = specs[0]
      expect(firstSpec).toHaveProperty('id')
      expect(firstSpec).toHaveProperty('title')
      console.log(`✅ Specs API: ${specs.length} specs returned`)
    })

    test('should return projects data from API', async () => {
      const response = await fetch(`${baseUrl}/api/projects`)
      expect(response.status).toBe(200)
      
      const projects = await response.json()
      expect(Array.isArray(projects)).toBe(true)
      console.log(`✅ Projects API: ${projects.length} projects returned`)
    })

    test('should return agents data from API', async () => {
      const response = await fetch(`${baseUrl}/api/agents`)
      expect(response.status).toBe(200)
      
      const agents = await response.json()
      expect(Array.isArray(agents)).toBe(true)
      console.log(`✅ Agents API: ${agents.length} agents returned`)
    })

    test('should return memory notes from API', async () => {
      const response = await fetch(`${baseUrl}/api/memory/notes`)
      expect(response.status).toBe(200)
      
      const notes = await response.json()
      expect(Array.isArray(notes)).toBe(true)
      console.log(`✅ Notes API: ${notes.length} notes returned`)
    })
  })

  describe('Dashboard HTML Structure', () => {
    test('should have all required DOM elements', async () => {
      const response = await fetch(baseUrl)
      const html = await response.text()

      // Check for navigation
      expect(html).toContain('dashboard-nav')
      expect(html).toContain('data-section="specs"')
      expect(html).toContain('data-section="projects"')
      expect(html).toContain('data-section="agents"')

      // Check for content containers
      expect(html).toContain('id="specs-section"')
      expect(html).toContain('id="projects-section"')
      expect(html).toContain('id="agents-section"')
      expect(html).toContain('id="specs-content"')
      expect(html).toContain('id="projects-content"')
      expect(html).toContain('id="agents-content"')

      // Check for main container
      expect(html).toContain('class="dashboard-main"')
      
      console.log('✅ All required DOM elements present')
    })

    test('should have proper CSS classes for styling', async () => {
      const response = await fetch(baseUrl)
      const html = await response.text()

      expect(html).toContain('.data-section')
      expect(html).toContain('.data-list')
      expect(html).toContain('.data-item')
      expect(html).toContain('.nav-btn')
      
      console.log('✅ CSS classes present for styling')
    })
  })

  describe('API Data Creation', () => {
    test('should be able to create new spec via API', async () => {
      const newSpec = {
        title: 'Dashboard Integration Test Spec',
        description: 'Test spec created by integration test',
        status: 'draft',
        priority: 'medium',
        tags: ['test', 'integration']
      }

      const response = await fetch(`${baseUrl}/api/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSpec)
      })

      expect(response.status).toBe(201 || 200) // Either created or OK
      
      const createdSpec = await response.json()
      expect(createdSpec).toHaveProperty('id')
      expect(createdSpec.title).toBe(newSpec.title)
      
      console.log(`✅ Created spec with ID: ${createdSpec.id}`)
    })
  })

  describe('Database Validation', () => {
    test('should have data in SQLite database', async () => {
      try {
        // This test validates that the database has actual data
        const specs = await fetch(`${baseUrl}/api/specs`).then(r => r.json())
        const projects = await fetch(`${baseUrl}/api/projects`).then(r => r.json())
        const agents = await fetch(`${baseUrl}/api/agents`).then(r => r.json())

        expect(specs.length).toBeGreaterThan(0)
        expect(projects.length).toBeGreaterThan(0) 
        expect(agents.length).toBeGreaterThan(0)

        console.log(`✅ Database has: ${specs.length} specs, ${projects.length} projects, ${agents.length} agents`)
      } catch (error) {
        console.error('❌ Database validation failed:', error)
        throw error
      }
    })
  })
})