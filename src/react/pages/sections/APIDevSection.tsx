import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { DataTable, TableColumn } from '../../components/ui/Data/DataTable'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import FileBrowser from '../../components/ui/FileBrowser'
import {
  ServerIcon,
  CommandLineIcon,
  CogIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  PlayIcon,
  CodeBracketIcon,
  ChartBarIcon,
  BeakerIcon,
  ClockIcon,
  CheckCircleIcon,
  FolderIcon
} from '@heroicons/react/24/outline'

interface APITool {
  name: string
  description: string
  inputSchema?: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
}

interface APIDevSectionProps {
  className?: string
}

export function APIDevSection({ className = '' }: APIDevSectionProps) {
  const [selectedFramework, setSelectedFramework] = useState<'django' | 'fastapi' | 'fastmcp'>('django')
  const [projectPath, setProjectPath] = useState('')
  const [isExecuting, setIsExecuting] = useState<string | null>(null)
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({})
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  // Fetch MCP tools and status
  const { data: mcpData, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: async () => {
      const [tools, status] = await Promise.all([
        apiClient.getMCPTools(),
        apiClient.getMCPStatus()
      ])
      return { tools: tools.tools || [], status }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  })

  // Filter tools by framework
  const frameworkTools = React.useMemo(() => {
    if (!mcpData?.tools) return []
    
    const filterMap = {
      django: (tool: APITool) => 
        tool.name.includes('django') || 
        tool.description.toLowerCase().includes('django'),
      fastapi: (tool: APITool) => 
        tool.name.includes('fastapi') || 
        tool.description.toLowerCase().includes('fastapi'),
      fastmcp: (tool: APITool) => 
        tool.name.includes('mcp') || 
        tool.description.toLowerCase().includes('mcp server') ||
        tool.name.includes('benchmark_mcp') ||
        tool.name.includes('generate_mcp') ||
        tool.name.includes('analyze_mcp')
    }
    
    return mcpData.tools.filter(filterMap[selectedFramework])
  }, [mcpData?.tools, selectedFramework])

  // File browser handlers
  const handlePathSelect = (path: string) => {
    setProjectPath(path)
    setShowFileBrowser(false)
  }

  const handleOpenFileBrowser = () => {
    setShowFileBrowser(true)
  }

  // Execute tool with parameters
  const executeTool = async (toolName: string, params: Record<string, any> = {}) => {
    setIsExecuting(toolName)
    try {
      // Add project path to params if provided
      const toolParams = projectPath ? { ...params, project_path: projectPath } : params
      const result = await apiClient.callMCPTool(toolName, toolParams)
      
      setExecutionResults(prev => ({
        ...prev,
        [toolName]: {
          success: true,
          result,
          timestamp: Date.now()
        }
      }))
    } catch (error) {
      setExecutionResults(prev => ({
        ...prev,
        [toolName]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        }
      }))
    } finally {
      setIsExecuting(null)
    }
  }

  // Quick action configurations for each framework
  const frameworkConfigs = {
    django: {
      title: 'Django Development Tools',
      gradient: 'from-green-500 to-emerald-600',
      quickActions: [
        {
          label: 'Analyze Models',
          icon: ServerIcon,
          color: 'bg-green-500',
          action: () => executeTool('analyze_django_models', { include_migrations: true })
        },
        {
          label: 'Security Scan',
          icon: ShieldCheckIcon,
          color: 'bg-red-500',
          action: () => executeTool('check_django_security')
        },
        {
          label: 'Generate Migration',
          icon: CogIcon,
          color: 'bg-blue-500',
          action: () => executeTool('generate_django_migration', { dry_run: true })
        },
        {
          label: 'Analyze URLs',
          icon: CommandLineIcon,
          color: 'bg-purple-500',
          action: () => executeTool('analyze_django_urls')
        },
        {
          label: 'Generate Admin',
          icon: DocumentTextIcon,
          color: 'bg-orange-500',
          action: () => executeTool('generate_django_admin')
        }
      ]
    },
    fastapi: {
      title: 'FastAPI Development Tools',
      gradient: 'from-blue-500 to-cyan-600',
      quickActions: [
        {
          label: 'Analyze Routes',
          icon: CommandLineIcon,
          color: 'bg-blue-500',
          action: () => executeTool('analyze_fastapi_routes')
        },
        {
          label: 'Generate Model',
          icon: CodeBracketIcon,
          color: 'bg-green-500',
          action: () => executeTool('generate_fastapi_model', { 
            model_name: 'ExampleModel',
            fields: { name: 'str', age: 'int', email: 'Optional[str]' }
          })
        },
        {
          label: 'Security Check',
          icon: ShieldCheckIcon,
          color: 'bg-red-500',
          action: () => executeTool('check_fastapi_security', { check_cors: true, check_auth: true })
        },
        {
          label: 'Generate OpenAPI',
          icon: DocumentTextIcon,
          color: 'bg-purple-500',
          action: () => executeTool('generate_fastapi_openapi')
        }
      ]
    },
    fastmcp: {
      title: 'FastMCP Server Tools',
      gradient: 'from-purple-500 to-violet-600',
      quickActions: [
        {
          label: 'Analyze Server',
          icon: ServerIcon,
          color: 'bg-purple-500',
          action: () => executeTool('analyze_mcp_server', { check_tools: true, check_resources: true })
        },
        {
          label: 'Generate Tool',
          icon: CogIcon,
          color: 'bg-blue-500',
          action: () => executeTool('generate_mcp_tool', {
            tool_name: 'example_tool',
            description: 'Example MCP tool',
            parameters: { input: { type: 'string' } },
            handler_type: 'async'
          })
        },
        {
          label: 'Benchmark Performance',
          icon: ChartBarIcon,
          color: 'bg-green-500',
          action: () => executeTool('benchmark_mcp_performance', { iterations: 5 })
        }
      ]
    }
  }

  const config = frameworkConfigs[selectedFramework]

  // Table columns for tools
  const toolColumns: TableColumn<APITool>[] = [
    {
      key: 'name',
      label: 'Tool Name',
      sortable: true,
      width: '200px',
      render: (value: string, tool: APITool) => (
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            selectedFramework === 'django' ? 'bg-green-400' :
            selectedFramework === 'fastapi' ? 'bg-blue-400' : 'bg-purple-400'
          }`} />
          <span className="font-medium text-gray-900 dark:text-white">{value}</span>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      sortable: false,
      render: (value: string) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {value.length > 80 ? `${value.substring(0, 80)}...` : value}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      width: '120px',
      render: (_, tool: APITool) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => executeTool(tool.name)}
            disabled={isExecuting === tool.name}
            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md
                     bg-blue-100 text-blue-700 hover:bg-blue-200 
                     dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting === tool.name ? (
              <BeakerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            <span className="ml-1">Run</span>
          </button>
          {executionResults[tool.name] && (
            <div className="flex items-center">
              {executionResults[tool.name].success ? (
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ClockIcon className="w-4 h-4 text-red-500" />
              )}
            </div>
          )}
        </div>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Error Loading API Dev Tools
        </h3>
        <p className="text-red-600 dark:text-red-300 mb-4">
          {error instanceof Error ? error.message : 'Failed to load MCP tools'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 
                   rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          API Development Tools
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Comprehensive tools for Django, FastAPI, and FastMCP development
        </p>
      </div>

      {/* Framework Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center space-x-4 mb-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Framework:
          </label>
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
            {(['django', 'fastapi', 'fastmcp'] as const).map((framework) => (
              <button
                key={framework}
                onClick={() => setSelectedFramework(framework)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedFramework === framework
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                }`}
              >
                {framework === 'django' ? 'Django' : 
                 framework === 'fastapi' ? 'FastAPI' : 'FastMCP'}
              </button>
            ))}
          </div>
        </div>

        {/* Project Path Input */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Project Path:
          </label>
          <div className="flex-1 flex space-x-2">
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="./path/to/project (optional)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md
                       bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                       placeholder-gray-500 dark:placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleOpenFileBrowser}
              className="px-3 py-2 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300
                       border border-gray-300 dark:border-slate-600 rounded-md
                       hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors
                       flex items-center space-x-1"
              title="Browse for project path"
            >
              <FolderIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Browse</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`bg-gradient-to-r ${config.gradient} rounded-lg p-6 text-white`}>
        <h3 className="text-xl font-bold mb-2">{config.title}</h3>
        <p className="text-white/90 mb-4">
          Quick actions to get started with {selectedFramework} development
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {config.quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <button
                key={index}
                onClick={action.action}
                disabled={isExecuting !== null}
                className="flex flex-col items-center p-3 bg-white/10 backdrop-blur-sm rounded-lg
                         hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-center">{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Available Tools"
          count={frameworkTools.length}
          status="success"
          description={`${selectedFramework} development tools`}
          icon={CogIcon}
        />
        <StatusCard
          title="MCP Connection"
          count={mcpData?.status ? 1 : 0}
          status={mcpData?.status ? "success" : "error"}
          description="Server connection status"
          icon={ServerIcon}
        />
        <StatusCard
          title="Recent Executions"
          count={Object.keys(executionResults).length}
          status="info"
          description="Tools executed this session"
          icon={ChartBarIcon}
        />
      </div>

      {/* Tools Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {config.title} ({frameworkTools.length} tools)
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Click "Run" to execute tools with current project path
          </p>
        </div>
        
        <DataTable
          data={frameworkTools}
          columns={toolColumns}
          searchable={true}
          searchPlaceholder={`Search ${selectedFramework} tools...`}
          className="border-0"
        />
      </div>

      {/* Recent Results */}
      {Object.keys(executionResults).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Execution Results
          </h3>
          <div className="space-y-3">
            {Object.entries(executionResults).slice(-5).map(([toolName, result]) => (
              <div key={toolName} className={`p-3 rounded-md border ${
                result.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {toolName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs bg-gray-100 dark:bg-slate-700 p-2 rounded overflow-x-auto">
                  {JSON.stringify(result.success ? result.result : result.error, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Browser Modal */}
      {showFileBrowser && (
        <FileBrowser
          onSelectPath={handlePathSelect}
          onClose={() => setShowFileBrowser(false)}
          initialPath={projectPath}
          title="Select Project Directory"
          selectFoldersOnly={true}
        />
      )}
    </div>
  )
}