import { EventEmitter } from 'events'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  links: z.array(z.object({
    target: z.string(),
    type: z.enum(['note', 'external', 'code', 'spec'])
  })),
  backlinks: z.array(z.string()), // Note IDs that link to this note
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    author: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    status: z.enum(['draft', 'active', 'archived']).default('active')
  }),
  embeddings: z.array(z.number()).optional() // For semantic search
})

export type Note = z.infer<typeof NoteSchema>

export const MemoryGraphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['note', 'concept', 'person', 'project', 'skill', 'pattern']),
    title: z.string(),
    strength: z.number().min(0).max(1), // Connection strength
    lastAccessed: z.date()
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(['references', 'contains', 'implements', 'depends_on', 'similar_to']),
    weight: z.number().min(0).max(1),
    metadata: z.record(z.any()).optional()
  }))
})

export type MemoryGraphData = z.infer<typeof MemoryGraphSchema>

export class MemoryGraph extends EventEmitter {
  private notes = new Map<string, Note>()
  private memoryGraphData: MemoryGraphData = { nodes: [], edges: [] }
  private vaultPath: string
  private searchIndex = new Map<string, Set<string>>() // term -> note IDs

  constructor(vaultPath: string = './.llm-charge/vault') {
    super()
    this.vaultPath = vaultPath
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.vaultPath, { recursive: true })
    await this.loadExistingNotes()
    await this.buildSearchIndex()
    this.emit('vault:initialized', { path: this.vaultPath, notes: this.notes.size })
  }

  async createNote(
    title: string,
    content: string,
    tags: string[] = [],
    metadata?: Partial<Note['metadata']>
  ): Promise<string> {
    const id = this.generateNoteId(title)
    const now = new Date()
    
    const note: Note = {
      id,
      title,
      content,
      tags,
      links: this.extractLinks(content),
      backlinks: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        priority: 'medium',
        status: 'active',
        ...metadata
      }
    }

    this.notes.set(id, note)
    await this.saveNote(note)
    await this.updateBacklinks(note)
    await this.updateSearchIndex(note)
    await this.updateMemoryGraph(note)
    
    this.emit('note:created', note)
    return id
  }

  async updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'metadata'>>): Promise<void> {
    const note = this.notes.get(id)
    if (!note) {
      throw new Error(`Note ${id} not found`)
    }

    const updatedNote: Note = {
      ...note,
      ...updates,
      metadata: {
        ...note.metadata,
        updatedAt: new Date()
      }
    }

    // Re-extract links if content changed
    if (updates.content) {
      updatedNote.links = this.extractLinks(updates.content)
    }

    this.notes.set(id, updatedNote)
    await this.saveNote(updatedNote)
    await this.updateBacklinks(updatedNote)
    await this.updateSearchIndex(updatedNote)
    await this.updateMemoryGraph(updatedNote)
    
    this.emit('note:updated', updatedNote)
  }

  async deleteNote(id: string): Promise<void> {
    const note = this.notes.get(id)
    if (!note) {
      throw new Error(`Note ${id} not found`)
    }

    // Remove backlinks from other notes
    for (const backlinkId of note.backlinks) {
      const backlinkNote = this.notes.get(backlinkId)
      if (backlinkNote) {
        backlinkNote.links = backlinkNote.links.filter(link => link.target !== id)
        await this.saveNote(backlinkNote)
      }
    }

    this.notes.delete(id)
    await this.removeNoteFile(id)
    this.removeFromSearchIndex(note)
    this.removeFromMemoryGraph(id)
    
    this.emit('note:deleted', { id, title: note.title })
  }

  getNote(id: string): Note | undefined {
    return this.notes.get(id)
  }

  getNoteByTitle(title: string): Note | undefined {
    return Array.from(this.notes.values()).find(note => note.title === title)
  }

  getAllNotes(): Note[] {
    return Array.from(this.notes.values())
  }

  getNotesByTag(tag: string): Note[] {
    return this.getAllNotes().filter(note => note.tags.includes(tag))
  }

  searchNotes(query: string): Note[] {
    const terms = query.toLowerCase().split(/\s+/)
    const matchingNotes = new Set<string>()

    // Search in index
    for (const term of terms) {
      const noteIds = this.searchIndex.get(term) || new Set()
      for (const noteId of noteIds) {
        matchingNotes.add(noteId)
      }
    }

    // Rank by relevance
    const results = Array.from(matchingNotes)
      .map(id => this.notes.get(id)!)
      .filter(note => note !== undefined)
      .sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, query)
        const bScore = this.calculateRelevanceScore(b, query)
        return bScore - aScore
      })

    return results
  }

  async createProjectNote(projectName: string, description: string, goals: string[]): Promise<string> {
    const content = `# ${projectName}

## Description
${description}

## Goals
${goals.map(goal => `- ${goal}`).join('\n')}

## Progress
- [ ] Initial setup
- [ ] Core implementation
- [ ] Testing
- [ ] Documentation

## Links
- [[Project Management]]
- [[Development Workflow]]

## Notes
`

    return this.createNote(
      projectName,
      content,
      ['project', 'active'],
      { priority: 'high', author: 'system' }
    )
  }

  async createSkillNote(skillName: string, description: string, usage: string[]): Promise<string> {
    const content = `# ${skillName}

## Description
${description}

## Usage Examples
${usage.map(example => `\`\`\`\n${example}\n\`\`\``).join('\n\n')}

