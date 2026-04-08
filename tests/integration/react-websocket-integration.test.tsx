import { LLMChargeServer } from '../../src/server/llm-charge-server'
import WebSocket from 'ws'
import { render, waitFor, screen } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../../src/react/pages/Dashboard'
import { WebSocketProvider } from '../../src/react/store/websocket-store'
import { ProjectProvider } from '../../src/react/store/project-store'
import { apiClient } from '../../src/react/lib/api-client'

// Mock the API client for predictable test data
jest.mock('../../src/react/lib/api-client', () => ({
  apiClient: {
    getProjects: jest.fn().mockResolvedValue([
      { id: '1', name: 'Test Project', description: 'Integration test project' }
    ]),
    getAgents: jest.fn().mockResolvedValue([
      { id: '1', name: 'Test Agent', description: 'Integration test agent', primaryRole: 'tester' }
    ]),
    getSpecs: jest.fn().mockResolvedValue([
      { id: '1', title: 'Test Spec', description: 'Integration test spec', status: 'active' }
    ]),
  },
}))

describe('React WebSocket Integration', () => {
  let server: LLMChargeServer
  let serverPort: number

  beforeAll(async () => {
    // Start test server on random port
    serverPort = 3050 + Math.floor(Math.random() * 100)
    server = new LLMChargeServer(serverPort)
    
    await new Promise<void>((resolve) => {
      const httpServer = (server as any).server
      httpServer.listen(serverPort, () => {
        console.log(`Test server started on port ${serverPort}`)
        resolve()
      })
    })

    // Give server time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    if (server) {
      const httpServer = (server as any).server
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log(`Test server stopped on port ${serverPort}`)
          resolve()
        })
      })
    }
  })

  it('should establish WebSocket connection and receive real metrics', (done) => {
    const wsUrl = `ws://localhost:${serverPort}`
    const ws = new WebSocket(wsUrl)

    ws.on('open', () => {
      console.log('WebSocket connection opened for integration test')
    })

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        
        expect(message).toHaveProperty('type')
        expect(message.type).toMatch(/^(metrics|metrics_update)$/)
        expect(message).toHaveProperty('data')
        
        const metrics = message.data
        expect(metrics).toHaveProperty('totalRequests')
        expect(metrics).toHaveProperty('successRate')
        expect(metrics).toHaveProperty('specsCount')
        expect(metrics).toHaveProperty('agentsCount')
        expect(metrics).toHaveProperty('projectsCount')

        // Verify data types
        expect(typeof metrics.specsCount).toBe('number')
        expect(typeof metrics.agentsCount).toBe('number')
        expect(typeof metrics.projectsCount).toBe('number')

        console.log('Received metrics:', metrics)
        ws.close()
        done()
      } catch (error) {
        done(error)
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error in integration test:', error)
      done(error)
    })

    ws.on('close', () => {
      console.log('WebSocket connection closed for integration test')
    })

    // Set timeout to prevent hanging
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
        done(new Error('Test timeout - no message received within 10 seconds'))
      }
    }, 10000)
  }, 15000)

  it('should handle multiple simultaneous connections', async () => {
    const connectionPromises = Array.from({ length: 5 }, (_, index) => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${serverPort}`)
        
        ws.on('open', () => {
          console.log(`Connection ${index + 1} opened`)
        })

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString())
            expect(message.type).toMatch(/^(metrics|metrics_update)$/)
            expect(message.data).toBeDefined()
            
            ws.close()
            resolve()
          } catch (error) {
            reject(error)
          }
        })

        ws.on('error', reject)

        // Timeout for individual connection
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close()
            reject(new Error(`Connection ${index + 1} timeout`))
          }
        }, 8000)
      })
    })

    await Promise.all(connectionPromises)
  }, 20000)

  it('should handle connection lifecycle properly', async () => {
    const wsUrl = `ws://localhost:${serverPort}`
    const ws = new WebSocket(wsUrl)

    // Test connection opening
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve)
      ws.on('error', reject)
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    })

    expect(ws.readyState).toBe(WebSocket.OPEN)

    // Test message receiving
    const messageReceived = new Promise<any>((resolve, reject) => {
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          resolve(message)
        } catch (error) {
          reject(error)
        }
      })
      setTimeout(() => reject(new Error('Message timeout')), 5000)
    })

    const message = await messageReceived
    expect(message.type).toMatch(/^(metrics|metrics_update)$/)

    // Test connection closing
    const closedPromise = new Promise<void>((resolve) => {
      ws.on('close', (code, reason) => {
        console.log(`Connection closed with code ${code}: ${reason}`)
        resolve()
      })
    })

    ws.close(1000, 'Test complete')
    await closedPromise

    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  it('should provide metrics that match expected schema', (done) => {
    const ws = new WebSocket(`ws://localhost:${serverPort}`)

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        const metrics = message.data

        // Verify required fields exist
        const requiredFields = [
          'totalRequests',
          'costSavings', 
          'successRate',
          'avgLatency',
          'specsCount',
          'projectsCount',
          'agentsCount',
          'checkpointsCount',
          'notesCount',
          'workflowsCount',
          'uptime',
          'memoryUsage'
        ]

        requiredFields.forEach(field => {
          expect(metrics).toHaveProperty(field)
        })

        // Verify data types and ranges
        expect(typeof metrics.totalRequests).toBe('string')
        expect(typeof metrics.specsCount).toBe('number')
        expect(typeof metrics.agentsCount).toBe('number')
        expect(typeof metrics.projectsCount).toBe('number')
        expect(typeof metrics.uptime).toBe('number')
        expect(typeof metrics.memoryUsage).toBe('number')

        // Verify reasonable ranges
        expect(metrics.specsCount).toBeGreaterThanOrEqual(0)
        expect(metrics.agentsCount).toBeGreaterThanOrEqual(0)
        expect(metrics.projectsCount).toBeGreaterThanOrEqual(0)
        expect(metrics.uptime).toBeGreaterThanOrEqual(0)
        expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0)

        ws.close()
        done()
      } catch (error) {
        ws.close()
        done(error)
      }
    })

    ws.on('error', done)

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
        done(new Error('Schema validation timeout'))
      }
    }, 8000)
  }, 10000)

  // This test would require jsdom setup, so marking as conditional
  if (typeof document !== 'undefined') {
    it('should integrate with React Dashboard component', async () => {
      const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
          },
        })

        return (
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <ProjectProvider>
                <WebSocketProvider wsUrl={`ws://localhost:${serverPort}`}>
                  {children}
                </WebSocketProvider>
              </ProjectProvider>
            </BrowserRouter>
          </QueryClientProvider>
        )
      }

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Wait for WebSocket connection and metrics
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Wait for real-time metrics to appear
      await waitFor(() => {
        expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
      }, { timeout: 8000 })

      // Verify metrics are displayed
      expect(screen.getByText('Total Requests')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Response Time')).toBeInTheDocument()
    }, 25000)
  }
})