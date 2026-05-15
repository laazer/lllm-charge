/**
 * Mock WebSocket implementation for testing React WebSocket integration
 */

export class MockWebSocketServer {
  private messageHandlers: ((data: any) => void)[] = []

  private getLatestInstance(): MockWebSocketInstance | null {
    const instances = MockWebSocket.instances
    return instances.length > 0 ? instances[instances.length - 1] : null
  }

  simulateConnection() {
    const instance = this.getLatestInstance()
    if (instance) {
      instance.readyState = MockWebSocket.OPEN
      instance.onopen?.(new Event('open'))
    }
  }

  simulateDisconnection(code = 1000, reason = 'Normal closure') {
    const instance = this.getLatestInstance()
    if (instance) {
      instance.readyState = MockWebSocket.CLOSED
      const closeEvent = new CloseEvent('close', { code, reason, wasClean: true })
      instance.onclose?.(closeEvent)
    }
  }

  simulateError(error: Error) {
    const instance = this.getLatestInstance()
    if (instance) {
      instance.readyState = MockWebSocket.CLOSED
      const errorEvent = new Event('error') as any
      errorEvent.error = error
      instance.onerror?.(errorEvent)
    }
  }

  simulateMessage(message: { type: string; data: any }) {
    this.simulateRawMessage(JSON.stringify(message))
  }

  simulateRawMessage(data: string) {
    const instance = this.getLatestInstance()
    if (instance) {
      const messageEvent = new MessageEvent('message', { data })
      instance.onmessage?.(messageEvent)
    }
  }

  getLastSentMessage(): string | null {
    return this.getLatestInstance()?.lastSentMessage ?? null
  }

  cleanup() {
    this.messageHandlers = []
  }

  setMockInstance(_instance: MockWebSocketInstance) {
    // No-op: we use MockWebSocket.instances directly
  }
}

export interface MockWebSocketInstance {
  url: string
  readyState: number
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  lastSentMessage: string | null
  send(data: string): void
  close: jest.Mock
}

function createMockWebSocketInstance(url: string): MockWebSocketInstance {
  const instance: MockWebSocketInstance = {
    url,
    readyState: MockWebSocket.CONNECTING,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    lastSentMessage: null,
    send(data: string) {
      if (instance.readyState === MockWebSocket.OPEN) {
        instance.lastSentMessage = data
      } else {
        throw new Error('WebSocket is not open')
      }
    },
    close: jest.fn(function(code = 1000, reason = '') {
      if (
        instance.readyState === MockWebSocket.OPEN ||
        instance.readyState === MockWebSocket.CONNECTING
      ) {
        instance.readyState = MockWebSocket.CLOSING
        setTimeout(() => {
          instance.readyState = MockWebSocket.CLOSED
          const closeEvent = new CloseEvent('close', { code, reason, wasClean: true })
          instance.onclose?.(closeEvent)
        }, 0)
      }
    }),
  }

  // Simulate async invalid-url error
  setTimeout(() => {
    if (instance.readyState === MockWebSocket.CONNECTING && url.includes('invalid')) {
      instance.readyState = MockWebSocket.CLOSED
      instance.onerror?.(new Event('error'))
    }
  }, 0)

  return instance
}

// MockWebSocket is a jest.fn() that tracks construction AND has static properties
const MockWebSocketFn = jest.fn((url: string) => {
  const instance = createMockWebSocketInstance(url)
  MockWebSocket.instances.push(instance)
  return instance
})

export const MockWebSocket = Object.assign(MockWebSocketFn, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,

  instances: [] as MockWebSocketInstance[],
  mockServer: null as MockWebSocketServer | null,

  getInstance(): MockWebSocketInstance {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  },

  resetMocks() {
    MockWebSocket.instances = []
    MockWebSocket.mockServer = null
    MockWebSocketFn.mockClear()
  },

  setMockServer(server: MockWebSocketServer) {
    MockWebSocket.mockServer = server
  },
})

// Create a Jest mock function for WebSocket constructor tracking
export const WebSocketConstructorMock = MockWebSocket

// Replace the global WebSocket name
Object.defineProperty(MockWebSocket, 'name', { value: 'WebSocket' })
