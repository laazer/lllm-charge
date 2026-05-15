import React, { useState, useEffect } from 'react'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import {
  CogIcon,
  SparklesIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CpuChipIcon,
  CommandLineIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
  BeakerIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface ToolCategory {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  defaultEnabled: boolean
  tools: string[]
  color: string
}

interface ToolsConfig {
  categories: Record<string, boolean>
  tools: Record<string, boolean>
  lastUpdated: string
}

interface ToolProfile {
  id: string
  name: string
  description: string
  categories: string[]
  toolCount: number
  isDefault: boolean
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'core',
    name: 'Core Tools',
    description: 'Essential tools for basic functionality',
    icon: SparklesIcon,
    defaultEnabled: true,
    color: 'blue',
    tools: ['hybrid_reasoning', 'get_system_status', 'build_context_package', 'get_context_tree']
  },
  {
    id: 'code-analysis',
    name: 'Code Analysis',
    description: 'Code understanding and analysis tools',
    icon: CodeBracketIcon,
    defaultEnabled: true,
    color: 'purple',
    tools: ['search_code_symbols', 'get_blast_radius', 'scaffold_feature', 'compare_projects']
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Documentation search and creation tools',
    icon: DocumentTextIcon,
    defaultEnabled: true,
    color: 'green',
    tools: ['search_developer_docs', 'install_developer_docs', 'create_spec', 'quick_doc_lookup']
  },
  {
    id: 'workflow',
    name: 'Workflow & Automation',
    description: 'Workflow creation and management',
    icon: ArrowPathIcon,
    defaultEnabled: false,
    color: 'indigo',
    tools: ['create_workflow']
  },
  {
    id: 'react-dev',
    name: 'React Development',
    description: 'React-specific development tools',
    icon: CpuChipIcon,
    defaultEnabled: false,
    color: 'cyan',
    tools: ['scaffold_react_component', 'analyze_react_component', 'get_react_project_health', 
            'optimize_react_performance', 'generate_react_tests', 'refactor_react_component']
  },
  {
    id: 'django-dev',
    name: 'Django Development',
    description: 'Django framework tools',
    icon: CommandLineIcon,
    defaultEnabled: false,
    color: 'green',
    tools: ['analyze_django_models', 'check_django_security', 'generate_django_migration', 
            'analyze_django_urls', 'generate_django_admin']
  },
  {
    id: 'fastapi-dev',
    name: 'FastAPI Development',
    description: 'FastAPI framework tools',
    icon: SparklesIcon,
    defaultEnabled: false,
    color: 'emerald',
    tools: ['analyze_fastapi_routes', 'generate_fastapi_model', 'check_fastapi_security', 
            'generate_fastapi_openapi']
  },
  {
    id: 'game-dev',
    name: 'Game Development',
    description: 'Godot and game development tools',
    icon: CubeIcon,
    defaultEnabled: false,
    color: 'orange',
    tools: ['godot_scene_analyzer', 'gdscript_optimizer', 'component_generator', 
            'godot_project_analyzer']
  },
  {
    id: 'buddies',
    name: 'AI Buddies',
    description: 'Companion AI tools',
    icon: ChatBubbleLeftRightIcon,
    defaultEnabled: false,
    color: 'pink',
    tools: ['create_buddy', 'configure_buddy', 'chat_with_buddy', 'list_buddies', 'delete_buddy']
  },
  {
    id: 'advanced',
    name: 'Advanced Tools',
    description: 'Specialized and experimental tools',
    icon: BeakerIcon,
    defaultEnabled: false,
    color: 'gray',
    tools: ['benchmark_mcp_performance', 'analyze_mcp_server', 'generate_mcp_tool', 
            'update_memory', 'search_memory', 'get_cost_metrics', 'optimize_local_usage']
  }
]

