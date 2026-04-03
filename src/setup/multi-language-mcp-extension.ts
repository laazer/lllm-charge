// Multi-Language MCP Extension
// Adds Python, Go, GDScript, and more language support to MCP tools

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename, dirname } from 'path'

export interface LanguageSymbol {
  name: string
  type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'struct' | 'const' | 'import' | 'signal'
  language: 'python' | 'go' | 'gdscript' | 'rust' | 'java' | 'csharp'
  location: {
    file: string
    line: number
    column?: number
  }
  signature?: string
  docstring?: string
  visibility?: 'public' | 'private' | 'protected'
  extends?: string
  implements?: string[]
}

export interface ProjectAnalysis {
  languages: Array<{
    name: string
    fileCount: number
    symbolCount: number
    confidence: number
  }>
  structure: {
    entryPoints: string[]
    testFiles: string[]
    configFiles: string[]
    buildFiles: string[]
  }
  dependencies: string[]
}

export class MultiLanguageMCPExtension {
  private projectRoot: string
  private symbols: LanguageSymbol[] = []
  private projectAnalysis: ProjectAnalysis | null = null

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async initialize(): Promise<boolean> {
    console.log('🌍 Initializing multi-language support...')
    
    // Detect project languages
    this.projectAnalysis = await this.analyzeProject()
    
    // Index all supported languages
    await this.indexAllLanguages()
    
    const languageNames = this.projectAnalysis.languages.map(l => l.name).join(', ')
    console.log(`✅ Multi-language indexed: ${languageNames} (${this.symbols.length} symbols)`)
    
    return this.symbols.length > 0
  }

  // MCP Tool: Search across all languages
  async searchMultiLanguageSymbols(query: string, language?: string, limit: number = 20): Promise<LanguageSymbol[]> {
    const normalizedQuery = query.toLowerCase()
    
    let filteredSymbols = this.symbols
    
    if (language) {
      filteredSymbols = this.symbols.filter(s => s.language === language)
    }
    
    return filteredSymbols
      .filter(symbol => 
        symbol.name.toLowerCase().includes(normalizedQuery) ||
        symbol.signature?.toLowerCase().includes(normalizedQuery) ||
        symbol.docstring?.toLowerCase().includes(normalizedQuery)
      )
      .sort((a, b) => {
        // Prioritize exact matches, then by symbol type importance
        const aExact = a.name.toLowerCase() === normalizedQuery ? 0 : 1
        const bExact = b.name.toLowerCase() === normalizedQuery ? 0 : 1
        if (aExact !== bExact) return aExact - bExact
        
        const typeOrder = { 'class': 0, 'interface': 1, 'struct': 1, 'function': 2, 'method': 3 }
        return (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9)
      })
      .slice(0, limit)
  }

  // MCP Tool: Build cross-language context
  async buildCrossLanguageContext(task: string, maxSymbols: number = 25): Promise<{
    relevantSymbols: LanguageSymbol[]
    languageBreakdown: Record<string, number>
    suggestions: string[]
    entryPoints: string[]
  }> {
    const taskLower = task.toLowerCase()
    const keywords = taskLower.split(' ').filter(w => w.length > 2)
    
    // Find relevant symbols across all languages
    const relevantSymbols = this.symbols
      .filter(symbol => {
        const symbolText = `${symbol.name} ${symbol.signature} ${symbol.docstring}`.toLowerCase()
        return keywords.some(keyword => symbolText.includes(keyword))
      })
      .sort((a, b) => {
        // Calculate relevance score
        const scoreA = this.calculateRelevanceScore(a, keywords)
        const scoreB = this.calculateRelevanceScore(b, keywords)
        return scoreB - scoreA
      })
      .slice(0, maxSymbols)

    // Language breakdown
    const languageBreakdown: Record<string, number> = {}
    relevantSymbols.forEach(symbol => {
      languageBreakdown[symbol.language] = (languageBreakdown[symbol.language] || 0) + 1
    })

    // Generate suggestions
    const suggestions = this.generateCrossLanguageSuggestions(task, relevantSymbols)

    return {
      relevantSymbols,
      languageBreakdown,
      suggestions,
      entryPoints: this.projectAnalysis?.structure.entryPoints || []
    }
  }

  // MCP Tool: Language-specific analysis
  async analyzeLanguageSpecific(language: string): Promise<{
    symbols: LanguageSymbol[]
    patterns: string[]
    recommendations: string[]
    files: string[]
  }> {
    const languageSymbols = this.symbols.filter(s => s.language === language)
    const patterns = this.detectLanguagePatterns(language, languageSymbols)
    const recommendations = this.generateLanguageRecommendations(language, languageSymbols)
    const files = [...new Set(languageSymbols.map(s => s.location.file))]

    return { symbols: languageSymbols, patterns, recommendations, files }
  }

