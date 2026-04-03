// Universal Language Analysis Skill
// Comprehensive multi-language code analysis and architecture insights

import { UniversalLanguageMCPExtension, SupportedLanguage } from '../setup/universal-language-mcp-extension.js'

export interface UniversalLanguageSkillConfig {
  projectRoot: string
  analysisDepth: 'basic' | 'detailed' | 'comprehensive'
  includeRecommendations: boolean
  maxSymbolsPerLanguage: number
}

export class UniversalLanguageAnalysisSkill {
  private universalLang: UniversalLanguageMCPExtension
  private config: UniversalLanguageSkillConfig

  constructor(config: UniversalLanguageSkillConfig) {
    this.config = config
    this.universalLang = new UniversalLanguageMCPExtension(config.projectRoot)
  }

  async initialize(): Promise<boolean> {
    console.log('🔧 Initializing Universal Language Analysis Skill...')
    
    try {
      const ready = await this.universalLang.initialize()
      console.log('✅ Universal Language Analysis Skill ready')
      return ready
    } catch (error) {
      console.error('❌ Universal Language Analysis Skill initialization failed:', error)
      return false
    }
  }

  // Skill: Comprehensive Project Analysis
  async analyzeProjectArchitecture(): Promise<{
    overview: {
      languages: Array<{ name: string; fileCount: number; symbolCount: number; dominance: number }>
      complexity: 'simple' | 'moderate' | 'complex' | 'enterprise'
      maturity: 'prototype' | 'development' | 'production' | 'enterprise'
      patterns: string[]
    }
    recommendations: string[]
    migration: {
      opportunities: string[]
      risks: string[]
      priorities: string[]
    }
    documentation: {
      needed: string[]
      existing: string[]
      gaps: string[]
    }
  }> {
    const architecture = await this.universalLang.getProjectArchitecture()
    
    // Calculate language dominance
    const totalSymbols = architecture.languages.reduce((sum, lang) => sum + lang.symbolCount, 0)
    const languagesWithDominance = architecture.languages.map(lang => ({
      ...lang,
      dominance: totalSymbols > 0 ? lang.symbolCount / totalSymbols : 0
    }))
    
    // Determine project maturity
    const maturity = this.assessProjectMaturity(architecture)
    
    // Detect architectural patterns
    const patterns = this.detectArchitecturalPatterns(architecture)
    
    // Generate recommendations
    const recommendations = this.generateArchitecturalRecommendations(architecture, patterns)
    
    // Analyze migration opportunities
    const migration = await this.analyzeMigrationOpportunities(architecture)
    
    // Assess documentation needs
    const documentation = await this.assessDocumentationNeeds(architecture)
    
    return {
      overview: {
        languages: languagesWithDominance,
        complexity: architecture.overallComplexity,
        maturity,
        patterns
      },
      recommendations,
      migration,
      documentation
    }
  }

  // Skill: Smart Code Migration Planning
  async planCodeMigration(fromLanguage: SupportedLanguage, toLanguage: SupportedLanguage): Promise<{
    feasibility: 'easy' | 'moderate' | 'difficult' | 'not-recommended'
    effort: 'low' | 'medium' | 'high' | 'very-high'
    strategy: string[]
    phases: Array<{
      name: string
      description: string
      effort: string
      risks: string[]
    }>
    challenges: string[]
    benefits: string[]
    timeline: string
  }> {
    const fromAnalysis = await this.universalLang.languageDeepDive(fromLanguage)
    const toAnalysis = await this.universalLang.languageDeepDive(toLanguage)
    
    // Assess feasibility based on language characteristics
    const feasibility = this.assessMigrationFeasibility(fromLanguage, toLanguage, fromAnalysis)
    const effort = this.estimateMigrationEffort(fromAnalysis, toAnalysis)
    
    // Generate migration strategy
    const strategy = this.generateMigrationStrategy(fromLanguage, toLanguage, fromAnalysis)
    
    // Plan migration phases
    const phases = this.planMigrationPhases(fromLanguage, toLanguage, fromAnalysis)
    
    // Identify challenges and benefits
    const challenges = this.identifyMigrationChallenges(fromLanguage, toLanguage, fromAnalysis)
    const benefits = this.identifyMigrationBenefits(fromLanguage, toLanguage)
    
    // Estimate timeline
    const timeline = this.estimateMigrationTimeline(effort, fromAnalysis.symbols.length)
    
    return {
      feasibility,
      effort,
      strategy,
      phases,
      challenges,
      benefits,
      timeline
    }
  }

