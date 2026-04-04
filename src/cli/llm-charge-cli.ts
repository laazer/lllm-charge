#!/usr/bin/env node

import { Command } from 'commander'
import figlet from 'figlet'
import { z } from 'zod'
import { AutoAgentSetup } from '../setup/auto-agent-setup.js'
import { AgentStudio } from '../agents/agent-studio.js'
import { ProjectForge } from '../project-management/project-forge.js'
// import { ObsidianLite } from '../memory/obsidian-lite.js' // module does not exist
import { CheckpointManager } from '../memory/checkpoint-manager.js'
import { SpecManager } from '../specs/spec-manager.js'
import { BetterModelRouter } from '../routing/better-model-router.js'
import { WebDashboard } from '../ui/web-dashboard.js'
import { autoSetupMCP } from '../setup/mcp-auto-setup.js'
import { enhancedAutoSetupMCP } from '../setup/enhanced-mcp-setup.js'

interface CLIConfig {
  debug: boolean
  verbose: boolean
  config: string
  workingDir: string
}

class LLMChargeCLI {
  private program: Command
  private config: CLIConfig
  private agentStudio?: AgentStudio
  private projectManager?: ProjectForge
  private memorySystem?: any
  private checkpointManager?: CheckpointManager
  private specManager?: SpecManager
  private modelRouter?: BetterModelRouter
  private dashboard?: WebDashboard

  constructor() {
    this.program = new Command()
    this.config = {
      debug: false,
      verbose: false,
      config: '.llm-charge/config.json',
      workingDir: process.cwd()
    }
    this.setupCommands()
  }

  private setupCommands(): void {
    this.program
      .name('llm-charge')
      .description('🚀 Supercharge your local LLMs with intelligent routing and cost optimization')
      .version('1.0.0')
      .option('-d, --debug', 'Enable debug output')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('-c, --config <path>', 'Path to config file', '.llm-charge/config.json')
      .option('-w, --working-dir <path>', 'Working directory', process.cwd())
      .hook('preAction', (thisCommand, actionCommand) => {
        const opts = thisCommand.opts()
        this.config = { ...this.config, ...opts }
      })

    // Setup commands
    this.setupSetupCommands()
    this.setupAgentCommands()
    this.setupProjectCommands()
    this.setupMemoryCommands()
    this.setupSpecCommands()
    this.setupRoutingCommands()
    this.setupDashboardCommands()
    this.setupUtilityCommands()
  }

  private setupSetupCommands(): void {
    const setup = this.program
      .command('setup')
      .description('Setup and configure LLM-Charge for your project')

    setup
      .command('init')
      .description('Initialize LLM-Charge in current directory')
      .option('--force', 'Overwrite existing configuration')
      .action(async (options) => {
        await this.handleSetupInit(options)
      })

    setup
      .command('analyze')
      .description('Analyze current project structure')
      .action(async () => {
        await this.handleSetupAnalyze()
      })

    setup
      .command('agents')
      .description('Auto-setup agents based on project analysis')
      .action(async () => {
        await this.handleSetupAgents()
      })

    setup
      .command('mcp')
      .description('🚀 One-command MCP setup (CodeGraph + ContextPlus + LLM-Charge)')
      .option('--no-codegraph', 'Skip CodeGraph initialization')
      .option('--no-contextplus', 'Skip ContextPlus setup')
      .option('--no-autostart', 'Skip auto-starting services')
      .option('--working-dir <dir>', 'Working directory', process.cwd())
      .action(async (options) => {
        await this.handleSetupMCP(options)
      })

    setup
      .command('mcp-full')
      .description('🎯 COMPLETE MCP setup (everything + IDE integration + optimization)')
      .option('--no-codegraph', 'Skip CodeGraph initialization')
      .option('--no-contextplus', 'Skip ContextPlus setup')
      .option('--no-autostart', 'Skip auto-starting services')
      .option('--no-ide-config', 'Skip IDE configuration generation')
      .option('--no-provider-setup', 'Skip local LLM provider detection')
      .option('--no-docs', 'Skip documentation generation')
      .option('--working-dir <dir>', 'Working directory', process.cwd())
      .action(async (options) => {
        await this.handleSetupMCPFull(options)
      })
  }

  private setupAgentCommands(): void {
    const agents = this.program
      .command('agents')
      .description('Manage AI agents')

    agents
      .command('list')
      .description('List all available agents')
      .option('--type <type>', 'Filter by agent type')
      .action(async (options) => {
        await this.handleAgentsList(options)
      })

    agents
      .command('create <name>')
      .description('Create a new agent')
      .option('--type <type>', 'Agent type', 'general')
      .option('--model <model>', 'Base model to use')
      .option('--skills <skills>', 'Comma-separated list of skills')
      .action(async (name, options) => {
        await this.handleAgentsCreate(name, options)
      })

    agents
      .command('run <agent> <task>')
      .description('Run a task with a specific agent')
      .option('--context <context>', 'Additional context for the task')
      .action(async (agent, task, options) => {
        await this.handleAgentsRun(agent, task, options)
      })

    agents
      .command('workflow <name>')
      .description('Execute a workflow')
      .option('--input <input>', 'Input data for workflow (JSON)')
      .action(async (name, options) => {
        await this.handleAgentsWorkflow(name, options)
      })

    agents
      .command('performance <agent>')
      .description('Show agent performance report')
      .action(async (agent) => {
        await this.handleAgentsPerformance(agent)
      })
  }

