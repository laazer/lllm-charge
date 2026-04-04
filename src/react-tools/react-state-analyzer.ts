// React State Management Analyzer Tool
// FEATURE: Analyze React component state patterns and suggest optimizations

import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'

export interface ReactStateAnalysis {
  componentPath: string
  statePatterns: StatePattern[]
  propDrilling: PropDrillingIssue[]
  rerenderRisks: RerenderRisk[]
  optimizationSuggestions: OptimizationSuggestion[]
  score: {
    overall: number
    stateManagement: number
    performance: number
    maintainability: number
  }
}

export interface StatePattern {
  type: 'useState' | 'useReducer' | 'useContext' | 'customStore' | 'props'
  name: string
  complexity: 'low' | 'medium' | 'high'
  lineNumber: number
  dependencies: string[]
  usage: string[]
}

export interface PropDrillingIssue {
  propName: string
  depth: number
  components: string[]
  severity: 'low' | 'medium' | 'high'
  suggestion: string
}

export interface RerenderRisk {
  type: 'useEffect' | 'useCallback' | 'useMemo' | 'componentUpdate'
  risk: 'low' | 'medium' | 'high'
  reason: string
  lineNumber: number
  suggestion: string
}

export interface OptimizationSuggestion {
  type: 'memoization' | 'stateStructure' | 'contextOptimization' | 'hookOptimization'
  priority: 'low' | 'medium' | 'high'
  description: string
  implementation: string
  estimatedImpact: string
}

export class ReactStateAnalyzer {
  private projectRoot: string
  private reactRoot: string

  constructor(projectPath: string) {
    this.projectRoot = projectPath
    this.reactRoot = path.join(projectPath, 'src', 'react')
  }

  async analyzeComponent(componentPath: string): Promise<ReactStateAnalysis> {
    const fullPath = path.isAbsolute(componentPath) 
      ? componentPath 
      : path.join(this.reactRoot, componentPath)

    if (!existsSync(fullPath)) {
      throw new Error(`Component not found: ${fullPath}`)
    }

    const content = await fs.readFile(fullPath, 'utf8')
    const lines = content.split('\n')

    const statePatterns = this.analyzeStatePatterns(content, lines)
    const propDrilling = this.analyzePropDrilling(content, lines)
    const rerenderRisks = this.analyzeRerenderRisks(content, lines)
    const optimizationSuggestions = this.generateOptimizationSuggestions(
      statePatterns, 
      propDrilling, 
      rerenderRisks
    )

    const score = this.calculateScore(statePatterns, propDrilling, rerenderRisks)

    return {
      componentPath: fullPath,
      statePatterns,
      propDrilling,
      rerenderRisks,
      optimizationSuggestions,
      score
    }
  }

  async analyzeProject(): Promise<ReactStateAnalysis[]> {
    const componentFiles = await this.findReactComponents()
    const analyses: ReactStateAnalysis[] = []

    for (const file of componentFiles) {
      try {
        const analysis = await this.analyzeComponent(file)
        analyses.push(analysis)
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error)
      }
    }

