// Core cron scheduler implementation for periodic task management
// FEATURE: Background task scheduling with enterprise-grade features

import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { ScheduledTask } from 'node-cron';
import {
  CronJob,
  CronExecution,
  CronJobStats,
  CronJobStatus,
  CronJobType,
  CronScheduler,
  CronDashboardMetrics,
  CronAlert,
  CronNotificationConfig,
  CronScheduleHelper
} from './cron-types.js';
import { CronDatabaseManager } from '../database/cron-database-manager.js';
import { CronJobExecutor } from './cron-job-executor.js';
import { CronNotificationManager } from './cron-notification-manager.js';

export class LLMChargeCronScheduler extends EventEmitter implements CronScheduler {
  private isActive = false;
  private scheduledJobs = new Map<string, ScheduledTask>();
  private runningExecutions = new Map<string, CronExecution>();
  private dbManager: CronDatabaseManager;
  private jobExecutor: CronJobExecutor;
  private notificationManager: CronNotificationManager;
  private scheduleHelper: CronScheduleHelper;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsUpdateInterval?: NodeJS.Timeout;
  
  // Configuration
  private config = {
    maxConcurrentJobs: 10,
    healthCheckInterval: 60000, // 1 minute
    metricsUpdateInterval: 300000, // 5 minutes
    maxExecutionHistory: 10000,
    defaultTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000
  };

  constructor(
    dbManager: CronDatabaseManager,
    notificationConfig?: CronNotificationConfig
  ) {
    super();
    this.dbManager = dbManager;
    this.jobExecutor = new CronJobExecutor();
    this.notificationManager = new CronNotificationManager(notificationConfig);
    this.scheduleHelper = new CronScheduleHelperImpl();
    
    // Set up event handlers
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Cron scheduler is already running');
    }