  // Skill: Code Quality Assessment
  async assessCodeQuality(language?: SupportedLanguage): Promise<{
    overall: {
      score: number
      grade: 'A' | 'B' | 'C' | 'D' | 'F'
      summary: string
    }
    metrics: {
      testCoverage: number
      complexity: number
      maintainability: number
      documentation: number
    }
    languageScores: Array<{
      language: string
      score: number
      strengths: string[]
      weaknesses: string[]
      recommendations: string[]
    }>
    actionItems: Array<{
      priority: 'high' | 'medium' | 'low'
      description: string
      effort: 'small' | 'medium' | 'large'
      impact: 'low' | 'medium' | 'high'
    }>
  }> {
    const detectedLanguages = this.universalLang.getDetectedLanguages()
    const languagesToAssess = language ? [language] : detectedLanguages
    
    const languageScores: Array<{
      language: string
      score: number
      strengths: string[]
      weaknesses: string[]
      recommendations: string[]
    }> = []
    
    let totalScore = 0
    let totalTestCoverage = 0
    let totalComplexity = 0
    let totalMaintainability = 0
    let totalDocumentation = 0
    
    for (const lang of languagesToAssess) {
      const analysis = await this.universalLang.languageDeepDive(lang)
      const quality = await this.assessLanguageQuality(lang, analysis)
      
      languageScores.push(quality)
      totalScore += quality.score
      
      // Aggregate metrics (simplified)
      totalTestCoverage += analysis.testFiles.length / Math.max(analysis.fileCount, 1)
      totalComplexity += this.calculateComplexityScore(analysis)
      totalMaintainability += this.calculateMaintainabilityScore(analysis)
      totalDocumentation += this.calculateDocumentationScore(analysis)
    }
    
    // Calculate overall metrics
    const count = languagesToAssess.length
    const overallScore = count > 0 ? totalScore / count : 0
    const metrics = {
      testCoverage: count > 0 ? totalTestCoverage / count : 0,
      complexity: count > 0 ? totalComplexity / count : 0,
      maintainability: count > 0 ? totalMaintainability / count : 0,
      documentation: count > 0 ? totalDocumentation / count : 0
    }
    
    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (overallScore >= 90) grade = 'A'
    else if (overallScore >= 80) grade = 'B'
    else if (overallScore >= 70) grade = 'C'
    else if (overallScore >= 60) grade = 'D'
    else grade = 'F'
    
    const summary = this.generateQualitySummary(grade, overallScore, metrics)
    const actionItems = this.generateQualityActionItems(languageScores, metrics)
    
    return {
      overall: { score: overallScore, grade, summary },
      metrics,
      languageScores,
      actionItems
    }
  }

  // Skill: Technology Stack Recommendations
  async recommendTechnologyStack(requirements: {
    projectType: 'web' | 'mobile' | 'desktop' | 'api' | 'data-science' | 'ml' | 'game'
    teamSize: 'solo' | 'small' | 'medium' | 'large'
    timeline: 'rapid' | 'normal' | 'extended'
    performanceNeeds: 'low' | 'medium' | 'high' | 'critical'
    scalabilityNeeds: 'low' | 'medium' | 'high' | 'massive'
    existingLanguages?: SupportedLanguage[]
  }): Promise<{
    primary: {
      language: SupportedLanguage
      framework: string
      reasoning: string[]
      pros: string[]
      cons: string[]
    }
    alternatives: Array<{
      language: SupportedLanguage
      framework: string
      useCase: string
      reasoning: string
    }>
    architecture: {
      pattern: string
      components: string[]
      dataLayer: string
      deployment: string
    }
    migration: {
      fromExisting: string[]
      complexity: 'low' | 'medium' | 'high'
      timeline: string
    }
  }> {
    // Analyze current project if languages exist
    let currentAnalysis = null
    if (requirements.existingLanguages && requirements.existingLanguages.length > 0) {
      currentAnalysis = await this.universalLang.getProjectArchitecture()
    }
    
    // Generate recommendations based on requirements
    const primary = this.selectPrimaryTechnology(requirements)
    const alternatives = this.selectAlternativeTechnologies(requirements, primary.language)
    const architecture = this.recommendArchitecture(requirements, primary)
    const migration = this.assessMigrationFromCurrent(requirements, currentAnalysis, primary)
    
    return {
      primary,
      alternatives,
      architecture,
      migration
    }
  }

