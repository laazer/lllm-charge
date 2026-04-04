// React Development Tools Integration
// FEATURE: Complete React development toolkit for component scaffolding and analysis

export { ReactComponentScaffolder, type ReactComponentOptions, type ReactComponentScaffoldResult } from './react-scaffolding'
export { ReactStateAnalyzer, type ReactStateAnalysis } from './react-state-analyzer'

import { ReactComponentScaffolder } from './react-scaffolding'
import { ReactStateAnalyzer } from './react-state-analyzer'

export interface ReactToolsConfig {
  projectPath: string
  defaultComponentPath?: string
  includeTestsByDefault?: boolean
  includeStorybookByDefault?: boolean
}

export class ReactDevTools {
  private scaffolder: ReactComponentScaffolder
  private analyzer: ReactStateAnalyzer
  private config: ReactToolsConfig

  constructor(config: ReactToolsConfig) {
    this.config = config
    this.scaffolder = new ReactComponentScaffolder(config.projectPath)
    this.analyzer = new ReactStateAnalyzer(config.projectPath)
  }

  // Component scaffolding
  async createComponent(options: any) {
    const fullOptions = {
      includeTests: this.config.includeTestsByDefault ?? true,
      includeStorybook: this.config.includeStorybookByDefault ?? false,
      outputPath: this.config.defaultComponentPath,
      ...options
    }

    return await this.scaffolder.scaffoldComponent(fullOptions)
  }

  // State analysis
  async analyzeComponent(componentPath: string) {
    return await this.analyzer.analyzeComponent(componentPath)
  }

  async analyzeProject() {
    return await this.analyzer.analyzeProject()
  }

  // Quick component templates
  async createUIComponent(name: string, includeStorybook = true) {
    return this.createComponent({
      componentName: name,
      componentType: 'ui',
      includeStorybook,
      includeTests: true
    })
  }

  async createPageComponent(name: string) {
    return this.createComponent({
      componentName: name,
      componentType: 'page',
      includeTests: true,
      includeStorybook: false
    })
  }

  async createLayoutComponent(name: string) {
    return this.createComponent({
      componentName: name,
      componentType: 'layout', 
      includeTests: true,
      includeStorybook: false
    })
  }

  // Project health checking
  async getProjectHealth() {
    const analyses = await this.analyzeProject()
    
    const totalComponents = analyses.length
    const averageScore = analyses.reduce((sum, analysis) => sum + analysis.score.overall, 0) / totalComponents
    const highRiskComponents = analyses.filter(analysis => analysis.score.overall < 60)
    const optimizationOpportunities = analyses.reduce((sum, analysis) => sum + analysis.optimizationSuggestions.length, 0)

    return {
      totalComponents,
      averageScore: Math.round(averageScore),
      highRiskComponents: highRiskComponents.length,
      optimizationOpportunities,
      recommendations: this.generateProjectRecommendations(analyses)
    }
  }

  private generateProjectRecommendations(analyses: any[]) {
    const recommendations = []

    // Check for common patterns across the project
    const allSuggestions = analyses.flatMap(a => a.optimizationSuggestions)
    const suggestionCounts = allSuggestions.reduce((counts, suggestion) => {
      counts[suggestion.type] = (counts[suggestion.type] || 0) + 1
      return counts
    }, {} as Record<string, number>)

    if (suggestionCounts.memoization > 5) {
      recommendations.push({
        type: 'project-wide',
        priority: 'high',
        description: 'Project has widespread performance optimization opportunities',
        action: 'Consider implementing a comprehensive memoization strategy'
      })
    }

    if (suggestionCounts.stateStructure > 3) {
      recommendations.push({
        type: 'project-wide',
        priority: 'medium', 
        description: 'Multiple components could benefit from better state management',
        action: 'Consider implementing a centralized state management solution'
      })
    }

    return recommendations
  }
}