    try {
      // Initialize database
      await this.dbManager.initialize();
      
      // Load existing jobs from database
      await this.loadJobsFromDatabase();
      
      // Start health check monitoring
      this.startHealthCheck();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      this.isActive = true;
      this.emit('scheduler-started');
      
      console.log('✅ LLM-Charge Cron Scheduler started successfully');
    } catch (error) {
      console.error('❌ Failed to start cron scheduler:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    try {
      // Stop all scheduled jobs
      for (const [jobId, cronJob] of this.scheduledJobs) {
        try {
          cronJob.stop();
        } catch (error) {
          console.warn(`Failed to stop job ${jobId}:`, error);
        }
      }
      
      // Wait for running executions to complete (with timeout)
      await this.waitForRunningExecutions(30000); // 30 seconds timeout
      
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.metricsUpdateInterval) {
        clearInterval(this.metricsUpdateInterval);
      }
      
      // Clear collections
      this.scheduledJobs.clear();
      this.runningExecutions.clear();
      
      this.isActive = false;
      this.emit('scheduler-stopped');
      
      console.log('✅ LLM-Charge Cron Scheduler stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop cron scheduler:', error);
      throw error;
    }
  }

  async addJob(job: CronJob): Promise<string> {
    // Validate job configuration
    this.validateJob(job);
    
    // Save to database
    const savedJob = await this.dbManager.createJob(job);
    
    // Schedule the job
    await this.scheduleJob(savedJob);
    
    this.emit('job-added', savedJob);
    return savedJob.id;
  }

  async updateJob(id: string, updates: Partial<CronJob>): Promise<boolean> {
    const existingJob = await this.dbManager.getJob(id);
    if (!existingJob) {
      return false;
    }

    // Validate updates
    const updatedJob = { ...existingJob, ...updates, updatedAt: new Date().toISOString() };
    this.validateJob(updatedJob);

    // Update in database
    const success = await this.dbManager.updateJob(id, updates);
    if (!success) {
      return false;
    }

    // Re-schedule if schedule or status changed
    if (updates.schedule || updates.enabled !== undefined) {
      await this.unscheduleJob(id);
      if (updatedJob.enabled) {
        await this.scheduleJob(updatedJob);
      }
    }

    this.emit('job-updated', updatedJob);
    return true;
  }

  async removeJob(id: string): Promise<boolean> {
    // Unschedule first
    await this.unscheduleJob(id);
    
    // Remove from database
    const success = await this.dbManager.deleteJob(id);
    if (success) {
      this.emit('job-removed', { id });
    }
    
    return success;
  }

  async enableJob(id: string): Promise<boolean> {
    return await this.updateJob(id, { enabled: true });
  }

  async disableJob(id: string): Promise<boolean> {
    await this.unscheduleJob(id);
    return await this.updateJob(id, { enabled: false });
  }

  async runJobNow(id: string): Promise<CronExecution> {
    const job = await this.dbManager.getJob(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }

    return await this.executeJob(job, 'manual');
  }

  async getJob(id: string): Promise<CronJob | null> {
    return await this.dbManager.getJob(id);
  }

  async getAllJobs(): Promise<CronJob[]> {
    return await this.dbManager.getAllJobs();
  }

  async getJobsByType(type: CronJobType): Promise<CronJob[]> {
    return await this.dbManager.getJobsByType(type);
  }

  async getJobExecutions(jobId: string, limit = 100): Promise<CronExecution[]> {
    return await this.dbManager.getJobExecutions(jobId, limit);
  }

  async getRecentExecutions(limit = 100): Promise<CronExecution[]> {
    return await this.dbManager.getRecentExecutions(limit);
  }

  async getJobStats(jobId: string): Promise<CronJobStats> {
    return await this.dbManager.getJobStats(jobId);
  }

  async getDashboardMetrics(): Promise<CronDashboardMetrics> {
    const [jobs, recentExecutions] = await Promise.all([
      this.getAllJobs(),
      this.getRecentExecutions(10)
    ]);

    const activeJobs = jobs.filter(j => j.enabled).length;
    const runningJobs = this.runningExecutions.size;
    const failedJobs = jobs.filter(j => j.status === CronJobStatus.FAILED).length;

    const jobTypeDistribution: Record<CronJobType, number> = {} as any;
    for (const type of Object.values(CronJobType)) {
      jobTypeDistribution[type] = jobs.filter(j => j.jobType === type).length;
    }

    // Calculate execution stats for last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent24hExecutions = await this.dbManager.getExecutionsSince(last24Hours);
    const successful24h = recent24hExecutions.filter(e => e.status === CronJobStatus.COMPLETED);
    
    return {
      totalJobs: jobs.length,
      activeJobs,
      runningJobs,
      failedJobs,
      recentExecutions,
      systemHealth: {
        schedulerUptime: this.getUptime(),
        lastHealthCheck: new Date().toISOString(),
        memoryUsage: process.memoryUsage().rss / 1024 / 1024, // MB
        cpuUsage: process.cpuUsage().system / 1000000 // Convert to seconds
      },
      jobTypeDistribution,
      executionStats: {
        last24Hours: recent24hExecutions.length,
        successRate: recent24hExecutions.length > 0 
          ? successful24h.length / recent24hExecutions.length 
          : 0,
        averageExecutionTime: successful24h.length > 0
          ? successful24h.reduce((sum, e) => sum + (e.duration || 0), 0) / successful24h.length
          : 0
      }
    };
  }

  isRunning(): boolean {
    return this.isActive;
  }

  // Private methods

  private async loadJobsFromDatabase(): Promise<void> {
    try {
      const jobs = await this.dbManager.getAllJobs();
      
      for (const job of jobs) {
        if (job.enabled) {
          await this.scheduleJob(job);
        }
      }
      
      console.log(`📅 Loaded ${jobs.length} jobs from database (${jobs.filter(j => j.enabled).length} active)`);
    } catch (error) {
      console.error('Failed to load jobs from database:', error);
      throw error;
    }
  }

  private async scheduleJob(job: CronJob): Promise<void> {
    try {
      // Validate cron expression
      if (!this.scheduleHelper.validateExpression(job.schedule)) {
        throw new Error(`Invalid cron expression: ${job.schedule}`);
      }

      // Create cron job
      const cronJob = cron.schedule(
        job.schedule,
        async () => {
          await this.executeJob(job, 'schedule');
        }
      );

      // Update next run time using the schedule helper
      const nextRun = this.scheduleHelper.getNextRuns(job.schedule, 1)[0];
      if (nextRun) {
        await this.dbManager.updateJob(job.id, { 
          nextRun: nextRun.toISOString() 
        });
      }

      // Stop the job if it should be disabled initially
      if (!job.enabled) {
        cronJob.stop();
      }

      this.scheduledJobs.set(job.id, cronJob);
      console.log(`📅 Scheduled job: ${job.name} (${job.schedule})`);
    } catch (error) {
      console.error(`Failed to schedule job ${job.name}:`, error);
      throw error;
    }
  }

  private async unscheduleJob(jobId: string): Promise<void> {
    const cronJob = this.scheduledJobs.get(jobId);
    if (cronJob) {
      cronJob.stop();
      this.scheduledJobs.delete(jobId);
    }
  }

  private async executeJob(job: CronJob, triggeredBy: 'schedule' | 'manual' | 'retry'): Promise<CronExecution> {
    // Check if we're at max concurrent jobs
    if (this.runningExecutions.size >= this.config.maxConcurrentJobs) {
      const execution = this.createExecutionRecord(job, triggeredBy, CronJobStatus.SKIPPED);
      execution.error = 'Max concurrent jobs limit reached';
      await this.dbManager.saveExecution(execution);
      return execution;
    }

    const execution = this.createExecutionRecord(job, triggeredBy, CronJobStatus.RUNNING);
    this.runningExecutions.set(execution.id, execution);

    try {
      // Save execution start
      await this.dbManager.saveExecution(execution);
      
      // Update job status and last run
      await this.dbManager.updateJob(job.id, {
        status: CronJobStatus.RUNNING,
        lastRun: execution.startTime
      });

      this.emit('job-started', { job, execution });

      // Execute with timeout
      const result = await Promise.race([
        this.jobExecutor.execute(job),
        this.createTimeoutPromise(job.timeout || this.config.defaultTimeout)
      ]);

      // Update execution with success
      execution.endTime = new Date().toISOString();
      execution.duration = Date.now() - new Date(execution.startTime).getTime();
      execution.status = CronJobStatus.COMPLETED;
      execution.result = result;

      // Reset retry count on success
      await this.dbManager.updateJob(job.id, {
        status: CronJobStatus.COMPLETED,
        runCount: job.runCount + 1,
        failureCount: 0 // Reset on success
      });

    } catch (error: any) {
      // Handle execution failure
      execution.endTime = new Date().toISOString();
      execution.duration = Date.now() - new Date(execution.startTime).getTime();
      execution.error = error.message || 'Unknown error';
      
      if (error.message === 'TIMEOUT') {
        execution.status = CronJobStatus.TIMEOUT;
      } else {
        execution.status = CronJobStatus.FAILED;
      }

      // Update job failure count
      const newFailureCount = job.failureCount + 1;
      await this.dbManager.updateJob(job.id, {
        status: execution.status,
        runCount: job.runCount + 1,
        failureCount: newFailureCount
      });

      // Check if we should retry
      if (newFailureCount < job.maxRetries && execution.status !== CronJobStatus.TIMEOUT) {
        setTimeout(() => {
          this.executeJob(job, 'retry');
        }, job.retryDelay);
      }

      // Create alert for failures
      await this.createAlert(job, execution, error);
    } finally {
      // Clean up
      this.runningExecutions.delete(execution.id);
      
      // Save final execution state
      await this.dbManager.saveExecution(execution);
      
      this.emit('job-completed', { job, execution });
    }

    return execution;
  }

  private createExecutionRecord(
    job: CronJob, 
    triggeredBy: 'schedule' | 'manual' | 'retry',
    status: CronJobStatus
  ): CronExecution {
    return {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobId: job.id,
      jobName: job.name,
      startTime: new Date().toISOString(),
      status,
      retryCount: triggeredBy === 'retry' ? job.failureCount + 1 : 0,
      triggeredBy,
      logs: [],
      metadata: {}
    };
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    });
  }

  private async createAlert(job: CronJob, execution: CronExecution, error: any): Promise<void> {
    const alert: CronAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobId: job.id,
      jobName: job.name,
      level: execution.status === CronJobStatus.TIMEOUT ? 'warning' : 'error',
      message: `Job ${job.name} ${execution.status}`,
      details: {
        error: error.message,
        duration: execution.duration,
        retryCount: execution.retryCount,
        triggeredBy: execution.triggeredBy
      },
      timestamp: new Date().toISOString(),
      acknowledged: false,
      notificationSent: false
    };

    await this.dbManager.saveAlert(alert);
    await this.notificationManager.sendAlert(alert);
  }

  private validateJob(job: CronJob): void {
    if (!job.name || job.name.trim().length === 0) {
      throw new Error('Job name is required');
    }
    
    if (!job.schedule) {
      throw new Error('Job schedule is required');
    }
    
    if (!this.scheduleHelper.validateExpression(job.schedule)) {
      throw new Error(`Invalid cron expression: ${job.schedule}`);
    }
    
    if (!Object.values(CronJobType).includes(job.jobType)) {
      throw new Error(`Invalid job type: ${job.jobType}`);
    }
    
    // Validate job-specific configuration
    this.jobExecutor.validateConfig(job);
  }

  private setupEventHandlers(): void {
    this.on('job-started', (data) => {
      console.log(`🚀 Job started: ${data.job.name}`);
    });

    this.on('job-completed', (data) => {
      const status = data.execution.status === CronJobStatus.COMPLETED ? '✅' : '❌';
      const duration = data.execution.duration ? `${data.execution.duration}ms` : 'unknown';
      console.log(`${status} Job completed: ${data.job.name} (${duration})`);
    });

    this.on('job-failed', (data) => {
      console.error(`❌ Job failed: ${data.job.name} - ${data.execution.error}`);
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        // Check scheduler health
        const metrics = await this.getDashboardMetrics();
        this.emit('health-check', metrics);
        
        // Check for stuck jobs (running too long)
        await this.checkForStuckJobs();
        
        // Cleanup old execution records
        await this.cleanupOldExecutions();
        
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  private startMetricsCollection(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      try {
        const metrics = await this.getDashboardMetrics();
        this.emit('metrics-updated', metrics);
      } catch (error) {
        console.error('Metrics collection failed:', error);
      }
    }, this.config.metricsUpdateInterval);
  }

  private async checkForStuckJobs(): Promise<void> {
    const maxExecutionTime = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    
    for (const [executionId, execution] of this.runningExecutions) {
      const runTime = now - new Date(execution.startTime).getTime();
      if (runTime > maxExecutionTime) {
        console.warn(`🚨 Stuck job detected: ${execution.jobName} (${runTime}ms)`);
        
        // Mark as failed
        execution.status = CronJobStatus.TIMEOUT;
        execution.endTime = new Date().toISOString();
        execution.duration = runTime;
        execution.error = 'Job exceeded maximum execution time';
        
        await this.dbManager.saveExecution(execution);
        this.runningExecutions.delete(executionId);
        
        this.emit('job-stuck', { execution });
      }
    }
  }

  private async cleanupOldExecutions(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days
      
      await this.dbManager.cleanupOldExecutions(cutoffDate.toISOString());
    } catch (error) {
      console.error('Failed to cleanup old executions:', error);
    }
  }

  private async waitForRunningExecutions(timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.runningExecutions.size === 0 || Date.now() - startTime >= timeout) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  private getUptime(): number {
    return process.uptime() * 1000; // Convert to milliseconds
  }
}

