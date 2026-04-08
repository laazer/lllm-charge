import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { jest } from '@jest/globals'
import SpecsSection from '../../../../src/react/pages/sections/SpecsSection'
import { ProjectProvider } from '../../../../src/react/store/project-store'
import * as apiClient from '../../../../src/react/lib/api-client'

// Mock the API client
jest.mock('../../../../src/react/lib/api-client', () => ({
  apiClient: {
    getSpecs: jest.fn(),
  },
}))

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  DocumentTextIcon: () => <div data-testid="document-icon">DocumentIcon</div>,
  ClockIcon: () => <div data-testid="clock-icon">ClockIcon</div>,
  TagIcon: () => <div data-testid="tag-icon">TagIcon</div>,
  CheckCircleIcon: () => <div data-testid="check-icon">CheckIcon</div>,
}))

const mockSpecs = [
  {
    id: 'spec-1',
    title: 'Test Specification 1',
    description: 'This is a test specification for unit testing',
    status: 'active' as const,
    priority: 'high' as const,
    tags: ['test', 'unit-test', 'react'],
    projectId: 'test-project-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    assignedAgent: 'test-agent-1',
    linkedClasses: ['TestClass'],
    linkedMethods: ['testMethod'],
    linkedTests: ['test.spec.ts'],
    comments: []
  },
  {
    id: 'spec-2',
    title: 'Test Specification 2',
    description: 'Another test specification with different properties',
    status: 'completed' as const,
    priority: 'medium' as const,
    tags: ['test', 'integration'],
    projectId: 'test-project-2',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    assignedAgent: 'test-agent-2',
    linkedClasses: [],
    linkedMethods: [],
    linkedTests: [],
    comments: []
  },
  {
    id: 'spec-3',
    title: 'Draft Specification',
    description: 'A specification in draft status',
    status: 'draft' as const,
    priority: 'low' as const,
    tags: ['draft', 'planning'],
    projectId: 'test-project-1',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
    linkedClasses: [],
    linkedMethods: [],
    linkedTests: [],
    comments: []
  }
]

const renderSpecsSection = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <SpecsSection />
      </ProjectProvider>
    </QueryClientProvider>
  )
}