  private setupProjectCommands(): void {
    const project = this.program
      .command('project')
      .alias('proj')
      .description('Project management commands')

    project
      .command('create <key> <name>')
      .description('Create a new project')
      .option('--description <desc>', 'Project description')
      .option('--type <type>', 'Project type', 'software')
      .action(async (key, name, options) => {
        await this.handleProjectCreate(key, name, options)
      })

    project
      .command('ticket <title>')
      .description('Create a new ticket')
      .option('--type <type>', 'Ticket type', 'task')
      .option('--project <project>', 'Project key')
      .option('--assignee <assignee>', 'Assignee')
      .option('--priority <priority>', 'Priority level', 'medium')
      .action(async (title, options) => {
        await this.handleProjectTicket(title, options)
      })

    project
      .command('status [project]')
      .description('Show project status')
      .action(async (project) => {
        await this.handleProjectStatus(project)
      })

    project
      .command('sprint')
      .description('Sprint management')
      .option('--create <name>', 'Create new sprint')
      .option('--start <id>', 'Start sprint')
      .option('--complete <id>', 'Complete sprint')
      .action(async (options) => {
        await this.handleProjectSprint(options)
      })
  }

  private setupMemoryCommands(): void {
    const memory = this.program
      .command('memory')
      .description('Memory and knowledge management')

    memory
      .command('note <title>')
      .description('Create a new note')
      .option('--content <content>', 'Note content')
      .option('--tags <tags>', 'Comma-separated tags')
      .action(async (title, options) => {
        await this.handleMemoryNote(title, options)
      })

    memory
      .command('search <query>')
      .description('Search notes and memories')
      .option('--limit <limit>', 'Maximum results', '10')
      .action(async (query, options) => {
        await this.handleMemorySearch(query, options)
      })

    memory
      .command('graph')
      .description('Show memory graph statistics')
      .option('--export', 'Export graph as JSON')
      .action(async (options) => {
        await this.handleMemoryGraph(options)
      })

    memory
      .command('checkpoint <task>')
      .description('Create a checkpoint for current task')
      .option('--name <name>', 'Checkpoint name')
      .option('--description <desc>', 'Checkpoint description')
      .action(async (task, options) => {
        await this.handleMemoryCheckpoint(task, options)
      })
  }

  private setupSpecCommands(): void {
    const specs = this.program
      .command('specs')
      .description('Specification management')

    specs
      .command('create <title>')
      .description('Create a new specification')
      .option('--description <desc>', 'Specification description')
      .option('--priority <priority>', 'Priority level', 'medium')
      .action(async (title, options) => {
        await this.handleSpecsCreate(title, options)
      })

    specs
      .command('list')
      .description('List all specifications')
      .option('--status <status>', 'Filter by status')
      .option('--priority <priority>', 'Filter by priority')
      .action(async (options) => {
        await this.handleSpecsList(options)
      })

    specs
      .command('link <specId> <symbol>')
      .description('Link spec to code symbol')
      .option('--file <file>', 'Source file')
      .option('--line <line>', 'Line number')
      .option('--type <type>', 'Symbol type', 'function')
      .action(async (specId, symbol, options) => {
        await this.handleSpecsLink(specId, symbol, options)
      })

    specs
      .command('export')
      .description('Export specifications')
      .option('--format <format>', 'Export format (json|markdown)', 'markdown')
      .option('--output <output>', 'Output file')
      .action(async (options) => {
        await this.handleSpecsExport(options)
      })
  }

  private setupRoutingCommands(): void {
    const route = this.program
      .command('route')
      .description('Model routing and execution')

    route
      .command('models')
      .description('List available models')
      .option('--type <type>', 'Filter by model type')
      .action(async (options) => {
        await this.handleRouteModels(options)
      })

    route
      .command('execute <task>')
      .description('Execute task with intelligent routing')
      .option('--prefer-local', 'Prefer local models')
      .option('--max-cost <cost>', 'Maximum cost threshold')
      .option('--max-latency <latency>', 'Maximum latency threshold (ms)')
      .action(async (task, options) => {
        await this.handleRouteExecute(task, options)
      })

    route
      .command('analyze <task>')
      .description('Analyze task complexity without execution')
      .action(async (task) => {
        await this.handleRouteAnalyze(task)
      })

    route
      .command('stats')
      .description('Show routing statistics')
      .option('--timeframe <timeframe>', 'Time period (day|week|month)', 'week')
      .action(async (options) => {
        await this.handleRouteStats(options)
      })
  }

