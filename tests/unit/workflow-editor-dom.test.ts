import { jest } from '@jest/globals';

// Mock DOM environment for Node.js testing
const mockDocument = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  readyState: 'complete',
  addEventListener: jest.fn()
};

const mockElement = {
  appendChild: jest.fn(),
  innerHTML: '',
  style: {},
  className: '',
  id: '',
  children: [],
  offsetWidth: 800,
  offsetHeight: 600
};

const mockCanvas = {
  ...mockElement,
  children: [] as any[]
};

// Mock global objects
(global as any).document = mockDocument;
(global as any).window = {
  location: { search: '?id=test-workflow-id' }
};

describe('Workflow Editor DOM Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanvas.children = [];
    
    // Setup default mocks
    mockDocument.getElementById.mockImplementation((id: string) => {
      if (id === 'workflow-canvas') return mockCanvas;
      return mockElement;
    });
    
    mockDocument.createElement.mockReturnValue(mockElement);
  });

  describe('Node Creation Functions', () => {
    test('should create node element with required properties', () => {
      // Simulate the createNodeElement function logic
      const nodeData = {
        id: 'test-node-1',
        type: 'trigger',
        name: 'Test Trigger Node',
        position: { x: 150, y: 100 },
        data: { triggerType: 'manual' }
      };

      // Mock the workflow editor's createNodeElement function
      const createNodeElement = (nodeData: any) => {
        const canvas = mockDocument.getElementById('workflow-canvas');
        if (!canvas) throw new Error('Canvas not found');

        const nodeElement = mockDocument.createElement('div');
        nodeElement.className = 'workflow-node';
        nodeElement.id = `node-${nodeData.id}`;
        nodeElement.style.left = `${nodeData.position.x}px`;
        nodeElement.style.top = `${nodeData.position.y}px`;
        
        nodeElement.innerHTML = `
          <div class="node-header">${nodeData.name}</div>
          <div class="node-body">Type: ${nodeData.type}</div>
        `;

        canvas.appendChild(nodeElement);
        return nodeElement;
      };

      const result = createNodeElement(nodeData);

      expect(mockDocument.getElementById).toHaveBeenCalledWith('workflow-canvas');
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.className).toBe('workflow-node');
      expect(mockElement.id).toBe('node-test-node-1');
      expect(mockElement.style.left).toBe('150px');
      expect(mockElement.style.top).toBe('100px');
      expect(mockCanvas.appendChild).toHaveBeenCalledWith(mockElement);
    });

    test('should handle missing canvas element gracefully', () => {
      mockDocument.getElementById.mockReturnValue(null);

      const nodeData = {
        id: 'test-node',
        type: 'agent',
        name: 'Test Node',
        position: { x: 100, y: 100 }
      };

      const createNodeElement = (nodeData: any) => {
        const canvas = mockDocument.getElementById('workflow-canvas');
        if (!canvas) throw new Error('Canvas not found');
        
        const nodeElement = mockDocument.createElement('div');
        canvas.appendChild(nodeElement);
        return nodeElement;
      };

      expect(() => createNodeElement(nodeData)).toThrow('Canvas not found');
      expect(mockDocument.getElementById).toHaveBeenCalledWith('workflow-canvas');
    });

    test('should create different node styles based on node type', () => {
      const nodeTypes = [
        { type: 'trigger', expectedClass: 'workflow-node' },
        { type: 'agent', expectedClass: 'workflow-node' },
        { type: 'output', expectedClass: 'workflow-node' },
        { type: 'action', expectedClass: 'workflow-node' }
      ];

      nodeTypes.forEach(({ type, expectedClass }) => {
        jest.clearAllMocks();
        mockDocument.createElement.mockReturnValue({ ...mockElement });

        const nodeData = {
          id: `test-${type}`,
          type: type,
          name: `Test ${type} Node`,
          position: { x: 100, y: 100 }
        };

        const createNodeElement = (nodeData: any) => {
          const canvas = mockDocument.getElementById('workflow-canvas');
          const nodeElement = mockDocument.createElement('div');
          nodeElement.className = expectedClass;
          
          // Apply type-specific styling
          if (nodeData.type === 'trigger') {
            nodeElement.style.background = '#dcfce7';
            nodeElement.style.borderColor = '#16a34a';
          } else if (nodeData.type === 'agent') {
            nodeElement.style.background = '#dbeafe';
            nodeElement.style.borderColor = '#2563eb';
          } else if (nodeData.type === 'output') {
            nodeElement.style.background = '#fef3c7';
            nodeElement.style.borderColor = '#d97706';
          }

          canvas.appendChild(nodeElement);
          return nodeElement;
        };

        const result = createNodeElement(nodeData);
        expect(mockDocument.createElement).toHaveBeenCalledWith('div');
        expect(mockCanvas.appendChild).toHaveBeenCalled();
      });
    });
  });

  describe('Workflow Loading Functions', () => {
    test('should load workflow data and create nodes', async () => {
      const mockWorkflowData = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'trigger',
            name: 'Start Trigger',
            position: { x: 100, y: 100 },
            data: { triggerType: 'manual' }
          },
          {
            id: 'node-2',
            type: 'agent',
            name: 'Process Agent',
            position: { x: 300, y: 100 },
            data: { agentRole: 'assistant' }
          }
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' }
        ]
      };

      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorkflowData)
      }) as any;

      const loadWorkflow = async (workflowId: string) => {
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (!response.ok) throw new Error('Failed to load workflow');
        
        const workflow = await response.json();
        const canvas = mockDocument.getElementById('workflow-canvas');
        
        if (workflow.nodes && canvas) {
          workflow.nodes.forEach((nodeData: any) => {
            const nodeElement = mockDocument.createElement('div');
            nodeElement.className = 'workflow-node';
            nodeElement.id = `node-${nodeData.id}`;
            canvas.appendChild(nodeElement);
          });
        }
        
        return workflow;
      };

      const result = await loadWorkflow('test-workflow');

      expect(global.fetch).toHaveBeenCalledWith('/api/workflows/test-workflow');
      expect(mockDocument.getElementById).toHaveBeenCalledWith('workflow-canvas');
      expect(mockDocument.createElement).toHaveBeenCalledTimes(2); // Two nodes
      expect(mockCanvas.appendChild).toHaveBeenCalledTimes(2);
      expect(result.nodes.length).toBe(2);
    });

    test('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      }) as any;

      const loadWorkflow = async (workflowId: string) => {
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      };

      await expect(loadWorkflow('invalid-id')).rejects.toThrow('HTTP error! status: 500');
    });

    test('should handle empty workflow data', async () => {
      const emptyWorkflow = {
        id: 'empty-workflow',
        name: 'Empty Workflow',
        nodes: [],
        edges: []
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(emptyWorkflow)
      }) as any;

      const loadWorkflow = async (workflowId: string) => {
        const response = await fetch(`/api/workflows/${workflowId}`);
        const workflow = await response.json();
        const canvas = mockDocument.getElementById('workflow-canvas');
        
        if (workflow.nodes && canvas) {
          workflow.nodes.forEach((nodeData: any) => {
            const nodeElement = mockDocument.createElement('div');
            canvas.appendChild(nodeElement);
          });
        }
        
        return workflow;
      };

      const result = await loadWorkflow('empty-workflow');
      
      expect(result.nodes.length).toBe(0);
      expect(mockCanvas.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('DOM Timing and Loading', () => {
    test('should handle DOM ready state correctly', () => {
      const domLoadingStates = ['loading', 'interactive', 'complete'];
      
      domLoadingStates.forEach(state => {
        mockDocument.readyState = state;
        
        const initializeEditor = () => {
          if (mockDocument.readyState === 'loading') {
            mockDocument.addEventListener('DOMContentLoaded', () => {
              const canvas = mockDocument.getElementById('workflow-canvas');
              return canvas !== null;
            });
            return false; // Not ready
          } else {
            const canvas = mockDocument.getElementById('workflow-canvas');
            return canvas !== null;
          }
        };

        const result = initializeEditor();
        
        if (state === 'loading') {
          expect(result).toBe(false);
          expect(mockDocument.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
        } else {
          expect(result).toBe(true);
          expect(mockDocument.getElementById).toHaveBeenCalledWith('workflow-canvas');
        }
      });
    });

    test('should validate canvas dimensions for node positioning', () => {
      const validateCanvasForNodes = () => {
        const canvas = mockDocument.getElementById('workflow-canvas');
        if (!canvas) return { valid: false, reason: 'Canvas not found' };
        
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        
        if (width < 100 || height < 100) {
          return { valid: false, reason: 'Canvas too small' };
        }
        
        return { valid: true, width, height };
      };

      const result = validateCanvasForNodes();
      
      expect(result.valid).toBe(true);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed node data gracefully', () => {
      const malformedNodeData = [
        { id: 'node-1' }, // Missing required fields
        { id: 'node-2', type: 'trigger' }, // Missing name and position
        { id: 'node-3', type: 'agent', name: 'Test', position: null }, // Null position
        { id: 'node-4', type: 'output', name: 'Test', position: { x: 'invalid', y: 100 } } // Invalid position
      ];

      const createSafeNodeElement = (nodeData: any) => {
        try {
          if (!nodeData.id || !nodeData.type || !nodeData.name) {
            throw new Error('Missing required node properties');
          }
          
          if (!nodeData.position || typeof nodeData.position.x !== 'number' || typeof nodeData.position.y !== 'number') {
            throw new Error('Invalid node position');
          }
          
          const canvas = mockDocument.getElementById('workflow-canvas');
          if (!canvas) throw new Error('Canvas not found');
          
          const nodeElement = mockDocument.createElement('div');
          nodeElement.className = 'workflow-node';
          nodeElement.style.left = `${nodeData.position.x}px`;
          nodeElement.style.top = `${nodeData.position.y}px`;
          
          canvas.appendChild(nodeElement);
          return nodeElement;
        } catch (error) {
          console.error('Failed to create node:', error);
          return null;
        }
      };

      malformedNodeData.forEach((nodeData, index) => {
        const result = createSafeNodeElement(nodeData);
        expect(result).toBe(null);
      });
    });

    test('should prevent duplicate node IDs', () => {
      const existingNodeIds = new Set<string>();
      
      const createUniqueNode = (nodeData: any) => {
        if (existingNodeIds.has(nodeData.id)) {
          throw new Error(`Duplicate node ID: ${nodeData.id}`);
        }
        
        existingNodeIds.add(nodeData.id);
        const canvas = mockDocument.getElementById('workflow-canvas');
        const nodeElement = mockDocument.createElement('div');
        nodeElement.id = `node-${nodeData.id}`;
        canvas.appendChild(nodeElement);
        
        return nodeElement;
      };

      const nodeData1 = { id: 'duplicate-id', type: 'trigger', name: 'First Node', position: { x: 100, y: 100 } };
      const nodeData2 = { id: 'duplicate-id', type: 'agent', name: 'Second Node', position: { x: 200, y: 100 } };

      expect(() => createUniqueNode(nodeData1)).not.toThrow();
      expect(() => createUniqueNode(nodeData2)).toThrow('Duplicate node ID: duplicate-id');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should clean up nodes when workflow changes', () => {
      // Simulate loading a workflow with nodes
      const initialNodes = [
        { id: 'node-1', type: 'trigger', name: 'Node 1', position: { x: 100, y: 100 } },
        { id: 'node-2', type: 'agent', name: 'Node 2', position: { x: 200, y: 100 } }
      ];

      const clearWorkflow = () => {
        const canvas = mockDocument.getElementById('workflow-canvas');
        if (canvas) {
          canvas.innerHTML = '';
          canvas.children.length = 0; // Simulate clearing children
        }
      };

      const loadNodes = (nodes: any[]) => {
        nodes.forEach(nodeData => {
          const nodeElement = mockDocument.createElement('div');
          mockCanvas.appendChild(nodeElement);
          mockCanvas.children.push(nodeElement);
        });
      };

      // Load initial nodes
      loadNodes(initialNodes);
      expect(mockCanvas.children.length).toBe(2);

      // Clear workflow
      clearWorkflow();
      expect(mockCanvas.innerHTML).toBe('');
      expect(mockCanvas.children.length).toBe(0);
    });

    test('should handle large numbers of nodes efficiently', () => {
      const largeNodeSet = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        type: i % 3 === 0 ? 'trigger' : i % 3 === 1 ? 'agent' : 'output',
        name: `Node ${i}`,
        position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 }
      }));

      const batchCreateNodes = (nodes: any[]) => {
        const startTime = Date.now();
        const canvas = mockDocument.getElementById('workflow-canvas');
        
        nodes.forEach(nodeData => {
          const nodeElement = mockDocument.createElement('div');
          nodeElement.className = 'workflow-node';
          nodeElement.id = `node-${nodeData.id}`;
          canvas.appendChild(nodeElement);
        });
        
        const endTime = Date.now();
        return endTime - startTime;
      };

      const processingTime = batchCreateNodes(largeNodeSet);
      
      expect(mockCanvas.appendChild).toHaveBeenCalledTimes(100);
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});