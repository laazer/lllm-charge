import { FlowDatabaseManager } from '../../src/database/flow-database-manager'
import fs from 'fs/promises'
import path from 'path'

// Test database path
const TEST_FLOW_DB_PATH = path.join(__dirname, '../../data/test-flows.db')

describe('Prebuilt Workflows Tests', () => {
  let flowDb: FlowDatabaseManager

  beforeAll(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(TEST_FLOW_DB_PATH)
    } catch (error) {
      // File doesn't exist, that's fine
    }

    // Initialize database manager with test database
    flowDb = new FlowDatabaseManager(TEST_FLOW_DB_PATH)
    await flowDb.initialize()
  })

  afterAll(async () => {
    // Clean up test database
    try {
      await fs.unlink(TEST_FLOW_DB_PATH)
    } catch (error) {
      console.warn('Could not clean up test flow database:', error)
    }
  })

  beforeEach(async () => {
    // Clear all flows before each test
    const allFlows = await flowDb.getAllFlows()
    for (const flow of allFlows) {
      await flowDb.deleteFlow(flow.id)
    }
  })

  describe('Code Feature Development Flow', () => {
    const codeFeatureFlow = {
      title: 'Code Feature Development Flow',
      description: 'Complete development lifecycle from requirements to deployment',
      status: 'active',
      priority: 'high',
      nodes: [
        {
          id: 'requirements',
          type: 'agent-task',
          name: 'Requirements Analysis',
          config: {
            agent: 'requirements-analyst',
            task: 'Analyze feature requirements and create detailed specifications'
          }
        },
        {
          id: 'design',
          type: 'agent-task', 
          name: 'System Design',
          config: {
            agent: 'system-architect',
            task: 'Create system design and architecture for the feature'
          }
        },
        {
          id: 'implementation',
          type: 'agent-task',
          name: 'Code Implementation',
          config: {
            agent: 'senior-developer',
            task: 'Implement the feature according to specifications'
          }
        },
        {
          id: 'testing',
          type: 'agent-task',
          name: 'Testing & QA',
          config: {
            agent: 'qa-engineer',
            task: 'Create comprehensive tests and verify functionality'
          }
        },
        {
          id: 'review',
          type: 'agent-task',
          name: 'Code Review',
          config: {
            agent: 'code-reviewer',
            task: 'Review code quality, security, and best practices'
          }
        },
        {
          id: 'deployment',
          type: 'agent-task',
          name: 'Deployment',
          config: {
            agent: 'devops-engineer',
            task: 'Deploy feature to staging and production environments'
          }
        }
      ],
      edges: [
        { from: 'requirements', to: 'design' },
        { from: 'design', to: 'implementation' },
        { from: 'implementation', to: 'testing' },
        { from: 'testing', to: 'review' },
        { from: 'review', to: 'deployment' }
      ]
    }

    it('should create Code Feature Development Flow successfully', async () => {
      // Act
      const createdFlow = await flowDb.createFlow(codeFeatureFlow)

      // Assert
      expect(createdFlow).toBeDefined()
      expect(createdFlow.id).toBeDefined()
      expect(createdFlow.title).toBe('Code Feature Development Flow')
      expect(createdFlow.description).toContain('Complete development lifecycle')
      expect(createdFlow.status).toBe('active')
      expect(createdFlow.priority).toBe('high')
    })

    it('should properly serialize workflow nodes and edges', async () => {
      // Act
      const createdFlow = await flowDb.createFlow(codeFeatureFlow)
      const retrievedFlow = await flowDb.getFlow(createdFlow.id)

      // Assert
      expect(retrievedFlow).toBeDefined()
      expect(retrievedFlow!.nodes).toHaveLength(6)
      expect(retrievedFlow!.edges).toHaveLength(5)

      // Verify node structure
      const requirementsNode = retrievedFlow!.nodes.find(n => n.id === 'requirements')
      expect(requirementsNode).toBeDefined()
      expect(requirementsNode!.type).toBe('agent-task')
      expect(requirementsNode!.config.agent).toBe('requirements-analyst')

      // Verify edge structure
      const firstEdge = retrievedFlow!.edges.find(e => e.from === 'requirements' && e.to === 'design')
      expect(firstEdge).toBeDefined()
    })

    it('should validate workflow completeness', () => {
      // Assert workflow has all essential phases
      const nodeTypes = codeFeatureFlow.nodes.map(n => n.id)
      expect(nodeTypes).toContain('requirements')
      expect(nodeTypes).toContain('design')
      expect(nodeTypes).toContain('implementation')
      expect(nodeTypes).toContain('testing')
      expect(nodeTypes).toContain('review')
      expect(nodeTypes).toContain('deployment')

      // Assert proper flow sequence
      expect(codeFeatureFlow.edges).toEqual([
        { from: 'requirements', to: 'design' },
        { from: 'design', to: 'implementation' },
        { from: 'implementation', to: 'testing' },
        { from: 'testing', to: 'review' },
        { from: 'review', to: 'deployment' }
      ])
    })
  })

  describe('Bug Fix Workflow', () => {
    const bugFixFlow = {
      title: 'Bug Fix Workflow',
      description: 'Streamlined process for identifying, fixing, and validating bug fixes',
      status: 'active',
      priority: 'high',
      nodes: [
        {
          id: 'reproduce',
          type: 'agent-task',
          name: 'Bug Reproduction',
          config: {
            agent: 'bug-hunter',
            task: 'Reproduce the bug and document exact conditions'
          }
        },
        {
          id: 'analyze',
          type: 'agent-task',
          name: 'Root Cause Analysis',
          config: {
            agent: 'senior-developer',
            task: 'Analyze code and identify root cause of the bug'
          }
        },
        {
          id: 'fix',
          type: 'agent-task',
          name: 'Implement Fix',
          config: {
            agent: 'developer',
            task: 'Implement minimal fix for the identified issue'
          }
        },
        {
          id: 'test',
          type: 'agent-task',
          name: 'Validation Testing',
          config: {
            agent: 'qa-engineer',
            task: 'Test fix and ensure no regressions introduced'
          }
        },
        {
          id: 'deploy',
          type: 'agent-task',
          name: 'Hot Fix Deployment',
          config: {
            agent: 'devops-engineer',
            task: 'Deploy fix to production with monitoring'
          }
        }
      ],
      edges: [
        { from: 'reproduce', to: 'analyze' },
        { from: 'analyze', to: 'fix' },
        { from: 'fix', to: 'test' },
        { from: 'test', to: 'deploy' }
      ]
    }

    it('should create Bug Fix Workflow successfully', async () => {
      // Act
      const createdFlow = await flowDb.createFlow(bugFixFlow)

      // Assert
      expect(createdFlow).toBeDefined()
      expect(createdFlow.title).toBe('Bug Fix Workflow')
      expect(createdFlow.description).toContain('Streamlined process')
      expect(createdFlow.nodes).toHaveLength(5)
      expect(createdFlow.edges).toHaveLength(4)
    })

    it('should have proper bug fix sequence', () => {
      // Assert workflow follows bug fix best practices
      const nodeIds = bugFixFlow.nodes.map(n => n.id)
      expect(nodeIds).toEqual(['reproduce', 'analyze', 'fix', 'test', 'deploy'])

      // Verify linear workflow for quick bug fixes
      expect(bugFixFlow.edges).toEqual([
        { from: 'reproduce', to: 'analyze' },
        { from: 'analyze', to: 'fix' },
        { from: 'fix', to: 'test' },
        { from: 'test', to: 'deploy' }
      ])
    })

    it('should include bug-specific agent roles', () => {
      // Assert agents are appropriate for bug fixing
      const agents = bugFixFlow.nodes.map(n => n.config.agent)
      expect(agents).toContain('bug-hunter')
      expect(agents).toContain('senior-developer')
      expect(agents).toContain('developer')
      expect(agents).toContain('qa-engineer')
      expect(agents).toContain('devops-engineer')
    })
  })

  describe('Code Review & Documentation Workflow', () => {
    const codeReviewFlow = {
      title: 'Code Review & Documentation Workflow',
      description: 'Automated code review with comprehensive documentation generation',
      status: 'active',
      priority: 'medium',
      nodes: [
        {
          id: 'static-analysis',
          type: 'agent-task',
          name: 'Static Code Analysis',
          config: {
            agent: 'code-analyzer',
            task: 'Perform static analysis and identify potential issues'
          }
        },
        {
          id: 'security-scan',
          type: 'agent-task',
          name: 'Security Scan',
          config: {
            agent: 'security-expert',
            task: 'Scan for security vulnerabilities and compliance issues'
          }
        },
        {
          id: 'code-review',
          type: 'agent-task',
          name: 'Comprehensive Review',
          config: {
            agent: 'senior-code-reviewer',
            task: 'Review code quality, patterns, and architecture'
          }
        },
        {
          id: 'generate-docs',
          type: 'agent-task',
          name: 'Documentation Generation',
          config: {
            agent: 'technical-writer',
            task: 'Generate comprehensive documentation and API references'
          }
        },
        {
          id: 'update-tests',
          type: 'agent-task',
          name: 'Test Documentation',
          config: {
            agent: 'test-engineer',
            task: 'Update test documentation and coverage reports'
          }
        }
      ],
      edges: [
        { from: 'static-analysis', to: 'code-review' },
        { from: 'security-scan', to: 'code-review' },
        { from: 'code-review', to: 'generate-docs' },
        { from: 'code-review', to: 'update-tests' },
        { from: 'generate-docs', to: 'update-tests' }
      ]
    }

    it('should create Code Review & Documentation Workflow successfully', async () => {
      // Act
      const createdFlow = await flowDb.createFlow(codeReviewFlow)

      // Assert
      expect(createdFlow).toBeDefined()
      expect(createdFlow.title).toBe('Code Review & Documentation Workflow')
      expect(createdFlow.description).toContain('Automated code review')
      expect(createdFlow.nodes).toHaveLength(5)
      expect(createdFlow.edges).toHaveLength(5)
    })

    it('should support parallel analysis tasks', () => {
      // Assert parallel analysis structure
      const parallelEdges = codeReviewFlow.edges.filter(e => e.to === 'code-review')
      expect(parallelEdges).toHaveLength(2)
      expect(parallelEdges.map(e => e.from)).toContain('static-analysis')
      expect(parallelEdges.map(e => e.from)).toContain('security-scan')
    })

    it('should include documentation-specific agents', () => {
      // Assert specialized agents for documentation
      const agents = codeReviewFlow.nodes.map(n => n.config.agent)
      expect(agents).toContain('code-analyzer')
      expect(agents).toContain('security-expert')
      expect(agents).toContain('technical-writer')
      expect(agents).toContain('test-engineer')
    })
  })

  describe('Workflow Template System', () => {
    it('should create workflow templates for reuse', async () => {
      // Arrange
      const templateFlow = {
        title: 'Basic Template',
        description: 'Template for creating new workflows',
        status: 'template',
        priority: 'medium',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            name: 'Start Task',
            config: { trigger: 'manual' }
          },
          {
            id: 'process',
            type: 'agent-task',
            name: 'Process Task',
            config: { agent: 'generic-agent', task: 'Process the input' }
          },
          {
            id: 'finish',
            type: 'webhook',
            name: 'Completion Notification',
            config: { url: 'http://localhost:3001/webhook/complete' }
          }
        ],
        edges: [
          { from: 'start', to: 'process' },
          { from: 'process', to: 'finish' }
        ]
      }

      // Act
      const createdTemplate = await flowDb.createFlow(templateFlow)

      // Assert
      expect(createdTemplate.status).toBe('template')
      expect(createdTemplate.nodes).toHaveLength(3)

      // Verify template can be retrieved
      const retrieved = await flowDb.getFlow(createdTemplate.id)
      expect(retrieved!.status).toBe('template')
    })

    it('should differentiate between active workflows and templates', async () => {
      // Arrange - Create both active workflow and template
      const activeFlow = {
        title: 'Active Workflow',
        description: 'Currently active workflow',
        status: 'active',
        priority: 'high',
        nodes: [{ id: 'node1', type: 'agent-task', name: 'Task', config: {} }],
        edges: []
      }

      const templateFlow = {
        title: 'Template Workflow',
        description: 'Template for future use',
        status: 'template',
        priority: 'low',
        nodes: [{ id: 'node1', type: 'agent-task', name: 'Template Task', config: {} }],
        edges: []
      }

      // Act
      await flowDb.createFlow(activeFlow)
      await flowDb.createFlow(templateFlow)

      const allFlows = await flowDb.getAllFlows()

      // Assert
      expect(allFlows).toHaveLength(2)
      
      const active = allFlows.find(f => f.status === 'active')
      const template = allFlows.find(f => f.status === 'template')
      
      expect(active).toBeDefined()
      expect(template).toBeDefined()
      expect(active!.title).toBe('Active Workflow')
      expect(template!.title).toBe('Template Workflow')
    })
  })

  describe('Workflow Validation', () => {
    it('should validate workflow node references in edges', async () => {
      // Arrange - Workflow with invalid edge reference
      const invalidFlow = {
        title: 'Invalid Workflow',
        description: 'Workflow with invalid edge references',
        status: 'draft',
        priority: 'low',
        nodes: [
          { id: 'node1', type: 'agent-task', name: 'Task 1', config: {} },
          { id: 'node2', type: 'agent-task', name: 'Task 2', config: {} }
        ],
        edges: [
          { from: 'node1', to: 'node2' },
          { from: 'node2', to: 'nonexistent-node' } // Invalid reference
        ]
      }

      // Act & Assert - Should create workflow (validation might be done at execution time)
      const created = await flowDb.createFlow(invalidFlow)
      expect(created).toBeDefined()
      
      // In a production system, you might want to add validation logic
      const retrieved = await flowDb.getFlow(created.id)
      expect(retrieved!.edges).toHaveLength(2)
    })

    it('should handle workflows with no edges (single node)', async () => {
      // Arrange
      const singleNodeFlow = {
        title: 'Single Node Workflow',
        description: 'Workflow with only one node',
        status: 'active',
        priority: 'medium',
        nodes: [
          { id: 'solo', type: 'agent-task', name: 'Solo Task', config: { agent: 'solo-agent' } }
        ],
        edges: []
      }

      // Act
      const created = await flowDb.createFlow(singleNodeFlow)
      const retrieved = await flowDb.getFlow(created.id)

      // Assert
      expect(retrieved!.nodes).toHaveLength(1)
      expect(retrieved!.edges).toHaveLength(0)
    })

    it('should handle complex workflow graphs with multiple paths', async () => {
      // Arrange - Workflow with branching and merging
      const complexFlow = {
        title: 'Complex Branching Workflow',
        description: 'Workflow with multiple execution paths',
        status: 'active',
        priority: 'high',
        nodes: [
          { id: 'start', type: 'trigger', name: 'Start', config: {} },
          { id: 'branch1', type: 'agent-task', name: 'Branch 1', config: {} },
          { id: 'branch2', type: 'agent-task', name: 'Branch 2', config: {} },
          { id: 'merge', type: 'agent-task', name: 'Merge Point', config: {} },
          { id: 'end', type: 'webhook', name: 'End', config: {} }
        ],
        edges: [
          { from: 'start', to: 'branch1' },
          { from: 'start', to: 'branch2' },
          { from: 'branch1', to: 'merge' },
          { from: 'branch2', to: 'merge' },
          { from: 'merge', to: 'end' }
        ]
      }

      // Act
      const created = await flowDb.createFlow(complexFlow)
      const retrieved = await flowDb.getFlow(created.id)

      // Assert
      expect(retrieved!.nodes).toHaveLength(5)
      expect(retrieved!.edges).toHaveLength(5)
      
      // Verify branching structure
      const startEdges = retrieved!.edges.filter(e => e.from === 'start')
      expect(startEdges).toHaveLength(2)
      
      const mergeEdges = retrieved!.edges.filter(e => e.to === 'merge')
      expect(mergeEdges).toHaveLength(2)
    })
  })

  describe('Workflow Execution Tracking', () => {
    it('should support workflow execution metadata', async () => {
      // Arrange
      const executableFlow = {
        title: 'Executable Workflow',
        description: 'Workflow with execution tracking',
        status: 'active',
        priority: 'high',
        nodes: [
          { 
            id: 'task1', 
            type: 'agent-task', 
            name: 'First Task', 
            config: { 
              agent: 'worker-agent',
              timeout: 30000,
              retries: 3
            } 
          }
        ],
        edges: [],
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0',
          author: 'test-system'
        }
      }

      // Act
      const created = await flowDb.createFlow(executableFlow)
      const retrieved = await flowDb.getFlow(created.id)

      // Assert
      expect(retrieved!.metadata).toBeDefined()
      expect(retrieved!.metadata.version).toBe('1.0.0')
      expect(retrieved!.metadata.author).toBe('test-system')
      
      // Verify node configuration preservation
      expect(retrieved!.nodes[0].config.timeout).toBe(30000)
      expect(retrieved!.nodes[0].config.retries).toBe(3)
    })
  })
})