  // Private helper methods
  private assessProjectMaturity(architecture: any): 'prototype' | 'development' | 'production' | 'enterprise' {
    const totalFiles = architecture.languages.reduce((sum: number, lang: any) => sum + lang.fileCount, 0)
    const hasTests = Object.values(architecture.testCoverage).some((coverage: any) => coverage > 0)
    const hasBuild = architecture.buildSystems.length > 0
    const hasMultipleLanguages = architecture.languages.length > 2
    
    if (totalFiles < 10) return 'prototype'
    if (!hasTests || !hasBuild) return 'development'
    if (hasMultipleLanguages && totalFiles > 100) return 'enterprise'
    return 'production'
  }

  private detectArchitecturalPatterns(architecture: any): string[] {
    const patterns: string[] = []
    
    const languageNames = architecture.languages.map((l: any) => l.name)
    
    // Detect common patterns
    if (languageNames.includes('javascript') && languageNames.includes('html')) {
      patterns.push('Frontend Web Application')
    }
    
    if (languageNames.includes('javascript') && languageNames.includes('typescript')) {
      patterns.push('Progressive TypeScript Migration')
    }
    
    if (languageNames.includes('python') && languageNames.includes('sql')) {
      patterns.push('Data Processing Pipeline')
    }
    
    if (languageNames.includes('java') && languageNames.includes('kotlin')) {
      patterns.push('JVM Polyglot Architecture')
    }
    
    if (architecture.buildSystems.includes('docker-compose.yml')) {
      patterns.push('Containerized Microservices')
    }
    
    if (architecture.languages.length > 5) {
      patterns.push('Polyglot Architecture')
    }
    
    return patterns
  }

  private generateArchitecturalRecommendations(architecture: any, patterns: string[]): string[] {
    const recommendations: string[] = []
    
    // Test coverage recommendations
    const avgTestCoverage = Object.values(architecture.testCoverage).reduce((sum: number, cov: any) => sum + cov, 0) / Object.keys(architecture.testCoverage).length
    if (avgTestCoverage < 0.3) {
      recommendations.push('Increase test coverage - currently below 30%')
    }
    
    // Language consolidation
    if (architecture.languages.length > 6) {
      recommendations.push('Consider consolidating languages to reduce maintenance overhead')
    }
    
    // Build system standardization
    if (architecture.buildSystems.length > 3) {
      recommendations.push('Standardize build systems - multiple systems increase complexity')
    }
    
    // Pattern-specific recommendations
    if (patterns.includes('Progressive TypeScript Migration')) {
      recommendations.push('Complete TypeScript migration to improve type safety')
    }
    
    if (patterns.includes('Polyglot Architecture')) {
      recommendations.push('Ensure clear service boundaries and well-defined interfaces')
    }
    
    return recommendations
  }

  private async analyzeMigrationOpportunities(architecture: any): Promise<{
    opportunities: string[]
    risks: string[]
    priorities: string[]
  }> {
    const opportunities: string[] = []
    const risks: string[] = []
    const priorities: string[] = []
    
    const languageNames = architecture.languages.map((l: any) => l.name)
    
    // JavaScript to TypeScript migration
    if (languageNames.includes('javascript') && !languageNames.includes('typescript')) {
      opportunities.push('Migrate JavaScript to TypeScript for better type safety')
      priorities.push('JavaScript → TypeScript migration (High Priority)')
    }
    
    // Legacy language modernization
    const legacyLanguages = languageNames.filter((lang: string) => 
      ['php', 'perl', 'ruby'].includes(lang)
    )
    if (legacyLanguages.length > 0) {
      opportunities.push(`Modernize legacy languages: ${legacyLanguages.join(', ')}`)
      risks.push('Legacy language migration may require significant refactoring')
    }
    
    // Consolidation opportunities
    if (languageNames.includes('java') && languageNames.includes('kotlin')) {
      opportunities.push('Consolidate JVM languages - migrate Java to Kotlin')
    }
    
    return { opportunities, risks, priorities }
  }

