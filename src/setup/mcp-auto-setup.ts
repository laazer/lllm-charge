// Automated MCP Setup System
// One-command initialization for CodeGraph, ContextPlus, and all MCP tools

import { spawn, execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import path from 'path'
import { MCPClientManager } from '../mcp/client-tools'

export interface MCPSetupConfig {
  workingDir: string
  enableCodeGraph: boolean
  enableContextPlus: boolean
  enableLLMChargeServer: boolean
  autoStart: boolean
  skipExistingInit: boolean
}

export class MCPAutoSetup {
  private config: MCPSetupConfig
  private progress: Array<{ step: string; status: 'pending' | 'running' | 'completed' | 'error'; message?: string }> = []

  constructor(config: Partial<MCPSetupConfig> = {}) {
    this.config = {
      workingDir: process.cwd(),
      enableCodeGraph: true,
      enableContextPlus: true, 
      enableLLMChargeServer: true,
      autoStart: true,
      skipExistingInit: false,
      ...config
    }
  }

  async setupEverything(): Promise<{ success: boolean; errors: string[] }> {
    console.log('🚀 Starting automated MCP setup...\n')
    
    const errors: string[] = []
    
    try {
      // Step 1: Check prerequisites
      await this.checkPrerequisites()
      
      // Step 2: Initialize CodeGraph if needed
      if (this.config.enableCodeGraph) {
        await this.setupCodeGraph()
      }
      
      // Step 3: Initialize ContextPlus if needed  
      if (this.config.enableContextPlus) {
        await this.setupContextPlus()
      }
      
      // Step 4: Setup LLM-Charge MCP server
      if (this.config.enableLLMChargeServer) {
        await this.setupLLMChargeServer()
      }
      
      // Step 5: Create unified configuration
      await this.createUnifiedConfig()
      
      // Step 6: Auto-start services if requested
      if (this.config.autoStart) {
        await this.startServices()
      }
      
      // Step 7: Verify everything works
      await this.verifySetup()
      
      this.printSummary()
      return { success: true, errors }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push(errorMsg)
      console.error('❌ Setup failed:', errorMsg)
      return { success: false, errors }
    }
  }

  private async checkPrerequisites(): Promise<void> {
    this.addProgress('Checking prerequisites', 'running')
    
    // Check Node.js version
    const nodeVersion = process.version
    if (!nodeVersion.match(/^v(18|19|20|21)/)) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`)
    }
    
    // Check npm/pnpm availability
    try {
      execSync('npm --version', { stdio: 'ignore' })
    } catch {
      throw new Error('npm not found - please install Node.js')
    }
    
    // Check if we can install packages
    const packageJson = path.join(this.config.workingDir, 'package.json')
    if (!existsSync(packageJson)) {
      console.log('📦 No package.json found, creating minimal one...')
      writeFileSync(packageJson, JSON.stringify({
        name: 'mcp-workspace',
        version: '1.0.0',
        type: 'module'
      }, null, 2))
    }
    
    this.completeProgress('Checking prerequisites')
  }

  private async setupCodeGraph(): Promise<void> {
    this.addProgress('Setting up CodeGraph', 'running')
    
    const codeGraphDir = path.join(this.config.workingDir, '.codegraph')
    
    if (existsSync(codeGraphDir) && this.config.skipExistingInit) {
      console.log('📊 CodeGraph already initialized, skipping...')
      this.completeProgress('Setting up CodeGraph')
      return
    }
    
    try {
      // Install codegraph globally if not present
      try {
        execSync('npx codegraph --version', { stdio: 'ignore' })
      } catch {
        console.log('📦 Installing CodeGraph...')
        await this.runCommand('npm', ['install', '-g', '@codegraph/cli'])
      }
      
      // Initialize CodeGraph
      console.log('📊 Initializing CodeGraph...')
      if (existsSync(codeGraphDir)) {
        await this.runCommand('rm', ['-rf', codeGraphDir])
      }
      
      await this.runCommand('npx', ['codegraph', 'init', '-i'], {
        cwd: this.config.workingDir,
        stdio: 'pipe'
      })
      
      // Wait for indexing to complete
      console.log('⏳ Waiting for CodeGraph indexing...')
      await this.waitForCodeGraphIndexing()
      
      this.completeProgress('Setting up CodeGraph')
      
    } catch (error) {
      this.errorProgress('Setting up CodeGraph', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  private async setupContextPlus(): Promise<void> {
    this.addProgress('Setting up ContextPlus', 'running')
    
    try {
      // For now, ContextPlus is integrated into LLM-Charge
      // In the future, this would setup external ContextPlus
      console.log('🧠 ContextPlus integrated into LLM-Charge server')
      this.completeProgress('Setting up ContextPlus')
      
    } catch (error) {
      this.errorProgress('Setting up ContextPlus', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  private async setupLLMChargeServer(): Promise<void> {
    this.addProgress('Setting up LLM-Charge MCP Server', 'running')
    
    try {
      // Create MCP server configuration
      const mcpConfig = {
        servers: {
          'llm-charge': {
            command: 'node',
            args: [path.join(__dirname, '../mcp/llm-charge-server.js')],
            env: {
              NODE_ENV: 'production'
            }
          }
        }
      }
      
      // Create .llm-charge directory
      const configDir = path.join(this.config.workingDir, '.llm-charge')
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true })
      }
      
      // Write MCP configuration
      const mcpConfigPath = path.join(configDir, 'mcp-config.json')
      writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))
      
      this.completeProgress('Setting up LLM-Charge MCP Server')
      
    } catch (error) {
      this.errorProgress('Setting up LLM-Charge MCP Server', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  private async createUnifiedConfig(): Promise<void> {
    this.addProgress('Creating unified configuration', 'running')
    
    const configDir = path.join(this.config.workingDir, '.llm-charge')
    const configPath = path.join(configDir, 'config.json')
    
    const unifiedConfig = {
      version: '1.0.0',
      mcp: {
        enabled: true,
        servers: {
          'llm-charge': {
            enabled: this.config.enableLLMChargeServer,
            autoStart: this.config.autoStart
          }
        },
        tools: {
          codegraph: {
            enabled: this.config.enableCodeGraph,
            path: this.config.workingDir
          },
          contextplus: {
            enabled: this.config.enableContextPlus,
            integrated: true
          }
        }
      },
      dashboard: {
        port: 3001,
        autoStart: this.config.autoStart
      },
      optimization: {
        enabled: true,
        costTracking: true,
        hybridRouting: true
      }
    }
    
    writeFileSync(configPath, JSON.stringify(unifiedConfig, null, 2))
    
    this.completeProgress('Creating unified configuration')
  }

  private async startServices(): Promise<void> {
    this.addProgress('Starting services', 'running')
    
    try {
      // Start LLM-Charge server
      console.log('🚀 Starting LLM-Charge server...')
      const serverPath = path.join(__dirname, '../server/working-server.mjs')
      
      spawn('node', [serverPath], {
        detached: true,
        stdio: 'ignore',
        cwd: this.config.workingDir
      })
      
      // Wait for server to be ready
      await this.waitForServer('http://localhost:3001/api/status', 10000)
      
      this.completeProgress('Starting services')
      
    } catch (error) {
      this.errorProgress('Starting services', error instanceof Error ? error.message : String(error))
      // Don't throw - services can be started manually
    }
  }

  private async verifySetup(): Promise<void> {
    this.addProgress('Verifying setup', 'running')
    
    const issues: string[] = []
    
    // Check CodeGraph
    if (this.config.enableCodeGraph) {
      const codeGraphDir = path.join(this.config.workingDir, '.codegraph')
      if (!existsSync(codeGraphDir)) {
        issues.push('CodeGraph not initialized')
      }
    }
    
    // Check LLM-Charge config
    const configPath = path.join(this.config.workingDir, '.llm-charge/config.json')
    if (!existsSync(configPath)) {
      issues.push('LLM-Charge config not created')
    }
    
    // Test MCP connection
    try {
      const client = new MCPClientManager({
        serverCommand: 'node',
        serverArgs: [path.join(__dirname, '../mcp/llm-charge-server.js')],
        timeout: 5000,
        costTracking: true,
        caching: { enabled: true, ttl: 300, maxSize: 100 }
      })
      
      await client.initialize()
      console.log('✅ MCP client connection successful')
    } catch (error) {
      issues.push(`MCP connection failed: ${error}`)
    }
    
    if (issues.length > 0) {
      throw new Error(`Verification failed: ${issues.join(', ')}`)
    }
    
    this.completeProgress('Verifying setup')
  }

  private async runCommand(command: string, args: string[], options: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: 'pipe',
        ...options
      })
      
      let output = ''
      proc.stdout?.on('data', (data) => {
        output += data.toString()
      })
      
      proc.stderr?.on('data', (data) => {
        output += data.toString()
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(' ')}\\n${output}`))
        }
      })
    })
  }

  private async waitForCodeGraphIndexing(): Promise<void> {
    const maxWait = 30000 // 30 seconds
    const start = Date.now()
    
    while (Date.now() - start < maxWait) {
      try {
        const statusPath = path.join(this.config.workingDir, '.codegraph/status.json')
        if (existsSync(statusPath)) {
          const status = JSON.parse(readFileSync(statusPath, 'utf8'))
          if (status.indexed && status.nodes > 0) {
            console.log(`📊 CodeGraph indexed ${status.nodes} nodes`)
            return
          }
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('⚠️  CodeGraph indexing may still be in progress')
  }

  private async waitForServer(url: string, timeout: number): Promise<void> {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          console.log('✅ Server is ready')
          return
        }
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Server did not start within timeout')
  }

  private addProgress(step: string, status: 'pending' | 'running' | 'completed' | 'error', message?: string): void {
    this.progress.push({ step, status, message })
    const emoji = status === 'running' ? '🔄' : status === 'completed' ? '✅' : status === 'error' ? '❌' : '⏳'
    console.log(`${emoji} ${step}${message ? `: ${message}` : ''}`)
  }

  private completeProgress(step: string): void {
    const item = this.progress.find(p => p.step === step)
    if (item) {
      item.status = 'completed'
      console.log(`✅ ${step}`)
    }
  }

  private errorProgress(step: string, message: string): void {
    const item = this.progress.find(p => p.step === step)
    if (item) {
      item.status = 'error'
      item.message = message
      console.log(`❌ ${step}: ${message}`)
    }
  }

  private printSummary(): void {
    console.log('\\n🎉 MCP Setup Complete!\\n')
    
    console.log('📋 Setup Summary:')
    this.progress.forEach(({ step, status }) => {
      const emoji = status === 'completed' ? '✅' : status === 'error' ? '❌' : '⚠️'
      console.log(`  ${emoji} ${step}`)
    })
    
    console.log('\\n🚀 Quick Start:')
    console.log('  1. Server: http://localhost:3001')
    console.log('  2. Dashboard: http://localhost:3001/')  
    console.log('  3. MCP Tools: Ready for Claude Code/Cursor integration')
    
    console.log('\\n💡 Next Steps:')
    console.log('  • Open dashboard to see real-time metrics')
    console.log('  • Configure Claude Code with MCP server')
    console.log('  • Start using intelligent code analysis tools')
    
    console.log('\\n📚 Config Location: .llm-charge/config.json')
  }
}

// CLI integration
export async function autoSetupMCP(options: Partial<MCPSetupConfig> = {}): Promise<boolean> {
  const setup = new MCPAutoSetup(options)
  const result = await setup.setupEverything()
  
  if (!result.success) {
    console.error('\\n💥 Setup failed with errors:')
    result.errors.forEach(error => console.error(`  ❌ ${error}`))
    return false
  }
  
  return true
}