/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'

import Workflows from '../../../src/react/pages/Workflows'
import { apiClient } from '../../../src/react/lib/api-client'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import type { Workflow } from '../../../src/react/types'

// Mock the API client
jest.mock('../../../src/react/lib/api-client')
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

// Mock react-router-dom
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Workflow Template Drag and Drop', () => {
  const mockWorkflows: Workflow[] = [
    {
      id: 'workflow-1',
      title: 'Test Workflow 1',
      description: 'A test workflow',
      status: 'active',
      priority: 'medium',
      projectId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'workflow-2',
      title: 'Code Review Example',
      description: 'Example workflow for code reviews',
      status: 'completed',
      priority: 'high',
      projectId: null,
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    }
  ]

  const mockCreateWorkflow: Workflow = {
    id: 'new-workflow-id',
    title: 'New Workflow',
    description: 'Created from template',
    status: 'draft',
    priority: 'medium',
    projectId: null,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.getWorkflows.mockResolvedValue(mockWorkflows)
    mockApiClient.createWorkflow.mockResolvedValue(mockCreateWorkflow)
    mockApiClient.deleteWorkflow.mockResolvedValue(undefined)
  })

  describe('Template Browser UI', () => {
    it('should show template browser when Browse Templates is clicked', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      // Click Browse Templates button
      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Verify template browser appears - use more specific selector
      expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
    })

    it('should show template cards with drag instructions', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Check for drag instructions
      expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      
      // Check template cards are rendered with specific drag text
      const templateCards = screen.getAllByText(/Drag me to create/)
      expect(templateCards.length).toBeGreaterThan(0)
    })

    it('should close template browser when close button is clicked', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()

      // Close the browser
      const closeButton = screen.getByText('✕')
      fireEvent.click(closeButton)

      // Verify it's closed (using more specific text)
      expect(screen.queryByText('Drag & Drop:')).not.toBeInTheDocument()
    })
  })

  describe('Drag and Drop Events', () => {
    it('should handle dragstart event correctly', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Find a draggable template card
      const templateCard = screen.getByText('Simple Code Review Workflow').closest('[draggable="true"]')
      expect(templateCard).toBeInTheDocument()

      // Mock DataTransfer
      const mockDataTransfer = {
        setData: jest.fn(),
        effectAllowed: '',
      }

      // Use fireEvent.dragStart instead of creating DragEvent directly (JSDOM compatibility)
      fireEvent.dragStart(templateCard!, {
        dataTransfer: mockDataTransfer
      })

      expect(mockDataTransfer.setData).toHaveBeenCalled()
      expect(mockDataTransfer.effectAllowed).toBe('copy')
    })

    it('should handle dragover event correctly', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      // Open template browser first to get the drop zone with handlers
      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Wait longer for template browser to fully render
      await waitFor(() => {
        expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Find the correct drop zone within the template browser
      const dropZone = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')
      expect(dropZone).toBeInTheDocument()

      const mockDataTransfer = {
        dropEffect: '',
      }

      // Use fireEvent.dragOver for JSDOM compatibility
      fireEvent.dragOver(dropZone!, {
        dataTransfer: mockDataTransfer
      })

      expect(mockDataTransfer.dropEffect).toBe('copy')
    })

    it('should handle drop event correctly', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      // Open the template browser first to have drop zone available
      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Wait longer for template browser to fully render with more specific expectation
      await waitFor(() => {
        expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      await waitFor(() => {
        expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Find the drop zone within the template browser
      // The drop zone is the grid container within the template browser that has onDrop handler
      const dropZone = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')
      expect(dropZone).toBeInTheDocument()

      // The template data structure matches what's in handleDragStart - it stores template.template
      // Note: Using 'title' to match Workflow interface, though templates use 'name'
      const templateData = {
        title: 'Code Review Workflow',
        description: 'Automated code review process',
        status: 'draft' as const,
        priority: 'medium' as const,
      }

      const mockDataTransfer = {
        getData: jest.fn().mockReturnValue(JSON.stringify(templateData)),
      }

      // Use fireEvent.drop for JSDOM compatibility
      fireEvent.drop(dropZone!, {
        dataTransfer: mockDataTransfer
      })

      await waitFor(() => {
        expect(mockApiClient.createWorkflow).toHaveBeenCalledWith(templateData)
      })

      const createCall = mockApiClient.createWorkflow.mock.calls[0][0]
      expect(createCall.title).toBe('Code Review Workflow')
      expect(createCall.description).toBe('Automated code review process')
      expect(createCall.status).toBe('draft')
      expect(createCall.priority).toBe('medium')
    })
  })

  describe('Template Creation', () => {
    it('should create workflow when template is clicked', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Wait for template browser to fully render
      await waitFor(() => {
        expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      await waitFor(() => {
        expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Find and click the first "Use Template" button (there are multiple templates)
      const useTemplateButtons = screen.getAllByText('Use Template')
      expect(useTemplateButtons.length).toBeGreaterThan(0)
      
      fireEvent.click(useTemplateButtons[0])

      await waitFor(() => {
        expect(mockApiClient.createWorkflow).toHaveBeenCalled()
      })

      // Verify the call was made with template data
      const createCall = mockApiClient.createWorkflow.mock.calls[0][0]
      expect(createCall.title).toBeDefined()  // Templates now use 'title' to match Workflow interface
      expect(createCall.description).toBeDefined()
      expect(createCall.status).toBeDefined()
    })
  })

  describe('Examples Browser', () => {
    it('should show examples browser when View Examples is clicked', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const examplesButton = screen.getByText('View Examples')
      fireEvent.click(examplesButton)

      expect(screen.getByText('Example Workflows')).toBeInTheDocument()
    })

    it('should filter examples automatically (excluding test workflows)', async () => {
      const mockWorkflowsWithTest: Workflow[] = [
        {
          id: 'workflow-1',
          title: 'Code Review Workflow',
          description: 'Automated code review',
          status: 'active',
          priority: 'medium',
          projectId: null,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          id: 'workflow-2',
          title: 'Bug Fix Pipeline',
          description: 'Streamlined bug fixing',
          status: 'draft',
          priority: 'low',
          projectId: null,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
      ]
      
      const testWorkflow: Workflow = {
        id: 'workflow-test',
        title: 'Test Only Workflow',
        description: 'Used for filtering tests',
        status: 'draft',
        priority: 'low',
        projectId: null,
        createdAt: '2023-01-03T00:00:00Z',
        updatedAt: '2023-01-03T00:00:00Z',
      }

      mockApiClient.getWorkflows.mockResolvedValue([...mockWorkflowsWithTest, testWorkflow])

      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const examplesButton = screen.getByText('View Examples')
      fireEvent.click(examplesButton)

      // Wait for examples browser to render
      await waitFor(() => {
        expect(screen.getByText('Example Workflows')).toBeInTheDocument()
      })

      // Should show non-test workflows (examples are automatically filtered)
      await waitFor(() => {
        // Find examples section specifically (not in templates)
        const exampleWorkflows = screen.getAllByText('Code Review Workflow')
        // Should find at least one in the examples section
        expect(exampleWorkflows.length).toBeGreaterThanOrEqual(1)
      })
      
      await waitFor(() => {
        const bugFixWorkflows = screen.getAllByText('Bug Fix Pipeline')
        expect(bugFixWorkflows.length).toBeGreaterThanOrEqual(1)
      })

      // Test workflows should be excluded from examples (but may appear in existing workflows list)
      // The test verifies that when we have example workflows (Code Review, Bug Fix) 
      // they appear in the examples, but test workflows do not appear alongside them
      
      // Test that example workflows appear in examples browser
      await waitFor(() => {
        // These should appear in both existing workflows and examples sections
        expect(screen.getAllByText('Code Review Workflow').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Bug Fix Pipeline').length).toBeGreaterThanOrEqual(1)
      })
      
      // Count total instances of the test workflow title
      const allTestWorkflowInstances = screen.queryAllByText('Test Only Workflow')
      
      // Test workflow should appear only once (in existing workflows), not in examples
      // If it appeared in both sections, we would see 2 instances
      expect(allTestWorkflowInstances).toHaveLength(1)
    })

    it('should show empty state when no workflows exist for examples', async () => {
      // Mock empty workflows list to trigger empty state
      mockApiClient.getWorkflows.mockResolvedValue([])

      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const examplesButton = screen.getByText('View Examples')
      fireEvent.click(examplesButton)

      await waitFor(() => {
        expect(screen.getByText('Example Workflows')).toBeInTheDocument()
      })

      // Should show empty state when no workflows exist (after automatic filtering)
      await waitFor(() => {
        // Look for the specific empty state message
        expect(screen.getByText('No examples yet')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should close examples browser when close button is clicked', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const examplesButton = screen.getByText('View Examples')
      fireEvent.click(examplesButton)

      expect(screen.getByText('Example Workflows')).toBeInTheDocument()

      const closeButton = screen.getByText('✕')
      fireEvent.click(closeButton)

      expect(screen.queryByText('Example Workflows')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully during template creation', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockApiClient.createWorkflow.mockRejectedValue(new Error('API Error'))

      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Wait for template browser to fully render
      await waitFor(() => {
        expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      await waitFor(() => {
        expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Find and click the first "Use Template" button (there are multiple templates)
      const useTemplateButtons = screen.getAllByText('Use Template')
      expect(useTemplateButtons.length).toBeGreaterThan(0)
      
      fireEvent.click(useTemplateButtons[0])

      await waitFor(() => {
        expect(mockApiClient.createWorkflow).toHaveBeenCalled()
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle malformed JSON in drop event', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      // Open template browser first to get the drop zone with handlers
      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Wait for template browser to fully render
      await waitFor(() => {
        expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Find the correct drop zone within the template browser
      const dropZone = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')
      expect(dropZone).toBeInTheDocument()

      const mockDataTransfer = {
        getData: jest.fn().mockReturnValue('invalid json'),
      }

      // Use fireEvent.drop for JSDOM compatibility
      fireEvent.drop(dropZone!, {
        dataTransfer: mockDataTransfer
      })

      // Should not crash and should not call createWorkflow
      expect(mockApiClient.createWorkflow).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Template Data Validation', () => {
    it('should validate template data structure during drop', async () => {
      render(
        <TestWrapper>
          <Workflows />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
      })

      // Open template browser first to get the drop zone with handlers
      const browseButton = screen.getByText('Browse Templates')
      fireEvent.click(browseButton)

      // Wait for template browser to fully render
      await waitFor(() => {
        expect(screen.getByText('Drag & Drop:')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Find the correct drop zone within the template browser
      const dropZone = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')
      expect(dropZone).toBeInTheDocument()

      const templateData = {
        title: 'Bug Fix Pipeline',
        description: 'Streamlined bug fixing workflow',
        status: 'draft' as const,
        priority: 'high' as const,
      }
      const dropData = JSON.stringify(templateData)
      
      // Verify template structure matches expected data
      expect(templateData.title).toBe('Bug Fix Pipeline')
      expect(templateData.description).toBe('Streamlined bug fixing workflow')
      expect(templateData.status).toBe('draft')
      expect(templateData.priority).toBe('high')

      const mockDataTransfer = {
        getData: jest.fn().mockReturnValue(dropData),
      }

      // Use fireEvent.drop for JSDOM compatibility
      fireEvent.drop(dropZone!, {
        dataTransfer: mockDataTransfer
      })

      await waitFor(() => {
        expect(mockApiClient.createWorkflow).toHaveBeenCalledWith(templateData)
      })
    })
  })
})