  private async assessDocumentationNeeds(architecture: any): Promise<{
    needed: string[]
    existing: string[]
    gaps: string[]
  }> {
    const needed: string[] = []
    const existing: string[] = []
    const gaps: string[] = []
    
    // Check for common documentation files
    const entryPoints = Object.values(architecture.entryPoints).flat() as string[]
    
    if (entryPoints.length > 0) {
      existing.push('Entry points documented')
    } else {
      needed.push('Document main entry points and usage')
      gaps.push('No clear entry points identified')
    }
    
    // API documentation
    if (architecture.buildSystems.some((build: string) => build.includes('api') || build.includes('server'))) {
      needed.push('API documentation and endpoint specifications')
    }
    
    // Architecture documentation
    if (architecture.overallComplexity === 'complex' || architecture.overallComplexity === 'enterprise') {
      needed.push('Architecture overview and system design documentation')
      gaps.push('Complex system lacks comprehensive documentation')
    }
    
    return { needed, existing, gaps }
  }

  // Additional helper methods for migration planning, quality assessment, etc.
  private assessMigrationFeasibility(from: SupportedLanguage, to: SupportedLanguage, analysis: any): 'easy' | 'moderate' | 'difficult' | 'not-recommended' {
    const migrationMatrix: Record<string, Record<string, 'easy' | 'moderate' | 'difficult' | 'not-recommended'>> = {
      javascript: { typescript: 'easy', python: 'moderate', java: 'difficult' },
      typescript: { javascript: 'moderate', python: 'moderate', java: 'difficult' },
      python: { javascript: 'moderate', typescript: 'moderate', java: 'difficult' },
      java: { kotlin: 'easy', scala: 'moderate', python: 'difficult' },
      kotlin: { java: 'moderate', scala: 'moderate' },
      go: { rust: 'difficult', java: 'difficult' },
      rust: { go: 'difficult', cpp: 'moderate' },
      cpp: { rust: 'moderate', go: 'difficult' }
    }
    
    return migrationMatrix[from]?.[to] || 'not-recommended'
  }

  private estimateMigrationEffort(fromAnalysis: any, toAnalysis: any): 'low' | 'medium' | 'high' | 'very-high' {
    const symbolCount = fromAnalysis.symbols.length
    
    if (symbolCount < 100) return 'low'
    if (symbolCount < 500) return 'medium'
    if (symbolCount < 2000) return 'high'
    return 'very-high'
  }

  private generateMigrationStrategy(from: SupportedLanguage, to: SupportedLanguage, analysis: any): string[] {
    const strategy: string[] = []
    
    strategy.push(`1. Set up ${to} development environment and tooling`)
    strategy.push(`2. Create parallel ${to} modules for new features`)
    strategy.push(`3. Migrate utility functions and common libraries first`)
    strategy.push(`4. Convert core business logic modules`)
    strategy.push(`5. Update tests and documentation`)
    strategy.push(`6. Phase out ${from} modules gradually`)
    
    return strategy
  }

  private planMigrationPhases(from: SupportedLanguage, to: SupportedLanguage, analysis: any): Array<{
    name: string
    description: string
    effort: string
    risks: string[]
  }> {
    return [
      {
        name: 'Foundation',
        description: `Set up ${to} environment and convert core utilities`,
        effort: 'Medium',
        risks: ['Tooling compatibility issues', 'Team learning curve']
      },
      {
        name: 'Core Migration',
        description: `Convert main business logic from ${from} to ${to}`,
        effort: 'High',
        risks: ['Logic translation errors', 'Performance differences']
      },
      {
        name: 'Integration',
        description: 'Integrate migrated components and update interfaces',
        effort: 'Medium',
        risks: ['Interface compatibility', 'Integration bugs']
      },
      {
        name: 'Optimization',
        description: `Optimize ${to} code and remove ${from} dependencies`,
        effort: 'Low',
        risks: ['Performance regressions', 'Missing edge cases']
      }
    ]
  }

  private identifyMigrationChallenges(from: SupportedLanguage, to: SupportedLanguage, analysis: any): string[] {
    const challenges: string[] = []
    
    challenges.push(`Learning curve for ${to} language and ecosystem`)
    challenges.push(`Translating ${from}-specific idioms and patterns`)
    challenges.push('Maintaining feature parity during migration')
    challenges.push('Testing and validation of migrated code')
    
    if (analysis.dependencies.length > 10) {
      challenges.push('Managing dependencies and library replacements')
    }
    
    return challenges
  }

  private identifyMigrationBenefits(from: SupportedLanguage, to: SupportedLanguage): string[] {
    const benefitsMatrix: Record<string, Record<string, string[]>> = {
      javascript: {
        typescript: ['Type safety', 'Better IDE support', 'Easier refactoring', 'Compile-time error detection']
      },
      java: {
        kotlin: ['Concise syntax', 'Null safety', 'Functional programming features', '100% Java interoperability']
      },
      python: {
        go: ['Better performance', 'Static typing', 'Better concurrency', 'Smaller deployment size']
      }
    }
    
    return benefitsMatrix[from]?.[to] || ['Potential performance improvements', 'Access to modern language features']
  }

