import React from 'react'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { ProjectProvider } from '../../../src/react/store/project-store'
import { GodotMCPSection } from '../../../src/react/pages/sections/GodotMCPSection'
import '@testing-library/jest-dom'

jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    getProjects: jest.fn(() =>
      Promise.resolve([
        {
          id: 'main-1773934155652',
          key: 'main',
          name: 'Main',
          description: '',
          lead: '',
          type: 'software',
          codeGraphPath: null,
          createdAt: '',
          updatedAt: ''
        }
      ])
    )
  }
}))

jest.mock('@heroicons/react/24/outline', () => {
  const React = require('react')
  const Icon = () => React.createElement('span', { 'data-testid': 'mock-icon' })
  return new Proxy(
    {},
    {
      get: () => Icon
    }
  )
})

jest.mock('../../../src/react/components/ui/FileBrowser', () => ({
  __esModule: true,
  default: () => null
}))

describe('Godot MCP Dashboard Verification', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    })
    sessionStorage.removeItem('llm-charge-godot-dashboard-v1')
    sessionStorage.removeItem('llm-charge-godot-dashboard-v2')
  })

  const renderGodotDashboard = () =>
    render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ProjectProvider>
            <MemoryRouter>
              <GodotMCPSection />
            </MemoryRouter>
          </ProjectProvider>
        </QueryClientProvider>
      </ThemeProvider>
    )

  test('renders dashboard header and data-driven copy', async () => {
    renderGodotDashboard()
    await waitFor(() => {
      expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
      expect(
        screen.getByText(/Run MCP tools against your project; summaries below update from real responses/)
      ).toBeInTheDocument()
    })
  })

  test('does not show fake project until analyze', async () => {
    renderGodotDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('godot-empty-project')).toBeInTheDocument()
      expect(screen.queryByText('My Awesome Game')).not.toBeInTheDocument()
    })
  })

  test('shows summary metric cards (placeholders until tools run)', async () => {
    renderGodotDashboard()
    await waitFor(() => {
      expect(screen.getByText('Scene load (last run)')).toBeInTheDocument()
      expect(screen.getByText('Scene memory (last run)')).toBeInTheDocument()
      expect(screen.getByText('Export / build hint')).toBeInTheDocument()
      expect(screen.getByText('Asset items (indexed)')).toBeInTheDocument()
    })
  })

  test('asset breakdown hidden until project analyzed', async () => {
    renderGodotDashboard()
    await waitFor(() => {
      expect(screen.queryByText('Textures')).not.toBeInTheDocument()
    })
  })

  test('Godot MCP tools table lists real server tools', async () => {
    renderGodotDashboard()
    await waitFor(() => {
      expect(screen.getByText('Godot MCP tools')).toBeInTheDocument()
      const table = screen.getByRole('table')
      expect(within(table).getByText('godot_project_analyzer')).toBeInTheDocument()
    })
  })

  test('opens tool modal from row click', async () => {
    renderGodotDashboard()
    await waitFor(() => {
      const table = screen.getByRole('table')
      fireEvent.click(within(table).getByText('godot_scene_analyzer').closest('tr')!)
    })
    await waitFor(() => {
      expect(screen.getByText('Godot Tool: godot_scene_analyzer')).toBeInTheDocument()
    })
  })
})
