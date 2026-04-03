import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CronManagementSkill } from '../../src/skills/cron-management-skill';
import { CronJobType, CronJobStatus } from '../../src/core/cron-types';

// Mock the dependencies
jest.mock('../../src/core/cron-scheduler.js');
jest.mock('../../src/database/cron-database-manager.js');

describe('CronManagementSkill', () => {
  let cronSkill: CronManagementSkill;
  let mockScheduler: any;
  let mockDatabase: any;

  beforeEach(() => {
    // Create fresh mocks for each test
    // @ts-ignore - Mock object for testing
    mockScheduler = {
      start: jest.fn().mockResolvedValue(true),
      isRunning: jest.fn().mockReturnValue(true),
      addJob: jest.fn().mockResolvedValue('job-123'),
      getJob: jest.fn().mockResolvedValue({
        id: 'job-123',
        name: 'Test Job',
        nextRun: '2024-04-02T10:00:00.000Z'
      }),
      getAllJobs: jest.fn().mockResolvedValue([]),
      updateJob: jest.fn().mockResolvedValue(true),
      removeJob: jest.fn().mockResolvedValue(true),
      enableJob: jest.fn().mockResolvedValue(true),
      disableJob: jest.fn().mockResolvedValue(true),
      runJobNow: jest.fn().mockResolvedValue({
        id: 'exec-123',
        status: CronJobStatus.COMPLETED,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      }),
      getJobStats: jest.fn().mockResolvedValue({
        totalExecutions: 5,
        successfulExecutions: 4,
        failedExecutions: 1,
        averageDuration: 1500
      }),
      getJobExecutions: jest.fn().mockResolvedValue([]),
      getDashboardMetrics: jest.fn().mockResolvedValue({
        totalJobs: 3,
        activeJobs: 2,
        runningJobs: 1,
        failedJobs: 0,
        systemHealth: { status: 'healthy' }
      }),
      getRecentExecutions: jest.fn().mockResolvedValue([]),
      scheduleHelper: {
        validateExpression: jest.fn().mockReturnValue(true),
        describeSchedule: jest.fn().mockReturnValue('Every 5 minutes'),
        getNextRuns: jest.fn().mockReturnValue([
          new Date('2024-04-02T10:00:00.000Z'),
          new Date('2024-04-02T10:05:00.000Z')
        ])
      }
    } as any;

    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(true)
    } as any;

    cronSkill = new CronManagementSkill();
    // Access private properties for testing
    (cronSkill as any).cronScheduler = mockScheduler;
    (cronSkill as any).dbManager = mockDatabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCronJob', () => {
    it('should create a new cron job successfully', async () => {
      const params = {
        name: 'Test Cleanup Job',
        description: 'Clean up temporary files',
        schedule: '0 */6 * * *',
        jobType: CronJobType.RESOURCE_CLEANUP,
        config: { directory: '/tmp' },
        priority: 'medium' as const,
        tags: ['cleanup', 'maintenance'],
        enabled: true
      };

      const result = await cronSkill.createCronJob(params);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.message).toBe('Cron job "Test Cleanup Job" created successfully');
      expect(result.nextRun).toBe('2024-04-02T10:00:00.000Z');
      expect(mockScheduler.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: params.name,
          description: params.description,
          schedule: params.schedule,
          jobType: params.jobType,
          config: params.config,
          priority: params.priority,
          enabled: params.enabled,
          tags: params.tags
        })
      );
    });

    it('should handle cron job creation failure', async () => {
      mockScheduler.addJob.mockRejectedValue(new Error('Invalid schedule'));

      const params = {
        name: 'Invalid Job',
        description: 'This will fail',
        schedule: 'invalid-cron',
        jobType: CronJobType.DATABASE_MAINTENANCE,
        config: {}
      };

      const result = await cronSkill.createCronJob(params);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create cron job: Invalid schedule');
    });

    it('should use default values for optional parameters', async () => {
      const params = {
        name: 'Basic Job',
        description: 'Basic test job',
        schedule: '0 0 * * *',
        jobType: CronJobType.AGENT_PERFORMANCE,
        config: {}
      };

      await cronSkill.createCronJob(params);

      expect(mockScheduler.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'medium',
          enabled: true,
          tags: [],
          maxRetries: 3,
          retryDelay: 5000,
          timeout: 300000
        })
      );
    });
  });

  describe('listCronJobs', () => {
    beforeEach(() => {
      const mockJobs = [
        {
          id: 'job-1',
          name: 'Job 1',
          description: 'First job',
          schedule: '0 */5 * * *',
          jobType: CronJobType.RESOURCE_CLEANUP,
          status: CronJobStatus.PENDING,
          enabled: true,
          priority: 'high',
          lastRun: '2024-04-02T09:55:00.000Z',
          nextRun: '2024-04-02T10:00:00.000Z',
          runCount: 10,
          failureCount: 1,
          tags: ['cleanup']
        },
        {
          id: 'job-2',
          name: 'Job 2',
          description: 'Second job',
          schedule: '0 0 * * *',
          jobType: CronJobType.DATABASE_MAINTENANCE,
          status: CronJobStatus.RUNNING,
          enabled: false,
          priority: 'medium',
          runCount: 5,
          failureCount: 0,
          tags: ['maintenance', 'daily']
        }
      ];
      mockScheduler.getAllJobs.mockResolvedValue(mockJobs);
    });

    it('should list all cron jobs without filters', async () => {
      const result = await cronSkill.listCronJobs();

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.message).toBe('Found 2 cron jobs');
      expect(result.jobs[0]).toEqual({
        id: 'job-1',
        name: 'Job 1',
        description: 'First job',
        schedule: '0 */5 * * *',
        type: CronJobType.RESOURCE_CLEANUP,
        status: CronJobStatus.PENDING,
        enabled: true,
        priority: 'high',
        lastRun: '2024-04-02T09:55:00.000Z',
        nextRun: '2024-04-02T10:00:00.000Z',
        runCount: 10,
        failureCount: 1,
        tags: ['cleanup']
      });
    });

    it('should filter jobs by type', async () => {
      const result = await cronSkill.listCronJobs({ type: CronJobType.RESOURCE_CLEANUP });

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].type).toBe(CronJobType.RESOURCE_CLEANUP);
    });

    it('should filter jobs by status', async () => {
      const result = await cronSkill.listCronJobs({ status: CronJobStatus.RUNNING });

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe(CronJobStatus.RUNNING);
    });

    it('should filter jobs by enabled status', async () => {
      const result = await cronSkill.listCronJobs({ enabled: false });

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].enabled).toBe(false);
    });

    it('should filter jobs by tags', async () => {
      const result = await cronSkill.listCronJobs({ tags: ['daily'] });

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].tags).toContain('daily');
    });

    it('should handle listing failure', async () => {
      mockScheduler.getAllJobs.mockRejectedValue(new Error('Database error'));

      const result = await cronSkill.listCronJobs();

      expect(result.success).toBe(false);
      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.message).toBe('Failed to list cron jobs: Database error');
    });
  });

  describe('getCronJobDetails', () => {
    it('should get detailed job information with executions', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'Test Job',
        description: 'Test job description',
        schedule: '0 */5 * * *',
        jobType: CronJobType.SYSTEM_MONITORING
      };

      const mockStats = {
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        averageDuration: 2500
      };

      const mockExecutions = [
        {
          id: 'exec-1',
          jobId: 'job-123',
          status: CronJobStatus.COMPLETED,
          startTime: '2024-04-02T10:00:00.000Z',
          endTime: '2024-04-02T10:00:02.500Z',
          duration: 2500
        }
      ];

      mockScheduler.getJob.mockResolvedValue(mockJob);
      mockScheduler.getJobStats.mockResolvedValue(mockStats);
      mockScheduler.getJobExecutions.mockResolvedValue(mockExecutions);

      const result = await cronSkill.getCronJobDetails({
        jobId: 'job-123',
        includeExecutions: true,
        executionLimit: 5
      });

      expect(result.success).toBe(true);
      expect(result.job).toEqual(mockJob);
      expect(result.stats).toEqual(mockStats);
      expect(result.recentExecutions).toEqual(mockExecutions);
      expect(result.message).toBe('Retrieved details for cron job "Test Job"');
      expect(mockScheduler.getJobExecutions).toHaveBeenCalledWith('job-123', 5);
    });

    it('should handle job not found', async () => {
      mockScheduler.getJob.mockResolvedValue(null);

      const result = await cronSkill.getCronJobDetails({ jobId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cron job nonexistent not found');
    });

    it('should get job details without executions', async () => {
      const mockJob = { id: 'job-123', name: 'Test Job' };
      mockScheduler.getJob.mockResolvedValue(mockJob);

      const result = await cronSkill.getCronJobDetails({
        jobId: 'job-123',
        includeExecutions: false
      });

      expect(result.success).toBe(true);
      expect(result.recentExecutions).toBeUndefined();
      expect(mockScheduler.getJobExecutions).not.toHaveBeenCalled();
    });
  });

  describe('runCronJobNow', () => {
    it('should execute job immediately and return success', async () => {
      const mockExecution = {
        id: 'exec-123',
        status: CronJobStatus.COMPLETED,
        startTime: '2024-04-02T10:00:00.000Z',
        endTime: '2024-04-02T10:00:02.000Z',
        duration: 2000
      };

      mockScheduler.runJobNow.mockResolvedValue(mockExecution);

      const result = await cronSkill.runCronJobNow({ jobId: 'job-123' });

      expect(result.success).toBe(true);
      expect(result.execution).toEqual(mockExecution);
      expect(result.message).toBe('Job executed successfully');
      expect(mockScheduler.runJobNow).toHaveBeenCalledWith('job-123');
    });

    it('should handle job execution failure', async () => {
      const mockExecution = {
        id: 'exec-123',
        status: CronJobStatus.FAILED,
        error: 'Execution timeout',
        startTime: '2024-04-02T10:00:00.000Z'
      };

      mockScheduler.runJobNow.mockResolvedValue(mockExecution);

      const result = await cronSkill.runCronJobNow({ jobId: 'job-123' });

      expect(result.success).toBe(false);
      expect(result.execution).toEqual(mockExecution);
      expect(result.message).toBe('Job execution failed: Execution timeout');
    });
  });

  describe('updateCronJob', () => {
    it('should update job configuration successfully', async () => {
      mockScheduler.updateJob.mockResolvedValue(true);

      const result = await cronSkill.updateCronJob({
        jobId: 'job-123',
        updates: {
          name: 'Updated Job',
          schedule: '0 */10 * * *',
          priority: 'high',
          enabled: false
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cron job updated successfully');
      expect(mockScheduler.updateJob).toHaveBeenCalledWith('job-123', {
        name: 'Updated Job',
        schedule: '0 */10 * * *',
        priority: 'high',
        enabled: false
      });
    });

    it('should handle job update failure', async () => {
      mockScheduler.updateJob.mockResolvedValue(false);

      const result = await cronSkill.updateCronJob({
        jobId: 'nonexistent',
        updates: { name: 'New Name' }
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to update cron job (job not found)');
    });
  });

  describe('toggleCronJob', () => {
    it('should enable job successfully', async () => {
      mockScheduler.enableJob.mockResolvedValue(true);

      const result = await cronSkill.toggleCronJob({
        jobId: 'job-123',
        enabled: true
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cron job enabled successfully');
      expect(mockScheduler.enableJob).toHaveBeenCalledWith('job-123');
    });

    it('should disable job successfully', async () => {
      mockScheduler.disableJob.mockResolvedValue(true);

      const result = await cronSkill.toggleCronJob({
        jobId: 'job-123',
        enabled: false
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cron job disabled successfully');
      expect(mockScheduler.disableJob).toHaveBeenCalledWith('job-123');
    });
  });

  describe('deleteCronJob', () => {
    it('should delete job successfully', async () => {
      mockScheduler.removeJob.mockResolvedValue(true);

      const result = await cronSkill.deleteCronJob({ jobId: 'job-123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cron job deleted successfully');
      expect(mockScheduler.removeJob).toHaveBeenCalledWith('job-123');
    });

    it('should handle job deletion failure', async () => {
      mockScheduler.removeJob.mockResolvedValue(false);

      const result = await cronSkill.deleteCronJob({ jobId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete cron job (job not found)');
    });
  });

  describe('getCronDashboard', () => {
    it('should retrieve dashboard metrics successfully', async () => {
      const mockMetrics = {
        totalJobs: 5,
        activeJobs: 3,
        runningJobs: 1,
        failedJobs: 0,
        systemHealth: { status: 'healthy', uptime: 86400 }
      };

      mockScheduler.getDashboardMetrics.mockResolvedValue(mockMetrics);

      const result = await cronSkill.getCronDashboard();

      expect(result.success).toBe(true);
      expect(result.metrics).toEqual(mockMetrics);
      expect(result.message).toBe('Retrieved cron dashboard metrics successfully');
    });

    it('should handle dashboard metrics failure', async () => {
      mockScheduler.getDashboardMetrics.mockRejectedValue(new Error('Metrics unavailable'));

      const result = await cronSkill.getCronDashboard();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to get dashboard metrics: Metrics unavailable');
    });
  });

  describe('validateCronSchedule', () => {
    it('should validate a correct cron expression', async () => {
      const result = await cronSkill.validateCronSchedule({
        schedule: '0 */5 * * *',
        nextRunCount: 3
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.description).toBe('Every 5 minutes');
      expect(result.nextRuns).toHaveLength(2);
      expect(result.message).toBe('Valid cron expression');
    });

    it('should reject invalid cron expression', async () => {
      mockScheduler.scheduleHelper.validateExpression.mockReturnValue(false);

      const result = await cronSkill.validateCronSchedule({
        schedule: 'invalid-cron'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid cron expression');
    });

    it('should handle validation error', async () => {
      mockScheduler.scheduleHelper.validateExpression.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const result = await cronSkill.validateCronSchedule({
        schedule: '0 */5 * * *'
      });

      expect(result.success).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Failed to validate schedule: Validation error');
    });
  });

  describe('getSystemStatus', () => {
    it('should retrieve comprehensive system status', async () => {
      const mockMetrics = {
        totalJobs: 5,
        activeJobs: 3,
        runningJobs: 1,
        failedJobs: 1,
        systemHealth: { status: 'healthy' }
      };

      const mockExecutions = [
        {
          jobName: 'Failed Job',
          status: CronJobStatus.FAILED,
          error: 'Timeout error',
          startTime: '2024-04-02T10:00:00.000Z'
        }
      ];

      mockScheduler.getDashboardMetrics.mockResolvedValue(mockMetrics);
      mockScheduler.getRecentExecutions.mockResolvedValue(mockExecutions);
      mockScheduler.isRunning.mockReturnValue(true);

      const result = await cronSkill.getSystemStatus();

      expect(result.success).toBe(true);
      expect(result.status).toEqual({
        schedulerRunning: true,
        totalJobs: 5,
        activeJobs: 3,
        runningJobs: 1,
        failedJobs: 1,
        systemHealth: { status: 'healthy' },
        recentErrors: [
          {
            jobName: 'Failed Job',
            error: 'Timeout error',
            startTime: '2024-04-02T10:00:00.000Z'
          }
        ]
      });
      expect(result.message).toBe('Retrieved cron system status successfully');
    });

    it('should handle system status failure', async () => {
      mockScheduler.getDashboardMetrics.mockRejectedValue(new Error('System error'));

      const result = await cronSkill.getSystemStatus();

      expect(result.success).toBe(false);
      expect(result.status.schedulerRunning).toBe(false);
      expect(result.message).toBe('Failed to get system status: System error');
    });
  });
});