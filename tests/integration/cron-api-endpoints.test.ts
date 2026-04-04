import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import http from 'http';
import { AddressInfo } from 'net';
import { CronJobType, CronJobStatus } from '../../src/core/cron-types';

// Mock the cron dependencies to avoid actual job scheduling during tests
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    running: false
  })),
  validate: jest.fn(() => true)
}));

describe('Cron API Endpoints Integration Tests', () => {
  let server: http.Server | null;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    // Import and start the server
    const { ComprehensiveWorkingServer } = await import('../../src/server/comprehensive-working-server.mjs');
    const serverInstance = new ComprehensiveWorkingServer(0); // Use port 0 for auto-assignment
    
    // Start the server
    await serverInstance.start();
    server = serverInstance.server;
    
    port = (server!.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Clear any existing jobs before each test
    jest.clearAllMocks();
  });

  async function makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${baseUrl}${path}`;
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    
    return {
      status: response.status,
      data
    };
  }

  describe('POST /api/cron/jobs', () => {
    it('should create a new cron job successfully', async () => {
      const jobData = {
        name: 'Test Cleanup Job',
        description: 'Clean up temporary files every hour',
        schedule: '0 * * * *',
        jobType: CronJobType.RESOURCE_CLEANUP,
        config: {
          directory: '/tmp',
          maxAge: '24h'
        },
        priority: 'medium',
        tags: ['cleanup', 'maintenance']
      };

      const response = await makeRequest('POST', '/api/cron/jobs', jobData);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        jobId: expect.any(String),
        message: expect.stringContaining('created successfully'),
        nextRun: expect.any(String)
      });
    });

    it('should reject invalid cron job data', async () => {
      const invalidJobData = {
        name: '', // Empty name should be rejected
        schedule: 'invalid-cron',
        jobType: 'invalid-type'
      };

      const response = await makeRequest('POST', '/api/cron/jobs', invalidJobData);

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        success: false,
        message: expect.stringContaining('validation')
      });
    });

    it('should handle missing required fields', async () => {
      const incompleteJobData = {
        name: 'Test Job'
        // Missing required fields: schedule, jobType, config
      };

      const response = await makeRequest('POST', '/api/cron/jobs', incompleteJobData);

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });

  describe('GET /api/cron/jobs', () => {
    let createdJobId: string;

    beforeEach(async () => {
      // Create a test job for listing tests
      const jobData = {
        name: 'List Test Job',
        description: 'Job for testing list functionality',
        schedule: '0 */6 * * *',
        jobType: CronJobType.DATABASE_MAINTENANCE,
        config: { action: 'test' }
      };

      const createResponse = await makeRequest('POST', '/api/cron/jobs', jobData);
      createdJobId = createResponse.data.jobId;
    });

    it('should list all cron jobs', async () => {
      const response = await makeRequest('GET', '/api/cron/jobs');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        jobs: expect.arrayContaining([
          expect.objectContaining({
            id: createdJobId,
            name: 'List Test Job',
            type: CronJobType.DATABASE_MAINTENANCE,
            enabled: true
          })
        ]),
        total: expect.any(Number),
        message: expect.stringContaining('Found')
      });
    });

    it('should filter jobs by type', async () => {
      const response = await makeRequest('GET', '/api/cron/jobs?type=maintenance');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.jobs.every((job: any) => job.type === CronJobType.DATABASE_MAINTENANCE))
        .toBe(true);
    });

    it('should filter jobs by status', async () => {
      const response = await makeRequest('GET', '/api/cron/jobs?status=pending');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.jobs.every((job: any) => job.status === CronJobStatus.PENDING))
        .toBe(true);
    });

    it('should filter jobs by enabled status', async () => {
      const response = await makeRequest('GET', '/api/cron/jobs?enabled=true');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.jobs.every((job: any) => job.enabled === true)).toBe(true);
    });
  });

  describe('GET /api/cron/jobs/:id', () => {
    let createdJobId: string;

    beforeEach(async () => {
      const jobData = {
        name: 'Detail Test Job',
        description: 'Job for testing detail retrieval',
        schedule: '0 0 * * *',
        jobType: CronJobType.SYSTEM_MONITORING,
        config: { report: 'daily' }
      };

      const createResponse = await makeRequest('POST', '/api/cron/jobs', jobData);
      createdJobId = createResponse.data.jobId;
    });

    it('should get job details successfully', async () => {
      const response = await makeRequest('GET', `/api/cron/jobs/${createdJobId}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        job: expect.objectContaining({
          id: createdJobId,
          name: 'Detail Test Job',
          jobType: CronJobType.SYSTEM_MONITORING
        }),
        stats: expect.any(Object),
        message: expect.stringContaining('Retrieved details')
      });
    });

    it('should include execution history when requested', async () => {
      const response = await makeRequest('GET', 
        `/api/cron/jobs/${createdJobId}?includeExecutions=true&executionLimit=5`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('recentExecutions');
    });

    it('should return 404 for nonexistent job', async () => {
      const response = await makeRequest('GET', '/api/cron/jobs/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.data).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });
  });

  describe('PUT /api/cron/jobs/:id', () => {
    let createdJobId: string;

    beforeEach(async () => {
      const jobData = {
        name: 'Update Test Job',
        description: 'Job for testing updates',
        schedule: '0 */2 * * *',
        jobType: CronJobType.AGENT_PERFORMANCE,
        config: { level: 'basic' }
      };

      const createResponse = await makeRequest('POST', '/api/cron/jobs', jobData);
      createdJobId = createResponse.data.jobId;
    });

    it('should update job configuration successfully', async () => {
      const updates = {
        name: 'Updated Job Name',
        description: 'Updated description',
        schedule: '0 */4 * * *',
        priority: 'high',
        config: { level: 'advanced' }
      };

      const response = await makeRequest('PUT', `/api/cron/jobs/${createdJobId}`, { updates });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        message: expect.stringContaining('updated successfully')
      });

      // Verify the updates were applied
      const getResponse = await makeRequest('GET', `/api/cron/jobs/${createdJobId}`);
      expect(getResponse.data.job.name).toBe('Updated Job Name');
      expect(getResponse.data.job.priority).toBe('high');
    });

    it('should handle partial updates', async () => {
      const updates = {
        priority: 'critical'
      };

      const response = await makeRequest('PUT', `/api/cron/jobs/${createdJobId}`, { updates });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should return 404 for nonexistent job', async () => {
      const updates = { name: 'New Name' };
      const response = await makeRequest('PUT', '/api/cron/jobs/nonexistent-id', { updates });

      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('POST /api/cron/jobs/:id/execute', () => {
    let createdJobId: string;

    beforeEach(async () => {
      const jobData = {
        name: 'Execute Test Job',
        description: 'Job for testing manual execution',
        schedule: '0 0 * * 0', // Weekly
        jobType: CronJobType.RESOURCE_CLEANUP,
        config: { action: 'test-cleanup' }
      };

      const createResponse = await makeRequest('POST', '/api/cron/jobs', jobData);
      createdJobId = createResponse.data.jobId;
    });

    it('should execute job immediately', async () => {
      const response = await makeRequest('POST', `/api/cron/jobs/${createdJobId}/execute`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: expect.any(Boolean),
        execution: expect.objectContaining({
          id: expect.any(String),
          status: expect.any(String)
        }),
        message: expect.any(String)
      });
    });

    it('should return 404 for nonexistent job', async () => {
      const response = await makeRequest('POST', '/api/cron/jobs/nonexistent-id/execute');

      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('POST /api/cron/jobs/:id/toggle', () => {
    let createdJobId: string;

    beforeEach(async () => {
      const jobData = {
        name: 'Toggle Test Job',
        description: 'Job for testing enable/disable',
        schedule: '0 */3 * * *',
        jobType: CronJobType.DATABASE_MAINTENANCE,
        config: { maintenance: true }
      };

      const createResponse = await makeRequest('POST', '/api/cron/jobs', jobData);
      createdJobId = createResponse.data.jobId;
    });

    it('should disable job successfully', async () => {
      const response = await makeRequest('POST', `/api/cron/jobs/${createdJobId}/toggle`, {
        enabled: false
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        message: expect.stringContaining('disabled successfully')
      });
    });

    it('should enable job successfully', async () => {
      // First disable the job
      await makeRequest('POST', `/api/cron/jobs/${createdJobId}/toggle`, { enabled: false });

      // Then enable it
      const response = await makeRequest('POST', `/api/cron/jobs/${createdJobId}/toggle`, {
        enabled: true
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        message: expect.stringContaining('enabled successfully')
      });
    });

    it('should return 404 for nonexistent job', async () => {
      const response = await makeRequest('POST', '/api/cron/jobs/nonexistent-id/toggle', {
        enabled: false
      });

      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('DELETE /api/cron/jobs/:id', () => {
    let createdJobId: string;

    beforeEach(async () => {
      const jobData = {
        name: 'Delete Test Job',
        description: 'Job for testing deletion',
        schedule: '0 1 * * *',
        jobType: CronJobType.RESOURCE_CLEANUP,
        config: { temp: true }
      };

      const createResponse = await makeRequest('POST', '/api/cron/jobs', jobData);
      createdJobId = createResponse.data.jobId;
    });

    it('should delete job successfully', async () => {
      const response = await makeRequest('DELETE', `/api/cron/jobs/${createdJobId}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        message: expect.stringContaining('deleted successfully')
      });

      // Verify job is actually deleted
      const getResponse = await makeRequest('GET', `/api/cron/jobs/${createdJobId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for nonexistent job', async () => {
      const response = await makeRequest('DELETE', '/api/cron/jobs/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('GET /api/cron/dashboard', () => {
    it('should retrieve dashboard metrics', async () => {
      const response = await makeRequest('GET', '/api/cron/dashboard');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        metrics: expect.objectContaining({
          totalJobs: expect.any(Number),
          activeJobs: expect.any(Number),
          runningJobs: expect.any(Number),
          failedJobs: expect.any(Number),
          systemHealth: expect.any(Object)
        }),
        message: expect.stringContaining('Retrieved')
      });
    });
  });

  describe('GET /api/cron/templates', () => {
    it('should retrieve cron job templates', async () => {
      const response = await makeRequest('GET', '/api/cron/templates');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        templates: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            description: expect.any(String),
            jobType: expect.any(String),
            defaultSchedule: expect.any(String),
            category: expect.any(String),
            tags: expect.any(Array),
            configExample: expect.any(Object)
          })
        ]),
        message: expect.stringContaining('Found')
      });
    });

    it('should filter templates by category', async () => {
      const response = await makeRequest('GET', '/api/cron/templates?category=maintenance');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.templates.every((template: any) => 
        template.category === 'maintenance')).toBe(true);
    });

    it('should filter templates by jobType', async () => {
      const response = await makeRequest('GET', 
        `/api/cron/templates?jobType=${CronJobType.RESOURCE_CLEANUP}`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.templates.every((template: any) => 
        template.jobType === CronJobType.RESOURCE_CLEANUP)).toBe(true);
    });
  });

  describe('POST /api/cron/templates/:templateName', () => {
    it('should create job from template', async () => {
      // First get available templates
      const templatesResponse = await makeRequest('GET', '/api/cron/templates');
      const templates = templatesResponse.data.templates;
      
      if (templates.length === 0) {
        // Skip test if no templates available
        return;
      }

      const template = templates[0];
      const jobData = {
        name: 'Job from Template',
        description: 'Created from template test',
        config: { test: true }
      };

      const response = await makeRequest('POST', 
        `/api/cron/templates/${template.name}`, jobData);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        jobId: expect.any(String),
        message: expect.stringContaining('created successfully'),
        nextRun: expect.any(String)
      });
    });

    it('should return 404 for nonexistent template', async () => {
      const jobData = {
        name: 'Test Job',
        config: {}
      };

      const response = await makeRequest('POST', 
        '/api/cron/templates/nonexistent-template', jobData);

      expect(response.status).toBe(404);
      expect(response.data).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });
  });

  describe('POST /api/cron/validate', () => {
    it('should validate correct cron expression', async () => {
      const scheduleData = {
        schedule: '0 */5 * * *',
        nextRunCount: 3
      };

      const response = await makeRequest('POST', '/api/cron/validate', scheduleData);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        valid: true,
        description: expect.any(String),
        nextRuns: expect.any(Array),
        message: expect.stringContaining('Valid')
      });
      expect(response.data.nextRuns).toHaveLength(3);
    });

    it('should reject invalid cron expression', async () => {
      const scheduleData = {
        schedule: 'invalid-cron-expression'
      };

      const response = await makeRequest('POST', '/api/cron/validate', scheduleData);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        valid: false,
        message: expect.stringContaining('Invalid')
      });
    });
  });

  describe('GET /api/cron/status', () => {
    it('should retrieve system status', async () => {
      const response = await makeRequest('GET', '/api/cron/status');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: expect.objectContaining({
          schedulerRunning: expect.any(Boolean),
          totalJobs: expect.any(Number),
          activeJobs: expect.any(Number),
          runningJobs: expect.any(Number),
          failedJobs: expect.any(Number),
          systemHealth: expect.any(Object),
          recentErrors: expect.any(Array)
        }),
        message: expect.stringContaining('Retrieved')
      });
    });
  });

  describe('GET /api/cron/executions', () => {
    it('should retrieve execution history', async () => {
      const response = await makeRequest('GET', '/api/cron/executions');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        executions: expect.any(Array),
        message: expect.stringContaining('Retrieved')
      });
    });

    it('should limit execution history results', async () => {
      const response = await makeRequest('GET', '/api/cron/executions?limit=5');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.executions.length).toBeLessThanOrEqual(5);
    });

    it('should filter executions by status', async () => {
      const response = await makeRequest('GET', 
        `/api/cron/executions?status=${CronJobStatus.COMPLETED}`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.executions.every((exec: any) => 
        exec.status === CronJobStatus.COMPLETED)).toBe(true);
    });
  });
});