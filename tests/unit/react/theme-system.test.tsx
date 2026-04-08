import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SpecsSection from '../../../src/react/pages/sections/SpecsSection'
import AgentsSection from '../../../src/react/pages/sections/AgentsSection'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { ProjectProvider } from '../../../src/react/store/project-store'

// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getSpecs: jest.fn(),
    getAgents: jest.fn(),
    updateSpec: jest.fn(),
    updateAgent: jest.fn()
  }
}))

import { apiClient } from '../../../src/react/lib/api-client'

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Theme System Integration', () => {
  const mockSpecs = [
    {
      id: 'spec-test-123',
      title: 'Test Specification',
      description: 'A test specification for theming',
      status: 'active' as const,
      priority: 'medium' as const,
      tags: ['test', 'theming'],
      projectId: 'main-1773934155652',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ]

  const mockAgents = [
    {
      id: 'agent-test-123',
      name: 'Test Agent',
      description: 'A test agent for theming',
      primaryRole: 'test',
      capabilities: {
        reasoning: 0.8,
        creativity: 0.7,
        technical: 0.9,
        communication: 0.8
      },
      status: 'active' as const,
      projectId: 'main-1773934155652',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.getSpecs.mockResolvedValue(mockSpecs)
    mockApiClient.getAgents.mockResolvedValue(mockAgents)
    
    // Reset localStorage for theme testing
    localStorage.clear()
    
    // Mock matchMedia for system theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  })

  describe('SpecsSection Theme Integration', () => {
    it('should apply light theme classes correctly', async () => {
      // Arrange - Force light theme
      localStorage.setItem('theme', 'light')
      const wrapper = createWrapper()

      // Act
      render(<SpecsSection />, { wrapper })

      // Assert - Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Check main container has light theme classes
      const mainContainer = screen.getByText('Specifications Management').closest('.bg-white')
      expect(mainContainer).toHaveClass('bg-white')
      expect(mainContainer).toHaveClass('dark:bg-gray-800')

      // Check search input has proper light theme classes
      const searchInput = screen.getByPlaceholderText('Search specs...')
      expect(searchInput).toHaveClass('bg-white')
      expect(searchInput).toHaveClass('dark:bg-gray-700')
      expect(searchInput).toHaveClass('text-gray-900')
      expect(searchInput).toHaveClass('dark:text-white')
      expect(searchInput).toHaveClass('border-gray-300')
      expect(searchInput).toHaveClass('dark:border-gray-600')
    })

    it('should apply dark theme classes when dark mode is enabled', async () => {
      // Arrange - Force dark theme
      localStorage.setItem('theme', 'dark')
      document.documentElement.classList.add('dark')
      
      const wrapper = createWrapper()

      // Act
      render(<SpecsSection />, { wrapper })

      // Assert - Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Verify dark theme classes are present
      const heading = screen.getByText('Specifications Management')
      expect(heading).toHaveClass('text-gray-900')
      expect(heading).toHaveClass('dark:text-white')

      // Cleanup
      document.documentElement.classList.remove('dark')
    })

    it('should handle theme switching for filter dropdowns', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<SpecsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Assert - Status filter dropdown has theme classes
      const statusFilter = screen.getByDisplayValue('All Status')
      expect(statusFilter).toHaveClass('bg-white')
      expect(statusFilter).toHaveClass('dark:bg-gray-700')
      expect(statusFilter).toHaveClass('text-gray-900')
      expect(statusFilter).toHaveClass('dark:text-white')
      expect(statusFilter).toHaveClass('border-gray-300')
      expect(statusFilter).toHaveClass('dark:border-gray-600')

      // Priority filter dropdown
      const priorityFilter = screen.getByDisplayValue('All Priority')
      expect(priorityFilter).toHaveClass('bg-white')
      expect(priorityFilter).toHaveClass('dark:bg-gray-700')
      expect(priorityFilter).toHaveClass('text-gray-900')
      expect(priorityFilter).toHaveClass('dark:text-white')
    })

    it('should apply consistent theming to specification cards', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<SpecsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Specification')).toBeInTheDocument()
      })

      const scroll = document.querySelector('.overflow-x-auto')
      const tableShell = scroll?.parentElement
      expect(tableShell).toHaveClass('bg-white')
      expect(tableShell).toHaveClass('dark:bg-slate-800')
    })
  })

  describe('AgentsSection Theme Integration', () => {
    it('should apply light theme classes to agent cards', async () => {
      // Arrange
      localStorage.setItem('theme', 'light')
      const wrapper = createWrapper()

      // Act
      render(<AgentsSection />, { wrapper })

      // Assert - Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Check agent card background
      const agentCard = screen.getByText('Test Agent').closest('.bg-white')
      expect(agentCard).toHaveClass('bg-white')
      expect(agentCard).toHaveClass('dark:bg-gray-800')

      // Check border classes
      expect(agentCard).toHaveClass('border-gray-200')
      expect(agentCard).toHaveClass('dark:border-gray-700')
    })

    it('should handle dark theme for agent capability colors', async () => {
      // Arrange
      localStorage.setItem('theme', 'dark')
      document.documentElement.classList.add('dark')
      
      const wrapper = createWrapper()

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      expect(screen.getByText('Reasoning')).toBeInTheDocument()

      // Cleanup
      document.documentElement.classList.remove('dark')
    })

    it('should apply theme classes to search and filter inputs', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Assert - Search input theming
      const searchInput = screen.getByPlaceholderText('Search agents...')
      expect(searchInput).toHaveClass('bg-white')
      expect(searchInput).toHaveClass('dark:bg-gray-700')
      expect(searchInput).toHaveClass('text-gray-900')
      expect(searchInput).toHaveClass('dark:text-white')
      expect(searchInput).toHaveClass('border-gray-300')
      expect(searchInput).toHaveClass('dark:border-gray-600')

      // Role filter theming
      const roleFilter = screen.getByDisplayValue('All Roles')
      expect(roleFilter).toHaveClass('bg-white')
      expect(roleFilter).toHaveClass('dark:bg-gray-700')
      expect(roleFilter).toHaveClass('text-gray-900')
      expect(roleFilter).toHaveClass('dark:text-white')
    })

    it('should handle expanded agent details theming', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act - Click agent card to expand details
      const agentCard = screen.getByText('Test Agent').closest('.cursor-pointer')
      if (agentCard) {
        fireEvent.click(agentCard)
      }

      await waitFor(() => {
        const expandedContent = document.querySelector('.mt-4.border-t')
        expect(expandedContent).toBeTruthy()
        expect(expandedContent).toHaveClass('border-gray-100')
        expect(expandedContent).toHaveClass('dark:border-gray-700')
      })
    })
  })

  describe('Theme Consistency Across Components', () => {
    it('should maintain consistent color scheme across all form elements', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(
        <div>
          <SpecsSection />
          <AgentsSection />
        </div>,
        { wrapper }
      )

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Assert - All inputs should have consistent theming
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveClass('bg-white')
        expect(input).toHaveClass('dark:bg-gray-700')
        expect(input).toHaveClass('text-gray-900')
        expect(input).toHaveClass('dark:text-white')
        expect(input).toHaveClass('border-gray-300')
        expect(input).toHaveClass('dark:border-gray-600')
      })

      // All select elements should have consistent theming
      const selects = screen.getAllByRole('combobox')
      selects.forEach(select => {
        expect(select).toHaveClass('bg-white')
        expect(select).toHaveClass('dark:bg-gray-700')
        expect(select).toHaveClass('text-gray-900')
        expect(select).toHaveClass('dark:text-white')
      })
    })

    it('should handle focus states consistently across components', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<SpecsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Act - Focus search input
      const searchInput = screen.getByPlaceholderText('Search specs...')
      fireEvent.focus(searchInput)

      // Assert - Focus states should have consistent theming
      expect(searchInput).toHaveClass('focus:ring-2')
      expect(searchInput).toHaveClass('focus:ring-blue-500')
      expect(searchInput).toHaveClass('focus:border-transparent')
    })

    it('should maintain hover state theming consistency', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Assert - Hover classes should be present
      const agentCard = screen.getByText('Test Agent').closest('.cursor-pointer')
      expect(agentCard).toHaveClass('hover:shadow-lg')
      expect(agentCard).toHaveClass('hover:-translate-y-1')
      expect(agentCard).toHaveClass('hover:border-gray-300')
      expect(agentCard).toHaveClass('dark:hover:border-gray-600')
    })
  })

  describe('Theme System Error Handling', () => {
    it('should gracefully handle missing theme classes', async () => {
      // Arrange - Simulate theme provider not available
      const directWrapper = ({ children }: { children: React.ReactNode }) => {
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
          }
        })
        return (
          <QueryClientProvider client={queryClient}>
            <ProjectProvider>{children}</ProjectProvider>
          </QueryClientProvider>
        )
      }

      // Act & Assert - Should not crash without theme provider
      expect(() => {
        render(<SpecsSection />, { wrapper: directWrapper })
      }).not.toThrow()
    })

    it('should handle invalid theme values gracefully', async () => {
      // Arrange - Set invalid theme value
      localStorage.setItem('theme', 'invalid-theme')
      const wrapper = createWrapper()

      // Act & Assert - Should not crash with invalid theme
      expect(() => {
        render(<SpecsSection />, { wrapper })
      }).not.toThrow()

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Theme Design', () => {
    it('should maintain theme consistency across different screen sizes', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<SpecsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Assert - Responsive classes should include dark variants
      const container = screen.getByText('Specifications Management').closest('.rounded-lg')
      expect(container).toHaveClass('bg-white')
      expect(container).toHaveClass('dark:bg-gray-800')
      expect(container).toHaveClass('shadow')
    })

    it('should handle mobile-first theming approach', async () => {
      // Arrange - Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 })
      
      const wrapper = createWrapper()

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      const panel = screen.getByText('Agent Management').closest('.bg-white')
      expect(panel).toHaveClass('bg-white')
      expect(panel).toHaveClass('dark:bg-gray-800')
    })
  })
})