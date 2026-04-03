// Cron Database Manager for SQLite persistence
// FEATURE: Database persistence for cron jobs and execution history

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { mkdir } from 'fs/promises';
import {
  CronJob,
  CronExecution,
  CronJobStats,
  CronJobType,
  CronJobStatus,
  CronAlert
} from '../core/cron-types.js';

export class CronDatabaseManager {
  private db?: sqlite3.Database;
  private dbPath: string;
  
  constructor(dbPath = './data/cron-jobs.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dir = path.dirname(this.dbPath);
      await mkdir(dir, { recursive: true });

      // Initialize SQLite database
      this.db = new sqlite3.Database(this.dbPath);
      
      // Create tables
      await this.createTables();
      
      console.log('✅ Cron database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize cron database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      const closeAsync = promisify(this.db.close.bind(this.db));
      await closeAsync();
      this.db = undefined;
    }
  }

  // Job CRUD Operations

  async createJob(job: CronJob): Promise<CronJob> {
    this.ensureInitialized();
    
    const query = `
      INSERT INTO cron_jobs (
        id, name, description, schedule, job_type, config, status, priority,
        enabled, created_at, updated_at, last_run, next_run, run_count,
        failure_count, max_retries, retry_delay, timeout, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    
    await runAsync(query, [
      job.id,
      job.name,
      job.description,
      job.schedule,
      job.jobType,
      JSON.stringify(job.config),
      job.status,
      job.priority,
      job.enabled ? 1 : 0,
      job.createdAt,
      job.updatedAt,
      job.lastRun || null,
      job.nextRun || null,
      job.runCount,
      job.failureCount,
      job.maxRetries,
      job.retryDelay,
      job.timeout,
      JSON.stringify(job.tags),
      JSON.stringify(job.metadata)
    ]);

    return job;
  }

  async getJob(id: string): Promise<CronJob | null> {
    this.ensureInitialized();
    
    const query = 'SELECT * FROM cron_jobs WHERE id = ?';
    const getAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.get(query, params, (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    
    const row = await getAsync(query, [id]) as any;
    
    return row ? this.mapRowToJob(row) : null;
  }

  async getAllJobs(): Promise<CronJob[]> {
    this.ensureInitialized();
    
    const query = 'SELECT * FROM cron_jobs ORDER BY created_at DESC';
    const allAsync = (query: string, params: any[] = []) => {
      return new Promise<any[]>((resolve, reject) => {
        this.db!.all(query, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };
    
    const rows = await allAsync(query) as any[];
    
    return rows.map(row => this.mapRowToJob(row));
  }

  async getJobsByType(jobType: CronJobType): Promise<CronJob[]> {
    this.ensureInitialized();
    
    const query = 'SELECT * FROM cron_jobs WHERE job_type = ? ORDER BY created_at DESC';
    const allAsync = (query: string, params: any[] = []) => {
      return new Promise<any[]>((resolve, reject) => {
        this.db!.all(query, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };
    
    const rows = await allAsync(query, [jobType]) as any[];
    
    return rows.map(row => this.mapRowToJob(row));
  }

  async updateJob(id: string, updates: Partial<CronJob>): Promise<boolean> {
    this.ensureInitialized();
    
    const updateFields: string[] = [];
    const values: any[] = [];
    
    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      switch (key) {
        case 'name':
        case 'description':
        case 'schedule':
        case 'status':
        case 'priority':
        case 'lastRun':
        case 'nextRun':
        case 'runCount':
        case 'failureCount':
        case 'maxRetries':
        case 'retryDelay':
        case 'timeout':
          updateFields.push(`${this.camelToSnake(key)} = ?`);
          values.push(value);
          break;
        case 'jobType':
          updateFields.push('job_type = ?');
          values.push(value);
          break;
        case 'enabled':
          updateFields.push('enabled = ?');
          values.push(value ? 1 : 0);
          break;
        case 'config':
        case 'tags':
        case 'metadata':
          updateFields.push(`${this.camelToSnake(key)} = ?`);
          values.push(JSON.stringify(value));
          break;
        case 'updatedAt':
          updateFields.push('updated_at = ?');
          values.push(value);
          break;
      }
    });
    
    if (updateFields.length === 0) {
      return false;
    }
    
    // Always update the timestamp
    if (!updates.updatedAt) {
      updateFields.push('updated_at = ?');
      values.push(new Date().toISOString());
    }
    
    const query = `UPDATE cron_jobs SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(id);
    
    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    const result = await runAsync(query, values) as any;
    
    return result.changes > 0;
  }