describe('SpecsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading skeleton while fetching specs', async () => {
      mockApiClient.getSpecs.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderSpecsSection()

      // Should show loading skeletons
      expect(screen.getAllByTestId(/animate-pulse/i)).toHaveLength(5) // 4 stat cards + 1 table skeleton
    })
  })

  describe('Data Display', () => {
    it('should display specifications with correct statistics', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Specs')).toBeInTheDocument()
      })

      // Check statistics cards
      expect(screen.getByText('3')).toBeInTheDocument() // Total specs
      expect(screen.getByText('1')).toBeInTheDocument() // Draft count
      expect(screen.getByText('1')).toBeInTheDocument() // Active count  
      expect(screen.getByText('1')).toBeInTheDocument() // Completed count
      expect(screen.getByText('0')).toBeInTheDocument() // Archived count (none in mock data)
    })

    it('should display specifications in the data table', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      })

      // Check that all spec titles are displayed
      expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      expect(screen.getByText('Test Specification 2')).toBeInTheDocument()
      expect(screen.getByText('Draft Specification')).toBeInTheDocument()

      // Check status badges
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('draft')).toBeInTheDocument()

      // Check priority display
      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('medium')).toBeInTheDocument()
      expect(screen.getByText('low')).toBeInTheDocument()
    })

    it('should display tags correctly', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument()
      })

      // Check that tags are displayed
      expect(screen.getAllByText('test')).toHaveLength(2) // Appears in 2 specs
      expect(screen.getByText('unit-test')).toBeInTheDocument()
      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('integration')).toBeInTheDocument()
      expect(screen.getByText('draft')).toBeInTheDocument()
      expect(screen.getByText('planning')).toBeInTheDocument()
    })
  })

  describe('Filtering and Search', () => {
    it('should filter specifications by search term', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)
      const user = userEvent.setup()

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      })

      // Search for "Draft"
      const searchInput = screen.getByPlaceholderText('Search specifications...')
      await user.type(searchInput, 'Draft')

      // Should only show the draft specification
      expect(screen.getByText('Draft Specification')).toBeInTheDocument()
      expect(screen.queryByText('Test Specification 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Specification 2')).not.toBeInTheDocument()

      // Should show filtered count
      expect(screen.getByText('Showing 1 of 3 specifications')).toBeInTheDocument()
    })

    it('should filter specifications by status', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)
      const user = userEvent.setup()

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      })

      // Filter by "completed" status
      const statusSelect = screen.getByDisplayValue('All Status')
      await user.selectOptions(statusSelect, 'completed')

      // Should only show completed specification
      expect(screen.getByText('Test Specification 2')).toBeInTheDocument()
      expect(screen.queryByText('Test Specification 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Draft Specification')).not.toBeInTheDocument()

      // Should show filtered count
      expect(screen.getByText('Showing 1 of 3 specifications')).toBeInTheDocument()
    })

    it('should filter specifications by priority', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)
      const user = userEvent.setup()

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      })

      // Filter by "high" priority
      const prioritySelect = screen.getByDisplayValue('All Priority')
      await user.selectOptions(prioritySelect, 'high')

      // Should only show high priority specification
      expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Specification 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Draft Specification')).not.toBeInTheDocument()

      // Should show filtered count
      expect(screen.getByText('Showing 1 of 3 specifications')).toBeInTheDocument()
    })

    it('should combine search and filter criteria', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)
      const user = userEvent.setup()

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      })

      // Search for "Test" and filter by "high" priority
      const searchInput = screen.getByPlaceholderText('Search specifications...')
      await user.type(searchInput, 'Test')

      const prioritySelect = screen.getByDisplayValue('All Priority')
      await user.selectOptions(prioritySelect, 'high')

      // Should only show Test Specification 1 (has "Test" in title and high priority)
      expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Specification 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Draft Specification')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error state when API call fails', async () => {
      mockApiClient.getSpecs.mockRejectedValue(new Error('API Error'))

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Failed to load specifications')).toBeInTheDocument()
      })

      expect(screen.getByText('Please check your connection and try again.')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should handle empty specifications list', async () => {
      mockApiClient.getSpecs.mockResolvedValue([])

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Specs')).toBeInTheDocument()
      })

      // Should show zero counts
      expect(screen.getByText('0')).toBeInTheDocument() // Total should be 0

      // Should show empty results message
      expect(screen.getByText('Showing 0 of 0 specifications')).toBeInTheDocument()
    })
  })

  describe('Data Interactions', () => {
    it('should handle table row clicks', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Test Specification 1')).toBeInTheDocument()
      })

      // Click on a table row (simulate clicking on the spec title)
      fireEvent.click(screen.getByText('Test Specification 1'))

      // Should log the clicked spec (current implementation)
      expect(consoleSpy).toHaveBeenCalledWith('Clicked spec:', 'spec-1')

      consoleSpy.mockRestore()
    })
  })

  describe('Responsive Design', () => {
    it('should render statistics cards in responsive grid', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Specs')).toBeInTheDocument()
      })

      // Check that statistics cards container has responsive grid classes
      const statsContainer = screen.getByText('Total Specs').closest('.grid')
      expect(statsContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-5')
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels and accessibility attributes', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Check search input has proper placeholder
      const searchInput = screen.getByPlaceholderText('Search specifications...')
      expect(searchInput).toHaveAttribute('type', 'text')

      // Check select elements are properly labeled
      expect(screen.getByDisplayValue('All Status')).toBeInTheDocument()
      expect(screen.getByDisplayValue('All Priority')).toBeInTheDocument()
    })

    it('should have proper heading hierarchy', async () => {
      mockApiClient.getSpecs.mockResolvedValue(mockSpecs)

      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Specifications Management')).toBeInTheDocument()
      })

      // Check heading levels
      const mainHeading = screen.getByText('Specifications Management')
      expect(mainHeading.tagName).toBe('H2')
    })
  })

  describe('Performance', () => {
    it('should render efficiently with large datasets', async () => {
      // Create a larger dataset
      const largeSpecsData = Array.from({ length: 100 }, (_, index) => ({
        ...mockSpecs[0],
        id: `spec-${index}`,
        title: `Test Specification ${index}`,
        description: `Description for specification ${index}`,
        projectId: `test-project-${index % 3}`,
      }))

      mockApiClient.getSpecs.mockResolvedValue(largeSpecsData)

      const startTime = performance.now()
      renderSpecsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Specs')).toBeInTheDocument()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time (less than 1000ms)
      expect(renderTime).toBeLessThan(1000)

      // Should show correct total count
      expect(screen.getByText('100')).toBeInTheDocument() // Total specs count
    })
  })
})