## Related Skills
- [[Skill Library]]

## Patterns
- Success patterns will be added here automatically
- Failure patterns and lessons learned

## Performance Metrics
- Execution time: TBD
- Success rate: TBD
- Cost effectiveness: TBD
`

    return this.createNote(
      skillName,
      content,
      ['skill', 'reference'],
      { priority: 'medium', author: 'system' }
    )
  }

  async createLearningNote(title: string, pattern: any, context: any): Promise<string> {
    const content = `# ${title}

## Pattern
\`\`\`json
${JSON.stringify(pattern, null, 2)}
\`\`\`

## Context
- **Agent:** ${context.agent || 'Unknown'}
- **Skill:** ${context.skill || 'Unknown'}
- **Task:** ${context.taskId || 'Unknown'}
- **Cost:** $${context.cost || 0}
- **Success:** ${context.success ? 'Yes' : 'No'}

## Key Insights
- Add insights here

## Related Patterns
- [[Pattern Library]]

## Application
- When to use this pattern
- When to avoid this pattern
`

    return this.createNote(
      title,
      content,
      ['learning', 'pattern', context.success ? 'success' : 'failure'],
      { priority: 'medium', author: 'system' }
    )
  }

  getMemoryGraph(): MemoryGraphData {
    return this.memoryGraphData
  }

  getConnectedNotes(noteId: string, maxDepth: number = 2): Note[] {
    const visited = new Set<string>()
    const queue: { id: string; depth: number }[] = [{ id: noteId, depth: 0 }]
    const connected: Note[] = []

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      
      if (visited.has(id) || depth > maxDepth) continue
      visited.add(id)

      const note = this.notes.get(id)
      if (!note) continue

      if (depth > 0) connected.push(note)

      // Add linked notes
      for (const link of note.links) {
        if (link.type === 'note' && !visited.has(link.target)) {
          queue.push({ id: link.target, depth: depth + 1 })
        }
      }

      // Add backlinked notes
      for (const backlinkId of note.backlinks) {
        if (!visited.has(backlinkId)) {
          queue.push({ id: backlinkId, depth: depth + 1 })
        }
      }
    }

    return connected
  }

  async exportVault(format: 'markdown' | 'json' = 'markdown'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify({
        notes: Array.from(this.notes.values()),
        memoryGraph: this.memoryGraphData
      }, null, 2)
    }

    // Export as interconnected markdown files
    let exportData = ''
    const notes = this.getAllNotes().sort((a, b) => a.title.localeCompare(b.title))
    
    for (const note of notes) {
      exportData += `# ${note.title}\n\n`
      exportData += note.content
      exportData += '\n\n---\n\n'
    }

    return exportData
  }

  private generateNoteId(title: string): string {
    const sanitized = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim()
    return `${sanitized}-${Date.now()}`
  }

  private extractLinks(content: string): Note['links'] {
    const links: Note['links'] = []
    
    // Wiki-style links [[Note Title]]
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
    let match
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.push({ target: match[1], type: 'note' })
    }

    // Code references `src/file.ts:123`
    const codeRefRegex = /`([^`]+\.(ts|js|py|go|rs|java)(?::\d+)?)`/g
    while ((match = codeRefRegex.exec(content)) !== null) {
      links.push({ target: match[1], type: 'code' })
    }

    // External URLs
    const urlRegex = /https?:\/\/[^\s\)]+/g
    while ((match = urlRegex.exec(content)) !== null) {
      links.push({ target: match[0], type: 'external' })
    }

    return links
  }

  private async saveNote(note: Note): Promise<void> {
    const filePath = path.join(this.vaultPath, `${note.id}.md`)
    const frontmatter = `---
title: ${note.title}
tags: ${note.tags.join(', ')}
created: ${note.metadata.createdAt.toISOString()}
updated: ${note.metadata.updatedAt.toISOString()}
priority: ${note.metadata.priority}
status: ${note.metadata.status}
---

