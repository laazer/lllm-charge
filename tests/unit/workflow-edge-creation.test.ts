/**
 * Tests for workflow editor edge/connection creation logic.
 *
 * Tests the core edge creation state machine used by the drag-to-connect
 * interaction: mousedown on output -> drag -> mouseup on input.
 */

import { jest } from '@jest/globals'

interface NodeData {
  id: string
  type: string
  element: any
  position: { x: number; y: number }
  config: any
  properties: Record<string, any>
}

interface Connection {
  from: NodeData
  to: NodeData
  fromType: string
  toType: string
}

interface ConnectionStart {
  node: NodeData
  type: string
}

/**
 * Mirrors the edge creation state machine from workflow-editor.html.
 * Interaction model: mousedown on output point starts a connection,
 * mouseup on an input point completes it, mouseup elsewhere cancels.
 */
class EdgeCreationStateMachine {
  isConnecting: boolean = false
  connectionStart: ConnectionStart | null = null
  tempConnection: any = null
  connections: Connection[] = []
  svgChildren: any[] = []
  svgInDOM: boolean = true

  startConnection(nodeData: NodeData, type: string): void {
    this.isConnecting = true
    this.connectionStart = { node: nodeData, type }
    this.tempConnection = { class: 'connection-path temporary' }
    if (this.svgInDOM) {
      this.svgChildren.push(this.tempConnection)
    }
  }

  completeConnection(nodeData: NodeData, type: string): void {
    if (!this.isConnecting || !this.connectionStart) return

    if (this.connectionStart.node.id === nodeData.id) {
      this.cancelConnection()
      return
    }

    const existingConnection = this.connections.find(
      (conn) => conn.from.id === this.connectionStart!.node.id && conn.to.id === nodeData.id
    )

    if (existingConnection) {
      this.cancelConnection()
      return
    }

    const connection: Connection = {
      from: this.connectionStart.node,
      to: nodeData,
      fromType: this.connectionStart.type,
      toType: type
    }

    this.connections.push(connection)

    if (this.tempConnection) {
      const index = this.svgChildren.indexOf(this.tempConnection)
      if (index > -1) this.svgChildren.splice(index, 1)
      this.tempConnection = null
    }

    this.isConnecting = false
    this.connectionStart = null
  }

  cancelConnection(): void {
    this.isConnecting = false
    this.connectionStart = null

    if (this.tempConnection) {
      const index = this.svgChildren.indexOf(this.tempConnection)
      if (index > -1) this.svgChildren.splice(index, 1)
      this.tempConnection = null
    }
  }

  /** Simulates mousedown on an output connection point. */
  simulateOutputMousedown(nodeData: NodeData): void {
    this.startConnection(nodeData, 'output')
  }

  /** Simulates mouseup on an input connection point (completes connection). */
  simulateInputMouseup(nodeData: NodeData): void {
    if (this.isConnecting) {
      this.completeConnection(nodeData, 'input')
    }
  }

  /** Simulates mouseup on empty space (cancels connection). */
  simulateDocumentMouseup(): void {
    if (this.isConnecting) {
      this.cancelConnection()
    }
  }

  /** Simulates canvas.innerHTML = '' destroying the SVG, then re-adding it. */
  simulateResetCanvas(): void {
    this.svgInDOM = false
    this.svgChildren = []
    // Fix: re-add SVG
    this.svgInDOM = true
  }
}

function createMockNode(id: string, type: string, x: number, y: number): NodeData {
  return {
    id,
    type,
    element: { id },
    position: { x, y },
    config: { title: type },
    properties: {}
  }
}

