import { promises as fs } from 'fs'
import path from 'path'
import BaseService from './base-service.mjs'

/**
 * Real project analyzer - no fake data!
 * Analyzes actual file system and code structure
 */
export class RealProjectAnalyzer extends BaseService {
  constructor() {
    super()
    this.analysisCache = new Map()
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes
  }

  async setup() {
    console.log('🔍 Real project analyzer initialized - analyzing actual files')
  }

  /**
   * Analyze a real project directory
   */
  async analyzeProject(projectPath) {
    // Check cache first
    const cacheKey = path.resolve(projectPath)
    const cached = this.analysisCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📊 Using cached project analysis')
      return cached.analysis
    }

    console.log('🔍 Starting REAL file system analysis of:', cacheKey)
    
    try {
      const analysis = {
        projectPath: cacheKey,
        lastAnalyzed: new Date(),
        files: await this.analyzeFiles(projectPath),
        codeGraph: await this.analyzeCodeGraph(projectPath),
        dependencies: await this.analyzeDependencies(projectPath),
        modules: await this.analyzeModules(projectPath)
      }

      // Cache the result
      this.analysisCache.set(cacheKey, {
        analysis,
        timestamp: Date.now()
      })

      console.log('✅ Real project analysis complete:', {
        totalFiles: analysis.files.total,
        codeGraph: analysis.codeGraph.functions + ' functions',
        dependencies: analysis.dependencies + ' dependencies'
      })

      return analysis
    } catch (error) {
      console.error('❌ Real project analysis failed:', error)
      return this.getEmptyAnalysis(cacheKey)
    }
  }

  /**
   * Analyze real files in the project
   */
  async analyzeFiles(projectPath) {
    const files = {
      total: 0,
      byType: {},
      hotFiles: [],
      fileConnections: {},
      directories: new Set(),
      lastScanned: new Date()
    }

    try {
      await this.scanDirectory(projectPath, files, projectPath)
    } catch (error) {
      console.warn('⚠️ File scanning error:', error)
    }

    // Sort file types by count
    const sortedTypes = Object.entries(files.byType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10) // Top 10 file types

    files.byType = Object.fromEntries(sortedTypes)

    return files
  }

  /**
   * Recursively scan directory
   */
  async scanDirectory(dirPath, files, rootPath, depth = 0) {
    if (depth > 10) return // Prevent infinite recursion

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(rootPath, fullPath)

        // Skip node_modules, .git, and other common ignore patterns
        if (this.shouldSkip(entry.name, relativePath)) continue

        if (entry.isDirectory()) {
          files.directories.add(relativePath)
          await this.scanDirectory(fullPath, files, rootPath, depth + 1)
        } else if (entry.isFile()) {
          files.total++
          
          const ext = path.extname(entry.name)
          files.byType[ext] = (files.byType[ext] || 0) + 1

          // Track recently modified files
          try {
            const stat = await fs.stat(fullPath)
            const daysSinceModified = (Date.now() - stat.mtime.getTime()) / (24 * 60 * 60 * 1000)
            
            if (daysSinceModified < 7) { // Modified in last week
              files.hotFiles.push({
                name: entry.name,
                path: relativePath,
                lastModified: stat.mtime,
                size: stat.size
              })
            }
          } catch (statError) {
            // Ignore stat errors
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error scanning directory:', dirPath, error.message)
    }
  }

  /**
   * Check if file/directory should be skipped
   */
  shouldSkip(name, relativePath) {
    const skipPatterns = [
      'node_modules',
      '.git',
      '.DS_Store',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'temp',
      'tmp',
      '.cache'
    ]

    return skipPatterns.some(pattern => 
      name === pattern || 
      relativePath.includes(pattern) ||
      name.startsWith('.')
    )
  }

  /**
   * Analyze real code graph (functions, classes, etc.)
   */
  async analyzeCodeGraph(projectPath) {
    const codeGraph = {
      functions: 0,
      classes: 0,
      connections: 0,
      topFunctions: [],
      fileNodes: [],
      lastAnalyzed: new Date()
    }

    try {
      await this.scanForCodeElements(projectPath, codeGraph, projectPath)
    } catch (error) {
      console.warn('⚠️ Code graph analysis error:', error)
    }

    return codeGraph
  }

  /**
   * Scan for actual code elements
   */
  async scanForCodeElements(dirPath, codeGraph, rootPath, depth = 0) {
    if (depth > 10) return

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(rootPath, fullPath)

        if (this.shouldSkip(entry.name, relativePath)) continue

        if (entry.isDirectory()) {
          await this.scanForCodeElements(fullPath, codeGraph, rootPath, depth + 1)
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          await this.analyzeCodeFile(fullPath, relativePath, codeGraph)
        }
      }
    } catch (error) {
      console.warn('⚠️ Error scanning for code elements:', dirPath, error.message)
    }
  }

  /**
   * Check if file is a code file
   */
  isCodeFile(filename) {
    const codeExtensions = ['.js', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.rb', '.go', '.rs']
    return codeExtensions.includes(path.extname(filename))
  }

  /**
   * Analyze individual code file
   */
  async analyzeCodeFile(filePath, relativePath, codeGraph) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      
      // Count functions (basic regex - could be improved)
      const functionMatches = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\s*\(|class\s+\w+)/g) || []
      codeGraph.functions += functionMatches.length

      // Count classes
      const classMatches = content.match(/class\s+\w+/g) || []
      codeGraph.classes += classMatches.length

      // Count imports/connections (basic)
      const importMatches = content.match(/(?:import.*from|require\()/g) || []
      codeGraph.connections += importMatches.length

      // Add file node
      codeGraph.fileNodes.push({
        id: relativePath,
        name: path.basename(filePath),
        path: relativePath,
        size: content.length,
        functions: functionMatches.length,
        classes: classMatches.length,
        imports: importMatches.length
      })

    } catch (error) {
      console.warn('⚠️ Error analyzing code file:', filePath, error.message)
    }
  }

  /**
   * Analyze real dependencies
   */
  async analyzeDependencies(projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json')
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      
      const deps = Object.keys(packageJson.dependencies || {})
      const devDeps = Object.keys(packageJson.devDependencies || {})
      
      return deps.length + devDeps.length
    } catch (error) {
      console.warn('⚠️ Could not analyze dependencies:', error.message)
      return 0
    }
  }

  /**
   * Analyze real modules
   */
  async analyzeModules(projectPath) {
    const modules = new Set()
    
    try {
      await this.scanForModules(projectPath, modules, projectPath)
    } catch (error) {
      console.warn('⚠️ Module analysis error:', error)
    }
    
    return modules.size
  }

  /**
   * Scan for actual modules/packages
   */
  async scanForModules(dirPath, modules, rootPath, depth = 0) {
    if (depth > 5) return // Limit depth for modules

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (this.shouldSkip(entry.name, '')) continue

        if (entry.isDirectory()) {
          modules.add(entry.name)
          const fullPath = path.join(dirPath, entry.name)
          await this.scanForModules(fullPath, modules, rootPath, depth + 1)
        }
      }
    } catch (error) {
      console.warn('⚠️ Error scanning for modules:', dirPath, error.message)
    }
  }

  /**
   * Get empty analysis when real analysis fails
   */
  getEmptyAnalysis(projectPath) {
    return {
      projectPath,
      lastAnalyzed: new Date(),
      files: {
        total: 0,
        byType: {},
        hotFiles: [],
        fileConnections: {},
        directories: new Set(),
        error: 'Analysis failed - showing empty results instead of fake data'
      },
      codeGraph: {
        functions: 0,
        classes: 0,
        connections: 0,
        topFunctions: [],
        fileNodes: [],
        error: 'Code analysis failed - no fake data shown'
      },
      dependencies: 0,
      modules: 0,
      error: 'Project analysis failed - real data unavailable'
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.analysisCache.clear()
    console.log('🗑️ Analysis cache cleared')
  }
}

export default RealProjectAnalyzer