  // Private methods for language detection and parsing
  private async analyzeProject(): Promise<ProjectAnalysis> {
    const languages: ProjectAnalysis['languages'] = []
    const structure = {
      entryPoints: [] as string[],
      testFiles: [] as string[],
      configFiles: [] as string[],
      buildFiles: [] as string[]
    }
    const dependencies: string[] = []

    // Detect Python
    const pythonFiles = this.findFiles(this.projectRoot, ['.py'])
    if (pythonFiles.length > 0) {
      languages.push({
        name: 'python',
        fileCount: pythonFiles.length,
        symbolCount: 0, // Will be filled during indexing
        confidence: this.calculateLanguageConfidence('python', pythonFiles)
      })
      structure.entryPoints.push(...pythonFiles.filter(f => basename(f) === 'main.py' || basename(f) === '__init__.py'))
      structure.testFiles.push(...pythonFiles.filter(f => f.includes('test_') || f.includes('/tests/')))
      
      // Check for Python dependencies
      const requirementsFile = join(this.projectRoot, 'requirements.txt')
      if (existsSync(requirementsFile)) {
        structure.configFiles.push('requirements.txt')
        dependencies.push(...this.parsePythonRequirements(requirementsFile))
      }
    }

    // Detect Go
    const goFiles = this.findFiles(this.projectRoot, ['.go'])
    if (goFiles.length > 0) {
      languages.push({
        name: 'go',
        fileCount: goFiles.length,
        symbolCount: 0,
        confidence: this.calculateLanguageConfidence('go', goFiles)
      })
      structure.entryPoints.push(...goFiles.filter(f => basename(f) === 'main.go'))
      structure.testFiles.push(...goFiles.filter(f => f.includes('_test.go')))
      
      // Check for Go modules
      const goModFile = join(this.projectRoot, 'go.mod')
      if (existsSync(goModFile)) {
        structure.configFiles.push('go.mod')
        dependencies.push(...this.parseGoMod(goModFile))
      }
    }

    // Detect GDScript/Godot
    const gdscriptFiles = this.findFiles(this.projectRoot, ['.gd'])
    const godotProject = existsSync(join(this.projectRoot, 'project.godot'))
    if (gdscriptFiles.length > 0 || godotProject) {
      languages.push({
        name: 'gdscript',
        fileCount: gdscriptFiles.length,
        symbolCount: 0,
        confidence: godotProject ? 0.95 : 0.7
      })
      if (godotProject) {
        structure.configFiles.push('project.godot')
      }
    }

    // Additional languages can be added here
    // Rust, Java, C#, etc.

    return { languages, structure, dependencies }
  }

  private async indexAllLanguages(): Promise<void> {
    if (!this.projectAnalysis) return

    for (const langInfo of this.projectAnalysis.languages) {
      try {
        const symbols = await this.indexLanguage(langInfo.name)
        this.symbols.push(...symbols)
        langInfo.symbolCount = symbols.length
      } catch (error) {
        console.warn(`⚠️  Could not index ${langInfo.name} files:`, error)
      }
    }
  }

  private async indexLanguage(language: string): Promise<LanguageSymbol[]> {
    switch (language) {
      case 'python':
        return this.indexPythonFiles()
      case 'go':
        return this.indexGoFiles()
      case 'gdscript':
        return this.indexGDScriptFiles()
      default:
        return []
    }
  }

  private async indexPythonFiles(): Promise<LanguageSymbol[]> {
    const pythonFiles = this.findFiles(this.projectRoot, ['.py'])
    const symbols: LanguageSymbol[] = []

    for (const filePath of pythonFiles) {
      try {
        const fileSymbols = await this.parsePythonFile(filePath)
        symbols.push(...fileSymbols)
      } catch (error) {
        console.warn(`⚠️  Could not parse Python file: ${filePath}`)
      }
    }

    return symbols
  }

  private async indexGoFiles(): Promise<LanguageSymbol[]> {
    const goFiles = this.findFiles(this.projectRoot, ['.go'])
    const symbols: LanguageSymbol[] = []

    for (const filePath of goFiles) {
      try {
        const fileSymbols = await this.parseGoFile(filePath)
        symbols.push(...fileSymbols)
      } catch (error) {
        console.warn(`⚠️  Could not parse Go file: ${filePath}`)
      }
    }

    return symbols
  }

  private async indexGDScriptFiles(): Promise<LanguageSymbol[]> {
    const gdFiles = this.findFiles(this.projectRoot, ['.gd'])
    const symbols: LanguageSymbol[] = []

    for (const filePath of gdFiles) {
      try {
        const fileSymbols = await this.parseGDScriptFile(filePath)
        symbols.push(...fileSymbols)
      } catch (error) {
        console.warn(`⚠️  Could not parse GDScript file: ${filePath}`)
      }
    }

    return symbols
  }

