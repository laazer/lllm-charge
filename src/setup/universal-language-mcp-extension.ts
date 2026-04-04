// Universal Language MCP Extension
// Comprehensive support for ALL common programming languages

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

export type SupportedLanguage = 
  | 'javascript' | 'typescript' | 'python' | 'go' | 'gdscript' 
  | 'rust' | 'java' | 'csharp' | 'cpp' | 'c' | 'php' | 'ruby' 
  | 'swift' | 'kotlin' | 'scala' | 'dart' | 'elixir' | 'haskell'
  | 'clojure' | 'fsharp' | 'julia' | 'r' | 'matlab' | 'lua'
  | 'perl' | 'bash' | 'powershell' | 'html' | 'css' | 'sql'
  | 'yaml' | 'json' | 'xml' | 'toml' | 'dockerfile' | 'makefile'

export interface UniversalSymbol {
  name: string
  type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'struct' 
       | 'const' | 'enum' | 'trait' | 'protocol' | 'module' | 'namespace'
       | 'signal' | 'property' | 'field' | 'import' | 'export' | 'annotation'
  language: SupportedLanguage
  location: {
    file: string
    line: number
    column?: number
  }
  signature?: string
  docstring?: string
  visibility?: 'public' | 'private' | 'protected' | 'internal' | 'package'
  modifiers?: string[]
  extends?: string
  implements?: string[]
  genericTypes?: string[]
  returns?: string
}

export interface LanguageConfig {
  name: SupportedLanguage
  extensions: string[]
  entryPointFiles: string[]
  testPatterns: string[]
  configFiles: string[]
  buildFiles: string[]
  dependencyFiles: string[]
  packageManagers: string[]
}

