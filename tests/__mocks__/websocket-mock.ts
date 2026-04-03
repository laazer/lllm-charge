/**
 * Mock WebSocket implementation for testing React WebSocket integration
 */

export class MockWebSocketServer {
  private mockInstance: MockWebSocket | null = null
  private messageHandlers: ((data: any) => void)[] = []

  simulateConnection() {
    if (this.mockInstance) {
      this.mockInstance.readyState = MockWebSocket.OPEN
      this.mockInstance.onopen?.(new Event('open'))
    }
  }

  simulateDisconnection(code = 1000, reason = 'Normal closure') {
    if (this.mockInstance) {
      this.mockInstance.readyState = MockWebSocket.CLOSED
      const closeEvent = new CloseEvent('close', { code, reason, wasClean: true })
      this.mockInstance.onclose?.(closeEvent)
    }
  }

  simulateError(error: Error) {
    if (this.mockInstance) {
      this.mockInstance.readyState = MockWebSocket.CLOSED
      const errorEvent = new Event('error') as any
      errorEvent.error = error
      this.mockInstance.onerror?.(errorEvent)
    }
  }

  simulateMessage(message: { type: string; data: any }) {
    this.simulateRawMessage(JSON.stringify(message))
  }

  simulateRawMessage(data: string) {
    if (this.mockInstance) {
      const messageEvent = new MessageEvent('message', { data })
      this.mockInstance.onmessage?.(messageEvent)
    }
  }

  getLastSentMessage(): string | null {
    return this.mockInstance?.lastSentMessage || null
  }

  cleanup() {
    this.mockInstance = null
    this.messageHandlers = []
  }

  setMockInstance(instance: MockWebSocket) {
    this.mockInstance = instance
  }
}

export class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: MockWebSocket[] = []
  static mockServer: MockWebSocketServer | null = null

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  lastSentMessage: string | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    
    // Set up with mock server if available
    if (MockWebSocket.mockServer) {
      MockWebSocket.mockServer.setMockInstance(this)
    }

    // Simulate async connection attempt
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        if (url.includes('invalid')) {
          this.readyState = MockWebSocket.CLOSED
          this.onerror?.(new Event('error'))
        } else {
          // Don't auto-connect - let tests control this
        }
      }
    }, 0)
  }

  send(data: string) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.lastSentMessage = data
    } else {
      throw new Error('WebSocket is not open')
    }
  }

  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.OPEN || this.readyState === MockWebSocket.CONNECTING) {
      this.readyState = MockWebSocket.CLOSING
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED
        const closeEvent = new CloseEvent('close', { code, reason, wasClean: true })
        this.onclose?.(closeEvent)
      }, 0)
    }
  }

  static getInstance(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }

  static resetMocks() {
    MockWebSocket.instances = []
    MockWebSocket.mockServer = null
  }

  static setMockServer(server: MockWebSocketServer) {
    MockWebSocket.mockServer = server
  }
}

// Create a Jest mock function for WebSocket constructor tracking
export const WebSocketConstructorMock = jest.fn().mockImplementation((url: string) => {
  return new MockWebSocket(url)
})

// Replace the global WebSocket with our mock
Object.defineProperty(MockWebSocket, 'name', { value: 'WebSocket' })