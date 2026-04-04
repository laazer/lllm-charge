// OpenClaw-Inspired Skill-Based Execution Framework
import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'

export interface SkillDefinition {
  name: string
  version: string
  description: string
  author: string
  category: SkillCategory
  metadata: SkillMetadata
  requirements: SkillRequirements
  parameters: SkillParameter[]
  commands: SkillCommand[]
  hooks: SkillHooks
  security: SkillSecurity
}

export interface SkillMetadata {
  emoji: string
  tags: string[]
  documentation: string
  examples: SkillExample[]
  requires: {
    anyBins?: string[]
    allBins?: string[]
    services?: string[]
    permissions?: string[]
  }
}

export interface SkillRequirements {
  runtime: 'node' | 'python' | 'bash' | 'docker'
  minVersion?: string
  dependencies: string[]
  systemRequirements: SystemRequirements
}

export interface SystemRequirements {
  os?: string[]
  architecture?: string[]
  minMemory?: number
  minDisk?: number
  networkAccess?: boolean
  gpuRequired?: boolean
}

export interface SkillParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file' | 'url'
  description: string
  required: boolean
  default?: any
  validation?: ParameterValidation
}

export interface ParameterValidation {
  pattern?: string
  min?: number
  max?: number
  enum?: any[]
  custom?: string
}

export interface SkillCommand {
  name: string
  description: string
  usage: string
  parameters: string[]
  examples: string[]
  permissions: string[]
  pty?: boolean
  background?: boolean
  timeout?: number
}

export interface SkillHooks {
  beforeExecute?: string
  afterExecute?: string
  onError?: string
  onSuccess?: string
  cleanup?: string
}

export interface SkillSecurity {
  sandboxed: boolean
  allowedPaths: string[]
  blockedPaths: string[]
  allowedNetworks: string[]
  environmentVariables: Record<string, string>
  capabilities: string[]
  policies: SecurityPolicy[]
}

export interface SecurityPolicy {
  action: 'allow' | 'deny' | 'prompt'
  resource: string
  conditions: Record<string, any>
}

export interface SkillExample {
  title: string
  description: string
  code: string
  expectedOutput?: string
}

export interface SkillExecution {
  id: string
  skillName: string
  command: string
  parameters: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: number
  endTime?: number
  output: string
  error?: string
  exitCode?: number
  resources: ExecutionResources
}

export interface ExecutionResources {
  cpuTime: number
  memoryUsage: number
  diskUsage: number
  networkRequests: number
}

export interface SkillRegistry {
  installed: Map<string, SkillDefinition>
  available: Map<string, SkillPackage>
  categories: Map<SkillCategory, string[]>
  dependencies: Map<string, string[]>
}

export interface SkillPackage {
  name: string
  version: string
  description: string
  author: string
  downloadUrl: string
  checksum: string
  size: number
  lastUpdated: number
  popularity: number
  rating: number
}

export type SkillCategory = 
  | 'coding' 
  | 'productivity' 
  | 'communication' 
  | 'media' 
  | 'development' 
  | 'system' 
  | 'ai' 
  | 'automation'
  | 'security'
  | 'monitoring'

export class OpenClawSkillEngine extends EventEmitter {
  private registry: SkillRegistry
  private executions: Map<string, SkillExecution> = new Map()
  private processes: Map<string, ChildProcess> = new Map()
  private skillsPath: string
  private sandboxManager: SkillSandboxManager
  private policyEngine: SkillPolicyEngine

  constructor(skillsPath: string = './skills') {
    super()
    this.skillsPath = skillsPath
    this.registry = {
      installed: new Map(),
      available: new Map(),
      categories: new Map(),
      dependencies: new Map()
    }
    this.sandboxManager = new SkillSandboxManager()
    this.policyEngine = new SkillPolicyEngine()
  }

  async initialize(): Promise<void> {
    await this.ensureSkillsDirectory()
    await this.loadInstalledSkills()
    await this.refreshAvailableSkills()
    await this.validateSkillDependencies()
    
    console.log('OpenClaw Skill Engine initialized')
    this.emit('initialized', {
      installedCount: this.registry.installed.size,
      availableCount: this.registry.available.size
    })
  }

  async installSkill(skillName: string, version?: string): Promise<void> {
    const skillPackage = this.registry.available.get(skillName)
    if (!skillPackage) {
      throw new Error(`Skill '${skillName}' not found in registry`)
    }

    const targetVersion = version || skillPackage.version
    console.log(`Installing skill ${skillName}@${targetVersion}`)

    // Download and extract skill package
    await this.downloadSkillPackage(skillPackage)
    
    // Load skill definition
    const skillDefinition = await this.loadSkillDefinition(skillName)
    
    // Install dependencies
    await this.installSkillDependencies(skillDefinition)
    
    // Validate skill
    await this.validateSkill(skillDefinition)
    
    // Register skill
    this.registry.installed.set(skillName, skillDefinition)
    
    this.emit('skillInstalled', { skillName, version: targetVersion })
    console.log(`Skill ${skillName}@${targetVersion} installed successfully`)
  }

