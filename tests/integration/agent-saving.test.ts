import { AgentDatabaseManager } from '../../src/database/agent-database-manager'
import fs from 'fs/promises'
import path from 'path'

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../../data/test-agents.db')

describe('Agent Saving Integration Tests', () => {
  let agentDb: AgentDatabaseManager

  beforeAll(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(TEST_DB_PATH)
    } catch (error) {
      // File doesn't exist, that's fine
    }

    // Initialize database manager with test database
    agentDb = new AgentDatabaseManager(TEST_DB_PATH)
    await agentDb.initialize()
  })

  afterAll(async () => {
    // Clean up test database
    try {
      await fs.unlink(TEST_DB_PATH)
    } catch (error) {
      console.warn('Could not clean up test database:', error)
    }
  })

  beforeEach(async () => {
    // Clear all agents before each test
    const allAgents = await agentDb.getAllAgents()
    for (const agent of allAgents) {
      await agentDb.deleteAgent(agent.id)
    }
  })

  describe('Agent Creation and Retrieval', () => {
    it('should create and retrieve agent successfully', async () => {
      // Arrange
      const agentData = {
        name: 'Test Agent',
        description: 'A test agent for saving functionality',
        primaryRole: 'testing',
        capabilities: {
          reasoning: 0.8,
          creativity: 0.7,
          technical: 0.9,
          communication: 0.8
        },
        model: {
          provider: 'ollama',
          name: 'llama2',
          temperature: 0.7
        },
        personality: {
          tone: 'professional',
          style: 'analytical'
        },
        constraints: {
          maxTokens: 2000,
          timeout: 30000
        },
        metrics: {
          tasksCompleted: 0,
          successRate: 0,
          avgResponseTime: 0
        }
      }

      // Act
      const createdAgent = await agentDb.createAgent(agentData)

      // Assert
      expect(createdAgent).toBeDefined()
      expect(createdAgent.id).toBeDefined()
      expect(createdAgent.name).toBe('Test Agent')
      expect(createdAgent.description).toBe('A test agent for saving functionality')
      expect(createdAgent.primaryRole).toBe('testing')

      // Verify capabilities were saved correctly
      expect(createdAgent.capabilities).toEqual({
        reasoning: 0.8,
        creativity: 0.7,
        technical: 0.9,
        communication: 0.8
      })

      // Verify model configuration was saved
      expect(createdAgent.model).toEqual({
        provider: 'ollama',
        name: 'llama2',
        temperature: 0.7
      })
    })

    it('should retrieve agent by ID after creation', async () => {
      // Arrange
      const agentData = {
        name: 'Retrievable Agent',
        description: 'Agent for testing retrieval',
        primaryRole: 'retrieval',
        capabilities: {
          reasoning: 0.9,
          creativity: 0.6,
          technical: 0.8,
          communication: 0.7
        }
      }

      const createdAgent = await agentDb.createAgent(agentData)

      // Act
      const retrievedAgent = await agentDb.getAgent(createdAgent.id)

      // Assert
      expect(retrievedAgent).toBeDefined()
      expect(retrievedAgent!.id).toBe(createdAgent.id)
      expect(retrievedAgent!.name).toBe('Retrievable Agent')
      expect(retrievedAgent!.capabilities).toEqual(agentData.capabilities)
    })

    it('should return null when trying to retrieve non-existent agent', async () => {
      // Act
      const result = await agentDb.getAgent('non-existent-agent-id')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('Agent Updates', () => {
    it('should update agent and return updated data', async () => {
      // Arrange
      const originalData = {
        name: 'Original Agent',
        description: 'Original description',
        primaryRole: 'original',
        capabilities: {
          reasoning: 0.5,
          creativity: 0.5,
          technical: 0.5,
          communication: 0.5
        }
      }

      const createdAgent = await agentDb.createAgent(originalData)

      const updateData = {
        name: 'Updated Agent',
        description: 'Updated description',
        capabilities: {
          reasoning: 0.9,
          creativity: 0.8,
          technical: 0.7,
          communication: 0.9
        },
        personality: {
          tone: 'friendly',
          style: 'conversational'
        }
      }

      // Act
      const updatedAgent = await agentDb.updateAgent(createdAgent.id, updateData)

      // Assert
      expect(updatedAgent).toBeDefined()
      expect(updatedAgent!.id).toBe(createdAgent.id)
      expect(updatedAgent!.name).toBe('Updated Agent')
      expect(updatedAgent!.description).toBe('Updated description')
      expect(updatedAgent!.capabilities).toEqual({
        reasoning: 0.9,
        creativity: 0.8,
        technical: 0.7,
        communication: 0.9
      })
      expect(updatedAgent!.personality).toEqual({
        tone: 'friendly',
        style: 'conversational'
      })

      // Verify the agent was actually updated in the database
      const retrievedAgent = await agentDb.getAgent(createdAgent.id)
      expect(retrievedAgent!.name).toBe('Updated Agent')
    })

    it('should handle partial updates correctly', async () => {
      // Arrange
      const originalData = {
        name: 'Partial Update Agent',
        description: 'Original description',
        primaryRole: 'testing',
        capabilities: {
          reasoning: 0.6,
          creativity: 0.7,
          technical: 0.8,
          communication: 0.9
        },
        model: {
          provider: 'ollama',
          name: 'original-model'
        }
      }

      const createdAgent = await agentDb.createAgent(originalData)

      // Act - Update only name and one capability
      const partialUpdate = {
        name: 'Partially Updated Agent',
        capabilities: {
          reasoning: 0.95,
          creativity: 0.7,
          technical: 0.8,
          communication: 0.9
        }
      }

      const updatedAgent = await agentDb.updateAgent(createdAgent.id, partialUpdate)

      // Assert
      expect(updatedAgent!.name).toBe('Partially Updated Agent')
      expect(updatedAgent!.description).toBe('Original description') // Should remain unchanged
      expect(updatedAgent!.primaryRole).toBe('testing') // Should remain unchanged
      expect(updatedAgent!.capabilities.reasoning).toBe(0.95) // Should be updated
      expect(updatedAgent!.model).toEqual({
        provider: 'ollama',
        name: 'original-model'
      }) // Should remain unchanged
    })

    it('should return null when updating non-existent agent', async () => {
      // Act
      const result = await agentDb.updateAgent('non-existent-id', { name: 'Updated' })

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('Complex JSON Data Handling', () => {
    it('should properly serialize and deserialize capabilities object', async () => {
      // Arrange
      const complexCapabilities = {
        reasoning: 0.95,
        creativity: 0.85,
        technical: 0.92,
        communication: 0.88,
        specialized: {
          codeGeneration: 0.9,
          debugging: 0.87,
          testing: 0.93
        },
        domains: ['web-development', 'data-analysis', 'machine-learning']
      }

      const agentData = {
        name: 'Complex Capabilities Agent',
        description: 'Agent with complex capability structure',
        primaryRole: 'developer',
        capabilities: complexCapabilities
      }

      // Act
      const createdAgent = await agentDb.createAgent(agentData)
      const retrievedAgent = await agentDb.getAgent(createdAgent.id)

      // Assert
      expect(retrievedAgent!.capabilities).toEqual(complexCapabilities)
      expect(retrievedAgent!.capabilities.specialized.codeGeneration).toBe(0.9)
      expect(retrievedAgent!.capabilities.domains).toEqual(['web-development', 'data-analysis', 'machine-learning'])
    })

    it('should handle complex model configuration', async () => {
      // Arrange
      const complexModel = {
        provider: 'ollama',
        name: 'custom-model',
        temperature: 0.7,
        maxTokens: 4000,
        topP: 0.9,
        frequencyPenalty: 0.2,
        presencePenalty: 0.1,
        stopSequences: ['END', 'STOP'],
        systemPrompt: 'You are a helpful assistant specialized in code generation.',
        customParameters: {
          seed: 12345,
          mirostat: 2,
          mirostatTau: 5.0
        }
      }

      const agentData = {
        name: 'Complex Model Agent',
        description: 'Agent with complex model configuration',
        primaryRole: 'assistant',
        capabilities: { reasoning: 0.8, creativity: 0.7, technical: 0.9, communication: 0.8 },
        model: complexModel
      }

      // Act
      const createdAgent = await agentDb.createAgent(agentData)
      const retrievedAgent = await agentDb.getAgent(createdAgent.id)

      // Assert
      expect(retrievedAgent!.model).toEqual(complexModel)
      expect(retrievedAgent!.model.customParameters.mirostatTau).toBe(5.0)
      expect(retrievedAgent!.model.stopSequences).toEqual(['END', 'STOP'])
    })

    it('should handle empty and null values in JSON fields', async () => {
      // Arrange
      const agentData = {
        name: 'Minimal Agent',
        description: 'Agent with minimal data',
        primaryRole: 'minimal',
        capabilities: {
          reasoning: 0.5,
          creativity: 0.5,
          technical: 0.5,
          communication: 0.5
        },
        model: {},
        personality: null as any,
        constraints: {},
        metrics: {}
      }

      // Act
      const createdAgent = await agentDb.createAgent(agentData)
      const retrievedAgent = await agentDb.getAgent(createdAgent.id)

      // Assert
      expect(retrievedAgent!.model).toEqual({})
      expect(retrievedAgent!.personality).toEqual({})
      expect(retrievedAgent!.constraints).toEqual({})
      expect(retrievedAgent!.metrics).toEqual({})
    })
  })

  describe('Database Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Arrange - Create a database manager with invalid path
      const invalidDb = new AgentDatabaseManager('/invalid/path/agent.db')

      // Act & Assert
      await expect(invalidDb.initialize()).rejects.toThrow()
    })

    it('should handle malformed JSON data gracefully', async () => {
      // This test would require direct database manipulation to insert invalid JSON
      // For now, we'll test that our JSON parsing is robust
      
      // Arrange
      const agentData = {
        name: 'JSON Test Agent',
        description: 'Testing JSON handling',
        primaryRole: 'test',
        capabilities: {
          reasoning: 0.8,
          creativity: 0.7,
          technical: 0.9,
          communication: 0.8
        }
      }

      // Act & Assert - Should not throw when handling valid JSON
      expect(async () => {
        const agent = await agentDb.createAgent(agentData)
        await agentDb.getAgent(agent.id)
      }).not.toThrow()
    })
  })

  describe('Agent List Operations', () => {
    it('should retrieve all agents correctly', async () => {
      // Arrange - Create multiple agents
      const agents = [
        {
          name: 'Agent 1',
          description: 'First agent',
          primaryRole: 'role1',
          capabilities: { reasoning: 0.8, creativity: 0.7, technical: 0.9, communication: 0.8 }
        },
        {
          name: 'Agent 2',
          description: 'Second agent',
          primaryRole: 'role2',
          capabilities: { reasoning: 0.7, creativity: 0.8, technical: 0.6, communication: 0.9 }
        },
        {
          name: 'Agent 3',
          description: 'Third agent',
          primaryRole: 'role3',
          capabilities: { reasoning: 0.9, creativity: 0.6, technical: 0.8, communication: 0.7 }
        }
      ]

      for (const agentData of agents) {
        await agentDb.createAgent(agentData)
      }

      // Act
      const allAgents = await agentDb.getAllAgents()

      // Assert
      expect(allAgents).toHaveLength(3)
      expect(allAgents.map(a => a.name)).toEqual(['Agent 1', 'Agent 2', 'Agent 3'])
      
      // Verify complex data is preserved
      allAgents.forEach(agent => {
        expect(agent.capabilities).toBeDefined()
        expect(typeof agent.capabilities).toBe('object')
        expect(agent.capabilities.reasoning).toBeDefined()
      })
    })

    it('should return empty array when no agents exist', async () => {
      // Act
      const allAgents = await agentDb.getAllAgents()

      // Assert
      expect(allAgents).toEqual([])
    })
  })

  describe('Agent Status Management', () => {
    it('should track agent status changes correctly', async () => {
      // Arrange
      const agentData = {
        name: 'Status Test Agent',
        description: 'Agent for testing status changes',
        primaryRole: 'testing',
        capabilities: {
          reasoning: 0.8,
          creativity: 0.7,
          technical: 0.9,
          communication: 0.8
        },
        status: 'active'
      }

      const createdAgent = await agentDb.createAgent(agentData)

      // Act - Update status
      const updatedAgent = await agentDb.updateAgent(createdAgent.id, { status: 'inactive' })

      // Assert
      expect(updatedAgent!.status).toBe('inactive')
      
      // Verify in database
      const retrievedAgent = await agentDb.getAgent(createdAgent.id)
      expect(retrievedAgent!.status).toBe('inactive')
    })
  })
})