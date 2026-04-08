// Unit Test: Godot Error Handling Improvements

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { ProjectProvider } from '../../../src/react/store/project-store'
import { GodotMCPSection } from '../../../src/react/pages/sections/GodotMCPSection'
import '@testing-library/jest-dom'

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

describe('Godot Error Handling Improvements', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    sessionStorage.removeItem('llm-charge-godot-dashboard-v1')
    sessionStorage.removeItem('llm-charge-godot-dashboard-v2')
    global.fetch = jest.fn()
    jest.clearAllMocks()
  })

  const renderComponent = () =>
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

  describe('Project Path Validation', () => {
    it('should show user-friendly error when project path is empty', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze Project/i }))

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toHaveTextContent(/Project Path Required/)
        expect(errorMessage).toHaveTextContent('Please enter or browse to select your Godot project directory')
      })
    })

    it('should display helpful guidance text below project path input', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Directory that contains/)).toBeInTheDocument()
        expect(screen.getAllByText('project.godot').length).toBeGreaterThan(0)
        expect(screen.getByText(/defaults to the/)).toBeInTheDocument()
        expect(screen.getByText(/Changing the path clears cached snapshots/i)).toBeInTheDocument()
      })
    })

    it('should show enhanced error message for invalid Godot project', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Failed to analyze project: Error: No project.godot found - not a valid Godot project',
        }),
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByPlaceholderText('/absolute/path/to/godot-project'), {
        target: { value: '/some/invalid/path' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze Project/i }))

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toHaveTextContent(/Invalid Godot Project/)
        expect(errorMessage).toHaveTextContent('project.godot (required)')
      })
    })

    it('should show browse button with proper tooltip', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTitle('Browse for Godot project directory')).toBeInTheDocument()
      })
    })
  })

  describe('Error Message Enhancement', () => {
    it('should transform technical errors into user-friendly messages', () => {
      const expectedUserFriendlyError = `Invalid Godot Project: The selected directory doesn't contain a 'project.godot' file.

📁 Please select a valid Godot project directory that contains:
   • project.godot (required)
   • scenes/ folder (typically)
   • scripts/ folder (typically)

💡 Tips:
   • Use the Browse button to navigate to your Godot project folder
   • Make sure you select the root directory of your Godot project
   • The project.godot file should be directly in the selected folder`

      expect(expectedUserFriendlyError).toContain('Invalid Godot Project')
      expect(expectedUserFriendlyError).toContain('project.godot (required)')
    })

    it('should provide actionable guidance for empty path errors', () => {
      const expectedGuidance = `Project Path Required: Please enter or browse to select your Godot project directory before running the analysis.

🎯 To get started:
   1. Enter a project path in the text field above, OR
   2. Click the Browse button to select your project folder`

      expect(expectedGuidance).toContain('Project Path Required')
      expect(expectedGuidance).toContain('Browse button')
    })
  })

  describe('User Experience Improvements', () => {
    it('should have proper input field styling and placeholder', async () => {
      renderComponent()
      await waitFor(() => {
        const pathInput = screen.getByPlaceholderText('/absolute/path/to/godot-project')
        expect(pathInput).toBeInTheDocument()
        expect(pathInput).toHaveClass('flex-1')
      })
    })

    it('should show loading state during analysis', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true, data: {} }),
                }),
              80
            )
          )
      )

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByPlaceholderText('/absolute/path/to/godot-project'), {
        target: { value: '/valid/godot/project' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Analyze Project/i }))

      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeInTheDocument()
      })
    })
  })

  describe('Integration with File Browser', () => {
    it('should open file browser when browse button is clicked', async () => {
      renderComponent()
      await waitFor(() => {
        const browseButton = screen.getByTitle('Browse for Godot project directory')
        fireEvent.click(browseButton)
        expect(browseButton).toBeInTheDocument()
      })
    })
  })
})