const PREDEFINED_PROFILES: ToolProfile[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Basic AI interaction only',
    categories: ['core'],
    toolCount: 4,
    isDefault: false
  },
  {
    id: 'code-analysis',
    name: 'Code Analysis',
    description: 'Code understanding and documentation',
    categories: ['core', 'code-analysis', 'documentation'],
    toolCount: 12,
    isDefault: false
  },
  {
    id: 'react-developer',
    name: 'React Developer',
    description: 'React-focused development workflow',
    categories: ['core', 'code-analysis', 'documentation', 'react-dev'],
    toolCount: 18,
    isDefault: true
  },
  {
    id: 'full-stack',
    name: 'Full Stack',
    description: 'Complete web development workflow',
    categories: ['core', 'code-analysis', 'documentation', 'workflow', 'react-dev', 'django-dev', 'fastapi-dev'],
    toolCount: 35,
    isDefault: false
  },
  {
    id: 'game-developer',
    name: 'Game Developer',
    description: 'Godot/game development focused',
    categories: ['core', 'code-analysis', 'game-dev'],
    toolCount: 12,
    isDefault: false
  }
]

export function ToolsConfigSection() {
  const [config, setConfig] = useState<ToolsConfig>({
    categories: {},
    tools: {},
    lastUpdated: new Date().toISOString()
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<string>('react-developer')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [allTools, setAllTools] = useState<any[]>([])

  // Load current configuration
  const loadConfig = async () => {
    try {
      const response = await fetch('/api/tools/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      } else {
        // Initialize with defaults if no config exists
        const defaultConfig: ToolsConfig = {
          categories: {},
          tools: {},
          lastUpdated: new Date().toISOString()
        }
        
        TOOL_CATEGORIES.forEach(category => {
          defaultConfig.categories[category.id] = category.defaultEnabled
        })
        
        setConfig(defaultConfig)
      }
    } catch (err) {
      console.error('Error loading tools config:', err)
      setError('Failed to load tools configuration')
    }
  }

  // Load all available tools
  const loadAllTools = async () => {
    try {
      const response = await fetch('/mcp/tools')
      if (response.ok) {
        const data = await response.json()
        setAllTools(data.tools || [])
      }
    } catch (err) {
      console.error('Error loading tools:', err)
    } finally {
      setLoading(false)
    }
  }

  // Save configuration
  const saveConfig = async (newConfig: ToolsConfig) => {
    setSaving(true)
    try {
      const response = await fetch('/api/tools/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig)
      })
      
      if (response.ok) {
        setConfig(newConfig)
        setError(null)
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (err) {
      console.error('Error saving config:', err)
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  // Toggle category
  const toggleCategory = async (categoryId: string, enabled: boolean) => {
    const newConfig = {
      ...config,
      categories: {
        ...config.categories,
        [categoryId]: enabled
      },
      lastUpdated: new Date().toISOString()
    }
    await saveConfig(newConfig)
  }

  // Toggle individual tool
  const toggleTool = async (toolName: string, enabled: boolean) => {
    const newConfig = {
      ...config,
      tools: {
        ...config.tools,
        [toolName]: enabled
      },
      lastUpdated: new Date().toISOString()
    }
    await saveConfig(newConfig)
  }

  // Apply profile
  const applyProfile = async (profileId: string) => {
    const profile = PREDEFINED_PROFILES.find(p => p.id === profileId)
    if (!profile) return

    const newConfig = {
      categories: {} as Record<string, boolean>,
      tools: {} as Record<string, boolean>,
      lastUpdated: new Date().toISOString()
    }

    // Set all categories to false first
    TOOL_CATEGORIES.forEach(category => {
      newConfig.categories[category.id] = false
    })

    // Enable selected categories
    profile.categories.forEach(categoryId => {
      newConfig.categories[categoryId] = true
    })

    setSelectedProfile(profileId)
    await saveConfig(newConfig)
  }

  // Reset to defaults
  const resetToDefaults = async () => {
    const defaultConfig: ToolsConfig = {
      categories: {},
      tools: {},
      lastUpdated: new Date().toISOString()
    }
    
    TOOL_CATEGORIES.forEach(category => {
      defaultConfig.categories[category.id] = category.defaultEnabled
    })
    
    await saveConfig(defaultConfig)
  }

  useEffect(() => {
    loadConfig()
    loadAllTools()
  }, [])

  // Calculate enabled tools count
  const getEnabledToolsCount = () => {
    let count = 0
    TOOL_CATEGORIES.forEach(category => {
      const categoryEnabled = config.categories[category.id] ?? category.defaultEnabled
      if (categoryEnabled) {
        category.tools.forEach(tool => {
          const toolEnabled = config.tools[tool] ?? categoryEnabled
          if (toolEnabled) count++
        })
      }
    })
    return count
  }

  // Filter categories by search term
  const filteredCategories = TOOL_CATEGORIES.filter(category => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      category.name.toLowerCase().includes(searchLower) ||
      category.description.toLowerCase().includes(searchLower) ||
      category.tools.some(tool => tool.toLowerCase().includes(searchLower))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Tools Configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🔧 Tools Configuration</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage MCP tools to reduce clutter and improve performance
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                       transition-colors duration-200 flex items-center space-x-2"
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            <span>{showAdvanced ? 'Simple' : 'Advanced'}</span>
          </button>
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                       transition-colors duration-200 flex items-center space-x-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Enabled Tools"
          value={getEnabledToolsCount()}
          color="blue"
          size="md"
          icon={CheckCircleIcon}
          change={{ 
            value: allTools.length, 
            period: 'total available',
            isPositive: true 
          }}
        />
        
        <MetricCard
          title="Active Categories"
          value={Object.values(config.categories).filter(Boolean).length}
          color="green"
          size="md"
          icon={AdjustmentsHorizontalIcon}
          change={{ 
            value: TOOL_CATEGORIES.length, 
            period: 'total categories',
            isPositive: true 
          }}
        />
        
        <MetricCard
          title="Current Profile"
          value={PREDEFINED_PROFILES.find(p => p.id === selectedProfile)?.name || 'Custom'}
          color="purple"
          size="md"
          icon={CogIcon}
        />

        <StatusCard
          title="Configuration"
          value={saving ? 'Saving...' : 'Saved'}
          description={`Last updated: ${new Date(config.lastUpdated).toLocaleString()}`}
          status={saving ? 'warning' : 'success'}
          icon={saving ? ArrowPathIcon : CheckCircleIcon}
        />
      </div>

      {/* Profile Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Profiles</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {PREDEFINED_PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => applyProfile(profile.id)}
              className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                selectedProfile === profile.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-left">
                <h4 className="font-medium text-gray-900 dark:text-white">{profile.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{profile.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {profile.toolCount} tools
                  </span>
                  {profile.isDefault && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      Default
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <input
          type="text"
          placeholder="Search categories and tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCategories.map((category) => {
          const categoryEnabled = config.categories[category.id] ?? category.defaultEnabled
          const IconComponent = category.icon
          
          return (
            <div
              key={category.id}
              className={`bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border-2 transition-all duration-200 ${
                categoryEnabled 
                  ? 'border-blue-200 dark:border-blue-800' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <IconComponent className={`w-6 h-6 ${categoryEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleCategory(category.id, !categoryEnabled)}
                  className={`p-2 rounded-lg transition-colors duration-200 ${
                    categoryEnabled
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {categoryEnabled ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tools ({category.tools.length})</span>
                  <span className={`font-medium ${categoryEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                    {categoryEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {showAdvanced && (
                  <div className="mt-3 space-y-2">
                    {category.tools.map((toolName) => {
                      const toolEnabled = config.tools[toolName] ?? categoryEnabled
                      return (
                        <div key={toolName} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{toolName}</span>
                          <button
                            onClick={() => toggleTool(toolName, !toolEnabled)}
                            disabled={!categoryEnabled}
                            className={`p-1 rounded transition-colors duration-200 ${
                              !categoryEnabled 
                                ? 'opacity-50 cursor-not-allowed' 
                                : toolEnabled
                                  ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900'
                                  : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900'
                            }`}
                          >
                            {toolEnabled ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!showAdvanced && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {category.tools.slice(0, 3).join(', ')}
                    {category.tools.length > 3 && ` + ${category.tools.length - 3} more`}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Saving configuration...</span>
        </div>
      )}
    </div>
  )
}