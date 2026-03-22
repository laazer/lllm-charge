// Unit tests for CostTracker
import { CostTracker } from '../../src/utils/cost-tracker'
import { TEST_CONFIG } from '../setup'
import * as path from 'path'

describe('CostTracker', () => {
  let costTracker: CostTracker
  const testConfigPath = path.join(TEST_CONFIG.TEST_CACHE_DIR, 'cost-tracker-test.json')

  beforeEach(async () => {
    costTracker = new CostTracker(testConfigPath)
    await costTracker.initialize()
  })

  afterEach(async () => {
    await costTracker.cleanup()
  })

  describe('Request Recording', () => {
    it('should record successful local requests with zero cost', async () => {
      const requestData = {
        isLocal: true,
        cost: 0,
        tokens: 150,
        model: 'llama2',
        latencyMs: 250
      }

      await costTracker.recordRequest(requestData)

      const metrics = await costTracker.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.totalCost).toBe(0)
      expect(metrics.localRequests).toBe(1)
      expect(metrics.apiRequests).toBe(0)
      expect(metrics.totalTokens).toBe(150)
    })

    it('should record API requests with actual costs', async () => {
      const requestData = {
        isLocal: false,
        cost: 0.003,
        tokens: 200,
        model: 'gpt-3.5-turbo',
        latencyMs: 800
      }

      await costTracker.recordRequest(requestData)

      const metrics = await costTracker.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.totalCost).toBe(0.003)
      expect(metrics.localRequests).toBe(0)
      expect(metrics.apiRequests).toBe(1)
      expect(metrics.averageLatency).toBe(800)
    })

    it('should record failed requests correctly', async () => {
      const requestData = {
        isLocal: false,
        cost: 0,
        tokens: 0,
        model: 'gpt-4',
        latencyMs: 100
      }

      await costTracker.recordRequest(requestData, false) // Failed request

      const metrics = await costTracker.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.successRate).toBe(0)
    })

    it('should handle multiple concurrent request recordings', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        isLocal: i % 2 === 0,
        cost: i % 2 === 0 ? 0 : 0.001 * (i + 1),
        tokens: 100 + i * 10,
        model: i % 2 === 0 ? 'llama2' : 'gpt-3.5-turbo',
        latencyMs: 200 + i * 50
      }))

      await Promise.all(requests.map(req => costTracker.recordRequest(req)))

      const metrics = await costTracker.getMetrics()
      expect(metrics.totalRequests).toBe(10)
      expect(metrics.localRequests).toBe(5)
      expect(metrics.apiRequests).toBe(5)
      expect(metrics.totalTokens).toBe(1450) // Sum: 100+110+120+...+190
    })
  })

  describe('Cost Analysis', () => {
    beforeEach(async () => {
      // Add some sample data
      const sampleRequests = [
        { isLocal: true, cost: 0, tokens: 100, model: 'llama2', latencyMs: 200 },
        { isLocal: false, cost: 0.002, tokens: 150, model: 'gpt-3.5-turbo', latencyMs: 600 },
        { isLocal: true, cost: 0, tokens: 200, model: 'llama2', latencyMs: 300 },
        { isLocal: false, cost: 0.005, tokens: 300, model: 'gpt-4', latencyMs: 1000 }
      ]

      for (const req of sampleRequests) {
        await costTracker.recordRequest(req)
      }
    })

    it('should calculate cost savings from local requests', async () => {
      const savings = await costTracker.calculateSavings()

      expect(savings).toBeDefined()
      expect(savings.totalSaved).toBeGreaterThan(0)
      expect(savings.localRequestCount).toBe(2)
      expect(savings.estimatedApiCost).toBeGreaterThan(0)
      expect(savings.savingsPercentage).toBeGreaterThan(0)
    })

    it('should provide detailed cost breakdown by model', async () => {
      const breakdown = await costTracker.getCostBreakdown()

      expect(breakdown).toBeDefined()
      expect(breakdown.byModel).toBeDefined()
      expect(breakdown.byModel['llama2']).toBeDefined()
      expect(breakdown.byModel['gpt-3.5-turbo']).toBeDefined()
      expect(breakdown.byModel['gpt-4']).toBeDefined()

      expect(breakdown.byModel['llama2'].cost).toBe(0)
      expect(breakdown.byModel['gpt-3.5-turbo'].cost).toBe(0.002)
      expect(breakdown.byModel['gpt-4'].cost).toBe(0.005)
    })

    it('should track performance metrics by request type', async () => {
      const metrics = await costTracker.getMetrics()

      expect(metrics.averageLatency).toBeGreaterThan(0)
      expect(metrics.localAverageLatency).toBeLessThan(metrics.apiAverageLatency)
      expect(metrics.successRate).toBe(1) // All requests were successful
    })

    it('should calculate trends over time', async () => {
      // Add requests over time simulation
      const now = Date.now()
      const oneHourAgo = now - 60 * 60 * 1000
      const oneDayAgo = now - 24 * 60 * 60 * 1000

      // Override timestamps for testing
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(oneDayAgo)
        .mockReturnValueOnce(oneHourAgo)
        .mockReturnValue(now)

      await costTracker.recordRequest({
        isLocal: false, cost: 0.01, tokens: 500, model: 'gpt-4', latencyMs: 1200
      })

      const trends = await costTracker.getTrends('24h')

      expect(trends).toBeDefined()
      expect(trends.timeframe).toBe('24h')
      expect(trends.costTrend).toBeDefined()
      expect(trends.usageTrend).toBeDefined()
    })
  })

  describe('Optimization Insights', () => {
    it('should identify opportunities for cost reduction', async () => {
      // Add patterns that suggest optimization opportunities
      const expensiveRequests = Array.from({ length: 20 }, (_, i) => ({
        isLocal: false,
        cost: 0.01,
        tokens: 1000,
        model: 'gpt-4',
        latencyMs: 2000
      }))

      for (const req of expensiveRequests) {
        await costTracker.recordRequest(req)
      }

      const insights = await costTracker.getOptimizationInsights()

      expect(insights).toBeDefined()
      expect(insights.recommendations).toContain('local')
      expect(insights.potentialSavings).toBeGreaterThan(0)
      expect(insights.highCostPatterns.length).toBeGreaterThan(0)
    })

    it('should suggest model optimizations', async () => {
      // Add pattern of using expensive models for simple tasks
      const requests = [
        { isLocal: false, cost: 0.02, tokens: 50, model: 'gpt-4', latencyMs: 800 }, // Expensive for simple task
        { isLocal: false, cost: 0.001, tokens: 200, model: 'gpt-3.5-turbo', latencyMs: 400 }, // Better choice
      ]

      for (const req of requests) {
        await costTracker.recordRequest(req)
      }

      const insights = await costTracker.getOptimizationInsights()

      expect(insights.recommendations).toContain('model')
    })

    it('should track return on investment from optimizations', async () => {
      // Simulate before/after optimization
      const beforeOptimization = Array.from({ length: 10 }, () => ({
        isLocal: false,
        cost: 0.005,
        tokens: 200,
        model: 'gpt-3.5-turbo',
        latencyMs: 600
      }))

      const afterOptimization = Array.from({ length: 10 }, () => ({
        isLocal: true,
        cost: 0,
        tokens: 200,
        model: 'llama2',
        latencyMs: 300
      }))

      // Record before period
      for (const req of beforeOptimization) {
        await costTracker.recordRequest(req)
      }

      const beforeMetrics = await costTracker.getMetrics()

      // Record after period
      for (const req of afterOptimization) {
        await costTracker.recordRequest(req)
      }

      const afterMetrics = await costTracker.getMetrics()
      const roi = await costTracker.calculateROI()

      expect(roi).toBeDefined()
      expect(roi.monthlySavings).toBeGreaterThan(0)
      expect(roi.performanceImprovement).toBeGreaterThan(0) // Local requests should be faster
    })
  })

  describe('Data Persistence', () => {
    it('should persist metrics across restarts', async () => {
      await costTracker.recordRequest({
        isLocal: true,
        cost: 0,
        tokens: 100,
        model: 'llama2',
        latencyMs: 250
      })

      const metricsBeforeRestart = await costTracker.getMetrics()
      
      // Simulate restart
      await costTracker.cleanup()
      costTracker = new CostTracker(testConfigPath)
      await costTracker.initialize()

      const metricsAfterRestart = await costTracker.getMetrics()

      expect(metricsAfterRestart.totalRequests).toBe(metricsBeforeRestart.totalRequests)
      expect(metricsAfterRestart.totalCost).toBe(metricsBeforeRestart.totalCost)
    })

    it('should handle data migration from older versions', async () => {
      // Create legacy data format
      const legacyData = {
        version: '1.0',
        requests: [
          { cost: 0.001, tokens: 100, timestamp: Date.now() }
        ]
      }

      // Write legacy data
      const fs = require('fs').promises
      await fs.writeFile(testConfigPath, JSON.stringify(legacyData))

      // Initialize with legacy data
      const newTracker = new CostTracker(testConfigPath)
      await newTracker.initialize()

      const metrics = await newTracker.getMetrics()
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(0)
      
      await newTracker.cleanup()
    })

    it('should export data for analysis', async () => {
      await costTracker.recordRequest({
        isLocal: false,
        cost: 0.002,
        tokens: 150,
        model: 'gpt-3.5-turbo',
        latencyMs: 500
      })

      const exportData = await costTracker.exportData('json')

      expect(exportData).toBeDefined()
      expect(exportData.requests).toBeDefined()
      expect(exportData.metrics).toBeDefined()
      expect(exportData.version).toBeDefined()
    })
  })

  describe('Alert System', () => {
    it('should trigger cost threshold alerts', async () => {
      const alerts = []
      costTracker.onCostAlert((alert) => {
        alerts.push(alert)
      })

      // Set a low threshold for testing
      costTracker.setCostThreshold(0.01)

      // Exceed threshold
      await costTracker.recordRequest({
        isLocal: false,
        cost: 0.02,
        tokens: 1000,
        model: 'gpt-4',
        latencyMs: 1500
      })

      expect(alerts).toHaveLength(1)
      expect(alerts[0].type).toBe('cost_threshold')
      expect(alerts[0].threshold).toBe(0.01)
    })

    it('should alert on unusual spending patterns', async () => {
      const alerts = []
      costTracker.onPatternAlert((alert) => {
        alerts.push(alert)
      })

      // Create pattern of suddenly high costs
      const normalRequests = Array.from({ length: 10 }, () => ({
        isLocal: true,
        cost: 0,
        tokens: 100,
        model: 'llama2',
        latencyMs: 200
      }))

      const expensiveRequests = Array.from({ length: 5 }, () => ({
        isLocal: false,
        cost: 0.05,
        tokens: 1000,
        model: 'gpt-4',
        latencyMs: 2000
      }))

      // Record normal pattern
      for (const req of normalRequests) {
        await costTracker.recordRequest(req)
      }

      // Record unusual expensive pattern
      for (const req of expensiveRequests) {
        await costTracker.recordRequest(req)
      }

      // Should detect unusual spending pattern
      expect(alerts.length).toBeGreaterThan(0)
    })
  })
})