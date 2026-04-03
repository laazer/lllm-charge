import React, { useState, useEffect } from 'react'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import { DataTable } from '../../components/ui/Data/DataTable'
import { Modal } from '../../components/ui/Modals/Modal'
import {
  CpuChipIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  CodeBracketIcon,
  DocumentIcon,
  ServerStackIcon,
  CircleStackIcon,
  ChartBarIcon,
  BugAntIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  MapIcon,
  CogIcon
} from '@heroicons/react/24/outline'

interface MCPTool {
  name: string
  description: string
  category: string
  isActive: boolean
  lastUsed: string | null
  usageCount: number
  inputSchema: any
}

interface MCPResource {
  name: string
  uri: string
  description: string
  isAvailable: boolean
}

interface MCPStatus {
  isHealthy: boolean
  uptime: {
    ms: number
    formatted: string
  }
  tools: {
    total: number
    totalCalls: number
    errors: number
    errorRate: number
    mostUsed: Array<{ name: string; count: number; lastUsed: string }>
    withErrors: Array<{ name: string; errorCount: number }>
  }
  resources: {
    total: number
    available: number
  }
  cache: {
    codeGraph: number
    docs: number
    memory: number
  }
  system: {
    totalRequests: number
    webSocketClients: number
    memoryUsage: {
      rss: number
      heapUsed: number
      heapTotal: number
      external: number
    }
    nodeVersion: string
  }
  timestamp: string
}

interface MCPData {
  tools: MCPTool[]
  resources: MCPResource[]
  status: MCPStatus
}