  // Language-specific parsers
  private async parsePythonFile(filePath: string): Promise<LanguageSymbol[]> {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\\n')
    const symbols: LanguageSymbol[] = []
    const relativePath = filePath.replace(this.projectRoot, '').substring(1)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNumber = i + 1

      // Parse class definitions
      const classMatch = line.match(/^class\\s+(\\w+)(?:\\s*\\(([^)]*)\\))?\\s*:/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          language: 'python',
          location: { file: relativePath, line: lineNumber },
          extends: classMatch[2],
          signature: line
        })
        continue
      }

      // Parse function definitions
      const funcMatch = line.match(/^(?:async\\s+)?def\\s+(\\w+)\\s*\\(([^)]*)\\)(?:\\s*->\\s*([^:]+))?\\s*:/)
      if (funcMatch) {
        const isMethod = i > 0 && lines.slice(0, i).reverse().some(l => l.trim().startsWith('class '))
        symbols.push({
          name: funcMatch[1],
          type: isMethod ? 'method' : 'function',
          language: 'python',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
        continue
      }

      // Parse variable/constant assignments
      const varMatch = line.match(/^([A-Z_][A-Z0-9_]*)\\s*=/)
      if (varMatch) {
        symbols.push({
          name: varMatch[1],
          type: 'const',
          language: 'python',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
      }
    }

    return symbols
  }

  private async parseGoFile(filePath: string): Promise<LanguageSymbol[]> {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\\n')
    const symbols: LanguageSymbol[] = []
    const relativePath = filePath.replace(this.projectRoot, '').substring(1)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNumber = i + 1

      // Parse struct definitions
      const structMatch = line.match(/^type\\s+(\\w+)\\s+struct\\s*\\{/)
      if (structMatch) {
        symbols.push({
          name: structMatch[1],
          type: 'struct',
          language: 'go',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
        continue
      }

      // Parse interface definitions
      const interfaceMatch = line.match(/^type\\s+(\\w+)\\s+interface\\s*\\{/)
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1],
          type: 'interface',
          language: 'go',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
        continue
      }

      // Parse function definitions
      const funcMatch = line.match(/^func(?:\\s*\\([^)]*\\))?\\s+(\\w+)\\s*\\(([^)]*)\\)(?:\\s*([^{]+))?\\s*\\{/)
      if (funcMatch) {
        const hasReceiver = line.includes('func (')
        symbols.push({
          name: funcMatch[1],
          type: hasReceiver ? 'method' : 'function',
          language: 'go',
          location: { file: relativePath, line: lineNumber },
          signature: line.replace('{', '').trim()
        })
        continue
      }

      // Parse constants
      const constMatch = line.match(/^const\\s+(\\w+)(?:\\s+\\w+)?\\s*=/)
      if (constMatch) {
        symbols.push({
          name: constMatch[1],
          type: 'const',
          language: 'go',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
      }
    }

    return symbols
  }

  private async parseGDScriptFile(filePath: string): Promise<LanguageSymbol[]> {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\\n')
    const symbols: LanguageSymbol[] = []
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
          language: 'gdscript',
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
          language: 'gdscript',
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
          language: 'gdscript',
          location: { file: relativePath, line: lineNumber },
          signature: line
        })
      }
    }

    return symbols
  }

  // Helper methods
  private findFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = []
    
    try {
      const items = readdirSync(dir)
      
      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.findFiles(fullPath, extensions))
        } else if (stat.isFile() && extensions.includes(extname(item))) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Skip unreadable directories
    }
    
    return files
  }

  private calculateLanguageConfidence(language: string, files: string[]): number {
    // Simple confidence calculation based on file count and typical patterns
    let confidence = Math.min(files.length / 10, 0.8) // Base on file count
    
    // Check for language-specific indicators
    switch (language) {
      case 'python':
        if (files.some(f => basename(f) === '__init__.py')) confidence += 0.1
        if (files.some(f => basename(f) === 'setup.py')) confidence += 0.1
        break
      case 'go':
        if (files.some(f => basename(f) === 'main.go')) confidence += 0.1
        if (existsSync(join(this.projectRoot, 'go.mod'))) confidence += 0.2
        break
    }
    
    return Math.min(confidence, 1.0)
  }

  private calculateRelevanceScore(symbol: LanguageSymbol, keywords: string[]): number {
    let score = 0
    const symbolText = `${symbol.name} ${symbol.signature} ${symbol.docstring}`.toLowerCase()
    
    for (const keyword of keywords) {
      if (symbol.name.toLowerCase().includes(keyword)) score += 3
      if (symbol.signature?.toLowerCase().includes(keyword)) score += 2
      if (symbol.docstring?.toLowerCase().includes(keyword)) score += 1
    }
    
    // Boost score for important symbol types
    const typeBonus = { 'class': 2, 'interface': 2, 'struct': 2, 'function': 1 }
    score += typeBonus[symbol.type] || 0
    
    return score
  }

  private detectLanguagePatterns(language: string, symbols: LanguageSymbol[]): string[] {
    const patterns: string[] = []
    
    const classes = symbols.filter(s => s.type === 'class' || s.type === 'struct')
    const functions = symbols.filter(s => s.type === 'function')
    const methods = symbols.filter(s => s.type === 'method')
    
    patterns.push(`${classes.length} classes/structs, ${functions.length} functions, ${methods.length} methods`)
    
    // Language-specific patterns
    switch (language) {
      case 'python':
        const asyncFunctions = symbols.filter(s => s.signature?.includes('async def'))
        if (asyncFunctions.length > 0) {
          patterns.push(`${asyncFunctions.length} async functions detected`)
        }
        break
      case 'go':
        const interfaces = symbols.filter(s => s.type === 'interface')
        patterns.push(`${interfaces.length} interfaces defined`)
        break
      case 'gdscript':
        const signals = symbols.filter(s => s.type === 'signal')
        patterns.push(`${signals.length} signals defined`)
        break
    }
    
    return patterns
  }

  private generateLanguageRecommendations(language: string, symbols: LanguageSymbol[]): string[] {
    const recommendations: string[] = []
    
    // General recommendations
    if (symbols.length === 0) {
      recommendations.push(`No ${language} symbols found - check file parsing`)
      return recommendations
    }
    
    // Language-specific recommendations
    switch (language) {
      case 'python':
        const pythonFunctions = symbols.filter(s => s.type === 'function')
        if (pythonFunctions.length > symbols.filter(s => s.type === 'class').length * 5) {
          recommendations.push('Consider organizing functions into classes for better structure')
        }
        break
      case 'go':
        const goInterfaces = symbols.filter(s => s.type === 'interface')
        if (goInterfaces.length === 0) {
          recommendations.push('Consider defining interfaces for better code organization')
        }
        break
      case 'gdscript':
        const gdClasses = symbols.filter(s => s.type === 'class')
        if (gdClasses.length === 0) {
          recommendations.push('Consider using class-based structure for complex scripts')
        }
        break
    }
    
    return recommendations
  }

  private generateCrossLanguageSuggestions(task: string, symbols: LanguageSymbol[]): string[] {
    const suggestions: string[] = []
    
    const languageCounts: Record<string, number> = {}
    symbols.forEach(s => {
      languageCounts[s.language] = (languageCounts[s.language] || 0) + 1
    })
    
    const languages = Object.keys(languageCounts)
    if (languages.length > 1) {
      suggestions.push(`Multi-language project detected: ${languages.join(', ')}`)
    }
    
    // Task-specific suggestions
    if (task.toLowerCase().includes('api')) {
      const apiSymbols = symbols.filter(s => 
        s.name.toLowerCase().includes('api') || 
        s.name.toLowerCase().includes('handler') ||
        s.name.toLowerCase().includes('route')
      )
      if (apiSymbols.length > 0) {
        suggestions.push(`Found ${apiSymbols.length} API-related symbols`)
      }
    }
    
    return suggestions
  }

  private parsePythonRequirements(filePath: string): string[] {
    try {
      const content = readFileSync(filePath, 'utf8')
      return content.split('\\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('==')[0].split('>=')[0].split('<=')[0])
    } catch {
      return []
    }
  }

  private parseGoMod(filePath: string): string[] {
    try {
      const content = readFileSync(filePath, 'utf8')
      const dependencies: string[] = []
      const lines = content.split('\\n')
      let inRequire = false
      
      for (const line of lines) {
        if (line.trim() === 'require (') {
          inRequire = true
          continue
        }
        if (inRequire && line.trim() === ')') {
          inRequire = false
          continue
        }
        if (inRequire || line.trim().startsWith('require ')) {
          const match = line.match(/\\s*([^\\s]+)/)
          if (match) {
            dependencies.push(match[1])
          }
        }
      }
      
      return dependencies
    } catch {
      return []
    }
  }

  // Export for MCP integration
  getSymbols(): LanguageSymbol[] {
    return this.symbols
  }

  getProjectAnalysis(): ProjectAnalysis | null {
    return this.projectAnalysis
  }

  getSupportedLanguages(): string[] {
    return this.projectAnalysis?.languages.map(l => l.name) || []
  }
}