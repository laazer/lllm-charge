import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Workflow Editor Drag Functionality Fix Verification', () => {
  let workflowEditorHtml: string;

  beforeAll(() => {
    const filePath = path.join(__dirname, '../../src/dashboard/workflow-editor.html');
    workflowEditorHtml = fs.readFileSync(filePath, 'utf-8');
  });

  describe('Critical Fix: setupNodeInteractions Parameter Mismatch', () => {
    test('should call setupNodeInteractions with correct parameters', () => {
      // The fix: setupNodeInteractions should be called with (nodeElement, nodeData) not (node)
      expect(workflowEditorHtml).toContain('this.setupNodeInteractions(nodeElement, nodeData)');
      
      // Should NOT contain the broken version
      expect(workflowEditorHtml).not.toContain('this.setupNodeInteractions(node);');
    });

    test('should have setupNodeInteractions function with correct signature', () => {
      // Function should expect 2 parameters: element and nodeData
      expect(workflowEditorHtml).toContain('setupNodeInteractions(element, nodeData)');
    });

    test('should attach drag event listeners in setupNodeInteractions', () => {
      // Verify drag implementation is present in the function
      const setupFunction = workflowEditorHtml.match(/setupNodeInteractions\(element, nodeData\)\s*{[\s\S]*?(?=\n\s*})/);
      expect(setupFunction).toBeTruthy();
      
      if (setupFunction) {
        const functionBody = setupFunction[0];
        
        // Should have mousedown event listener
        expect(functionBody).toContain("element.addEventListener('mousedown'");
        
        // Should have drag state variables
        expect(functionBody).toContain('let isDragging = false');
        expect(functionBody).toContain('let startX, startY, startNodeX, startNodeY');
        
        // Should have performance optimization
        expect(functionBody).toContain('requestAnimationFrame');
        expect(functionBody).toContain('animationId');
        
        // Should have proper drag logic
        expect(functionBody).toContain('nodeData.x = startNodeX + deltaX');
        expect(functionBody).toContain('nodeData.y = startNodeY + deltaY');
        expect(functionBody).toContain("element.style.transform = `translate");
      }
    });
  });

  describe('Complete Drag Implementation Chain', () => {
    test('should have complete workflow from node creation to drag functionality', () => {
      // Step 1: createNodeFromData should call setupNodeInteractions correctly
      const createNodeFunction = workflowEditorHtml.match(/createNodeFromData\(nodeData\)\s*{[\s\S]*?(?=\n\s*}\s*\n)/);
      expect(createNodeFunction).toBeTruthy();
      
      if (createNodeFunction) {
        const functionBody = createNodeFunction[0];
        
        // Should create the node element
        expect(functionBody).toContain('createNodeElement(nodeData.type, nodeData.position.x, nodeData.position.y)');
        
        // Should append to canvas
        expect(functionBody).toContain('this.canvas.appendChild(nodeElement)');
        
        // Should setup interactions with correct parameters
        expect(functionBody).toContain('this.setupNodeInteractions(nodeElement, nodeData)');
      }
    });

    test('should have setupNodeInteractions that adds drag functionality to DOM elements', () => {
      // Function should attach events to the DOM element parameter
      const lines = workflowEditorHtml.split('\n');
      const setupStart = lines.findIndex(line => line.includes('setupNodeInteractions(element, nodeData)'));
      expect(setupStart).toBeGreaterThan(-1);
      
      // Find the function body
      let braceCount = 0;
      let setupEnd = setupStart;
      for (let i = setupStart; i < lines.length; i++) {
        const line = lines[i];
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        if (braceCount === 0 && i > setupStart) {
          setupEnd = i;
          break;
        }
      }
      
      const functionBody = lines.slice(setupStart, setupEnd + 1).join('\n');
      
      // Should attach mousedown to the 'element' parameter
      expect(functionBody).toContain("element.addEventListener('mousedown'");
      
      // Should reference nodeData for position tracking
      expect(functionBody).toContain('startNodeX = nodeData.x');
      expect(functionBody).toContain('startNodeY = nodeData.y');
    });
  });

  describe('Drag Functionality Components', () => {
    test('should have all required drag implementation components', () => {
      const dragComponents = [
        // Event handlers
        "element.addEventListener('mousedown'",
        'onMouseMove',
        'onMouseUp',
        
        // State variables
        'let isDragging = false',
        'let startX, startY, startNodeX, startNodeY',
        'let animationId = null',
        
        // Performance optimizations
        'requestAnimationFrame',
        'passive: true',
        
        // Visual feedback
        "element.style.zIndex = '1000'",
        "element.style.userSelect = 'none'",
        'style.transform',
        
        // Position updates
        'nodeData.x = startNodeX + deltaX',
        'nodeData.y = startNodeY + deltaY',
        'element.style.left = nodeData.x',
        'element.style.top = nodeData.y',
        
        // Event cleanup
        'removeEventListener',
        'isDragging = false'
      ];
      
      dragComponents.forEach(component => {
        expect(workflowEditorHtml).toContain(component);
      });
    });

    test('should prevent dragging of connection points', () => {
      expect(workflowEditorHtml).toContain("if (e.target.classList.contains('connection-point')) return;");
    });

    test('should have proper event prevention', () => {
      expect(workflowEditorHtml).toContain('e.preventDefault()');
    });
  });

  describe('Integration with Node Creation', () => {
    test('should create nodes that are immediately draggable', () => {
      // The complete chain:
      // 1. createNodeFromData creates DOM element
      // 2. setupNodeInteractions attaches drag handlers to that element
      // 3. Node is appended to canvas and becomes draggable
      
      const criticalFlow = [
        'createNodeElement(nodeData.type, nodeData.position.x, nodeData.position.y)',
        'this.canvas.appendChild(nodeElement)',
        'this.setupNodeInteractions(nodeElement, nodeData)'
      ];
      
      criticalFlow.forEach(step => {
        expect(workflowEditorHtml).toContain(step);
      });
    });

    test('should have proper error handling for drag setup', () => {
      // Should have error handling in createNodeFromData
      expect(workflowEditorHtml).toContain('console.error(\'❌ Error in createNodeFromData:\'');
      
      // Should have error handling in setupNodeInteractions (implicit via try-catch in caller)
      expect(workflowEditorHtml).toContain('try {');
      expect(workflowEditorHtml).toContain('} catch (error) {');
    });
  });

  describe('DOM Element Interaction', () => {
    test('should correctly bind event handlers to DOM elements', () => {
      // The fixed version should pass the actual DOM element to setupNodeInteractions
      // This ensures event listeners are attached to the correct DOM node
      
      const setupCall = workflowEditorHtml.match(/this\.setupNodeInteractions\([^)]+\)/);
      expect(setupCall).toBeTruthy();
      expect(setupCall?.[0]).toBe('this.setupNodeInteractions(nodeElement, nodeData)');
    });

    test('should use correct DOM element reference in drag handlers', () => {
      // Event handlers should reference the 'element' parameter, not a different variable
      expect(workflowEditorHtml).toContain("element.addEventListener('mousedown'");
      expect(workflowEditorHtml).toContain("element.style.zIndex = '1000'");
      expect(workflowEditorHtml).toContain("element.style.userSelect = 'none'");
    });
  });
});