  private estimateMigrationTimeline(effort: string, symbolCount: number): string {
    const baseWeeks = {
      'low': 2,
      'medium': 6,
      'high': 16,
      'very-high': 32
    }
    
    const weeks = baseWeeks[effort as keyof typeof baseWeeks] || 8
    const adjustedWeeks = Math.max(weeks, Math.ceil(symbolCount / 100)) // 1 week per 100 symbols minimum
    
    if (adjustedWeeks < 4) return `${adjustedWeeks} weeks`
    if (adjustedWeeks < 24) return `${Math.ceil(adjustedWeeks / 4)} months`
    return `${Math.ceil(adjustedWeeks / 12)} quarters`
  }

  private async assessLanguageQuality(language: string, analysis: any): Promise<{
    language: string
    score: number
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }> {
    const strengths: string[] = []
    const weaknesses: string[] = []
    const recommendations: string[] = []
    
    let score = 50 // Base score
    
    // Test coverage assessment
    const testRatio = analysis.testFiles.length / Math.max(analysis.fileCount, 1)
    if (testRatio > 0.3) {
      strengths.push('Good test coverage')
      score += 15
    } else {
      weaknesses.push('Low test coverage')
      recommendations.push('Increase test coverage')
      score -= 10
    }
    
    // Code organization
    if (analysis.entryPoints.length > 0) {
      strengths.push('Clear entry points')
      score += 10
    } else {
      weaknesses.push('Unclear project structure')
      recommendations.push('Define clear entry points')
    }
    
    // Dependency management
    if (analysis.dependencies.length > 0) {
      strengths.push('Uses external libraries appropriately')
      score += 5
    }
    
    // Symbol density (complexity indicator)
    const symbolDensity = analysis.symbols.length / Math.max(analysis.fileCount, 1)
    if (symbolDensity > 10) {
      strengths.push('Rich functionality')
      score += 10
    } else if (symbolDensity < 2) {
      weaknesses.push('Low code density - may indicate incomplete implementation')
      score -= 5
    }
    
    return { language, score: Math.max(0, Math.min(100, score)), strengths, weaknesses, recommendations }
  }

  private calculateComplexityScore(analysis: any): number {
    // Simplified complexity calculation
    const symbolDensity = analysis.symbols.length / Math.max(analysis.fileCount, 1)
    return Math.min(1, symbolDensity / 10) // Normalize to 0-1
  }

  private calculateMaintainabilityScore(analysis: any): number {
    // Simplified maintainability calculation based on structure
    const hasTests = analysis.testFiles.length > 0
    const hasDocumentation = analysis.entryPoints.length > 0
    const reasonableSize = analysis.fileCount < 1000
    
    let score = 0
    if (hasTests) score += 0.4
    if (hasDocumentation) score += 0.3
    if (reasonableSize) score += 0.3
    
    return score
  }

  private calculateDocumentationScore(analysis: any): number {
    // Simplified documentation score
    const hasEntryPoints = analysis.entryPoints.length > 0
    const hasReadme = analysis.dependencies.length > 0 // Proxy for having package files
    
    let score = 0
    if (hasEntryPoints) score += 0.5
    if (hasReadme) score += 0.5
    
    return score
  }

  private generateQualitySummary(grade: string, score: number, metrics: any): string {
    const summaries = {
      'A': `Excellent code quality (${score.toFixed(1)}%). Well-tested, maintainable codebase.`,
      'B': `Good code quality (${score.toFixed(1)}%). Solid foundation with room for improvement.`,
      'C': `Fair code quality (${score.toFixed(1)}%). Adequate but needs attention in key areas.`,
      'D': `Poor code quality (${score.toFixed(1)}%). Significant improvements needed.`,
      'F': `Critical code quality issues (${score.toFixed(1)}%). Major refactoring required.`
    }
    
    return summaries[grade as keyof typeof summaries] || 'Unknown quality assessment'
  }

