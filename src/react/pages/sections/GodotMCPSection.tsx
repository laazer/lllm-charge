import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import { DataTable } from '../../components/ui/Data/DataTable'
import { Modal } from '../../components/ui/Modals/Modal'
import FileBrowser from '../../components/ui/FileBrowser'
import {
  ClockIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ServerStackIcon,
  ChartBarIcon,
  CubeIcon,
  PhotoIcon,
  SpeakerWaveIcon,
  FilmIcon,
  RocketLaunchIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import { apiClient } from '../../lib/api-client'
import { useProject } from '../../store/project-store'
import type { Project } from '../../types'

const STORAGE_KEY = 'llm-charge-godot-dashboard-v2'
const LEGACY_GODOT_STORAGE_KEY = 'llm-charge-godot-dashboard-v1'

/** Prefer DB column; some rows only store path under `data`. */
function diskPathFromAppProject(project: Project | undefined): string {
  if (!project) return ''
  const raw = project as Project & { code_graph_path?: string | null }
  const col = String(raw.codeGraphPath ?? raw.code_graph_path ?? '').trim()
  if (col) return col
  const data = (project as Project & { data?: Record<string, unknown> }).data
  const nested = data?.codeGraphPath ?? data?.code_graph_path
  return typeof nested === 'string' ? nested.trim() : ''
}

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
    totalSize: number
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
  inputSchema: Record<string, unknown>
  godotVersion: string[]
}

interface LastSceneSnapshot {
  scenePath: string
  loadTime: number
  memoryUsage: number
  nodeCount: number
  performance: string
  complexityScore: number
}

interface RecentRun {
  toolName: string
  at: string
  ok: boolean
}

interface PersistedDashboard {
  projectPath: string
  analyzedProject: GodotProject | null
  lastSceneSnapshot: LastSceneSnapshot | null
  toolRunStats: Record<string, { count: number; lastUsed: string | null }>
  recentToolRuns: RecentRun[]
}

function readPersisted(): Partial<PersistedDashboard> {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const rawV2 = sessionStorage.getItem(STORAGE_KEY)
    if (rawV2) return JSON.parse(rawV2) as Partial<PersistedDashboard>

    const rawLegacy = sessionStorage.getItem(LEGACY_GODOT_STORAGE_KEY)
    if (rawLegacy) {
      const prev = JSON.parse(rawLegacy) as Partial<PersistedDashboard>
      const migrated: Partial<PersistedDashboard> = {
        projectPath: (prev.projectPath || '').trim()
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      sessionStorage.removeItem(LEGACY_GODOT_STORAGE_KEY)
      return migrated
    }
  } catch {
    return {}
  }
  return {}
}

function sameProjectRoot(a: string, b: string): boolean {
  const x = a.trim().replace(/[/\\]+$/, '')
  const y = b.trim().replace(/[/\\]+$/, '')
  return x === y
}

/** Tools implemented by this server’s MCP layer (no fictional entries). */
const GODOT_MCP_TOOL_DEFS: Omit<GodotTool, 'lastUsed' | 'usageCount'>[] = [
  {
    name: 'godot_project_analyzer',
    description: 'Scan project.godot and folders; returns scene/script/asset counts and export hints.',
    category: 'performance',
    isActive: true,
    inputSchema: {
      projectPath: 'optional; defaults to server cwd if omitted — dashboard always sends the path field above'
    },
    godotVersion: ['4.x']
  },
  {
    name: 'godot_scene_analyzer',
    description: 'Read a .tscn under the project; optional scenePath defaults to run/main_scene.',
    category: 'performance',
    isActive: true,
    inputSchema: {
      projectPath: 'required from dashboard',
      scenePath: 'optional; res:// paths accepted',
      analyzePerformance: 'boolean, default true'
    },
    godotVersion: ['4.x']
  },
  {
    name: 'gdscript_optimizer',
    description: 'Static suggestions for a .gd file (scriptPath required, project-relative or res://).',
    category: 'script',
    isActive: true,
    inputSchema: {
      projectPath: 'required from dashboard',
      scriptPath: 'required',
      optimizationLevel: 'e.g. basic'
    },
    godotVersion: ['4.x']
  },
  {
    name: 'component_generator',
    description: 'Generate GDScript snippets from a template (no filesystem writes).',
    category: 'generation',
    isActive: true,
    inputSchema: {
      componentType: 'string',
      features: 'string[]'
    },
    godotVersion: ['4.x']
  }
]

