import React, { useState, useCallback } from 'react'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import {
  CubeIcon,
  FilmIcon,
  PaintBrushIcon,
  ArrowPathIcon,
  CpuChipIcon,
  FolderArrowDownIcon,
  EyeIcon,
  PlayIcon,
  StopIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ViewfinderCircleIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────────────

interface GenerationJob {
  id: string
  name: string
  type: 'parametric' | 'noise' | 'lsystem' | 'text_to_3d' | 'pipeline'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  createdAt: string
  outputFiles: string[]
  error?: string
}

interface AssetEntry {
  id: number
  name: string
  category: string
  vertexCount: number
  faceCount: number
  format: string
  createdAt: string
  tags: string[]
}

interface PipelineStats {
  totalAssets: number
  totalJobs: number
  completedJobs: number
  failedJobs: number
  activeJobs: number
  avgGenerationTime: number
  totalVertices: number
  costSavings: number
}

type TabId = 'overview' | 'generate' | 'assets' | 'pipeline' | 'jobs'

// ── Constants ──────────────────────────────────────────────────────

const SHAPE_OPTIONS = [
  { value: 'box', label: 'Box' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'torus', label: 'Torus' },
  { value: 'cone', label: 'Cone' },
  { value: 'grid', label: 'Grid' },
]

const PRESET_OPTIONS = [
  { value: 'tree', label: 'Tree' },
  { value: 'bush', label: 'Bush' },
  { value: 'fern', label: 'Fern' },
  { value: 'coral', label: 'Coral' },
  { value: 'fractal', label: 'Fractal' },
]

const MATERIAL_PRESETS = [
  'wood', 'metal', 'glass', 'stone', 'plastic', 'fabric', 'rubber', 'ceramic',
  'gold', 'silver', 'copper', 'marble', 'concrete', 'brick', 'leather',
  'ice', 'water', 'lava', 'neon', 'holographic',
]

const LIGHTING_STYLES = [
  'studio_3point', 'dramatic', 'natural_outdoor', 'sunset', 'moonlight', 'neon',
]

const ANIMATION_TEMPLATES = [
  'bounce', 'spin', 'pulse', 'fade_in', 'fade_out', 'slide_in', 'shake', 'orbit',
]

const EXPORT_FORMATS = ['GLB', 'GLTF', 'FBX', 'OBJ', 'USD', 'STL', 'PLY']

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: ViewfinderCircleIcon },
  { id: 'generate', label: 'Generate', icon: SparklesIcon },
  { id: 'assets', label: 'Assets', icon: Square3Stack3DIcon },
  { id: 'pipeline', label: 'Pipeline', icon: Cog6ToothIcon },
  { id: 'jobs', label: 'Jobs', icon: ClockIcon },
]

// ── Mock data ──────────────────────────────────────────────────────

const MOCK_STATS: PipelineStats = {
  totalAssets: 47,
  totalJobs: 156,
  completedJobs: 142,
  failedJobs: 3,
  activeJobs: 2,
  avgGenerationTime: 3.4,
  totalVertices: 2_847_320,
  costSavings: 78,
}

const MOCK_JOBS: GenerationJob[] = [
  { id: 'job_1', name: 'Forest Scene', type: 'lsystem', status: 'running', progress: 0.65, createdAt: '2 min ago', outputFiles: [] },
  { id: 'job_2', name: 'Character Base Mesh', type: 'text_to_3d', status: 'running', progress: 0.30, createdAt: '5 min ago', outputFiles: [] },
  { id: 'job_3', name: 'Rock Collection', type: 'noise', status: 'completed', progress: 1.0, createdAt: '12 min ago', outputFiles: ['rocks_v1.glb'] },
  { id: 'job_4', name: 'Building Kitbash', type: 'parametric', status: 'completed', progress: 1.0, createdAt: '25 min ago', outputFiles: ['building.glb', 'building.fbx'] },
  { id: 'job_5', name: 'Terrain LOD Pipeline', type: 'pipeline', status: 'failed', progress: 0.8, createdAt: '1 hr ago', outputFiles: [], error: 'Decimation failed: non-manifold geometry' },
]