  async uninstallSkill(skillName: string): Promise<void> {
    const skill = this.registry.installed.get(skillName)
    if (!skill) {
      throw new Error(`Skill '${skillName}' not installed`)
    }

    // Check for dependents
    const dependents = this.findSkillDependents(skillName)
    if (dependents.length > 0) {
      throw new Error(`Cannot uninstall ${skillName}: required by ${dependents.join(', ')}`)
    }

    // Cleanup skill files
    await this.cleanupSkillFiles(skillName)
    
    // Remove from registry
    this.registry.installed.delete(skillName)
    
    this.emit('skillUninstalled', { skillName })
    console.log(`Skill ${skillName} uninstalled successfully`)
  }

  async executeSkill(
    skillName: string, 
    command: string, 
    parameters: Record<string, any> = {},
    options: ExecutionOptions = {}
  ): Promise<string> {
    const skill = this.registry.installed.get(skillName)
    if (!skill) {
      throw new Error(`Skill '${skillName}' not installed`)
    }

    const skillCommand = skill.commands.find(cmd => cmd.name === command)
    if (!skillCommand) {
      throw new Error(`Command '${command}' not found in skill '${skillName}'`)
    }

    const executionId = this.generateExecutionId()
    const execution: SkillExecution = {
      id: executionId,
      skillName,
      command,
      parameters,
      status: 'pending',
      startTime: Date.now(),
      output: '',
      resources: {
        cpuTime: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkRequests: 0
      }
    }

    this.executions.set(executionId, execution)

    try {
      // Validate parameters
      await this.validateParameters(skill, skillCommand, parameters)
      
      // Check permissions
      await this.policyEngine.checkPermissions(skill, skillCommand, options.userId)
      
      // Execute skill
      const result = await this.runSkillCommand(skill, skillCommand, parameters, options)
      
      execution.status = 'completed'
      execution.endTime = Date.now()
      execution.output = result.output
      execution.exitCode = result.exitCode

      this.emit('skillExecuted', { executionId, skillName, command, result })
      return result.output

    } catch (error) {
      execution.status = 'failed'
      execution.endTime = Date.now()
      execution.error = (error as Error).message

      this.emit('skillFailed', { executionId, skillName, command, error })
      throw error
    }
  }

  async getAvailableSkills(): Promise<SkillPackage[]> {
    return Array.from(this.registry.available.values())
  }

  async getInstalledSkills(): Promise<SkillDefinition[]> {
    return Array.from(this.registry.installed.values())
  }

  async getSkillsByCategory(category: SkillCategory): Promise<SkillDefinition[]> {
    const skillNames = this.registry.categories.get(category) || []
    return skillNames.map(name => this.registry.installed.get(name)!).filter(Boolean)
  }

  async searchSkills(query: string): Promise<SkillDefinition[]> {
    const installed = Array.from(this.registry.installed.values())
    return installed.filter(skill => 
      skill.name.toLowerCase().includes(query.toLowerCase()) ||
      skill.description.toLowerCase().includes(query.toLowerCase()) ||
      skill.metadata.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    )
  }

  async getSkillUsage(skillName: string): Promise<SkillUsageStats> {
    const executions = Array.from(this.executions.values())
      .filter(exec => exec.skillName === skillName)

    const completed = executions.filter(exec => exec.status === 'completed')
    const failed = executions.filter(exec => exec.status === 'failed')

    return {
      totalExecutions: executions.length,
      successfulExecutions: completed.length,
      failedExecutions: failed.length,
      averageExecutionTime: this.calculateAverageExecutionTime(completed),
      lastUsed: Math.max(...executions.map(exec => exec.startTime), 0),
      popularCommands: this.getPopularCommands(executions)
    }
  }

  async optimizeSkills(): Promise<SkillOptimizationResult> {
    const analysis = {
      unusedSkills: await this.findUnusedSkills(),
      frequentlyUsed: await this.findFrequentlyUsedSkills(),
      resourceHogs: await this.findResourceIntensiveSkills(),
      outdatedSkills: await this.findOutdatedSkills(),
      dependencyConflicts: await this.findDependencyConflicts()
    }

    const recommendations = [
      ...analysis.unusedSkills.map(skill => ({
        action: 'uninstall',
        skill: skill.name,
        reason: 'Unused for 30+ days'
      })),
      ...analysis.outdatedSkills.map(skill => ({
        action: 'update',
        skill: skill.name,
        currentVersion: skill.version,
        latestVersion: this.registry.available.get(skill.name)?.version
      })),
      ...analysis.resourceHogs.map(skill => ({
        action: 'optimize',
        skill: skill.name,
        issue: 'High resource usage',
        suggestion: 'Consider alternatives or resource limits'
      }))
    ]

    return { analysis, recommendations }
  }

