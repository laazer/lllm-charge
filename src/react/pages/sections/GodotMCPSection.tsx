import React, { useState, useEffect } from 'react'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import { DataTable } from '../../components/ui/Data/DataTable'
import { Modal } from '../../components/ui/Modals/Modal'
import FileBrowser from '../../components/ui/FileBrowser'
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
  CubeIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  FilmIcon,
  CogIcon,
  RocketLaunchIcon,
  FolderIcon
} from '@heroicons/react/24/outline'

// Godot-specific interfaces
interface GodotProject {
  name: string
  path: string
  version: string
  isValid: boolean
  scenes: {
    total: number
    mainScene: string | null
    autoloadScenes: number
  }
  scripts: {
    total: number
    gdscriptCount: number
    csharpCount: number
    errors: number
  }
  assets: {
    textures: number
    sounds: number
    models: number
    animations: number
    totalSize: number // in MB
  }
  exportSettings: {
    platforms: string[]
    lastBuildTime: string | null
    buildStatus: 'success' | 'failed' | 'pending' | 'none'
  }
}

interface GodotTool {
  name: string
  description: string
  category: 'scene' | 'script' | 'asset' | 'export' | 'performance' | 'generation'
  isActive: boolean
  lastUsed: string | null
  usageCount: number
  inputSchema: any
  godotVersion: string[]
}

interface GodotPerformanceMetrics {
  sceneLoadTime: number // ms
  scriptCompileTime: number // ms
  memoryUsage: {
    textures: number // MB
    scripts: number // MB
    scenes: number // MB
    audio: number // MB
  }
  nodeComplexity: {
    averageNodesPerScene: number
    maxNodesInScene: number
    deepestHierarchy: number
  }
}

interface GodotMCPStatus {
  isHealthy: boolean
  project: GodotProject | null
  tools: {
    total: number
    totalCalls: number
    errors: number
    errorRate: number
    byCategory: Record<string, number>
    mostUsed: Array<{ name: string; count: number; lastUsed: string }>
  }
  performance: GodotPerformanceMetrics
  lastAnalysis: string
}

