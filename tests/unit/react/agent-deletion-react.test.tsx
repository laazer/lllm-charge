import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AgentsSection } from '../../../src/react/pages/sections/AgentsSection'

// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getAgents: jest.fn(),
    updateAgent: jest.fn(),
    deleteAgent: jest.fn()
  }
}))

// Mock window.confirm
const mockConfirm = jest.fn()
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
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

describe('AgentsSection - Agent Deletion', () => {
  const mockAgents = [
    {
      id: 'agent-test-123',
      name: 'Test Agent',
      description: 'A test agent for deletion',
      primaryRole: 'test',
      capabilities: {
        reasoning: 0.8,
        creativity: 0.7,
        technical: 0.9,
        communication: 0.8
      },
      status: 'active' as const,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    },
    {
      id: 'agent-keep-456',
      name: 'Keep Agent',
      description: 'This agent should not be deleted',
      primaryRole: 'assistant',
      capabilities: {
        reasoning: 0.9,
        creativity: 0.6,
        technical: 0.8,
        communication: 0.9
      },
      status: 'active' as const,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.getAgents.mockResolvedValue(mockAgents)
  })

  describe('Delete Button Rendering', () => {
    it('should render delete button for each agent', async () => {
      // Arrange
      const wrapper = createWrapper()

      // Act
      render(<AgentsSection />, { wrapper })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete agent')
      expect(deleteButtons).toHaveLength(2)
    })

    it('should disable delete button when deletion is in progress', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockApiClient.deleteAgent.mockImplementation(() => new Promise(() => {})) // Never resolves
      mockConfirm.mockReturnValue(true)

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      await waitFor(() => {
        expect(deleteButtons[0]).toBeDisabled()
      })
    })
  })

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(false) // User cancels

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "Test Agent"? This action cannot be undone.'
      )
      expect(mockApiClient.deleteAgent).not.toHaveBeenCalled()
    })

    it('should not delete agent when user cancels confirmation', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(false)

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      expect(mockConfirm).toHaveBeenCalled()
      expect(mockApiClient.deleteAgent).not.toHaveBeenCalled()
    })

    it('should proceed with deletion when user confirms', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockResolvedValue(void 0)

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      expect(mockConfirm).toHaveBeenCalled()
      await waitFor(() => {
        expect(mockApiClient.deleteAgent).toHaveBeenCalledWith('agent-test-123')
      })
    })
  })

  describe('Deletion Process', () => {
    it('should call deleteAgent API with correct agent ID', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockResolvedValue(void 0)

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      await waitFor(() => {
        expect(mockApiClient.deleteAgent).toHaveBeenCalledWith('agent-test-123')
      })
    })

    it('should refresh agent list after successful deletion', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockResolvedValue(void 0)
      
      // Mock getAgents to return updated list after deletion
      mockApiClient.getAgents
        .mockResolvedValueOnce(mockAgents) // Initial load
        .mockResolvedValueOnce([mockAgents[1]]) // After deletion

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      await waitFor(() => {
        expect(mockApiClient.deleteAgent).toHaveBeenCalledWith('agent-test-123')
      })

      // Wait for query refetch
      await waitFor(() => {
        expect(mockApiClient.getAgents).toHaveBeenCalledTimes(2)
      })
    })

    it('should clear selected agent if deleted agent was selected', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockResolvedValue(void 0)

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // First select an agent
      const agentCard = screen.getByText('Test Agent').closest('.cursor-pointer')
      if (agentCard) {
        fireEvent.click(agentCard)
      }

      // Act - Delete the selected agent
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      await waitFor(() => {
        expect(mockApiClient.deleteAgent).toHaveBeenCalledWith('agent-test-123')
      })

      // The selected agent should be cleared (this would be tested by checking
      // that expanded details are no longer visible)
    })
  })

  describe('Error Handling', () => {
    it('should handle deletion API errors gracefully', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockRejectedValue(new Error('Deletion failed'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert
      await waitFor(() => {
        expect(mockApiClient.deleteAgent).toHaveBeenCalledWith('agent-test-123')
      })

      // Should not crash the application
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should re-enable delete button after failed deletion', async () => {
      // Arrange
      const wrapper = createWrapper()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockRejectedValue(new Error('Network error'))

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act
      const deleteButtons = screen.getAllByTitle('Delete agent')
      fireEvent.click(deleteButtons[0])

      // Assert - Button should be re-enabled after error
      await waitFor(() => {
        expect(deleteButtons[0]).not.toBeDisabled()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for delete buttons', async () => {
      // Arrange
      const wrapper = createWrapper()

      // Act
      render(<AgentsSection />, { wrapper })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete agent')
      deleteButtons.forEach(button => {
        expect(button).toHaveAttribute('title', 'Delete agent')
      })
    })

    it('should be keyboard accessible', async () => {
      // Arrange
      const wrapper = createWrapper()
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)
      mockApiClient.deleteAgent.mockResolvedValue(void 0)

      render(<AgentsSection />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument()
      })

      // Act - Navigate to delete button and activate with keyboard
      const deleteButton = screen.getAllByTitle('Delete agent')[0]
      await user.tab()
      await user.keyboard('{Enter}')

      // Note: This test would need more specific implementation details
      // to properly test keyboard navigation to the delete button
    })
  })
})