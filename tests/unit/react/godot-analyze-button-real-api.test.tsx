import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { ProjectProvider } from '../../../src/react/store/project-store'
import { GodotMCPSection } from '../../../src/react/pages/sections/GodotMCPSection'
import '@testing-library/jest-dom'

jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getProject: jest.fn(),
    getProjects: jest.fn().mockResolvedValue([]),
  }
}))

const { apiClient } = require('../../../src/react/lib/api-client')

const makeToolsList = () => ({
  tools: [
    { name: 'godot_scene_analyzer', description: 'Analyze scenes', category: 'Game Dev', isActive: true, usageCount: 0, inputSchema: { properties: {} } },
    { name: 'gdscript_optimizer', description: 'Optimize scripts', category: 'Game Dev', isActive: true, usageCount: 0, inputSchema: { properties: {} } },
    { name: 'component_generator', description: 'Generate components', category: 'Game Dev', isActive: true, usageCount: 0, inputSchema: { properties: {} } },
    { name: 'godot_project_analyzer', description: 'Analyze project', category: 'Game Dev', isActive: true, usageCount: 0, inputSchema: { properties: {} } },
  ],
})

const makeMCPStatus = () => ({
  isHealthy: true,
  tools: { total: 4, totalCalls: 0, errors: 0, errorRate: 0, mostUsed: [] },
})

const makeProjectResult = (name = 'My Game') => ({
  success: true,
  data: {
    name, path: '/my/godot/project', version: '4.2', isValid: true,
    scenes: { total: 5, mainScene: 'Main.tscn', autoloadScenes: 0 },
    scripts: { total: 3, gdscriptCount: 3, csharpCount: 0, errors: 0 },
    assets: { textures: 10, sounds: 2, models: 1, animations: 4, totalSize: 15.0 },
    exportSettings: { platforms: [], lastBuildTime: null, buildStatus: 'none' },
  },
})

function createFetchMock(overrides: Record<string, any> = {}) {
  return jest.fn((url: string) => {
    for (const [key, value] of Object.entries(overrides)) {
      if (url.includes(key)) return Promise.resolve(value)
    }
    if (url.includes('/mcp/tools')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeToolsList()) })
    if (url.includes('/mcp/status')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeMCPStatus()) })
    if (url.includes('/mcp/call/godot_project_analyzer')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeProjectResult()) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as jest.Mock
}

describe('Godot Analyze Button - Real API Integration', () => {
  let queryClient: QueryClient
  const originalFetch = global.fetch

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    apiClient.getProject.mockResolvedValue({ id: 'proj-1', codeGraphPath: '/my/godot/project' })
    global.fetch = createFetchMock()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  const renderSection = () => {
    return render(
      <ThemeProvider>
        <ProjectProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <GodotMCPSection />
            </MemoryRouter>
          </QueryClientProvider>
        </ProjectProvider>
      </ThemeProvider>
    )
  }

  test('should call godot_project_analyzer API when Analyze Project is clicked', async () => {
    renderSection()
    await waitFor(() => {
      expect(screen.getByText('Analyze Project')).toBeInTheDocument()
    })

    const freshFetch = createFetchMock()
    global.fetch = freshFetch

    fireEvent.click(screen.getByText('Analyze Project'))

    await waitFor(() => {
      const calls = freshFetch.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_project_analyzer')
      )
      expect(calls.length).toBeGreaterThan(0)
      expect(calls[0][1].method).toBe('POST')
      const body = JSON.parse(calls[0][1].body)
      expect(body.projectPath).toBe('/my/godot/project')
    })
  })

  test('should handle API error gracefully without crashing', async () => {
    renderSection()
    await waitFor(() => {
      expect(screen.getByText('Analyze Project')).toBeInTheDocument()
    })

    global.fetch = createFetchMock({
      '/mcp/call/godot_project_analyzer': { ok: false, status: 500, statusText: 'Internal Server Error' },
    })

    fireEvent.click(screen.getByText('Analyze Project'))

    // After error, button should return to normal state (not stuck in loading)
    await waitFor(() => {
      expect(screen.getByText('Analyze Project')).toBeInTheDocument()
      expect(screen.queryByText('Analyzing...')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  test('should show loading state during API call', async () => {
    renderSection()
    await waitFor(() => {
      expect(screen.getByText('Analyze Project')).toBeInTheDocument()
    })

    let resolveAnalyzer!: (value: any) => void
    const pending = new Promise((resolve) => { resolveAnalyzer = resolve })

    global.fetch = jest.fn((url: string) => {
      if (url.includes('/mcp/call/godot_project_analyzer')) return pending
      if (url.includes('/mcp/tools')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeToolsList()) })
      if (url.includes('/mcp/status')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeMCPStatus()) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }) as jest.Mock

    fireEvent.click(screen.getByText('Analyze Project'))

    await waitFor(() => {
      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    })

    resolveAnalyzer({ ok: true, json: () => Promise.resolve(makeProjectResult('Done')) })

    await waitFor(() => {
      expect(screen.queryByText('Analyzing...')).not.toBeInTheDocument()
    })
  })

  test('should send projectPath from the selected project', async () => {
    apiClient.getProject.mockResolvedValue({ id: 'proj-custom', codeGraphPath: '/custom/path/to/game' })

    renderSection()

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('/mcp/call/godot_project_analyzer')
      )
      expect(calls.length).toBeGreaterThan(0)
      const body = JSON.parse(calls[0][1].body)
      expect(body.projectPath).toBe('/custom/path/to/game')
    })
  })
})