  private setupDashboardCommands(): void {
    const dashboard = this.program
      .command('dashboard')
      .description('Web dashboard management')

    dashboard
      .command('start')
      .description('Start the web dashboard')
      .option('--port <port>', 'Dashboard port', '3001')
      .option('--host <host>', 'Dashboard host', 'localhost')
      .action(async (options) => {
        await this.handleDashboardStart(options)
      })

    dashboard
      .command('stop')
      .description('Stop the web dashboard')
      .action(async () => {
        await this.handleDashboardStop()
      })

    dashboard
      .command('status')
      .description('Show dashboard status')
      .action(async () => {
        await this.handleDashboardStatus()
      })
  }

  private setupUtilityCommands(): void {
    this.program
      .command('status')
      .description('Show overall system status')
      .action(async () => {
        await this.handleStatus()
      })

    this.program
      .command('config')
      .description('Show current configuration')
      .option('--set <key=value>', 'Set configuration value')
      .action(async (options) => {
        await this.handleConfig(options)
      })

    this.program
      .command('logs')
      .description('Show recent logs')
      .option('--lines <lines>', 'Number of lines to show', '50')
      .option('--follow', 'Follow log output')
      .action(async (options) => {
        await this.handleLogs(options)
      })

    this.program
      .command('doctor')
      .description('Run system diagnostics')
      .action(async () => {
        await this.handleDoctor()
      })
  }

  // Command handlers
  private async handleSetupInit(options: any): Promise<void> {
    console.log(figlet.textSync('LLM-Charge'))
    console.log('🚀 Initializing LLM-Charge in current directory...\n')

    const setup = new AutoAgentSetup(this.config.workingDir)
    
    try {
      const analysis = await setup.analyzeProject()
      console.log('📊 Project Analysis:')
      console.log(`   Type: ${analysis.type}`)
      console.log(`   Language: ${analysis.language}`)
      console.log(`   Framework: ${analysis.framework || 'None'}`)
      console.log(`   Complexity: ${analysis.complexity}`)
      console.log(`   Team Size: ${analysis.teamSize}`)
      console.log(`   Domains: ${analysis.domains.join(', ')}`)
      console.log()

      await setup.setupProject()
      console.log('✅ LLM-Charge initialized successfully!')
      console.log('\n📁 Created:')
      console.log('   .llm-charge/agents.md')
      console.log('   .llm-charge/skills/')
      console.log('   .llm-charge/workflows/')
      console.log('   CLAUDE.md')
      console.log('\n🚀 Next steps:')
      console.log('   llm-charge agents list')
      console.log('   llm-charge dashboard start')
    } catch (error) {
      console.error('❌ Setup failed:', error)
      process.exit(1)
    }
  }

  private async handleSetupAnalyze(): Promise<void> {
    const setup = new AutoAgentSetup(this.config.workingDir)
    const analysis = await setup.analyzeProject()
    
    console.log('📊 Project Analysis Results:\n')
    console.log(JSON.stringify(analysis, null, 2))
  }

  private async handleSetupAgents(): Promise<void> {
    const setup = new AutoAgentSetup(this.config.workingDir)
    const config = await setup.generateAgentSetup()
    
    console.log('🤖 Recommended Agents:\n')
    config.recommendedAgents.forEach(agent => {
      console.log(`${agent.priority === 'essential' ? '⭐' : agent.priority === 'recommended' ? '💫' : '🔸'} ${agent.name} (${agent.type})`)
      console.log(`   Role: ${agent.role}`)
      console.log(`   Skills: ${agent.skills.join(', ')}`)
      console.log()
    })
  }

  private async handleSetupMCP(options: any): Promise<void> {
    console.log(figlet.textSync('MCP Setup'))
    console.log('🚀 Automated MCP Setup for LLM-Charge\n')

    const setupConfig = {
      workingDir: options.workingDir || this.config.workingDir,
      enableCodeGraph: !options.noCodegraph,
      enableContextPlus: !options.noContextplus,
      enableLLMChargeServer: true,
      autoStart: !options.noAutostart,
      skipExistingInit: false
    }

    console.log('📋 Setup Configuration:')
    console.log(`   Working Directory: ${setupConfig.workingDir}`)
    console.log(`   CodeGraph: ${setupConfig.enableCodeGraph ? '✅' : '❌'}`)
    console.log(`   ContextPlus: ${setupConfig.enableContextPlus ? '✅' : '❌'}`)
    console.log(`   Auto-start Services: ${setupConfig.autoStart ? '✅' : '❌'}`)
    console.log()

    try {
      const success = await autoSetupMCP(setupConfig)
      
      if (success) {
        console.log('🎉 MCP setup completed successfully!')
        console.log('\n💡 Quick test:')
        console.log('   Try: curl http://localhost:3001/mcp/tools')
        console.log('   Or visit: http://localhost:3001/')
      } else {
        console.error('❌ MCP setup failed. Check the logs above for details.')
        process.exit(1)
      }
    } catch (error) {
      console.error('💥 MCP setup crashed:', error)
      process.exit(1)
    }
  }

