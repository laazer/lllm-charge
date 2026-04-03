import React, { useState, useEffect } from 'react'
import { StatusCard } from '../components/ui/Cards/StatusCard'
import { MetricCard } from '../components/ui/Cards/MetricCard'
import { Modal } from '../components/ui/Modals/Modal'
import { 
  CodeBracketIcon,
  CpuChipIcon,
  ChartBarIcon,
  DocumentTextIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

interface ReactComponentOptions {
  componentName: string
  componentType: 'functional' | 'page' | 'layout' | 'ui'
  includeTests: boolean
  includeStorybook: boolean
  outputPath?: string
}

interface ReactProjectHealth {
  totalComponents: number
  averageScore: number
  highRiskComponents: number
  optimizationOpportunities: number
  recommendations: Array<{
    type: string
    priority: string
    description: string
    action: string
  }>
}

export function ReactDev() {
  const [showScaffoldModal, setShowScaffoldModal] = useState(false)
  const [projectHealth, setProjectHealth] = useState<ReactProjectHealth | null>(null)
  const [scaffoldForm, setScaffoldForm] = useState<ReactComponentOptions>({
    componentName: '',
    componentType: 'functional',
    includeTests: true,
    includeStorybook: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [lastScaffoldResult, setLastScaffoldResult] = useState<any>(null)

  // Load project health on component mount
  useEffect(() => {
    loadProjectHealth()
  }, [])

  const loadProjectHealth = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/mcp/call/get_react_project_health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const result = await response.json()
        setProjectHealth(result)
      }
    } catch (error) {
      console.warn('Could not load React project health:', error)
      // Set mock data for development
      setProjectHealth({
        totalComponents: 15,
        averageScore: 78,
        highRiskComponents: 3,
        optimizationOpportunities: 8,
        recommendations: [
          {
            type: 'project-wide',
            priority: 'high',
            description: 'Multiple components have performance optimization opportunities',
            action: 'Consider implementing a comprehensive memoization strategy'
          }
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleScaffoldComponent = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/mcp/call/scaffold_react_component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scaffoldForm)
      })
      
      if (response.ok) {
        const result = await response.json()
        setLastScaffoldResult(result)
        setShowScaffoldModal(false)
        // Reset form
        setScaffoldForm({
          componentName: '',
          componentType: 'functional',
          includeTests: true,
          includeStorybook: false
        })
        // Reload project health after successful scaffolding
        loadProjectHealth()
      } else {
        console.error('Failed to scaffold component')
      }
    } catch (error) {
      console.error('Error scaffolding component:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickScaffold = async (type: 'ui' | 'page' | 'layout') => {
    const componentName = prompt(`Enter ${type} component name (PascalCase):`)
    if (!componentName) return

    try {
      setIsLoading(true)
      const endpoint = type === 'ui' ? 'create_react_ui_component' : 'create_react_page_component'
      const response = await fetch(`/mcp/call/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          componentName,
          includeStorybook: type === 'ui'
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setLastScaffoldResult(result)
        loadProjectHealth()
      }
    } catch (error) {
      console.error('Error creating component:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeProject = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/mcp/call/analyze_react_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Project analysis result:', result)
        loadProjectHealth()
      }
    } catch (error) {
      console.error('Error analyzing project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">React Development</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Component scaffolding, state analysis, and project health monitoring
          </p>
        </div>
        <button
          onClick={() => setShowScaffoldModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <CodeBracketIcon className="w-4 h-4 mr-2" />
          New Component
        </button>
      </div>

      {/* Project Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Total Components"
          value={projectHealth?.totalComponents ?? 0}
          status="success"
          description="React components in project"
          icon={CodeBracketIcon}
        />
        <MetricCard
          title="Health Score"
          value={projectHealth?.averageScore ?? 0}
          unit="%"
          color="blue"
          size="md"
          description="Overall project health"
        />
        <StatusCard
          title="High Risk Components"
          value={projectHealth?.highRiskComponents ?? 0}
          status={projectHealth?.highRiskComponents && projectHealth.highRiskComponents > 0 ? "warning" : "success"}
          description="Components needing attention"
          icon={ExclamationTriangleIcon}
        />
        <StatusCard
          title="Optimization Opportunities"
          value={projectHealth?.optimizationOpportunities ?? 0}
          status="info"
          description="Performance improvements available"
          icon={ChartBarIcon}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => handleQuickScaffold('ui')}
            disabled={isLoading}
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <BeakerIcon className="w-8 h-8 text-blue-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-white">UI Component</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Create reusable UI component</div>
            </div>
          </button>

          <button
            onClick={() => handleQuickScaffold('page')}
            disabled={isLoading}
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <DocumentTextIcon className="w-8 h-8 text-green-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-white">Page Component</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Create full page component</div>
            </div>
          </button>

          <button
            onClick={analyzeProject}
            disabled={isLoading}
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <ChartBarIcon className="w-8 h-8 text-purple-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-white">Analyze Project</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Scan all components</div>
            </div>
          </button>

          <button
            onClick={loadProjectHealth}
            disabled={isLoading}
            className="flex items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            <CpuChipIcon className="w-8 h-8 text-orange-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-white">Refresh Health</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Update metrics</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recommendations */}
      {projectHealth?.recommendations && projectHealth.recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h2>
          <div className="space-y-4">
            {projectHealth.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <InformationCircleIcon className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-amber-900 dark:text-amber-100">{rec.description}</div>
                  <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">{rec.action}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Priority: {rec.priority} • Type: {rec.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {lastScaffoldResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          <div className="flex items-start space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-green-900 dark:text-green-100">Component Created Successfully</div>
              <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                {lastScaffoldResult.componentPath}
              </div>
              {lastScaffoldResult.files && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Files: {lastScaffoldResult.files.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scaffold Component Modal */}
      <Modal
        isOpen={showScaffoldModal}
        onClose={() => setShowScaffoldModal(false)}
        title="Create React Component"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="componentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Component Name (PascalCase)
            </label>
            <input
              type="text"
              id="componentName"
              value={scaffoldForm.componentName}
              onChange={(e) => setScaffoldForm(prev => ({ ...prev, componentName: e.target.value }))}
              placeholder="e.g., UserProfile, DataTable, NavigationMenu"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="componentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Component Type
            </label>
            <select
              id="componentType"
              value={scaffoldForm.componentType}
              onChange={(e) => setScaffoldForm(prev => ({ ...prev, componentType: e.target.value as any }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="functional">Functional Component</option>
              <option value="ui">UI Component</option>
              <option value="page">Page Component</option>
              <option value="layout">Layout Component</option>
            </select>
          </div>

          <div>
            <label htmlFor="outputPath" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Output Path (optional)
            </label>
            <input
              type="text"
              id="outputPath"
              value={scaffoldForm.outputPath || ''}
              onChange={(e) => setScaffoldForm(prev => ({ ...prev, outputPath: e.target.value }))}
              placeholder="e.g., components/forms, pages/admin"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="includeTests"
                type="checkbox"
                checked={scaffoldForm.includeTests}
                onChange={(e) => setScaffoldForm(prev => ({ ...prev, includeTests: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeTests" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Include React Testing Library tests
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="includeStorybook"
                type="checkbox"
                checked={scaffoldForm.includeStorybook}
                onChange={(e) => setScaffoldForm(prev => ({ ...prev, includeStorybook: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeStorybook" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Include Storybook stories (UI components only)
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowScaffoldModal(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleScaffoldComponent}
              disabled={isLoading || !scaffoldForm.componentName}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Component'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}