  // Private methods
  private async ensureSkillsDirectory(): Promise<void> {
    try {
      await fs.access(this.skillsPath)
    } catch {
      await fs.mkdir(this.skillsPath, { recursive: true })
    }
  }

  private async loadInstalledSkills(): Promise<void> {
    const skillDirs = await fs.readdir(this.skillsPath)
    
    for (const dir of skillDirs) {
      try {
        const skillDefinition = await this.loadSkillDefinition(dir)
        this.registry.installed.set(dir, skillDefinition)
        
        // Update categories
        const category = skillDefinition.category
        if (!this.registry.categories.has(category)) {
          this.registry.categories.set(category, [])
        }
        this.registry.categories.get(category)!.push(dir)
        
      } catch (error) {
        console.warn(`Failed to load skill ${dir}:`, (error as Error).message)
      }
    }
  }

  private async loadSkillDefinition(skillName: string): Promise<SkillDefinition> {
    const skillPath = path.join(this.skillsPath, skillName)
    const definitionPath = path.join(skillPath, 'SKILL.json')
    
    try {
      const content = await fs.readFile(definitionPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      // Try markdown format (OpenClaw style)
      const mdPath = path.join(skillPath, 'SKILL.md')
      const mdContent = await fs.readFile(mdPath, 'utf-8')
      return this.parseMarkdownSkillDefinition(mdContent, skillName)
    }
  }

  private parseMarkdownSkillDefinition(content: string, skillName: string): SkillDefinition {
    // Parse OpenClaw-style SKILL.md files
    const lines = content.split('\n')
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    
    if (!frontMatterMatch) {
      throw new Error('Invalid SKILL.md format: missing frontmatter')
    }

    const frontMatter = this.parseFrontMatter(frontMatterMatch[1])
    
    return {
      name: frontMatter.name || skillName,
      version: '1.0.0',
      description: frontMatter.description || '',
      author: 'Unknown',
      category: this.inferCategory(frontMatter.name || skillName),
      metadata: frontMatter.metadata || { emoji: '🔧', tags: [], documentation: '', examples: [], requires: {} },
      requirements: {
        runtime: 'bash',
        dependencies: [],
        systemRequirements: {}
      },
      parameters: [],
      commands: this.parseCommands(content),
      hooks: {},
      security: {
        sandboxed: true,
        allowedPaths: [],
        blockedPaths: [],
        allowedNetworks: [],
        environmentVariables: {},
        capabilities: [],
        policies: []
      }
    }
  }

  private parseFrontMatter(frontMatter: string): any {
    const result: any = {}
    const lines = frontMatter.trim().split('\n')
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()
        
        try {
          result[key] = JSON.parse(value)
        } catch {
          result[key] = value.replace(/^['"](.*)['"]$/, '$1')
        }
      }
    }
    
    return result
  }

  private parseCommands(content: string): SkillCommand[] {
    // Extract command examples from markdown content
    const commands: SkillCommand[] = []
    const codeBlockRegex = /```(?:bash|shell)\n([\s\S]*?)\n```/g
    
    let match
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1].trim()
      const lines = code.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('#') || line.trim() === '') continue
        
