import { jest } from '@jest/globals'
import { EventEmitter } from 'events'
import { DistributedModelNetwork } from '../../../src/network/distributed-model-network.js'
import type {
  NetworkNode,
  TaskRequest,
  TaskResult,
  NodeRecommendation,
  LoadBalanceStrategy,
  NodeCapabilities
} from '../../../src/network/types.js'

// Mock network operations
jest.mock('http', () => ({
  createServer: jest.fn(),
  request: jest.fn()
}))

jest.mock('https', () => ({
  request: jest.fn()
}))

jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    clients: new Set(),
    close: jest.fn()
  })),
  WebSocket: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1
  }))
}))

// Mock crypto for node IDs
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-node-id')
}))

describe('DistributedModelNetwork', () => {
  let network: DistributedModelNetwork

  beforeEach(() => {
    network = new DistributedModelNetwork({
      port: 8080,
      discoveryPort: 8081,
      heartbeatInterval: 1000,
      maxNodes: 10
    })
  })

  afterEach(async () => {
    network.removeAllListeners()
    await network.shutdown()
  })

  describe('Node Registration', () => {
    test('should register a new node', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'node-1',
        address: '192.168.1.100',
        port: 8080,
        capabilities: {
          models: ['llama2', 'codellama'],
          maxConcurrency: 4,
          totalMemory: 16384,
          availableMemory: 8192,
          cpuCores: 8,
          gpuMemory: 8192,
          supportedFormats: ['text', 'code']
        },
        status: 'active',
        load: 0.25,
        reputation: 1.0
      }

      await network.registerNode(node)

      const nodes = await network.getActiveNodes()
      expect(nodes).toHaveLength(1)
      expect(nodes[0].id).toBe('node-1')
      expect(nodes[0].address).toBe('192.168.1.100')
      expect(nodes[0].lastSeen).toBeInstanceOf(Date)
    })

    test('should update existing node on re-registration', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'node-update-test',
        address: '192.168.1.101',
        port: 8080,
        capabilities: {
          models: ['gpt-3.5'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 4096,
          cpuCores: 4,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.1,
        reputation: 1.0
      }

      await network.registerNode(node)

      // Update node with new capabilities
      const updatedNode = {
        ...node,
        capabilities: {
          ...node.capabilities,
          models: ['gpt-3.5', 'gpt-4'],
          maxConcurrency: 4
        },
        load: 0.5
      }

      await network.registerNode(updatedNode)

      const nodes = await network.getActiveNodes()
      expect(nodes).toHaveLength(1)
      expect(nodes[0].capabilities.models).toContain('gpt-4')
      expect(nodes[0].capabilities.maxConcurrency).toBe(4)
      expect(nodes[0].load).toBe(0.5)
    })

    test('should emit node-registered event', async () => {
      const eventPromise = new Promise((resolve) => {
        network.on('node-registered', resolve)
      })

      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'event-test-node',
        address: '192.168.1.102',
        port: 8080,
        capabilities: {
          models: ['test-model'],
          maxConcurrency: 1,
          totalMemory: 4096,
          availableMemory: 2048,
          cpuCores: 2,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.0,
        reputation: 1.0
      }

      await network.registerNode(node)

      const event = await eventPromise
      expect(event).toEqual(
        expect.objectContaining({
          nodeId: 'event-test-node',
          isNew: true
        })
      )
    })

    test('should reject nodes with invalid capabilities', async () => {
      const invalidNode: Omit<NetworkNode, 'lastSeen'> = {
        id: 'invalid-node',
        address: '192.168.1.103',
        port: 8080,
        capabilities: {
          models: [], // Empty models array
          maxConcurrency: 0, // Invalid concurrency
          totalMemory: -1, // Negative memory
          availableMemory: 1000,
          cpuCores: 0,
          supportedFormats: []
        },
        status: 'active',
        load: 0.0,
        reputation: 1.0
      }

      await expect(network.registerNode(invalidNode)).rejects.toThrow('Invalid node capabilities')
    })
  })

  describe('Task Management', () => {
    let testNodes: NetworkNode[]

    beforeEach(async () => {
      // Register test nodes
      const node1: Omit<NetworkNode, 'lastSeen'> = {
        id: 'task-node-1',
        address: '192.168.1.201',
        port: 8080,
        capabilities: {
          models: ['llama2', 'codellama'],
          maxConcurrency: 4,
          totalMemory: 16384,
          availableMemory: 12000,
          cpuCores: 8,
          gpuMemory: 8192,
          supportedFormats: ['text', 'code']
        },
        status: 'active',
        load: 0.25,
        reputation: 0.95
      }

      const node2: Omit<NetworkNode, 'lastSeen'> = {
        id: 'task-node-2',
        address: '192.168.1.202',
        port: 8080,
        capabilities: {
          models: ['gpt-3.5', 'gpt-4'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 6000,
          cpuCores: 4,
          supportedFormats: ['text', 'json']
        },
        status: 'active',
        load: 0.6,
        reputation: 1.0
      }

      await network.registerNode(node1)
      await network.registerNode(node2)

      testNodes = await network.getActiveNodes()
    })

    test('should submit task and get task ID', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'llama2',
        prompt: 'Write a hello world function',
        parameters: {
          temperature: 0.7,
          maxTokens: 100
        },
        priority: 'normal',
        timeout: 30000
      }

      const taskId = await network.submitTask(task)

      expect(taskId).toBeTruthy()
      expect(taskId).toMatch(/^task_/)
    })

    test('should route task to appropriate node', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'gpt-4', // Only available on node-2
        prompt: 'Analyze this code',
        parameters: {
          temperature: 0.5
        },
        priority: 'high',
        timeout: 60000
      }

      const taskCompletionPromise = new Promise((resolve) => {
        network.on('task-completed', resolve)
      })

      await network.submitTask(task)

      const completionEvent = await taskCompletionPromise
      expect(completionEvent).toEqual(
        expect.objectContaining({
          taskId: expect.any(String),
          nodeId: 'task-node-2', // Should be routed to node with gpt-4
          result: expect.any(Object)
        })
      )
    })

    test('should handle task failures and retry', async () => {
      const failingTask: TaskRequest = {
        type: 'completion',
        model: 'nonexistent-model',
        prompt: 'This should fail',
        parameters: {},
        priority: 'normal',
        timeout: 10000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 100
        }
      }

      const taskFailedPromise = new Promise((resolve) => {
        network.on('task-failed', resolve)
      })

      await network.submitTask(failingTask)

      const failureEvent = await taskFailedPromise
      expect(failureEvent).toEqual(
        expect.objectContaining({
          taskId: expect.any(String),
          error: expect.any(String),
          retryCount: 2
        })
      )
    })

    test('should get task status', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'llama2',
        prompt: 'Test task status',
        parameters: {},
        priority: 'normal',
        timeout: 30000
      }

      const taskId = await network.submitTask(task)
      const status = await network.getTaskStatus(taskId)

      expect(status).toBeDefined()
      expect(status.taskId).toBe(taskId)
      expect(['pending', 'running', 'completed', 'failed']).toContain(status.status)
      expect(status.submittedAt).toBeInstanceOf(Date)
    })
  })

  describe('Load Balancing', () => {
    beforeEach(async () => {
      // Register nodes with different loads
      const nodes = [
        {
          id: 'lb-node-1',
          address: '192.168.1.301',
          port: 8080,
          capabilities: {
            models: ['llama2'],
            maxConcurrency: 4,
            totalMemory: 16384,
            availableMemory: 8000,
            cpuCores: 8,
            supportedFormats: ['text']
          },
          status: 'active' as const,
          load: 0.2, // Low load
          reputation: 1.0
        },
        {
          id: 'lb-node-2',
          address: '192.168.1.302',
          port: 8080,
          capabilities: {
            models: ['llama2'],
            maxConcurrency: 4,
            totalMemory: 16384,
            availableMemory: 4000,
            cpuCores: 8,
            supportedFormats: ['text']
          },
          status: 'active' as const,
          load: 0.8, // High load
          reputation: 0.9
        },
        {
          id: 'lb-node-3',
          address: '192.168.1.303',
          port: 8080,
          capabilities: {
            models: ['llama2'],
            maxConcurrency: 4,
            totalMemory: 16384,
            availableMemory: 12000,
            cpuCores: 8,
            supportedFormats: ['text']
          },
          status: 'active' as const,
          load: 0.1, // Very low load
          reputation: 0.95
        }
      ]

      for (const node of nodes) {
        await network.registerNode(node)
      }
    })

    test('should recommend nodes based on load balancing strategy', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'llama2',
        prompt: 'Load balancing test',
        parameters: {},
        priority: 'normal',
        timeout: 30000
      }

      const recommendations = await network.getNodeRecommendations(task)

      expect(recommendations).toHaveLength(3)
      expect(recommendations[0].score).toBeGreaterThanOrEqual(recommendations[1].score)
      expect(recommendations[1].score).toBeGreaterThanOrEqual(recommendations[2].score)

      // Lowest load node should be recommended first
      expect(recommendations[0].nodeId).toBe('lb-node-3')
    })

    test('should use round-robin strategy', async () => {
      network.setLoadBalanceStrategy('round-robin')

      const task: TaskRequest = {
        type: 'completion',
        model: 'llama2',
        prompt: 'Round robin test',
        parameters: {},
        priority: 'normal',
        timeout: 30000
      }

      const taskIds = []
      for (let i = 0; i < 3; i++) {
        const taskId = await network.submitTask(task)
        taskIds.push(taskId)
      }

      // Should distribute tasks across nodes in round-robin fashion
      expect(taskIds).toHaveLength(3)
    })

    test('should use weighted strategy based on capabilities', async () => {
      network.setLoadBalanceStrategy('weighted')

      const task: TaskRequest = {
        type: 'completion',
        model: 'llama2',
        prompt: 'Weighted balancing test',
        parameters: {},
        priority: 'high', // High priority should prefer high-reputation nodes
        timeout: 30000
      }

      const recommendations = await network.getNodeRecommendations(task)

      expect(recommendations[0].reason).toContain('reputation')
      expect(recommendations[0].nodeId).toBe('lb-node-1') // Highest reputation and low load
    })
  })

  describe('Node Discovery and Heartbeat', () => {
    test('should discover nodes on network', async () => {
      const discoveryPromise = new Promise((resolve) => {
        network.on('node-discovered', resolve)
      })

      // Simulate node discovery
      await network.startDiscovery()

      // Mock discovering a node
      network.handleNodeDiscovery({
        id: 'discovered-node',
        address: '192.168.1.400',
        port: 8080,
        capabilities: {
          models: ['discovered-model'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 4000,
          cpuCores: 4,
          supportedFormats: ['text']
        }
      })

      const discoveredNode = await discoveryPromise
      expect(discoveredNode).toEqual(
        expect.objectContaining({
          nodeId: 'discovered-node',
          address: '192.168.1.400'
        })
      )
    })

    test('should handle node heartbeats', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'heartbeat-node',
        address: '192.168.1.401',
        port: 8080,
        capabilities: {
          models: ['test-model'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 4000,
          cpuCores: 4,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.3,
        reputation: 1.0
      }

      await network.registerNode(node)

      // Send heartbeat
      await network.handleHeartbeat('heartbeat-node', {
        load: 0.5,
        availableMemory: 3000,
        activeTasks: 2
      })

      const nodes = await network.getActiveNodes()
      const heartbeatNode = nodes.find(n => n.id === 'heartbeat-node')

      expect(heartbeatNode?.load).toBe(0.5)
      expect(heartbeatNode?.capabilities.availableMemory).toBe(3000)
      expect(heartbeatNode?.lastSeen).toBeInstanceOf(Date)
    })

    test('should mark nodes as inactive after missed heartbeats', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'timeout-node',
        address: '192.168.1.402',
        port: 8080,
        capabilities: {
          models: ['test-model'],
          maxConcurrency: 1,
          totalMemory: 4096,
          availableMemory: 2000,
          cpuCores: 2,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.0,
        reputation: 1.0
      }

      await network.registerNode(node)

      // Wait for heartbeat timeout
      await new Promise(resolve => setTimeout(resolve, 2000))
      await network.checkNodeHealth()

      const nodes = await network.getActiveNodes()
      const timeoutNode = nodes.find(n => n.id === 'timeout-node')

      expect(timeoutNode?.status).toBe('inactive')
    })
  })

  describe('Cost Optimization', () => {
    beforeEach(async () => {
      // Register nodes with different cost profiles
      const nodes = [
        {
          id: 'cost-node-1',
          address: '192.168.1.501',
          port: 8080,
          capabilities: {
            models: ['gpt-3.5'],
            maxConcurrency: 2,
            totalMemory: 8192,
            availableMemory: 6000,
            cpuCores: 4,
            supportedFormats: ['text']
          },
          status: 'active' as const,
          load: 0.3,
          reputation: 1.0,
          costProfile: {
            baseCost: 0.001, // Low cost
            costPerToken: 0.00001,
            costPerSecond: 0.0001
          }
        },
        {
          id: 'cost-node-2',
          address: '192.168.1.502',
          port: 8080,
          capabilities: {
            models: ['gpt-4'],
            maxConcurrency: 1,
            totalMemory: 16384,
            availableMemory: 12000,
            cpuCores: 8,
            gpuMemory: 12288,
            supportedFormats: ['text']
          },
          status: 'active' as const,
          load: 0.1,
          reputation: 1.0,
          costProfile: {
            baseCost: 0.03, // High cost but high quality
            costPerToken: 0.00006,
            costPerSecond: 0.005
          }
        }
      ]

      for (const node of nodes) {
        await network.registerNode(node)
      }
    })

    test('should optimize for cost when requested', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'gpt-3.5', // Available on both nodes but cheaper on cost-node-1
        prompt: 'Cost optimization test',
        parameters: {
          maxTokens: 100
        },
        priority: 'normal',
        timeout: 30000,
        optimizeFor: 'cost'
      }

      const recommendations = await network.getNodeRecommendations(task)

      expect(recommendations[0].nodeId).toBe('cost-node-1')
      expect(recommendations[0].reason).toContain('cost')
    })

    test('should optimize for quality when requested', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'gpt-4',
        prompt: 'Quality optimization test',
        parameters: {
          maxTokens: 200
        },
        priority: 'high',
        timeout: 60000,
        optimizeFor: 'quality'
      }

      const recommendations = await network.getNodeRecommendations(task)

      expect(recommendations[0].nodeId).toBe('cost-node-2')
      expect(recommendations[0].reason).toContain('quality')
    })

    test('should calculate estimated cost for task', async () => {
      const task: TaskRequest = {
        type: 'completion',
        model: 'gpt-3.5',
        prompt: 'Cost estimation test with a longer prompt to test token counting',
        parameters: {
          maxTokens: 150
        },
        priority: 'normal',
        timeout: 30000
      }

      const costEstimate = await network.estimateTaskCost(task, 'cost-node-1')

      expect(costEstimate).toBeDefined()
      expect(costEstimate.baseCost).toBe(0.001)
      expect(costEstimate.estimatedTokens).toBeGreaterThan(0)
      expect(costEstimate.totalCost).toBeGreaterThan(0.001)
    })
  })

  describe('Fault Tolerance', () => {
    test('should handle node failures gracefully', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'fault-test-node',
        address: '192.168.1.601',
        port: 8080,
        capabilities: {
          models: ['test-model'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 4000,
          cpuCores: 4,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.2,
        reputation: 1.0
      }

      await network.registerNode(node)

      const nodeFailurePromise = new Promise((resolve) => {
        network.on('node-failed', resolve)
      })

      // Simulate node failure
      await network.handleNodeFailure('fault-test-node', 'connection-lost')

      const failureEvent = await nodeFailurePromise
      expect(failureEvent).toEqual(
        expect.objectContaining({
          nodeId: 'fault-test-node',
          reason: 'connection-lost'
        })
      )

      const nodes = await network.getActiveNodes()
      const failedNode = nodes.find(n => n.id === 'fault-test-node')
      expect(failedNode?.status).toBe('failed')
    })

    test('should redistribute tasks when node fails', async () => {
      // Register multiple nodes
      await network.registerNode({
        id: 'primary-node',
        address: '192.168.1.701',
        port: 8080,
        capabilities: {
          models: ['llama2'],
          maxConcurrency: 4,
          totalMemory: 16384,
          availableMemory: 8000,
          cpuCores: 8,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.3,
        reputation: 1.0
      })

      await network.registerNode({
        id: 'backup-node',
        address: '192.168.1.702',
        port: 8080,
        capabilities: {
          models: ['llama2'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 4000,
          cpuCores: 4,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.1,
        reputation: 0.9
      })

      const taskRedistributedPromise = new Promise((resolve) => {
        network.on('task-redistributed', resolve)
      })

      const task: TaskRequest = {
        type: 'completion',
        model: 'llama2',
        prompt: 'Fault tolerance test',
        parameters: {},
        priority: 'normal',
        timeout: 30000
      }

      const taskId = await network.submitTask(task)
      
      // Simulate primary node failure
      await network.handleNodeFailure('primary-node', 'hardware-failure')

      const redistributionEvent = await taskRedistributedPromise
      expect(redistributionEvent).toEqual(
        expect.objectContaining({
          taskId,
          fromNodeId: 'primary-node',
          toNodeId: 'backup-node'
        })
      )
    })
  })

  describe('Performance Monitoring', () => {
    test('should track network performance metrics', async () => {
      const metrics = await network.getNetworkMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.totalNodes).toBeGreaterThanOrEqual(0)
      expect(metrics.activeNodes).toBeGreaterThanOrEqual(0)
      expect(metrics.totalTasks).toBeGreaterThanOrEqual(0)
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0)
      expect(metrics.networkUtilization).toBeGreaterThanOrEqual(0)
    })

    test('should provide node performance statistics', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'perf-test-node',
        address: '192.168.1.801',
        port: 8080,
        capabilities: {
          models: ['performance-model'],
          maxConcurrency: 4,
          totalMemory: 16384,
          availableMemory: 8000,
          cpuCores: 8,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.4,
        reputation: 1.0
      }

      await network.registerNode(node)

      const stats = await network.getNodeStatistics('perf-test-node')

      expect(stats).toBeDefined()
      expect(stats.totalTasksCompleted).toBeGreaterThanOrEqual(0)
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0)
      expect(stats.successRate).toBeGreaterThanOrEqual(0)
      expect(stats.uptime).toBeGreaterThanOrEqual(0)
    })

    test('should update node reputation based on performance', async () => {
      const node: Omit<NetworkNode, 'lastSeen'> = {
        id: 'reputation-node',
        address: '192.168.1.802',
        port: 8080,
        capabilities: {
          models: ['reputation-model'],
          maxConcurrency: 2,
          totalMemory: 8192,
          availableMemory: 4000,
          cpuCores: 4,
          supportedFormats: ['text']
        },
        status: 'active',
        load: 0.2,
        reputation: 1.0
      }

      await network.registerNode(node)

      // Simulate successful task completion
      await network.updateNodeReputation('reputation-node', 'task-success', 0.95)

      const nodes = await network.getActiveNodes()
      const reputationNode = nodes.find(n => n.id === 'reputation-node')

      expect(reputationNode?.reputation).toBeGreaterThan(0.9)
    })
  })
})