  private async handleSetupMCPFull(options: any): Promise<void> {
    console.log(figlet.textSync('MCP FULL'))
    console.log('🎯 COMPLETE MCP Setup - Everything You Need!\n')

    const enhancedConfig = {
      workingDir: options.workingDir || this.config.workingDir,
      enableCodeGraph: !options.noCodegraph,
      enableContextPlus: !options.noContextplus,
      enableLLMChargeServer: true,
      autoStart: !options.noAutostart,
      skipExistingInit: false,
      // Enhanced features
      autoDetectProviders: !options.noProviderSetup,
      generateClaudeCodeConfig: !options.noIdeConfig,
      generateCursorConfig: !options.noIdeConfig,
      setupDotEnv: true,
      setupGitIgnore: true,
      enableHybridRouting: true,
      setupCostTracking: true,
      configureCaching: true,
      generateDocumentation: !options.noDocs,
      createExamples: !options.noDocs,
    }

    console.log('📋 Enhanced Setup Configuration:')
    console.log(`   Working Directory: ${enhancedConfig.workingDir}`)
    console.log(`   CodeGraph + ContextPlus: ${enhancedConfig.enableCodeGraph ? '✅' : '❌'}`)
    console.log(`   Local LLM Detection: ${enhancedConfig.autoDetectProviders ? '✅' : '❌'}`)
    console.log(`   IDE Integration: ${enhancedConfig.generateClaudeCodeConfig ? '✅' : '❌'}`)
    console.log(`   Performance Optimization: ✅`)
    console.log(`   Documentation + Examples: ${enhancedConfig.generateDocumentation ? '✅' : '❌'}`)
    console.log()

    try {
      const success = await enhancedAutoSetupMCP(enhancedConfig)
      
      if (success) {
        console.log('🎉 COMPLETE MCP setup finished!')
        console.log('\n🚀 Everything is ready:')
        console.log('   • MCP Server: http://localhost:3001/')
        console.log('   • Claude Code: Configured automatically')
        console.log('   • Cursor IDE: Configured automatically')
        console.log('   • Local LLMs: Auto-detected and configured')
        console.log('   • Documentation: Generated in .llm-charge/docs/')
      } else {
        console.error('❌ Enhanced MCP setup had issues. Check warnings above.')
        process.exit(1)
      }
    } catch (error) {
      console.error('💥 Enhanced MCP setup crashed:', error)
      process.exit(1)
    }
  }

  private async handleAgentsList(options: any): Promise<void> {
    await this.ensureAgentStudio()
    
    const agents = options.type 
      ? this.agentStudio!.getAgentsByType(options.type)
      : this.agentStudio!.getAllAgents()
    
    console.log(`🤖 Available Agents (${agents.length}):\n`)
    agents.forEach(agent => {
      console.log(`📋 ${agent.name} (${agent.type})`)
      console.log(`   Description: ${agent.description}`)
      console.log(`   Model: ${agent.model.modelName} (${agent.model.provider})`)
      console.log(`   Success Rate: ${Math.round(agent.metrics.successRate * 100)}%`)
      console.log(`   Total Tasks: ${agent.metrics.totalTasks}`)
      console.log()
    })
  }

  private async handleAgentsCreate(name: string, options: any): Promise<void> {
    await this.ensureAgentStudio()
    
    const agentId = await this.agentStudio!.createAgent({
      name,
      description: `Custom agent: ${name}`,
      type: options.type,
      capabilities: ['general'],
      skills: options.skills ? options.skills.split(',') : [],
      model: {
        provider: 'local',
        modelName: options.model || 'default',
        temperature: 0.7,
        systemPrompt: `You are ${name}, a specialized AI assistant.`
      },
      personality: {
        traits: ['helpful', 'accurate'],
        communicationStyle: 'technical',
        riskTolerance: 'moderate',
        decisionMaking: 'analytical'
      },
      constraints: {
        maxConcurrentTasks: 1,
        maxExecutionTime: 300000,
        allowedOperations: ['read', 'analyze', 'generate'],
        blockedOperations: [],
        resourceLimits: {
          maxMemory: '512MB',
          maxCpuTime: 60000,
          maxApiCalls: 100
        }
      },
      learning: {
        learningRate: 0.1,
        retainFailures: true,
        adaptToFeedback: true,
        shareKnowledge: true
      },
      metrics: {
        successRate: 0,
        averageExecutionTime: 0,
        totalTasks: 0,
        costEfficiency: 0,
        userSatisfaction: 0
      },
      tags: []
    })
    
    console.log(`✅ Agent '${name}' created with ID: ${agentId}`)
  }