  private generateQualityActionItems(languageScores: any[], metrics: any): Array<{
    priority: 'high' | 'medium' | 'low'
    description: string
    effort: 'small' | 'medium' | 'large'
    impact: 'low' | 'medium' | 'high'
  }> {
    const actionItems: Array<{
      priority: 'high' | 'medium' | 'low'
      description: string
      effort: 'small' | 'medium' | 'large'
      impact: 'low' | 'medium' | 'high'
    }> = []
    
    // Test coverage action items
    if (metrics.testCoverage < 0.3) {
      actionItems.push({
        priority: 'high',
        description: 'Increase test coverage to at least 30%',
        effort: 'medium',
        impact: 'high'
      })
    }
    
    // Documentation improvements
    if (metrics.documentation < 0.5) {
      actionItems.push({
        priority: 'medium',
        description: 'Improve code documentation and README files',
        effort: 'small',
        impact: 'medium'
      })
    }
    
    // Complexity reduction
    if (metrics.complexity > 0.8) {
      actionItems.push({
        priority: 'medium',
        description: 'Refactor complex modules to reduce complexity',
        effort: 'large',
        impact: 'high'
      })
    }
    
    return actionItems
  }

  private selectPrimaryTechnology(requirements: any): {
    language: SupportedLanguage
    framework: string
    reasoning: string[]
    pros: string[]
    cons: string[]
  } {
    // Simplified technology selection logic
    const techMap: Record<string, any> = {
      'web': {
        language: 'typescript' as SupportedLanguage,
        framework: 'React/Next.js',
        reasoning: ['Strong typing', 'Large ecosystem', 'Modern development experience'],
        pros: ['Type safety', 'Excellent tooling', 'Large community'],
        cons: ['Build complexity', 'Learning curve for TypeScript']
      },
      'api': {
        language: 'go' as SupportedLanguage,
        framework: 'Gin/Echo',
        reasoning: ['High performance', 'Great concurrency', 'Simple deployment'],
        pros: ['Fast execution', 'Low memory usage', 'Built-in concurrency'],
        cons: ['Verbose error handling', 'Limited generics support']
      },
      'data-science': {
        language: 'python' as SupportedLanguage,
        framework: 'FastAPI/Pandas',
        reasoning: ['Rich data science ecosystem', 'Easy to prototype', 'Great libraries'],
        pros: ['Extensive libraries', 'Readable syntax', 'Strong community'],
        cons: ['Performance limitations', 'GIL restrictions']
      }
    }
    
    return techMap[requirements.projectType] || techMap['web']
  }

  private selectAlternativeTechnologies(requirements: any, primaryLanguage: SupportedLanguage): Array<{
    language: SupportedLanguage
    framework: string
    useCase: string
    reasoning: string
  }> {
    // Simplified alternatives
    return [
      {
        language: 'rust' as SupportedLanguage,
        framework: 'Actix/Warp',
        useCase: 'High-performance backend services',
        reasoning: 'Memory safety with zero-cost abstractions'
      },
      {
        language: 'python' as SupportedLanguage,
        framework: 'Django/FastAPI',
        useCase: 'Rapid prototyping and data processing',
        reasoning: 'Quick development and extensive libraries'
      }
    ]
  }

  private recommendArchitecture(requirements: any, primary: any): {
    pattern: string
    components: string[]
    dataLayer: string
    deployment: string
  } {
    // Simplified architecture recommendations
    return {
      pattern: requirements.scalabilityNeeds === 'massive' ? 'Microservices' : 'Modular Monolith',
      components: ['API Gateway', 'Business Logic', 'Data Access Layer', 'Authentication'],
      dataLayer: requirements.projectType === 'data-science' ? 'Data Lake + Analytics DB' : 'Relational Database',
      deployment: requirements.scalabilityNeeds === 'high' ? 'Container Orchestration (K8s)' : 'Container Platform (Docker)'
    }
  }

  private assessMigrationFromCurrent(requirements: any, currentAnalysis: any, primary: any): {
    fromExisting: string[]
    complexity: 'low' | 'medium' | 'high'
    timeline: string
  } {
    if (!currentAnalysis) {
      return {
        fromExisting: [],
        complexity: 'low',
        timeline: 'New project - no migration needed'
      }
    }
    
    const existingLanguages = currentAnalysis.languages.map((l: any) => l.name)
    const complexity = existingLanguages.length > 3 ? 'high' : existingLanguages.length > 1 ? 'medium' : 'low'
    
    return {
      fromExisting: existingLanguages,
      complexity,
      timeline: complexity === 'high' ? '6-12 months' : complexity === 'medium' ? '2-4 months' : '2-6 weeks'
    }
  }

  // Public API
  getExtension(): UniversalLanguageMCPExtension {
    return this.universalLang
  }
}

export default UniversalLanguageAnalysisSkill