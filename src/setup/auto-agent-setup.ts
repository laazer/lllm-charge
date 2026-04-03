import { EventEmitter } from 'events'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

export const ProjectAnalysisSchema = z.object({
  type: z.enum(['web', 'api', 'cli', 'library', 'mobile', 'desktop', 'data', 'ai']),
  language: z.string(),
  framework: z.string().optional(),
  complexity: z.enum(['simple', 'moderate', 'complex', 'enterprise']),
  teamSize: z.enum(['solo', 'small', 'medium', 'large']),
  stage: z.enum(['prototype', 'development', 'production', 'maintenance']),
  domains: z.array(z.string()), // e.g., ['authentication', 'api', 'database', 'ui']
  technologies: z.array(z.string()),
  patterns: z.array(z.string()), // Detected architectural patterns
  goals: z.array(z.string())
})

export type ProjectAnalysis = z.infer<typeof ProjectAnalysisSchema>

export const AgentSetupConfigSchema = z.object({
  recommendedAgents: z.array(z.object({
    type: z.string(),
    name: z.string(),
    role: z.string(),
    skills: z.array(z.string()),
    priority: z.enum(['essential', 'recommended', 'optional'])
  })),
  workflow: z.object({
    name: z.string(),
    description: z.string(),
    steps: z.array(z.object({
      agent: z.string(),
      task: z.string(),
      dependencies: z.array(z.string())
    }))
  }),
  claudeMdConfig: z.object({
    instructions: z.array(z.string()),
    context: z.array(z.string()),
    constraints: z.array(z.string()),
    preferences: z.array(z.string())
  }),
  skillsDirectory: z.record(z.object({
    description: z.string(),
    implementation: z.string(),
    usage: z.array(z.string())
  })),
  mcpConfig: z.object({
    servers: z.array(z.object({
      name: z.string(),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional()
    })),
    tools: z.array(z.string())
  })
})

export type AgentSetupConfig = z.infer<typeof AgentSetupConfigSchema>

export class AutoAgentSetup extends EventEmitter {
  private projectPath: string
  private analysis: ProjectAnalysis | null = null

  constructor(projectPath: string = process.cwd()) {
    super()
    this.projectPath = projectPath
  }

  async analyzeProject(): Promise<ProjectAnalysis> {
    const packageJson = await this.readPackageJson()
    const fileStructure = await this.analyzeFileStructure()
    const codePatterns = await this.detectCodePatterns()
    
    const analysis: ProjectAnalysis = {
      type: this.inferProjectType(packageJson, fileStructure),
      language: this.detectPrimaryLanguage(fileStructure),
      framework: this.detectFramework(packageJson, fileStructure),
      complexity: this.assessComplexity(fileStructure, packageJson),
      teamSize: this.inferTeamSize(packageJson, fileStructure),
      stage: this.detectProjectStage(packageJson, fileStructure),
      domains: this.identifyDomains(fileStructure, codePatterns),
      technologies: this.extractTechnologies(packageJson, fileStructure),
      patterns: codePatterns,
      goals: this.inferProjectGoals(packageJson, fileStructure)
    }

    this.analysis = analysis
    this.emit('project:analyzed', analysis)
    return analysis
  }

  async generateAgentSetup(): Promise<AgentSetupConfig> {
    if (!this.analysis) {
      await this.analyzeProject()
    }

    const config: AgentSetupConfig = {
      recommendedAgents: this.recommendAgents(this.analysis!),
      workflow: this.designWorkflow(this.analysis!),
      claudeMdConfig: this.generateClaudeMdConfig(this.analysis!),
      skillsDirectory: this.generateSkillsDirectory(this.analysis!),
      mcpConfig: this.generateMcpConfig(this.analysis!)
    }

    this.emit('setup:generated', config)
    return config
  }