// Cron schedule helper implementation
class CronScheduleHelperImpl implements CronScheduleHelper {
  validateExpression(expression: string): boolean {
    return cron.validate(expression);
  }

  getNextRuns(expression: string, count: number): Date[] {
    try {
      // For node-cron, we need to manually calculate next execution times
      // This is a simplified implementation that works for basic cron expressions
      if (!cron.validate(expression)) {
        return [];
      }

      const dates: Date[] = [];
      let currentDate = new Date();
      
      // Add a small buffer to ensure we get future dates
      currentDate.setSeconds(currentDate.getSeconds() + 1);
      
      for (let i = 0; i < count && i < 100; i++) { // Limit to prevent infinite loops
        const nextDate = this.calculateNextExecutionTime(expression, currentDate);
        if (nextDate) {
          dates.push(nextDate);
          currentDate = new Date(nextDate.getTime() + 60000); // Add 1 minute buffer
        } else {
          break;
        }
      }
      
      return dates;
    } catch {
      return [];
    }
  }

  private calculateNextExecutionTime(expression: string, fromDate: Date): Date | null {
    try {
      // Parse cron expression: minute hour day-of-month month day-of-week
      const parts = expression.split(' ');
      if (parts.length !== 5) {
        return null;
      }

      const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;
      
      // Start from the next minute to avoid immediate execution
      let nextDate = new Date(fromDate);
      nextDate.setSeconds(0);
      nextDate.setMilliseconds(0);
      nextDate.setMinutes(nextDate.getMinutes() + 1);

      // Simple implementation for basic patterns
      // This handles common cases but not all cron complexities
      
      // Check for every minute pattern
      if (expression === '* * * * *') {
        return nextDate;
      }
      
      // Check for minute interval patterns (*/n)
      if (minutePart.startsWith('*/') && hourPart === '*') {
        const interval = parseInt(minutePart.substring(2));
        if (!isNaN(interval) && interval > 0 && interval < 60) {
          // Find next minute that's divisible by interval
          const currentMinute = nextDate.getMinutes();
          
          // Calculate the next valid minute based on the interval
          let nextMinute = Math.ceil(currentMinute / interval) * interval;
          
          if (nextMinute >= 60) {
            // Move to the next hour and start from 0 (which is always valid for intervals)
            nextDate.setHours(nextDate.getHours() + 1);
            nextMinute = 0;
          }
          
          nextDate.setMinutes(nextMinute);
          nextDate.setSeconds(0);
          nextDate.setMilliseconds(0);
          return nextDate;
        }
      }
      
      // Check for hourly patterns
      if (minutePart !== '*' && !minutePart.startsWith('*/') && hourPart === '*') {
        const targetMinute = parseInt(minutePart);
        if (nextDate.getMinutes() > targetMinute) {
          nextDate.setHours(nextDate.getHours() + 1);
        }
        nextDate.setMinutes(targetMinute);
        return nextDate;
      }
      
      // Check for daily patterns
      if (minutePart !== '*' && hourPart !== '*' && dayPart === '*') {
        const targetMinute = parseInt(minutePart);
        const targetHour = parseInt(hourPart);
        
        if (nextDate.getHours() > targetHour || 
            (nextDate.getHours() === targetHour && nextDate.getMinutes() > targetMinute)) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        nextDate.setHours(targetHour);
        nextDate.setMinutes(targetMinute);
        return nextDate;
      }

      // For more complex patterns, return a reasonable approximation
      // In a production system, you'd want to use a proper cron parser library
      if (minutePart !== '*') {
        nextDate.setMinutes(parseInt(minutePart));
      }
      if (hourPart !== '*') {
        nextDate.setHours(parseInt(hourPart));
      }
      
      return nextDate;
    } catch {
      return null;
    }
  }

