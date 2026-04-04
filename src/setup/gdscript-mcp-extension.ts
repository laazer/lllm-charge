// GDScript MCP Extension 
// Adds GDScript and Godot project support to MCP tools

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

export interface GDScriptSymbol {
  name: string
  type: 'class' | 'function' | 'signal' | 'variable' | 'enum' | 'const'
  location: {
    file: string
    line: number
    column?: number
  }
  signature?: string
  docstring?: string
  extends?: string
}

export interface GodotScene {
  name: string
  file: string
  nodes: Array<{
    name: string
    type: string
    script?: string
  }>
  signals: Array<{
    signal: string
    target: string
    method: string
  }>
}

export class GDScriptMCPExtension {
  private projectRoot: string
  private symbols: GDScriptSymbol[] = []
  private scenes: GodotScene[] = []

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async initialize(): Promise<boolean> {
    // Check if this is a Godot project
    const projectFile = join(this.projectRoot, 'project.godot')
    if (!existsSync(projectFile)) {
      return false // Not a Godot project
    }

    console.log('🎮 Godot project detected! Adding GDScript support...')
    
    // Index GDScript files
    await this.indexGDScriptFiles()
    
    // Index Godot scenes  
    await this.indexGodotScenes()
    
    console.log(`✅ GDScript indexed: ${this.symbols.length} symbols, ${this.scenes.length} scenes`)
    return true
  }

  // MCP Tool: Search GDScript symbols
  async searchGDScriptSymbols(query: string, limit: number = 10): Promise<GDScriptSymbol[]> {
    const normalizedQuery = query.toLowerCase()
    
    return this.symbols
      .filter(symbol => 
        symbol.name.toLowerCase().includes(normalizedQuery) ||
        symbol.signature?.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, limit)
  }

  // MCP Tool: Get scene hierarchy
  async getSceneHierarchy(sceneName?: string): Promise<GodotScene[]> {
    if (sceneName) {
      return this.scenes.filter(scene => 
        scene.name.toLowerCase().includes(sceneName.toLowerCase())
      )
    }
    return this.scenes
  }

  // MCP Tool: Find signal connections
  async findSignalConnections(signalName: string): Promise<Array<{
    scene: string
    connections: GodotScene['signals']
  }>> {
    return this.scenes
      .filter(scene => scene.signals.some(s => s.signal.includes(signalName)))
      .map(scene => ({
        scene: scene.name,
        connections: scene.signals.filter(s => s.signal.includes(signalName))
      }))
  }

  // MCP Tool: Build GDScript context for task
  async buildGDScriptContext(task: string, maxSymbols: number = 20): Promise<{
    relevantSymbols: GDScriptSymbol[]
    relatedScenes: GodotScene[]
    suggestions: string[]
  }> {
    const taskLower = task.toLowerCase()
    const keywords = taskLower.split(' ').filter(w => w.length > 2)
    
    // Find relevant symbols
    const relevantSymbols = this.symbols
      .filter(symbol => {
        const symbolText = `${symbol.name} ${symbol.signature} ${symbol.docstring}`.toLowerCase()
        return keywords.some(keyword => symbolText.includes(keyword))
      })
      .sort((a, b) => {
        // Prioritize by symbol type relevance
        const typeOrder = { 'class': 0, 'function': 1, 'signal': 2, 'variable': 3 }
        return (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4)
      })
      .slice(0, maxSymbols)

    // Find related scenes
    const relatedScenes = this.scenes.filter(scene =>
      keywords.some(keyword => 
        scene.name.toLowerCase().includes(keyword) ||
        scene.nodes.some(node => node.name.toLowerCase().includes(keyword))
      )
    )

    // Generate suggestions
    const suggestions = this.generateGDScriptSuggestions(task, relevantSymbols, relatedScenes)

    return { relevantSymbols, relatedScenes, suggestions }
  }

  // Private methods for parsing
  private async indexGDScriptFiles(): Promise<void> {
    const gdFiles = this.findGDScriptFiles(this.projectRoot)
    
    for (const filePath of gdFiles) {
      try {
        const symbols = await this.parseGDScriptFile(filePath)
        this.symbols.push(...symbols)
      } catch (error) {
        console.warn(`⚠️  Could not parse GDScript file: ${filePath}`)
      }
    }
  }