`
    await fs.writeFile(filePath, frontmatter + note.content)
  }

  private async removeNoteFile(id: string): Promise<void> {
    const filePath = path.join(this.vaultPath, `${id}.md`)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  private async loadExistingNotes(): Promise<void> {
    try {
      const files = await fs.readdir(this.vaultPath)
      const mdFiles = files.filter(file => file.endsWith('.md'))
      
      for (const file of mdFiles) {
        const filePath = path.join(this.vaultPath, file)
        const content = await fs.readFile(filePath, 'utf-8')
        // Parse frontmatter and content to reconstruct note
        // This is a simplified version - would need proper frontmatter parsing
      }
    } catch (error) {
      // Vault doesn't exist yet, which is fine
    }
  }

  private async updateBacklinks(note: Note): Promise<void> {
    // Update backlinks for all notes referenced by this note
    for (const link of note.links) {
      if (link.type === 'note') {
        const targetNote = this.getNoteByTitle(link.target)
        if (targetNote && !targetNote.backlinks.includes(note.id)) {
          targetNote.backlinks.push(note.id)
          await this.saveNote(targetNote)
        }
      }
    }
  }

  private async updateSearchIndex(note: Note): Promise<void> {
    // Remove old entries
    this.removeFromSearchIndex(note)
    
    // Add new entries
    const text = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase()
    const words = text.split(/\s+/).filter(word => word.length > 2)
    
    for (const word of words) {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set())
      }
      this.searchIndex.get(word)!.add(note.id)
    }
  }

  private removeFromSearchIndex(note: Note): void {
    for (const [term, noteIds] of this.searchIndex.entries()) {
      noteIds.delete(note.id)
      if (noteIds.size === 0) {
        this.searchIndex.delete(term)
      }
    }
  }

  private async buildSearchIndex(): Promise<void> {
    for (const note of this.notes.values()) {
      await this.updateSearchIndex(note)
    }
  }

  private calculateRelevanceScore(note: Note, query: string): number {
    const queryLower = query.toLowerCase()
    let score = 0
    
    // Title match is worth more
    if (note.title.toLowerCase().includes(queryLower)) {
      score += 10
    }
    
    // Content match
    if (note.content.toLowerCase().includes(queryLower)) {
      score += 5
    }
    
    // Tag match
    for (const tag of note.tags) {
      if (tag.toLowerCase().includes(queryLower)) {
        score += 7
      }
    }
    
    // Recent notes are slightly preferred
    const daysSinceUpdate = (Date.now() - note.metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 5 - daysSinceUpdate)
    
    return score
  }

  private async updateMemoryGraph(note: Note): Promise<void> {
    // Add or update node
    const existingNodeIndex = this.memoryGraphData.nodes.findIndex((n: any) => n.id === note.id)
    const node = {
      id: note.id,
      type: this.inferNodeType(note),
      title: note.title,
      strength: 1.0,
      lastAccessed: new Date()
    }

    if (existingNodeIndex >= 0) {
      this.memoryGraphData.nodes[existingNodeIndex] = node
    } else {
      this.memoryGraphData.nodes.push(node)
    }

    // Add edges for links
    for (const link of note.links) {
      if (link.type === 'note') {
        const targetNote = this.getNoteByTitle(link.target)
        if (targetNote) {
          this.addOrUpdateEdge(note.id, targetNote.id, 'references')
        }
      }
    }
  }

  private removeFromMemoryGraph(noteId: string): void {
    this.memoryGraphData.nodes = this.memoryGraphData.nodes.filter((n: any) => n.id !== noteId)
    this.memoryGraphData.edges = this.memoryGraphData.edges.filter((e: any) => e.from !== noteId && e.to !== noteId)
  }

  private inferNodeType(note: Note): MemoryGraphData['nodes'][0]['type'] {
    if (note.tags.includes('project')) return 'project'
    if (note.tags.includes('skill')) return 'skill'
    if (note.tags.includes('pattern')) return 'pattern'
    if (note.tags.includes('person')) return 'person'
    return 'concept'
  }

  private addOrUpdateEdge(from: string, to: string, type: MemoryGraphData['edges'][0]['type']): void {
    const existingEdge = this.memoryGraphData.edges.find((e: any) => e.from === from && e.to === to && e.type === type)

    if (existingEdge) {
      existingEdge.weight = Math.min(1.0, existingEdge.weight + 0.1)
    } else {
      this.memoryGraphData.edges.push({
        from,
        to,
        type,
        weight: 0.5
      })
    }
  }
}