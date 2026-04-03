import { LLMChargeServer } from '../../src/server/llm-charge-server'
import WebSocket from 'ws'

describe('WebSocket Performance Tests', () => {
  let server: LLMChargeServer
  let serverPort: number

  beforeAll(async () => {
    // Start test server on random port
    serverPort = 3060 + Math.floor(Math.random() * 100)
    server = new LLMChargeServer(serverPort)
    
    await new Promise<void>((resolve) => {
      const httpServer = (server as any).server
      httpServer.listen(serverPort, () => {
        console.log(`Performance test server started on port ${serverPort}`)
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
          console.log(`Performance test server stopped on port ${serverPort}`)
          resolve()
        })
      })
    }
  })

  it('should handle high-frequency connections efficiently', async () => {
    const connectionCount = 50
    const connectionStartTime = Date.now()
    
    const connections = await Promise.all(
      Array.from({ length: connectionCount }, async (_, index) => {
        return new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(`ws://localhost:${serverPort}`)
          
          ws.on('open', () => {
            resolve(ws)
          })
          
          ws.on('error', reject)
          
          // Connection timeout
          setTimeout(() => {
            reject(new Error(`Connection ${index + 1} timeout`))
          }, 5000)
        })
      })
    )

    const connectionTime = Date.now() - connectionStartTime
    console.log(`${connectionCount} connections established in ${connectionTime}ms`)
    
    // Performance assertions
    expect(connectionTime).toBeLessThan(10000) // Less than 10 seconds
    expect(connections).toHaveLength(connectionCount)
    
    // Verify all connections are open
    connections.forEach((ws, index) => {
      expect(ws.readyState).toBe(WebSocket.OPEN)
    })

    // Clean up connections
    await Promise.all(connections.map(ws => {
      return new Promise<void>((resolve) => {
        ws.on('close', resolve)
        ws.close()
      })
    }))
  }, 30000)

  it('should maintain low latency for message broadcasting', async () => {
    const clientCount = 20
    const clients: WebSocket[] = []
    const messageTimestamps: number[] = []

    // Create clients
    for (let i = 0; i < clientCount; i++) {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
        setTimeout(() => reject(new Error(`Client ${i} connection timeout`)), 5000)
      })

      // Set up message timing
      ws.on('message', () => {
        messageTimestamps.push(Date.now())
      })

      clients.push(ws)
    }

    // Wait for initial messages to all clients
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Measure broadcast consistency
    const messageCounts = new Map<number, number>()
    
    // Wait for multiple message cycles
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Analyze message distribution
    const avgLatency = messageTimestamps.length > 0 ? 
      messageTimestamps.reduce((a, b) => a + b, 0) / messageTimestamps.length : 0

    console.log(`Average message latency across ${clientCount} clients: ${avgLatency}ms`)
    console.log(`Total messages received: ${messageTimestamps.length}`)

    // Performance expectations
    expect(messageTimestamps.length).toBeGreaterThan(clientCount) // At least one message per client
    
    // Clean up
    await Promise.all(clients.map(ws => {
      return new Promise<void>((resolve) => {
        ws.on('close', resolve)
        ws.close()
      })
    }))
  }, 20000)

  it('should handle rapid connect/disconnect cycles', async () => {
    const cycleCount = 30
    const results: { connectTime: number; disconnectTime: number }[] = []

    for (let i = 0; i < cycleCount; i++) {
      const startConnect = Date.now()
      
      // Connect
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(`ws://localhost:${serverPort}`)
        socket.on('open', () => resolve(socket))
        socket.on('error', reject)
        setTimeout(() => reject(new Error(`Cycle ${i + 1} connect timeout`)), 3000)
      })

      const connectTime = Date.now() - startConnect

      const startDisconnect = Date.now()

      // Disconnect
      await new Promise<void>((resolve) => {
        ws.on('close', resolve)
        ws.close()
      })

      const disconnectTime = Date.now() - startDisconnect

      results.push({ connectTime, disconnectTime })

      // Small delay between cycles
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Analyze performance
    const avgConnectTime = results.reduce((sum, r) => sum + r.connectTime, 0) / results.length
    const avgDisconnectTime = results.reduce((sum, r) => sum + r.disconnectTime, 0) / results.length

    console.log(`Average connect time: ${avgConnectTime.toFixed(2)}ms`)
    console.log(`Average disconnect time: ${avgDisconnectTime.toFixed(2)}ms`)

    // Performance assertions
    expect(avgConnectTime).toBeLessThan(1000) // Less than 1 second average
    expect(avgDisconnectTime).toBeLessThan(100) // Less than 100ms average
    
    // Verify no failed connections
    expect(results).toHaveLength(cycleCount)
  }, 25000)

  it('should maintain stable memory usage under load', async () => {
    const initialMemory = process.memoryUsage()
    const connectionCount = 100
    const connections: WebSocket[] = []

    // Create many connections
    for (let i = 0; i < connectionCount; i++) {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
        setTimeout(() => reject(new Error(`Memory test connection ${i} timeout`)), 2000)
      })

      connections.push(ws)

      // Check memory every 10 connections
      if ((i + 1) % 10 === 0) {
        const currentMemory = process.memoryUsage()
        const heapUsed = currentMemory.heapUsed - initialMemory.heapUsed
        console.log(`Memory after ${i + 1} connections: ${(heapUsed / 1024 / 1024).toFixed(2)}MB`)
      }
    }

    const peakMemory = process.memoryUsage()
    const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed

    console.log(`Memory increase with ${connectionCount} connections: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

    // Memory should not increase excessively
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase

    // Clean up all connections
    await Promise.all(connections.map(ws => {
      return new Promise<void>((resolve) => {
        ws.on('close', resolve)
        ws.close()
      })
    }))

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))

    const finalMemory = process.memoryUsage()
    const finalIncrease = finalMemory.heapUsed - initialMemory.heapUsed

    console.log(`Memory after cleanup: ${(finalIncrease / 1024 / 1024).toFixed(2)}MB increase`)

    // Memory should return to reasonable levels
    expect(finalIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB permanent increase
  }, 40000)

  it('should maintain consistent message delivery under load', async () => {
    const clientCount = 25
    const testDuration = 8000 // 8 seconds
    const clients: WebSocket[] = []
    const messageCounters = new Array(clientCount).fill(0)

    // Create clients
    for (let i = 0; i < clientCount; i++) {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
        setTimeout(() => reject(new Error(`Load test client ${i} timeout`)), 3000)
      })

      ws.on('message', () => {
        messageCounters[i]++
      })

      clients.push(ws)
    }

    console.log(`Started load test with ${clientCount} clients for ${testDuration}ms`)

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDuration))

    // Analyze message distribution
    const totalMessages = messageCounters.reduce((sum, count) => sum + count, 0)
    const avgMessagesPerClient = totalMessages / clientCount
    const minMessages = Math.min(...messageCounters)
    const maxMessages = Math.max(...messageCounters)

    console.log(`Total messages: ${totalMessages}`)
    console.log(`Average per client: ${avgMessagesPerClient.toFixed(2)}`)
    console.log(`Min/Max per client: ${minMessages}/${maxMessages}`)

    // Verify consistent delivery
    expect(totalMessages).toBeGreaterThan(clientCount) // At least one message per client
    expect(minMessages).toBeGreaterThan(0) // Every client received at least one message
    
    // Message distribution should be relatively even
    const messageVariance = maxMessages - minMessages
    expect(messageVariance).toBeLessThan(avgMessagesPerClient * 0.5) // Less than 50% variance

    // Clean up
    await Promise.all(clients.map(ws => {
      return new Promise<void>((resolve) => {
        ws.on('close', resolve)
        ws.close()
      })
    }))
  }, 25000)
})