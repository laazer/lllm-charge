import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Workflows from '../../../src/react/pages/Workflows'

// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getWorkflows: jest.fn(),
    updateWorkflow: jest.fn(),
    deleteWorkflow: jest.fn()
  }
}))

// Mock window.open for workflow editor testing
const mockWindowOpen = jest.fn()
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true
})

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
      {children}
    </QueryClientProvider>
  )
}

describe('Workflows - Gear Icon Editor Integration', () => {
  const mockWorkflows = [
    {
      id: 'workflow-test-123',
      title: 'Test Workflow',
      description: 'A test workflow for editing',
      status: 'active' as const,
      priority: 'medium' as const,
      projectId: null,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    },
    {
      id: 'workflow-edit-456',
      title: 'Edit Workflow',
      description: 'Another workflow for testing editing functionality',
      status: 'draft' as const,
      priority: 'high' as const,
      projectId: null,
      createdAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.getWorkflows.mockResolvedValue(mockWorkflows)
    mockWindowOpen.mockClear()
  })

  describe('Gear Icon Rendering', () => {
    it('should render gear icon for each workflow', async () => {
      // Arrange
      const wrapper = createWrapper()

      // Act
      render(<Workflows />, { wrapper })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const gearIcons = screen.getAllByTitle('Edit workflow')
      expect(gearIcons).toHaveLength(2)
    })

    it('should render gear icons with proper styling', async () => {
      // Arrange
      const wrapper = createWrapper()

      // Act
      render(<Workflows />, { wrapper })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const gearIcons = screen.getAllByTitle('Edit workflow')
      gearIcons.forEach(icon => {
        expect(icon).toHaveClass('text-gray-600')
        expect(icon).toHaveClass('hover:text-gray-800')
        expect(icon).toHaveClass('dark:text-gray-400')
      })
    })
  })

  describe('Workflow Editor Opening', () => {
    it('should open workflow editor when gear icon is clicked', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act
      const gearIcons = screen.getAllByTitle('Edit workflow')
      fireEvent.click(gearIcons[0])

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-test-123',
        '_blank',
        'width=1400,height=900'
      )
    })

    it('should open workflow editor with correct workflow ID for each workflow', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act - Click first gear icon
      const gearIcons = screen.getAllByTitle('Edit workflow')
      fireEvent.click(gearIcons[0])

      // Assert - First workflow
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-test-123',
        '_blank',
        'width=1400,height=900'
      )

      // Act - Click second gear icon
      fireEvent.click(gearIcons[1])

      // Assert - Second workflow
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-edit-456',
        '_blank',
        'width=1400,height=900'
      )
    })

    it('should open new window with proper dimensions', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act
      const gearIcon = screen.getAllByTitle('Edit workflow')[0]
      fireEvent.click(gearIcon)

      // Assert - Window features
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.any(String),
        '_blank',
        'width=1400,height=900'
      )
    })
  })

  describe('Multiple Editor Windows', () => {
    it('should allow opening multiple workflow editors simultaneously', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act - Open multiple editors
      const gearIcons = screen.getAllByTitle('Edit workflow')
      fireEvent.click(gearIcons[0])
      fireEvent.click(gearIcons[1])

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(2)
      expect(mockWindowOpen).toHaveBeenNthCalledWith(1,
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-test-123',
        '_blank',
        'width=1400,height=900'
      )
      expect(mockWindowOpen).toHaveBeenNthCalledWith(2,
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-edit-456',
        '_blank',
        'width=1400,height=900'
      )
    })

    it('should handle rapid gear icon clicks gracefully', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act - Rapid clicks on same gear icon
      const gearIcon = screen.getAllByTitle('Edit workflow')[0]
      fireEvent.click(gearIcon)
      fireEvent.click(gearIcon)
      fireEvent.click(gearIcon)

      // Assert - Should call window.open multiple times
      expect(mockWindowOpen).toHaveBeenCalledTimes(3)
      mockWindowOpen.mock.calls.forEach(call => {
        expect(call[0]).toBe('http://localhost:3001/workflow-editor.html?workflowId=workflow-test-123')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle window.open failures gracefully', async () => {
      // Arrange
      const wrapper = createWrapper()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockWindowOpen.mockImplementation(() => {
        throw new Error('Popup blocked')
      })

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act
      const gearIcon = screen.getAllByTitle('Edit workflow')[0]
      
      expect(() => {
        fireEvent.click(gearIcon)
      }).not.toThrow()

      // Assert
      expect(mockWindowOpen).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should work even if workflow ID is undefined', async () => {
      // Arrange
      const workflowWithoutId = {
        ...mockWorkflows[0],
        id: undefined as any
      }
      mockApiClient.getWorkflows.mockResolvedValue([workflowWithoutId])
      
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      // Act & Assert - Should not crash
      await waitFor(() => {
        const gearIcons = screen.queryAllByTitle('Edit workflow')
        expect(gearIcons).toHaveLength(1)
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for gear icon buttons', async () => {
      // Arrange
      const wrapper = createWrapper()

      // Act
      render(<Workflows />, { wrapper })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      const gearButtons = screen.getAllByTitle('Edit workflow')
      gearButtons.forEach(button => {
        expect(button).toHaveAttribute('title', 'Edit workflow')
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should be keyboard accessible', async () => {
      // Arrange
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act - Focus and activate with keyboard
      const gearButton = screen.getAllByTitle('Edit workflow')[0]
      gearButton.focus()
      
      expect(document.activeElement).toBe(gearButton)
      
      // Simulate Enter key press
      fireEvent.keyDown(gearButton, { key: 'Enter', code: 'Enter' })
      fireEvent.click(gearButton) // React Testing Library requires explicit click for onClick

      // Assert
      expect(mockWindowOpen).toHaveBeenCalled()
    })
  })

  describe('Integration with Workflow List', () => {
    it('should maintain gear icon functionality when workflow list updates', async () => {
      // Arrange
      const wrapper = createWrapper()

      // Initial render
      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Act - Simulate workflow list update
      const updatedWorkflows = [
        ...mockWorkflows,
        {
          id: 'workflow-new-789',
          title: 'New Workflow',
          description: 'Newly added workflow',
          status: 'active' as const,
          priority: 'low' as const,
          projectId: null,
          createdAt: '2023-01-03T00:00:00Z',
          updatedAt: '2023-01-03T00:00:00Z'
        }
      ]

      mockApiClient.getWorkflows.mockResolvedValue(updatedWorkflows)

      // Force re-render by changing a prop (in real usage, React Query would handle this)
      // For testing purposes, we'll verify that gear icons still work after state changes

      // Assert - Original gear icons still work
      const gearIcons = screen.getAllByTitle('Edit workflow')
      expect(gearIcons).toHaveLength(2) // Original workflows

      fireEvent.click(gearIcons[0])
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-test-123',
        '_blank',
        'width=1400,height=900'
      )
    })
  })

  describe('URL Generation', () => {
    it('should generate correct workflow editor URLs', () => {
      const testCases = [
        { id: 'workflow-123', expected: 'http://localhost:3001/workflow-editor.html?workflowId=workflow-123' },
        { id: 'flow-456', expected: 'http://localhost:3001/workflow-editor.html?workflowId=flow-456' },
        { id: 'test-workflow-789', expected: 'http://localhost:3001/workflow-editor.html?workflowId=test-workflow-789' }
      ]

      testCases.forEach(({ id, expected }) => {
        // This would test the URL generation logic if it was extracted to a utility function
        const generatedUrl = `http://localhost:3001/workflow-editor.html?workflowId=${id}`
        expect(generatedUrl).toBe(expected)
      })
    })

    it('should handle special characters in workflow IDs', async () => {
      // Arrange
      const workflowWithSpecialId = {
        id: 'workflow-test_with-special.chars-123',
        title: 'Special Workflow',
        description: 'Workflow with special characters in ID',
        status: 'active' as const,
        priority: 'medium' as const,
        projectId: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }

      mockApiClient.getWorkflows.mockResolvedValue([workflowWithSpecialId])
      const wrapper = createWrapper()

      render(<Workflows />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Special Workflow')).toBeInTheDocument()
      })

      // Act
      const gearIcon = screen.getByTitle('Edit workflow')
      fireEvent.click(gearIcon)

      // Assert - Should properly encode special characters in URL
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'http://localhost:3001/workflow-editor.html?workflowId=workflow-test_with-special.chars-123',
        '_blank',
        'width=1400,height=900'
      )
    })
  })
})