const MOCK_ASSETS: AssetEntry[] = [
  { id: 1, name: 'Oak Tree v3', category: 'vegetation', vertexCount: 12450, faceCount: 8200, format: 'glb', createdAt: '2 hrs ago', tags: ['tree', 'lsystem', 'outdoor'] },
  { id: 2, name: 'Mountain Terrain', category: 'terrain', vertexCount: 65536, faceCount: 64000, format: 'glb', createdAt: '3 hrs ago', tags: ['terrain', 'noise', 'landscape'] },
  { id: 3, name: 'Modern Building', category: 'architecture', vertexCount: 3200, faceCount: 2800, format: 'fbx', createdAt: '5 hrs ago', tags: ['building', 'kitbash', 'modern'] },
  { id: 4, name: 'Crystal Sphere', category: 'props', vertexCount: 2048, faceCount: 2000, format: 'glb', createdAt: '6 hrs ago', tags: ['prop', 'glass', 'emission'] },
  { id: 5, name: 'Rock Set (5 variants)', category: 'props', vertexCount: 8400, faceCount: 7800, format: 'glb', createdAt: '1 day ago', tags: ['rock', 'noise', 'organic'] },
  { id: 6, name: 'Animated Robot', category: 'characters', vertexCount: 15600, faceCount: 14200, format: 'glb', createdAt: '1 day ago', tags: ['character', 'animated', 'robot'] },
]

// ── Sub-components ─────────────────────────────────────────────────

function ProgressBar({ progress, color = 'blue' }: { progress: number; color?: string }) {
  const percentage = Math.round(progress * 100)
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  }
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color] || colorMap.blue}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-10 text-right">{percentage}%</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
    running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500 animate-pulse' },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
    failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  }
  const style = config[status] || config.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  )
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
      {tag}
    </span>
  )
}

