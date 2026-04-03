import { jest } from '@jest/globals'
import { JSDOM } from 'jsdom'

describe('Dashboard Frontend', () => {
  let dom: JSDOM
  let document: Document
  let window: Window
  let dashboard: any

  beforeEach(async () => {
    // Create a minimal DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Dashboard Test</title></head>
        <body>
          <nav class="dashboard-nav">
            <button class="nav-btn active" data-section="overview">📊 Overview</button>
            <button class="nav-btn" data-section="specs">📋 Specs</button>
            <button class="nav-btn" data-section="projects">📊 Projects</button>
            <button class="nav-btn" data-section="agents">🤖 Agents</button>
          </nav>
          <main class="dashboard-main">
            <div id="overview-section" class="data-section" style="display: block;">
              <div>Overview content</div>
            </div>
            <div id="specs-section" class="data-section" style="display: none;">
              <div class="section-header">
                <h2>📋 Specifications</h2>
              </div>
              <div id="specs-content">
                <p>Loading specifications...</p>
              </div>
            </div>
            <div id="projects-section" class="data-section" style="display: none;">
              <div id="projects-content">
                <p>Loading projects...</p>
              </div>
            </div>
            <div id="agents-section" class="data-section" style="display: none;">
              <div id="agents-content">
                <p>Loading agents...</p>
              </div>
            </div>
          </main>
        </body>
      </html>
    `, { url: 'http://localhost:3001' })

    document = dom.window.document
    window = dom.window as any

    // Set up global objects
    global.document = document
    global.window = window
    global.WebSocket = jest.fn(() => ({
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: jest.fn(),
      close: jest.fn()
    })) as any

    // Mock fetch
    global.fetch = jest.fn()
  })

  afterEach(() => {
    dom?.window?.close()
  })

  describe('Section Navigation', () => {
    beforeEach(async () => {
      // Load the dashboard class
      const { LLMChargeDashboard } = await import('../../../src/dashboard/js/dashboard-class.js')
      dashboard = new LLMChargeDashboard()
      dashboard.init()
    })

    test('should hide all sections when switching', () => {
      dashboard.switchSection('specs')
      
      const overviewSection = document.getElementById('overview-section')
      const specsSection = document.getElementById('specs-section')
      
      expect(overviewSection?.style.display).toBe('none')
      expect(specsSection?.style.display).toBe('block')
    })

    test('should show correct section when switching', () => {
      dashboard.switchSection('projects')
      
      const projectsSection = document.getElementById('projects-section')
      expect(projectsSection?.style.display).toBe('block')
    })

    test('should update nav button active state', () => {
      dashboard.switchSection('specs')
      
      const specsBtn = document.querySelector('[data-section="specs"]')
      const overviewBtn = document.querySelector('[data-section="overview"]')
      
      expect(specsBtn?.classList.contains('active')).toBe(true)
      expect(overviewBtn?.classList.contains('active')).toBe(false)
    })
  })

  describe('Data Loading', () => {
    beforeEach(async () => {
      const { LLMChargeDashboard } = await import('../../../src/dashboard/js/dashboard-class.js')
      dashboard = new LLMChargeDashboard()
    })

    test('should load specs data and render', async () => {
      const mockSpecs = [
        { id: '1', title: 'Test Spec', description: 'Test description', status: 'active', priority: 'high' }
      ]
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSpecs
      })

      await dashboard.loadSpecs()

      const specsContent = document.getElementById('specs-content')
      expect(specsContent?.innerHTML).toContain('Test Spec')
      expect(specsContent?.innerHTML).toContain('Test description')
    })

    test('should handle API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await dashboard.loadSpecs()

      const specsContent = document.getElementById('specs-content')
      expect(specsContent?.innerHTML).toContain('Failed to load specifications')
    })

    test('should handle empty data', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => []
      })

      await dashboard.loadSpecs()

      const specsContent = document.getElementById('specs-content')
      expect(specsContent?.innerHTML).toContain('No specifications found')
    })
  })

  describe('Content Rendering', () => {
    beforeEach(async () => {
      const { LLMChargeDashboard } = await import('../../../src/dashboard/js/dashboard-class.js')
      dashboard = new LLMChargeDashboard()
    })

    test('should render specs with proper HTML structure', () => {
      const mockSpecs = [
        { 
          id: '1', 
          title: 'Test Spec', 
          description: 'Test description', 
          status: 'active', 
          priority: 'high',
          tags: ['test', 'important']
        },
        { 
          id: '2', 
          title: 'Another Spec', 
          description: 'Another description', 
          status: 'draft', 
          priority: 'medium',
          tags: []
        }
      ]

      dashboard.renderSpecs(mockSpecs)

      const specsContent = document.getElementById('specs-content')
      const dataItems = specsContent?.querySelectorAll('.data-item')
      
      expect(dataItems?.length).toBe(2)
      expect(specsContent?.innerHTML).toContain('Test Spec')
      expect(specsContent?.innerHTML).toContain('Another Spec')
      expect(specsContent?.innerHTML).toContain('data-tag')
    })

    test('should render projects with proper structure', () => {
      const mockProjects = [
        { id: '1', name: 'Test Project', description: 'Test description', key: 'TEST' }
      ]

      dashboard.renderProjects(mockProjects)

      const projectsContent = document.getElementById('projects-content')
      expect(projectsContent?.innerHTML).toContain('Test Project')
      expect(projectsContent?.innerHTML).toContain('TEST')
    })

    test('should render agents with capabilities', () => {
      const mockAgents = [
        { 
          id: '1', 
          name: 'Test Agent', 
          description: 'Test agent description',
          primaryRole: 'tester',
          capabilities: { reasoning: 0.8, creativity: 0.6 }
        }
      ]

      dashboard.renderAgents(mockAgents)

      const agentsContent = document.getElementById('agents-content')
      expect(agentsContent?.innerHTML).toContain('Test Agent')
      expect(agentsContent?.innerHTML).toContain('tester')
    })
  })

  describe('DOM Element Validation', () => {
    test('should have all required section elements', () => {
      expect(document.getElementById('specs-section')).toBeTruthy()
      expect(document.getElementById('projects-section')).toBeTruthy()
      expect(document.getElementById('agents-section')).toBeTruthy()
      expect(document.getElementById('specs-content')).toBeTruthy()
      expect(document.getElementById('projects-content')).toBeTruthy()
      expect(document.getElementById('agents-content')).toBeTruthy()
    })

    test('should have navigation buttons', () => {
      const navButtons = document.querySelectorAll('.nav-btn')
      expect(navButtons.length).toBeGreaterThan(0)
      
      const specsBtn = document.querySelector('[data-section="specs"]')
      expect(specsBtn).toBeTruthy()
    })
  })

  describe('Integration Flow', () => {
    beforeEach(async () => {
      const { LLMChargeDashboard } = await import('../../../src/dashboard/js/dashboard-class.js')
      dashboard = new LLMChargeDashboard()
      dashboard.init()
    })

    test('should complete full data load and display cycle', async () => {
      const mockSpecs = [
        { id: '1', title: 'Integration Test', description: 'Full cycle test', status: 'active', priority: 'high' }
      ]
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSpecs
      })

      // Switch to specs section
      dashboard.switchSection('specs')
      
      // Verify section is shown
      const specsSection = document.getElementById('specs-section')
      expect(specsSection?.style.display).toBe('block')
      
      // Verify data loads and renders
      await dashboard.loadSpecs()
      const specsContent = document.getElementById('specs-content')
      expect(specsContent?.innerHTML).toContain('Integration Test')
    })
  })
})