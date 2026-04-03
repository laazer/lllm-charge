// Load Default Agents, Skills, and Specs
// Automatically sets up the project with the developed capabilities

import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface DefaultSetupConfig {
  baseUrl: string
  projectId: string
  overwriteExisting: boolean
  loadAgents: boolean
  loadSkills: boolean 
  loadSpecs: boolean
}

export class DefaultSetupLoader {
  private config: DefaultSetupConfig
  private defaultsPath: string

  constructor(config: DefaultSetupConfig) {
    this.config = config
    this.defaultsPath = join(__dirname, 'default-agents-skills.json')
  }

  async loadAllDefaults(): Promise<{
    loaded: {
      agents: number
      skills: number
      specs: number
    }
    skipped: {
      agents: number
      skills: number
      specs: number
    }
    errors: string[]
  }> {
    console.log('🔄 Loading default agents, skills, and specs...')
    
    const results = {
      loaded: { agents: 0, skills: 0, specs: 0 },
      skipped: { agents: 0, skills: 0, specs: 0 },
      errors: [] as string[]
    }

    try {
      // Load the defaults file
      const defaultsData = JSON.parse(await fs.readFile(this.defaultsPath, 'utf8'))
      
      // Load agents
      if (this.config.loadAgents && defaultsData.agents) {
        const agentResults = await this.loadAgents(defaultsData.agents)
        results.loaded.agents = agentResults.loaded
        results.skipped.agents = agentResults.skipped
        results.errors.push(...agentResults.errors)
      }
      
      // Load skills (as specs with special tags)
      if (this.config.loadSkills && defaultsData.skills) {
        const skillResults = await this.loadSkills(defaultsData.skills)
        results.loaded.skills = skillResults.loaded
        results.skipped.skills = skillResults.skipped
        results.errors.push(...skillResults.errors)
      }
      
      // Load specs
      if (this.config.loadSpecs && defaultsData.specs) {
        const specResults = await this.loadSpecs(defaultsData.specs)
        results.loaded.specs = specResults.loaded
        results.skipped.specs = specResults.skipped
        results.errors.push(...specResults.errors)
      }
      
      console.log('✅ Default setup complete!')
      console.log(`   Loaded: ${results.loaded.agents} agents, ${results.loaded.skills} skills, ${results.loaded.specs} specs`)
      if (results.skipped.agents + results.skipped.skills + results.skipped.specs > 0) {
        console.log(`   Skipped: ${results.skipped.agents} agents, ${results.skipped.skills} skills, ${results.skipped.specs} specs`)
      }
      if (results.errors.length > 0) {
        console.log(`   Errors: ${results.errors.length}`)
      }
      
    } catch (error) {
      const errorMsg = `Failed to load defaults: ${error instanceof Error ? error.message : 'Unknown error'}`
      results.errors.push(errorMsg)
      console.error('❌', errorMsg)
    }

    return results
  }

  private async loadAgents(agents: any[]): Promise<{
    loaded: number
    skipped: number
    errors: string[]
  }> {
    console.log(`📊 Loading ${agents.length} default agents...`)
    
    let loaded = 0
    let skipped = 0
    const errors: string[] = []

    for (const agent of agents) {
      try {
        // Check if agent already exists (by name)
        const existingAgent = await this.findExistingAgent(agent.name)
        
        if (existingAgent && !this.config.overwriteExisting) {
          console.log(`   Skipping agent "${agent.name}" (already exists)`)
          skipped++
          continue
        }
        
        // Prepare agent data
        const agentData = {
          name: agent.name,
          description: agent.description,
          primaryRole: agent.primaryRole,
          projectId: this.config.projectId,
          capabilities: agent.capabilities || {
            reasoning: 0.8,
            creativity: 0.7,
            technical: 0.9,
            communication: 0.8
          }
        }
        
        // Create or update agent
        if (existingAgent && this.config.overwriteExisting) {
          await this.updateAgent(existingAgent.id, agentData)
          console.log(`   Updated agent "${agent.name}"`)
        } else {
          await this.createAgent(agentData)
          console.log(`   Created agent "${agent.name}"`)
        }
        
        loaded++
        
      } catch (error) {
        const errorMsg = `Failed to load agent "${agent.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(`   ❌ ${errorMsg}`)
      }
    }

    return { loaded, skipped, errors }
  }

  private async loadSkills(skills: any[]): Promise<{
    loaded: number
    skipped: number
    errors: string[]
  }> {
    console.log(`🛠️  Loading ${skills.length} default skills...`)
    
    let loaded = 0
    let skipped = 0
    const errors: string[] = []

    for (const skill of skills) {
      try {
        // Check if skill already exists (by name as spec)
        const existingSkill = await this.findExistingSpec(`${skill.name} Skill Documentation`)
        
        if (existingSkill && !this.config.overwriteExisting) {
          console.log(`   Skipping skill "${skill.name}" (already exists)`)
          skipped++
          continue
        }
        
        // Create skill as a spec with special formatting
        const skillSpec = {
          title: `${skill.name} Skill Documentation`,
          description: this.formatSkillDescription(skill),
          status: 'active',
          priority: 'high',
          tags: ['skill', 'capability', ...(skill.tags || [])],
          projectId: this.config.projectId
        }
        
        // Create or update skill spec
        if (existingSkill && this.config.overwriteExisting) {
          await this.updateSpec(existingSkill.id, skillSpec)
          console.log(`   Updated skill "${skill.name}"`)
        } else {
          await this.createSpec(skillSpec)
          console.log(`   Created skill "${skill.name}"`)
        }
        
        loaded++
        
      } catch (error) {
        const errorMsg = `Failed to load skill "${skill.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(`   ❌ ${errorMsg}`)
      }
    }

    return { loaded, skipped, errors }
  }