// ── Tab: Overview ──────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Assets" value={MOCK_STATS.totalAssets} icon={Square3Stack3DIcon} color="blue" />
        <MetricCard title="Active Jobs" value={MOCK_STATS.activeJobs} icon={ArrowPathIcon} color="yellow" />
        <MetricCard title="Total Vertices" value={formatNumber(MOCK_STATS.totalVertices)} icon={CubeIcon} color="purple" />
        <MetricCard title="Avg Gen Time" value={`${MOCK_STATS.avgGenerationTime}s`} icon={ClockIcon} color="green" />
      </div>

      {/* Job success rate bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Job Success Rate</h3>
        <div className="flex items-center gap-4">
          <ProgressBar progress={MOCK_STATS.completedJobs / MOCK_STATS.totalJobs} color="green" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {MOCK_STATS.completedJobs}/{MOCK_STATS.totalJobs}
          </span>
        </div>
      </div>

      {/* Recent jobs + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4" /> Active Jobs
          </h3>
          <div className="space-y-4">
            {MOCK_JOBS.filter(j => j.status === 'running').map(job => (
              <div key={job.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{job.name}</span>
                  <StatusBadge status={job.status} />
                </div>
                <ProgressBar progress={job.progress} />
              </div>
            ))}
            {MOCK_JOBS.filter(j => j.status === 'running').length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No active jobs</p>
            )}
          </div>
        </div>

        {/* Module Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <CpuChipIcon className="w-4 h-4" /> Module Status
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Parametric Generator', status: 'ready', icon: CubeIcon },
              { name: 'Noise Generator', status: 'ready', icon: SparklesIcon },
              { name: 'L-System Generator', status: 'ready', icon: Square3Stack3DIcon },
              { name: 'LLM Integration', status: 'ready', icon: CpuChipIcon },
              { name: 'Animation Engine', status: 'ready', icon: FilmIcon },
              { name: 'Export Pipeline', status: 'ready', icon: FolderArrowDownIcon },
              { name: 'Mesh Validator', status: 'ready', icon: CheckCircleIcon },
              { name: 'Batch Renderer', status: 'ready', icon: EyeIcon },
            ].map(module => (
              <div key={module.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <module.icon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{module.name}</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {module.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Assets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Square3Stack3DIcon className="w-4 h-4" /> Recent Assets
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Vertices</th>
                <th className="pb-2 pr-4">Format</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {MOCK_ASSETS.slice(0, 4).map(asset => (
                <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{asset.name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{asset.category}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 font-mono">{formatNumber(asset.vertexCount)}</td>
                  <td className="py-2.5 pr-4"><TagBadge tag={asset.format.toUpperCase()} /></td>
                  <td className="py-2.5 text-gray-400 dark:text-gray-500">{asset.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Generate ──────────────────────────────────────────────────

function GenerateTab() {
  const [generatorType, setGeneratorType] = useState<string>('parametric')
  const [shape, setShape] = useState('sphere')
  const [lsystemPreset, setLsystemPreset] = useState('tree')
  const [textPrompt, setTextPrompt] = useState('')
  const [materialPreset, setMaterialPreset] = useState('metal')
  const [lightingStyle, setLightingStyle] = useState('studio_3point')
  const [animationTemplate, setAnimationTemplate] = useState('bounce')
  const [exportFormat, setExportFormat] = useState('GLB')

  return (
    <div className="space-y-6">
      {/* Generator Type Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Generator Type</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'parametric', label: 'Parametric', icon: CubeIcon },
            { id: 'noise', label: 'Noise Terrain', icon: SparklesIcon },
            { id: 'lsystem', label: 'L-System', icon: Square3Stack3DIcon },
            { id: 'text_to_3d', label: 'Text to 3D', icon: CpuChipIcon },
            { id: 'kitbash', label: 'Kitbash Building', icon: Cog6ToothIcon },
          ].map(gen => (
            <button
              key={gen.id}
              onClick={() => setGeneratorType(gen.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                generatorType === gen.id
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <gen.icon className="w-4 h-4" />
              {gen.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generator Config */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Configuration</h3>

          {generatorType === 'parametric' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shape</label>
              <div className="grid grid-cols-3 gap-2">
                {SHAPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setShape(opt.value)}
                    className={`px-3 py-2 rounded text-sm ${
                      shape === opt.value
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <InputField label="Segments" type="number" defaultValue={32} />
              <InputField label="Scale" type="number" defaultValue={1.0} step={0.1} />
            </div>
          )}

          {generatorType === 'noise' && (
            <div className="space-y-3">
              <InputField label="Size X" type="number" defaultValue={10} />
              <InputField label="Size Y" type="number" defaultValue={10} />
              <InputField label="Subdivisions" type="number" defaultValue={64} />
              <InputField label="Noise Scale" type="number" defaultValue={3.0} step={0.1} />
              <InputField label="Height Scale" type="number" defaultValue={2.0} step={0.1} />
              <InputField label="Octaves" type="number" defaultValue={6} />
              <InputField label="Seed" type="number" defaultValue={42} />
            </div>
          )}

          {generatorType === 'lsystem' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preset</label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLsystemPreset(opt.value)}
                    className={`px-3 py-2 rounded text-sm ${
                      lsystemPreset === opt.value
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <InputField label="Iterations" type="number" defaultValue={4} />
              <InputField label="Seed" type="number" defaultValue={42} />
            </div>
          )}

          {generatorType === 'text_to_3d' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</label>
              <textarea
                value={textPrompt}
                onChange={e => setTextPrompt(e.target.value)}
                placeholder="A medieval castle on a hilltop with towers and a drawbridge..."
                className="w-full h-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {generatorType === 'kitbash' && (
            <div className="space-y-3">
              <InputField label="Floors" type="number" defaultValue={2} />
              <InputField label="Width" type="number" defaultValue={4.0} step={0.5} />
              <InputField label="Depth" type="number" defaultValue={4.0} step={0.5} />
              <InputField label="Floor Height" type="number" defaultValue={3.0} step={0.5} />
              <InputField label="Windows" type="number" defaultValue={4} />
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-gray-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Roof</span>
              </div>
            </div>
          )}
        </div>

        {/* Material + Lighting + Animation + Export */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <PaintBrushIcon className="w-4 h-4" /> Material
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {MATERIAL_PRESETS.map(mat => (
                <button
                  key={mat}
                  onClick={() => setMaterialPreset(mat)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    materialPreset === mat
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {mat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <EyeIcon className="w-4 h-4" /> Lighting
            </h3>
            <div className="flex flex-wrap gap-2">
              {LIGHTING_STYLES.map(style => (
                <button
                  key={style}
                  onClick={() => setLightingStyle(style)}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    lightingStyle === style
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {style.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <FilmIcon className="w-4 h-4" /> Animation
            </h3>
            <div className="flex flex-wrap gap-2">
              {ANIMATION_TEMPLATES.map(tmpl => (
                <button
                  key={tmpl}
                  onClick={() => setAnimationTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    animationTemplate === tmpl
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {tmpl}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <FolderArrowDownIcon className="w-4 h-4" /> Export
            </h3>
            <div className="flex flex-wrap gap-2">
              {EXPORT_FORMATS.map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-3 py-1.5 rounded text-xs font-medium font-mono ${
                    exportFormat === fmt
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-purple-700 transition-all">
        <PlayIcon className="w-5 h-5" />
        Generate 3D Asset
      </button>
    </div>
  )
}

// ── Tab: Assets ────────────────────────────────────────────────────

function AssetsTab() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...new Set(MOCK_ASSETS.map(a => a.category))]
  const filteredAssets = MOCK_ASSETS.filter(asset => {
    const matchesSearch = !searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || asset.tags.some(t => t.includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Asset grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.map(asset => (
          <div key={asset.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
            {/* Placeholder preview */}
            <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <CubeIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{asset.name}</h4>
                <TagBadge tag={asset.format.toUpperCase()} />
              </div>
              <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatNumber(asset.vertexCount)} verts</span>
                <span>{formatNumber(asset.faceCount)} faces</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {asset.tags.map(tag => <TagBadge key={tag} tag={tag} />)}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400">{asset.createdAt}</span>
                <div className="flex gap-1.5">
                  <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500" title="Preview">
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500" title="Export">
                    <FolderArrowDownIcon className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500" title="Delete">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Pipeline Builder ──────────────────────────────────────────

function PipelineTab() {
  const [nodes] = useState([
    { id: 1, type: 'mesh_generator', label: 'Sphere Generator', x: 50, y: 50 },
    { id: 2, type: 'modifier', label: 'Subdivide', x: 280, y: 50 },
    { id: 3, type: 'material', label: 'Metal Material', x: 510, y: 50 },
    { id: 4, type: 'animation', label: 'Spin Animation', x: 510, y: 150 },
    { id: 5, type: 'validator', label: 'Mesh Validator', x: 740, y: 50 },
    { id: 6, type: 'export', label: 'Export GLB', x: 970, y: 50 },
  ])

  const nodeColors: Record<string, string> = {
    mesh_generator: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    modifier: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
    material: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20',
    animation: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
    validator: 'border-green-400 bg-green-50 dark:bg-green-900/20',
    export: 'border-teal-400 bg-teal-50 dark:bg-teal-900/20',
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mr-3">Add Node:</span>
        {['Generator', 'Modifier', 'Material', 'Animation', 'Validator', 'LOD', 'Export', 'Render'].map(type => (
          <button key={type} className="px-3 py-1.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            <PlusIcon className="w-3 h-3 inline mr-1" />{type}
          </button>
        ))}
        <div className="flex-1" />
        <button className="px-4 py-1.5 rounded text-xs font-medium bg-green-500 text-white hover:bg-green-600">
          <PlayIcon className="w-3 h-3 inline mr-1" />Execute Pipeline
        </button>
      </div>

      {/* Canvas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 min-h-[350px] relative overflow-x-auto">
        {/* Connection lines (simplified SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '1100px' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-gray-400 dark:fill-gray-500" />
            </marker>
          </defs>
          {[
            [210, 75, 280, 75],
            [440, 75, 510, 75],
            [440, 75, 510, 175],
            [670, 75, 740, 75],
            [670, 175, 740, 75],
            [900, 75, 970, 75],
          ].map(([x1, y1, x2, y2], index) => (
            <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2" className="text-gray-300 dark:text-gray-600" markerEnd="url(#arrow)" />
          ))}
        </svg>

        {/* Nodes */}
        <div className="relative" style={{ minWidth: '1100px', minHeight: '250px' }}>
          {nodes.map(node => (
            <div
              key={node.id}
              className={`absolute border-2 rounded-lg p-3 min-w-[160px] shadow-sm cursor-move ${nodeColors[node.type] || 'border-gray-300 bg-gray-50 dark:bg-gray-700'}`}
              style={{ left: node.x, top: node.y }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">{node.type.replace('_', ' ')}</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{node.label}</div>
              {/* Input/output dots */}
              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500 border-2 border-white dark:border-gray-800" />
              <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-400 border-2 border-white dark:border-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Jobs ──────────────────────────────────────────────────────

function JobsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total" value={MOCK_STATS.totalJobs} icon={ClockIcon} color="blue" size="sm" />
        <MetricCard title="Completed" value={MOCK_STATS.completedJobs} icon={CheckCircleIcon} color="green" size="sm" />
        <MetricCard title="Failed" value={MOCK_STATS.failedJobs} icon={ExclamationTriangleIcon} color="red" size="sm" />
        <MetricCard title="Active" value={MOCK_STATS.activeJobs} icon={ArrowPathIcon} color="yellow" size="sm" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800">
              <th className="px-5 py-3">Job</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Progress</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {MOCK_JOBS.map(job => (
              <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-gray-900 dark:text-white">{job.name}</div>
                  <div className="text-xs text-gray-400">{job.id}</div>
                </td>
                <td className="px-5 py-3.5"><TagBadge tag={job.type} /></td>
                <td className="px-5 py-3.5"><StatusBadge status={job.status} /></td>
                <td className="px-5 py-3.5 min-w-[180px]">
                  <ProgressBar
                    progress={job.progress}
                    color={job.status === 'failed' ? 'red' : job.status === 'completed' ? 'green' : 'blue'}
                  />
                </td>
                <td className="px-5 py-3.5 text-gray-400">{job.createdAt}</td>
                <td className="px-5 py-3.5">
                  {job.outputFiles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {job.outputFiles.map(file => <TagBadge key={file} tag={file} />)}
                    </div>
                  ) : job.error ? (
                    <span className="text-xs text-red-500">{job.error}</span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function InputField({ label, type = 'text', defaultValue, step }: { label: string; type?: string; defaultValue?: string | number; step?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        step={step}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

// ── Main Section Component ─────────────────────────────────────────

export function BlenderPipelineSection() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const TAB_CONTENT: Record<TabId, React.ReactNode> = {
    overview: <OverviewTab />,
    generate: <GenerateTab />,
    assets: <AssetsTab />,
    pipeline: <PipelineTab />,
    jobs: <JobsTab />,
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <CubeIcon className="w-6 h-6 text-white" />
            </div>
            Blender 3D Pipeline
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate, animate, and export 3D assets with procedural tools and LLM integration
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {TAB_CONTENT[activeTab]}
    </div>
  )
}
