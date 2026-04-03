// Cron Management Skill for LLM-Charge
// FEATURE: Claude-accessible cron job management and monitoring

import {
  CronJob,
  CronJobType,
  CronJobStatus,
  CronExecution,
  CronJobStats,
  CronDashboardMetrics,
  CRON_JOB_TEMPLATES,
  CronAlert
} from '../core/cron-types';
import { LLMChargeCronScheduler } from '../core/cron-scheduler';
import { CronDatabaseManager } from '../database/cron-database-manager';

export class CronManagementSkill {
  private cronScheduler?: LLMChargeCronScheduler;
  private dbManager?: CronDatabaseManager;

  constructor() {
    // Lazy initialization to avoid circular dependencies
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.cronScheduler) {
      this.dbManager = new CronDatabaseManager();
      await this.dbManager.initialize();
      this.cronScheduler = new LLMChargeCronScheduler(this.dbManager);
      
      if (!this.cronScheduler.isRunning()) {
        await this.cronScheduler.start();
      }
    }
  }

  /**
   * Create a new cron job for periodic task execution
   */
  async createCronJob(params: {
    name: string;
    description: string;
    schedule: string; // Cron expression (e.g., "0 */5 * * *")
    jobType: CronJobType;
    config: any; // Job-specific configuration
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    enabled?: boolean;
  }): Promise<{
    success: boolean;
    jobId?: string;
    message: string;
    nextRun?: string;
  }> {
    try {
      await this.ensureInitialized();

      const job: CronJob = {
        id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: params.name,
        description: params.description,
        schedule: params.schedule,
        jobType: params.jobType,
        config: params.config,
        status: CronJobStatus.PENDING,
        priority: params.priority || 'medium',
        enabled: params.enabled !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        runCount: 0,
        failureCount: 0,
        maxRetries: 3,
        retryDelay: 5000,
        timeout: 300000, // 5 minutes
        tags: params.tags || [],
        metadata: {}
      };

      const jobId = await this.cronScheduler!.addJob(job);
      const createdJob = await this.cronScheduler!.getJob(jobId);
      
      return {
        success: true,
        jobId,
        message: `Cron job "${params.name}" created successfully`,
        nextRun: createdJob?.nextRun
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create cron job: ${error.message}`
      };
    }
  }

  /**
   * List all cron jobs with their status and next run times
   */
  async listCronJobs(params?: {
    type?: CronJobType;
    status?: CronJobStatus;
    enabled?: boolean;
    tags?: string[];
  }): Promise<{
    success: boolean;
    jobs: Array<{
      id: string;
      name: string;
      description: string;
      schedule: string;
      type: CronJobType;
      status: CronJobStatus;
      enabled: boolean;
      priority: string;
      lastRun?: string;
      nextRun?: string;
      runCount: number;
      failureCount: number;
      tags: string[];
    }>;
    total: number;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      let jobs = await this.cronScheduler!.getAllJobs();

      // Apply filters
      if (params?.type) {
        jobs = jobs.filter(job => job.jobType === params.type);
      }
      if (params?.status) {
        jobs = jobs.filter(job => job.status === params.status);
      }
      if (params?.enabled !== undefined) {
        jobs = jobs.filter(job => job.enabled === params.enabled);
      }
      if (params?.tags?.length) {
        jobs = jobs.filter(job => 
          params.tags!.some(tag => job.tags.includes(tag))
        );
      }

      const formattedJobs = jobs.map(job => ({
        id: job.id,
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        type: job.jobType,
        status: job.status,
        enabled: job.enabled,
        priority: job.priority,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        runCount: job.runCount,
        failureCount: job.failureCount,
        tags: job.tags
      }));

      return {
        success: true,
        jobs: formattedJobs,
        total: formattedJobs.length,
        message: `Found ${formattedJobs.length} cron jobs`
      };
    } catch (error: any) {
      return {
        success: false,
        jobs: [],
        total: 0,
        message: `Failed to list cron jobs: ${error.message}`
      };
    }
  }

  /**
   * Get detailed information about a specific cron job
   */
  async getCronJobDetails(params: {
    jobId: string;
    includeExecutions?: boolean;
    executionLimit?: number;
  }): Promise<{
    success: boolean;
    job?: CronJob;
    stats?: CronJobStats;
    recentExecutions?: CronExecution[];
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const job = await this.cronScheduler!.getJob(params.jobId);
      if (!job) {
        return {
          success: false,
          message: `Cron job ${params.jobId} not found`
        };
      }

      const stats = await this.cronScheduler!.getJobStats(params.jobId);
      
      let recentExecutions: CronExecution[] | undefined;
      if (params.includeExecutions) {
        recentExecutions = await this.cronScheduler!.getJobExecutions(
          params.jobId, 
          params.executionLimit || 10
        );
      }

      return {
        success: true,
        job,
        stats,
        recentExecutions,
        message: `Retrieved details for cron job "${job.name}"`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get cron job details: ${error.message}`
      };
    }
  }

  /**
   * Execute a cron job immediately (manual trigger)
   */
  async runCronJobNow(params: {
    jobId: string;
  }): Promise<{
    success: boolean;
    execution?: CronExecution;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const execution = await this.cronScheduler!.runJobNow(params.jobId);
      
      return {
        success: execution.status === CronJobStatus.COMPLETED,
        execution,
        message: execution.status === CronJobStatus.COMPLETED 
          ? 'Job executed successfully'
          : `Job execution ${execution.status}: ${execution.error || 'No details available'}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to execute cron job: ${error.message}`
      };
    }
  }

  /**
   * Update an existing cron job configuration
   */
  async updateCronJob(params: {
    jobId: string;
    updates: {
      name?: string;
      description?: string;
      schedule?: string;
      config?: any;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      enabled?: boolean;
      tags?: string[];
    };
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const success = await this.cronScheduler!.updateJob(params.jobId, params.updates);
      
      return {
        success,
        message: success 
          ? 'Cron job updated successfully'
          : 'Failed to update cron job (job not found)'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update cron job: ${error.message}`
      };
    }
  }

  /**
   * Enable or disable a cron job
   */
  async toggleCronJob(params: {
    jobId: string;
    enabled: boolean;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const success = params.enabled 
        ? await this.cronScheduler!.enableJob(params.jobId)
        : await this.cronScheduler!.disableJob(params.jobId);
      
      return {
        success,
        message: success 
          ? `Cron job ${params.enabled ? 'enabled' : 'disabled'} successfully`
          : 'Failed to toggle cron job (job not found)'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to toggle cron job: ${error.message}`
      };
    }
  }

  /**
   * Delete a cron job
   */
  async deleteCronJob(params: {
    jobId: string;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const success = await this.cronScheduler!.removeJob(params.jobId);
      
      return {
        success,
        message: success 
          ? 'Cron job deleted successfully'
          : 'Failed to delete cron job (job not found)'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to delete cron job: ${error.message}`
      };
    }
  }

  /**
   * Get cron system dashboard metrics
   */
  async getCronDashboard(): Promise<{
    success: boolean;
    metrics?: CronDashboardMetrics;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const metrics = await this.cronScheduler!.getDashboardMetrics();
      
      return {
        success: true,
        metrics,
        message: 'Retrieved cron dashboard metrics successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get dashboard metrics: ${error.message}`
      };
    }
  }

  /**
   * Get available cron job templates
   */
  async getCronJobTemplates(params?: {
    category?: 'maintenance' | 'monitoring' | 'optimization' | 'analytics';
    jobType?: CronJobType;
  }): Promise<{
    success: boolean;
    templates: Array<{
      name: string;
      description: string;
      jobType: CronJobType;
      defaultSchedule: string;
      category: string;
      tags: string[];
      configExample: any;
    }>;
    message: string;
  }> {
    try {
      let templates = [...CRON_JOB_TEMPLATES];

      // Apply filters
      if (params?.category) {
        templates = templates.filter(t => t.category === params.category);
      }
      if (params?.jobType) {
        templates = templates.filter(t => t.jobType === params.jobType);
      }

      const formattedTemplates = templates.map(template => ({
        name: template.name,
        description: template.description,
        jobType: template.jobType,
        defaultSchedule: template.defaultSchedule,
        category: template.category,
        tags: template.tags,
        configExample: template.defaultConfig
      }));

      return {
        success: true,
        templates: formattedTemplates,
        message: `Found ${formattedTemplates.length} cron job templates`
      };
    } catch (error: any) {
      return {
        success: false,
        templates: [],
        message: `Failed to get templates: ${error.message}`
      };
    }
  }

  /**
   * Create a cron job from a template
   */
  async createFromTemplate(params: {
    templateName: string;
    name: string;
    description?: string;
    schedule?: string;
    config?: any;
    tags?: string[];
    enabled?: boolean;
  }): Promise<{
    success: boolean;
    jobId?: string;
    message: string;
    nextRun?: string;
  }> {
    try {
      const template = CRON_JOB_TEMPLATES.find(t => t.name === params.templateName);
      if (!template) {
        return {
          success: false,
          message: `Template "${params.templateName}" not found`
        };
      }

      const config = { ...template.defaultConfig, ...params.config };
      const tags = [...template.tags, ...(params.tags || [])];

      return await this.createCronJob({
        name: params.name,
        description: params.description || template.description,
        schedule: params.schedule || template.defaultSchedule,
        jobType: template.jobType,
        config,
        priority: 'medium',
        tags,
        enabled: params.enabled !== false
      });
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create job from template: ${error.message}`
      };
    }
  }

  /**
   * Get recent execution history across all jobs
   */
  async getExecutionHistory(params?: {
    limit?: number;
    status?: CronJobStatus;
    jobType?: CronJobType;
  }): Promise<{
    success: boolean;
    executions: Array<{
      id: string;
      jobId: string;
      jobName: string;
      status: CronJobStatus;
      startTime: string;
      endTime?: string;
      duration?: number;
      triggeredBy: string;
      error?: string;
      hasAlerts: boolean;
    }>;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      let executions = await this.cronScheduler!.getRecentExecutions(params?.limit || 50);

      // Apply filters
      if (params?.status) {
        executions = executions.filter(exec => exec.status === params.status);
      }

      const formattedExecutions = executions.map(exec => ({
        id: exec.id,
        jobId: exec.jobId,
        jobName: exec.jobName,
        status: exec.status,
        startTime: exec.startTime,
        endTime: exec.endTime,
        duration: exec.duration,
        triggeredBy: exec.triggeredBy,
        error: exec.error,
        hasAlerts: (exec.result?.alerts?.length || 0) > 0
      }));

      return {
        success: true,
        executions: formattedExecutions,
        message: `Retrieved ${formattedExecutions.length} execution records`
      };
    } catch (error: any) {
      return {
        success: false,
        executions: [],
        message: `Failed to get execution history: ${error.message}`
      };
    }
  }

  /**
   * Validate a cron expression and get schedule information
   */
  async validateCronSchedule(params: {
    schedule: string;
    nextRunCount?: number;
  }): Promise<{
    success: boolean;
    valid: boolean;
    description?: string;
    nextRuns?: string[];
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      // Use the schedule helper from the cron scheduler
      const valid = this.cronScheduler!['scheduleHelper'].validateExpression(params.schedule);
      
      if (!valid) {
        return {
          success: true,
          valid: false,
          message: 'Invalid cron expression'
        };
      }

      const description = this.cronScheduler!['scheduleHelper'].describeSchedule(params.schedule);
      const nextRuns = this.cronScheduler!['scheduleHelper']
        .getNextRuns(params.schedule, params.nextRunCount || 5)
        .map(date => date.toISOString());

      return {
        success: true,
        valid: true,
        description,
        nextRuns,
        message: 'Valid cron expression'
      };
    } catch (error: any) {
      return {
        success: false,
        valid: false,
        message: `Failed to validate schedule: ${error.message}`
      };
    }
  }

  /**
   * Get comprehensive system status and health
   */
  async getSystemStatus(): Promise<{
    success: boolean;
    status: {
      schedulerRunning: boolean;
      totalJobs: number;
      activeJobs: number;
      runningJobs: number;
      failedJobs: number;
      systemHealth: any;
      recentErrors: any[];
    };
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      const metrics = await this.cronScheduler!.getDashboardMetrics();
      const recentExecutions = await this.cronScheduler!.getRecentExecutions(20);
      const recentErrors = recentExecutions
        .filter(exec => exec.status === CronJobStatus.FAILED || exec.error)
        .slice(0, 5)
        .map(exec => ({
          jobName: exec.jobName,
          error: exec.error,
          startTime: exec.startTime
        }));

      return {
        success: true,
        status: {
          schedulerRunning: this.cronScheduler!.isRunning(),
          totalJobs: metrics.totalJobs,
          activeJobs: metrics.activeJobs,
          runningJobs: metrics.runningJobs,
          failedJobs: metrics.failedJobs,
          systemHealth: metrics.systemHealth,
          recentErrors
        },
        message: 'Retrieved cron system status successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        status: {
          schedulerRunning: false,
          totalJobs: 0,
          activeJobs: 0,
          runningJobs: 0,
          failedJobs: 0,
          systemHealth: {},
          recentErrors: []
        },
        message: `Failed to get system status: ${error.message}`
      };
    }
  }
}

// Export singleton instance for use across the application
export const cronManagementSkill = new CronManagementSkill();