function emptyStats(): Record<string, { count: number; lastUsed: string | null }> {
  const o: Record<string, { count: number; lastUsed: string | null }> = {}
  for (const t of GODOT_MCP_TOOL_DEFS) {
    o[t.name] = { count: 0, lastUsed: null }
  }
  return o
}

export function GodotMCPSection() {
  const initial = useMemo(() => readPersisted(), [])

  const [godotProjectPath, setGodotProjectPath] = useState<string>(initial.projectPath ?? '')
  const [analyzedProject, setAnalyzedProject] = useState<GodotProject | null>(
    initial.analyzedProject ?? null
  )
  const [lastSceneSnapshot, setLastSceneSnapshot] = useState<LastSceneSnapshot | null>(
    initial.lastSceneSnapshot ?? null
  )
  const [toolRunStats, setToolRunStats] = useState<Record<string, { count: number; lastUsed: string | null }>>(
    () => ({ ...emptyStats(), ...(initial.toolRunStats ?? {}) })
  )
  const [recentToolRuns, setRecentToolRuns] = useState<RecentRun[]>(initial.recentToolRuns ?? [])

  const [error, setError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<GodotTool | null>(null)
  const [toolModal, setToolModal] = useState(false)
  const [toolParams, setToolParams] = useState<string>('')
  const [toolResult, setToolResult] = useState<any>(null)
  const [toolLoading, setToolLoading] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  const queryClient = useQueryClient()
  const { currentProjectId } = useProject()
  const { data: appProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects()
  })

  const codeGraphPathForCurrentProject = useMemo(() => {
    const p = appProjects.find((pr) => pr.id === currentProjectId)
    return diskPathFromAppProject(p)
  }, [appProjects, currentProjectId])

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [queryClient])

  useEffect(() => {
    const onProjectChange = () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
    window.addEventListener('projectChange', onProjectChange as EventListener)
    return () => window.removeEventListener('projectChange', onProjectChange as EventListener)
  }, [queryClient])

  /** `null` until first sync so opening Godot after switching header elsewhere still refetches + applies disk path. */
  const lastHeaderProjectIdRef = useRef<string | null>(null)
  useEffect(() => {
    const skip =
      lastHeaderProjectIdRef.current !== null && lastHeaderProjectIdRef.current === currentProjectId
    if (skip) return
    lastHeaderProjectIdRef.current = currentProjectId
    void queryClient
      .fetchQuery({
        queryKey: ['projects'],
        queryFn: () => apiClient.getProjects()
      })
      .then((list) => {
        const row = list.find((x) => x.id === currentProjectId)
        const d = diskPathFromAppProject(row)
        if (d) setGodotProjectPath(d)
      })
      .catch(() => {})
  }, [currentProjectId, queryClient])

  const lastAppProjectIdRef = useRef<string | null>(null)
  const lastAppProjectPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!codeGraphPathForCurrentProject) return
    setGodotProjectPath((prev) => {
      if (prev.trim()) return prev
      return codeGraphPathForCurrentProject
    })
  }, [codeGraphPathForCurrentProject])

  useEffect(() => {
    if (!codeGraphPathForCurrentProject) {
      lastAppProjectIdRef.current = currentProjectId
      lastAppProjectPathRef.current = null
      return
    }

    const prevId = lastAppProjectIdRef.current
    const prevPath = lastAppProjectPathRef.current

    if (prevId !== null && prevId !== currentProjectId && prevPath) {
      setGodotProjectPath((current) => {
        const cur = current.trim()
        if (cur && sameProjectRoot(cur, prevPath)) {
          return codeGraphPathForCurrentProject
        }
        return current
      })
    }

    lastAppProjectIdRef.current = currentProjectId
    lastAppProjectPathRef.current = codeGraphPathForCurrentProject
  }, [currentProjectId, codeGraphPathForCurrentProject])

  useEffect(() => {
    const p = godotProjectPath.trim()
    if (!p) {
      setAnalyzedProject(null)
      setLastSceneSnapshot(null)
      return
    }
    if (analyzedProject && !sameProjectRoot(analyzedProject.path, p)) {
      setAnalyzedProject(null)
      setLastSceneSnapshot(null)
    }
  }, [godotProjectPath, analyzedProject])

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    try {
      const payload: PersistedDashboard = {
        projectPath: godotProjectPath,
        analyzedProject,
        lastSceneSnapshot,
        toolRunStats,
        recentToolRuns
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      /* quota or private mode */
    }
  }, [godotProjectPath, analyzedProject, lastSceneSnapshot, toolRunStats, recentToolRuns])

  const godotTools: GodotTool[] = useMemo(
    () =>
      GODOT_MCP_TOOL_DEFS.map((d) => ({
        ...d,
        usageCount: toolRunStats[d.name]?.count ?? 0,
        lastUsed: toolRunStats[d.name]?.lastUsed ?? null
      })),
    [toolRunStats]
  )

  const loadGodotData = () => {
    try {
      setError(null)
      const p = readPersisted()
      if (p.projectPath !== undefined) setGodotProjectPath(p.projectPath)
      if (p.analyzedProject !== undefined) setAnalyzedProject(p.analyzedProject)
      if (p.lastSceneSnapshot !== undefined) setLastSceneSnapshot(p.lastSceneSnapshot)
      if (p.toolRunStats) setToolRunStats({ ...emptyStats(), ...p.toolRunStats })
      if (p.recentToolRuns) setRecentToolRuns(p.recentToolRuns)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handlePathSelect = (path: string) => {
    setGodotProjectPath(path)
    setShowFileBrowser(false)
  }

  const recordToolAttempt = (toolName: string, ok: boolean) => {
    const at = new Date().toISOString()
    setRecentToolRuns((prev) => [{ toolName, at, ok }, ...prev].slice(0, 12))
    if (ok) {
      setToolRunStats((prev) => ({
        ...prev,
        [toolName]: {
          count: (prev[toolName]?.count ?? 0) + 1,
          lastUsed: at
        }
      }))
    }
  }

  const testGodotTool = async (toolName: string, params: string) => {
    setToolLoading(true)
    setToolResult(null)

    try {
      const needsProjectRoot =
        toolName === 'godot_project_analyzer' ||
        toolName === 'godot_scene_analyzer' ||
        toolName === 'gdscript_optimizer'
      if (needsProjectRoot) {
        if (!godotProjectPath || godotProjectPath.trim() === '') {
          throw new Error('Please specify a project path before running this tool')
        }
      }

      let parsedParams: Record<string, any> = {}
      if (params.trim()) {
        parsedParams = JSON.parse(params)
      }

      let requestBody: Record<string, any>

      switch (toolName) {
        case 'godot_scene_analyzer': {
          const trimmedRoot = godotProjectPath.trim()
          requestBody = {
            projectPath: trimmedRoot,
            analyzePerformance:
              parsedParams['analyzePerformance'] !== undefined ? parsedParams['analyzePerformance'] : true
          }
          const sp = parsedParams['scenePath']
          if (sp != null && String(sp).trim() !== '') {
            requestBody.scenePath = sp
          }
          break
        }

        case 'gdscript_optimizer': {
          const scriptPath = parsedParams['scriptPath']
          if (!scriptPath || String(scriptPath).trim() === '') {
            throw new Error(
              'Provide scriptPath in Tool Parameters JSON, e.g. {"scriptPath":"scripts/player/player_controller_3d.gd"}'
            )
          }
          requestBody = {
            projectPath: godotProjectPath.trim(),
            scriptPath,
            optimizationLevel: parsedParams['optimizationLevel'] || 'basic'
          }
          break
        }

        case 'component_generator':
          requestBody = {
            componentType: parsedParams['componentType'] || 'player_controller',
            features: parsedParams['features'] || ['movement', 'jumping']
          }
          break

        case 'godot_project_analyzer':
        default:
          requestBody = {
            projectPath: godotProjectPath.trim()
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

      const result = await response.json()

      if (result && result.success === false) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error)
        throw new Error(msg)
      }

      if (toolName === 'godot_project_analyzer' && result.data) {
        setAnalyzedProject(result.data as GodotProject)
      }
      if (toolName === 'godot_scene_analyzer' && result.data) {
        const d = result.data as LastSceneSnapshot
        setLastSceneSnapshot({
          scenePath: d.scenePath,
          loadTime: d.loadTime,
          memoryUsage: d.memoryUsage,
          nodeCount: d.nodeCount,
          performance: d.performance,
          complexityScore: d.complexityScore
        })
      }

      recordToolAttempt(toolName, true)

      setToolResult({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      console.error(`Error executing tool ${toolName}:`, err)
      recordToolAttempt(toolName, false)

      let userFriendlyError = err instanceof Error ? err.message : 'Unknown error'

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
      } else if (userFriendlyError.includes('Provide scriptPath')) {
        userFriendlyError = `${userFriendlyError}

Add a JSON object in Tool Parameters, for example: {"scriptPath":"scripts/player/player_controller_3d.gd"}`
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
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center text-red-600 dark:text-red-400">
          <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-4" />
          <p>Error: {error}</p>
          <button
            type="button"
            onClick={loadGodotData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const toolsTableData = godotTools.map((tool) => ({
    id: tool.name,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    usageCount: tool.usageCount,
    lastUsed: tool.lastUsed ? new Date(tool.lastUsed).toLocaleString() : 'Never',
    godotVersions: tool.godotVersion.join(', '),
    status: tool.isActive ? 'Active' : 'Inactive',
    tool
  }))

  const toolsTableColumns = [
    { key: 'name', label: 'Tool Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'usageCount', label: 'Runs (session)', sortable: true },
    { key: 'lastUsed', label: 'Last run', sortable: true },
    { key: 'godotVersions', label: 'Godot', sortable: false }
  ]

  const formatMemory = (mb: number) => `${mb.toFixed(1)} MB`

  const sceneLoadDisplay = lastSceneSnapshot ? `${lastSceneSnapshot.loadTime} ms` : '—'
  const sceneMemoryDisplay = lastSceneSnapshot ? `${lastSceneSnapshot.memoryUsage} MB` : '—'
  const buildDisplay = analyzedProject
    ? analyzedProject.exportSettings.buildStatus
    : '—'
  const assetTotalCount = analyzedProject
    ? analyzedProject.assets.textures +
      analyzedProject.assets.sounds +
      analyzedProject.assets.models +
      analyzedProject.assets.animations
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <CubeIcon className="w-8 h-8 mr-3 text-blue-600" />
            Godot Game Development Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Run MCP tools against your project; summaries below update from real responses (saved for this browser
            session).
          </p>
        </div>

        <div className="flex-1 max-w-md w-full">
          <label htmlFor="godot-project-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Godot project root
          </label>
          <div className="flex space-x-2">
            <input
              id="godot-project-path"
              type="text"
              value={godotProjectPath}
              onChange={(e) => setGodotProjectPath(e.target.value)}
              placeholder="/absolute/path/to/godot-project"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 
                         rounded-md shadow-sm placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowFileBrowser(true)}
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
            Directory that contains <code className="text-xs">project.godot</code>. When this field is empty, it
            defaults to the <strong>current project</strong> path from the header (Projects →{' '}
            <code className="text-xs">codeGraphPath</code>
            ). Session snapshot above still wins if you already saved a path. Changing the path clears cached
            snapshots until you analyze again.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
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
            type="button"
            onClick={loadGodotData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Reload saved session</span>
          </button>
        </div>
      </div>

      {toolResult && !toolResult.success && !toolModal && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap"
        >
          {typeof toolResult.error === 'string' ? toolResult.error : JSON.stringify(toolResult.error)}
        </div>
      )}

      {analyzedProject ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <CubeIcon className="w-5 h-5 mr-2" />
            Project: {analyzedProject.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 break-all">{analyzedProject.path}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Godot version</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{analyzedProject.version}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Scenes</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{analyzedProject.scenes.total}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Scripts</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{analyzedProject.scripts.total}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Tracked asset size</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatMemory(analyzedProject.assets.totalSize)}
              </div>
            </div>
          </div>
          {analyzedProject.scenes.mainScene && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Main scene: <code className="text-xs">{analyzedProject.scenes.mainScene}</code>
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-8 text-center"
          data-testid="godot-empty-project"
        >
          <p className="text-gray-700 dark:text-gray-300 font-medium">No project snapshot loaded</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Set the project root above and click <strong>Analyze Project</strong> to pull real counts from{' '}
            <code className="text-xs">project.godot</code> and your folders.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Scene load (last run)"
          value={sceneLoadDisplay}
          color={
            !lastSceneSnapshot ? 'gray' : lastSceneSnapshot.loadTime < 100 ? 'green' : 'yellow'
          }
          size="md"
          icon={ClockIcon}
        />

        <MetricCard
          title="Scene memory (last run)"
          value={sceneMemoryDisplay}
          color="purple"
          size="md"
          icon={ServerStackIcon}
        />

        <MetricCard
          title="Export / build hint"
          value={buildDisplay}
          color={analyzedProject?.exportSettings.buildStatus === 'success' ? 'green' : 'gray'}
          size="md"
          icon={RocketLaunchIcon}
        />

        <MetricCard
          title="Asset items (indexed)"
          value={assetTotalCount !== null ? assetTotalCount : '—'}
          color="blue"
          size="md"
          icon={PhotoIcon}
        />
      </div>

      {analyzedProject && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard title="Textures" value={analyzedProject.assets.textures} color="green" size="sm" icon={PhotoIcon} />

          <MetricCard
            title="Audio files"
            value={analyzedProject.assets.sounds}
            color="yellow"
            size="sm"
            icon={SpeakerWaveIcon}
          />

          <MetricCard title="3D models" value={analyzedProject.assets.models} color="purple" size="sm" icon={CubeIcon} />

          <MetricCard
            title="Animations"
            value={analyzedProject.assets.animations}
            color="blue"
            size="sm"
            icon={FilmIcon}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Recent tool runs</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Successful and failed calls from this page (session).
        </p>
        {recentToolRuns.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No runs yet — open a tool below or use Analyze Project.</p>
        ) : (
          <ul className="space-y-2">
            {recentToolRuns.map((r, i) => (
              <li
                key={`${r.at}-${i}`}
                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
              >
                <span className="font-mono text-gray-900 dark:text-white">{r.toolName}</span>
                <span className={r.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {r.ok ? 'ok' : 'failed'}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{new Date(r.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Godot MCP tools</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Registered on this server — descriptions match the live handlers.
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
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Parameters</h4>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Tool parameters (JSON)
                </label>
                <textarea
                  value={toolParams}
                  onChange={(e) => setToolParams(e.target.value)}
                  placeholder={
                    selectedTool.name === 'godot_scene_analyzer'
                      ? '{"scenePath":"scenes/levels/example.tscn"} — optional; {} uses run/main_scene'
                      : selectedTool.name === 'gdscript_optimizer'
                        ? '{"scriptPath":"scripts/player/player_controller_3d.gd","optimizationLevel":"basic"}'
                        : selectedTool.name === 'godot_project_analyzer'
                          ? '{} — project path is taken from the field above'
                          : '{"componentType":"player_controller","features":["movement"]}'
                  }
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 
                           rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
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
                  <span>{toolLoading ? 'Running...' : 'Run tool'}</span>
                </button>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Runs this session: {selectedTool.usageCount}
                </div>
              </div>

              {toolResult && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tool result</h4>
                  <div
                    className={`p-4 rounded-lg ${
                      toolResult.success
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`font-medium ${
                          toolResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                        }`}
                      >
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