    return analyses
  }

  private async findReactComponents(): Promise<string[]> {
    const components: string[] = []

    const searchDirs = [
      path.join(this.reactRoot, 'components'),
      path.join(this.reactRoot, 'pages'),
      path.join(this.reactRoot, 'store')
    ]

    for (const dir of searchDirs) {
      if (existsSync(dir)) {
        const files = await this.findTSXFiles(dir)
        components.push(...files)
      }
    }

    return components
  }

  private async findTSXFiles(dir: string): Promise<string[]> {
    const files: string[] = []
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        const subFiles = await this.findTSXFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
        files.push(fullPath)
      }
    }

    return files
  }

  private analyzeStatePatterns(content: string, lines: string[]): StatePattern[] {
    const patterns: StatePattern[] = []

    // Analyze useState patterns
    const useStateMatches = content.matchAll(/const\s+\[([^,]+),\s*([^\]]+)\]\s*=\s*useState\s*\(([^)]*)\)/g)
    for (const match of useStateMatches) {
      const lineNumber = this.getLineNumber(lines, match.index!)
      patterns.push({
        type: 'useState',
        name: match[1].trim(),
        complexity: this.assessStateComplexity(match[3]),
        lineNumber,
        dependencies: this.extractDependencies(content, match[1].trim()),
        usage: this.findUsagePatterns(content, match[1].trim(), match[2].trim())
      })
    }

    // Analyze useReducer patterns
    const useReducerMatches = content.matchAll(/const\s+\[([^,]+),\s*([^\]]+)\]\s*=\s*useReducer\s*\(([^)]*)\)/g)
    for (const match of useReducerMatches) {
      const lineNumber = this.getLineNumber(lines, match.index!)
      patterns.push({
        type: 'useReducer',
        name: match[1].trim(),
        complexity: 'high', // useReducer is typically for complex state
        lineNumber,
        dependencies: this.extractDependencies(content, match[1].trim()),
        usage: this.findUsagePatterns(content, match[1].trim(), match[2].trim())
      })
    }

    // Analyze useContext patterns
    const useContextMatches = content.matchAll(/const\s+([^=]+)\s*=\s*useContext\s*\(([^)]+)\)/g)
    for (const match of useContextMatches) {
      const lineNumber = this.getLineNumber(lines, match.index!)
      patterns.push({
        type: 'useContext',
        name: match[1].trim(),
        complexity: 'medium',
        lineNumber,
        dependencies: [],
        usage: this.findUsagePatterns(content, match[1].trim())
      })
    }

    return patterns
  }

  private analyzePropDrilling(content: string, lines: string[]): PropDrillingIssue[] {
    const issues: PropDrillingIssue[] = []

    // Look for props passed through multiple levels
    const propMatches = content.matchAll(/(\w+):\s*props\.(\w+)/g)
    const propCounts: Record<string, number> = {}

    for (const match of propMatches) {
      const propName = match[2]
      propCounts[propName] = (propCounts[propName] || 0) + 1
    }

    // Identify potential prop drilling (props passed but not used directly)
    Object.entries(propCounts).forEach(([propName, count]) => {
      if (count > 2) { // Prop passed through multiple components
        issues.push({
          propName,
          depth: count,
          components: [path.basename(lines[0] || 'unknown')], // Simplified - would need deeper analysis
          severity: count > 4 ? 'high' : count > 3 ? 'medium' : 'low',
          suggestion: `Consider using React Context or a state management library for '${propName}'`
        })
      }
    })

    return issues
  }

  private analyzeRerenderRisks(content: string, lines: string[]): RerenderRisk[] {
    const risks: RerenderRisk[] = []

    // Analyze useEffect dependencies
    const useEffectMatches = content.matchAll(/useEffect\s*\(\s*[^,]+,\s*\[([^\]]*)\]/g)
    for (const match of useEffectMatches) {
      const lineNumber = this.getLineNumber(lines, match.index!)
      const deps = match[1].split(',').map(d => d.trim()).filter(d => d)

      if (deps.length === 0 && match[1].trim() === '') {
        // Empty dependency array is usually fine
        continue
      }

      // Check for object/array dependencies that might cause unnecessary rerenders
      const riskDeps = deps.filter(dep => 
        dep.includes('.') || // Object property access
        dep.includes('[') || // Array/object access
        /^[a-z]/.test(dep) && !dep.includes('Ref') // Non-ref variables
      )

      if (riskDeps.length > 0) {
        risks.push({
          type: 'useEffect',
          risk: riskDeps.length > 2 ? 'high' : 'medium',
          reason: `Dependencies may cause unnecessary rerenders: ${riskDeps.join(', ')}`,
          lineNumber,
          suggestion: 'Consider using useCallback or useMemo for object/function dependencies'
        })
      }
    }

    // Check for missing useCallback on function props
    const functionPropMatches = content.matchAll(/(\w+):\s*\([^)]*\)\s*=>/g)
    for (const match of functionPropMatches) {
      const lineNumber = this.getLineNumber(lines, match.index!)
      if (!content.includes(`useCallback`) || !content.includes(match[1])) {
        risks.push({
          type: 'useCallback',
          risk: 'medium',
          reason: `Function '${match[1]}' may cause child component rerenders`,
          lineNumber,
          suggestion: `Wrap '${match[1]}' in useCallback to prevent unnecessary rerenders`
        })
      }
    }

    return risks
  }

  private generateOptimizationSuggestions(
    statePatterns: StatePattern[], 
    propDrilling: PropDrillingIssue[], 
    rerenderRisks: RerenderRisk[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []

    // State structure optimizations
    const complexStates = statePatterns.filter(p => p.complexity === 'high')
    if (complexStates.length > 3) {
      suggestions.push({
        type: 'stateStructure',
        priority: 'high',
        description: 'Consider consolidating related state with useReducer',
        implementation: 'Combine related useState calls into a single useReducer with proper actions',
        estimatedImpact: 'Improved maintainability and reduced complexity'
      })
    }

    // Context optimization suggestions
    const contextUsage = statePatterns.filter(p => p.type === 'useContext')
    if (contextUsage.length > 0 && propDrilling.length > 2) {
      suggestions.push({
        type: 'contextOptimization',
        priority: 'medium',
        description: 'Optimize Context usage to reduce prop drilling',
        implementation: 'Split large contexts into smaller, focused contexts',
        estimatedImpact: 'Reduced prop drilling and improved performance'
      })
    }

    // Memoization suggestions based on rerender risks
    const highRiskRerenders = rerenderRisks.filter(r => r.risk === 'high')
    if (highRiskRerenders.length > 0) {
      suggestions.push({
        type: 'memoization',
        priority: 'high',
        description: 'Add memoization to prevent unnecessary rerenders',
        implementation: 'Use React.memo, useMemo, and useCallback strategically',
        estimatedImpact: 'Significantly improved rendering performance'
      })
    }

    return suggestions
  }

  private calculateScore(
    statePatterns: StatePattern[], 
    propDrilling: PropDrillingIssue[], 
    rerenderRisks: RerenderRisk[]
  ) {
    // State management score (0-100)
    const stateScore = Math.max(0, 100 - 
      (statePatterns.filter(p => p.complexity === 'high').length * 15) -
      (statePatterns.filter(p => p.complexity === 'medium').length * 8)
    )

    // Performance score (0-100)
    const performanceScore = Math.max(0, 100 - 
      (rerenderRisks.filter(r => r.risk === 'high').length * 20) -
      (rerenderRisks.filter(r => r.risk === 'medium').length * 10)
    )

    // Maintainability score (0-100)
    const maintainabilityScore = Math.max(0, 100 - 
      (propDrilling.filter(p => p.severity === 'high').length * 25) -
      (propDrilling.filter(p => p.severity === 'medium').length * 15)
    )

    const overall = Math.round((stateScore + performanceScore + maintainabilityScore) / 3)

    return {
      overall,
      stateManagement: Math.round(stateScore),
      performance: Math.round(performanceScore),
      maintainability: Math.round(maintainabilityScore)
    }
  }

  private getLineNumber(lines: string[], index: number): number {
    const beforeMatch = lines.join('\n').substring(0, index)
    return beforeMatch.split('\n').length
  }

  private assessStateComplexity(initialValue: string): 'low' | 'medium' | 'high' {
    if (initialValue.includes('{') || initialValue.includes('[')) {
      return 'high' // Object or array state
    }
    if (initialValue.includes('()') || initialValue.length > 20) {
      return 'medium' // Function or complex initial value
    }
    return 'low' // Simple primitive state
  }

  private extractDependencies(content: string, stateName: string): string[] {
    const deps: string[] = []
    
    // Find useEffect dependencies that include this state
    const effectMatches = content.matchAll(/useEffect\s*\([^,]+,\s*\[([^\]]*)\]/g)
    for (const match of effectMatches) {
      if (match[1].includes(stateName)) {
        const allDeps = match[1].split(',').map(d => d.trim()).filter(d => d)
        deps.push(...allDeps.filter(d => d !== stateName))
      }
    }

    return [...new Set(deps)] // Remove duplicates
  }

  private findUsagePatterns(content: string, ...names: string[]): string[] {
    const patterns: string[] = []
    
    for (const name of names) {
      // Find where this state/setter is used
      const usageRegex = new RegExp(`\\b${name}\\b`, 'g')
      const matches = content.match(usageRegex)
      if (matches && matches.length > 2) { // More than just declaration
        patterns.push(`Used ${matches.length - 1} times`)
      }

      // Check for specific patterns
      if (content.includes(`${name}(`)) {
        patterns.push('Function calls')
      }
      if (content.includes(`...${name}`)) {
        patterns.push('Spread usage')
      }
      if (content.includes(`${name}.`)) {
        patterns.push('Property access')
      }
    }

    return patterns
  }
}