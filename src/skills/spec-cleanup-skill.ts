// Spec Cleanup Skill for LLM-Charge
// Scans code comments for spec-like content (FEATURE, TODO, SPEC, etc.),
// creates proper specs in the spec system with CodeGraph linking,
// then cleans the original comments from the source code.

import * as fs from 'fs'
import * as path from 'path'

export interface SpecCleanupConfig {
  projectRoot: string
  serverUrl: string
  fileExtensions: string[]
  dryRun: boolean
}

interface ExtractedSpec {
  tag: string
  content: string
  filePath: string
  lineNumber: number
  fullCommentText: string
  surroundingCode: string
}

interface SpecCleanupResult {
  specsCreated: number
  commentsRemoved: number
  filesModified: number
  specs: Array<{
    id: string
    title: string
    source: string
    linkedSymbols: string[]
  }>
  errors: string[]
}

const SPEC_COMMENT_PATTERNS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: 'FEATURE', pattern: /\/\/\s*FEATURE:\s*(.+)/g },
  { tag: 'SPEC', pattern: /\/\/\s*SPEC:\s*(.+)/g },
  { tag: 'TODO', pattern: /\/\/\s*TODO:\s*(.+)/g },
  { tag: 'REQUIREMENT', pattern: /\/\/\s*REQUIREMENT:\s*(.+)/g },
  { tag: 'FIXME', pattern: /\/\/\s*FIXME:\s*(.+)/g },
]

const DEFAULT_FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

export class SpecCleanupSkill {
  private config: SpecCleanupConfig

  constructor(config: Partial<SpecCleanupConfig> & { projectRoot: string }) {
    this.config = {
      projectRoot: config.projectRoot,
      serverUrl: config.serverUrl || 'http://localhost:3001',
      fileExtensions: config.fileExtensions || DEFAULT_FILE_EXTENSIONS,
      dryRun: config.dryRun ?? false,
    }
  }

  async initialize(): Promise<boolean> {
    console.log('Initializing Spec Cleanup Skill...')
    try {
      const response = await fetch(`${this.config.serverUrl}/api/specs`)
      if (!response.ok) {
        console.error('Spec API not available:', response.status)
        return false
      }
      console.log('Spec Cleanup Skill ready')
      return true
    } catch (error) {
      console.error('Spec Cleanup Skill initialization failed:', error)
      return false
    }
  }

  /**
   * Run the full cleanup pipeline: scan -> create specs -> remove comments.
   */
  async runCleanup(): Promise<SpecCleanupResult> {
    const result: SpecCleanupResult = {
      specsCreated: 0,
      commentsRemoved: 0,
      filesModified: 0,
      specs: [],
      errors: [],
    }

    // Step 1: Scan for spec comments
    const extracted = await this.scanForSpecComments()
    if (extracted.length === 0) {
      return result
    }

    // Step 2: Create specs and link via CodeGraph
    const createdSpecs = await this.createSpecsFromComments(extracted, result)

    // Step 3: Remove the original comments from source files
    if (!this.config.dryRun) {
      await this.removeCommentsFromSource(extracted, result)
    }

    result.specs = createdSpecs
    return result
  }

  /**
   * Scan all source files for comments matching spec patterns.
   */
  async scanForSpecComments(): Promise<ExtractedSpec[]> {
    const sourceFiles = this.collectSourceFiles(this.config.projectRoot)
    const extracted: ExtractedSpec[] = []

    for (const filePath of sourceFiles) {
      const fileSpecs = this.extractSpecsFromFile(filePath)
      extracted.push(...fileSpecs)
    }

    return extracted
  }

