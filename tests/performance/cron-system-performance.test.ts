import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CronManagementSkill } from '../../src/skills/cron-management-skill';
import { LLMChargeCronScheduler } from '../../src/core/cron-scheduler';
import { CronDatabaseManager } from '../../src/database/cron-database-manager';
import { CronJobType, CronJobStatus } from '../../src/core/cron-types';
import fs from 'fs/promises';
import path from 'path';

// Mock node-cron to avoid actual scheduling during performance tests
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    running: false
  })),
  validate: jest.fn(() => true)
}));

describe('Cron System Performance Tests', () => {
  let cronSkill: CronManagementSkill;
  let cronScheduler: LLMChargeCronScheduler;
  let dbManager: CronDatabaseManager;
  let testDbPath: string;

  beforeAll(async () => {
    // Create temporary database for performance testing
    testDbPath = path.join(__dirname, '../../data/test-performance-cron.db');
    
    // Ensure test database directory exists
    const dbDir = path.dirname(testDbPath);
    try {
      await fs.mkdir(dbDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Initialize test components
    dbManager = new CronDatabaseManager(testDbPath);
    await dbManager.initialize();
    
    cronScheduler = new LLMChargeCronScheduler(dbManager);
    await cronScheduler.start();

    cronSkill = new CronManagementSkill();
    // Set up the skill with our test components
    (cronSkill as any).dbManager = dbManager;
    (cronSkill as any).cronScheduler = cronScheduler;
  });

  afterAll(async () => {
    // Cleanup
    if (cronScheduler) {
      await cronScheduler.stop();
    }
    if (dbManager) {
      await dbManager.close();
    }
    
    // Remove test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File might not exist
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Creation Performance', () => {
    it('should create 100 jobs within 5 seconds', async () => {
      const startTime = Date.now();
      const jobPromises: Promise<any>[] = [];

      for (let i = 0; i < 100; i++) {
        const jobData = {
          name: `Performance Test Job ${i}`,
          description: `Performance test job number ${i}`,
          schedule: `${i % 60} ${i % 24} * * *`, // Unique schedule for each job
          jobType: Object.values(CronJobType)[i % Object.values(CronJobType).length],
          config: { testId: i, batch: 'performance' },
          priority: (['low', 'medium', 'high', 'critical'] as const)[i % 4],
          tags: [`performance`, `batch-${Math.floor(i / 10)}`],
          enabled: i % 2 === 0 // Alternate enabled/disabled
        };

        jobPromises.push(cronSkill.createCronJob(jobData));
      }

      const results = await Promise.all(jobPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all jobs were created successfully
      expect(results.every(result => result.success)).toBe(true);
      
      // Performance assertion: should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      
      console.log(`Created 100 jobs in ${duration}ms (${(100 / (duration / 1000)).toFixed(1)} jobs/sec)`);
    }, 10000);

    it('should handle concurrent job creation without conflicts', async () => {
      const concurrentBatches = 5;
      const jobsPerBatch = 20;
      const batchPromises: Promise<any>[] = [];

      for (let batch = 0; batch < concurrentBatches; batch++) {
        const batchPromise = Promise.all(
          Array.from({ length: jobsPerBatch }, (_, i) => {
            const jobIndex = batch * jobsPerBatch + i;
            return cronSkill.createCronJob({
              name: `Concurrent Job B${batch}-${i}`,
              description: `Concurrent test job`,
              schedule: `${jobIndex % 60} * * * *`,
              jobType: CronJobType.DATABASE_MAINTENANCE,
              config: { batchId: batch, jobIndex: i },
              priority: 'medium'
            });
          })
        );
        batchPromises.push(batchPromise);
      }

      const startTime = Date.now();
      const allResults = await Promise.all(batchPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Flatten results and verify all succeeded
      const flatResults = allResults.flat();
      expect(flatResults.every(result => result.success)).toBe(true);
      expect(flatResults.length).toBe(concurrentBatches * jobsPerBatch);

      // Verify no duplicate job IDs
      const jobIds = flatResults.map(result => result.jobId);
      const uniqueJobIds = new Set(jobIds);
      expect(uniqueJobIds.size).toBe(jobIds.length);

      console.log(`Created ${flatResults.length} jobs concurrently in ${duration}ms`);
    }, 15000);
  });

  describe('Job Listing Performance', () => {
    beforeEach(async () => {
      // Create a baseline of jobs for listing tests
      const baselineJobs = 50;
      const jobPromises = Array.from({ length: baselineJobs }, (_, i) =>
        cronSkill.createCronJob({
          name: `Baseline Job ${i}`,
          description: `Baseline job for listing performance`,
          schedule: `${i % 60} * * * *`,
          jobType: Object.values(CronJobType)[i % Object.values(CronJobType).length],
          config: { baselineId: i },
          priority: (['low', 'medium', 'high', 'critical'] as const)[i % 4],
          tags: [`baseline`, `type-${i % 5}`]
        })
      );
      await Promise.all(jobPromises);
    });

    it('should list jobs quickly even with large datasets', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await cronSkill.listCronJobs();
        const endTime = Date.now();
        
        times.push(endTime - startTime);
        expect(result.success).toBe(true);
        expect(result.jobs.length).toBeGreaterThan(0);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Performance assertions
      expect(averageTime).toBeLessThan(500); // Average should be under 500ms
      expect(maxTime).toBeLessThan(1000); // No single query should exceed 1s

      console.log(`Job listing: avg ${averageTime.toFixed(1)}ms, max ${maxTime}ms over ${iterations} iterations`);
    });

    it('should filter jobs efficiently', async () => {
      const filterTests = [
        { type: CronJobType.RESOURCE_CLEANUP },
        { status: CronJobStatus.PENDING },
        { enabled: true },
        { tags: ['baseline'] },
        { type: CronJobType.DATABASE_MAINTENANCE, enabled: true }
      ];

      for (const filter of filterTests) {
        const startTime = Date.now();
        const result = await cronSkill.listCronJobs(filter);
        const endTime = Date.now();
        
        expect(result.success).toBe(true);
        expect(endTime - startTime).toBeLessThan(300); // Each filter should be fast
      }
    });
  });

  describe('Job Execution Performance', () => {
    let testJobIds: string[] = [];

    beforeEach(async () => {
      // Create test jobs for execution performance
      const executionJobs = 20;
      const jobPromises = Array.from({ length: executionJobs }, (_, i) =>
        cronSkill.createCronJob({
          name: `Execution Test Job ${i}`,
          description: `Job for execution performance testing`,
          schedule: `0 0 * * *`, // Daily at midnight
          jobType: CronJobType.DATABASE_MAINTENANCE,
          config: { executionTest: true, duration: 100 }, // Mock 100ms execution
          priority: 'medium'
        })
      );

      const results = await Promise.all(jobPromises);
      testJobIds = results.map(result => result.jobId!);
    });

    it('should execute multiple jobs concurrently', async () => {
      const concurrentExecutions = 5;
      const executionPromises = testJobIds
        .slice(0, concurrentExecutions)
        .map(jobId => cronSkill.runCronJobNow({ jobId }));

      const startTime = Date.now();
      const results = await Promise.all(executionPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all executions completed
      expect(results.every(result => result.success || result.execution)).toBe(true);
      
      // Should complete concurrently, not sequentially
      expect(duration).toBeLessThan(1000); // Should be much faster than 5 * single execution time

      console.log(`Executed ${concurrentExecutions} jobs concurrently in ${duration}ms`);
    });

    it('should handle rapid sequential executions', async () => {
      const rapidExecutions = 10;
      const jobId = testJobIds[0];
      const times: number[] = [];

      for (let i = 0; i < rapidExecutions; i++) {
        const startTime = Date.now();
        const result = await cronSkill.runCronJobNow({ jobId });
        const endTime = Date.now();
        
        times.push(endTime - startTime);
        expect(result.success || result.execution).toBeTruthy();
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Sequential executions should still be reasonably fast
      expect(averageTime).toBeLessThan(500);

      console.log(`Rapid sequential executions: avg ${averageTime.toFixed(1)}ms per execution`);
    });
  });

  describe('Database Performance', () => {
    it('should handle high-frequency job updates', async () => {
      // Create a job for updates
      const createResult = await cronSkill.createCronJob({
        name: 'Update Performance Test',
        description: 'Job for testing update performance',
        schedule: '0 * * * *',
        jobType: CronJobType.AGENT_PERFORMANCE,
        config: { updateTest: true }
      });

      const jobId = createResult.jobId!;
      const updateCount = 100;
      const updatePromises: Promise<any>[] = [];

      const startTime = Date.now();
      
      for (let i = 0; i < updateCount; i++) {
        const updatePromise = cronSkill.updateCronJob({
          jobId,
          updates: {
            description: `Updated description ${i}`,
            config: { updateTest: true, iteration: i },
            tags: [`update-${i}`, 'performance']
          }
        });
        updatePromises.push(updatePromise);
      }

      const results = await Promise.all(updatePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.every(result => result.success)).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`Performed ${updateCount} updates in ${duration}ms (${(updateCount / (duration / 1000)).toFixed(1)} updates/sec)`);
    });

    it('should efficiently query execution history', async () => {
      // Create some test jobs first for history simulation
      const testJobCreationPromises = Array.from({ length: 5 }, (_, i) =>
        cronSkill.createCronJob({
          name: `History Test Job ${i}`,
          description: `Job for execution history testing`,
          schedule: `0 0 * * *`, // Daily at midnight
          jobType: CronJobType.DATABASE_MAINTENANCE,
          config: { historyTest: true },
          priority: 'medium'
        })
      );

      const jobCreationResults = await Promise.all(testJobCreationPromises);
      const localTestJobIds = jobCreationResults.map(result => result.jobId!);
      
      // Generate mock execution history
      const historyEntries = 200;
      
      // This would typically be done by the scheduler, but for testing we'll simulate
      const historyPromises = Array.from({ length: historyEntries }, async (_, i) => {
        const jobId = localTestJobIds[i % localTestJobIds.length] || 'mock-job';
        
        // Mock execution record (normally created by scheduler)
        return {
          id: `exec-${i}`,
          jobId,
          jobName: `Test Job ${i % localTestJobIds.length}`,
          status: i % 10 === 0 ? CronJobStatus.FAILED : CronJobStatus.COMPLETED,
          startTime: new Date(Date.now() - i * 60000).toISOString(), // 1 minute apart
          endTime: new Date(Date.now() - i * 60000 + 5000).toISOString(), // 5 second duration
          duration: 5000,
          triggeredBy: 'test',
          result: { success: i % 10 !== 0 }
        };
      });

      await Promise.all(historyPromises);

      // Test history retrieval performance
      const historyTests = [
        { limit: 50 },
        { limit: 100 },
        { limit: 200 },
        { status: CronJobStatus.COMPLETED },
        { status: CronJobStatus.FAILED }
      ];

      for (const testParams of historyTests) {
        const startTime = Date.now();
        const result = await cronSkill.getExecutionHistory(testParams);
        const endTime = Date.now();
        
        expect(result.success).toBe(true);
        expect(endTime - startTime).toBeLessThan(200); // Should be very fast
      }
    });
  });

  describe('System Health Performance', () => {
    it('should generate dashboard metrics quickly', async () => {
      const iterations = 20;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await cronSkill.getCronDashboard();
        const endTime = Date.now();
        
        times.push(endTime - startTime);
        expect(result.success).toBe(true);
        expect(result.metrics).toBeDefined();
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(100); // Very fast dashboard updates
      expect(maxTime).toBeLessThan(300);

      console.log(`Dashboard metrics: avg ${averageTime.toFixed(1)}ms, max ${maxTime}ms`);
    });

    it('should handle system status queries under load', async () => {
      const concurrentQueries = 10;
      const statusPromises = Array.from({ length: concurrentQueries }, () =>
        cronSkill.getSystemStatus()
      );

      const startTime = Date.now();
      const results = await Promise.all(statusPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.every(result => result.success)).toBe(true);
      expect(duration).toBeLessThan(500); // Concurrent queries should be fast

      console.log(`${concurrentQueries} concurrent status queries in ${duration}ms`);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during intensive operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform intensive operations
      const operations = [
        () => cronSkill.listCronJobs(),
        () => cronSkill.getCronDashboard(),
        () => cronSkill.getSystemStatus(),
        () => cronSkill.getCronJobTemplates()
      ];

      const cycles = 50;
      for (let i = 0; i < cycles; i++) {
        const operation = operations[i % operations.length];
        await operation();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseKB = memoryIncrease / 1024;

      // Memory increase should be reasonable (less than 10MB for these operations)
      expect(memoryIncreaseKB).toBeLessThan(10240);

      console.log(`Memory increase after ${cycles * operations.length} operations: ${memoryIncreaseKB.toFixed(1)}KB`);
    });

    it('should efficiently clean up job resources', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;
      
      // Create and delete many jobs
      const jobCount = 50;
      const createPromises = Array.from({ length: jobCount }, (_, i) =>
        cronSkill.createCronJob({
          name: `Memory Test Job ${i}`,
          description: `Job for memory cleanup testing`,
          schedule: `${i % 60} * * * *`,
          jobType: CronJobType.RESOURCE_CLEANUP,
          config: { memoryTest: true, data: 'x'.repeat(1000) } // Some data
        })
      );

      const createResults = await Promise.all(createPromises);
      const jobIds = createResults.map(result => result.jobId!);

      // Delete all jobs
      const deletePromises = jobIds.map(jobId =>
        cronSkill.deleteCronJob({ jobId })
      );
      await Promise.all(deletePromises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryDiff = memoryAfter - memoryBefore;

      // Memory should not have increased significantly after cleanup
      expect(memoryDiff / 1024).toBeLessThan(5120); // Less than 5MB increase

      console.log(`Memory difference after creating/deleting ${jobCount} jobs: ${(memoryDiff / 1024).toFixed(1)}KB`);
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load over time', async () => {
      const loadDuration = 10000; // 10 seconds
      const operationsPerSecond = 5;
      const totalOperations = (loadDuration / 1000) * operationsPerSecond;
      
      let completedOperations = 0;
      let failedOperations = 0;
      const startTime = Date.now();

      // Create a sustained load
      const loadPromise = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime >= loadDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          // Perform mixed operations
          const operations = [
            () => cronSkill.listCronJobs({ enabled: true }),
            () => cronSkill.getCronDashboard(),
            () => cronSkill.getSystemStatus(),
            () => cronSkill.getCronJobTemplates({ category: 'maintenance' }),
            () => cronSkill.getExecutionHistory({ limit: 10 })
          ];

          const randomOp = operations[Math.floor(Math.random() * operations.length)];
          
          try {
            await randomOp();
            completedOperations++;
          } catch (error) {
            failedOperations++;
          }
        }, 1000 / operationsPerSecond);
      });

      await loadPromise;
      
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      const successRate = completedOperations / (completedOperations + failedOperations);

      // Verify performance under load
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(completedOperations).toBeGreaterThan(totalOperations * 0.8); // At least 80% of expected ops

      console.log(`Load test: ${completedOperations} ops in ${actualDuration}ms, ${(successRate * 100).toFixed(1)}% success rate`);
    }, 15000);
  });
});