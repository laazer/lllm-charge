#!/usr/bin/env node
// LLM-Charge CLI entry point for managing local LLM optimization
// FEATURE: Command line interface for unified LLM intelligence system

import { Command } from 'commander'
import { LLMChargeServer } from '@/mcp/llm-charge-server'
import { LLMOptimizationEngine } from '@/core/llm-optimization'
import { LLMChargeConfig } from '@/core/types'
import * as fs from 'fs/promises'
import * as path from 'path'
import figlet from 'figlet'

const program = new Command()

program
  .name('llm-charge')
  .description('Supercharge local LLMs with semantic code intelligence and recursive reasoning')
  .version('1.0.0')

program
  .command('serve')
  .description('Start the LLM-Charge MCP server')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-c, --config <path>', 'Config file path', '.llm-charge/config.json')
  .option('--port <number>', 'Server port', '8080')
  .action(async (options) => {
    console.log(figlet.textSync('LLM-Charge', { horizontalLayout: 'full' }))
    console.log('🚀 Starting LLM-Charge MCP Server...\n')

    try {
      const config = await loadConfig(options.config, options.project)
      const server = new LLMChargeServer(config, options.project)
      await server.start()
    } catch (error) {
      console.error('❌ Failed to start server:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('optimize')
  .description('Analyze and optimize local LLM performance')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-c, --config <path>', 'Config file path', '.llm-charge/config.json')
  .option('--workload <type>', 'Optimize for specific workload (code|reasoning|general)', 'general')
  .option('--benchmark', 'Run full model benchmarks')
  .action(async (options) => {
    console.log('🔧 Analyzing LLM Performance...\n')

    try {
      const config = await loadConfig(options.config, options.project)
      const { LocalLLMRouter } = await import('@/reasoning/local-llm-router')
      const { CostTracker } = await import('@/utils/cost-tracker')
      
      const router = new LocalLLMRouter(config.local, config.api)
      const costTracker = new CostTracker(config.api)
      const optimizer = new LLMOptimizationEngine(router, costTracker)

      if (options.benchmark) {
        console.log('📊 Running model benchmarks...')
        const performance = await optimizer.benchmarkLocalModels()
        console.table(performance)
      }

      console.log('📈 Generating optimization report...')
      const report = await optimizer.analyzeCurrentSetup()
      
      console.log('\n🎯 Optimization Recommendations:')
      report.recommendedStrategies.forEach((strategy, i) => {
        console.log(`${i + 1}. ${strategy.name}: ${strategy.description}`)
      })

      console.log('\n💰 Projected Savings:')
      console.log(`  • Cost: $${report.projectedSavings.cost.toFixed(4)}`)
      console.log(`  • Tokens: ${report.projectedSavings.tokens.toLocaleString()}`)
      console.log(`  • Latency: ${report.projectedSavings.latency}ms`)

      if (report.implementationPlan.length > 0) {
        console.log('\n📋 Implementation Plan:')
        report.implementationPlan.forEach((step, i) => {
          console.log(`  ${i + 1}. ${step}`)
        })
      }

      // Workload-specific optimization
      if (options.workload !== 'general') {
        console.log(`\n🎯 Optimizing for ${options.workload} workload...`)
        const workloadOpt = await optimizer.optimizeForWorkload(options.workload as any)
        console.log(`Recommended model: ${workloadOpt.recommendedModel}`)
        console.log('Optimal settings:', workloadOpt.optimalSettings)
      }

    } catch (error) {
      console.error('❌ Optimization failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Initialize LLM-Charge in a project')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('--provider <provider>', 'Local LLM provider (ollama|lmstudio|vllm)', 'ollama')
  .option('--model <model>', 'Primary model name', 'llama3.2')
  .option('--host <host>', 'Local LLM host', 'http://localhost:11434')
  .action(async (options) => {
    console.log('🎯 Initializing LLM-Charge...\n')

    try {
      const projectPath = path.resolve(options.project)
      const configDir = path.join(projectPath, '.llm-charge')
      
      await fs.mkdir(configDir, { recursive: true })
      await fs.mkdir(path.join(configDir, 'cache'), { recursive: true })
      await fs.mkdir(path.join(configDir, 'sessions'), { recursive: true })

      const config: LLMChargeConfig = {
        intelligence: {
          enableCodeGraph: true,
          enableContextPlus: true,
          enableSemanticSearch: true,
          enableMemoryGraph: true,
          cacheDir: path.join(configDir, 'cache'),
          maxFileSize: 1048576,
          embedModel: 'nomic-embed-text'
        },
        reasoning: {
          enableRLM: true,
          maxDepth: 5,
          environment: 'local',
          timeoutMs: 120000,
          maxIterations: 10
        },
        local: {
          provider: options.provider as any,
          baseUrl: options.host,
          models: {
            primary: options.model,
            reasoning: options.model,
            embedding: 'nomic-embed-text',
            chat: options.model
          },
          maxTokens: 4000,
          temperature: 0.3
        },
        api: {
          providers: {},
          fallbackStrategy: 'local-first',
          maxCostPerHour: 1.0,
          trackUsage: true
        },
        cache: {
          enableEmbeddingCache: true,
          enableContextCache: true,
          enableResultCache: true,
          ttlSeconds: 3600,
          maxSizeMB: 500
        }
      }

      const configPath = path.join(configDir, 'config.json')
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      // Create example MCP configuration
      const mcpConfig = {
        mcpServers: {
          "llm-charge": {
            type: "stdio",
            command: "npx",
            args: ["llm-charge", "serve", "--project", projectPath],
            env: {
              OLLAMA_EMBED_MODEL: "nomic-embed-text",
              OLLAMA_API_KEY: "your-api-key-if-needed"
            }
          }
        }
      }

      await fs.writeFile(
        path.join(projectPath, '.claude.json'),
        JSON.stringify(mcpConfig, null, 2)
      )

      console.log('✅ LLM-Charge initialized successfully!')
      console.log(`📁 Config directory: ${configDir}`)
      console.log(`⚙️  Configuration: ${configPath}`)
      console.log(`🔌 Claude MCP config: ${path.join(projectPath, '.claude.json')}`)
      
      console.log('\n🚀 Next steps:')
      console.log('1. Run "llm-charge serve" to start the MCP server')
      console.log('2. Configure your IDE to use the .claude.json MCP configuration')
      console.log('3. Run "llm-charge optimize" to analyze your setup')

    } catch (error) {
      console.error('❌ Initialization failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show LLM-Charge system status')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-c, --config <path>', 'Config file path', '.llm-charge/config.json')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config, options.project)
      const { CostTracker } = await import('@/utils/cost-tracker')
      const costTracker = new CostTracker(config.api)

      console.log('📊 LLM-Charge Status\n')

      // Cost metrics
      const metrics = costTracker.getMetrics('day')
      console.log('💰 Cost Metrics (24h):')
      console.log(`  • Total Requests: ${metrics.totalRequests}`)
      console.log(`  • Local Requests: ${metrics.localRequests} (${((metrics.localRequests / metrics.totalRequests) * 100 || 0).toFixed(1)}%)`)
      console.log(`  • API Requests: ${metrics.apiRequests}`)
      console.log(`  • Estimated Cost: $${metrics.estimatedCost.toFixed(4)}`)
      console.log(`  • Cost Saved: $${metrics.costSaved.toFixed(4)}`)
      console.log(`  • Avg Latency: ${metrics.avgLatency.toFixed(0)}ms`)

      // System status
      console.log('\n🔧 System Status:')
      console.log(`  • Intelligence: ${config.intelligence.enableCodeGraph && config.intelligence.enableContextPlus ? '✅' : '⚠️ '}`)
      console.log(`  • Reasoning: ${config.reasoning.enableRLM ? '✅' : '⚠️ '}`)
      console.log(`  • Caching: ${config.cache.enableEmbeddingCache ? '✅' : '⚠️ '}`)
      console.log(`  • Local Provider: ${config.local.provider}`)
      console.log(`  • Primary Model: ${config.local.models.primary}`)

      // Cache status
      const cacheDir = config.intelligence.cacheDir
      try {
        const cacheStats = await fs.stat(cacheDir)
        console.log(`\n💾 Cache Status:`)
        console.log(`  • Directory: ${cacheDir}`)
        console.log(`  • Last Modified: ${cacheStats.mtime.toLocaleString()}`)
      } catch (error) {
        console.log(`\n💾 Cache Status: Not initialized`)
      }

    } catch (error) {
      console.error('❌ Status check failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program
  .command('reset')
  .description('Reset LLM-Charge cache and settings')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('--hard', 'Delete all data including cost tracking')
  .action(async (options) => {
    const projectPath = path.resolve(options.project)
    const configDir = path.join(projectPath, '.llm-charge')

    try {
      if (options.hard) {
        await fs.rm(configDir, { recursive: true, force: true })
        console.log('🗑️  Hard reset completed - all data removed')
      } else {
        await fs.rm(path.join(configDir, 'cache'), { recursive: true, force: true })
        await fs.mkdir(path.join(configDir, 'cache'), { recursive: true })
        console.log('🧹 Cache cleared')
      }
    } catch (error) {
      console.error('❌ Reset failed:', error instanceof Error ? error.message : String(error))
    }
  })

async function loadConfig(configPath: string, projectPath: string): Promise<LLMChargeConfig> {
  const fullConfigPath = path.isAbsolute(configPath) 
    ? configPath 
    : path.join(projectPath, configPath)

  try {
    const configData = await fs.readFile(fullConfigPath, 'utf-8')
    return JSON.parse(configData)
  } catch (error) {
    throw new Error(`Failed to load config from ${fullConfigPath}. Run 'llm-charge init' first.`)
  }
}

if (require.main === module) {
  program.parse()
}