  private async indexGodotScenes(): Promise<void> {
    const sceneFiles = this.findFiles(this.projectRoot, '.tscn')
    
    for (const filePath of sceneFiles) {
      try {
        const scene = await this.parseGodotScene(filePath)
        if (scene) {
          this.scenes.push(scene)
        }
      } catch (error) {
        console.warn(`⚠️  Could not parse scene file: ${filePath}`)
      }
    }
  }

  private findGDScriptFiles(dir: string): string[] {
    return this.findFiles(dir, '.gd')
  }

  private findFiles(dir: string, extension: string): string[] {
    const files: string[] = []
    
    try {
      const items = readdirSync(dir)
      
      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)
        
        if (stat.isDirectory() && !item.startsWith('.')) {
          files.push(...this.findFiles(fullPath, extension))
        } else if (stat.isFile() && extname(item) === extension) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Skip unreadable directories
    }
    
    return files
  }

  private async parseGDScriptFile(filePath: string): Promise<GDScriptSymbol[]> {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\\n')
    const symbols: GDScriptSymbol[] = []
    const relativePath = filePath.replace(this.projectRoot, '').substring(1)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNumber = i + 1

      // Parse class definitions
      const classMatch = line.match(/^class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          location: { file: relativePath, line: lineNumber },
          extends: classMatch[2],
          signature: line
        })
        continue
      }

      // Parse function definitions
      const funcMatch = line.match(/^func\\s+(\\w+)\\s*\\(([^)]*)\\)(?:\\s*->\\s*(\\w+))?/)
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
        continue
      }

      // Parse signal definitions
      const signalMatch = line.match(/^signal\\s+(\\w+)(?:\\s*\\(([^)]*)\\))?/)
      if (signalMatch) {
        symbols.push({
          name: signalMatch[1],
          type: 'signal',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
        continue
      }

      // Parse variable definitions
      const varMatch = line.match(/^(?:var|const)\\s+(\\w+)(?:\\s*:\\s*(\\w+))?/)
      if (varMatch) {
        symbols.push({
          name: varMatch[1],
          type: line.startsWith('const') ? 'const' : 'variable',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
        continue
      }
    }

    return symbols
  }

  private async parseGodotScene(filePath: string): Promise<GodotScene | null> {
    const content = readFileSync(filePath, 'utf8')
    const sceneName = basename(filePath, '.tscn')
    const nodes: GodotScene['nodes'] = []
    const signals: GodotScene['signals'] = []

    // Basic parsing of .tscn format
    const lines = content.split('\\n')
    for (const line of lines) {
      // Parse node definitions
      const nodeMatch = line.match(/^\\[node name="([^"]+)".*type="([^"]+)"/)
      if (nodeMatch) {
        nodes.push({
          name: nodeMatch[1],
          type: nodeMatch[2]
        })
      }

      // Parse signal connections
      const connectionMatch = line.match(/^\\[connection signal="([^"]+)".*from="([^"]+)".*to="([^"]+)".*method="([^"]+)"/)
      if (connectionMatch) {
        signals.push({
          signal: connectionMatch[1],
          target: connectionMatch[3],
          method: connectionMatch[4]
        })
      }
    }

    if (nodes.length === 0) return null

    return {
      name: sceneName,
      file: filePath.replace(this.projectRoot, '').substring(1),
      nodes,
      signals
    }
  }

  private generateGDScriptSuggestions(task: string, symbols: GDScriptSymbol[], scenes: GodotScene[]): string[] {
    const suggestions: string[] = []

    // Analyze task for common patterns
    if (task.toLowerCase().includes('player')) {
      suggestions.push('Look for Player class and related movement functions')
      if (symbols.some(s => s.name.toLowerCase().includes('player'))) {
        suggestions.push('Found Player-related symbols in codebase')
      }
    }

    if (task.toLowerCase().includes('signal')) {
      const signalCount = symbols.filter(s => s.type === 'signal').length
      suggestions.push(`Found ${signalCount} signals defined in scripts`)
    }

    if (task.toLowerCase().includes('scene')) {
      suggestions.push(`Project has ${scenes.length} scenes to analyze`)
    }

    // Generic suggestions
    if (symbols.length > 0) {
      const classes = symbols.filter(s => s.type === 'class')
      const functions = symbols.filter(s => s.type === 'function')
      suggestions.push(`Codebase contains ${classes.length} classes and ${functions.length} functions`)
    }

    return suggestions
  }

  // Export symbols for MCP integration
  getSymbols(): GDScriptSymbol[] {
    return this.symbols
  }

  getScenes(): GodotScene[] {
    return this.scenes
  }
}