export function GodotMCPSection() {
  const [godotStatus, setGodotStatus] = useState<GodotMCPStatus | null>(null)
  const [godotTools, setGodotTools] = useState<GodotTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<GodotTool | null>(null)
  const [toolModal, setToolModal] = useState(false)
  const [toolParams, setToolParams] = useState<string>('')
  const [toolResult, setToolResult] = useState<any>(null)
  const [toolLoading, setToolLoading] = useState(false)
  const [showProjectAnalyzer, setShowProjectAnalyzer] = useState(false)
  const [godotProjectPath, setGodotProjectPath] = useState<string>('')
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  // Mock data for Godot-specific tools and status
  const mockGodotTools: GodotTool[] = [
    {
      name: 'godot_scene_analyzer',
      description: 'Analyze Godot scene files for performance bottlenecks and optimization opportunities',
      category: 'performance',
      isActive: true,
      lastUsed: new Date().toISOString(),
      usageCount: 15,
      inputSchema: { scenePath: 'string', analyzePerformance: 'boolean' },
      godotVersion: ['4.0', '4.1', '4.2']
    },
    {
      name: 'gdscript_optimizer',
      description: 'Suggest performance improvements for GDScript code',
      category: 'script',
      isActive: true,
      lastUsed: new Date(Date.now() - 3600000).toISOString(),
      usageCount: 23,
      inputSchema: { scriptPath: 'string', optimizationLevel: 'string' },
      godotVersion: ['4.0', '4.1', '4.2']
    },
    {
      name: 'component_generator',
      description: 'Generate common game components (player controller, inventory, dialogue system)',
      category: 'generation',
      isActive: true,
      lastUsed: new Date(Date.now() - 7200000).toISOString(),
      usageCount: 8,
      inputSchema: { componentType: 'string', features: 'array' },
      godotVersion: ['4.0', '4.1', '4.2']
    },
    {
      name: 'asset_optimizer',
      description: 'Optimize game assets (textures, audio, models) for better performance',
      category: 'asset',
      isActive: true,
      lastUsed: new Date(Date.now() - 10800000).toISOString(),
      usageCount: 12,
      inputSchema: { assetPath: 'string', targetPlatform: 'string' },
      godotVersion: ['4.0', '4.1', '4.2']
    },
    {
      name: 'export_builder',
      description: 'Build and export game for multiple platforms with optimized settings',
      category: 'export',
      isActive: true,
      lastUsed: new Date(Date.now() - 14400000).toISOString(),
      usageCount: 6,
      inputSchema: { platforms: 'array', buildType: 'string' },
      godotVersion: ['4.0', '4.1', '4.2']
    },
    {
      name: 'dialogue_system',
      description: 'Generate dialogue trees and conversation systems for RPGs',
      category: 'generation',
      isActive: true,
      lastUsed: new Date(Date.now() - 18000000).toISOString(),
      usageCount: 4,
      inputSchema: { characters: 'array', storyNodes: 'object' },
      godotVersion: ['4.0', '4.1', '4.2']
    }
  ]

  const mockGodotStatus: GodotMCPStatus = {
    isHealthy: true,
    project: {
      name: "My Awesome Game",
      path: "/path/to/game/project",
      version: "4.2.1",
      isValid: true,
      scenes: {
        total: 15,
        mainScene: "Main.tscn",
        autoloadScenes: 3
      },
      scripts: {
        total: 28,
        gdscriptCount: 25,
        csharpCount: 3,
        errors: 0
      },
      assets: {
        textures: 45,
        sounds: 12,
        models: 8,
        animations: 22,
        totalSize: 156.7
      },
      exportSettings: {
        platforms: ["Windows", "Linux", "macOS", "Android"],
        lastBuildTime: new Date(Date.now() - 3600000).toISOString(),
        buildStatus: "success"
      }
    },
    tools: {
      total: 6,
      totalCalls: 68,
      errors: 0,
      errorRate: 0,
      byCategory: {
        scene: 1,
        script: 1,
        asset: 1,
        export: 1,
        performance: 1,
        generation: 2
      },
      mostUsed: [
        { name: 'gdscript_optimizer', count: 23, lastUsed: new Date(Date.now() - 3600000).toISOString() },
        { name: 'godot_scene_analyzer', count: 15, lastUsed: new Date().toISOString() },
        { name: 'asset_optimizer', count: 12, lastUsed: new Date(Date.now() - 10800000).toISOString() }
      ]
    },
    performance: {
      sceneLoadTime: 45,
      scriptCompileTime: 120,
      memoryUsage: {
        textures: 89.3,
        scripts: 12.4,
        scenes: 8.7,
        audio: 24.1
      },
      nodeComplexity: {
        averageNodesPerScene: 32,
        maxNodesInScene: 127,
        deepestHierarchy: 6
      }
    },
    lastAnalysis: new Date().toISOString()
  }

  // Load Godot-specific data
  const loadGodotData = async () => {
    try {
      // In a real implementation, these would call actual MCP tools
      // For now, using mock data to demonstrate the concept
      setGodotStatus(mockGodotStatus)
      setGodotTools(mockGodotTools)
      setError(null)
    } catch (err) {
      console.error('Error loading Godot data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // File browser handlers for project path selection
  const handlePathSelect = (path: string) => {
    setGodotProjectPath(path)
    setShowFileBrowser(false)
  }

  const handleOpenFileBrowser = () => {
    setShowFileBrowser(true)
  }

  // Test Godot tool - now makes real API calls to MCP backend
  const testGodotTool = async (toolName: string, params: string) => {
    setToolLoading(true)
    setToolResult(null)

    try {
      // Validate project path for project analyzer
      if (toolName === 'godot_project_analyzer') {
        if (!godotProjectPath || godotProjectPath.trim() === '') {
          throw new Error('Please specify a project path before analyzing the project')
        }
      }

      let parsedParams: Record<string, any> = {}
      if (params.trim()) {
        parsedParams = JSON.parse(params)
      }

      // Make real API calls to MCP backend using the correct MCP call format
      let requestBody: Record<string, any>
      let result: any

      switch (toolName) {
        case 'godot_scene_analyzer':
          requestBody = {
            scenePath: parsedParams['scenePath'] || './scenes/Main.tscn',
            analyzePerformance: parsedParams['analyzePerformance'] !== undefined ? parsedParams['analyzePerformance'] : true
          }
          break

        case 'gdscript_optimizer':
          requestBody = {
            scriptPath: parsedParams['scriptPath'] || './scripts/Player.gd',
            optimizationLevel: parsedParams['optimizationLevel'] || 'basic'
          }
          break

        case 'component_generator':
          requestBody = {
            componentType: parsedParams['componentType'] || 'player_controller',
            features: parsedParams['features'] || ['movement', 'jumping']
          }
          break

        case 'godot_project_analyzer':
        default:
          // For project analysis, include the project path if specified
          requestBody = {
            projectPath: godotProjectPath || undefined
          }
          break
      }

      const response = await fetch(`/mcp/call/${toolName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      result = await response.json()

      setToolResult({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      })

      // Refresh data to show updated usage
      await loadGodotData()
    } catch (err) {
      console.error(`Error executing tool ${toolName}:`, err)
      
      // Enhanced error handling with more user-friendly messages
      let userFriendlyError = err instanceof Error ? err.message : 'Unknown error'
      
      // Provide better error messages for common issues
      if (userFriendlyError.includes('No project.godot found')) {
        userFriendlyError = `Invalid Godot Project: The selected directory doesn't contain a 'project.godot' file.

📁 Please select a valid Godot project directory that contains:
   • project.godot (required)
   • scenes/ folder (typically)
   • scripts/ folder (typically)

💡 Tips:
   • Use the Browse button to navigate to your Godot project folder
   • Make sure you select the root directory of your Godot project
   • The project.godot file should be directly in the selected folder`
      } else if (userFriendlyError.includes('Please specify a project path')) {
        userFriendlyError = `Project Path Required: Please enter or browse to select your Godot project directory before running the analysis.

🎯 To get started:
   1. Enter a project path in the text field above, OR
   2. Click the Browse button to select your project folder`
      }
      
      setToolResult({
        success: false,
        error: userFriendlyError,
        timestamp: new Date().toISOString()
      })
    } finally {
      setToolLoading(false)
    }
  }

  useEffect(() => {
    loadGodotData()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      if (!toolLoading) {
        loadGodotData()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [toolLoading])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Godot Dashboard...</p>
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
            onClick={loadGodotData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!godotStatus) return null

  // Prepare tools table data
  const toolsTableData = godotTools.map(tool => ({
    id: tool.name,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    usageCount: tool.usageCount,
    lastUsed: tool.lastUsed ? new Date(tool.lastUsed).toLocaleString() : 'Never',
    godotVersions: tool.godotVersion.join(', '),
    status: tool.isActive ? 'Active' : 'Inactive',
    tool: tool
  }))

  const toolsTableColumns = [
    { key: 'name', label: 'Tool Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'usageCount', label: 'Usage', sortable: true },
    { key: 'lastUsed', label: 'Last Used', sortable: true },
    { key: 'godotVersions', label: 'Godot Versions', sortable: false },
  ]

  const formatMemory = (mb: number) => `${mb.toFixed(1)} MB`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <CubeIcon className="w-8 h-8 mr-3 text-blue-600" />
            Godot Game Development Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered tools and insights for Godot game development
          </p>
        </div>
        
        {/* Project Path Input with Browse Button */}
        <div className="flex-1 max-w-md">
          <label htmlFor="godot-project-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Godot Project Path
          </label>
          <div className="flex space-x-2">
            <input
              id="godot-project-path"
              type="text"
              value={godotProjectPath}
              onChange={(e) => setGodotProjectPath(e.target.value)}
              placeholder="/path/to/your/godot/project"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 
                         rounded-md shadow-sm placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleOpenFileBrowser}
              className="px-3 py-2 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300
                         border border-gray-300 dark:border-slate-600 rounded-md
                         hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors
                         flex items-center space-x-1"
              title="Browse for Godot project directory"
            >
              <FolderIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Browse</span>
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            💡 Select the root directory containing project.godot file
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => testGodotTool('godot_project_analyzer', '')}
            disabled={toolLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                       disabled:bg-green-400 disabled:cursor-not-allowed
                       transition-colors duration-200 flex items-center space-x-2"
          >
            <ChartBarIcon className="w-4 h-4" />
            <span>{toolLoading ? 'Analyzing...' : 'Analyze Project'}</span>
          </button>
          <button
            onClick={loadGodotData}
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
      </div>

      {/* Project Status Overview */}
      {godotStatus.project && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <CogIcon className="w-5 h-5 mr-2" />
            Project: {godotStatus.project.name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Godot Version</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{godotStatus.project.version}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Scenes</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{godotStatus.project.scenes.total}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Scripts</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{godotStatus.project.scripts.total}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Asset Size</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatMemory(godotStatus.project.assets.totalSize)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Scene Load Time"
          value={`${godotStatus.performance.sceneLoadTime}ms`}
          color={godotStatus.performance.sceneLoadTime < 100 ? "green" : "yellow"}
          size="md"
          icon={ClockIcon}
          change={{ 
            value: godotStatus.performance.nodeComplexity.averageNodesPerScene, 
            period: 'avg nodes/scene',
            isPositive: true 
          }}
        />

        <MetricCard
          title="Memory Usage"
          value={formatMemory(Object.values(godotStatus.performance.memoryUsage).reduce((a, b) => a + b))}
          color="purple"
          size="md"
          icon={ServerStackIcon}
          change={{ 
            value: godotStatus.performance.memoryUsage.textures, 
            period: 'MB textures',
            isPositive: true 
          }}
        />

        <MetricCard
          title="Build Status"
          value={godotStatus.project?.exportSettings.buildStatus || 'Unknown'}
          color={godotStatus.project?.exportSettings.buildStatus === 'success' ? "green" : "red"}
          size="md"
          icon={RocketLaunchIcon}
          change={{ 
            value: godotStatus.project?.exportSettings.platforms.length || 0, 
            period: 'platforms',
            isPositive: true 
          }}
        />

        <MetricCard
          title="Asset Count"
          value={godotStatus.project ? 
            godotStatus.project.assets.textures + 
            godotStatus.project.assets.sounds + 
            godotStatus.project.assets.models : 0}
          color="blue"
          size="md"
          icon={PhotoIcon}
          change={{ 
            value: godotStatus.performance.nodeComplexity.maxNodesInScene, 
            period: 'max nodes',
            isPositive: true 
          }}
        />
      </div>

      {/* Asset Breakdown */}
      {godotStatus.project && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard
            title="Textures"
            value={godotStatus.project.assets.textures}
            color="green"
            size="sm"
            icon={PhotoIcon}
            change={{ 
              value: godotStatus.performance.memoryUsage.textures, 
              period: 'MB used',
              isPositive: true 
            }}
          />

          <MetricCard
            title="Audio Files"
            value={godotStatus.project.assets.sounds}
            color="yellow"
            size="sm"
            icon={SpeakerWaveIcon}
            change={{ 
              value: godotStatus.performance.memoryUsage.audio, 
              period: 'MB used',
              isPositive: true 
            }}
          />

          <MetricCard
            title="3D Models"
            value={godotStatus.project.assets.models}
            color="purple"
            size="sm"
            icon={CubeIcon}
          />

          <MetricCard
            title="Animations"
            value={godotStatus.project.assets.animations}
            color="blue"
            size="sm"
            icon={FilmIcon}
          />
        </div>
      )}

      {/* Most Used Tools */}
      {godotStatus.tools.mostUsed.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Most Used Godot Tools</h3>
          <div className="space-y-2">
            {godotStatus.tools.mostUsed.map((tool, index) => (
              <div key={tool.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                  <CodeBracketIcon className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900 dark:text-white">{tool.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{tool.count} uses</span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last: {new Date(tool.lastUsed).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Godot Tools Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Godot Development Tools</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            AI-powered tools for Godot game development
          </p>
        </div>
        <div className="p-6">
          <DataTable
            data={toolsTableData}
            columns={toolsTableColumns}
            searchable={true}
            onRowClick={(row) => {
              setSelectedTool(row.tool)
              setToolModal(true)
              setToolParams('')
              setToolResult(null)
            }}
          />
        </div>
      </div>

      {/* Tool Test Modal */}
      <Modal
        isOpen={toolModal}
        onClose={() => {
          setToolModal(false)
          setSelectedTool(null)
          setToolParams('')
          setToolResult(null)
        }}
        title={`Godot Tool: ${selectedTool?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          {selectedTool && (
            <>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Description</h4>
                <p className="text-gray-600 dark:text-gray-400">{selectedTool.description}</p>
                <div className="mt-2">
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    {selectedTool.category}
                  </span>
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded ml-2">
                    Godot {selectedTool.godotVersion.join(', ')}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Input Schema</h4>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Tool Parameters (JSON)
                </label>
                <textarea
                  value={toolParams}
                  onChange={(e) => setToolParams(e.target.value)}
                  placeholder={`{"scenePath": "Main.tscn", "analyzePerformance": true}`}
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 
                           rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => testGodotTool(selectedTool.name, toolParams)}
                  disabled={toolLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center space-x-2"
                >
                  {toolLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                  <span>{toolLoading ? 'Running...' : 'Run Tool'}</span>
                </button>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Used {selectedTool.usageCount} times
                </div>
              </div>

              {toolResult && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tool Result</h4>
                  <div className={`p-4 rounded-lg ${
                    toolResult.success 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${
                        toolResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                      }`}>
                        {toolResult.success ? 'Success' : 'Error'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(toolResult.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(toolResult.data || toolResult.error, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* File Browser Modal */}
      {showFileBrowser && (
        <FileBrowser
          onSelectPath={handlePathSelect}
          onClose={() => setShowFileBrowser(false)}
          initialPath={godotProjectPath}
          title="Select Godot Project Directory"
          selectFoldersOnly={true}
        />
      )}
    </div>
  )
}