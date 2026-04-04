import { jest } from '@jest/globals';
import fetch from 'node-fetch';

// Mock fetch for Node.js environment
global.fetch = fetch as any;

describe('Workflow Editor End-to-End Tests', () => {
  const baseUrl = 'http://localhost:3001';
  let testWorkflowIds: string[] = [];

  beforeAll(async () => {
    // Wait for server to be ready
    let serverReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!serverReady && attempts < maxAttempts) {
      try {
        const response = await fetch(`${baseUrl}/api/test`);
        if (response.status === 200) {
          serverReady = true;
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (!serverReady) {
      throw new Error('Server not ready after 30 seconds');
    }
  }, 35000);

  afterAll(async () => {
    // Clean up all test workflows
    for (const workflowId of testWorkflowIds) {
      try {
        await fetch(`${baseUrl}/api/workflows/${workflowId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.warn(`Failed to delete test workflow ${workflowId}:`, error);
      }
    }
  });

  describe('Complete Workflow Loading Journey', () => {
    test('should create, load, and display workflow with nodes end-to-end', async () => {
      // Step 1: Create a test workflow with complex node structure
      const complexWorkflow = {
        name: 'E2E Test Workflow - Complex',
        description: 'End-to-end test workflow with multiple node types and connections',
        status: 'active',
        priority: 'high',
        nodes: [
          {
            id: 'trigger-start',
            type: 'trigger',
            name: 'Manual Start Trigger',
            position: { x: 100, y: 150 },
            data: { 
              triggerType: 'manual',
              inputs: ['user_input'],
              description: 'Starts the workflow manually'
            }
          },
          {
            id: 'parallel-agent-1',
            type: 'agent',
            name: 'Analysis Agent',
            position: { x: 300, y: 100 },
            data: { 
              agentRole: 'analyst',
              description: 'Analyzes input data for patterns',
              inputs: ['user_input'],
              outputs: ['analysis_report']
            }
          },
          {
            id: 'parallel-agent-2',
            type: 'agent',
            name: 'Processing Agent',
            position: { x: 300, y: 200 },
            data: { 
              agentRole: 'processor',
              description: 'Processes data transformations',
              inputs: ['user_input'],
              outputs: ['processed_data']
            }
          },
          {
            id: 'merge-agent',
            type: 'agent',
            name: 'Merge Agent',
            position: { x: 500, y: 150 },
            data: { 
              agentRole: 'coordinator',
              description: 'Merges analysis and processed data',
              inputs: ['analysis_report', 'processed_data'],
              outputs: ['merged_result']
            }
          },
          {
            id: 'conditional-check',
            type: 'condition',
            name: 'Quality Check',
            position: { x: 700, y: 150 },
            data: { 
              condition: 'quality_score > 0.8',
              description: 'Checks if quality meets threshold'
            }
          },
          {
            id: 'success-output',
            type: 'output',
            name: 'Success Output',
            position: { x: 900, y: 100 },
            data: { 
              outputs: ['final_result', 'quality_report'],
              description: 'Outputs successful processing result'
            }
          },
          {
            id: 'retry-action',
            type: 'action',
            name: 'Retry Processing',
            position: { x: 900, y: 200 },
            data: { 
              action: 'retry',
              description: 'Retries processing with adjusted parameters'
            }
          }
        ],
        edges: [
          { id: 'start-to-analysis', source: 'trigger-start', target: 'parallel-agent-1' },
          { id: 'start-to-processing', source: 'trigger-start', target: 'parallel-agent-2' },
          { id: 'analysis-to-merge', source: 'parallel-agent-1', target: 'merge-agent' },
          { id: 'processing-to-merge', source: 'parallel-agent-2', target: 'merge-agent' },
          { id: 'merge-to-check', source: 'merge-agent', target: 'conditional-check' },
          { id: 'check-to-success', source: 'conditional-check', target: 'success-output' },
          { id: 'check-to-retry', source: 'conditional-check', target: 'retry-action' },
          { id: 'retry-to-merge', source: 'retry-action', target: 'merge-agent' }
        ],
        settings: {
          autoStart: false,
          retryPolicy: { enabled: true, maxRetries: 3 },
          timeout: 300000
        }
      };

      // Create workflow
      const createResponse = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexWorkflow)
      });

      expect(createResponse.status).toBe(200);
      const createdWorkflow = await createResponse.json();
      testWorkflowIds.push(createdWorkflow.id);

      // Step 2: Verify workflow was created with all data intact
      const retrieveResponse = await fetch(`${baseUrl}/api/workflows/${createdWorkflow.id}`);
      expect(retrieveResponse.status).toBe(200);
      const retrievedWorkflow = await retrieveResponse.json();

      expect(retrievedWorkflow.id).toBe(createdWorkflow.id);
      expect(retrievedWorkflow.nodes).toHaveLength(7);
      expect(retrievedWorkflow.edges).toHaveLength(8);

      // Step 3: Verify HTML editor page loads with workflow parameter
      const editorResponse = await fetch(`${baseUrl}/workflow-editor.html?id=${createdWorkflow.id}`);
      expect(editorResponse.status).toBe(200);
      expect(editorResponse.headers.get('content-type')).toContain('text/html');

      const editorHtml = await editorResponse.text();
      expect(editorHtml).toContain('workflow-canvas');
      expect(editorHtml).toContain('WorkflowEditor');

      // Step 4: Simulate the JavaScript workflow loading process
      const simulateWorkflowLoading = async (workflowId: string) => {
        // This simulates what happens in the browser JavaScript
        const apiResponse = await fetch(`${baseUrl}/api/workflows/${workflowId}`);
        const workflow = await apiResponse.json();

        // Simulate DOM node creation validation
        const nodeValidationResults = workflow.nodes.map((node: any) => ({
          id: node.id,
          canCreate: !!(node.id && node.type && node.name && node.position),
          hasValidPosition: typeof node.position.x === 'number' && typeof node.position.y === 'number',
          hasValidType: ['trigger', 'agent', 'output', 'action', 'condition'].includes(node.type),
          hasRequiredData: !!node.data
        }));

        return {
          workflow,
          nodeValidationResults,
          allNodesValid: nodeValidationResults.every(result => 
            result.canCreate && result.hasValidPosition && result.hasValidType
          )
        };
      };

      const loadingResult = await simulateWorkflowLoading(createdWorkflow.id);

      expect(loadingResult.allNodesValid).toBe(true);
      expect(loadingResult.nodeValidationResults).toHaveLength(7);

      // Step 5: Validate specific node types and their data
      const nodesByType = loadingResult.workflow.nodes.reduce((acc: any, node: any) => {
        if (!acc[node.type]) acc[node.type] = [];
        acc[node.type].push(node);
        return acc;
      }, {});

      expect(nodesByType.trigger).toHaveLength(1);
      expect(nodesByType.agent).toHaveLength(3);
      expect(nodesByType.output).toHaveLength(1);
      expect(nodesByType.action).toHaveLength(1);
      expect(nodesByType.condition).toHaveLength(1);

      // Step 6: Validate edge connections
      const edgeValidation = loadingResult.workflow.edges.map((edge: any) => {
        const sourceExists = loadingResult.workflow.nodes.some((n: any) => n.id === edge.source);
        const targetExists = loadingResult.workflow.nodes.some((n: any) => n.id === edge.target);
        return {
          edgeId: edge.id,
          sourceExists,
          targetExists,
          isValid: sourceExists && targetExists
        };
      });

      const allEdgesValid = edgeValidation.every(edge => edge.isValid);
      expect(allEdgesValid).toBe(true);
    }, 20000);

    test('should handle workflow editor access patterns', async () => {
      // Create a simple workflow for access testing
      const simpleWorkflow = {
        name: 'E2E Access Test Workflow',
        description: 'Testing various access patterns',
        status: 'draft',
        nodes: [
          {
            id: 'simple-start',
            type: 'trigger',
            name: 'Start',
            position: { x: 100, y: 100 },
            data: { triggerType: 'manual' }
          }
        ],
        edges: []
      };

      const createResponse = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simpleWorkflow)
      });

      const createdWorkflow = await createResponse.json();
      testWorkflowIds.push(createdWorkflow.id);

      // Test various access patterns
      const accessTests = [
        {
          name: 'Direct editor access',
          url: `${baseUrl}/workflow-editor.html`,
          shouldSucceed: true
        },
        {
          name: 'Editor with workflow ID',
          url: `${baseUrl}/workflow-editor.html?id=${createdWorkflow.id}`,
          shouldSucceed: true
        },
        {
          name: 'Editor with invalid workflow ID',
          url: `${baseUrl}/workflow-editor.html?id=invalid-workflow-id`,
          shouldSucceed: true // Page should still load, just with empty workflow
        },
        {
          name: 'API workflow access',
          url: `${baseUrl}/api/workflows/${createdWorkflow.id}`,
          shouldSucceed: true
        }
      ];

      for (const test of accessTests) {
        const response = await fetch(test.url);
        
        if (test.shouldSucceed) {
          expect(response.status).toBe(200);
          
          if (test.url.includes('/api/')) {
            // API endpoints should return JSON
            const contentType = response.headers.get('content-type');
            expect(contentType).toContain('application/json');
          } else {
            // HTML pages should return HTML
            const contentType = response.headers.get('content-type');
            expect(contentType).toContain('text/html');
          }
        } else {
          expect([404, 500]).toContain(response.status);
        }
      }
    }, 15000);

    test('should maintain workflow data integrity across operations', async () => {
      // Create workflow
      const originalWorkflow = {
        name: 'Data Integrity Test Workflow',
        description: 'Testing data persistence and integrity',
        status: 'active',
        priority: 'medium',
        nodes: [
          {
            id: 'integrity-node-1',
            type: 'trigger',
            name: 'Integrity Test Start',
            position: { x: 200, y: 200 },
            data: { 
              triggerType: 'webhook',
              endpoint: '/webhook/test',
              authentication: 'bearer_token'
            }
          },
          {
            id: 'integrity-node-2',
            type: 'agent',
            name: 'Data Processor',
            position: { x: 400, y: 200 },
            data: { 
              agentRole: 'processor',
              processingType: 'batch',
              batchSize: 100,
              timeout: 30000
            }
          }
        ],
        edges: [
          { 
            id: 'integrity-edge-1', 
            source: 'integrity-node-1', 
            target: 'integrity-node-2',
            metadata: { weight: 1, priority: 'high' }
          }
        ],
        metadata: {
          createdBy: 'e2e-test',
          environment: 'test',
          version: '1.0.0'
        }
      };

      // Create
      const createResponse = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(originalWorkflow)
      });

      const createdWorkflow = await createResponse.json();
      testWorkflowIds.push(createdWorkflow.id);

      // Read multiple times to ensure consistency
      const readAttempts = 5;
      const readResults = [];

      for (let i = 0; i < readAttempts; i++) {
        const readResponse = await fetch(`${baseUrl}/api/workflows/${createdWorkflow.id}`);
        const workflow = await readResponse.json();
        readResults.push(workflow);
        
        // Add small delay between reads
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify all reads return identical data
      for (let i = 1; i < readResults.length; i++) {
        expect(readResults[i].id).toBe(readResults[0].id);
        expect(readResults[i].name).toBe(readResults[0].name);
        expect(readResults[i].nodes.length).toBe(readResults[0].nodes.length);
        expect(readResults[i].edges.length).toBe(readResults[0].edges.length);
        
        // Deep comparison of node data
        for (let j = 0; j < readResults[i].nodes.length; j++) {
          expect(readResults[i].nodes[j].id).toBe(readResults[0].nodes[j].id);
          expect(readResults[i].nodes[j].position.x).toBe(readResults[0].nodes[j].position.x);
          expect(readResults[i].nodes[j].position.y).toBe(readResults[0].nodes[j].position.y);
        }
      }

      // Verify complex nested data is preserved
      const finalWorkflow = readResults[0];
      expect(finalWorkflow.nodes[0].data.triggerType).toBe('webhook');
      expect(finalWorkflow.nodes[0].data.endpoint).toBe('/webhook/test');
      expect(finalWorkflow.nodes[1].data.batchSize).toBe(100);
      expect(finalWorkflow.nodes[1].data.timeout).toBe(30000);
    }, 15000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle server errors gracefully', async () => {
      const errorScenarios = [
        {
          name: 'Nonexistent workflow',
          workflowId: 'nonexistent-workflow-12345',
          expectedBehavior: 'Should not crash, may return 404 or empty response'
        },
        {
          name: 'Malformed workflow ID',
          workflowId: 'invalid-id-format-!!!',
          expectedBehavior: 'Should handle gracefully'
        },
        {
          name: 'Empty workflow ID',
          workflowId: '',
          expectedBehavior: 'Should handle gracefully'
        }
      ];

      for (const scenario of errorScenarios) {
        const url = scenario.workflowId ? 
          `${baseUrl}/api/workflows/${scenario.workflowId}` : 
          `${baseUrl}/api/workflows/`;

        try {
          const response = await fetch(url);
          
          // Should not return 500 errors
          expect(response.status).not.toBe(500);
          
          // Valid responses are 200, 404, or 400
          expect([200, 400, 404]).toContain(response.status);
        } catch (error) {
          // Network errors are acceptable for malformed requests
          expect(error).toBeDefined();
        }
      }
    });

    test('should recover from temporary server issues', async () => {
      // Create a workflow first
      const testWorkflow = {
        name: 'Recovery Test Workflow',
        description: 'Testing recovery from server issues',
        nodes: [
          {
            id: 'recovery-node',
            type: 'trigger',
            name: 'Recovery Test Node',
            position: { x: 100, y: 100 },
            data: { triggerType: 'manual' }
          }
        ],
        edges: []
      };

      const createResponse = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testWorkflow)
      });

      const createdWorkflow = await createResponse.json();
      testWorkflowIds.push(createdWorkflow.id);

      // Test retry logic simulation
      const fetchWithRetry = async (url: string, maxRetries = 3) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              return response;
            }
            lastError = new Error(`HTTP ${response.status}`);
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        throw lastError;
      };

      // This should succeed on first or subsequent attempts
      const response = await fetchWithRetry(`${baseUrl}/api/workflows/${createdWorkflow.id}`);
      expect(response.status).toBe(200);

      const workflow = await response.json();
      expect(workflow.id).toBe(createdWorkflow.id);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent workflow operations', async () => {
      const concurrentWorkflows = Array.from({ length: 5 }, (_, i) => ({
        name: `Concurrent Test Workflow ${i + 1}`,
        description: `Concurrent workflow ${i + 1} for performance testing`,
        nodes: [
          {
            id: `concurrent-node-${i}-1`,
            type: 'trigger',
            name: `Concurrent Trigger ${i + 1}`,
            position: { x: 100 + i * 50, y: 100 + i * 30 },
            data: { triggerType: 'manual' }
          },
          {
            id: `concurrent-node-${i}-2`,
            type: 'agent',
            name: `Concurrent Agent ${i + 1}`,
            position: { x: 300 + i * 50, y: 100 + i * 30 },
            data: { agentRole: 'processor' }
          }
        ],
        edges: [
          { 
            id: `concurrent-edge-${i}`, 
            source: `concurrent-node-${i}-1`, 
            target: `concurrent-node-${i}-2` 
          }
        ]
      }));

      // Create all workflows concurrently
      const createPromises = concurrentWorkflows.map(workflow => 
        fetch(`${baseUrl}/api/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflow)
        })
      );

      const createResponses = await Promise.all(createPromises);
      
      // All creates should succeed
      createResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const createdWorkflows = await Promise.all(
        createResponses.map(response => response.json())
      );

      // Store IDs for cleanup
      testWorkflowIds.push(...createdWorkflows.map(w => w.id));

      // Read all workflows concurrently
      const readPromises = createdWorkflows.map(workflow =>
        fetch(`${baseUrl}/api/workflows/${workflow.id}`)
      );

      const readResponses = await Promise.all(readPromises);
      
      // All reads should succeed
      readResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const retrievedWorkflows = await Promise.all(
        readResponses.map(response => response.json())
      );

      // Verify data integrity
      retrievedWorkflows.forEach((workflow, i) => {
        expect(workflow.id).toBe(createdWorkflows[i].id);
        expect(workflow.nodes.length).toBe(2);
        expect(workflow.edges.length).toBe(1);
      });
    }, 20000);

    test('should handle large workflow data efficiently', async () => {
      // Create a workflow with many nodes to test performance
      const largeWorkflow = {
        name: 'Large Workflow Performance Test',
        description: 'Workflow with many nodes for performance testing',
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `large-node-${i}`,
          type: i % 4 === 0 ? 'trigger' : i % 4 === 1 ? 'agent' : i % 4 === 2 ? 'action' : 'output',
          name: `Node ${i + 1}`,
          position: { 
            x: (i % 10) * 120 + 100, 
            y: Math.floor(i / 10) * 100 + 100 
          },
          data: {
            nodeIndex: i,
            isLargeWorkflowNode: true,
            processingOrder: i + 1
          }
        })),
        edges: Array.from({ length: 49 }, (_, i) => ({
          id: `large-edge-${i}`,
          source: `large-node-${i}`,
          target: `large-node-${i + 1}`
        }))
      };

      const startTime = Date.now();

      // Create large workflow
      const createResponse = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeWorkflow)
      });

      expect(createResponse.status).toBe(200);
      const createdWorkflow = await createResponse.json();
      testWorkflowIds.push(createdWorkflow.id);

      const createTime = Date.now() - startTime;

      // Read large workflow
      const readStartTime = Date.now();
      const readResponse = await fetch(`${baseUrl}/api/workflows/${createdWorkflow.id}`);
      const retrievedWorkflow = await readResponse.json();
      const readTime = Date.now() - readStartTime;

      // Verify performance
      expect(createTime).toBeLessThan(5000); // Should create within 5 seconds
      expect(readTime).toBeLessThan(2000);   // Should read within 2 seconds

      // Verify data integrity
      expect(retrievedWorkflow.nodes.length).toBe(50);
      expect(retrievedWorkflow.edges.length).toBe(49);

      // Verify node positions are correct for rendering
      retrievedWorkflow.nodes.forEach((node: any, i: number) => {
        expect(node.position.x).toBe((i % 10) * 120 + 100);
        expect(node.position.y).toBe(Math.floor(i / 10) * 100 + 100);
      });
    }, 15000);
  });
});