  async setupProject(): Promise<void> {
    const config = await this.generateAgentSetup()
    
    // Create directory structure
    await this.createDirectoryStructure()
    
    // Generate agents.md
    await this.writeAgentsMd(config)
    
    // Generate CLAUDE.md
    await this.writeClaudeMd(config)
    
    // Create skills directory
    await this.createSkillsDirectory(config)
    
    // Setup MCP configuration
    await this.setupMcpConfig(config)
    
    // Create workflow files
    await this.createWorkflowFiles(config)
    
    this.emit('project:setup-complete', { path: this.projectPath, config })
  }

  private async readPackageJson(): Promise<any> {
    try {
      const packagePath = path.join(this.projectPath, 'package.json')
      const content = await fs.readFile(packagePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return {}
    }
  }

  private async analyzeFileStructure(): Promise<Record<string, string[]>> {
    const structure: Record<string, string[]> = {}
    
    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules'].includes(entry.name)) {
          const dirPath = path.join(this.projectPath, entry.name)
          structure[entry.name] = await this.getDirectoryFiles(dirPath)
        }
      }
      
      // Root level files
      structure['.'] = entries
        .filter(e => e.isFile())
        .map(e => e.name)
    } catch (error) {
      structure['.'] = []
    }
    
    return structure
  }

  private async getDirectoryFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries
        .filter(e => e.isFile())
        .map(e => e.name)
    } catch (error) {
      return []
    }
  }

  private async detectCodePatterns(): Promise<string[]> {
    const patterns: string[] = []
    
    // Check for common architectural patterns
    const hasConfig = await this.fileExists('config') || await this.fileExists('src/config')
    const hasModels = await this.fileExists('models') || await this.fileExists('src/models')
    const hasControllers = await this.fileExists('controllers') || await this.fileExists('src/controllers')
    const hasServices = await this.fileExists('services') || await this.fileExists('src/services')
    const hasComponents = await this.fileExists('components') || await this.fileExists('src/components')
    const hasHooks = await this.fileExists('hooks') || await this.fileExists('src/hooks')
    const hasMiddleware = await this.fileExists('middleware') || await this.fileExists('src/middleware')
    const hasTypes = await this.fileExists('types') || await this.fileExists('src/types')

    if (hasModels && hasControllers && hasServices) patterns.push('mvc')
    if (hasComponents && hasHooks) patterns.push('react')
    if (hasServices) patterns.push('service-layer')
    if (hasMiddleware) patterns.push('middleware')
    if (hasTypes) patterns.push('typescript')
    if (hasConfig) patterns.push('configuration-driven')

    return patterns
  }

  private async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, relativePath))
      return true
    } catch {
      return false
    }
  }

  private inferProjectType(packageJson: any, fileStructure: Record<string, string[]>): ProjectAnalysis['type'] {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const scripts = packageJson.scripts || {}
    
    if (dependencies?.react || dependencies?.vue || dependencies?.angular) return 'web'
    if (dependencies?.express || dependencies?.fastify || dependencies?.koa) return 'api'
    if (packageJson.bin || scripts.start?.includes('cli')) return 'cli'
    if (dependencies?.['react-native'] || dependencies?.flutter) return 'mobile'
    if (dependencies?.electron || dependencies?.tauri) return 'desktop'
    if (dependencies?.pandas || dependencies?.numpy || fileStructure.notebooks) return 'data'
    if (dependencies?.tensorflow || dependencies?.pytorch || dependencies?.transformers) return 'ai'
    if (packageJson.main && !packageJson.private) return 'library'
    
    return 'api' // Default
  }

  private detectPrimaryLanguage(fileStructure: Record<string, string[]>): string {
    const allFiles = Object.values(fileStructure).flat()
    const extensions = allFiles.map(f => path.extname(f))
    const langCount: Record<string, number> = {}
    
    extensions.forEach(ext => {
      const lang = this.extensionToLanguage(ext)
      langCount[lang] = (langCount[lang] || 0) + 1
    })
    
    return Object.entries(langCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'javascript'
  }

  private extensionToLanguage(ext: string): string {
    const mapping: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    }
    return mapping[ext] || 'unknown'
  }

  private detectFramework(packageJson: any, fileStructure: Record<string, string[]>): string | undefined {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    if (deps.react) return 'React'
    if (deps.vue) return 'Vue'
    if (deps.angular) return 'Angular'
    if (deps.express) return 'Express'
    if (deps.fastify) return 'Fastify'
    if (deps.nestjs) return 'NestJS'
    if (deps.nextjs || deps.next) return 'Next.js'
    if (deps.nuxt) return 'Nuxt.js'
    if (deps.svelte) return 'Svelte'
    
    return undefined
  }

  private assessComplexity(fileStructure: Record<string, string[]>, packageJson: any): ProjectAnalysis['complexity'] {
    const totalFiles = Object.values(fileStructure).flat().length
    const directories = Object.keys(fileStructure).length
    const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).length
    
    const complexityScore = totalFiles * 0.1 + directories * 2 + dependencies * 0.5
    
    if (complexityScore < 50) return 'simple'
    if (complexityScore < 150) return 'moderate'
    if (complexityScore < 300) return 'complex'
    return 'enterprise'
  }

  private inferTeamSize(packageJson: any, fileStructure: Record<string, string[]>): ProjectAnalysis['teamSize'] {
    // Simple heuristics based on project structure
    const hasLinting = packageJson.devDependencies?.eslint || packageJson.devDependencies?.prettier
    const hasCI = fileStructure['.']?.some(f => f.includes('github') || f.includes('gitlab') || f.includes('jenkins'))
    const hasDocker = fileStructure['.']?.includes('Dockerfile') || fileStructure['.']?.includes('docker-compose.yml')
    const hasTesting = packageJson.scripts?.test || packageJson.devDependencies?.jest || packageJson.devDependencies?.mocha
    
    let teamScore = 0
    if (hasLinting) teamScore += 1
    if (hasCI) teamScore += 2
    if (hasDocker) teamScore += 1
    if (hasTesting) teamScore += 1
    
    if (teamScore <= 1) return 'solo'
    if (teamScore <= 3) return 'small'
    if (teamScore <= 4) return 'medium'
    return 'large'
  }

  private detectProjectStage(packageJson: any, fileStructure: Record<string, string[]>): ProjectAnalysis['stage'] {
    const hasTests = packageJson.scripts?.test
    const hasDockerProduction = fileStructure['.']?.includes('Dockerfile.prod')
    const hasCI = fileStructure['.']?.some(f => f.includes('.github') || f.includes('.gitlab'))
    const version = packageJson.version || '0.0.0'
    const [major, minor] = version.split('.')
    
    if (major === '0' && minor === '0') return 'prototype'
    if (hasTests && hasCI && !hasDockerProduction) return 'development'
    if (hasDockerProduction || major !== '0') return 'production'
    
    return 'development'
  }

  private identifyDomains(fileStructure: Record<string, string[]>, patterns: string[]): string[] {
    const domains: string[] = []
    
    // Common domain detection
    if (fileStructure.auth || fileStructure.authentication) domains.push('authentication')
    if (fileStructure.api || patterns.includes('service-layer')) domains.push('api')
    if (fileStructure.database || fileStructure.db || fileStructure.models) domains.push('database')
    if (fileStructure.ui || fileStructure.components || patterns.includes('react')) domains.push('ui')
    if (fileStructure.config || fileStructure.configuration) domains.push('configuration')
    if (fileStructure.testing || fileStructure.tests || fileStructure.__tests__) domains.push('testing')
    if (fileStructure.docs || fileStructure.documentation) domains.push('documentation')
    if (fileStructure.security || fileStructure.middleware) domains.push('security')
    if (fileStructure.analytics || fileStructure.metrics) domains.push('monitoring')
    
    return domains
  }

  private extractTechnologies(packageJson: any, fileStructure: Record<string, string[]>): string[] {
    const tech: string[] = []
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    // Database technologies
    if (deps.mongoose || deps.mongodb) tech.push('MongoDB')
    if (deps.pg || deps.postgresql) tech.push('PostgreSQL')
    if (deps.mysql || deps.mysql2) tech.push('MySQL')
    if (deps.sqlite3 || deps['better-sqlite3']) tech.push('SQLite')
    if (deps.redis) tech.push('Redis')
    
    // Testing
    if (deps.jest) tech.push('Jest')
    if (deps.mocha) tech.push('Mocha')
    if (deps.cypress) tech.push('Cypress')
    
    // Build tools
    if (deps.webpack) tech.push('Webpack')
    if (deps.vite) tech.push('Vite')
    if (deps.rollup) tech.push('Rollup')
    
    // Cloud/Infrastructure
    if (deps.aws) tech.push('AWS')
    if (deps['@google-cloud']) tech.push('Google Cloud')
    if (deps.docker || fileStructure['.']?.includes('Dockerfile')) tech.push('Docker')
    
    return tech
  }

  private inferProjectGoals(packageJson: any, fileStructure: Record<string, string[]>): string[] {
    const goals: string[] = []
    
    if (packageJson.description?.toLowerCase().includes('api')) goals.push('Build robust API')
    if (packageJson.description?.toLowerCase().includes('performance')) goals.push('Optimize performance')
    if (fileStructure.tests || packageJson.scripts?.test) goals.push('Maintain high test coverage')
    if (fileStructure.docs) goals.push('Comprehensive documentation')
    if (packageJson.scripts?.lint) goals.push('Code quality and standards')
    
    // Default goals based on project type
    goals.push('Scalable architecture')
    goals.push('Developer experience')
    
    return goals
  }

  private recommendAgents(analysis: ProjectAnalysis): AgentSetupConfig['recommendedAgents'] {
    const agents: AgentSetupConfig['recommendedAgents'] = []
    
    // Core development agent - always recommended
    agents.push({
      type: 'specialist',
      name: `${analysis.language} Developer`,
      role: 'Primary development tasks, code review, refactoring',
      skills: ['code-refactoring', 'debugging', 'optimization', analysis.language.toLowerCase()],
      priority: 'essential'
    })
    
    // Architecture agent for complex projects
    if (analysis.complexity === 'complex' || analysis.complexity === 'enterprise') {
      agents.push({
        type: 'specialist',
        name: 'System Architect',
        role: 'System design, architectural decisions, scalability',
        skills: ['system-design', 'architecture-review', 'scalability-analysis'],
        priority: 'essential'
      })
    }
    
    // Testing agent if testing is a focus
    if (analysis.domains.includes('testing') || analysis.goals.includes('Maintain high test coverage')) {
      agents.push({
        type: 'specialist',
        name: 'Test Engineer',
        role: 'Test creation, coverage analysis, quality assurance',
        skills: ['test-automation', 'coverage-analysis', 'quality-assurance'],
        priority: 'recommended'
      })
    }
    
    // DevOps agent for production projects
    if (analysis.stage === 'production' || analysis.technologies.includes('Docker')) {
      agents.push({
        type: 'specialist',
        name: 'DevOps Engineer',
        role: 'Deployment, CI/CD, infrastructure management',
        skills: ['deployment', 'ci-cd', 'infrastructure', 'monitoring'],
        priority: 'recommended'
      })
    }
    
    // Security agent for larger teams or production
    if (analysis.teamSize === 'large' || analysis.domains.includes('security')) {
      agents.push({
        type: 'specialist',
        name: 'Security Engineer',
        role: 'Security analysis, vulnerability assessment, compliance',
        skills: ['security-audit', 'vulnerability-scan', 'compliance-check'],
        priority: 'recommended'
      })
    }
    
    // Project coordinator for larger projects
    if (analysis.complexity === 'enterprise' || analysis.teamSize === 'large') {
      agents.push({
        type: 'coordinator',
        name: 'Project Coordinator',
        role: 'Task coordination, progress tracking, team communication',
        skills: ['project-management', 'coordination', 'reporting'],
        priority: 'optional'
      })
    }
    
    // Documentation agent
    if (analysis.domains.includes('documentation') || analysis.goals.includes('Comprehensive documentation')) {
      agents.push({
        type: 'specialist',
        name: 'Documentation Writer',
        role: 'Technical writing, API documentation, user guides',
        skills: ['technical-writing', 'api-documentation', 'user-guides'],
        priority: 'recommended'
      })
    }
    
    return agents
  }

  private designWorkflow(analysis: ProjectAnalysis): AgentSetupConfig['workflow'] {
    const steps: AgentSetupConfig['workflow']['steps'] = []
    
    // Basic development workflow
    steps.push({
      agent: `${analysis.language} Developer`,
      task: 'Code implementation and initial review',
      dependencies: []
    })
    
    if (analysis.domains.includes('testing')) {
      steps.push({
        agent: 'Test Engineer',
        task: 'Create and run tests',
        dependencies: [`${analysis.language} Developer`]
      })
    }
    
    if (analysis.complexity === 'complex' || analysis.complexity === 'enterprise') {
      steps.push({
        agent: 'System Architect',
        task: 'Architecture review and recommendations',
        dependencies: [`${analysis.language} Developer`]
      })
    }
    
    if (analysis.domains.includes('security')) {
      steps.push({
        agent: 'Security Engineer',
        task: 'Security audit and vulnerability assessment',
        dependencies: [`${analysis.language} Developer`]
      })
    }
    
    if (analysis.stage === 'production') {
      steps.push({
        agent: 'DevOps Engineer',
        task: 'Deployment preparation and monitoring setup',
        dependencies: ['Test Engineer', 'Security Engineer'].filter(dep => 
          steps.some(step => step.agent === dep)
        )
      })
    }
    
    return {
      name: `${analysis.type.charAt(0).toUpperCase() + analysis.type.slice(1)} Development Workflow`,
      description: `Automated workflow for ${analysis.language} ${analysis.type} project development`,
      steps
    }
  }

  private generateClaudeMdConfig(analysis: ProjectAnalysis): AgentSetupConfig['claudeMdConfig'] {
    return {
      instructions: [
        `You are working on a ${analysis.language} ${analysis.type} project using ${analysis.framework || 'standard libraries'}`,
        `Project complexity: ${analysis.complexity}, Team size: ${analysis.teamSize}`,
        `Focus areas: ${analysis.domains.join(', ')}`,
        'Always follow the established code patterns and architectural decisions',
        'Consider performance, security, and maintainability in all suggestions'
      ],
      context: [
        `Primary language: ${analysis.language}`,
        `Framework: ${analysis.framework || 'None'}`,
        `Technologies: ${analysis.technologies.join(', ')}`,
        `Architectural patterns: ${analysis.patterns.join(', ')}`,
        `Project stage: ${analysis.stage}`
      ],
      constraints: [
        'Maintain consistency with existing code style',
        'Follow established security best practices',
        'Consider team size and complexity when suggesting solutions',
        'Prioritize maintainable and testable code'
      ],
      preferences: [
        `Prefer ${analysis.language} idioms and best practices`,
        'Use established patterns and libraries',
        'Focus on clear, documented code',
        'Consider performance implications'
      ]
    }
  }

  private generateSkillsDirectory(analysis: ProjectAnalysis): AgentSetupConfig['skillsDirectory'] {
    const skills: AgentSetupConfig['skillsDirectory'] = {}
    
    // Language-specific skills
    skills[`${analysis.language.toLowerCase()}-optimization`] = {
      description: `Optimize ${analysis.language} code for performance and memory usage`,
      implementation: this.getOptimizationSkill(analysis.language),
      usage: [
        'Code review and optimization suggestions',
        'Performance bottleneck identification',
        'Memory usage analysis'
      ]
    }
    
    // Framework-specific skills
    if (analysis.framework) {
      skills[`${analysis.framework.toLowerCase()}-best-practices`] = {
        description: `Apply ${analysis.framework} best practices and patterns`,
        implementation: this.getFrameworkSkill(analysis.framework),
        usage: [
          'Framework-specific code review',
          'Architecture recommendations',
          'Performance optimization'
        ]
      }
    }
    
    // Testing skills
    if (analysis.domains.includes('testing')) {
      skills['test-generation'] = {
        description: 'Generate comprehensive test suites',
        implementation: this.getTestGenerationSkill(analysis.language),
        usage: [
          'Unit test generation',
          'Integration test creation',
          'Test coverage analysis'
        ]
      }
    }
    
    // Security skills
    if (analysis.domains.includes('security')) {
      skills['security-audit'] = {
        description: 'Perform security audits and vulnerability assessments',
        implementation: this.getSecurityAuditSkill(analysis.language),
        usage: [
          'Code security review',
          'Vulnerability scanning',
          'Security best practice enforcement'
        ]
      }
    }
    
    return skills
  }

  private generateMcpConfig(analysis: ProjectAnalysis): AgentSetupConfig['mcpConfig'] {
    const servers: AgentSetupConfig['mcpConfig']['servers'] = []
    const tools: string[] = []
    
    // Basic file operations
    servers.push({
      name: 'filesystem',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
      env: { 'MCP_FILESYSTEM_ROOT': this.projectPath }
    })
    tools.push('read_file', 'write_file', 'list_directory')
    
    // Git integration
    servers.push({
      name: 'git',
      command: 'npx',
      args: ['@modelcontextprotocol/server-git']
    })
    tools.push('git_status', 'git_diff', 'git_commit', 'git_push')
    
    // Language-specific tools
    if (analysis.language === 'typescript' || analysis.language === 'javascript') {
      servers.push({
        name: 'npm',
        command: 'npx',
        args: ['@modelcontextprotocol/server-npm']
      })
      tools.push('npm_install', 'npm_run', 'npm_test')
    }
    
    if (analysis.language === 'python') {
      servers.push({
        name: 'python',
        command: 'python',
        args: ['-m', 'mcp_server_python']
      })
      tools.push('pip_install', 'pytest_run', 'python_lint')
    }
    
    // Database tools
    if (analysis.domains.includes('database')) {
      servers.push({
        name: 'database',
        command: 'npx',
        args: ['@modelcontextprotocol/server-database']
      })
      tools.push('query_database', 'migrate_database', 'backup_database')
    }
    
    // Docker tools
    if (analysis.technologies.includes('Docker')) {
      servers.push({
        name: 'docker',
        command: 'docker-mcp-server'
      })
      tools.push('docker_build', 'docker_run', 'docker_compose')
    }
    
    return { servers, tools }
  }

  private async createDirectoryStructure(): Promise<void> {
    const dirs = ['.llm-charge', '.llm-charge/agents', '.llm-charge/skills', '.llm-charge/workflows']
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.projectPath, dir), { recursive: true })
    }
  }

  private async writeAgentsMd(config: AgentSetupConfig): Promise<void> {
    let content = `# Agent Configuration

This file configures the AI agents for this project. Agents are specialized AI assistants with specific roles and capabilities.

## Recommended Agents

`
    
    for (const agent of config.recommendedAgents) {
      content += `### ${agent.name} (${agent.priority})

**Type:** ${agent.type}
**Role:** ${agent.role}
**Skills:** ${agent.skills.join(', ')}

`
    }
    
    content += `## Workflow

**Name:** ${config.workflow.name}
**Description:** ${config.workflow.description}

### Steps:
`
    
    for (const step of config.workflow.steps) {
      content += `1. **${step.agent}**: ${step.task}\n`
      if (step.dependencies.length > 0) {
        content += `   - Dependencies: ${step.dependencies.join(', ')}\n`
      }
    }
    
    content += `
## Usage

To activate agents for this project:

\`\`\`bash
llm-charge agents setup
llm-charge agents activate "${config.recommendedAgents[0].name}"
\`\`\`

To run the workflow:

\`\`\`bash
llm-charge workflow run "${config.workflow.name}"
\`\`\`
`
    
    await fs.writeFile(path.join(this.projectPath, '.llm-charge/agents.md'), content)
  }

  private async writeClaudeMd(config: AgentSetupConfig): Promise<void> {
    let content = `# Claude Code Configuration

## Project Context

`
    
    config.claudeMdConfig.context.forEach(ctx => {
      content += `- ${ctx}\n`
    })
    
    content += `
## Instructions

`
    
    config.claudeMdConfig.instructions.forEach(inst => {
      content += `- ${inst}\n`
    })
    
    content += `
## Constraints

`
    
    config.claudeMdConfig.constraints.forEach(constraint => {
      content += `- ${constraint}\n`
    })
    
    content += `
## Preferences

`
    
    config.claudeMdConfig.preferences.forEach(pref => {
      content += `- ${pref}\n`
    })
    
    content += `
## Available Skills

See the \`skills/\` directory for project-specific AI skills and tools.

## MCP Configuration

This project uses the following MCP servers:
${config.mcpConfig.servers.map(s => `- ${s.name}: ${s.command} ${s.args?.join(' ') || ''}`).join('\n')}

Available tools: ${config.mcpConfig.tools.join(', ')}
`
    
    await fs.writeFile(path.join(this.projectPath, 'CLAUDE.md'), content)
  }

  private async createSkillsDirectory(config: AgentSetupConfig): Promise<void> {
    const skillsPath = path.join(this.projectPath, '.llm-charge/skills')
    
    for (const [skillName, skill] of Object.entries(config.skillsDirectory)) {
      const skillContent = `# ${skillName.charAt(0).toUpperCase() + skillName.slice(1).replace('-', ' ')}

## Description
${skill.description}

## Usage
${skill.usage.map(u => `- ${u}`).join('\n')}

## Implementation

\`\`\`javascript
${skill.implementation}
\`\`\`

## Examples

Add usage examples here as the skill is used in the project.
`
      
      await fs.writeFile(path.join(skillsPath, `${skillName}.md`), skillContent)
    }
    
    // Create README for skills directory
    const skillsReadme = `# Skills Directory

This directory contains AI skills specifically designed for this project.

## Available Skills

${Object.keys(config.skillsDirectory).map(skill => `- [${skill}](./${skill}.md)`).join('\n')}

## Adding New Skills

To add a new skill:
1. Create a new markdown file in this directory
2. Follow the template structure from existing skills
3. Test the skill implementation
4. Update this README
`
    
    await fs.writeFile(path.join(skillsPath, 'README.md'), skillsReadme)
  }

  private async setupMcpConfig(config: AgentSetupConfig): Promise<void> {
    const mcpConfig = {
      mcpServers: Object.fromEntries(
        config.mcpConfig.servers.map(server => [
          server.name,
          {
            command: server.command,
            args: server.args || [],
            env: server.env || {}
          }
        ])
      )
    }
    
    await fs.writeFile(
      path.join(this.projectPath, '.llm-charge/mcp-config.json'),
      JSON.stringify(mcpConfig, null, 2)
    )
  }

  private async createWorkflowFiles(config: AgentSetupConfig): Promise<void> {
    const workflowContent = `# ${config.workflow.name}

${config.workflow.description}

## Workflow Steps

\`\`\`mermaid
graph TD
${config.workflow.steps.map((step, i) => {
  const nodeId = step.agent.replace(/\s+/g, '')
  return `  ${nodeId}["${step.agent}\\n${step.task}"]`
}).join('\n')}

${config.workflow.steps.map(step => {
  const nodeId = step.agent.replace(/\s+/g, '')
  return step.dependencies.map(dep => {
    const depId = dep.replace(/\s+/g, '')
    return `  ${depId} --> ${nodeId}`
  }).join('\n')
}).filter(Boolean).join('\n')}
\`\`\`

## Usage

\`\`\`bash
llm-charge workflow run "${config.workflow.name}"
\`\`\`
`
    
    await fs.writeFile(
      path.join(this.projectPath, '.llm-charge/workflows/development.md'),
      workflowContent
    )
  }

  // Skill implementation generators
  private getOptimizationSkill(language: string): string {
    const implementations: Record<string, string> = {
      typescript: `
async function optimizeTypeScript(code: string): Promise<OptimizationResult> {
  const ast = parseTypeScript(code)
  const optimizations = []
  
  // Check for performance anti-patterns
  checkForPerformanceIssues(ast, optimizations)
  
  // Suggest type improvements
  suggestTypeOptimizations(ast, optimizations)
  
  // Memory usage optimizations
  checkMemoryUsage(ast, optimizations)
  
  return { optimizedCode: applyOptimizations(code, optimizations), suggestions: optimizations }
}`,
      javascript: `
async function optimizeJavaScript(code: string): Promise<OptimizationResult> {
  const ast = parseJavaScript(code)
  const optimizations = []
  
  // Performance optimizations
  checkForLoops(ast, optimizations)
  checkForMemoryLeaks(ast, optimizations)
  suggestAsyncOptimizations(ast, optimizations)
  
  return { optimizedCode: applyOptimizations(code, optimizations), suggestions: optimizations }
}`
    }
    
    return implementations[language] || implementations.javascript
  }

  private getFrameworkSkill(framework: string): string {
    const implementations: Record<string, string> = {
      React: `
async function applyReactBestPractices(code: string): Promise<ReviewResult> {
  const suggestions = []
  
  // Check for hooks usage
  checkHooksRules(code, suggestions)
  
  // Performance optimizations
  checkForUseMemo(code, suggestions)
  checkForUseCallback(code, suggestions)
  
  // Component structure
  checkComponentStructure(code, suggestions)
  
  return { suggestions, improvedCode: applyReactOptimizations(code, suggestions) }
}`,
      Express: `
async function applyExpressBestPractices(code: string): Promise<ReviewResult> {
  const suggestions = []
  
  // Security middleware
  checkSecurityMiddleware(code, suggestions)
  
  // Error handling
  checkErrorHandling(code, suggestions)
  
  // Performance
  checkForCaching(code, suggestions)
  
  return { suggestions, improvedCode: applyExpressOptimizations(code, suggestions) }
}`
    }
    
    return implementations[framework] || 'async function applyBestPractices(code) { return { suggestions: [], improvedCode: code } }'
  }

  private getTestGenerationSkill(language: string): string {
    return `
async function generateTests(sourceCode: string, testFramework: string = 'jest'): Promise<TestSuite> {
  const ast = parseCode(sourceCode, '${language}')
  const functions = extractFunctions(ast)
  const classes = extractClasses(ast)
  
  const tests = []
  
  // Generate unit tests for functions
  for (const func of functions) {
    tests.push(generateFunctionTest(func, testFramework))
  }
  
  // Generate class tests
  for (const cls of classes) {
    tests.push(generateClassTest(cls, testFramework))
  }
  
  return { testCode: generateTestFile(tests), coverage: calculateCoverage(tests) }
}`
  }

  private getSecurityAuditSkill(language: string): string {
    return `
async function performSecurityAudit(code: string): Promise<SecurityReport> {
  const vulnerabilities = []
  const ast = parseCode(code, '${language}')
  
  // Check for common vulnerabilities
  checkSQLInjection(ast, vulnerabilities)
  checkXSS(ast, vulnerabilities)
  checkCSRF(ast, vulnerabilities)
  checkInsecureDeserialization(ast, vulnerabilities)
  
  // Language-specific checks
  ${language === 'javascript' || language === 'typescript' ? 'checkNodeSecurityIssues(ast, vulnerabilities)' : ''}
  
  return {
    vulnerabilities,
    riskLevel: calculateRiskLevel(vulnerabilities),
    recommendations: generateSecurityRecommendations(vulnerabilities)
  }
}`
  }
}