  private collectSourceFiles(directory: string): string[] {
    const files: string[] = []

    const skipDirectories = new Set([
      'node_modules', 'dist', 'build', '.git', 'coverage',
      '.codegraph', '.vite', 'sample-projects',
    ])

    const entries = fs.readdirSync(directory, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!skipDirectories.has(entry.name)) {
          files.push(...this.collectSourceFiles(fullPath))
        }
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name)
        if (this.config.fileExtensions.includes(extension)) {
          files.push(fullPath)
        }
      }
    }

    return files
  }

  private extractSpecsFromFile(filePath: string): ExtractedSpec[] {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const specs: ExtractedSpec[] = []

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]

      for (const { tag, pattern } of SPEC_COMMENT_PATTERNS) {
        // Reset lastIndex since we reuse regex across lines
        pattern.lastIndex = 0
        const match = pattern.exec(line)
        if (match) {
          const surroundingCode = this.getSurroundingCode(lines, lineIndex)
          specs.push({
            tag,
            content: match[1].trim(),
            filePath,
            lineNumber: lineIndex + 1,
            fullCommentText: line.trimStart(),
            surroundingCode,
          })
        }
      }
    }

    return specs
  }

  private getSurroundingCode(lines: string[], lineIndex: number): string {
    const contextRadius = 3
    const start = Math.max(0, lineIndex - contextRadius)
    const end = Math.min(lines.length - 1, lineIndex + contextRadius)
    return lines.slice(start, end + 1).join('\n')
  }

  /**
   * Create specs in the spec system and link them to code via CodeGraph.
   */
  private async createSpecsFromComments(
    extracted: ExtractedSpec[],
    result: SpecCleanupResult,
  ): Promise<SpecCleanupResult['specs']> {
    const createdSpecs: SpecCleanupResult['specs'] = []

    for (const spec of extracted) {
      try {
        const relativePath = path.relative(this.config.projectRoot, spec.filePath)

        // Search CodeGraph for symbols near this comment
        const linkedSymbols = await this.findLinkedSymbols(relativePath, spec.lineNumber)

        // Build spec data
        const specData = {
          title: `[${spec.tag}] ${spec.content}`,
          description: this.buildSpecDescription(spec, linkedSymbols),
          status: spec.tag === 'FIXME' ? 'active' : 'draft',
          priority: this.inferPriority(spec.tag),
          tags: [spec.tag.toLowerCase(), 'auto-extracted'],
          linkedClasses: linkedSymbols.filter(s => s.type === 'class').map(s => s.symbol),
          linkedMethods: linkedSymbols.filter(s => s.type === 'method' || s.type === 'function').map(s => s.symbol),
          linkedSymbols: linkedSymbols.map(s => ({
            symbol: s.symbol,
            file: s.file,
            line: s.line,
            type: s.type,
          })),
        }

        if (this.config.dryRun) {
          createdSpecs.push({
            id: `dry-run-${result.specsCreated}`,
            title: specData.title,
            source: `${relativePath}:${spec.lineNumber}`,
            linkedSymbols: linkedSymbols.map(s => s.symbol),
          })
          result.specsCreated++
          continue
        }

        // Create spec via API
        const response = await fetch(`${this.config.serverUrl}/api/specs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(specData),
        })

        if (response.ok) {
          const created = await response.json()
          createdSpecs.push({
            id: created.id,
            title: specData.title,
            source: `${relativePath}:${spec.lineNumber}`,
            linkedSymbols: linkedSymbols.map(s => s.symbol),
          })
          result.specsCreated++
        } else {
          result.errors.push(`Failed to create spec from ${relativePath}:${spec.lineNumber}: HTTP ${response.status}`)
        }
      } catch (error) {
        const relativePath = path.relative(this.config.projectRoot, spec.filePath)
        result.errors.push(`Error processing ${relativePath}:${spec.lineNumber}: ${error}`)
      }
    }

    return createdSpecs
  }

  /**
   * Query CodeGraph to find symbols near the comment location.
   */
  private async findLinkedSymbols(
    filePath: string,
    lineNumber: number,
  ): Promise<Array<{ symbol: string; file: string; line: number; type: string }>> {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/codegraph/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: filePath, kind: null, limit: 20 }),
      })

      if (!response.ok) return []

      const results = await response.json()
      if (!Array.isArray(results)) return []

      // Filter to symbols in the same file, preferring those near the comment line
      return results
        .filter((symbol: any) => symbol.file_path?.includes(filePath))
        .sort((a: any, b: any) => {
          const distanceA = Math.abs((a.start_line || 0) - lineNumber)
          const distanceB = Math.abs((b.start_line || 0) - lineNumber)
          return distanceA - distanceB
        })
        .slice(0, 5)
        .map((symbol: any) => ({
          symbol: symbol.name || symbol.qualified_name,
          file: symbol.file_path,
          line: symbol.start_line || 0,
          type: this.mapSymbolKind(symbol.kind),
        }))
    } catch {
      return []
    }
  }

  private mapSymbolKind(kind: string): string {
    const kindMap: Record<string, string> = {
      class: 'class',
      function: 'function',
      method: 'method',
      interface: 'class',
      type: 'class',
      variable: 'function',
      constant: 'function',
    }
    return kindMap[kind?.toLowerCase()] || 'function'
  }

  private buildSpecDescription(spec: ExtractedSpec, linkedSymbols: any[]): string {
    const relativePath = path.relative(this.config.projectRoot, spec.filePath)
    let description = `${spec.content}\n\n`
    description += `**Source:** \`${relativePath}:${spec.lineNumber}\`\n`
    description += `**Original comment:** \`${spec.fullCommentText}\`\n`

    if (linkedSymbols.length > 0) {
      description += `\n**Linked symbols:** ${linkedSymbols.map(s => `\`${s.symbol}\``).join(', ')}`
    }

    return description
  }

  private inferPriority(tag: string): string {
    const priorityMap: Record<string, string> = {
      FIXME: 'high',
      FEATURE: 'medium',
      SPEC: 'medium',
      REQUIREMENT: 'high',
      TODO: 'low',
    }
    return priorityMap[tag] || 'medium'
  }

  /**
   * Remove the extracted spec comments from the source files.
   */
  private async removeCommentsFromSource(
    extracted: ExtractedSpec[],
    result: SpecCleanupResult,
  ): Promise<void> {
    // Group by file so we process each file once
    const byFile = new Map<string, ExtractedSpec[]>()
    for (const spec of extracted) {
      const existing = byFile.get(spec.filePath) || []
      existing.push(spec)
      byFile.set(spec.filePath, existing)
    }

    for (const [filePath, fileSpecs] of byFile) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')

        // Remove lines in reverse order to preserve line numbers
        const lineNumbers = fileSpecs
          .map(s => s.lineNumber - 1) // Convert to 0-based
          .sort((a, b) => b - a)

        for (const lineIndex of lineNumbers) {
          const line = lines[lineIndex]
          const trimmed = line.trim()

          // Only remove the line if the entire line is the comment
          // (don't remove inline comments that share a line with code)
          const isStandaloneComment = SPEC_COMMENT_PATTERNS.some(({ pattern }) => {
            pattern.lastIndex = 0
            return pattern.test(trimmed) && trimmed.startsWith('//')
          })

          if (isStandaloneComment) {
            lines.splice(lineIndex, 1)
            result.commentsRemoved++
          }
        }

        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
        result.filesModified++
      } catch (error) {
        result.errors.push(`Failed to clean ${filePath}: ${error}`)
      }
    }
  }
}

export default SpecCleanupSkill