export const LANGUAGE_CONFIGS: LanguageConfig[] = [
  // Web Technologies
  {
    name: 'javascript',
    extensions: ['.js', '.mjs', '.cjs'],
    entryPointFiles: ['index.js', 'main.js', 'app.js', 'server.js'],
    testPatterns: ['*.test.js', '*.spec.js', '/tests/', '/test/'],
    configFiles: ['package.json', '.eslintrc.js', 'webpack.config.js'],
    buildFiles: ['webpack.config.js', 'rollup.config.js', 'vite.config.js'],
    dependencyFiles: ['package.json', 'yarn.lock', 'package-lock.json'],
    packageManagers: ['npm', 'yarn', 'pnpm']
  },
  {
    name: 'typescript',
    extensions: ['.ts', '.tsx', '.d.ts'],
    entryPointFiles: ['index.ts', 'main.ts', 'app.ts', 'server.ts'],
    testPatterns: ['*.test.ts', '*.spec.ts', '/tests/', '/test/'],
    configFiles: ['tsconfig.json', 'tslint.json'],
    buildFiles: ['webpack.config.ts', 'vite.config.ts'],
    dependencyFiles: ['package.json'],
    packageManagers: ['npm', 'yarn', 'pnpm']
  },
  
  // System Programming
  {
    name: 'rust',
    extensions: ['.rs'],
    entryPointFiles: ['main.rs', 'lib.rs', 'mod.rs'],
    testPatterns: ['*_test.rs', '/tests/'],
    configFiles: ['Cargo.toml', 'rust-toolchain.toml'],
    buildFiles: ['build.rs', 'Cargo.toml'],
    dependencyFiles: ['Cargo.toml', 'Cargo.lock'],
    packageManagers: ['cargo']
  },
  {
    name: 'go',
    extensions: ['.go'],
    entryPointFiles: ['main.go'],
    testPatterns: ['*_test.go'],
    configFiles: ['go.mod', 'go.sum'],
    buildFiles: ['Makefile', 'build.go'],
    dependencyFiles: ['go.mod', 'go.sum'],
    packageManagers: ['go']
  },
  {
    name: 'cpp',
    extensions: ['.cpp', '.cc', '.cxx', '.c++'],
    entryPointFiles: ['main.cpp', 'main.cc'],
    testPatterns: ['test_*.cpp', '*_test.cpp'],
    configFiles: ['CMakeLists.txt', 'conanfile.txt', 'vcpkg.json'],
    buildFiles: ['Makefile', 'CMakeLists.txt', 'meson.build'],
    dependencyFiles: ['conanfile.txt', 'vcpkg.json'],
    packageManagers: ['conan', 'vcpkg', 'cmake']
  },
  {
    name: 'c',
    extensions: ['.c', '.h'],
    entryPointFiles: ['main.c'],
    testPatterns: ['test_*.c', '*_test.c'],
    configFiles: ['CMakeLists.txt'],
    buildFiles: ['Makefile', 'CMakeLists.txt'],
    dependencyFiles: ['conanfile.txt'],
    packageManagers: ['make', 'cmake']
  },

  // JVM Languages  
  {
    name: 'java',
    extensions: ['.java'],
    entryPointFiles: ['Main.java', 'Application.java'],
    testPatterns: ['*Test.java', '*Tests.java', '/test/'],
    configFiles: ['pom.xml', 'build.gradle', 'application.properties'],
    buildFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    dependencyFiles: ['pom.xml', 'build.gradle'],
    packageManagers: ['maven', 'gradle']
  },
  {
    name: 'kotlin',
    extensions: ['.kt', '.kts'],
    entryPointFiles: ['Main.kt'],
    testPatterns: ['*Test.kt', '*Tests.kt'],
    configFiles: ['build.gradle.kts', 'pom.xml'],
    buildFiles: ['build.gradle.kts', 'build.gradle'],
    dependencyFiles: ['build.gradle.kts', 'pom.xml'],
    packageManagers: ['gradle', 'maven']
  },
  {
    name: 'scala',
    extensions: ['.scala', '.sc'],
    entryPointFiles: ['Main.scala', 'App.scala'],
    testPatterns: ['*Test.scala', '*Spec.scala'],
    configFiles: ['build.sbt', 'project/build.properties'],
    buildFiles: ['build.sbt', 'project/'],
    dependencyFiles: ['build.sbt'],
    packageManagers: ['sbt']
  },

  // .NET Languages
  {
    name: 'csharp',
    extensions: ['.cs'],
    entryPointFiles: ['Program.cs', 'Main.cs'],
    testPatterns: ['*Test.cs', '*Tests.cs', '/Tests/'],
    configFiles: ['*.csproj', '*.sln', 'appsettings.json'],
    buildFiles: ['*.csproj', '*.sln'],
    dependencyFiles: ['*.csproj', 'packages.config'],
    packageManagers: ['dotnet', 'nuget']
  },
  {
    name: 'fsharp',
    extensions: ['.fs', '.fsx', '.fsi'],
    entryPointFiles: ['Program.fs'],
    testPatterns: ['*Test.fs', '*Tests.fs'],
    configFiles: ['*.fsproj'],
    buildFiles: ['*.fsproj'],
    dependencyFiles: ['*.fsproj'],
    packageManagers: ['dotnet']
  },

  // Scripting Languages
  {
    name: 'python',
    extensions: ['.py', '.pyw', '.py3'],
    entryPointFiles: ['main.py', '__init__.py', 'app.py', 'run.py'],
    testPatterns: ['test_*.py', '*_test.py', '/tests/', '/test/'],
    configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'setup.cfg'],
    buildFiles: ['setup.py', 'pyproject.toml', 'Makefile'],
    dependencyFiles: ['requirements.txt', 'Pipfile', 'poetry.lock', 'pyproject.toml'],
    packageManagers: ['pip', 'pipenv', 'poetry', 'conda']
  },
  {
    name: 'ruby',
    extensions: ['.rb', '.rbw'],
    entryPointFiles: ['main.rb', 'app.rb'],
    testPatterns: ['*_test.rb', '*_spec.rb', '/spec/', '/test/'],
    configFiles: ['Gemfile', 'config.ru', 'Rakefile'],
    buildFiles: ['Rakefile', 'Gemfile'],
    dependencyFiles: ['Gemfile', 'Gemfile.lock'],
    packageManagers: ['gem', 'bundler']
  },
  {
    name: 'php',
    extensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.phps'],
    entryPointFiles: ['index.php', 'main.php', 'app.php'],
    testPatterns: ['*Test.php', '*test.php', '/tests/'],
    configFiles: ['composer.json', 'php.ini', '.env'],
    buildFiles: ['composer.json', 'Makefile'],
    dependencyFiles: ['composer.json', 'composer.lock'],
    packageManagers: ['composer']
  },

  // Mobile Development
  {
    name: 'swift',
    extensions: ['.swift'],
    entryPointFiles: ['main.swift', 'App.swift'],
    testPatterns: ['*Test.swift', '*Tests.swift'],
    configFiles: ['Package.swift', '*.xcodeproj'],
    buildFiles: ['Package.swift', 'Makefile'],
    dependencyFiles: ['Package.swift', 'Package.resolved'],
    packageManagers: ['swift-package-manager', 'cocoapods']
  },
  {
    name: 'dart',
    extensions: ['.dart'],
    entryPointFiles: ['main.dart', 'lib/main.dart'],
    testPatterns: ['*_test.dart', '/test/'],
    configFiles: ['pubspec.yaml', 'analysis_options.yaml'],
    buildFiles: ['pubspec.yaml'],
    dependencyFiles: ['pubspec.yaml', 'pubspec.lock'],
    packageManagers: ['pub', 'flutter']
  },

  // Game Development  
  {
    name: 'gdscript',
    extensions: ['.gd'],
    entryPointFiles: ['main.gd', 'Main.gd'],
    testPatterns: ['test_*.gd'],
    configFiles: ['project.godot', 'export_presets.cfg'],
    buildFiles: ['project.godot'],
    dependencyFiles: ['project.godot'],
    packageManagers: ['godot']
  },

  // Functional Languages
  {
    name: 'haskell',
    extensions: ['.hs', '.lhs'],
    entryPointFiles: ['Main.hs'],
    testPatterns: ['*Test.hs', '*Spec.hs'],
    configFiles: ['*.cabal', 'stack.yaml', 'cabal.project'],
    buildFiles: ['*.cabal', 'stack.yaml'],
    dependencyFiles: ['*.cabal', 'stack.yaml'],
    packageManagers: ['cabal', 'stack']
  },
  {
    name: 'clojure',
    extensions: ['.clj', '.cljs', '.cljc'],
    entryPointFiles: ['core.clj', 'main.clj'],
    testPatterns: ['*_test.clj'],
    configFiles: ['project.clj', 'deps.edn', 'leiningen.clj'],
    buildFiles: ['project.clj', 'deps.edn'],
    dependencyFiles: ['project.clj', 'deps.edn'],
    packageManagers: ['leiningen', 'clj']
  },
  {
    name: 'elixir',
    extensions: ['.ex', '.exs'],
    entryPointFiles: ['main.ex', 'application.ex'],
    testPatterns: ['*_test.exs'],
    configFiles: ['mix.exs', 'config.exs'],
    buildFiles: ['mix.exs'],
    dependencyFiles: ['mix.exs', 'mix.lock'],
    packageManagers: ['mix']
  },

  // Data Science & Analytics
  {
    name: 'r',
    extensions: ['.r', '.R'],
    entryPointFiles: ['main.R', 'app.R'],
    testPatterns: ['test*.R'],
    configFiles: ['DESCRIPTION', '.Rprofile'],
    buildFiles: ['DESCRIPTION', 'Makefile'],
    dependencyFiles: ['DESCRIPTION', 'renv.lock'],
    packageManagers: ['cran', 'renv']
  },
  {
    name: 'julia',
    extensions: ['.jl'],
    entryPointFiles: ['main.jl'],
    testPatterns: ['test*.jl', '/test/'],
    configFiles: ['Project.toml', 'Manifest.toml'],
    buildFiles: ['Project.toml'],
    dependencyFiles: ['Project.toml', 'Manifest.toml'],
    packageManagers: ['pkg']
  },
  {
    name: 'matlab',
    extensions: ['.m', '.mlx'],
    entryPointFiles: ['main.m'],
    testPatterns: ['test*.m'],
    configFiles: ['startup.m'],
    buildFiles: [],
    dependencyFiles: [],
    packageManagers: []
  },

  // Shell & Config
  {
    name: 'bash',
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    entryPointFiles: ['main.sh', 'run.sh', 'start.sh'],
    testPatterns: ['test*.sh'],
    configFiles: ['.bashrc', '.zshrc'],
    buildFiles: ['Makefile'],
    dependencyFiles: [],
    packageManagers: []
  },
  {
    name: 'powershell',
    extensions: ['.ps1', '.psm1', '.psd1'],
    entryPointFiles: ['main.ps1'],
    testPatterns: ['*.Tests.ps1'],
    configFiles: ['profile.ps1'],
    buildFiles: [],
    dependencyFiles: [],
    packageManagers: []
  },

  // Markup & Data
  {
    name: 'html',
    extensions: ['.html', '.htm', '.xhtml'],
    entryPointFiles: ['index.html', 'main.html'],
    testPatterns: [],
    configFiles: [],
    buildFiles: [],
    dependencyFiles: [],
    packageManagers: []
  },
  {
    name: 'css',
    extensions: ['.css', '.scss', '.sass', '.less'],
    entryPointFiles: ['main.css', 'style.css', 'styles.css'],
    testPatterns: [],
    configFiles: [],
    buildFiles: [],
    dependencyFiles: [],
    packageManagers: []
  },
  {
    name: 'sql',
    extensions: ['.sql'],
    entryPointFiles: ['main.sql', 'init.sql'],
    testPatterns: ['test*.sql'],
    configFiles: [],
    buildFiles: [],
    dependencyFiles: [],
    packageManagers: []
  },

  // Configuration Languages
  {
    name: 'yaml',
    extensions: ['.yaml', '.yml'],
    entryPointFiles: [],
    testPatterns: [],
    configFiles: ['docker-compose.yml', '.github/workflows/*.yml'],
    buildFiles: ['.github/workflows/*.yml'],
    dependencyFiles: [],
    packageManagers: []
  },
  {
    name: 'json',
    extensions: ['.json'],
    entryPointFiles: [],
    testPatterns: [],
    configFiles: ['package.json', 'tsconfig.json', 'composer.json'],
    buildFiles: [],
    dependencyFiles: ['package.json'],
    packageManagers: []
  },
  {
    name: 'toml',
    extensions: ['.toml'],
    entryPointFiles: [],
    testPatterns: [],
    configFiles: ['Cargo.toml', 'pyproject.toml'],
    buildFiles: ['Cargo.toml'],
    dependencyFiles: ['Cargo.toml', 'pyproject.toml'],
    packageManagers: []
  },
  {
    name: 'dockerfile',
    extensions: ['.dockerfile'],
    entryPointFiles: ['Dockerfile'],
    testPatterns: [],
    configFiles: ['Dockerfile', 'docker-compose.yml'],
    buildFiles: ['Dockerfile'],
    dependencyFiles: [],
    packageManagers: ['docker']
  }
]

