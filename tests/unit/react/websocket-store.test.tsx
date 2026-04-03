import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { WebSocketProvider, useWebSocket } from '../../../src/react/store/websocket-store'
import { MockWebSocket, MockWebSocketServer } from '../../__mocks__/websocket-mock'

// Mock WebSocket globally
global.WebSocket = MockWebSocket as any

describe('WebSocket Store', () => {
  let mockWsServer: MockWebSocketServer
  
  beforeEach(() => {
    mockWsServer = new MockWebSocketServer()
    MockWebSocket.resetMocks()
  })

  afterEach(() => {
    mockWsServer.cleanup()
    MockWebSocket.resetMocks()
  })

  describe('WebSocketProvider', () => {
    it('should establish WebSocket connection on mount', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      expect(result.current.connectionStatus).toBe('connecting')
      
      // Simulate connection opening
      act(() => {
        mockWsServer.simulateConnection()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
        expect(result.current.connectionStatus).toBe('connected')
      })
    })

    it('should handle connection errors gracefully', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://invalid-url:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      // Simulate connection error
      act(() => {
        mockWsServer.simulateError(new Error('Connection failed'))
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error')
        expect(result.current.isConnected).toBe(false)
      })
    })

    it('should handle incoming metrics messages', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      // Simulate connection and metrics message
      act(() => {
        mockWsServer.simulateConnection()
        mockWsServer.simulateMessage({
          type: 'metrics',
          data: {
            totalRequests: 100,
            successRate: 0.95,
            avgResponseTime: 250,
            specsCount: 25,
            agentsCount: 10
          }
        })
      })

      await waitFor(() => {
        expect(result.current.metrics).toEqual({
          totalRequests: 100,
          successRate: 0.95,
          avgResponseTime: 250,
          specsCount: 25,
          agentsCount: 10
        })
      })
    })

    it('should handle metrics_update messages (backward compatibility)', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      // Test both message types
      act(() => {
        mockWsServer.simulateConnection()
        mockWsServer.simulateMessage({
          type: 'metrics_update',
          data: { totalRequests: 200 }
        })
      })

      await waitFor(() => {
        expect(result.current.metrics).toEqual({ totalRequests: 200 })
      })
    })

    it('should attempt reconnection with exponential backoff', async () => {
      jest.useFakeTimers()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001" reconnectInterval={1000} maxReconnectAttempts={3}>
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      // Simulate connection then disconnection
      act(() => {
        mockWsServer.simulateConnection()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWsServer.simulateDisconnection(1006, 'Connection lost')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false)
        expect(result.current.connectionStatus).toBe('disconnected')
      })

      // Fast-forward time to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(MockWebSocket).toHaveBeenCalledTimes(2) // Initial + 1 reconnection attempt

      jest.useRealTimers()
    })

    it('should send messages when connected', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      act(() => {
        mockWsServer.simulateConnection()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      const testMessage = { type: 'ping', data: 'test' }
      
      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(mockWsServer.getLastSentMessage()).toEqual(JSON.stringify(testMessage))
    })

    it('should not send messages when disconnected', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      // Try to send message while disconnected
      const testMessage = { type: 'ping', data: 'test' }
      
      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'WebSocket is not connected. Cannot send message.'
      )

      consoleWarnSpy.mockRestore()
    })

    it('should handle manual reconnection', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      // Initial connection
      act(() => {
        mockWsServer.simulateConnection()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Disconnect
      act(() => {
        mockWsServer.simulateDisconnection()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false)
      })

      // Manual reconnection
      act(() => {
        result.current.reconnect()
      })

      // Should create new connection
      expect(MockWebSocket).toHaveBeenCalledTimes(2)
    })

    it('should cleanup connections on unmount', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { unmount } = renderHook(() => useWebSocket(), { wrapper })

      act(() => {
        mockWsServer.simulateConnection()
      })

      const mockInstance = MockWebSocket.getInstance()
      expect(mockInstance).toBeDefined()

      unmount()

      expect(mockInstance.close).toHaveBeenCalled()
    })
  })

  describe('useWebSocket hook', () => {
    it('should throw error when used outside of provider', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        renderHook(() => useWebSocket())
      }).toThrow('useWebSocket must be used within a WebSocketProvider')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Error handling', () => {
    it('should handle malformed JSON messages', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      const { result } = renderHook(() => useWebSocket(), { wrapper })

      act(() => {
        mockWsServer.simulateConnection()
        mockWsServer.simulateRawMessage('invalid json')
      })

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to parse WebSocket message:',
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle unknown message types', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      renderHook(() => useWebSocket(), { wrapper })

      act(() => {
        mockWsServer.simulateConnection()
        mockWsServer.simulateMessage({
          type: 'unknown_type',
          data: { test: 'data' }
        })
      })

      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Unknown WebSocket message type:',
          'unknown_type'
        )
      })

      consoleLogSpy.mockRestore()
    })

    it('should handle error messages from server', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider wsUrl="ws://localhost:3001">
          {children}
        </WebSocketProvider>
      )

      renderHook(() => useWebSocket(), { wrapper })

      act(() => {
        mockWsServer.simulateConnection()
        mockWsServer.simulateMessage({
          type: 'error',
          data: 'Server error occurred'
        })
      })

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'WebSocket error message:',
          'Server error occurred'
        )
      })

      consoleErrorSpy.mockRestore()
    })
  })
})