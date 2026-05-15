import React, { useState, useCallback, useEffect } from 'react'
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
  BoltIcon,
  CommandLineIcon,
  DocumentArrowDownIcon,
  RocketLaunchIcon,
  BeakerIcon,
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
  // Enemy generation state (main feature from blender-experiments)
  const [enemyType, setEnemyType] = useState<string>('adhesion_bug')
  const [count, setCount] = useState<number>(1)
  const [seed, setSeed] = useState<number>(42)
  const [animationSet, setAnimationSet] = useState<string>('all')
  const [bodyType, setBodyType] = useState<string>('quadruped')
  
  // Advanced options
  const [prefabName, setPrefabName] = useState<string>('')
  const [difficulty, setDifficulty] = useState<string>('normal')
  const [smartDescription, setSmartDescription] = useState<string>('')
  const [exportStats, setExportStats] = useState<string>('json')
  const [useSmartGeneration, setUseSmartGeneration] = useState<boolean>(false)
  
  // UI state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [blenderStatus, setBlenderStatus] = useState<any>(null)
  
  // Check Blender system status on component mount
  useEffect(() => {
    const checkBlenderStatus = async () => {
      try {
        const response = await fetch('/api/blender/status')
        const status = await response.json()
        setBlenderStatus(status)
        console.log('Blender system status:', status)
      } catch (error) {
        console.error('Failed to check Blender status:', error)
      }
    }
    
    checkBlenderStatus()
  }, [])
  
  // Available options from blender-experiments
  const ENEMY_TYPES = [
    { id: 'adhesion_bug', name: 'Adhesion Bug', bodyType: 'quadruped', description: '6-legged creature with pounce attacks' },
    { id: 'tar_slug', name: 'Tar Slug', bodyType: 'blob', description: 'Squash/stretch blob with expansion slam' },
    { id: 'ember_imp', name: 'Ember Imp', bodyType: 'humanoid', description: 'Bipedal fire imp with punch attacks' },
  ]
  
  const ANIMATION_SETS = [
    { id: 'core', name: 'Core (5 anims)', description: 'idle, move, attack, damage, death' },
    { id: 'all', name: 'All (13 anims)', description: 'includes spawn, special_attack, stun, celebrate, taunt' },
  ]
  
  const DIFFICULTY_LEVELS = [
    { id: 'easy', name: 'Easy', color: 'text-green-600' },
    { id: 'normal', name: 'Normal', color: 'text-blue-600' },
    { id: 'hard', name: 'Hard', color: 'text-orange-600' },
    { id: 'nightmare', name: 'Nightmare', color: 'text-red-600' },
  ]

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const jobId = `job_${Date.now()}`
      setLastJobId(jobId)
      
      let response
      
      if (useSmartGeneration) {
        // Call smart generation API
        response = await fetch('/api/blender/generate/smart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: smartDescription,
            difficulty,
            exportStats,
          }),
        })
      } else {
        // Call direct enemy generation API  
        response = await fetch('/api/blender/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enemyType,
            count,
            seed,
            animationSet,
          }),
        })
      }
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Generation failed')
      }
      
      // Success! Log the results and show user feedback
      console.log('✅ Blender generation completed:', result)
      
      if (result.generatedFiles && result.generatedFiles.length > 0) {
        console.log('Generated files:', result.generatedFiles)
        // You could show a success toast notification here
        alert(`Generation complete! Created ${result.generatedFiles.length} files:\n${result.generatedFiles.map(f => f.filename).join('\n')}`)
      } else {
        console.log('Generation command output:', result.output)
        alert('Generation completed successfully!')
      }
      
    } catch (error) {
      console.error('❌ Generation failed:', error)
      alert(`Generation failed: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Generation Mode Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <BoltIcon className="w-4 h-4" /> Generation Mode
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setUseSmartGeneration(false)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              !useSmartGeneration
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <CommandLineIcon className="w-4 h-4" />
            Direct Enemy Generation
          </button>
          <button
            onClick={() => setUseSmartGeneration(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              useSmartGeneration
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <BeakerIcon className="w-4 h-4" />
            AI-Assisted Smart Generation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enemy Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          {!useSmartGeneration ? (
            <>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <CubeIcon className="w-4 h-4" /> Enemy Configuration
              </h3>
              
              {/* Enemy Type Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Enemy Type</label>
                <div className="space-y-2">
                  {ENEMY_TYPES.map(enemy => (
                    <button
                      key={enemy.id}
                      onClick={() => {
                        setEnemyType(enemy.id)
                        setBodyType(enemy.bodyType)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        enemyType === enemy.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300 dark:ring-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{enemy.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{enemy.description}</div>
                        </div>
                        <span className="text-xs font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                          {enemy.bodyType}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count and Seed */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Count</label>
                  <input
                    type="number"
                    value={count}
                    onChange={e => setCount(parseInt(e.target.value) || 1)}
                    min={1}
                    max={10}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Seed</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={e => setSeed(parseInt(e.target.value) || 42)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Animation Set */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Animation Set</label>
                <div className="space-y-2">
                  {ANIMATION_SETS.map(animSet => (
                    <button
                      key={animSet.id}
                      onClick={() => setAnimationSet(animSet.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                        animationSet === animSet.id
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 ring-1 ring-green-300 dark:ring-green-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{animSet.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{animSet.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prefab Integration */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prefab Model (Optional)</label>
                <input
                  type="text"
                  value={prefabName}
                  onChange={e => setPrefabName(e.target.value)}
                  placeholder="e.g., dragon, warrior, spider"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">Import FBX/GLB/OBJ and enhance with animations</p>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <BeakerIcon className="w-4 h-4" /> AI-Assisted Generation
              </h3>
              
              {/* Smart Description */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Enemy Description</label>
                <textarea
                  value={smartDescription}
                  onChange={e => setSmartDescription(e.target.value)}
                  placeholder="large fire spider with powerful attacks and glowing eyes..."
                  className="w-full h-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">AI will generate appropriate enemy type, materials, and animations</p>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Difficulty Level</label>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTY_LEVELS.map(diff => (
                    <button
                      key={diff.id}
                      onClick={() => setDifficulty(diff.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        difficulty === diff.id
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span className={difficulty === diff.id ? 'text-purple-700 dark:text-purple-300' : diff.color}>
                        {diff.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Stats Format */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Export Stats Format</label>
                <div className="flex gap-2">
                  {['json', 'godot'].map(format => (
                    <button
                      key={format}
                      onClick={() => setExportStats(format)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        exportStats === format
                          ? 'bg-teal-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions & Live Preview */}
        <div className="space-y-4">
          {/* Generation Progress */}
          {isGenerating && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Generating Enemy...</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {useSmartGeneration ? 'AI analyzing description...' : `Creating ${enemyType} (${count} variants)`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
              <RocketLaunchIcon className="w-4 h-4" /> Quick Actions
            </h3>
            
            <div className="space-y-3">
              {/* Quick Generate Buttons */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    setCount(1)
                    setSeed(Math.floor(Math.random() * 1000))
                    handleGenerate()
                  }}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-all"
                >
                  <BoltIcon className="w-4 h-4" />
                  Quick Generate (Random Seed)
                </button>
                
                <button
                  onClick={() => {
                    setCount(3)
                    handleGenerate()
                  }}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-all"
                >
                  <Square3Stack3DIcon className="w-4 h-4" />
                  Generate 3 Variants
                </button>
              </div>

              {/* Parameter Randomizers */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Quick Tweaks</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSeed(Math.floor(Math.random() * 1000))}
                    className="px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-all"
                  >
                    Randomize Seed
                  </button>
                  <button
                    onClick={() => {
                      const types = ENEMY_TYPES
                      const randomType = types[Math.floor(Math.random() * types.length)]
                      setEnemyType(randomType.id)
                      setBodyType(randomType.bodyType)
                    }}
                    className="px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-all"
                  >
                    Random Type
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CLI Command Preview */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center gap-2">
              <CommandLineIcon className="w-4 h-4" /> CLI Command Preview
            </h4>
            <div className="font-mono text-xs text-green-400 bg-gray-800 rounded px-3 py-2 overflow-x-auto">
              {useSmartGeneration ? (
                `python main.py smart --description "${smartDescription || '[description]'}" --difficulty ${difficulty} --export-stats ${exportStats}`
              ) : (
                `python main.py animated ${enemyType} ${count} ${seed}${animationSet !== 'all' ? ` --animation-set ${animationSet}` : ''}${prefabName ? ` --prefab ${prefabName}` : ''}`
              )}
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
              <DocumentArrowDownIcon className="w-4 h-4" /> Export Options
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Combat Data</span>
                <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-gray-600" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Generate Thumbnails</span>
                <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-gray-600" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Optimize for Godot</span>
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
              </div>
            </div>
          </div>

          {/* Last Generation Result */}
          {lastJobId && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4" /> Generation Complete
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Job {lastJobId} finished successfully. Files exported to animated_exports/
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <button 
        onClick={handleGenerate}
        disabled={isGenerating || (useSmartGeneration && !smartDescription.trim())}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Generating...
          </>
        ) : (
          <>
            <PlayIcon className="w-5 h-5" />
            {useSmartGeneration ? 'Generate with AI' : 'Generate Enemy'}
          </>
        )}
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