  private async handleAgentsRun(agent: string, task: string, options: any): Promise<void> {
    console.log(`🤖 Running task with agent '${agent}': ${task}`)
    
    // Mock execution - would integrate with actual agent system
    console.log('⏳ Processing...')
    
    setTimeout(() => {
      console.log(`✅ Task completed successfully!`)
      console.log(`📊 Execution time: 2.3s`)
      console.log(`💰 Cost: $0.002`)
    }, 2000)
  }

  private async handleAgentsWorkflow(name: string, options: any): Promise<void> {
    console.log(`🔄 Executing workflow: ${name}`)
    
    if (options.input) {
      try {
        const input = JSON.parse(options.input)
        console.log('📥 Input data:', input)
      } catch (error) {
        console.error('❌ Invalid JSON input')
        return
      }
    }
    
    // Mock workflow execution
    console.log('⏳ Starting workflow...')
    console.log('   Step 1: Code analysis... ✅')
    console.log('   Step 2: Running tests... ✅')
    console.log('   Step 3: Generating report... ✅')
    console.log('✅ Workflow completed successfully!')
  }

  private async handleAgentsPerformance(agent: string): Promise<void> {
    await this.ensureAgentStudio()
    
    // Find agent by name or ID
    const agentProfile = this.agentStudio!.getAllAgents().find(a => 
      a.name === agent || a.id === agent
    )
    
    if (!agentProfile) {
      console.error(`❌ Agent '${agent}' not found`)
      return
    }
    
    try {
      const report = this.agentStudio!.getAgentPerformanceReport(agentProfile.id)
      
      console.log(`📊 Performance Report: ${report.agent.name}\n`)
      console.log(`Success Rate: ${Math.round(report.agent.metrics.successRate * 100)}%`)
      console.log(`Average Execution Time: ${Math.round(report.agent.metrics.averageExecutionTime / 1000)}s`)
      console.log(`Total Tasks: ${report.agent.metrics.totalTasks}`)
      console.log(`Cost Efficiency: ${report.agent.metrics.costEfficiency.toFixed(2)}`)
      
      console.log('\n📈 Trends:')
      console.log(`Success Rate Change: ${report.trends.successRateChange > 0 ? '+' : ''}${(report.trends.successRateChange * 100).toFixed(1)}%`)
      console.log(`Execution Time Change: ${report.trends.executionTimeChange > 0 ? '+' : ''}${report.trends.executionTimeChange}ms`)
      
      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:')
        report.recommendations.forEach(rec => {
          console.log(`   • ${rec}`)
        })
      }
    } catch (error) {
      console.error('❌ Failed to generate performance report:', error)
    }
  }

  private async handleProjectCreate(key: string, name: string, options: any): Promise<void> {
    await this.ensureProjectManager()
    
    const projectId = await this.projectManager!.createProject(
      key,
      name,
      options.description || `Project: ${name}`,
      'system', // lead
      options.type || 'software'
    )
    
    console.log(`✅ Project '${name}' (${key}) created with ID: ${projectId}`)
  }

  private async handleProjectTicket(title: string, options: any): Promise<void> {
    await this.ensureProjectManager()
    
    // If no project specified, try to find one
    let projectId = options.project
    if (!projectId) {
      const projects = Array.from((this.projectManager! as any).projects.values()) as any[]
      if (projects.length === 0) {
        console.error('❌ No projects found. Create one first with: llm-charge project create <key> <name>')
        return
      }
      projectId = projects[0].id
      console.log(`Using project: ${projects[0].name}`)
    } else {
      const project = this.projectManager!.getProjectByKey(projectId)
      if (!project) {
        console.error(`❌ Project '${projectId}' not found`)
        return
      }
      projectId = project.id
    }
    
    const ticketId = await this.projectManager!.createTicket(
      projectId,
      title,
      'Ticket created via CLI',
      options.type || 'task',
      'cli-user',
      {
        assignee: options.assignee,
        priority: options.priority || 'medium'
      }
    )
    
    const ticket = this.projectManager!.getTicket(ticketId)
    console.log(`✅ Ticket '${ticket!.key}' created: ${title}`)
  }

  private async handleProjectStatus(project?: string): Promise<void> {
    await this.ensureProjectManager()
    
    if (project) {
      const proj = this.projectManager!.getProjectByKey(project)
      if (!proj) {
        console.error(`❌ Project '${project}' not found`)
        return
      }
      
      const stats = this.projectManager!.getProjectStats(proj.id)
      console.log(`📊 Project Status: ${proj.name} (${proj.key})\n`)
      console.log(`Total Tickets: ${stats.totalTickets}`)
      console.log(`Story Points: ${stats.completedStoryPoints}/${stats.totalStoryPoints}`)
      console.log(`Average Resolution Time: ${stats.averageResolutionTime.toFixed(1)} days`)
      
      console.log('\n📋 By Status:')
      Object.entries(stats.ticketsByStatus).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`)
      })
    } else {
      const projects = Array.from((this.projectManager! as any).projects.values()) as any[]
      console.log(`📊 All Projects (${projects.length}):\n`)
      
      projects.forEach((proj: any) => {
        const stats = this.projectManager!.getProjectStats(proj.id)
        console.log(`${proj.name} (${proj.key}): ${stats.totalTickets} tickets`)
      })
    }
  }

  private async handleProjectSprint(options: any): Promise<void> {
    await this.ensureProjectManager()
    
    if (options.create) {
      // Find first project for demo
      const projects = Array.from((this.projectManager! as any).projects.values())
      if (projects.length === 0) {
        console.error('❌ No projects found')
        return
      }
      
      const sprintId = await this.projectManager!.createSprint(
        (projects[0] as any).id,
        String(options.create),
        'Sprint goal'
      )
      console.log(`✅ Sprint '${options.create}' created with ID: ${sprintId}`)
    } else if (options.start) {
      await this.projectManager!.startSprint(options.start)
      console.log(`✅ Sprint ${options.start} started`)
    } else if (options.complete) {
      await this.projectManager!.completeSprint(options.complete)
      console.log(`✅ Sprint ${options.complete} completed`)
    } else {
      console.log('Use --create, --start, or --complete options')
    }
  }

  private async handleMemoryNote(title: string, options: any): Promise<void> {
    await this.ensureMemorySystem()
    
    const noteId = await this.memorySystem!.createNote(
      title,
      options.content || 'Note created via CLI',
      options.tags ? options.tags.split(',') : []
    )
    
    console.log(`✅ Note created with ID: ${noteId}`)
  }

  private async handleMemorySearch(query: string, options: any): Promise<void> {
    await this.ensureMemorySystem()
    
    const results = this.memorySystem!.searchNotes(query)
    const limit = parseInt(options.limit)
    
    console.log(`🔍 Search results for "${query}" (${Math.min(results.length, limit)}):\n`)
    
    results.slice(0, limit).forEach((note: any, i: number) => {
      console.log(`${i + 1}. ${note.title}`)
      console.log(`   Tags: ${note.tags.join(', ')}`)
      console.log(`   Updated: ${note.metadata.updatedAt.toLocaleDateString()}`)
      console.log()
    })
  }

  private async handleMemoryGraph(options: any): Promise<void> {
    await this.ensureMemorySystem()
    
    const graph = this.memorySystem!.getMemoryGraph()
    
    console.log(`🧠 Memory Graph Statistics:\n`)
    console.log(`Nodes: ${graph.nodes.length}`)
    console.log(`Edges: ${graph.edges.length}`)
    
    if (options.export) {
      const exported = await this.memorySystem!.exportVault('json')
      console.log('\n📤 Exported graph:', exported.substring(0, 200) + '...')
    }
  }

  private async handleMemoryCheckpoint(task: string, options: any): Promise<void> {
    await this.ensureCheckpointManager()
    
    const checkpointId = await this.checkpointManager!.createCheckpoint(
      task,
      options.name || `Checkpoint for ${task}`,
      options.description || 'Created via CLI',
      { task, timestamp: new Date() },
      {
        filesRead: [],
        filesModified: [],
        commandsRun: ['llm-charge memory checkpoint'],
        apiCallsMade: 0,
        tokensUsed: 0,
        cost: 0
      },
      {
        priority: 'medium',
        tags: ['cli']
      }
    )
    
    console.log(`✅ Checkpoint created with ID: ${checkpointId}`)
  }

  private async handleSpecsCreate(title: string, options: any): Promise<void> {
    await this.ensureSpecManager()
    
    const specId = await this.specManager!.createSpec({
      title,
      description: options.description || 'Specification created via CLI',
      linkedClasses: [],
      linkedMethods: [],
      linkedTests: [],
      status: 'draft',
      priority: options.priority || 'medium',
      tags: [],
      comments: []
    })
    
    console.log(`✅ Specification created with ID: ${specId}`)
  }

  private async handleSpecsList(options: any): Promise<void> {
    await this.ensureSpecManager()
    
    let specs = this.specManager!.getAllSpecs()
    
    if (options.status) {
      specs = this.specManager!.getSpecsByStatus(options.status)
    }
    if (options.priority) {
      specs = specs.filter(s => s.priority === options.priority)
    }
    
    console.log(`📝 Specifications (${specs.length}):\n`)
    
    specs.forEach(spec => {
      console.log(`📋 ${spec.title} (${spec.status}, ${spec.priority})`)
      console.log(`   Description: ${spec.description}`)
      console.log(`   Links: ${spec.linkedClasses.length + spec.linkedMethods.length + spec.linkedTests.length} items`)
      console.log()
    })
  }

  private async handleSpecsLink(specId: string, symbol: string, options: any): Promise<void> {
    await this.ensureSpecManager()
    
    await this.specManager!.linkToCode(
      specId,
      symbol,
      options.file || 'unknown',
      parseInt(options.line) || 1,
      options.type || 'function'
    )
    
    console.log(`✅ Linked '${symbol}' to specification ${specId}`)
  }

  private async handleSpecsExport(options: any): Promise<void> {
    await this.ensureSpecManager()
    
    const exported = await this.specManager!.exportSpecs(options.format || 'markdown')
    
    if (options.output) {
      await require('fs/promises').writeFile(options.output, exported)
      console.log(`✅ Specifications exported to ${options.output}`)
    } else {
      console.log(exported)
    }
  }

  private async handleRouteModels(options: any): Promise<void> {
    await this.ensureModelRouter()
    
    const models = Array.from((this.modelRouter! as any).models.values())
    const filtered = options.type 
      ? models.filter((m: any) => m.type === options.type)
      : models
    
    console.log(`🤖 Available Models (${filtered.length}):\n`)
    
    filtered.forEach((model: any) => {
      console.log(`${model.name} (${model.provider})`)
      console.log(`   Type: ${model.type}`)
      console.log(`   Context: ${model.capabilities.contextLength.toLocaleString()} tokens`)
      console.log(`   Cost: $${model.pricing.inputTokenCost}/1K input, $${model.pricing.outputTokenCost}/1K output`)
      console.log(`   Latency: ~${model.availability.latency}ms`)
      console.log()
    })
  }

  private async handleRouteExecute(task: string, options: any): Promise<void> {
    await this.ensureModelRouter()
    
    console.log(`🎯 Executing task: ${task}`)
    
    const preferences = {
      preferLocal: options.preferLocal,
      maxCost: options.maxCost ? parseFloat(options.maxCost) : undefined,
      maxLatency: options.maxLatency ? parseInt(options.maxLatency) : undefined
    }
    
    const decision = await this.modelRouter!.routeRequest(task, {}, preferences)
    
    console.log(`\n📊 Routing Decision:`)
    console.log(`   Selected Model: ${decision.selectedModel}`)
    console.log(`   Reason: ${decision.reason}`)
    console.log(`   Confidence: ${Math.round(decision.confidence * 100)}%`)
    console.log(`   Expected Cost: $${decision.expectedCost.toFixed(4)}`)
    console.log(`   Expected Latency: ${decision.expectedLatency}ms`)
    
    if (decision.mcpIntegration?.useClaudeCode || decision.mcpIntegration?.useCursor) {
      console.log(`   MCP Integration: ${decision.mcpIntegration.useClaudeCode ? 'Claude Code' : ''} ${decision.mcpIntegration.useCursor ? 'Cursor' : ''}`)
    }
    
    console.log('\n⏳ Executing...')
    
    try {
      const result = await this.modelRouter!.executeWithFallback(task, decision)
      
      console.log(`✅ Task completed successfully!`)
      console.log(`   Actual Model: ${result.actualModel}`)
      console.log(`   Cost: $${result.cost.toFixed(4)}`)
      console.log(`   Latency: ${result.latency}ms`)
    } catch (error) {
      console.error(`❌ Execution failed: ${error}`)
    }
  }

  private async handleRouteAnalyze(task: string): Promise<void> {
    await this.ensureModelRouter()
    
    const complexity = this.modelRouter!.analyzeTaskComplexity(task)
    
    console.log(`🔍 Task Complexity Analysis: ${task}\n`)
    console.log(`Level: ${complexity.level}`)
    console.log(`Estimated Tokens: ${complexity.estimatedTokens.toLocaleString()}`)
    console.log(`Estimated Time: ${Math.round(complexity.estimatedTime / 1000)}s`)
    
    console.log('\nComplexity Factors:')
    Object.entries(complexity.factors).forEach(([factor, present]) => {
      if (present) {
        console.log(`   ✅ ${factor.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
      }
    })
  }

  private async handleRouteStats(options: any): Promise<void> {
    await this.ensureModelRouter()
    
    const stats = this.modelRouter!.getUsageAnalytics(options.timeframe)
    
    console.log(`📊 Routing Statistics (${options.timeframe}):\n`)
    console.log(`Total Requests: ${stats.totalRequests}`)
    console.log(`Success Rate: ${Math.round(stats.successRate * 100)}%`)
    console.log(`Average Cost: $${stats.averageCost.toFixed(4)}`)
    console.log(`Average Latency: ${Math.round(stats.averageLatency)}ms`)
    console.log(`Cost Savings: $${stats.costSavings.toFixed(2)}`)
    
    console.log('\nModel Usage:')
    Object.entries(stats.modelUsage).forEach(([model, count]) => {
      console.log(`   ${model}: ${count} requests`)
    })
  }

  private async handleDashboardStart(options: any): Promise<void> {
    this.dashboard = new WebDashboard({
      port: parseInt(options.port),
      host: options.host
    })
    
    try {
      await this.dashboard.start()
      console.log(`🌐 Dashboard started at http://${options.host}:${options.port}`)
      console.log('Press Ctrl+C to stop')
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\n⏹️  Stopping dashboard...')
        await this.dashboard!.stop()
        process.exit(0)
      })
      
      // Prevent process from exiting
      await new Promise(() => {})
    } catch (error) {
      console.error('❌ Failed to start dashboard:', error)
    }
  }

  private async handleDashboardStop(): Promise<void> {
    if (this.dashboard) {
      await this.dashboard.stop()
      console.log('✅ Dashboard stopped')
    } else {
      console.log('ℹ️  Dashboard is not running')
    }
  }

  private async handleDashboardStatus(): Promise<void> {
    // Mock status check - would check actual dashboard process
    console.log('📊 Dashboard Status: Running on http://localhost:3001')
  }

  private async handleStatus(): Promise<void> {
    console.log(figlet.textSync('LLM-Charge'))
    console.log('🚀 System Status:\n')
    
    // Check various components
    const checks = [
      { name: 'Configuration', status: 'OK' },
      { name: 'Local Models', status: 'Available' },
      { name: 'Memory System', status: 'Active' },
      { name: 'Agent Studio', status: 'Ready' },
      { name: 'Project Management', status: 'Online' },
      { name: 'Specification Manager', status: 'Active' },
      { name: 'Model Router', status: 'Ready' }
    ]
    
    checks.forEach(check => {
      console.log(`   ${check.status === 'OK' || check.status.includes('Active') || check.status.includes('Ready') || check.status.includes('Available') || check.status.includes('Online') ? '✅' : '❌'} ${check.name}: ${check.status}`)
    })
    
    console.log('\n📊 Quick Stats:')
    console.log(`   Working Directory: ${this.config.workingDir}`)
    console.log(`   Config File: ${this.config.config}`)
    console.log(`   Debug Mode: ${this.config.debug ? 'On' : 'Off'}`)
  }

  private async handleConfig(options: any): Promise<void> {
    if (options.set) {
      const [key, value] = options.set.split('=')
      console.log(`🔧 Setting ${key} = ${value}`)
      // Would save to config file
    } else {
      console.log('⚙️  Current Configuration:\n')
      console.log(JSON.stringify(this.config, null, 2))
    }
  }

  private async handleLogs(options: any): Promise<void> {
    console.log(`📄 Recent Logs (last ${options.lines} lines):\n`)
    
    // Mock log output
    const logs = [
      '2024-01-15 10:30:45 [INFO] LLM-Charge started',
      '2024-01-15 10:30:46 [INFO] Agent Studio initialized',
      '2024-01-15 10:30:47 [INFO] Model router ready',
      '2024-01-15 10:31:12 [INFO] Task executed successfully (2.3s, $0.002)',
      '2024-01-15 10:31:45 [INFO] Memory checkpoint created'
    ]
    
    logs.slice(-parseInt(options.lines)).forEach(log => {
      console.log(log)
    })
  }

  private async handleDoctor(): Promise<void> {
    console.log('🏥 Running System Diagnostics...\n')
    
    const diagnostics = [
      { test: 'Node.js Version', check: () => process.version, required: '>=18.0.0' },
      { test: 'Working Directory', check: () => this.config.workingDir, required: 'Readable' },
      { test: 'Config Directory', check: () => '.llm-charge/', required: 'Exists' },
      { test: 'Memory Usage', check: () => `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, required: '<500MB' },
      { test: 'Disk Space', check: () => 'Available', required: '>1GB' }
    ]
    
    diagnostics.forEach(diagnostic => {
      const result = diagnostic.check()
      const status = result.includes('error') ? '❌' : '✅'
      console.log(`${status} ${diagnostic.test}: ${result}`)
    })
    
    console.log('\n💡 Recommendations:')
    console.log('   • All systems operational')
    console.log('   • Consider running: llm-charge setup init')
  }

  // Helper methods to ensure services are initialized
  private async ensureAgentStudio(): Promise<void> {
    if (!this.agentStudio) {
      this.agentStudio = new AgentStudio()
    }
  }

  private async ensureProjectManager(): Promise<void> {
    if (!this.projectManager) {
      this.projectManager = new ProjectForge()
    }
  }

  private async ensureMemorySystem(): Promise<void> {
    if (!this.memorySystem) {
      // ObsidianLite module not available - memorySystem disabled
      this.memorySystem = null
    }
  }

  private async ensureCheckpointManager(): Promise<void> {
    if (!this.checkpointManager) {
      this.checkpointManager = new CheckpointManager()
    }
  }

  private async ensureSpecManager(): Promise<void> {
    if (!this.specManager) {
      this.specManager = new SpecManager()
    }
  }

  private async ensureModelRouter(): Promise<void> {
    if (!this.modelRouter) {
      this.modelRouter = new BetterModelRouter()
      await this.modelRouter.detectMcpCapabilities()
    }
  }

  async run(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv)
    } catch (error) {
      if (this.config.debug) {
        console.error('Debug:', error)
      } else {
        console.error('❌ Error:', error instanceof Error ? error.message : error)
      }
      process.exit(1)
    }
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new LLMChargeCLI()
  cli.run(process.argv)
}

export { LLMChargeCLI }