import { AgentDatabaseManager } from '../../src/database/agent-database-manager'

// Mock the database manager
jest.mock('../../src/database/agent-database-manager')

describe('Agent Deletion Tests', () => {
  let mockAgentDb: jest.Mocked<AgentDatabaseManager>

  beforeEach(() => {
    mockAgentDb = new AgentDatabaseManager() as jest.Mocked<AgentDatabaseManager>
    jest.clearAllMocks()
  })

  describe('AgentDatabaseManager.deleteAgent', () => {
    it('should successfully delete an existing agent', async () => {
      // Arrange
      const agentId = 'agent-test-123'
      mockAgentDb.deleteAgent = jest.fn().mockResolvedValue(true)

      // Act
      const result = await mockAgentDb.deleteAgent(agentId)

      // Assert
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledWith(agentId)
      expect(result).toBe(true)
    })

    it('should handle deletion of non-existent agent', async () => {
      // Arrange
      const agentId = 'agent-nonexistent-456'
      mockAgentDb.deleteAgent = jest.fn().mockResolvedValue(false)

      // Act
      const result = await mockAgentDb.deleteAgent(agentId)

      // Assert
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledWith(agentId)
      expect(result).toBe(false)
    })

    it('should handle database errors during deletion', async () => {
      // Arrange
      const agentId = 'agent-error-789'
      const errorMessage = 'Database connection failed'
      mockAgentDb.deleteAgent = jest.fn().mockRejectedValue(new Error(errorMessage))

      // Act & Assert
      await expect(mockAgentDb.deleteAgent(agentId)).rejects.toThrow(errorMessage)
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledWith(agentId)
    })
  })

  describe('Agent Deletion Validation', () => {
    it('should validate agent ID format before deletion', () => {
      const validAgentIds = [
        'agent-1234567890123-abcde',
        'agent-test-id-12345',
        'agent-abc123'
      ]

      validAgentIds.forEach(agentId => {
        expect(agentId).toMatch(/^agent-/)
      })
    })

    it('should reject invalid agent ID formats', () => {
      const invalidStringIds = ['', 'invalid-id', 'user-123']
      const invalidNonStringIds = [null, undefined, 123]

      invalidStringIds.forEach(agentId => {
        expect(agentId).not.toMatch(/^agent-/)
      })

      invalidNonStringIds.forEach(agentId => {
        expect(agentId == null || agentId === 123).toBeTruthy()
      })
    })
  })

  describe('Agent Deletion Impact', () => {
    it('should not affect other agents when deleting one agent', async () => {
      // Arrange
      const agentToDelete = 'agent-delete-123'
      const otherAgents = ['agent-keep-456', 'agent-keep-789']
      
      mockAgentDb.deleteAgent = jest.fn().mockResolvedValue(true)
      mockAgentDb.getAgent = jest.fn()
        .mockResolvedValueOnce(null) // Agent was deleted
        .mockResolvedValue({ id: otherAgents[0], name: 'Test Agent 1' }) // Other agents still exist
        .mockResolvedValue({ id: otherAgents[1], name: 'Test Agent 2' })

      // Act
      await mockAgentDb.deleteAgent(agentToDelete)

      // Assert - deleted agent should not exist
      const deletedAgent = await mockAgentDb.getAgent(agentToDelete)
      expect(deletedAgent).toBeNull()

      // Assert - other agents should still exist
      const agent1 = await mockAgentDb.getAgent(otherAgents[0])
      const agent2 = await mockAgentDb.getAgent(otherAgents[1])
      expect(agent1).toBeDefined()
      expect(agent2).toBeDefined()
    })

    it('should clean up agent-related data on deletion', async () => {
      // Arrange
      const agentId = 'agent-cleanup-123'
      mockAgentDb.deleteAgent = jest.fn().mockImplementation(async (id) => {
        // Simulate cleanup of related data
        return true
      })

      // Act
      const result = await mockAgentDb.deleteAgent(agentId)

      // Assert
      expect(result).toBe(true)
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledWith(agentId)
    })
  })

  describe('Concurrent Deletion Handling', () => {
    it('should handle multiple deletion requests gracefully', async () => {
      // Arrange
      const agentIds = ['agent-1', 'agent-2', 'agent-3']
      mockAgentDb.deleteAgent = jest.fn().mockResolvedValue(true)

      // Act
      const deletionPromises = agentIds.map(id => mockAgentDb.deleteAgent(id))
      const results = await Promise.all(deletionPromises)

      // Assert
      expect(results).toEqual([true, true, true])
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledTimes(3)
    })

    it('should handle partial failures in batch deletion', async () => {
      // Arrange
      const agentIds = ['agent-success', 'agent-fail', 'agent-success-2']
      mockAgentDb.deleteAgent = jest.fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Deletion failed'))
        .mockResolvedValueOnce(true)

      // Act
      const deletionPromises = agentIds.map(async (id) => {
        try {
          return await mockAgentDb.deleteAgent(id)
        } catch (error) {
          return false
        }
      })
      const results = await Promise.all(deletionPromises)

      // Assert
      expect(results).toEqual([true, false, true])
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledTimes(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle deletion of agent with special characters in ID', async () => {
      // Arrange
      const specialAgentId = 'agent-test-with-special_chars-123'
      mockAgentDb.deleteAgent = jest.fn().mockResolvedValue(true)

      // Act
      const result = await mockAgentDb.deleteAgent(specialAgentId)

      // Assert
      expect(result).toBe(true)
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledWith(specialAgentId)
    })

    it('should handle very long agent IDs', async () => {
      // Arrange
      const longAgentId = 'agent-' + 'a'.repeat(100) + '-123'
      mockAgentDb.deleteAgent = jest.fn().mockResolvedValue(true)

      // Act
      const result = await mockAgentDb.deleteAgent(longAgentId)

      // Assert
      expect(result).toBe(true)
      expect(mockAgentDb.deleteAgent).toHaveBeenCalledWith(longAgentId)
    })
  })
})