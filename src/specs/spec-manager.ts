import { EventEmitter } from 'events'
import { z } from 'zod'

export const SpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  linkedClasses: z.array(z.string()),
  linkedMethods: z.array(z.string()),
  linkedTests: z.array(z.string()),
  status: z.enum(['draft', 'active', 'deprecated']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string()),
  comments: z.array(z.object({
    id: z.string(),
    content: z.string(),
    author: z.string(),
    timestamp: z.date()
  }))
})

export type Spec = z.infer<typeof SpecSchema>

export interface CodeGraphLink {
  symbol: string
  file: string
  line: number
  type: 'class' | 'method' | 'function' | 'test'
}

export class SpecManager extends EventEmitter {
  private specs = new Map<string, Spec>()
  private codeGraphLinks = new Map<string, CodeGraphLink[]>()

  async createSpec(spec: Omit<Spec, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()
    
    const newSpec: Spec = {
      ...spec,
      id,
      createdAt: now,
      updatedAt: now
    }

    this.specs.set(id, newSpec)
    
    // Auto-link with CodeGraph
    await this.autoLinkWithCodeGraph(id, spec.description)
    
    this.emit('spec:created', newSpec)
    return id
  }

  async updateSpec(id: string, updates: Partial<Omit<Spec, 'id' | 'createdAt'>>): Promise<void> {
    const spec = this.specs.get(id)
    if (!spec) {
      throw new Error(`Spec ${id} not found`)
    }

    const updatedSpec: Spec = {
      ...spec,
      ...updates,
      updatedAt: new Date()
    }

    this.specs.set(id, updatedSpec)
    this.emit('spec:updated', updatedSpec)
  }

  async linkToCode(specId: string, symbol: string, file: string, line: number, type: CodeGraphLink['type']): Promise<void> {
    const existing = this.codeGraphLinks.get(specId) || []
    const link: CodeGraphLink = { symbol, file, line, type }
    
    // Avoid duplicates
    const isDuplicate = existing.some(l => 
      l.symbol === symbol && l.file === file && l.line === line && l.type === type
    )
    
    if (!isDuplicate) {
      existing.push(link)
      this.codeGraphLinks.set(specId, existing)
      
      // Update spec with linked items
      const spec = this.specs.get(specId)
      if (spec) {
        const updates: Partial<Spec> = {}
        
        switch (type) {
          case 'class':
            updates.linkedClasses = [...new Set([...spec.linkedClasses, symbol])]
            break
          case 'method':
          case 'function':
            updates.linkedMethods = [...new Set([...spec.linkedMethods, symbol])]
            break
          case 'test':
            updates.linkedTests = [...new Set([...spec.linkedTests, symbol])]
            break
        }
        
        if (Object.keys(updates).length > 0) {
          await this.updateSpec(specId, updates)
        }
      }
      
      this.emit('spec:linked', { specId, link })
    }
  }

  async unlinkFromCode(specId: string, symbol: string): Promise<void> {
    const links = this.codeGraphLinks.get(specId) || []
    const updatedLinks = links.filter(l => l.symbol !== symbol)
    this.codeGraphLinks.set(specId, updatedLinks)
    
    this.emit('spec:unlinked', { specId, symbol })
  }

  getSpec(id: string): Spec | undefined {
    return this.specs.get(id)
  }

  getAllSpecs(): Spec[] {
    return Array.from(this.specs.values())
  }

  getSpecsByStatus(status: Spec['status']): Spec[] {
    return this.getAllSpecs().filter(spec => spec.status === status)
  }

  getSpecsByPriority(priority: Spec['priority']): Spec[] {
    return this.getAllSpecs().filter(spec => spec.priority === priority)
  }

  getCodeLinks(specId: string): CodeGraphLink[] {
    return this.codeGraphLinks.get(specId) || []
  }

