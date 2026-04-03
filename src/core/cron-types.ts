// Cron system types for periodic task management
// FEATURE: Background task scheduling and monitoring

export interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron expression (e.g., "0 */5 * * *")
  jobType: CronJobType;
  config: CronJobConfig;
  status: CronJobStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  failureCount: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
  tags: string[];
  metadata: Record<string, any>;
}

export interface CronJobConfig {
  // Health Check Jobs
  healthCheck?: {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    expectedStatus: number;
    timeout: number;
    headers?: Record<string, string>;
    body?: string;
  };

  // System Monitoring Jobs
  systemMonitoring?: {
    metrics: ('cpu' | 'memory' | 'disk' | 'network')[];
    thresholds: {
      cpu: number; // percentage
      memory: number; // percentage
      disk: number; // percentage
      network: number; // bytes per second
    };
    alertEndpoint?: string;
  };

  // Database Maintenance Jobs
  databaseMaintenance?: {
    operation: 'vacuum' | 'analyze' | 'cleanup' | 'backup';
    targetTables?: string[];
    cleanupOlderThan?: number; // days
    backupPath?: string;
  };

  // Cost Tracking Jobs
  costTracking?: {
    providers: string[];
    timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
    alertThreshold?: number; // cost amount
    reportFormat: 'json' | 'csv' | 'email';
  };

  // Model Health Jobs
  modelHealth?: {
    providers: string[];
    testPrompt: string;
    expectedKeywords: string[];
    responseTime: number; // max acceptable response time in ms
    qualityThreshold: number; // minimum quality score (0-1)
  };

  // Resource Cleanup Jobs
  resourceCleanup?: {
    targetDirectories: string[];
    filePatterns: string[];
    olderThan: number; // days
    sizeLimit?: number; // bytes
    preserveCount?: number; // number of recent files to keep
  };

  // Cache Management Jobs
  cacheManagement?: {
    cacheTypes: ('embedding' | 'context' | 'result' | 'docs')[];
    operation: 'clear' | 'optimize' | 'validate';
    sizeThreshold?: number; // MB
    ageThreshold?: number; // hours
  };

  // Agent Performance Jobs
  agentPerformance?: {
    agentIds: string[];
    metrics: ('response_time' | 'success_rate' | 'cost_efficiency' | 'quality')[];
    alertThresholds: Record<string, number>;
  };

  // Custom Shell Command Jobs
  shellCommand?: {
    command: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
    expectedExitCode: number;
    captureOutput: boolean;
  };

  // API Endpoint Monitoring Jobs
  apiMonitoring?: {
    endpoints: {
      url: string;
      method: string;
      expectedResponse?: any;
      timeout: number;
    }[];
  };

  // Log Analysis Jobs
  logAnalysis?: {
    logFiles: string[];
    patterns: {
      error: string[];
      warning: string[];
      anomaly: string[];
    };
    alertThreshold: number; // number of matches to trigger alert
  };
}

export enum CronJobType {
  HEALTH_CHECK = 'health_check',
  SYSTEM_MONITORING = 'system_monitoring',
  DATABASE_MAINTENANCE = 'database_maintenance',
  COST_TRACKING = 'cost_tracking',
  MODEL_HEALTH = 'model_health',
  RESOURCE_CLEANUP = 'resource_cleanup',
  CACHE_MANAGEMENT = 'cache_management',
  AGENT_PERFORMANCE = 'agent_performance',
  SHELL_COMMAND = 'shell_command',
  API_MONITORING = 'api_monitoring',
  LOG_ANALYSIS = 'log_analysis',
  CUSTOM = 'custom'
}

export enum CronJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying',
  DISABLED = 'disabled'
}

export interface CronExecution {
  id: string;
  jobId: string;
  jobName: string;
  startTime: string;
  endTime?: string;
  duration?: number; // milliseconds
  status: CronJobStatus;
  result?: CronExecutionResult;
  error?: string;
  retryCount: number;
  triggeredBy: 'schedule' | 'manual' | 'retry';
  logs: string[];
  metadata: Record<string, any>;
}

export interface CronExecutionResult {
  success: boolean;
  data?: any;
  metrics?: {
    responseTime?: number;
    bytesProcessed?: number;
    itemsProcessed?: number;
    errorsFound?: number;
    warningsFound?: number;
  };
  alerts?: {
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    details?: any;
  }[];
  recommendations?: string[];
}

export interface CronScheduler {
  start(): Promise<void>;
  stop(): Promise<void>;
  addJob(job: CronJob): Promise<string>;
  updateJob(id: string, updates: Partial<CronJob>): Promise<boolean>;
  removeJob(id: string): Promise<boolean>;
  enableJob(id: string): Promise<boolean>;
  disableJob(id: string): Promise<boolean>;
  runJobNow(id: string): Promise<CronExecution>;
  getJob(id: string): Promise<CronJob | null>;
  getAllJobs(): Promise<CronJob[]>;
  getJobsByType(type: CronJobType): Promise<CronJob[]>;
  getJobExecutions(jobId: string, limit?: number): Promise<CronExecution[]>;
  getRecentExecutions(limit?: number): Promise<CronExecution[]>;
  getJobStats(jobId: string): Promise<CronJobStats>;
  isRunning(): boolean;
}