describe('Workflow Editor Edge Creation (drag-to-connect)', () => {
  let machine: EdgeCreationStateMachine

  beforeEach(() => {
    machine = new EdgeCreationStateMachine()
  })

  describe('startConnection (mousedown on output)', () => {
    test('sets isConnecting and stores connection start', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)

      machine.simulateOutputMousedown(nodeA)

      expect(machine.isConnecting).toBe(true)
      expect(machine.connectionStart).not.toBeNull()
      expect(machine.connectionStart!.node.id).toBe('node-1')
      expect(machine.connectionStart!.type).toBe('output')
    })

    test('creates a temporary SVG path', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)

      machine.simulateOutputMousedown(nodeA)

      expect(machine.tempConnection).not.toBeNull()
      expect(machine.svgChildren).toHaveLength(1)
    })
  })

  describe('completeConnection (mouseup on input)', () => {
    test('creates an edge between two different nodes', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 100)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)

      expect(machine.connections).toHaveLength(1)
      expect(machine.connections[0].from.id).toBe('node-1')
      expect(machine.connections[0].to.id).toBe('node-2')
      expect(machine.connections[0].fromType).toBe('output')
      expect(machine.connections[0].toType).toBe('input')
    })

    test('cleans up state after completing', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 100)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)

      expect(machine.isConnecting).toBe(false)
      expect(machine.connectionStart).toBeNull()
      expect(machine.tempConnection).toBeNull()
      expect(machine.svgChildren).toHaveLength(0)
    })

    test('does nothing if not currently connecting', () => {
      const nodeB = createMockNode('node-2', 'agent', 300, 100)

      machine.simulateInputMouseup(nodeB)

      expect(machine.connections).toHaveLength(0)
    })
  })

  describe('cancel (mouseup on empty space)', () => {
    test('cancels in-progress connection', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)

      machine.simulateOutputMousedown(nodeA)
      expect(machine.isConnecting).toBe(true)

      machine.simulateDocumentMouseup()

      expect(machine.isConnecting).toBe(false)
      expect(machine.connectionStart).toBeNull()
      expect(machine.tempConnection).toBeNull()
      expect(machine.connections).toHaveLength(0)
    })
  })

  describe('self-connection prevention', () => {
    test('rejects connection from a node to itself', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeA)

      expect(machine.connections).toHaveLength(0)
      expect(machine.isConnecting).toBe(false)
    })
  })

  describe('duplicate connection prevention', () => {
    test('rejects a second identical connection', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 100)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)
      expect(machine.connections).toHaveLength(1)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)
      expect(machine.connections).toHaveLength(1)
    })

    test('allows reverse direction', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 100)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)

      machine.simulateOutputMousedown(nodeB)
      machine.simulateInputMouseup(nodeA)

      expect(machine.connections).toHaveLength(2)
    })
  })

  describe('multiple edges', () => {
    test('chain A -> B -> C', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 100)
      const nodeC = createMockNode('node-3', 'output', 500, 100)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)

      machine.simulateOutputMousedown(nodeB)
      machine.simulateInputMouseup(nodeC)

      expect(machine.connections).toHaveLength(2)
      expect(machine.connections[0].from.id).toBe('node-1')
      expect(machine.connections[0].to.id).toBe('node-2')
      expect(machine.connections[1].from.id).toBe('node-2')
      expect(machine.connections[1].to.id).toBe('node-3')
    })

    test('fan-out from one source', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 50)
      const nodeC = createMockNode('node-3', 'agent', 300, 150)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeB)

      machine.simulateOutputMousedown(nodeA)
      machine.simulateInputMouseup(nodeC)

      expect(machine.connections).toHaveLength(2)
    })
  })

  describe('node position structure', () => {
    test('uses nested position: {x, y}', () => {
      const node = createMockNode('node-1', 'webhook', 150, 250)

      expect(node.position).toBeDefined()
      expect(node.position.x).toBe(150)
      expect(node.position.y).toBe(250)
      expect((node as any).x).toBeUndefined()
      expect((node as any).y).toBeUndefined()
    })
  })

  describe('SVG overlay after canvas reset', () => {
    test('connections work after resetCanvas', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)
      const nodeB = createMockNode('node-2', 'agent', 300, 100)

      machine.simulateResetCanvas()

      machine.simulateOutputMousedown(nodeA)
      expect(machine.isConnecting).toBe(true)
      expect(machine.svgInDOM).toBe(true)

      machine.simulateInputMouseup(nodeB)
      expect(machine.connections).toHaveLength(1)
    })

    test('SVG removed without re-add breaks temp connection', () => {
      const nodeA = createMockNode('node-1', 'webhook', 100, 100)

      // Simulate the bug: only destroy, don't re-add
      machine.svgInDOM = false
      machine.svgChildren = []

      machine.simulateOutputMousedown(nodeA)

      // Temp connection was created but not added to SVG children (invisible)
      expect(machine.tempConnection).not.toBeNull()
      expect(machine.svgChildren).toHaveLength(0)
    })
  })
})