export class UniversalLanguageMCPExtension {
  private projectRoot: string
  private symbols: UniversalSymbol[] = []
  private detectedLanguages: Map<SupportedLanguage, LanguageConfig> = new Map()
  private devDocsExtension?: import('./devdocs-mcp-extension').DevDocsMCPExtension

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async setDevDocsExtension(devDocs: import('./devdocs-mcp-extension').DevDocsMCPExtension): Promise<void> {
    this.devDocsExtension = devDocs
  }

  async initialize(): Promise<boolean> {
    console.log('🌍 Initializing UNIVERSAL language support...')
    
    // Detect all languages in project
    await this.detectAllLanguages()
    
    // Index symbols for all detected languages
    await this.indexAllDetectedLanguages()
    
    const languageNames = Array.from(this.detectedLanguages.keys()).join(', ')
    console.log(`✅ Universal indexing complete: ${languageNames} (${this.symbols.length} symbols)`)
    
    return this.symbols.length > 0
  }

  // MCP Tool: Search across ALL languages
  async universalSymbolSearch(
    query: string, 
    language?: SupportedLanguage,
    symbolType?: string,
    limit: number = 25
  ): Promise<UniversalSymbol[]> {
    const normalizedQuery = query.toLowerCase()
    
    let filteredSymbols = this.symbols
    
    if (language) {
      filteredSymbols = filteredSymbols.filter(s => s.language === language)
    }
    
    if (symbolType) {
      filteredSymbols = filteredSymbols.filter(s => s.type === symbolType)
    }
    
    return filteredSymbols
      .filter(symbol => {
        const symbolText = `${symbol.name} ${symbol.signature} ${symbol.docstring}`.toLowerCase()
        return symbolText.includes(normalizedQuery)
      })
      .sort((a, b) => {
        // Relevance scoring
        const scoreA = this.calculateUniversalRelevanceScore(a, normalizedQuery)
        const scoreB = this.calculateUniversalRelevanceScore(b, normalizedQuery)
        return scoreB - scoreA
      })
      .slice(0, limit)
  }