        const commandName = line.split(' ')[0]
        commands.push({
          name: commandName,
          description: `Execute ${commandName}`,
          usage: line,
          parameters: [],
          examples: [line],
          permissions: []
        })
      }
    }
    
    return commands
  }

  private inferCategory(skillName: string): SkillCategory {
    const categoryMap: Record<string, SkillCategory> = {
      'coding': 'coding',
      'code': 'coding', 
      'git': 'development',
      'docker': 'development',
      'test': 'development',
      'build': 'development',
      'deploy': 'development',
      'monitor': 'monitoring',
      'log': 'monitoring',
      'backup': 'system',
      'security': 'security',
      'auth': 'security',
      'encrypt': 'security',
      'media': 'media',
      'image': 'media',
      'video': 'media',
      'audio': 'media',
      'ai': 'ai',
      'ml': 'ai',
      'llm': 'ai'
    }

    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (skillName.toLowerCase().includes(keyword)) {
        return category
      }
    }

    return 'productivity'
  }

  private async runSkillCommand(
    skill: SkillDefinition, 
    command: SkillCommand, 
    parameters: Record<string, any>,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    if (skill.security.sandboxed) {
      return await this.sandboxManager.executeCommand(skill, command, parameters, options)
    } else {
      return await this.executeCommandDirect(skill, command, parameters, options)
    }
  }

  private async executeCommandDirect(
    skill: SkillDefinition,
    command: SkillCommand,
    parameters: Record<string, any>,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const skillPath = path.join(this.skillsPath, skill.name)
    const commandArgs = this.buildCommandArgs(command, parameters)
    
    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', command.usage], {
        cwd: skillPath,
        env: { ...process.env, ...skill.security.environmentVariables },
        stdio: command.pty ? 'inherit' : 'pipe'
      })

      let output = ''
      let error = ''

      if (!command.pty) {
        proc.stdout?.on('data', (data: Buffer) => {
          output += data.toString()
        })

        proc.stderr?.on('data', (data: Buffer) => {
          error += data.toString()
        })
      }

      proc.on('close', (code: number | null) => {
        resolve({
          output: output || 'Command executed successfully',
          error: error || undefined,
          exitCode: code || 0
        })
      })

      proc.on('error', (err: Error) => {
        reject(new Error(`Command execution failed: ${err.message}`))
      })

      // Set timeout
      if (command.timeout) {
        setTimeout(() => {
          proc.kill('SIGTERM')
          reject(new Error('Command execution timed out'))
        }, command.timeout)
      }
    })
  }

  private buildCommandArgs(command: SkillCommand, parameters: Record<string, any>): string[] {
    // Build command arguments from parameters
    const args: string[] = []
    
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        args.push(`--${key}`)
        if (value !== true) {
          args.push(String(value))
        }
      }
    }
    
    return args
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Placeholder implementations
  private async refreshAvailableSkills(): Promise<void> {}
  private async validateSkillDependencies(): Promise<void> {}
  private async downloadSkillPackage(skillPackage: SkillPackage): Promise<void> {}
  private async installSkillDependencies(skill: SkillDefinition): Promise<void> {}
  private async validateSkill(skill: SkillDefinition): Promise<void> {}
  private findSkillDependents(skillName: string): string[] { return [] }
  private async cleanupSkillFiles(skillName: string): Promise<void> {}
  private async validateParameters(skill: SkillDefinition, command: SkillCommand, parameters: Record<string, any>): Promise<void> {}
  private calculateAverageExecutionTime(executions: SkillExecution[]): number { return 0 }
  private getPopularCommands(executions: SkillExecution[]): string[] { return [] }
  private async findUnusedSkills(): Promise<SkillDefinition[]> { return [] }
  private async findFrequentlyUsedSkills(): Promise<SkillDefinition[]> { return [] }
  private async findResourceIntensiveSkills(): Promise<SkillDefinition[]> { return [] }
  private async findOutdatedSkills(): Promise<SkillDefinition[]> { return [] }
  private async findDependencyConflicts(): Promise<any> { return {} }

  async cleanup(): Promise<void> {
    // Kill all running processes
    for (const [executionId, process] of this.processes) {
      process.kill('SIGTERM')
    }
    this.processes.clear()

    // Cleanup sandbox manager
    await this.sandboxManager.cleanup()

    console.log('OpenClaw Skill Engine cleaned up')
  }
}

// Supporting classes
class SkillSandboxManager {
  private sandboxes: Map<string, any> = new Map()

  async executeCommand(
    skill: SkillDefinition,
    command: SkillCommand, 
    parameters: Record<string, any>,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    // Create isolated sandbox for skill execution
    return {
      output: 'Command executed in sandbox',
      exitCode: 0
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup all sandboxes
  }
}

class SkillPolicyEngine {
  async checkPermissions(skill: SkillDefinition, command: SkillCommand, userId?: string): Promise<void> {
    // Check if user has permission to execute this skill/command
    const requiredPermissions = command.permissions
    
    for (const permission of requiredPermissions) {
      if (!await this.hasPermission(userId, permission)) {
        throw new Error(`Permission denied: ${permission}`)
      }
    }
  }

  private async hasPermission(userId: string | undefined, permission: string): Promise<boolean> {
    // Implement permission checking logic
    return true // Default allow for now
  }
}

// Supporting interfaces
interface ExecutionOptions {
  timeout?: number
  background?: boolean
  userId?: string
  workspace?: string
  environment?: Record<string, string>
}

interface ExecutionResult {
  output: string
  error?: string
  exitCode: number
}

interface SkillUsageStats {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  lastUsed: number
  popularCommands: string[]
}

interface SkillOptimizationResult {
  analysis: {
    unusedSkills: SkillDefinition[]
    frequentlyUsed: SkillDefinition[]
    resourceHogs: SkillDefinition[]
    outdatedSkills: SkillDefinition[]
    dependencyConflicts: any
  }
  recommendations: Array<{
    action: string
    skill: string
    reason?: string
    currentVersion?: string
    latestVersion?: string
    issue?: string
    suggestion?: string
  }>
}