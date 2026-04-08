import type {
  Project,
  Agent,
  Spec,
  Workflow,
  MemoryNote,
  MemoryCheckpoint,
  ApiResponse,
  PaginatedResponse,
  Buddy,
  BuddyMessage
} from '../types'

/** Same-origin `/api` when using Vite proxy; override with `VITE_API_BASE` for non-proxied hosts. */
function defaultApiBaseUrl(): string {
  const v = import.meta.env?.VITE_API_BASE
  if (typeof v === 'string' && v.trim() !== '') {
    return v.replace(/\/+$/, '')
  }
  return '/api'
}

class ApiClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(baseUrl = defaultApiBaseUrl()) {
    this.baseUrl = baseUrl
    this.headers = {
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      headers: { ...this.headers, ...options.headers },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed: ${url}`, error)
      throw error
    }
  }

  // Filesystem API
  async browseDirectories(directoryPath?: string): Promise<{
    current: string
    parent: string | null
    directories: Array<{ name: string; path: string }>
  }> {
    return this.request('/filesystem/browse', {
      method: 'POST',
      body: JSON.stringify({ path: directoryPath }),
    })
  }

  // Projects API
  async scanProjectPath(projectPath: string): Promise<{
    path: string
    detected: {
      name: string
      description: string
      type: string
      lead: string
      codeGraphPath: string | null
      agentConfig: Record<string, string>
    }
  }> {
    return this.request('/projects/scan', {
      method: 'POST',
      body: JSON.stringify({ path: projectPath }),
    })
  }

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects')
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/projects/${id}`)
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    })
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    return this.request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    })
  }

  async deleteProject(id: string): Promise<void> {
    return this.request<void>(`/projects/${id}`, {
      method: 'DELETE',
    })
  }

  // Agents API
  async getAgents(projectId?: string): Promise<Agent[]> {
    const endpoint = projectId ? `/projects/${projectId}/agents` : '/agents'
    return this.request<Agent[]>(endpoint)
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`)
  }

  async createAgent(agent: Partial<Agent>): Promise<Agent> {
    const endpoint = agent.projectId 
      ? `/projects/${agent.projectId}/agents` 
      : '/agents'
    
    return this.request<Agent>(endpoint, {
      method: 'POST',
      body: JSON.stringify(agent),
    })
  }

  async updateAgent(id: string, agent: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agent),
    })
  }

  async deleteAgent(id: string): Promise<void> {
    return this.request<void>(`/agents/${id}`, {
      method: 'DELETE',
    })
  }

  // Specs API
  async getSpecs(projectId?: string): Promise<Spec[]> {
    const endpoint = projectId ? `/projects/${projectId}/specs` : '/specs'
    return this.request<Spec[]>(endpoint)
  }

  async getSpec(id: string): Promise<Spec> {
    return this.request<Spec>(`/specs/${id}`)
  }

  async createSpec(spec: Partial<Spec>): Promise<Spec> {
    const endpoint = spec.projectId 
      ? `/projects/${spec.projectId}/specs` 
      : '/specs'
    
    return this.request<Spec>(endpoint, {
      method: 'POST',
      body: JSON.stringify(spec),
    })
  }

  async updateSpec(id: string, spec: Partial<Spec>): Promise<Spec> {
    return this.request<Spec>(`/specs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(spec),
    })
  }

  async deleteSpec(id: string): Promise<void> {
    return this.request<void>(`/specs/${id}`, {
      method: 'DELETE',
    })
  }

  // Workflows API
  async getWorkflows(projectId?: string): Promise<Workflow[]> {
    const endpoint = projectId ? `/projects/${projectId}/workflows` : '/workflows'
    return this.request<Workflow[]>(endpoint)
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/workflows/${id}`)
  }

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    const endpoint = workflow.projectId 
      ? `/projects/${workflow.projectId}/workflows` 
      : '/workflows'
    
    return this.request<Workflow>(endpoint, {
      method: 'POST',
      body: JSON.stringify(workflow),
    })
  }

  async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
    return this.request<Workflow>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    })
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.request<void>(`/workflows/${id}`, {
      method: 'DELETE',
    })
  }

  // Memory API
  async getMemoryNotes(projectId?: string): Promise<MemoryNote[]> {
    const endpoint = projectId ? `/projects/${projectId}/notes` : '/memory/notes'
    return this.request<MemoryNote[]>(endpoint)
  }

  async getMemoryNote(id: string): Promise<MemoryNote> {
    return this.request<MemoryNote>(`/memory/notes/${id}`)
  }

  async createMemoryNote(note: Partial<MemoryNote>): Promise<MemoryNote> {
    const endpoint = note.projectId 
      ? `/projects/${note.projectId}/notes` 
      : '/memory/notes'
    
    return this.request<MemoryNote>(endpoint, {
      method: 'POST',
      body: JSON.stringify(note),
    })
  }

  async updateMemoryNote(id: string, note: Partial<MemoryNote>): Promise<MemoryNote> {
    return this.request<MemoryNote>(`/memory/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(note),
    })
  }

  async deleteMemoryNote(id: string): Promise<void> {
    return this.request<void>(`/memory/notes/${id}`, {
      method: 'DELETE',
    })
  }

  async getMemoryCheckpoints(projectId?: string): Promise<MemoryCheckpoint[]> {
    const endpoint = projectId ? `/projects/${projectId}/checkpoints` : '/memory/checkpoints'
    return this.request<MemoryCheckpoint[]>(endpoint)
  }

  async createMemoryCheckpoint(checkpoint: Partial<MemoryCheckpoint>): Promise<MemoryCheckpoint> {
    const endpoint = checkpoint.projectId 
      ? `/projects/${checkpoint.projectId}/checkpoints` 
      : '/memory/checkpoints'
    
    return this.request<MemoryCheckpoint>(endpoint, {
      method: 'POST',
      body: JSON.stringify(checkpoint),
    })
  }

  // Buddies API
  async getBuddies(projectId?: string): Promise<Buddy[]> {
    const params = projectId ? `?projectId=${projectId}` : ''
    return this.request<Buddy[]>(`/buddies${params}`)
  }

  async getBuddy(id: string): Promise<Buddy> {
    return this.request<Buddy>(`/buddies/${id}`)
  }

  async createBuddy(data: Record<string, unknown>): Promise<Buddy> {
    return this.request<Buddy>('/buddies', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateBuddy(id: string, updates: Record<string, unknown>): Promise<Buddy> {
    return this.request<Buddy>(`/buddies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteBuddy(id: string): Promise<void> {
    return this.request<void>(`/buddies/${id}`, { method: 'DELETE' })
  }

  async chatWithBuddy(id: string, message: string): Promise<{ buddy: string; avatar: string; response: string; conversationCount: number }> {
    return this.request(`/buddies/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  }

  async getBuddyMessages(id: string, limit?: number): Promise<BuddyMessage[]> {
    const params = limit ? `?limit=${limit}` : ''
    return this.request<BuddyMessage[]>(`/buddies/${id}/messages${params}`)
  }

  async clearBuddyMessages(id: string): Promise<void> {
    return this.request<void>(`/buddies/${id}/messages`, { method: 'DELETE' })
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health')
  }

  // Metrics
  async getMetrics(): Promise<any> {
    return this.request<any>('/metrics')
  }

  // DevDocs API methods
  async searchDevDocs(query: string, language?: string) {
    return this.request<any>('/devdocs/search', {
      method: 'POST',
      body: JSON.stringify({ query, language }),
    })
  }

  async getDevDocsLanguages() {
    return this.request<string[]>('/devdocs/languages')
  }

  // Setup API methods
  async loadDefaultSkillsAndAgents(options?: {
    projectId?: string
    overwriteExisting?: boolean
    loadAgents?: boolean
    loadSkills?: boolean
    loadSpecs?: boolean
  }) {
    return this.request<{
      success: boolean
      message: string
      baseUrl: string
      projectId: string
    }>('/setup/defaults', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  async getSetupStatus() {
    return this.request<{
      isSetupComplete: boolean
      skillsSetupComplete: boolean
      totalAgents: number
      totalSpecs: number
      defaultAgentsFound: number
      defaultSkillsFound: number
    }>('/setup/status')
  }

  // CodeGraph API
  async getCodeGraphStatus(): Promise<CodeGraphStatus> {
    return this.request<CodeGraphStatus>('/codegraph/status')
  }

  async syncCodeGraph(projectPath?: string): Promise<CodeGraphStatus & { success: boolean; error?: string }> {
    return this.request<CodeGraphStatus & { success: boolean; error?: string }>('/codegraph/sync', {
      method: 'POST',
      body: JSON.stringify(projectPath ? { projectPath } : {}),
    })
  }

  async switchCodeGraphProject(options: { projectId?: string; projectPath?: string }): Promise<CodeGraphStatus & { success: boolean; projectRoot: string }> {
    return this.request('/codegraph/switch', {
      method: 'POST',
      body: JSON.stringify(options),
    })
  }

  async searchCodeGraph(query: string, kind?: string, limit?: number): Promise<CodeGraphSymbol[]> {
    return this.request<CodeGraphSymbol[]>('/codegraph/search', {
      method: 'POST',
      body: JSON.stringify({ query, kind, limit }),
    })
  }

  async getCodeGraphSymbol(id: string): Promise<CodeGraphSymbolDetail> {
    return this.request<CodeGraphSymbolDetail>(`/codegraph/symbol/${encodeURIComponent(id)}`)
  }

  async getCodeGraphCallers(id: string): Promise<CodeGraphRelation[]> {
    return this.request<CodeGraphRelation[]>(`/codegraph/callers/${encodeURIComponent(id)}`)
  }

  async getCodeGraphCallees(id: string): Promise<CodeGraphRelation[]> {
    return this.request<CodeGraphRelation[]>(`/codegraph/callees/${encodeURIComponent(id)}`)
  }

  async getCodeGraphImpact(id: string, depth?: number): Promise<CodeGraphImpact> {
    const params = depth ? `?depth=${depth}` : ''
    return this.request<CodeGraphImpact>(`/codegraph/impact/${encodeURIComponent(id)}${params}`)
  }

  /** `/mcp/*` is not under `/api`; strip trailing `/api` so `/api` becomes same-origin root. */
  private mcpBasePrefix(): string {
    return this.baseUrl.replace(/\/api\/?$/, '')
  }

  // MCP API - these endpoints are served directly at /mcp/* without /api prefix
  async getMCPStatus(): Promise<any> {
    const url = `${this.mcpBasePrefix()}/mcp/status`
    const response = await fetch(url, {
      headers: { ...this.headers },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  async getMCPTools(): Promise<{ tools: any[]; summary: any }> {
    const url = `${this.mcpBasePrefix()}/mcp/tools`
    const response = await fetch(url, {
      headers: { ...this.headers },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  async getMCPResources(): Promise<{ resources: any[]; summary: any }> {
    const url = `${this.mcpBasePrefix()}/mcp/resources`
    const response = await fetch(url, {
      headers: { ...this.headers },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  async callMCPTool(toolName: string, params: any = {}): Promise<any> {
    const url = `${this.mcpBasePrefix()}/mcp/call/${toolName}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  }

  // Spec Cleanup Skill API
  async scanSpecComments(): Promise<SpecCleanupScanResult> {
    return this.request<SpecCleanupScanResult>('/skills/spec-cleanup/scan', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
    })
  }

  async runSpecCleanup(dryRun: boolean = false): Promise<SpecCleanupRunResult> {
    return this.request<SpecCleanupRunResult>('/skills/spec-cleanup/run', {
      method: 'POST',
      body: JSON.stringify({ dryRun }),
    })
  }

  // Cron Job API methods
  async getCronJobs(params?: {
    type?: string
    status?: string
    enabled?: boolean
    tags?: string[]
  }): Promise<any> {
    const queryParams = new URLSearchParams()
    if (params?.type) queryParams.append('type', params.type)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString())
    if (params?.tags?.length) queryParams.append('tags', params.tags.join(','))
    
    const endpoint = `/cron/jobs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request<any>(endpoint)
  }

  async getCronJob(jobId: string): Promise<any> {
    return this.request<any>(`/cron/jobs/${jobId}`)
  }

  async createCronJob(job: {
    name: string
    description: string
    schedule: string
    jobType: string
    config?: any
    priority?: 'low' | 'medium' | 'high' | 'critical'
    tags?: string[]
    enabled?: boolean
  }): Promise<any> {
    return this.request<any>('/cron/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    })
  }

  async updateCronJob(jobId: string, updates: {
    name?: string
    description?: string
    schedule?: string
    config?: any
    priority?: 'low' | 'medium' | 'high' | 'critical'
    enabled?: boolean
    tags?: string[]
  }): Promise<any> {
    return this.request<any>(`/cron/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    })
  }

  async deleteCronJob(jobId: string): Promise<any> {
    return this.request<any>(`/cron/jobs/${jobId}`, {
      method: 'DELETE',
    })
  }

  async runCronJob(jobId: string): Promise<any> {
    return this.request<any>(`/cron/jobs/${jobId}/run`, {
      method: 'POST',
    })
  }

  async toggleCronJob(jobId: string, enabled: boolean): Promise<any> {
    return this.request<any>(`/cron/jobs/${jobId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    })
  }

  async getCronDashboard(): Promise<any> {
    return this.request<any>('/cron/dashboard')
  }

  async getCronJobTemplates(params?: {
    category?: 'maintenance' | 'monitoring' | 'optimization' | 'analytics'
    jobType?: string
  }): Promise<any> {
    const queryParams = new URLSearchParams()
    if (params?.category) queryParams.append('category', params.category)
    if (params?.jobType) queryParams.append('jobType', params.jobType)
    
    const endpoint = `/cron/templates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request<any>(endpoint)
  }

  async createCronJobFromTemplate(params: {
    templateName: string
    name: string
    description?: string
    schedule?: string
    config?: any
    tags?: string[]
    enabled?: boolean
  }): Promise<any> {
    return this.request<any>('/cron/templates/create', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async getCronJobExecutions(jobId: string, limit?: number): Promise<any> {
    const endpoint = `/cron/jobs/${jobId}/executions${limit ? `?limit=${limit}` : ''}`
    return this.request<any>(endpoint)
  }

  async getCronExecutionHistory(params?: {
    limit?: number
    status?: string
    jobType?: string
  }): Promise<any> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.jobType) queryParams.append('jobType', params.jobType)
    
    const endpoint = `/cron/executions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request<any>(endpoint)
  }

  async validateCronSchedule(schedule: string, nextRunCount?: number): Promise<any> {
    return this.request<any>('/cron/validate', {
      method: 'POST',
      body: JSON.stringify({ schedule, nextRunCount }),
    })
  }

  async getCronSystemStatus(): Promise<any> {
    return this.request<any>('/cron/status')
  }
}

// CodeGraph types
export interface CodeGraphStatus {
  totalNodes: number
  totalEdges: number
  filesIndexed: number
  nodesByKind: Record<string, number>
  edgesByKind: Record<string, number>
  isAvailable: boolean
  dbPath: string
}

export interface CodeGraphSymbol {
  id: string
  name: string
  kind: string
  file: string
  line: number
  column?: number
  end_line?: number
  end_column?: number
  signature?: string
  docstring?: string
}

export interface CodeGraphRelation {
  id: string
  name: string
  kind: string
  file: string
  line: number
  signature?: string
  confidence?: number
  edgeKind?: string
  nodeKind?: string
}

export interface CodeGraphSymbolDetail extends CodeGraphSymbol {
  relationships: {
    incoming: CodeGraphRelation[]
    outgoing: CodeGraphRelation[]
  }
}

export interface CodeGraphImpact {
  affected: Array<CodeGraphRelation & { depth: number }>
  totalAffected: number
  maxDepthReached: boolean
  analyzedDepth: number
}

export interface SpecCleanupScanResult {
  count: number
  specs: Array<{
    tag: string
    content: string
    filePath: string
    lineNumber: number
    fullCommentText: string
    surroundingCode: string
  }>
}

export interface SpecCleanupRunResult {
  specsCreated: number
  commentsRemoved: number
  filesModified: number
  specs: Array<{
    id: string
    title: string
    source: string
    linkedSymbols: string[]
  }>
  errors: string[]
}

export const apiClient = new ApiClient()
export default apiClient