  // MCP Tool: Cross-language analysis with documentation integration
  async crossLanguageAnalysis(task: string): Promise<{
    taskRelevantSymbols: UniversalSymbol[]
    languageDistribution: Record<string, number>
    crossLanguagePatterns: string[]
    recommendations: string[]
    documentationContext?: {
      relevantDocs: Array<{
        language: string
        title: string
        content: string
        relevance: number
      }>
      suggestions: string[]
    }
  }> {
    const taskKeywords = task.toLowerCase().split(' ').filter(w => w.length > 2)
    
    // Find symbols relevant to task across all languages
    const taskRelevantSymbols = this.symbols.filter(symbol => {
      const symbolText = `${symbol.name} ${symbol.signature} ${symbol.docstring}`.toLowerCase()
      return taskKeywords.some(keyword => symbolText.includes(keyword))
    }).slice(0, 30)

    // Calculate language distribution
    const languageDistribution: Record<string, number> = {}
    this.symbols.forEach(symbol => {
      languageDistribution[symbol.language] = (languageDistribution[symbol.language] || 0) + 1
    })

    // Detect cross-language patterns
    const crossLanguagePatterns = this.detectCrossLanguagePatterns()

    // Generate recommendations
    const recommendations = this.generateUniversalRecommendations(task, taskRelevantSymbols)

    // Get documentation context if DevDocs is available
    let documentationContext
    if (this.devDocsExtension) {
      const detectedLangs = Array.from(this.detectedLanguages.keys())
      try {
        documentationContext = await this.devDocsExtension.buildDocumentationContext(task, detectedLangs, 5)
      } catch (error) {
        console.warn('Could not fetch documentation context:', error)
      }
    }

    return {
      taskRelevantSymbols,
      languageDistribution,
      crossLanguagePatterns,
      recommendations,
      documentationContext
    }
  }

