/**
 * WebSocket Real-time Integration Test
 * Verifies that WebSocket connection works and streams real metrics data
 */

describe('WebSocket Real-time Integration Test', () => {
  const WS_URL = 'ws://localhost:3001'
  let backendAvailable = false

  beforeAll(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/projects')
      backendAvailable = response.ok
    } catch (error) {
      console.warn('Backend not available for WebSocket tests, skipping...')
      backendAvailable = false
    }
  })

  const skipIfBackendUnavailable = () => {
    if (!backendAvailable) {
      pending('Backend not available')
    }
  }

  test('should receive real-time metrics via WebSocket', async () => {
    skipIfBackendUnavailable()

    let metricsReceived = false
    let receivedMetrics: any = null

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL)
      
      const timeout = setTimeout(() => {
        ws.close()
        if (!metricsReceived) {
          reject(new Error('No metrics received via WebSocket within timeout'))
        }
      }, 10000)

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'metrics' || message.type === 'metrics_update') {
            receivedMetrics = message.data
            metricsReceived = true

            // Verify the real metrics structure matches what our tests found
            expect(receivedMetrics.specsCount).toBe(49)
            expect(receivedMetrics.agentsCount).toBe(13)
            expect(receivedMetrics.projectsCount).toBe(2)
            expect(receivedMetrics.workflowsCount).toBe(3)
            
            // Verify it has real-time metrics fields
            expect(receivedMetrics).toHaveProperty('totalRequests')
            expect(receivedMetrics).toHaveProperty('successRate')
            expect(receivedMetrics).toHaveProperty('avgLatency')
            expect(receivedMetrics).toHaveProperty('costSavings')

            console.log(`✅ Real-time WebSocket metrics received:`)
            console.log(`   - ${receivedMetrics.specsCount} specifications`)
            console.log(`   - ${receivedMetrics.agentsCount} agents (independent)`)
            console.log(`   - ${receivedMetrics.projectsCount} projects`)
            console.log(`   - ${receivedMetrics.workflowsCount} workflows (independent)`)
            console.log(`   - ${receivedMetrics.totalRequests} total requests`)
            console.log(`   - ${receivedMetrics.successRate}% success rate`)

            clearTimeout(timeout)
            ws.close()
            resolve()
          } else {
            console.log(`📩 Received WebSocket message type: ${message.type}`)
          }
        } catch (error) {
          clearTimeout(timeout)
          ws.close()
          reject(new Error(`WebSocket message parsing error: ${error}`))
        }
      }

      ws.onerror = (error) => {
        clearTimeout(timeout)
        reject(new Error(`WebSocket connection error: ${error}`))
      }

      ws.onclose = (event) => {
        if (!metricsReceived) {
          console.log(`WebSocket closed: ${event.code} - ${event.reason}`)
        }
      }
    })
  }, 15000)

  test('should verify WebSocket data matches API data', async () => {
    skipIfBackendUnavailable()

    // Get data via regular API
    const metricsResponse = await fetch('http://localhost:3001/api/metrics')
    const apiMetrics = await metricsResponse.json()

    let wsMetrics: any = null

    // Get data via WebSocket
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL)
      
      const timeout = setTimeout(() => {
        ws.close()
        if (!wsMetrics) {
          reject(new Error('No WebSocket metrics received for comparison'))
        }
      }, 8000)

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'metrics' || message.type === 'metrics_update') {
            wsMetrics = message.data

            // Compare API vs WebSocket data - should match
            expect(wsMetrics.specsCount).toBe(apiMetrics.specsCount)
            expect(wsMetrics.agentsCount).toBe(apiMetrics.agentsCount)
            expect(wsMetrics.projectsCount).toBe(apiMetrics.projectsCount)
            expect(wsMetrics.workflowsCount).toBe(apiMetrics.workflowsCount)

            console.log('✅ WebSocket and API data consistency verified')
            console.log(`   API specs: ${apiMetrics.specsCount}, WS specs: ${wsMetrics.specsCount}`)
            console.log(`   API agents: ${apiMetrics.agentsCount}, WS agents: ${wsMetrics.agentsCount}`)

            clearTimeout(timeout)
            ws.close()
            resolve()
          }
        } catch (error) {
          clearTimeout(timeout)
          ws.close()
          reject(error)
        }
      }

      ws.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }, 12000)
})