  async deleteJob(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    
    // Delete job executions first (foreign key constraint)
    await runAsync('DELETE FROM cron_executions WHERE job_id = ?', [id]);
    
    // Delete the job
    const result = await runAsync('DELETE FROM cron_jobs WHERE id = ?', [id]) as any;
    
    return result.changes > 0;
  }

  // Execution Operations

  async saveExecution(execution: CronExecution): Promise<CronExecution> {
    this.ensureInitialized();
    
    const query = `
      INSERT OR REPLACE INTO cron_executions (
        id, job_id, job_name, start_time, end_time, duration, status,
        result, error, retry_count, triggered_by, logs, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    
    await runAsync(query, [
      execution.id,
      execution.jobId,
      execution.jobName,
      execution.startTime,
      execution.endTime || null,
      execution.duration || null,
      execution.status,
      execution.result ? JSON.stringify(execution.result) : null,
      execution.error || null,
      execution.retryCount,
      execution.triggeredBy,
      JSON.stringify(execution.logs),
      JSON.stringify(execution.metadata)
    ]);

    return execution;
  }

  async getJobExecutions(jobId: string, limit = 100): Promise<CronExecution[]> {
    this.ensureInitialized();
    
    const query = `
      SELECT * FROM cron_executions 
      WHERE job_id = ? 
      ORDER BY start_time DESC 
      LIMIT ?
    `;
    
    const allAsync = (query: string, params: any[] = []) => {
      return new Promise<any[]>((resolve, reject) => {
        this.db!.all(query, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };
    const rows = await allAsync(query, [jobId, limit]) as any[];
    
    return rows.map(row => this.mapRowToExecution(row));
  }

  async getRecentExecutions(limit = 100): Promise<CronExecution[]> {
    this.ensureInitialized();
    
    const query = `
      SELECT * FROM cron_executions 
      ORDER BY start_time DESC 
      LIMIT ?
    `;
    
    const allAsync = (query: string, params: any[] = []) => {
      return new Promise<any[]>((resolve, reject) => {
        this.db!.all(query, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };
    const rows = await allAsync(query, [limit]) as any[];
    
    return rows.map(row => this.mapRowToExecution(row));
  }

  async getExecutionsSince(since: string): Promise<CronExecution[]> {
    this.ensureInitialized();
    
    const query = `
      SELECT * FROM cron_executions 
      WHERE start_time >= ?
      ORDER BY start_time DESC
    `;
    
    const allAsync = (query: string, params: any[] = []) => {
      return new Promise<any[]>((resolve, reject) => {
        this.db!.all(query, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };
    const rows = await allAsync(query, [since]) as any[];
    
    return rows.map(row => this.mapRowToExecution(row));
  }

  async getJobStats(jobId: string): Promise<CronJobStats> {
    this.ensureInitialized();
    
    const query = `
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN status = 'failed' OR status = 'timeout' THEN 1 ELSE 0 END) as failed_executions,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avg_execution_time,
        MAX(CASE WHEN status = 'completed' THEN start_time ELSE NULL END) as last_successful_run,
        MAX(CASE WHEN status = 'failed' OR status = 'timeout' THEN start_time ELSE NULL END) as last_failed_run
      FROM cron_executions 
      WHERE job_id = ?
    `;
    
    const getAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.get(query, params, (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    const stats = await getAsync(query, [jobId]) as any;
    
    // Get job info for next run
    const job = await this.getJob(jobId);
    
    // Calculate consecutive failures
    const recentQuery = `
      SELECT status FROM cron_executions 
      WHERE job_id = ? AND status IN ('failed', 'timeout', 'completed')
      ORDER BY start_time DESC 
      LIMIT 10
    `;
    
    const recentRows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(recentQuery, [jobId], (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    let consecutiveFailures = 0;
    for (const row of recentRows) {
      if (row.status === 'failed' || row.status === 'timeout') {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    
    const successRate = stats.total_executions > 0 
      ? stats.successful_executions / stats.total_executions 
      : 0;
    
    const uptimePercentage = successRate * 100;
    
    return {
      jobId,
      totalExecutions: stats.total_executions || 0,
      successfulExecutions: stats.successful_executions || 0,
      failedExecutions: stats.failed_executions || 0,
      averageExecutionTime: stats.avg_execution_time || 0,
      lastSuccessfulRun: stats.last_successful_run || undefined,
      lastFailedRun: stats.last_failed_run || undefined,
      successRate,
      nextScheduledRun: job?.nextRun,
      consecutiveFailures,
      uptimePercentage
    };
  }

  // Alert Operations

  async saveAlert(alert: CronAlert): Promise<CronAlert> {
    this.ensureInitialized();
    
    const query = `
      INSERT INTO cron_alerts (
        id, job_id, job_name, level, message, details, timestamp,
        acknowledged, resolved_at, notification_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    
    await runAsync(query, [
      alert.id,
      alert.jobId,
      alert.jobName,
      alert.level,
      alert.message,
      alert.details ? JSON.stringify(alert.details) : null,
      alert.timestamp,
      alert.acknowledged ? 1 : 0,
      alert.resolvedAt || null,
      alert.notificationSent ? 1 : 0
    ]);

    return alert;
  }