  searchSpecs(query: string): Spec[] {
    const lowercaseQuery = query.toLowerCase()
    return this.getAllSpecs().filter(spec => 
      spec.title.toLowerCase().includes(lowercaseQuery) ||
      spec.description.toLowerCase().includes(lowercaseQuery) ||
      spec.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
  }

  async addComment(specId: string, content: string, author: string): Promise<void> {
    const spec = this.specs.get(specId)
    if (!spec) {
      throw new Error(`Spec ${specId} not found`)
    }

    const comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      author,
      timestamp: new Date()
    }

    await this.updateSpec(specId, {
      comments: [...spec.comments, comment]
    })
  }

  private async autoLinkWithCodeGraph(specId: string, description: string): Promise<void> {
    // Extract potential symbols from description
    const symbolPattern = /`([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)`/g
    const matches = description.matchAll(symbolPattern)
    
    for (const match of matches) {
      const symbol = match[1]
      try {
        // This would integrate with CodeGraph to find symbol locations
        // Use real CodeGraph MCP search
        const codeGraphResult = await this.realCodeGraphSearch(symbol)
        
        if (codeGraphResult) {
          await this.linkToCode(
            specId,
            symbol,
            codeGraphResult.file,
            codeGraphResult.line,
            codeGraphResult.type
          )
        }
      } catch (error) {
        // Silently continue if symbol not found
      }
    }
  }

  private async realCodeGraphSearch(symbol: string): Promise<CodeGraphLink | null> {
    try {
      // Use real CodeGraph search API endpoint
      const searchResponse = await fetch('/api/codegraph/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: symbol })
      });
      
      if (!searchResponse.ok) {
        console.warn(`CodeGraph search failed for ${symbol}:`, searchResponse.status);
        return null;
      }
      
      const searchResult = await searchResponse.json();
      
      // Extract the first result from the search
      if (searchResult && searchResult.success && searchResult.results && searchResult.results.length > 0) {
        const firstResult = searchResult.results[0];
        return {
          symbol: firstResult.symbol,
          file: firstResult.file,
          line: firstResult.line,
          type: firstResult.type
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Real CodeGraph search failed for ${symbol}:`, error);
      return null;
    }
  }

  async generateSpecSummary(specId: string): Promise<string> {
    const spec = this.specs.get(specId)
    if (!spec) {
      throw new Error(`Spec ${specId} not found`)
    }

    const links = this.getCodeLinks(specId)
    const classCount = links.filter(l => l.type === 'class').length
    const methodCount = links.filter(l => l.type === 'method' || l.type === 'function').length
    const testCount = links.filter(l => l.type === 'test').length

    return `**${spec.title}** (${spec.status}, ${spec.priority} priority)
${spec.description}

**Code Coverage:**
- ${classCount} linked classes
- ${methodCount} linked methods
- ${testCount} linked tests

**Tags:** ${spec.tags.join(', ')}
**Comments:** ${spec.comments.length}`
  }

  async exportSpecs(format: 'json' | 'markdown' = 'json'): Promise<string> {
    const specs = this.getAllSpecs()
    
    if (format === 'json') {
      return JSON.stringify(specs, null, 2)
    }
    
    // Markdown format
    let markdown = '# Project Specifications\n\n'
    
    for (const spec of specs) {
      const links = this.getCodeLinks(spec.id)
      markdown += `## ${spec.title}\n\n`
      markdown += `**Status:** ${spec.status} | **Priority:** ${spec.priority}\n\n`
      markdown += `${spec.description}\n\n`
      
      if (links.length > 0) {
        markdown += `**Linked Code:**\n`
        for (const link of links) {
          markdown += `- ${link.type}: \`${link.symbol}\` (${link.file}:${link.line})\n`
        }
        markdown += '\n'
      }
      
      if (spec.tags.length > 0) {
        markdown += `**Tags:** ${spec.tags.join(', ')}\n\n`
      }
      
      markdown += '---\n\n'
    }
    
    return markdown
  }
}