export interface CronJobStats {
  jobId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastSuccessfulRun?: string;
  lastFailedRun?: string;
  successRate: number;
  nextScheduledRun?: string;
  consecutiveFailures: number;
  uptimePercentage: number;
}

export interface CronDashboardMetrics {
  totalJobs: number;
  activeJobs: number;
  runningJobs: number;
  failedJobs: number;
  recentExecutions: CronExecution[];
  systemHealth: {
    schedulerUptime: number;
    lastHealthCheck: string;
    memoryUsage: number;
    cpuUsage: number;
  };
  jobTypeDistribution: Record<CronJobType, number>;
  executionStats: {
    last24Hours: number;
    successRate: number;
    averageExecutionTime: number;
  };
}

export interface CronJobTemplate {
  name: string;
  description: string;
  jobType: CronJobType;
  defaultSchedule: string;
  defaultConfig: Partial<CronJobConfig>;
  tags: string[];
  category: 'maintenance' | 'monitoring' | 'optimization' | 'analytics';
}

export interface CronAlert {
  id: string;
  jobId: string;
  jobName: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
  notificationSent: boolean;
}

export interface CronNotificationConfig {
  enabled: boolean;
  channels: ('console' | 'email' | 'webhook' | 'slack')[];
  email?: {
    recipients: string[];
    smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
    retries: number;
  };
  slack?: {
    webhookUrl: string;
    channel: string;
    username: string;
  };
  filters: {
    minLevel: 'info' | 'warning' | 'error' | 'critical';
    jobTypes?: CronJobType[];
    keywords?: string[];
  };
}

// Cron expression helper types
export interface CronScheduleHelper {
  validateExpression(expression: string): boolean;
  getNextRuns(expression: string, count: number): Date[];
  describeSchedule(expression: string): string;
  generateExpression(options: {
    type: 'interval' | 'daily' | 'weekly' | 'monthly';
    value: number | string;
    time?: string; // HH:mm format
    dayOfWeek?: number; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
  }): string;
}

// Pre-defined cron job templates
export const CRON_JOB_TEMPLATES: CronJobTemplate[] = [
  {
    name: 'System Health Check',
    description: 'Monitor system resources and API endpoints',
    jobType: CronJobType.HEALTH_CHECK,
    defaultSchedule: '*/5 * * * *', // Every 5 minutes
    defaultConfig: {
      healthCheck: {
        endpoint: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000
      }
    },
    tags: ['health', 'monitoring'],
    category: 'monitoring'
  },
  {
    name: 'Database Cleanup',
    description: 'Clean up old execution logs and optimize database',
    jobType: CronJobType.DATABASE_MAINTENANCE,
    defaultSchedule: '0 2 * * 0', // Every Sunday at 2 AM
    defaultConfig: {
      databaseMaintenance: {
        operation: 'cleanup',
        cleanupOlderThan: 30
      }
    },
    tags: ['database', 'cleanup'],
    category: 'maintenance'
  },
  {
    name: 'Cost Tracking Report',
    description: 'Generate daily cost tracking reports',
    jobType: CronJobType.COST_TRACKING,
    defaultSchedule: '0 9 * * *', // Every day at 9 AM
    defaultConfig: {
      costTracking: {
        providers: ['openai', 'anthropic', 'local'],
        timeframe: 'daily',
        reportFormat: 'json'
      }
    },
    tags: ['cost', 'reporting'],
    category: 'analytics'
  },
  {
    name: 'Model Health Check',
    description: 'Test local and remote models for availability and performance',
    jobType: CronJobType.MODEL_HEALTH,
    defaultSchedule: '*/15 * * * *', // Every 15 minutes
    defaultConfig: {
      modelHealth: {
        providers: ['ollama', 'lmstudio', 'openai'],
        testPrompt: 'Hello, this is a health check.',
        expectedKeywords: ['health', 'check', 'hello'],
        responseTime: 10000,
        qualityThreshold: 0.8
      }
    },
    tags: ['model', 'health', 'performance'],
    category: 'monitoring'
  },
  {
    name: 'Cache Optimization',
    description: 'Optimize and clean up various caches',
    jobType: CronJobType.CACHE_MANAGEMENT,
    defaultSchedule: '0 3 * * *', // Every day at 3 AM
    defaultConfig: {
      cacheManagement: {
        cacheTypes: ['embedding', 'context', 'result'],
        operation: 'optimize',
        sizeThreshold: 1000, // 1GB
        ageThreshold: 168 // 7 days
      }
    },
    tags: ['cache', 'optimization'],
    category: 'optimization'
  }
];