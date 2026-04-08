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
      get: () => Icon,
    }
  )
})

jest.mock('../../../src/react/components/ui/FileBrowser', () => ({
  __esModule: true,
  default: () => null,
}))

describe('Godot Analyze Project — API payload', () => {
  let queryClient: QueryClient
  let fetchMock: jest.Mock

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    sessionStorage.removeItem('llm-charge-godot-dashboard-v1')
    sessionStorage.removeItem('llm-charge-godot-dashboard-v2')
    fetchMock = jest.fn()
    global.fetch = fetchMock
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete (global as unknown as { fetch?: typeof fetch }).fetch
  })

  const renderSection = () =>
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

  test('posts godot_project_analyzer with projectPath when path is set', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { name: 'X' },
        message: 'ok',
      }),
    })

    renderSection()

    await waitFor(() => {
      expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
    })

    const root = '/Users/example/godot-game'
    fireEvent.change(screen.getByPlaceholderText('/absolute/path/to/godot-project'), {
      target: { value: root },
    })

    fireEvent.click(screen.getByRole('button', { name: /Analyze Project/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/mcp/call/godot_project_analyzer',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath: root }),
        })
      )
    })
  })
})
