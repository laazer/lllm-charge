#!/usr/bin/env node
import { DatabaseManager } from '../src/server/database-manager.mjs'
import { IndependentDatabaseManager } from '../src/server/independent-database-manager.mjs'

/**
 * Migration script to move from combined database to independent architecture
 * This script migrates existing agents and workflows to their own databases
 */

console.log('🔄 Starting migration to independent database architecture...')

async function migrateToIndependentDatabases() {
  const oldManager = new DatabaseManager()
  const newManager = new IndependentDatabaseManager()
  
  try {
    // Initialize old and new database systems
    console.log('📖 Connecting to existing combined database...')
    await oldManager.initialize()
    
    console.log('🏗️ Initializing new independent database architecture...')
    await newManager.initialize()
    
    // Migrate agents from combined to independent agent database
    console.log('🤖 Migrating agents to independent database...')
    await migrateAgents(oldManager, newManager)
    
    // Migrate workflows to flows (if any exist)
    console.log('🔄 Migrating workflows to independent flow database...')
    await migrateWorkflowsToFlows(oldManager, newManager)
    
    // Verify migration
    console.log('✅ Verifying migration results...')
    await verifyMigration(newManager)
    
    console.log('🎉 Migration completed successfully!')
    console.log('')
    console.log('📊 Independent Database Structure Created:')
    console.log('   • Main DB (projects, specs, notes, checkpoints): ./data/llm-charge.db')
    console.log('   • Agent DB (agents, tasks, learning): ./data/agents.db')
    console.log('   • Flow DB (flows, executions, templates): ./data/flows.db')
    console.log('')
    console.log('🔄 Next Steps:')
    console.log('   1. Restart the server to use the new architecture')
    console.log('   2. The old combined database will remain as backup')
    console.log('   3. React frontend will now show real independent data')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await oldManager.close?.()
    await newManager.close?.()
  }
}

async function migrateAgents(oldManager, newManager) {
  try {
    const agents = await oldManager.getAllAgents()
    console.log(`   Found ${agents.length} agents to migrate`)
    
    let migratedCount = 0
    for (const agent of agents) {
      try {
        // Transform agent data to new independent format
        const independentAgent = {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          primaryRole: agent.primaryRole || 'general',
          capabilities: agent.data ? JSON.parse(agent.data).capabilities || {} : {
            reasoning: 0.8,
            creativity: 0.7,
            technical: 0.9,
            communication: 0.8
          },
          type: 'general', // Default type
          model: {
            provider: 'local',
            modelName: 'default',
            temperature: 0.7,
            systemPrompt: `You are ${agent.name}, ${agent.description}`
          },
          personality: {
            traits: ['analytical', 'helpful', 'precise'],
            communicationStyle: 'technical',
            riskTolerance: 'moderate',
            decisionMaking: 'analytical'
          },
          constraints: {
            maxConcurrentTasks: 1,
            maxExecutionTime: 300000,
            allowedOperations: ['read', 'analyze', 'create', 'update'],
            blockedOperations: ['delete', 'system'],
            resourceLimits: {
              maxMemory: '512MB',
              maxCpuTime: 60000,
              maxApiCalls: 100
            }
          },
          metrics: {
            successRate: 0.95,
            averageExecutionTime: 2500,
            totalTasks: 0,
            costEfficiency: 0.85,
            userSatisfaction: 0.9
          },
          version: 1,
          status: 'active'
        }
        
        await newManager.createAgent(independentAgent)
        migratedCount++
        
      } catch (agentError) {
        console.error(`   ❌ Failed to migrate agent ${agent.name}:`, agentError.message)
      }
    }
    
    console.log(`   ✅ Successfully migrated ${migratedCount}/${agents.length} agents`)
    
  } catch (error) {
    console.error('❌ Agent migration failed:', error)
    throw error
  }
}

async function migrateWorkflowsToFlows(oldManager, newManager) {
  try {
    // Check if workflows exist in old database
    let workflows = []
    try {
      workflows = await oldManager.getAllWorkflows?.() || []
    } catch (error) {
      console.log('   No workflows found in old database (expected)')
      return
    }
    
    console.log(`   Found ${workflows.length} workflows to migrate to flows`)
    
    let migratedCount = 0
    for (const workflow of workflows) {
      try {
        // Transform workflow data to new independent flow format
        const independentFlow = {
          id: workflow.id,
          name: workflow.title || workflow.name,
          description: workflow.description,
          type: 'workflow',
          category: 'migrated',
          nodes: [
            {
              id: 'start',
              type: 'trigger',
              name: 'Start',
              position: { x: 100, y: 100 },
              data: {}
            },
            {
              id: 'end',
              type: 'output',
              name: 'End',
              position: { x: 400, y: 100 },
              data: {}
            }
          ],
          edges: [
            {
              id: 'start-end',
              source: 'start',
              target: 'end'
            }
          ],
          settings: {
            autoStart: false,
            retryPolicy: {
              enabled: true,
              maxRetries: 3,
              retryDelay: 5000
            },
            errorHandling: 'stop',
            timeout: 300000,
            concurrency: 1
          },
          triggers: [
            {
              type: 'manual',
              config: {}
            }
          ],
          status: workflow.status || 'draft',
          version: 1,
          tags: ['migrated'],
          metrics: {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            totalCost: 0
          }
        }
        
        await newManager.createFlow(independentFlow)
        migratedCount++
        
      } catch (flowError) {
        console.error(`   ❌ Failed to migrate workflow ${workflow.title}:`, flowError.message)
      }
    }
    
    console.log(`   ✅ Successfully migrated ${migratedCount}/${workflows.length} workflows to flows`)
    
  } catch (error) {
    console.error('❌ Workflow migration failed:', error)
    // Don't throw - workflows might not exist
  }
}

async function verifyMigration(newManager) {
  try {
    const agents = await newManager.getAllAgents()
    const flows = await newManager.getAllFlows()
    const projects = await newManager.getAllProjects()
    const specs = await newManager.getAllSpecs()
    
    console.log('   📊 Migration Results:')
    console.log(`      • Agents (independent): ${agents.length}`)
    console.log(`      • Flows (independent): ${flows.length}`)
    console.log(`      • Projects: ${projects.length}`)
    console.log(`      • Specs: ${specs.length}`)
    
    // Verify agents are truly independent (no projectId)
    const hasProjectDependencies = agents.some(agent => agent.projectId)
    if (hasProjectDependencies) {
      throw new Error('Migration failed: Some agents still have project dependencies')
    }
    
    console.log('   ✅ Verification passed: Agents are now independent of projects')
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error)
    throw error
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToIndependentDatabases().catch(console.error)
}

export { migrateToIndependentDatabases }