  private async loadSpecs(specs: any[]): Promise<{
    loaded: number
    skipped: number
    errors: string[]
  }> {
    console.log(`📋 Loading ${specs.length} default specs...`)
    
    let loaded = 0
    let skipped = 0
    const errors: string[] = []

    for (const spec of specs) {
      try {
        // Check if spec already exists (by title)
        const existingSpec = await this.findExistingSpec(spec.title)
        
        if (existingSpec && !this.config.overwriteExisting) {
          console.log(`   Skipping spec "${spec.title}" (already exists)`)
          skipped++
          continue
        }
        
        // Prepare spec data
        const specData = {
          title: spec.title,
          description: spec.description,
          status: spec.status || 'active',
          priority: spec.priority || 'medium',
          tags: spec.tags || [],
          projectId: this.config.projectId
        }
        
        // Create or update spec
        if (existingSpec && this.config.overwriteExisting) {
          await this.updateSpec(existingSpec.id, specData)
          console.log(`   Updated spec "${spec.title}"`)
        } else {
          await this.createSpec(specData)
          console.log(`   Created spec "${spec.title}"`)
        }
        
        loaded++
        
      } catch (error) {
        const errorMsg = `Failed to load spec "${spec.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(`   ❌ ${errorMsg}`)
      }
    }

    return { loaded, skipped, errors }
  }

  private formatSkillDescription(skill: any): string {
    return `# ${skill.name} Skill

## Overview
${skill.description}

## Category
**${skill.category.charAt(0).toUpperCase() + skill.category.slice(1)}**

## Capabilities
${skill.capabilities.map((cap: string) => `- **${cap}**`).join('\n')}

## Technologies
${skill.technologies.join(' • ')}

## Cost Savings
**${skill.costSavings}** reduction in related API costs

## Implementation
- **File**: \`${skill.file}\`
- **Status**: Production-ready
- **Integration**: MCP protocol compliant

## Usage
This skill can be used independently or as part of larger agent workflows for maximum effectiveness.

## Tags
${(skill.tags || []).map((tag: string) => `\`${tag}\``).join(' ')}`
  }

  // API methods
  private async findExistingAgent(name: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/agents`)
      if (!response.ok) return null
      
      const agents = await response.json()
      return agents.find((agent: any) => agent.name === name)
    } catch (error) {
      return null
    }
  }

  private async findExistingSpec(title: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/specs`)
      if (!response.ok) return null
      
      const specs = await response.json()
      return specs.find((spec: any) => spec.title === title)
    } catch (error) {
      return null
    }
  }

  private async createAgent(agentData: any): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  }

  private async updateAgent(agentId: string, agentData: any): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  }

  private async createSpec(specData: any): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/specs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(specData)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  }

  private async updateSpec(specId: string, specData: any): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/specs/${specId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(specData)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  }
}

// Check if server is running
async function checkServerHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/test`)
    return response.ok
  } catch (error) {
    return false
  }
}

// CLI usage
export async function loadDefaultsFromCLI(
  baseUrl: string = 'http://localhost:3001',
  projectId: string = 'main-1773934155652',
  options: Partial<Omit<DefaultSetupConfig, 'baseUrl' | 'projectId'>> = {}
): Promise<void> {
  // Check if server is running first
  const serverRunning = await checkServerHealth(baseUrl)
  if (!serverRunning) {
    console.log('⚠️  LLM-Charge server not running, skipping default setup')
    console.log('   Start the server with: npm start')
    console.log('   Then run setup with: npm run setup')
    return
  }

  const config: DefaultSetupConfig = {
    baseUrl,
    projectId,
    overwriteExisting: false,
    loadAgents: true,
    loadSkills: true,
    loadSpecs: true,
    ...options
  }
  
  const loader = new DefaultSetupLoader(config)
  await loader.loadAllDefaults()
}

// CLI entry point - run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  loadDefaultsFromCLI().catch(error => {
    console.error('❌ Setup failed:', error.message)
    process.exit(1)
  })
}

// Export for programmatic usage
export default DefaultSetupLoader