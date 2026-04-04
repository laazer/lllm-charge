/**
 * Integration test for workflow template drag-and-drop functionality
 * Tests the complete flow from template selection to workflow creation via API
 */

import { LLMChargeServer } from '../../src/server/independent-database-manager.mjs'

describe('Workflow Template Drag-and-Drop Integration', () => {
  let server: any
  let baseUrl: string

  beforeAll(async () => {
    // Start test server
    const { createTestServer } = await import('../helpers/test-server-setup')
    server = await createTestServer()
    baseUrl = `http://localhost:${server.address().port}`
  }, 30000)

  afterAll(async () => {
    if (server) {
      await server.close()
    }
  })

  describe('Template System API Integration', () => {
    it('should successfully create workflow from template data structure', async () => {
      // Template data that matches what drag-and-drop would send
      const templateData = {
        name: 'Code Review Workflow',
        description: 'Automated code review and approval process',
        status: 'draft',
        priority: 'medium',
        nodes: [
          {
            id: 'trigger-pr',
            type: 'trigger',
            name: 'Pull Request Trigger',
            position: { x: 100, y: 100 },
            data: { 
              triggerType: 'webhook', 
              inputs: ['pull_request', 'changed_files'] 
            }
          },
          {
            id: 'code-analysis',
            type: 'agent',
            name: 'Code Analysis Agent',
            position: { x: 300, y: 100 },
            data: { 
              agentRole: 'analyst',
              description: 'Analyze code quality and security',
              inputs: ['changed_files'],
              outputs: ['analysis_report', 'quality_score']
            }
          },
          {
            id: 'review-decision',
            type: 'agent', 
            name: 'Review Decision',
            position: { x: 500, y: 100 },
            data: {
              agentRole: 'architect',
              description: 'Make approval decision based on analysis',
              inputs: ['analysis_report', 'quality_score'],
              outputs: ['approval_status', 'feedback']
            }
          },
          {
            id: 'complete',
            type: 'output',
            name: 'Review Complete',
            position: { x: 700, y: 100 },
            data: { outputs: ['approval_status', 'feedback'] }
          }
        ],
        edges: [
          { id: 'trigger-to-analysis', source: 'trigger-pr', target: 'code-analysis' },
          { id: 'analysis-to-decision', source: 'code-analysis', target: 'review-decision' },
          { id: 'decision-to-complete', source: 'review-decision', target: 'complete' }
        ]
      }

      // Create workflow via API (simulating what drag-and-drop does)
      const response = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      })

      expect(response.ok).toBe(true)
      const createdWorkflow = await response.json()

      // Verify workflow was created correctly
      expect(createdWorkflow).toHaveProperty('id')
      expect(createdWorkflow.name).toBe(templateData.name)
      expect(createdWorkflow.description).toBe(templateData.description)
      expect(createdWorkflow.status).toBe(templateData.status)
      
      // Verify nodes were preserved
      expect(createdWorkflow.nodes).toHaveLength(templateData.nodes.length)
      expect(createdWorkflow.nodes[0]).toMatchObject(templateData.nodes[0])
      
      // Verify edges were preserved
      expect(createdWorkflow.edges).toHaveLength(templateData.edges.length)
      expect(createdWorkflow.edges[0]).toMatchObject(templateData.edges[0])

      // Verify metadata was added
      expect(createdWorkflow).toHaveProperty('createdAt')
      expect(createdWorkflow).toHaveProperty('updatedAt')
      expect(createdWorkflow).toHaveProperty('version')
    })

    it('should successfully create Bug Fix Pipeline workflow from template', async () => {
      // Bug Fix Pipeline template data
      const bugFixTemplate = {
        name: 'Bug Fix Pipeline',
        description: 'Streamlined bug identification, fixing, and verification workflow',
        status: 'draft',
        priority: 'high',
        nodes: [
          {
            id: 'bug-report',
            type: 'trigger',
            name: 'Bug Report',
            position: { x: 100, y: 100 },
            data: { 
              triggerType: 'manual', 
              inputs: ['bug_description', 'severity'] 
            }
          },
          {
            id: 'triage',
            type: 'agent',
            name: 'Bug Triage',
            position: { x: 300, y: 100 },
            data: {
              agentRole: 'analyst',
              description: 'Analyze and prioritize bug',
              inputs: ['bug_description', 'severity'],
              outputs: ['priority', 'assignment', 'fix_strategy']
            }
          },
          {
            id: 'fix-implementation',
            type: 'agent',
            name: 'Fix Implementation', 
            position: { x: 500, y: 100 },
            data: {
              agentRole: 'data',
              description: 'Implement bug fix',
              inputs: ['fix_strategy'],
              outputs: ['fix_code', 'test_results']
            }
          },
          {
            id: 'verification',
            type: 'agent',
            name: 'Fix Verification',
            position: { x: 700, y: 100 },
            data: {
              agentRole: 'qa', 
              description: 'Verify fix resolves issue',
              inputs: ['fix_code', 'test_results'],
              outputs: ['verification_status', 'deployment_ready']
            }
          }
        ],
        edges: [
          { id: 'report-to-triage', source: 'bug-report', target: 'triage' },
          { id: 'triage-to-fix', source: 'triage', target: 'fix-implementation' },
          { id: 'fix-to-verification', source: 'fix-implementation', target: 'verification' }
        ]
      }

      // Create workflow
      const response = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bugFixTemplate),
      })

      expect(response.ok).toBe(true)
      const createdWorkflow = await response.json()

      // Verify Bug Fix Pipeline specific properties
      expect(createdWorkflow.name).toBe('Bug Fix Pipeline')
      expect(createdWorkflow.priority).toBe('high')
      expect(createdWorkflow.nodes).toHaveLength(4)
      expect(createdWorkflow.edges).toHaveLength(3)

      // Verify bug triage node specifically
      const triageNode = createdWorkflow.nodes.find((n: any) => n.id === 'triage')
      expect(triageNode).toBeDefined()
      expect(triageNode.data.agentRole).toBe('analyst')
      expect(triageNode.data.inputs).toContain('bug_description')
      expect(triageNode.data.outputs).toContain('fix_strategy')
    })

    it('should handle workflow retrieval for examples browser', async () => {
      // First, create a few workflows to serve as examples
      const testWorkflows = [
        {
          name: 'Production Code Review',
          description: 'Production workflow for code reviews',
          status: 'active',
          priority: 'high'
        },
        {
          name: 'Test Workflow',
          description: 'This should be filtered out of examples',
          status: 'draft', 
          priority: 'low'
        },
        {
          name: 'Deployment Pipeline',
          description: 'Automated deployment process',
          status: 'completed',
          priority: 'medium'
        }
      ]

      // Create the workflows
      const createdWorkflows = []
      for (const workflow of testWorkflows) {
        const response = await fetch(`${baseUrl}/api/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflow),
        })
        expect(response.ok).toBe(true)
        const created = await response.json()
        createdWorkflows.push(created)
      }

      // Retrieve all workflows (what the examples browser does)
      const listResponse = await fetch(`${baseUrl}/api/workflows`)
      expect(listResponse.ok).toBe(true)
      const allWorkflows = await listResponse.json()

      // Verify workflows can be filtered for examples
      const examples = allWorkflows.filter((w: any) => 
        w.name && 
        !w.name.toLowerCase().includes('test') && 
        !w.name.toLowerCase().includes('workflow 17')
      )

      // Should include Production Code Review and Deployment Pipeline
      // Should exclude Test Workflow
      const exampleNames = examples.map((w: any) => w.name)
      expect(exampleNames).toContain('Production Code Review')
      expect(exampleNames).toContain('Deployment Pipeline')
      expect(exampleNames).not.toContain('Test Workflow')
    })

    it('should handle concurrent template workflow creation', async () => {
      // Simulate multiple users creating workflows from templates simultaneously
      const templateData = {
        name: 'Concurrent Workflow',
        description: 'Testing concurrent creation',
        status: 'draft',
        priority: 'medium',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            name: 'Start',
            position: { x: 100, y: 100 },
            data: { triggerType: 'manual' }
          }
        ],
        edges: []
      }

      // Create multiple workflows concurrently
      const promises = []
      for (let i = 0; i < 5; i++) {
        const workflowData = {
          ...templateData,
          name: `${templateData.name} ${i + 1}`
        }
        
        const promise = fetch(`${baseUrl}/api/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflowData),
        })
        promises.push(promise)
      }

      // Wait for all to complete
      const responses = await Promise.all(promises)
      
      // Verify all succeeded
      for (const response of responses) {
        expect(response.ok).toBe(true)
        const workflow = await response.json()
        expect(workflow).toHaveProperty('id')
        expect(workflow.name).toMatch(/^Concurrent Workflow \d+$/)
      }
    })

    it('should validate template data structure before creation', async () => {
      // Test with invalid template data
      const invalidTemplateData = {
        // Missing required fields
        description: 'Invalid template',
        nodes: 'not-an-array', // Should be array
        edges: null // Should be array
      }

      const response = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidTemplateData),
      })

      // Server should handle this gracefully and create a basic workflow
      expect(response.ok).toBe(true)
      const workflow = await response.json()
      
      // Should have default values and proper structure
      expect(workflow).toHaveProperty('id')
      expect(Array.isArray(workflow.nodes)).toBe(true)
      expect(Array.isArray(workflow.edges)).toBe(true)
    })

    it('should preserve complex template node and edge data', async () => {
      // Template with complex node configurations
      const complexTemplate = {
        name: 'Complex AI Processing Workflow',
        description: 'Advanced workflow with multiple AI agents and complex data flow',
        status: 'draft',
        priority: 'high',
        nodes: [
          {
            id: 'data-input',
            type: 'trigger',
            name: 'Data Input Trigger',
            position: { x: 100, y: 200 },
            data: { 
              triggerType: 'webhook',
              inputs: ['raw_data', 'metadata', 'processing_options'],
              configuration: {
                timeout: 30000,
                retries: 3,
                validation: ['schema_check', 'size_limit']
              }
            }
          },
          {
            id: 'preprocessing',
            type: 'agent',
            name: 'Data Preprocessing Agent',
            position: { x: 300, y: 150 },
            data: {
              agentRole: 'data',
              description: 'Clean and prepare data for analysis',
              inputs: ['raw_data', 'metadata'],
              outputs: ['cleaned_data', 'preprocessing_report'],
              capabilities: {
                reasoning: 0.8,
                creativity: 0.3,
                technical: 0.9,
                communication: 0.6
              },
              settings: {
                maxMemory: '1GB',
                timeout: 120000,
                priority: 'high'
              }
            }
          },
          {
            id: 'ai-analysis',
            type: 'agent',
            name: 'AI Analysis Agent',
            position: { x: 300, y: 250 },
            data: {
              agentRole: 'analyst',
              description: 'Perform complex AI analysis on processed data',
              inputs: ['cleaned_data', 'processing_options'],
              outputs: ['analysis_results', 'confidence_scores', 'recommendations'],
              capabilities: {
                reasoning: 0.95,
                creativity: 0.7,
                technical: 0.85,
                communication: 0.8
              },
              modelConfig: {
                provider: 'local',
                model: 'llama2',
                temperature: 0.7,
                maxTokens: 2000
              }
            }
          },
          {
            id: 'result-formatter',
            type: 'agent',
            name: 'Result Formatting Agent',
            position: { x: 500, y: 200 },
            data: {
              agentRole: 'formatter',
              description: 'Format analysis results for presentation',
              inputs: ['analysis_results', 'confidence_scores'],
              outputs: ['formatted_report', 'visualizations', 'summary'],
              outputFormats: ['json', 'html', 'pdf'],
              templates: ['standard', 'executive', 'technical']
            }
          },
          {
            id: 'output-delivery',
            type: 'output',
            name: 'Multi-Channel Output',
            position: { x: 700, y: 200 },
            data: { 
              outputs: ['formatted_report', 'visualizations', 'summary'],
              deliveryChannels: ['webhook', 'email', 'database'],
              notificationSettings: {
                onSuccess: true,
                onError: true,
                recipients: ['admin@example.com']
              }
            }
          }
        ],
        edges: [
          { 
            id: 'input-to-preprocessing', 
            source: 'data-input', 
            target: 'preprocessing',
            data: { 
              condition: 'data_valid',
              transformation: 'passthrough' 
            }
          },
          { 
            id: 'input-to-analysis', 
            source: 'data-input', 
            target: 'ai-analysis',
            data: { 
              condition: 'high_priority',
              transformation: 'direct_feed' 
            }
          },
          { 
            id: 'preprocessing-to-analysis', 
            source: 'preprocessing', 
            target: 'ai-analysis',
            data: { 
              condition: 'preprocessing_success',
              transformation: 'merge_with_original' 
            }
          },
          { 
            id: 'analysis-to-formatter', 
            source: 'ai-analysis', 
            target: 'result-formatter',
            data: { 
              condition: 'confidence_threshold_met',
              transformation: 'include_metadata' 
            }
          },
          { 
            id: 'formatter-to-output', 
            source: 'result-formatter', 
            target: 'output-delivery',
            data: { 
              condition: 'format_complete',
              transformation: 'final_package' 
            }
          }
        ]
      }

      // Create complex workflow
      const response = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexTemplate),
      })

      expect(response.ok).toBe(true)
      const createdWorkflow = await response.json()

      // Verify complex structure was preserved
      expect(createdWorkflow.nodes).toHaveLength(5)
      expect(createdWorkflow.edges).toHaveLength(5)

      // Verify complex node data was preserved
      const aiAnalysisNode = createdWorkflow.nodes.find((n: any) => n.id === 'ai-analysis')
      expect(aiAnalysisNode).toBeDefined()
      expect(aiAnalysisNode.data.capabilities).toEqual({
        reasoning: 0.95,
        creativity: 0.7,
        technical: 0.85,
        communication: 0.8
      })
      expect(aiAnalysisNode.data.modelConfig.provider).toBe('local')

      // Verify complex edge data was preserved
      const edgeWithCondition = createdWorkflow.edges.find((e: any) => e.id === 'analysis-to-formatter')
      expect(edgeWithCondition).toBeDefined()
      expect(edgeWithCondition.data.condition).toBe('confidence_threshold_met')
      expect(edgeWithCondition.data.transformation).toBe('include_metadata')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty template gracefully', async () => {
      const emptyTemplate = {}

      const response = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyTemplate),
      })

      expect(response.ok).toBe(true)
      const workflow = await response.json()
      
      // Should create a basic workflow with defaults
      expect(workflow).toHaveProperty('id')
      expect(Array.isArray(workflow.nodes)).toBe(true)
      expect(Array.isArray(workflow.edges)).toBe(true)
    })

    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid": json}', // Malformed JSON
      })

      // Server should return error for malformed JSON
      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })
})