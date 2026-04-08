import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

describe('GodotMCPSection', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    })
    sessionStorage.removeItem('llm-charge-godot-dashboard-v1')
    sessionStorage.removeItem('llm-charge-godot-dashboard-v2')
    jest.clearAllMocks()
  })

  const renderGodotSection = () =>
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

  test('renders header and empty project state without mock game title', async () => {
    renderGodotSection()
    await waitFor(() => {
      expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
      expect(
        screen.getByText(/Run MCP tools against your project; summaries below update from real responses/)
      ).toBeInTheDocument()
      expect(screen.getByTestId('godot-empty-project')).toBeInTheDocument()
      expect(screen.queryByText('My Awesome Game')).not.toBeInTheDocument()
    })
  })

  test('lists four registered MCP tools', async () => {
    renderGodotSection()
    await waitFor(() => {
      const table = screen.getByRole('table')
      expect(within(table).getByText('godot_project_analyzer')).toBeInTheDocument()
      expect(within(table).getByText('godot_scene_analyzer')).toBeInTheDocument()
      expect(within(table).getByText('gdscript_optimizer')).toBeInTheDocument()
      expect(within(table).getByText('component_generator')).toBeInTheDocument()
    })
    expect(screen.queryByText('asset_optimizer')).not.toBeInTheDocument()
    expect(screen.queryByText('export_builder')).not.toBeInTheDocument()
  })

  test('shows metric row with dashes until tools populate data', async () => {
    renderGodotSection()
    await waitFor(() => {
      expect(screen.getByText('Scene load (last run)')).toBeInTheDocument()
      expect(screen.getByText('Scene memory (last run)')).toBeInTheDocument()
    })
    const dashCells = screen.getAllByText('—')
    expect(dashCells.length).toBeGreaterThanOrEqual(2)
  })

  test('recent runs empty until user runs a tool', async () => {
    renderGodotSection()
    await waitFor(() => {
      expect(screen.getByText('Recent tool runs')).toBeInTheDocument()
      expect(screen.getByText(/No runs yet/)).toBeInTheDocument()
    })
  })

  test('opens tool modal from table row', async () => {
    renderGodotSection()
    await waitFor(() => {
      const table = screen.getByRole('table')
      const row = within(table).getByText('godot_scene_analyzer').closest('tr')
      expect(row).toBeTruthy()
      fireEvent.click(row!)
    })
    await waitFor(() => {
      expect(screen.getByText('Godot Tool: godot_scene_analyzer')).toBeInTheDocument()
    })
  })

  test('closes modal via close button', async () => {
    renderGodotSection()
    await waitFor(() => {
      const table = screen.getByRole('table')
      fireEvent.click(within(table).getByText('godot_scene_analyzer').closest('tr')!)
    })
    const closeButton = await screen.findByRole('button', { name: /close modal/i })
    fireEvent.click(closeButton)
    await waitFor(() => {
      expect(screen.queryByText('Godot Tool: godot_scene_analyzer')).not.toBeInTheDocument()
    })
  })

  test('Analyze Project and Reload saved session buttons present', async () => {
    renderGodotSection()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Analyze Project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reload saved session/i })).toBeInTheDocument()
    })
  })

  test('project path input uses updated placeholder', async () => {
    renderGodotSection()
    await waitFor(() => {
      expect(screen.getByPlaceholderText('/absolute/path/to/godot-project')).toBeInTheDocument()
    })
  })
})