  // MCP Tool: Language-specific deep dive with documentation
  async languageDeepDive(language: SupportedLanguage): Promise<{
    symbols: UniversalSymbol[]
    fileCount: number
    patterns: string[]
    entryPoints: string[]
    testFiles: string[]
    dependencies: string[]
    recommendations: string[]
    documentation?: {
      available: boolean
      docsCount: number
      lastUpdated: string
      suggestedDownloads: string[]
    }
  }> {
    const config = this.detectedLanguages.get(language)
    if (!config) {
      return {
        symbols: [],
        fileCount: 0,
        patterns: [],
        entryPoints: [],
        testFiles: [],
        dependencies: [],
        recommendations: [`${language} not detected in this project`]
      }
    }

    const symbols = this.symbols.filter(s => s.language === language)
    const files = this.findFilesForLanguage(config)
    const patterns = this.analyzeLanguageSpecificPatterns(language, symbols)
    const entryPoints = this.findEntryPoints(config)
    const testFiles = this.findTestFiles(config)
    const dependencies = await this.extractDependencies(config)
    const recommendations = this.generateLanguageSpecificRecommendations(language, symbols, files)

    // Get documentation information if DevDocs is available
    let documentation
    if (this.devDocsExtension) {
      try {
        const configs = this.devDocsExtension.getConfigurations()
        const langConfig = configs.get(language)
        const availableDocs = await this.devDocsExtension.getAvailableDocs(language)
        
        documentation = {
          available: langConfig?.enabled || false,
          docsCount: langConfig?.docs.length || 0,
          lastUpdated: langConfig?.lastUpdated || 'never',
          suggestedDownloads: availableDocs.slice(0, 5).map(doc => doc.name)
        }
      } catch (error) {
        console.warn('Could not fetch documentation info:', error)
      }
    }

    return {
      symbols,
      fileCount: files.length,
      patterns,
      entryPoints,
      testFiles,
      dependencies,
      recommendations,
      documentation
    }
  }

  // MCP Tool: Project architecture overview
  async getProjectArchitecture(): Promise<{
    languages: Array<{ name: string; fileCount: number; symbolCount: number }>
    entryPoints: Record<string, string[]>
    testCoverage: Record<string, number>
    buildSystems: string[]
    packageManagers: string[]
    overallComplexity: 'simple' | 'moderate' | 'complex' | 'enterprise'
  }> {
    const languages = Array.from(this.detectedLanguages.entries()).map(([name, config]) => ({
      name,
      fileCount: this.findFilesForLanguage(config).length,
      symbolCount: this.symbols.filter(s => s.language === name).length
    }))

    const entryPoints: Record<string, string[]> = {}
    const testCoverage: Record<string, number> = {}
    const buildSystems: string[] = []
    const packageManagers: string[] = []

    for (const [name, config] of this.detectedLanguages) {
      entryPoints[name] = this.findEntryPoints(config)
      const testFiles = this.findTestFiles(config)
      const totalFiles = this.findFilesForLanguage(config).length
      testCoverage[name] = totalFiles > 0 ? testFiles.length / totalFiles : 0
      
      buildSystems.push(...config.buildFiles.filter(f => existsSync(join(this.projectRoot, f))))
      packageManagers.push(...config.packageManagers)
    }

    // Determine complexity
    const overallComplexity = this.calculateProjectComplexity(languages)

    return {
      languages,
      entryPoints,
      testCoverage,
      buildSystems: [...new Set(buildSystems)],
      packageManagers: [...new Set(packageManagers)],
      overallComplexity
    }
  }

