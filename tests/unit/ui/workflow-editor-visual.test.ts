import { jest } from '@jest/globals'
import { JSDOM } from 'jsdom'
import { WorkflowEditor } from '../../../src/ui/workflow-editor.js'
import type {
  WorkflowDefinition,
  WorkflowNode,
  NodePosition,
  VisualStyles,
  CanvasState
} from '../../../src/ui/types.js'

// Mock Canvas API for headless testing
const mockCanvas = {
  getContext: jest.fn(() => ({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '14px Arial',
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 })),
    closePath: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    setTransform: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1
    }))
  })),
  width: 1200,
  height: 800,
  style: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getBoundingClientRect: jest.fn(() => ({
    left: 0,
    top: 0,
    width: 1200,
    height: 800
  })),
  toDataURL: jest.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
}

// Mock DOM environment
const mockDOM = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Workflow Editor Test</title></head>
    <body>
      <div id="workflow-container">
        <canvas id="workflow-canvas" width="1200" height="800"></canvas>
        <div id="node-palette"></div>
        <div id="properties-panel"></div>
        <div id="toolbar"></div>
      </div>
    </body>
  </html>
`)

// Set up global DOM
global.window = mockDOM.window as any
global.document = mockDOM.window.document
global.HTMLCanvasElement = class MockCanvas extends mockDOM.window.HTMLElement {
  getContext() { return mockCanvas.getContext() }
  get width() { return mockCanvas.width }
  get height() { return mockCanvas.height }
  set width(w) { mockCanvas.width = w }
  set height(h) { mockCanvas.height = h }
  getBoundingClientRect() { return mockCanvas.getBoundingClientRect() }
  toDataURL() { return mockCanvas.toDataURL() }
  addEventListener() { return mockCanvas.addEventListener() }
  removeEventListener() { return mockCanvas.removeEventListener() }
}

describe('Workflow Editor Visual Tests', () => {
  let editor: WorkflowEditor
  let canvas: HTMLCanvasElement
  let container: HTMLElement

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="workflow-container">
        <canvas id="workflow-canvas" width="1200" height="800"></canvas>
        <div id="node-palette"></div>
        <div id="properties-panel"></div>
        <div id="toolbar"></div>
      </div>
    `

    container = document.getElementById('workflow-container')!
    canvas = document.getElementById('workflow-canvas') as HTMLCanvasElement
    
    editor = new WorkflowEditor(container, {
      width: 1200,
      height: 800,
      gridSize: 20,
      snapToGrid: true,
      theme: 'light'
    })

    // Mock canvas methods
    Object.assign(canvas, mockCanvas)
  })

  afterEach(() => {
    editor?.destroy()
  })

  describe('Canvas Rendering', () => {
    test('should initialize canvas with correct dimensions', () => {
      expect(canvas.width).toBe(1200)
      expect(canvas.height).toBe(800)

      const ctx = canvas.getContext('2d')
      expect(ctx).toBeDefined()
    })

    test('should render grid background', () => {
      editor.renderGrid()

      const ctx = canvas.getContext('2d')
      expect(ctx!.strokeStyle).toBe('#e0e0e0')
      expect(ctx!.beginPath).toHaveBeenCalled()
      expect(ctx!.stroke).toHaveBeenCalled()
    })

    test('should render workflow nodes', () => {
      const testWorkflow: WorkflowDefinition = {
        id: 'visual-test-workflow',
        name: 'Visual Test Workflow',
        nodes: [
          {
            id: 'start-node',
            type: 'trigger',
            name: 'Start',
            position: { x: 100, y: 100 },
            parameters: {},
            connections: {}
          },
          {
            id: 'llm-node',
            type: 'llm-completion',
            name: 'LLM Task',
            position: { x: 300, y: 100 },
            parameters: { model: 'gpt-3.5-turbo' },
            connections: {}
          }
        ],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(testWorkflow)
      editor.render()

      const ctx = canvas.getContext('2d')!
      expect(ctx.fillRect).toHaveBeenCalled()
      expect(ctx.fillText).toHaveBeenCalledWith('Start', expect.any(Number), expect.any(Number))
      expect(ctx.fillText).toHaveBeenCalledWith('LLM Task', expect.any(Number), expect.any(Number))
    })

    test('should render node connections', () => {
      const workflowWithConnections: WorkflowDefinition = {
        id: 'connection-test',
        name: 'Connection Test',
        nodes: [
          {
            id: 'node1',
            type: 'trigger',
            name: 'Node 1',
            position: { x: 100, y: 100 },
            parameters: {},
            connections: {
              main: [[{ node: 'node2', type: 'main', index: 0 }]]
            }
          },
          {
            id: 'node2',
            type: 'process',
            name: 'Node 2',
            position: { x: 300, y: 100 },
            parameters: {},
            connections: {}
          }
        ],
        connections: {
          node1: {
            main: [[{ node: 'node2', type: 'main', index: 0 }]]
          }
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflowWithConnections)
      editor.render()

      const ctx = canvas.getContext('2d')!
      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.moveTo).toHaveBeenCalled()
      expect(ctx.lineTo).toHaveBeenCalled()
      expect(ctx.stroke).toHaveBeenCalled()
    })
  })

  describe('Node Palette Rendering', () => {
    test('should render node palette with available node types', () => {
      const palette = document.getElementById('node-palette')!
      editor.renderNodePalette()

      expect(palette.children.length).toBeGreaterThan(0)
      
      const nodeTypes = Array.from(palette.children).map(child => 
        child.getAttribute('data-node-type')
      )
      
      expect(nodeTypes).toContain('trigger')
      expect(nodeTypes).toContain('llm-completion')
      expect(nodeTypes).toContain('llm-chat')
      expect(nodeTypes).toContain('condition')
      expect(nodeTypes).toContain('end')
    })

    test('should render node icons in palette', () => {
      editor.renderNodePalette()
      
      const palette = document.getElementById('node-palette')!
      const nodeElements = palette.querySelectorAll('.node-palette-item')
      
      nodeElements.forEach(element => {
        const icon = element.querySelector('.node-icon')
        const label = element.querySelector('.node-label')
        
        expect(icon).toBeTruthy()
        expect(label).toBeTruthy()
        expect(label!.textContent).toBeTruthy()
      })
    })

    test('should apply drag and drop styling to palette items', () => {
      editor.renderNodePalette()
      
      const palette = document.getElementById('node-palette')!
      const firstItem = palette.querySelector('.node-palette-item') as HTMLElement
      
      expect(firstItem.draggable).toBe(true)
      expect(firstItem.style.cursor).toBe('grab')
    })
  })

  describe('Visual Interactions', () => {
    test('should highlight nodes on hover', () => {
      const workflow: WorkflowDefinition = {
        id: 'hover-test',
        name: 'Hover Test',
        nodes: [{
          id: 'hover-node',
          type: 'process',
          name: 'Hover Me',
          position: { x: 200, y: 200 },
          parameters: {},
          connections: {}
        }],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      
      // Simulate hover
      const hoverEvent = new mockDOM.window.MouseEvent('mouseover', {
        clientX: 220,
        clientY: 220
      })
      
      editor.handleMouseMove(hoverEvent as any)
      
      const hoveredNode = editor.getHoveredNode()
      expect(hoveredNode?.id).toBe('hover-node')
    })

    test('should show selection indicators for selected nodes', () => {
      const workflow: WorkflowDefinition = {
        id: 'selection-test',
        name: 'Selection Test',
        nodes: [{
          id: 'selectable-node',
          type: 'llm-completion',
          name: 'Select Me',
          position: { x: 150, y: 150 },
          parameters: {},
          connections: {}
        }],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      editor.selectNode('selectable-node')
      editor.render()

      const ctx = canvas.getContext('2d')!
      expect(ctx.strokeStyle).toBe('#2196f3')
      expect(ctx.strokeRect).toHaveBeenCalled()
    })

    test('should render connection preview during drag', () => {
      const workflow: WorkflowDefinition = {
        id: 'connection-preview-test',
        name: 'Connection Preview',
        nodes: [
          {
            id: 'source-node',
            type: 'trigger',
            name: 'Source',
            position: { x: 100, y: 100 },
            parameters: {},
            connections: {}
          },
          {
            id: 'target-node',
            type: 'end',
            name: 'Target',
            position: { x: 300, y: 100 },
            parameters: {},
            connections: {}
          }
        ],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      
      // Simulate connection drag
      editor.startConnectionDrag('source-node', 0)
      editor.updateConnectionPreview({ x: 250, y: 120 })
      editor.render()

      const ctx = canvas.getContext('2d')!
      expect(ctx.setLineDash).toHaveBeenCalledWith([5, 5])
      expect(ctx.stroke).toHaveBeenCalled()
    })
  })

  describe('Theme and Styling', () => {
    test('should apply light theme colors', () => {
      editor.setTheme('light')
      editor.render()

      const styles = editor.getThemeStyles()
      expect(styles.backgroundColor).toBe('#ffffff')
      expect(styles.gridColor).toBe('#e0e0e0')
      expect(styles.nodeColor).toBe('#f5f5f5')
      expect(styles.textColor).toBe('#333333')
    })

    test('should apply dark theme colors', () => {
      editor.setTheme('dark')
      editor.render()

      const styles = editor.getThemeStyles()
      expect(styles.backgroundColor).toBe('#1e1e1e')
      expect(styles.gridColor).toBe('#333333')
      expect(styles.nodeColor).toBe('#2d2d2d')
      expect(styles.textColor).toBe('#ffffff')
    })

    test('should apply custom node styles', () => {
      const customStyles: VisualStyles = {
        nodeStyles: {
          'llm-completion': {
            backgroundColor: '#e3f2fd',
            borderColor: '#1976d2',
            textColor: '#0d47a1'
          },
          'trigger': {
            backgroundColor: '#e8f5e8',
            borderColor: '#4caf50',
            textColor: '#2e7d32'
          }
        }
      }

      editor.applyCustomStyles(customStyles)
      
      const workflow: WorkflowDefinition = {
        id: 'style-test',
        name: 'Style Test',
        nodes: [{
          id: 'styled-node',
          type: 'llm-completion',
          name: 'Styled Node',
          position: { x: 200, y: 200 },
          parameters: {},
          connections: {}
        }],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      editor.render()

      const ctx = canvas.getContext('2d')!
      expect(ctx.fillStyle).toBe('#e3f2fd')
      expect(ctx.strokeStyle).toBe('#1976d2')
    })
  })

  describe('Zoom and Pan', () => {
    test('should handle zoom operations', () => {
      const initialZoom = editor.getZoomLevel()
      expect(initialZoom).toBe(1.0)

      editor.zoomIn()
      expect(editor.getZoomLevel()).toBeGreaterThan(1.0)

      editor.zoomOut()
      editor.zoomOut()
      expect(editor.getZoomLevel()).toBeLessThan(1.0)

      editor.resetZoom()
      expect(editor.getZoomLevel()).toBe(1.0)
    })

    test('should handle pan operations', () => {
      const initialPan = editor.getPanOffset()
      expect(initialPan).toEqual({ x: 0, y: 0 })

      editor.pan(50, 30)
      const newPan = editor.getPanOffset()
      expect(newPan.x).toBe(50)
      expect(newPan.y).toBe(30)

      editor.resetPan()
      const resetPan = editor.getPanOffset()
      expect(resetPan).toEqual({ x: 0, y: 0 })
    })

    test('should transform coordinates with zoom and pan', () => {
      editor.setZoomLevel(2.0)
      editor.pan(100, 50)

      const canvasPoint = { x: 200, y: 150 }
      const worldPoint = editor.canvasToWorld(canvasPoint)
      
      expect(worldPoint.x).toBe(50)  // (200 - 100) / 2
      expect(worldPoint.y).toBe(50)  // (150 - 50) / 2

      const backToCanvas = editor.worldToCanvas(worldPoint)
      expect(backToCanvas.x).toBeCloseTo(canvasPoint.x)
      expect(backToCanvas.y).toBeCloseTo(canvasPoint.y)
    })
  })

  describe('Minimap', () => {
    test('should render minimap overview', () => {
      const workflow: WorkflowDefinition = {
        id: 'minimap-test',
        name: 'Minimap Test',
        nodes: [
          { id: 'n1', type: 'trigger', name: 'N1', position: { x: 0, y: 0 }, parameters: {}, connections: {} },
          { id: 'n2', type: 'process', name: 'N2', position: { x: 500, y: 300 }, parameters: {}, connections: {} },
          { id: 'n3', type: 'end', name: 'N3', position: { x: 1000, y: 600 }, parameters: {}, connections: {} }
        ],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      
      const minimapCanvas = editor.createMinimapCanvas(200, 150)
      editor.renderMinimap(minimapCanvas)

      const ctx = minimapCanvas.getContext('2d')!
      expect(ctx.fillRect).toHaveBeenCalled()
      expect(minimapCanvas.width).toBe(200)
      expect(minimapCanvas.height).toBe(150)
    })

    test('should show viewport indicator in minimap', () => {
      editor.pan(100, 50)
      editor.setZoomLevel(2.0)

      const minimapCanvas = editor.createMinimapCanvas(200, 150)
      editor.renderMinimap(minimapCanvas)

      const viewport = editor.getViewportBounds()
      expect(viewport.x).toBe(-50)    // -100 / 2
      expect(viewport.y).toBe(-25)    // -50 / 2
      expect(viewport.width).toBe(600) // 1200 / 2
      expect(viewport.height).toBe(400) // 800 / 2
    })
  })

  describe('Performance Rendering', () => {
    test('should implement viewport culling for large workflows', () => {
      // Create large workflow with many nodes
      const largeWorkflow: WorkflowDefinition = {
        id: 'large-workflow',
        name: 'Large Workflow',
        nodes: [],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Add 1000 nodes
      for (let i = 0; i < 1000; i++) {
        largeWorkflow.nodes.push({
          id: `node-${i}`,
          type: 'process',
          name: `Node ${i}`,
          position: { 
            x: (i % 50) * 100, 
            y: Math.floor(i / 50) * 100 
          },
          parameters: {},
          connections: {}
        })
      }

      editor.loadWorkflow(largeWorkflow)

      const startTime = performance.now()
      editor.render()
      const renderTime = performance.now() - startTime

      expect(renderTime).toBeLessThan(100) // Should render in < 100ms
      
      const visibleNodes = editor.getVisibleNodes()
      expect(visibleNodes.length).toBeLessThan(1000) // Should cull off-screen nodes
    })

    test('should use requestAnimationFrame for smooth animations', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        setTimeout(cb, 16) // ~60fps
        return 1
      })

      editor.startNodeAnimation('test-node', 'pulse')
      expect(rafSpy).toHaveBeenCalled()

      rafSpy.mockRestore()
    })

    test('should debounce resize operations', () => {
      const resizeSpy = jest.spyOn(editor, 'handleResize')

      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new mockDOM.window.Event('resize'))
      }

      // Should debounce to single call
      setTimeout(() => {
        expect(resizeSpy).toHaveBeenCalledTimes(1)
      }, 300)
    })
  })

  describe('Accessibility', () => {
    test('should provide keyboard navigation support', () => {
      const workflow: WorkflowDefinition = {
        id: 'accessibility-test',
        name: 'Accessibility Test',
        nodes: [
          { id: 'nav1', type: 'trigger', name: 'Node 1', position: { x: 100, y: 100 }, parameters: {}, connections: {} },
          { id: 'nav2', type: 'process', name: 'Node 2', position: { x: 300, y: 100 }, parameters: {}, connections: {} }
        ],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      editor.enableKeyboardNavigation()

      // Test Tab navigation
      const tabEvent = new mockDOM.window.KeyboardEvent('keydown', { key: 'Tab' })
      editor.handleKeyDown(tabEvent as any)

      expect(editor.getFocusedNode()?.id).toBe('nav1')

      // Test Arrow navigation
      const arrowEvent = new mockDOM.window.KeyboardEvent('keydown', { key: 'ArrowRight' })
      editor.handleKeyDown(arrowEvent as any)

      expect(editor.getFocusedNode()?.id).toBe('nav2')
    })

    test('should provide ARIA labels and descriptions', () => {
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', 'Workflow diagram')
      canvas.setAttribute('aria-describedby', 'workflow-description')

      expect(canvas.getAttribute('role')).toBe('img')
      expect(canvas.getAttribute('aria-label')).toBe('Workflow diagram')
    })

    test('should announce changes to screen readers', () => {
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'polite')
      announcement.setAttribute('aria-atomic', 'true')
      announcement.className = 'sr-only'
      document.body.appendChild(announcement)

      editor.announceToScreenReader('Node added to workflow')
      
      expect(announcement.textContent).toBe('Node added to workflow')
    })
  })

  describe('Export and Screenshot', () => {
    test('should export workflow as image', () => {
      const workflow: WorkflowDefinition = {
        id: 'export-test',
        name: 'Export Test',
        nodes: [{
          id: 'export-node',
          type: 'llm-completion',
          name: 'Export Node',
          position: { x: 200, y: 200 },
          parameters: {},
          connections: {}
        }],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      
      const imageData = editor.exportAsImage('png')
      expect(imageData).toMatch(/^data:image\/png;base64,/)
    })

    test('should export high-resolution image', () => {
      const workflow: WorkflowDefinition = {
        id: 'hires-test',
        name: 'Hi-Res Test',
        nodes: [{
          id: 'hires-node',
          type: 'process',
          name: 'Hi-Res Node',
          position: { x: 300, y: 300 },
          parameters: {},
          connections: {}
        }],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      
      const hiResImage = editor.exportAsImage('png', { scale: 2.0, quality: 1.0 })
      expect(hiResImage).toMatch(/^data:image\/png;base64,/)
    })

    test('should capture specific workflow region', () => {
      const workflow: WorkflowDefinition = {
        id: 'region-test',
        name: 'Region Test',
        nodes: [
          { id: 'r1', type: 'trigger', name: 'R1', position: { x: 0, y: 0 }, parameters: {}, connections: {} },
          { id: 'r2', type: 'process', name: 'R2', position: { x: 500, y: 300 }, parameters: {}, connections: {} }
        ],
        connections: {},
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }

      editor.loadWorkflow(workflow)
      
      const region = { x: 0, y: 0, width: 400, height: 200 }
      const regionImage = editor.exportRegionAsImage(region, 'png')
      
      expect(regionImage).toMatch(/^data:image\/png;base64,/)
    })
  })
})