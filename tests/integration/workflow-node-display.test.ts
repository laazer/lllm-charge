import { jest } from '@jest/globals';
import fetch from 'node-fetch';

// Mock fetch for Node.js environment
global.fetch = fetch as any;

describe('Workflow Node Display Integration Tests', () => {
  const baseUrl = 'http://localhost:3001';
  let testWorkflowId: string;

  beforeAll(async () => {
    // Create a test workflow with nodes for testing
    const testWorkflow = {
      name: 'Node Display Test Workflow',
      description: 'Integration test workflow for node display functionality',
      status: 'active',
      priority: 'high',
      nodes: [
        {
          id: 'test-trigger',
          type: 'trigger',
          name: 'Test Start Trigger',
          position: { x: 100, y: 100 },
          data: { triggerType: 'manual' }
        },
        {
          id: 'test-agent',
          type: 'agent', 
          name: 'Test Processing Agent',
          position: { x: 300, y: 100 },
          data: { 
            agentRole: 'assistant', 
            description: 'Process test data',
            inputs: ['input'],
            outputs: ['output']
          }
        },
        {
          id: 'test-output',
          type: 'output',
          name: 'Test Complete',
          position: { x: 500, y: 100 },
          data: { outputs: ['result'] }
        }
      ],
      edges: [
        { id: 'edge-1', source: 'test-trigger', target: 'test-agent' },
        { id: 'edge-2', source: 'test-agent', target: 'test-output' }
      ]
    };

    const response = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testWorkflow)
    });

    if (response.ok) {
      const workflow = await response.json();
      testWorkflowId = workflow.id;
    }
  }, 15000);

  afterAll(async () => {
    // Clean up test workflow
    if (testWorkflowId) {
      await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`, {
        method: 'DELETE'
      });
    }
  });

  describe('Static File Serving', () => {
    test('should serve workflow-editor.html with 200 status', async () => {
      const response = await fetch(`${baseUrl}/workflow-editor.html`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    test('should serve workflow-editor.html with workflow ID parameter', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/workflow-editor.html?id=${testWorkflowId}`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    test('should include workflow-editor HTML content', async () => {
      const response = await fetch(`${baseUrl}/workflow-editor.html`);
      const html = await response.text();
      
      expect(html).toContain('workflow-canvas');
      expect(html).toContain('WorkflowEditor');
      expect(html).toContain('createNodeElement');
    });
  });

  describe('Workflow API Integration', () => {
    test('should retrieve workflow data with nodes', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`);
      const workflow = await response.json();
      
      expect(response.status).toBe(200);
      expect(workflow).toBeDefined();
      expect(workflow.id).toBe(testWorkflowId);
      expect(workflow.nodes).toBeDefined();
      expect(Array.isArray(workflow.nodes)).toBe(true);
      expect(workflow.nodes.length).toBe(3);
    });

    test('should return workflow nodes with required properties', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`);
      const workflow = await response.json();
      
      workflow.nodes.forEach((node: any) => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('type');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('position');
        expect(node.position).toHaveProperty('x');
        expect(node.position).toHaveProperty('y');
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });

    test('should return workflow edges with source and target', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`);
      const workflow = await response.json();
      
      expect(workflow.edges).toBeDefined();
      expect(Array.isArray(workflow.edges)).toBe(true);
      expect(workflow.edges.length).toBe(2);
      
      workflow.edges.forEach((edge: any) => {
        expect(edge).toHaveProperty('id');
        expect(edge).toHaveProperty('source');
        expect(edge).toHaveProperty('target');
      });
    });
  });

  describe('Node Display Data Structure Validation', () => {
    test('should have valid node types for visual rendering', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`);
      const workflow = await response.json();
      
      const validNodeTypes = ['trigger', 'agent', 'output', 'action', 'condition'];
      
      workflow.nodes.forEach((node: any) => {
        expect(validNodeTypes).toContain(node.type);
      });
    });

    test('should have numeric position coordinates for DOM placement', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`);
      const workflow = await response.json();
      
      workflow.nodes.forEach((node: any) => {
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.position.x).toBeLessThan(10000);
        expect(node.position.y).toBeLessThan(10000);
      });
    });

    test('should have consistent node data structure for JavaScript consumption', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      const response = await fetch(`${baseUrl}/api/workflows/${testWorkflowId}`);
      const workflow = await response.json();
      
      workflow.nodes.forEach((node: any) => {
        // Required properties for DOM creation
        expect(typeof node.id).toBe('string');
        expect(node.id.length).toBeGreaterThan(0);
        expect(typeof node.name).toBe('string');
        expect(node.name.length).toBeGreaterThan(0);
        expect(typeof node.type).toBe('string');
        expect(node.type.length).toBeGreaterThan(0);
        
        // Optional but important properties
        if (node.data) {
          expect(typeof node.data).toBe('object');
        }
      });
    });
  });

  describe('Server Health and Connectivity', () => {
    test('should have backend server running on port 3001', async () => {
      const response = await fetch(`${baseUrl}/api/test`);
      expect(response.status).toBe(200);
    });

    test('should return valid JSON from workflow endpoints', async () => {
      const response = await fetch(`${baseUrl}/api/workflows`);
      expect(response.status).toBe(200);
      
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
      
      const workflows = await response.json();
      expect(Array.isArray(workflows)).toBe(true);
    });

    test('should handle workflow not found gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/workflows/nonexistent-workflow-id`);
      // Should return 404 or empty result, not 500 error
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('DOM Loading Compatibility', () => {
    test('should serve HTML that contains required DOM elements for node display', async () => {
      const response = await fetch(`${baseUrl}/workflow-editor.html`);
      const html = await response.text();
      
      // Check for critical DOM elements
      expect(html).toContain('id="workflow-canvas"');
      expect(html).toContain('WorkflowEditor');
      expect(html).toContain('loadWorkflow');
      expect(html).toContain('createNodeFromData');
    });

    test('should include required CSS classes for node styling', async () => {
      const response = await fetch(`${baseUrl}/workflow-editor.html`);
      const html = await response.text();
      
      // Check for critical CSS classes
      expect(html).toContain('.workflow-node');
      expect(html).toContain('.workflow-canvas');
      expect(html).toContain('position:');
    });

    test('should include JavaScript functions for node creation', async () => {
      const response = await fetch(`${baseUrl}/workflow-editor.html`);
      const html = await response.text();
      
      // Check for critical JavaScript functions
      expect(html).toContain('createNodeElement');
      expect(html).toContain('appendChild');
      expect(html).toContain('getElementById');
      expect(html).toContain('createElement');
    });
  });

  describe('Regression Prevention', () => {
    test('should not return 500 errors for workflow editor requests', async () => {
      const testUrls = [
        `${baseUrl}/workflow-editor.html`,
        `${baseUrl}/workflow-editor.html?id=test-id`,
        `${baseUrl}/api/workflows`
      ];

      for (const url of testUrls) {
        const response = await fetch(url);
        expect(response.status).not.toBe(500);
        expect([200, 404]).toContain(response.status);
      }
    });

    test('should maintain workflow data persistence across requests', async () => {
      if (!testWorkflowId) {
        throw new Error('Test workflow not created');
      }

      // Make multiple requests to ensure data consistency
      const responses = await Promise.all([
        fetch(`${baseUrl}/api/workflows/${testWorkflowId}`),
        fetch(`${baseUrl}/api/workflows/${testWorkflowId}`),
        fetch(`${baseUrl}/api/workflows/${testWorkflowId}`)
      ]);

      const workflows = await Promise.all(
        responses.map(r => r.json())
      );

      // All requests should return identical data
      workflows.forEach(workflow => {
        expect(workflow.id).toBe(testWorkflowId);
        expect(workflow.nodes.length).toBe(3);
        expect(workflow.edges.length).toBe(2);
      });
    });

    test('should handle concurrent workflow requests without errors', async () => {
      // Create multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        fetch(`${baseUrl}/api/workflows`)
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});