  describeSchedule(expression: string): string {
    const parts = expression.split(' ');
    if (parts.length !== 5) {
      return 'Invalid cron expression';
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Simple descriptions for common patterns
    if (expression === '* * * * *') return 'Every minute';
    if (expression === '0 * * * *') return 'Every hour';
    if (expression === '0 0 * * *') return 'Every day at midnight';
    if (expression === '0 0 * * 0') return 'Every Sunday at midnight';
    if (expression === '0 0 1 * *') return 'First day of every month at midnight';
    
    return `At ${minute} ${hour} on day ${dayOfMonth} of month ${month}, day ${dayOfWeek} of week`;
  }

  generateExpression(options: {
    type: 'interval' | 'daily' | 'weekly' | 'monthly';
    value: number | string;
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  }): string {
    const { type, value, time = '00:00', dayOfWeek = 0, dayOfMonth = 1 } = options;
    const [hour, minute] = time.split(':').map(Number);

    switch (type) {
      case 'interval':
        return `*/${value} * * * *`; // Every N minutes
      case 'daily':
        return `${minute} ${hour} * * *`; // Daily at specific time
      case 'weekly':
        return `${minute} ${hour} * * ${dayOfWeek}`; // Weekly on specific day
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth} * *`; // Monthly on specific day
      default:
        throw new Error(`Unsupported schedule type: ${type}`);
    }
  }
}