  // Private implementation methods
  private async detectAllLanguages(): Promise<void> {
    for (const config of LANGUAGE_CONFIGS) {
      const files = this.findFilesForLanguage(config)
      if (files.length > 0) {
        this.detectedLanguages.set(config.name, config)
        console.log(`   📄 ${config.name}: ${files.length} files`)
      }
    }
  }

  private async indexAllDetectedLanguages(): Promise<void> {
    for (const [language, config] of this.detectedLanguages) {
      try {
        const symbols = await this.parseLanguageFiles(language, config)
        this.symbols.push(...symbols)
        console.log(`   🔍 ${language}: ${symbols.length} symbols`)
      } catch (error) {
        console.warn(`⚠️  Could not index ${language} files:`, error)
      }
    }
  }

  private findFilesForLanguage(config: LanguageConfig): string[] {
    return this.findFiles(this.projectRoot, config.extensions)
  }

  private findFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = []
    
    try {
      const items = readdirSync(dir)
      
      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)
        
        if (stat.isDirectory() && !this.isIgnoredDirectory(item)) {
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

  private isIgnoredDirectory(name: string): boolean {
    const ignoredDirs = [
      '.git', '.svn', '.hg',
      'node_modules', '__pycache__', '.pytest_cache',
      'target', 'build', 'dist', 'out', 'bin', 'obj',
      '.vscode', '.idea', '.vs',
      'coverage', '.coverage', '.nyc_output',
      'logs', 'log', 'tmp', 'temp'
    ]
    return name.startsWith('.') || ignoredDirs.includes(name)
  }

  private async parseLanguageFiles(language: SupportedLanguage, config: LanguageConfig): Promise<UniversalSymbol[]> {
    const files = this.findFilesForLanguage(config)
    const symbols: UniversalSymbol[] = []

    for (const filePath of files) {
      try {
        const fileSymbols = await this.parseFileForLanguage(language, filePath)
        symbols.push(...fileSymbols)
      } catch (error) {
        // Skip unparseable files
      }
    }

    return symbols
  }

  private async parseFileForLanguage(language: SupportedLanguage, filePath: string): Promise<UniversalSymbol[]> {
    const content = readFileSync(filePath, 'utf8')
    const relativePath = filePath.replace(this.projectRoot, '').substring(1)
    
    // Use appropriate parser based on language
    switch (language) {
      case 'python': return this.parsePythonFile(content, relativePath)
      case 'go': return this.parseGenericFile(content, relativePath, language)
      case 'rust': return this.parseRustFile(content, relativePath)
      case 'java': return this.parseJavaFile(content, relativePath)
      case 'csharp': return this.parseCSharpFile(content, relativePath)
      case 'cpp': return this.parseCppFile(content, relativePath)
      case 'javascript': return this.parseJavaScriptFile(content, relativePath)
      case 'typescript': return this.parseTypeScriptFile(content, relativePath)
      case 'php': return this.parsePhpFile(content, relativePath)
      case 'ruby': return this.parseRubyFile(content, relativePath)
      case 'swift': return this.parseSwiftFile(content, relativePath)
      case 'kotlin': return this.parseKotlinFile(content, relativePath)
      case 'gdscript': return this.parseGDScriptFile(content, relativePath)
      // Add more parsers as needed
      default: return this.parseGenericFile(content, relativePath, language)
    }
  }

  // Language-specific parsers (basic implementations)
  private parsePythonFile(content: string, filePath: string): UniversalSymbol[] {
    const symbols: UniversalSymbol[] = []
    const lines = content.split('\\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNumber = i + 1

      // Class definitions
      const classMatch = line.match(/^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          language: 'python',
          location: { file: filePath, line: lineNumber },
          signature: line,
          extends: classMatch[2]
        })
        continue
      }

      // Function definitions
      const funcMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/)
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          language: 'python',
          location: { file: filePath, line: lineNumber },
          signature: line,
          returns: funcMatch[3]
        })
      }
    }

    return symbols
  }

  private parseJavaFile(content: string, filePath: string): UniversalSymbol[] {
    const symbols: UniversalSymbol[] = []
    const lines = content.split('\\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNumber = i + 1

      // Class definitions
      const classMatch = line.match(/^(?:(public|private|protected)\s+)?(?:(static|final|abstract)\s+)*class\s+(\w+)/)
      if (classMatch) {
        symbols.push({
          name: classMatch[3],
          type: 'class',
          language: 'java',
          location: { file: filePath, line: lineNumber },
          signature: line,
          visibility: classMatch[1] as any || 'package',
          modifiers: classMatch[2] ? [classMatch[2]] : []
        })
      }

      // Method definitions
      const methodMatch = line.match(/^(?:(public|private|protected)\s+)?(?:(static|final)\s+)*(\w+)\s+(\w+)\s*\(/)
      if (methodMatch) {
        symbols.push({
          name: methodMatch[4],
          type: 'method',
          language: 'java',
          location: { file: filePath, line: lineNumber },
          signature: line,
          visibility: methodMatch[1] as any || 'package',
          returns: methodMatch[3]
        })
      }
    }

    return symbols
  }

  // Add parsers for other languages...
  private parseGenericFile(content: string, filePath: string, language: SupportedLanguage): UniversalSymbol[] {
    // Generic parser for languages without specific implementations
    const symbols: UniversalSymbol[] = []
    const lines = content.split('\\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineNumber = i + 1

      // Look for common patterns (functions, classes, etc.)
      const functionMatch = line.match(/(?:function|func|def|fn)\s+(\w+)/)
      if (functionMatch) {
        symbols.push({
          name: functionMatch[1],
          type: 'function',
          language,
          location: { file: filePath, line: lineNumber },
          signature: line
        })
      }

      const classMatch = line.match(/(?:class|struct|type)\s+(\w+)/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          language,
          location: { file: filePath, line: lineNumber },
          signature: line
        })
      }
    }

    return symbols
  }

  // Helper methods
  private calculateUniversalRelevanceScore(symbol: UniversalSymbol, query: string): number {
    let score = 0
    
    if (symbol.name.toLowerCase() === query) score += 10
    if (symbol.name.toLowerCase().includes(query)) score += 5
    if (symbol.signature?.toLowerCase().includes(query)) score += 3
    if (symbol.docstring?.toLowerCase().includes(query)) score += 2
    
    // Boost important symbol types
    const typeBonus: Record<string, number> = {
      'class': 3, 'interface': 3, 'struct': 3,
      'function': 2, 'method': 2,
      'const': 1, 'variable': 1
    }
    score += typeBonus[symbol.type] || 0
    
    return score
  }

  private detectCrossLanguagePatterns(): string[] {
    const patterns: string[] = []
    const languages = Array.from(this.detectedLanguages.keys())
    
    if (languages.length > 1) {
      patterns.push(`Multi-language project: ${languages.join(', ')}`)
    }
    
    // Detect common architectural patterns
    if (languages.includes('javascript') && languages.includes('typescript')) {
      patterns.push('JavaScript/TypeScript hybrid project')
    }
    
    if (languages.includes('python') && languages.includes('javascript')) {
      patterns.push('Full-stack Python/JavaScript project')
    }
    
    if (languages.includes('java') && languages.includes('kotlin')) {
      patterns.push('JVM multi-language project')
    }
    
    return patterns
  }

  private generateUniversalRecommendations(task: string, symbols: UniversalSymbol[]): string[] {
    const recommendations: string[] = []
    
    if (symbols.length === 0) {
      recommendations.push('No symbols found matching the task - consider refining search terms')
      return recommendations
    }
    
    const languageCount = new Set(symbols.map(s => s.language)).size
    if (languageCount > 1) {
      recommendations.push(`Task spans ${languageCount} languages - consider cross-language integration patterns`)
    }
    
    const classCount = symbols.filter(s => s.type === 'class').length
    const functionCount = symbols.filter(s => s.type === 'function').length
    
    if (functionCount > classCount * 3) {
      recommendations.push('Function-heavy codebase - consider organizing into classes/modules')
    }
    
    return recommendations
  }

  private findEntryPoints(config: LanguageConfig): string[] {
    return config.entryPointFiles
      .map(file => join(this.projectRoot, file))
      .filter(existsSync)
      .map(file => file.replace(this.projectRoot, '').substring(1))
  }

  private findTestFiles(config: LanguageConfig): string[] {
    const testFiles: string[] = []
    
    for (const pattern of config.testPatterns) {
      if (pattern.includes('/')) {
        // Directory pattern
        const testDir = join(this.projectRoot, pattern)
        if (existsSync(testDir)) {
          testFiles.push(...this.findFiles(testDir, config.extensions))
        }
      } else {
        // File pattern - simplified matching
        const allFiles = this.findFilesForLanguage(config)
        testFiles.push(...allFiles.filter(file => {
          const fileName = basename(file)
          return pattern.replace('*', '').split('').every(char => fileName.includes(char))
        }))
      }
    }
    
    return testFiles
  }

  private async extractDependencies(config: LanguageConfig): Promise<string[]> {
    const dependencies: string[] = []
    
    for (const depFile of config.dependencyFiles) {
      const fullPath = join(this.projectRoot, depFile)
      if (existsSync(fullPath)) {
        try {
          const deps = await this.parseDependencyFile(fullPath, config.name)
          dependencies.push(...deps)
        } catch (error) {
          // Skip unparseable dependency files
        }
      }
    }
    
    return [...new Set(dependencies)]
  }

  private async parseDependencyFile(filePath: string, language: SupportedLanguage): Promise<string[]> {
    const content = readFileSync(filePath, 'utf8')
    const fileName = basename(filePath)
    
    switch (fileName) {
      case 'package.json':
        const pkg = JSON.parse(content)
        return [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {})
        ]
      case 'requirements.txt':
        return content.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
          .map(line => line.split('==')[0].split('>=')[0])
      case 'Cargo.toml':
        // Basic TOML parsing for Rust dependencies
        const deps = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/)?.[1] || ''
        return deps.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
          .map(line => line.split('=')[0].trim())
          .filter(dep => dep)
      default:
        return []
    }
  }

  private calculateProjectComplexity(languages: Array<{ name: string; fileCount: number; symbolCount: number }>): 'simple' | 'moderate' | 'complex' | 'enterprise' {
    const totalFiles = languages.reduce((sum, lang) => sum + lang.fileCount, 0)
    const totalSymbols = languages.reduce((sum, lang) => sum + lang.symbolCount, 0)
    const languageCount = languages.length
    
    if (totalFiles < 10 && languageCount === 1) return 'simple'
    if (totalFiles < 50 && languageCount <= 2) return 'moderate'
    if (totalFiles < 200 && languageCount <= 4) return 'complex'
    return 'enterprise'
  }

  private analyzeLanguageSpecificPatterns(language: SupportedLanguage, symbols: UniversalSymbol[]): string[] {
    const patterns: string[] = []
    
    const classes = symbols.filter(s => s.type === 'class' || s.type === 'struct')
    const functions = symbols.filter(s => s.type === 'function')
    const methods = symbols.filter(s => s.type === 'method')
    
    patterns.push(`${classes.length} classes, ${functions.length} functions, ${methods.length} methods`)
    
    // Language-specific analysis
    switch (language) {
      case 'python':
        const asyncFunctions = symbols.filter(s => s.signature?.includes('async'))
        if (asyncFunctions.length > 0) {
          patterns.push(`${asyncFunctions.length} async functions`)
        }
        break
      case 'java':
        const publicMethods = symbols.filter(s => s.visibility === 'public')
        patterns.push(`${publicMethods.length} public methods`)
        break
      case 'go':
        const exportedSymbols = symbols.filter(s => s.name[0] === s.name[0].toUpperCase())
        patterns.push(`${exportedSymbols.length} exported symbols`)
        break
    }
    
    return patterns
  }

  private generateLanguageSpecificRecommendations(language: SupportedLanguage, symbols: UniversalSymbol[], files: string[]): string[] {
    const recommendations: string[] = []
    
    if (symbols.length === 0) {
      recommendations.push(`No ${language} symbols found - check parsing`)
      return recommendations
    }
    
    // Common recommendations based on patterns
    const testFiles = files.filter(f => f.includes('test'))
    const testRatio = testFiles.length / files.length
    
    if (testRatio < 0.1) {
      recommendations.push(`Low test coverage detected - consider adding more tests`)
    }
    
    // Language-specific recommendations
    switch (language) {
      case 'python':
        const pythonClasses = symbols.filter(s => s.type === 'class')
        const pythonFunctions = symbols.filter(s => s.type === 'function')
        if (pythonFunctions.length > pythonClasses.length * 10) {
          recommendations.push('Consider organizing functions into classes')
        }
        break
      case 'javascript':
        if (files.some(f => f.endsWith('.js')) && files.some(f => f.endsWith('.ts'))) {
          recommendations.push('Mixed JS/TS project - consider migrating to full TypeScript')
        }
        break
    }
    
    return recommendations
  }

  // Additional language parsers (implement as needed)
  private parseRustFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseCSharpFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseCppFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseJavaScriptFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseTypeScriptFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parsePhpFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseRubyFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseSwiftFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseKotlinFile(content: string, filePath: string): UniversalSymbol[] { return [] }
  private parseGDScriptFile(content: string, filePath: string): UniversalSymbol[] { return [] }

  // Public API
  getSymbols(): UniversalSymbol[] {
    return this.symbols
  }

  getDetectedLanguages(): SupportedLanguage[] {
    return Array.from(this.detectedLanguages.keys())
  }

  getLanguageConfig(language: SupportedLanguage): LanguageConfig | undefined {
    return this.detectedLanguages.get(language)
  }
}