export function MCPSection() {
  const [mcpData, setMCPData] = useState<MCPData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null)
  const [toolTestModal, setToolTestModal] = useState(false)
  const [toolTestParams, setToolTestParams] = useState<string>('')
  const [toolTestResult, setToolTestResult] = useState<any>(null)
  const [toolTestLoading, setToolTestLoading] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [djangoProjectPath, setDjangoProjectPath] = useState<string>('/path/to/django/project')
  const [showDjangoQuickStart, setShowDjangoQuickStart] = useState(false)

  // Load MCP data
  const loadMCPData = async () => {
    try {
      const [toolsResponse, resourcesResponse, statusResponse] = await Promise.all([
        fetch('/mcp/tools'),
        fetch('/mcp/resources'),
        fetch('/mcp/status')
      ])

      if (!toolsResponse.ok || !resourcesResponse.ok || !statusResponse.ok) {
        throw new Error('Failed to fetch MCP data')
      }

      const toolsData = await toolsResponse.json()
      const resourcesData = await resourcesResponse.json()
      const statusData = await statusResponse.json()

      setMCPData({
        tools: toolsData.tools || [],
        resources: resourcesData.resources || [],
        status: statusData
      })
      setError(null)
    } catch (err) {
      console.error('Error loading MCP data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Test MCP tool
  const testTool = async (toolName: string, params: string) => {
    setToolTestLoading(true)
    setToolTestResult(null)

    try {
      let parsedParams = {}
      if (params.trim()) {
        parsedParams = JSON.parse(params)
      }

      const response = await fetch(`/mcp/call/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedParams)
      })

      const result = await response.json()
      setToolTestResult({
        success: response.ok,
        data: result,
        timestamp: new Date().toISOString()
      })

      // Refresh data to show updated usage
      await loadMCPData()
    } catch (err) {
      setToolTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    } finally {
      setToolTestLoading(false)
    }
  }

  // Auto-refresh data
  useEffect(() => {
    loadMCPData()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (!toolTestLoading) {
        loadMCPData()
      }
    }, 30000)

    setRefreshInterval(interval)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [toolTestLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [refreshInterval])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading MCP Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center text-red-600 dark:text-red-400">
          <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-4" />
          <p>Error: {error}</p>
          <button 
            onClick={loadMCPData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!mcpData) return null

  // Group tools by category with Django tools highlighted
  const toolsByCategory = mcpData.tools.reduce((acc, tool) => {
    const category = tool.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(tool)
    return acc
  }, {} as Record<string, MCPTool[]>)

  // Django tools specifically
  const djangoTools = mcpData.tools.filter(tool => 
    tool.name.includes('django') || 
    tool.description.toLowerCase().includes('django')
  )

  // Django quick actions
  const runDjangoTool = async (toolName: string, defaultParams: any = {}) => {
    const params = { project_path: djangoProjectPath, ...defaultParams }
    await testTool(toolName, JSON.stringify(params))
  }

  // Get category icon
  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case 'django': return SparklesIcon
      case 'workflow': return CogIcon
      case 'documentation': return DocumentIcon
      case 'analysis': return ChartBarIcon
      case 'ai reasoning': return SparklesIcon
      default: return CodeBracketIcon
    }
  }

  // Prepare data for tools table
  const toolsTableData = mcpData.tools.map(tool => ({
    id: tool.name,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    usageCount: tool.usageCount,
    lastUsed: tool.lastUsed ? new Date(tool.lastUsed).toLocaleString() : 'Never',
    status: tool.isActive ? 'Active' : 'Inactive',
    tool: tool
  }))

  const toolsTableColumns = [
    { 
      key: 'name', 
      label: 'Tool Name', 
      sortable: true,
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          {row.tool.name.includes('django') && (
            <SparklesIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
          )}
          <span className={`${row.tool.name.includes('django') ? 'font-medium text-green-800 dark:text-green-200' : ''}`}>
            {value}
          </span>
        </div>
      )
    },
    { 
      key: 'category', 
      label: 'Category', 
      sortable: true,
      render: (value: any, row: any) => {
        const CategoryIcon = getCategoryIcon(value)
        return (
          <div className="flex items-center space-x-2">
            <CategoryIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className={`${value === 'Django' ? 'font-medium text-green-800 dark:text-green-200' : ''}`}>
              {value}
            </span>
          </div>
        )
      }
    },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'usageCount', label: 'Usage', sortable: true },
    { key: 'lastUsed', label: 'Last Used', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ]

  // Prepare data for resources table
  const resourcesTableData = mcpData.resources.map((resource, index) => ({
    id: index,
    name: resource.name,
    uri: resource.uri,
    description: resource.description,
    status: resource.isAvailable ? 'Available' : 'Unavailable'
  }))

  const resourcesTableColumns = [
    { key: 'name', label: 'Resource Name', sortable: true },
    { key: 'uri', label: 'URI', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'status', label: 'Status', sortable: true }
  ]

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">MCP Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Model Context Protocol tools and resources monitoring
          </p>
        </div>
        <button
          onClick={loadMCPData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     transition-colors duration-200 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="MCP Status"
          value={mcpData.status.isHealthy ? 'Healthy' : 'Unhealthy'}
          description={`Uptime: ${mcpData.status.uptime.formatted}`}
          status={mcpData.status.isHealthy ? 'success' : 'error'}
          icon={mcpData.status.isHealthy ? CpuChipIcon : ExclamationTriangleIcon}
          trend={mcpData.status.tools.errorRate < 5 ? { value: 'Low error rate', isPositive: true } : { value: 'High error rate', isPositive: false }}
        />

        <MetricCard
          title="Active Tools"
          value={mcpData.status.tools.total}
          color="blue"
          size="md"
          icon={CodeBracketIcon}
          change={mcpData.status.tools.totalCalls > 0 ? { 
            value: mcpData.status.tools.totalCalls, 
            period: 'total calls',
            isPositive: true 
          } : undefined}
        />

        <MetricCard
          title="Available Resources"
          value={mcpData.status.resources.available}
          color="green"
          size="md"
          icon={DocumentIcon}
          change={{ 
            value: mcpData.status.resources.total, 
            period: 'total resources',
            isPositive: true 
          }}
        />

        <MetricCard
          title="Error Rate"
          value={`${mcpData.status.tools.errorRate}%`}
          color={mcpData.status.tools.errorRate > 10 ? "red" : "green"}
          size="md"
          icon={mcpData.status.tools.errorRate > 10 ? BugAntIcon : ChartBarIcon}
          change={mcpData.status.tools.errors > 0 ? { 
            value: mcpData.status.tools.errors, 
            period: 'total errors',
            isPositive: false 
          } : undefined}
        />
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Memory Usage"
          value={formatMemory(mcpData.status.system.memoryUsage.heapUsed)}
          color="purple"
          size="md"
          icon={ServerStackIcon}
          change={{ 
            value: formatMemory(mcpData.status.system.memoryUsage.heapTotal), 
            period: 'heap total',
            isPositive: true 
          }}
        />

        <MetricCard
          title="WebSocket Clients"
          value={mcpData.status.system.webSocketClients}
          color="yellow"
          size="md"
          icon={CircleStackIcon}
          change={{ 
            value: mcpData.status.system.totalRequests, 
            period: 'total requests',
            isPositive: true 
          }}
        />

        <MetricCard
          title="Cache Size"
          value={mcpData.status.cache.codeGraph + mcpData.status.cache.docs + mcpData.status.cache.memory}
          color="gray"
          size="md"
          icon={ClockIcon}
          change={{ 
            value: `${mcpData.status.cache.codeGraph}/${mcpData.status.cache.docs}/${mcpData.status.cache.memory}`, 
            period: 'code/docs/memory',
            isPositive: true 
          }}
        />
      </div>

      {/* Django Development Quick Start */}
      {djangoTools.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 
                        rounded-lg p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <SparklesIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Django Development Tools</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {djangoTools.length} specialized tools available for Django backend development
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDjangoQuickStart(!showDjangoQuickStart)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                         transition-colors duration-200 flex items-center space-x-2"
            >
              <SparklesIcon className="w-4 h-4" />
              <span>{showDjangoQuickStart ? 'Hide' : 'Show'} Quick Actions</span>
            </button>
          </div>

          {showDjangoQuickStart && (
            <div className="space-y-4">
              {/* Django Project Path Input */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Django Project Path
                </label>
                <input
                  type="text"
                  value={djangoProjectPath}
                  onChange={(e) => setDjangoProjectPath(e.target.value)}
                  placeholder="/path/to/your/django/project"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           focus:ring-2 focus:ring-green-500 focus:border-transparent
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <button
                  onClick={() => runDjangoTool('analyze_django_models')}
                  className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg
                           border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  <CodeBracketIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
                  <span className="text-xs font-medium text-gray-900 dark:text-white">Analyze Models</span>
                </button>

                <button
                  onClick={() => runDjangoTool('check_django_security')}
                  className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg
                           border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  <ShieldCheckIcon className="w-5 h-5 text-red-600 dark:text-red-400 mb-1" />
                  <span className="text-xs font-medium text-gray-900 dark:text-white">Security Check</span>
                </button>

                <button
                  onClick={() => runDjangoTool('generate_django_migration')}
                  className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg
                           border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  <ArrowPathIcon className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
                  <span className="text-xs font-medium text-gray-900 dark:text-white">Generate Migration</span>
                </button>

                <button
                  onClick={() => runDjangoTool('analyze_django_urls')}
                  className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg
                           border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  <MapIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" />
                  <span className="text-xs font-medium text-gray-900 dark:text-white">Analyze URLs</span>
                </button>

                <button
                  onClick={() => runDjangoTool('generate_django_admin')}
                  className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg
                           border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700
                           transition-colors duration-200"
                >
                  <CogIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mb-1" />
                  <span className="text-xs font-medium text-gray-900 dark:text-white">Generate Admin</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Most Used Tools */}
      {mcpData.status.tools.mostUsed.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Most Used Tools</h3>
          <div className="space-y-2">
            {mcpData.status.tools.mostUsed.map((tool, index) => (
              <div key={tool.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{tool.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{tool.count} calls</span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last: {new Date(tool.lastUsed).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tools Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">MCP Tools</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Available tools and their usage statistics
          </p>
        </div>
        <div className="p-6">
          <DataTable
            data={toolsTableData}
            columns={toolsTableColumns}
            searchable={true}
            onRowClick={(row) => {
              setSelectedTool(row.tool)
              setToolTestModal(true)
              
              // Pre-populate parameters for Django tools
              if (row.tool.name.includes('django')) {
                setToolTestParams(JSON.stringify({ project_path: djangoProjectPath }, null, 2))
              } else {
                setToolTestParams('')
              }
              
              setToolTestResult(null)
            }}
          />
        </div>
      </div>

      {/* Resources Table */}
      {mcpData.resources.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">MCP Resources</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Available resources and their status
            </p>
          </div>
          <div className="p-6">
            <DataTable
              data={resourcesTableData}
              columns={resourcesTableColumns}
              searchable={true}
            />
          </div>
        </div>
      )}

      {/* Tool Test Modal */}
      <Modal
        isOpen={toolTestModal}
        onClose={() => {
          setToolTestModal(false)
          setSelectedTool(null)
          setToolTestParams('')
          setToolTestResult(null)
        }}
        title={`Test Tool: ${selectedTool?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          {selectedTool && (
            <>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Description</h4>
                <p className="text-gray-600 dark:text-gray-400">{selectedTool.description}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Input Schema</h4>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Test Parameters (JSON)
                </label>
                <textarea
                  value={toolTestParams}
                  onChange={(e) => setToolTestParams(e.target.value)}
                  placeholder='{"param1": "value1", "param2": "value2"}'
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 
                           rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => testTool(selectedTool.name, toolTestParams)}
                  disabled={toolTestLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center space-x-2"
                >
                  {toolTestLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                  <span>{toolTestLoading ? 'Testing...' : 'Test Tool'}</span>
                </button>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Usage count: {selectedTool.usageCount}
                </div>
              </div>

              {toolTestResult && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Test Result</h4>
                  <div className={`p-4 rounded-lg ${
                    toolTestResult.success 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${
                        toolTestResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                      }`}>
                        {toolTestResult.success ? 'Success' : 'Error'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(toolTestResult.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(toolTestResult.data || toolTestResult.error, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}