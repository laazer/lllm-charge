import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Workflow Editor Position Structure Fix Verification', () => {
  let workflowEditorHtml: string;

  beforeAll(() => {
    const filePath = path.join(__dirname, '../../src/dashboard/workflow-editor.html');
    workflowEditorHtml = fs.readFileSync(filePath, 'utf-8');
  });

  describe('Critical Fix: NodeData Position Structure Access', () => {
    test('should access position coordinates using nodeData.position.x/y structure', () => {
      // The fix: should use nodeData.position.x instead of nodeData.x
      expect(workflowEditorHtml).toContain('startNodeX = nodeData.position.x');
      expect(workflowEditorHtml).toContain('startNodeY = nodeData.position.y');
      
      // Should NOT contain the broken direct access
      expect(workflowEditorHtml).not.toContain('startNodeX = nodeData.x');
      expect(workflowEditorHtml).not.toContain('startNodeY = nodeData.y');
    });

    test('should update position coordinates using correct structure in mousemove', () => {
      // The fix: should update nodeData.position.x/y during drag
      expect(workflowEditorHtml).toContain('nodeData.position.x = startNodeX + deltaX');
      expect(workflowEditorHtml).toContain('nodeData.position.y = startNodeY + deltaY');
      
      // Should NOT contain direct updates to wrong structure
      const wrongUpdates = workflowEditorHtml.match(/nodeData\.x\s*=.*deltaX/);
      const wrongUpdatesY = workflowEditorHtml.match(/nodeData\.y\s*=.*deltaY/);
      expect(wrongUpdates).toBeNull();
      expect(wrongUpdatesY).toBeNull();
    });

    test('should finalize position coordinates using correct structure in mouseup', () => {
      // The fix: should use nodeData.position.x/y for final positioning
      expect(workflowEditorHtml).toContain('element.style.left = nodeData.position.x');
      expect(workflowEditorHtml).toContain('element.style.top = nodeData.position.y');
      
      // Should NOT contain direct access to wrong structure
      expect(workflowEditorHtml).not.toContain('element.style.left = nodeData.x');
      expect(workflowEditorHtml).not.toContain('element.style.top = nodeData.y');
    });
  });

  describe('Complete Position Structure Chain', () => {
    test('should have consistent position structure access throughout drag implementation', () => {
      // Find the setupNodeInteractions function
      const setupFunction = workflowEditorHtml.match(/setupNodeInteractions\(element, nodeData\)\s*{[\s\S]*?(?=\n\s*}[\s\S]*?\n\s*\w)/);
      expect(setupFunction).toBeTruthy();
      
      if (setupFunction) {
        const functionBody = setupFunction[0];
        
        // Count all position structure accesses
        const positionXAccess = (functionBody.match(/nodeData\.position\.x/g) || []).length;
        const positionYAccess = (functionBody.match(/nodeData\.position\.y/g) || []).length;
        
        // Should have at least 6 proper position accesses (2 in mousedown, 2 in mousemove, 2 in mouseup)
        expect(positionXAccess).toBeGreaterThanOrEqual(6);
        expect(positionYAccess).toBeGreaterThanOrEqual(6);
        
        // Should have zero direct nodeData.x/y accesses (excluding position.x/y)
        const directXAccess = (functionBody.match(/nodeData\.x(?!\.)/g) || []).length;
        const directYAccess = (functionBody.match(/nodeData\.y(?!\.)/g) || []).length;
        
        expect(directXAccess).toBe(0);
        expect(directYAccess).toBe(0);
      }
    });

    test('should have proper data structure compatibility with API workflow format', () => {
      // The API sends workflows with nodes that have position: {x: number, y: number}
      // The drag code should be compatible with this structure
      
      const mouseDownHandler = workflowEditorHtml.match(/element\.addEventListener\('mousedown'[\s\S]*?}\);/);
      expect(mouseDownHandler).toBeTruthy();
      
      if (mouseDownHandler) {
        const handlerBody = mouseDownHandler[0];
        expect(handlerBody).toContain('nodeData.position.x');
        expect(handlerBody).toContain('nodeData.position.y');
      }
    });
  });

  describe('Drag Event Flow Integration', () => {
    test('should have complete event flow from mousedown to mouseup with correct position handling', () => {
      // Verify the complete chain of position updates
      const criticalPositionFlow = [
        // Initial position capture
        'startNodeX = nodeData.position.x',
        'startNodeY = nodeData.position.y',
        
        // Live position updates during drag
        'nodeData.position.x = startNodeX + deltaX',
        'nodeData.position.y = startNodeY + deltaY',
        
        // Final position application
        'element.style.left = nodeData.position.x',
        'element.style.top = nodeData.position.y'
      ];
      
      criticalPositionFlow.forEach(step => {
        expect(workflowEditorHtml).toContain(step);
      });
    });

    test('should maintain transform consistency during and after drag', () => {
      // During drag: use transform for smooth animation
      expect(workflowEditorHtml).toContain("element.style.transform = `translate(${deltaX}px, ${deltaY}px)`");
      
      // After drag: clear transform and use left/top positioning
      expect(workflowEditorHtml).toContain("element.style.transform = ''");
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain setupNodeInteractions function signature compatibility', () => {
      // The function should still expect (element, nodeData) parameters
      expect(workflowEditorHtml).toContain('setupNodeInteractions(element, nodeData)');
      
      // The call should still pass both parameters correctly
      expect(workflowEditorHtml).toContain('this.setupNodeInteractions(nodeElement, nodeData)');
    });

    test('should not break existing node creation workflow', () => {
      // Node creation should still work with position structure
      const createNodeFunction = workflowEditorHtml.match(/createNodeFromData\(nodeData\)[\s\S]*?this\.setupNodeInteractions\(nodeElement, nodeData\)/);
      expect(createNodeFunction).toBeTruthy();
    });
  });

  describe('Performance and Cleanup', () => {
    test('should maintain performance optimizations with correct position structure', () => {
      // Should still use requestAnimationFrame for performance
      expect(workflowEditorHtml).toContain('requestAnimationFrame');
      
      // Should still clean up animation frames
      expect(workflowEditorHtml).toContain('cancelAnimationFrame');
      
      // Should still remove event listeners
      expect(workflowEditorHtml).toContain('removeEventListener');
    });

    test('should maintain real-time connection updates during drag', () => {
      // Should call updateConnections during drag with correct position
      expect(workflowEditorHtml).toContain('this.updateConnections()');
    });
  });
});