  async getUnacknowledgedAlerts(): Promise<CronAlert[]> {
    this.ensureInitialized();
    
    const query = `
      SELECT * FROM cron_alerts 
      WHERE acknowledged = 0 
      ORDER BY timestamp DESC
    `;
    
    const allAsync = (query: string, params: any[] = []) => {
      return new Promise<any[]>((resolve, reject) => {
        this.db!.all(query, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };
    const rows = await allAsync(query) as any[];
    
    return rows.map(row => this.mapRowToAlert(row));
  }

  // Cleanup Operations

  async cleanupOldExecutions(cutoffDate: string): Promise<number> {
    this.ensureInitialized();
    
    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    const result = await runAsync(
      'DELETE FROM cron_executions WHERE start_time < ?',
      [cutoffDate]
    ) as any;
    
    return result.changes || 0;
  }

  async cleanupOldAlerts(cutoffDate: string): Promise<number> {
    this.ensureInitialized();
    
    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    const result = await runAsync(
      'DELETE FROM cron_alerts WHERE timestamp < ? AND acknowledged = 1',
      [cutoffDate]
    ) as any;
    
    return result.changes || 0;
  }

  // Private helper methods

  private async createTables(): Promise<void> {
    this.ensureInitialized();
    
    const runAsync = (query: string, params: any[] = []) => {
      return new Promise<any>((resolve, reject) => {
        this.db!.run(query, params, function(err: any) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };

    // Cron jobs table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT NOT NULL,
        job_type TEXT NOT NULL,
        config TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_run TEXT,
        next_run TEXT,
        run_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        retry_delay INTEGER NOT NULL DEFAULT 5000,
        timeout INTEGER NOT NULL DEFAULT 300000,
        tags TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);

    // Cron executions table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS cron_executions (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        status TEXT NOT NULL,
        result TEXT,
        error TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        triggered_by TEXT NOT NULL,
        logs TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (job_id) REFERENCES cron_jobs (id) ON DELETE CASCADE
      )
    `);

    // Cron alerts table
    await runAsync(`
      CREATE TABLE IF NOT EXISTS cron_alerts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_name TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        resolved_at TEXT,
        notification_sent INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (job_id) REFERENCES cron_jobs (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_jobs_type ON cron_jobs (job_type)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_jobs_status ON cron_jobs (status)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs (enabled)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_executions_job_id ON cron_executions (job_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_executions_start_time ON cron_executions (start_time)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_executions_status ON cron_executions (status)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_alerts_job_id ON cron_alerts (job_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_cron_alerts_acknowledged ON cron_alerts (acknowledged)');
  }

  private mapRowToJob(row: any): CronJob {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      schedule: row.schedule,
      jobType: row.job_type as CronJobType,
      config: JSON.parse(row.config),
      status: row.status as CronJobStatus,
      priority: row.priority,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastRun: row.last_run,
      nextRun: row.next_run,
      runCount: row.run_count,
      failureCount: row.failure_count,
      maxRetries: row.max_retries,
      retryDelay: row.retry_delay,
      timeout: row.timeout,
      tags: JSON.parse(row.tags),
      metadata: JSON.parse(row.metadata)
    };
  }

  private mapRowToExecution(row: any): CronExecution {
    return {
      id: row.id,
      jobId: row.job_id,
      jobName: row.job_name,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      status: row.status as CronJobStatus,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      retryCount: row.retry_count,
      triggeredBy: row.triggered_by,
      logs: JSON.parse(row.logs),
      metadata: JSON.parse(row.metadata)
    };
  }

  private mapRowToAlert(row: any): CronAlert {
    return {
      id: row.id,
      jobId: row.job_id,
      jobName: row.job_name,
      level: row.level,
      message: row.message,
      details: row.details ? JSON.parse(row.details) : undefined,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged === 1,
      resolvedAt: row.resolved_at,
      notificationSent: row.notification_sent === 1
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }
}