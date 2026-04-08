import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Resolve default-agents-skills.json for dev (src/server) and production (dist/src/server + dist/src/setup).
 */
export function resolveDefaultAgentsSkillsPath() {
  const candidates = [
    path.join(__dirname, '..', 'setup', 'default-agents-skills.json'),
    path.join(process.cwd(), 'src', 'setup', 'default-agents-skills.json'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

/** Insert missing default agents, skill specs, and specs from default-agents-skills.json. */
export async function autoLoadDefaults(dbManager) {
  try {
    const defaultsPath = resolveDefaultAgentsSkillsPath()
    if (!defaultsPath) {
      console.warn('⚠️ default-agents-skills.json not found; skipping default agent/skill load')
      return
    }

    const defaults = JSON.parse(readFileSync(defaultsPath, 'utf-8'))

    const agents = await dbManager.getAllAgents()
    const specs = await dbManager.getAllSpecs()

    const existingAgentNames = new Set(agents.map((a) => a.name))
    const existingSpecTitles = new Set(specs.map((s) => s.title))

    const missingAgents = (defaults.agents || []).filter((a) => !existingAgentNames.has(a.name))
    const missingSkills = (defaults.skills || []).filter(
      (s) => !existingSpecTitles.has(`${s.name} Skill Documentation`)
    )
    const missingSpecs = (defaults.specs || []).filter((s) => !existingSpecTitles.has(s.title))

    if (missingAgents.length === 0 && missingSkills.length === 0 && missingSpecs.length === 0) {
      console.log(`✅ All defaults loaded (${agents.length} agents, ${specs.length} specs)`)
      return
    }

    console.log(
      `📦 Loading missing defaults: ${missingAgents.length} agents, ${missingSkills.length} skills, ${missingSpecs.length} specs`
    )

    let agentsLoaded = 0
    for (const agent of defaults.agents || []) {
      const exists = agents.some((a) => a.name === agent.name)
      if (!exists) {
        const baseCaps =
          typeof agent.capabilities === 'object' && agent.capabilities !== null ? agent.capabilities : {}
        await dbManager.createAgent({
          id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: agent.name,
          description: agent.description,
          primaryRole: agent.primaryRole,
          capabilities: {
            ...baseCaps,
            skills: agent.skills || [],
            tags: agent.tags || [],
          },
        })
        agentsLoaded++
      }
    }

    let skillsLoaded = 0
    for (const skill of defaults.skills || []) {
      const title = `${skill.name} Skill Documentation`
      const exists = specs.some((s) => s.title === title)
      if (!exists) {
        const description = `# ${skill.name}\n\n${skill.description}\n\n## Capabilities\n${skill.capabilities.map((c) => `- ${c}`).join('\n')}\n\n## Cost Savings: ${skill.costSavings}`
        await dbManager.createSpec({
          id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title,
          description,
          status: 'active',
          priority: 'high',
          data: { tags: ['skill', 'capability', ...(skill.tags || [])], category: skill.category },
        })
        skillsLoaded++
      }
    }

    let specsLoaded = 0
    for (const spec of defaults.specs || []) {
      const exists = specs.some((s) => s.title === spec.title)
      if (!exists) {
        await dbManager.createSpec({
          id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: spec.title,
          description: spec.description,
          status: spec.status || 'active',
          priority: spec.priority || 'medium',
          data: { tags: spec.tags || [] },
        })
        specsLoaded++
      }
    }

    console.log(`✅ Auto-loaded: ${agentsLoaded} agents, ${skillsLoaded} skills, ${specsLoaded} specs`)
  } catch (error) {
    console.warn('⚠️ Auto-load defaults failed (non-fatal):', error.message)
  }
}
