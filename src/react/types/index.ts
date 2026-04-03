// API Response Types
export interface Project {
  id: string
  key: string
  name: string
  description: string
  lead: string
  type: string
  codeGraphPath: string | null
  createdAt: string
  updatedAt: string
  agentConfig?: {
    claudeMdPath: string
    agentMdPath: string
    skillsDir: string
    agentsDir: string
    workflowsDir: string
  }
}

export interface Agent {
  id: string
  name: string
  description: string
  primaryRole: string
  projectId: string | null // Agents are independent of projects
  createdAt: string
  updatedAt: string
  capabilities: {
    reasoning: number
    creativity: number
    technical: number
    communication: number
  }
}

export interface Spec {
  id: string
  title: string
  description: string
  type?: 'feature' | 'spec' | 'task'
  status: 'active' | 'pending' | 'completed' | 'cancelled' | 'draft'
  priority: 'low' | 'medium' | 'high' | 'critical'
  parentId?: string | null
  projectId: string
  createdAt: string
  updatedAt: string
  tags: string[]
  assignedAgent?: string
  linkedClasses?: string[]
  linkedMethods?: string[]
  linkedTests?: string[]
  comments?: any[]
}

export interface Workflow {
  id: string
  title: string
  description: string
  status: 'active' | 'draft' | 'completed' | 'paused'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  projectId: string | null // Workflows are independent of projects
  createdAt: string
  updatedAt: string
}

export interface MemoryNote {
  id: string
  title: string
  content: string
  tags: string[]
  projectId: string
  createdAt: string
  updatedAt: string
}

export interface MemoryCheckpoint {
  id: string
  title: string
  description: string
  type: string
  size: string
  projectId: string
  createdAt: string
  updatedAt: string
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'metrics' | 'metrics_update' | 'notification' | 'error'
  data: any
  timestamp: string
}

export interface MetricsData {
  totalRequests: number
  totalCost: number
  totalSavings: number
  avgResponseTime: number
  successRate: number
  activeConnections: number
  memoryUsage: number
  cpuUsage: number
}

// UI State Types
export interface LoadingState {
  [key: string]: boolean
}

export interface ErrorState {
  [key: string]: string | null
}

// Theme Types
export type Theme = 'light' | 'dark'
export type Style = 'flat' | 'glass'

export interface ThemeConfig {
  theme: Theme
  style: Style
}

// API Client Types
export interface ApiResponse<T> {
  data: T
  success: boolean
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'email' | 'password'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    custom?: (value: any) => string | undefined
  }
}

export interface FormState {
  values: Record<string, any>
  errors: Record<string, string>
  isSubmitting: boolean
  isDirty: boolean
  isValid: boolean
}

// Cron Job Types
export interface CronJob {
  id: string
  name: string
  description: string
  schedule: string // Cron expression
  type: CronJobType
  status: CronJobStatus
  enabled: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  updatedAt: string
  lastRun?: string
  nextRun?: string
  runCount: number
  failureCount: number
  tags: string[]
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
  id: string
  jobId: string
  jobName: string
  startTime: string
  endTime?: string
  duration?: number
  status: CronJobStatus
  triggeredBy: 'schedule' | 'manual' | 'retry'
  hasAlerts: boolean
}

export interface CronDashboardMetrics {
  totalJobs: number
  activeJobs: number
  runningJobs: number
  failedJobs: number
  systemHealth: {
    schedulerUptime: number
    lastHealthCheck: string
    memoryUsage: number
    cpuUsage: number
  }
  executionStats: {
    last24Hours: number
    successRate: number
    averageExecutionTime: number
  }
}

export interface JobTemplate {
  name: string
  description: string
  jobType: CronJobType
  defaultSchedule: string
  category: 'maintenance' | 'monitoring' | 'optimization' | 'analytics'
  tags: string[]
  configExample?: any
}

// Buddy System Types
export type BuddyPersonalityTrait =
  | 'helpful' | 'sarcastic' | 'encouraging' | 'technical'
  | 'casual' | 'formal' | 'humorous' | 'philosophical'

export type BuddyExpertiseArea =
  | 'frontend' | 'backend' | 'devops' | 'data-science'
  | 'mobile' | 'security' | 'testing' | 'architecture' | 'general'

export type BuddyBehaviorMode =
  | 'proactive-suggestions' | 'reactive-only'
  | 'pair-programming' | 'code-review'

export type BuddyCommunicationStyle =
  | 'verbose' | 'concise' | 'socratic'

export interface BuddyConfig {
  name: string
  avatar: string
  personalityTraits: BuddyPersonalityTrait[]
  expertiseAreas: BuddyExpertiseArea[]
  behaviorMode: BuddyBehaviorMode
  communicationStyle: BuddyCommunicationStyle
  customSystemPrompt?: string
  contextWindowSize?: number
}

export interface Buddy {
  id: string
  config: BuddyConfig
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastInteraction?: string
  conversationCount: number
  projectId?: string | null
}

export interface BuddyMessage {
  id: string
  buddyId: string
  role: 'user' | 'buddy'
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}