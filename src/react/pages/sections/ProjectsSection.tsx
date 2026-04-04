import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FolderIcon,
  FolderArrowDownIcon,
  UserIcon,
  ClockIcon,
  CodeBracketIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  BoltIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '../../lib/api-client'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { MetricCard } from '../../components/ui/Cards/MetricCard'
import { Modal, ModalBody, ModalFooter } from '../../components/ui/Modals/Modal'
import { useProject } from '../../store/project-store'

interface Project {
  id: string
  name: string
  description?: string
  key: string
  type: 'software' | 'research' | 'demo' | 'infrastructure'
  lead: string
  codeGraphPath?: string
  createdAt: string
  updatedAt: string
  agentConfig?: {
    claudeMdPath?: string
    agentMdPath?: string
    skillsDir?: string
    agentsDir?: string
    workflowsDir?: string
  }
  stats?: {
    specsCount: number
    agentsCount: number
    workflowsCount: number
    notesCount: number
  }
}

const PROJECT_TYPES = ['software', 'research', 'demo', 'infrastructure'] as const
type ProjectType = typeof PROJECT_TYPES[number]

interface ProjectFormState {
  name: string
  description: string
  key: string
  type: ProjectType
  lead: string
  codeGraphPath: string
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  description: '',
  key: '',
  type: 'software',
  lead: '',
  codeGraphPath: '',
}

function buildFormFromProject(project: Project): ProjectFormState {
  return {
    name: project.name,
    description: project.description || '',
    key: project.key,
    type: project.type,
    lead: project.lead,
    codeGraphPath: project.codeGraphPath || '',
  }
}

function generateProjectKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 8)
}

function ProjectFormModal({
  title,
  initialForm,
  isOpen,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string
  initialForm: ProjectFormState
  isOpen: boolean
  onClose: () => void
  onSubmit: (form: ProjectFormState) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState<ProjectFormState>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoKey, setAutoKey] = useState(!initialForm.key)

  const handleFieldChange = (field: keyof ProjectFormState, value: string) => {
    setForm(previous => {
      const next = { ...previous, [field]: value }
      if (field === 'name' && autoKey) {
        next.key = generateProjectKey(value)
      }
      if (field === 'key') {
        setAutoKey(false)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (error) {
      console.error('Failed to submit project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClassName = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
    focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`

  const labelClassName = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className={labelClassName}>Project Name</label>
            <input
              type="text"
              value={form.name}
              onChange={event => handleFieldChange('name', event.target.value)}
              placeholder="My Awesome Project"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Key</label>
              <input
                type="text"
                value={form.key}
                onChange={event => handleFieldChange('key', event.target.value.toUpperCase())}
                placeholder="PROJ"
                maxLength={12}
                className={`${inputClassName} font-mono`}
              />
              <p className="text-xs text-gray-400 mt-1">Auto-generated from name</p>
            </div>
            <div>
              <label className={labelClassName}>Type</label>
              <select
                value={form.type}
                onChange={event => handleFieldChange('type', event.target.value)}
                className={inputClassName}
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClassName}>Description</label>
            <textarea
              value={form.description}
              onChange={event => handleFieldChange('description', event.target.value)}
              rows={3}
              placeholder="What is this project about?"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Lead</label>
            <input
              type="text"
              value={form.lead}
              onChange={event => handleFieldChange('lead', event.target.value)}
              placeholder="Project lead name"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>CodeGraph Path (optional)</label>
            <input
              type="text"
              value={form.codeGraphPath}
              onChange={event => handleFieldChange('codeGraphPath', event.target.value)}
              placeholder="/path/to/.codegraph"
              className={`${inputClassName} font-mono`}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

function DeleteConfirmModal({
  projectName,
  isOpen,
  onClose,
  onConfirm,
}: {
  projectName: string
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Failed to delete project:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project" size="sm">
      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to delete <strong>{projectName}</strong>? This will not delete associated specs, agents, or workflows, but the project itself will be removed.
        </p>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

interface BrowseResult {
  current: string
  parent: string | null
  directories: Array<{ name: string; path: string }>
}

interface ScanResult {
  path: string
  detected: {
    name: string
    description: string
    type: string
    lead: string
    codeGraphPath: string | null
    agentConfig: Record<string, string>
  }
}

function DirectoryBrowser({
  onSelect,
}: {
  onSelect: (directoryPath: string) => void
}) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)

  const browse = async (directoryPath?: string) => {
    setIsLoading(true)
    setBrowseError(null)
    try {
      const result = await apiClient.browseDirectories(directoryPath)
      setBrowseData(result)
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : 'Failed to browse directory')
    } finally {
      setIsLoading(false)
    }
  }

  // Load home directory on mount
  React.useEffect(() => {
    browse()
  }, [])

  if (browseError) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-700 dark:text-red-400">{browseError}</p>
        <button onClick={() => browse()} className="text-xs text-red-600 dark:text-red-400 underline mt-1">
          Retry from home
        </button>
      </div>
    )
  }

  if (isLoading && !browseData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!browseData) return null

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Current path header */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600
                    flex items-center justify-between">
        <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">
          {browseData.current}
        </span>
        <button
          onClick={() => onSelect(browseData.current)}
          className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20
                   hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors whitespace-nowrap"
        >
          Select this folder
        </button>
      </div>

      {/* Directory listing */}
      <div className="max-h-48 overflow-y-auto">
        {browseData.parent && (
          <button
            onClick={() => browse(browseData.parent!)}
            disabled={isLoading}
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left
                     hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                     border-b border-gray-100 dark:border-gray-700"
          >
            <span className="text-gray-400">..</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Parent directory</span>
          </button>
        )}
        {browseData.directories.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            No subdirectories
          </div>
        )}
        {browseData.directories.map(directory => (
          <button
            key={directory.path}
            onClick={() => browse(directory.path)}
            disabled={isLoading}
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left
                     hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                     border-b border-gray-100 dark:border-gray-700 last:border-b-0"
          >
            <FolderIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white truncate">{directory.name}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}

function ImportProjectModal({
  isOpen,
  onClose,
  onImport,
}: {
  isOpen: boolean
  onClose: () => void
  onImport: (form: ProjectFormState, agentConfig: Record<string, string>) => Promise<void>
}) {
  const [projectPath, setProjectPath] = useState('')
  const [showBrowser, setShowBrowser] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleScan = async (pathToScan?: string) => {
    const target = pathToScan || projectPath.trim()
    if (!target) return
    setIsScanning(true)
    setScanError(null)
    setScanResult(null)
    try {
      const result = await apiClient.scanProjectPath(target)
      setScanResult(result)
      setProjectPath(result.path)
      setShowBrowser(false)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to scan path')
    } finally {
      setIsScanning(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') handleScan()
  }

  const handleBrowserSelect = (selectedPath: string) => {
    setProjectPath(selectedPath)
    handleScan(selectedPath)
  }

  const handleImport = async () => {
    if (!scanResult) return
    setIsImporting(true)
    try {
      const { detected } = scanResult
      await onImport(
        {
          name: detected.name,
          description: detected.description,
          key: generateProjectKey(detected.name),
          type: detected.type as ProjectType,
          lead: detected.lead,
          codeGraphPath: scanResult.path,
        },
        detected.agentConfig,
      )
      onClose()
    } catch (error) {
      console.error('Failed to import project:', error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = () => {
    setScanResult(null)
    setScanError(null)
    setShowBrowser(true)
  }

  const inputClassName = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
    focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Existing Project" size="lg">
      <ModalBody>
        <div className="space-y-4">
          {/* Path input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Directory Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectPath}
                onChange={event => { setProjectPath(event.target.value); if (scanResult) handleReset() }}
                onKeyDown={handleKeyDown}
                placeholder="/Users/you/workspace/my-project"
                className={`${inputClassName} font-mono`}
              />
              <button
                onClick={() => setShowBrowser(!showBrowser)}
                className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${showBrowser
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                title="Toggle directory browser"
              >
                <FolderIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleScan()}
                disabled={isScanning || !projectPath.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                         rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
              </button>
            </div>
          </div>

          {/* Directory browser */}
          {showBrowser && !scanResult && (
            <DirectoryBrowser onSelect={handleBrowserSelect} />
          )}

          {/* Error */}
          {scanError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{scanError}</p>
            </div>
          )}

          {/* Scan results */}
          {scanResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-400 mb-1">Project detected</p>
                  <p className="text-xs text-green-600 dark:text-green-500 font-mono">{scanResult.path}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-green-600 dark:text-green-400 hover:underline whitespace-nowrap ml-3"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Name:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{scanResult.detected.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Type:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">{scanResult.detected.type}</span>
                </div>
                {scanResult.detected.description && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Description:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{scanResult.detected.description}</span>
                  </div>
                )}
                {scanResult.detected.lead && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Author:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{scanResult.detected.lead}</span>
                  </div>
                )}
              </div>

              {/* Detected paths */}
              {(scanResult.detected.codeGraphPath || Object.keys(scanResult.detected.agentConfig).length > 0) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Detected Paths</p>
                  <div className="space-y-1 text-xs font-mono">
                    {scanResult.detected.codeGraphPath && (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-400">CodeGraph</span>
                        <span className="text-gray-600 dark:text-gray-400 truncate">{scanResult.detected.codeGraphPath}</span>
                      </div>
                    )}
                    {Object.entries(scanResult.detected.agentConfig).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400 capitalize">
                          {key.replace(/Path$|Dir$/, '')}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!scanResult || isImporting}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <FolderArrowDownIcon className="h-4 w-4" />
            <span>{isImporting ? 'Importing...' : 'Import Project'}</span>
          </button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

const TYPE_COLORS: Record<string, string> = {
  software: 'blue',
  research: 'purple',
  demo: 'green',
  infrastructure: 'orange',
}

function getProjectTypeColor(type: string): string {
  return TYPE_COLORS[type] || 'gray'
}

function getProjectTypeIcon(type: string) {
  return type === 'software' ? CodeBracketIcon : FolderIcon
}

const ProjectsSection: React.FC = () => {
  const queryClient = useQueryClient()
  const { currentProjectId, setCurrentProjectId } = useProject()

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [isImportingSamples, setIsImportingSamples] = useState(false)
  const [importSamplesResult, setImportSamplesResult] = useState<any>(null)
  const [scaffoldProject, setScaffoldProject] = useState<Project | null>(null)
  const [scaffoldInput, setScaffoldInput] = useState('')
  const [isScaffolding, setIsScaffolding] = useState(false)
  const [scaffoldResult, setScaffoldResult] = useState<string | null>(null)

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  })

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = !searchTerm ||
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.key.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === 'all' || project.type === typeFilter

    return matchesSearch && matchesType
  })

  // Calculate statistics
  const overallStats = projects.reduce(
    (accumulator, project) => {
      accumulator.totalProjects++
      if (project.stats) {
        accumulator.totalSpecs += project.stats.specsCount || 0
        accumulator.totalAgents += project.stats.agentsCount || 0
      }
      return accumulator
    },
    { totalProjects: 0, totalSpecs: 0, totalAgents: 0 }
  )

  // Handlers
  const handleCreateProject = async (form: ProjectFormState) => {
    await apiClient.createProject({
      name: form.name,
      description: form.description,
      key: form.key || generateProjectKey(form.name),
      type: form.type,
      lead: form.lead,
      codeGraphPath: form.codeGraphPath || null,
    } as any)
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const handleUpdateProject = async (form: ProjectFormState) => {
    if (!editingProject) return
    await apiClient.updateProject(editingProject.id, {
      name: form.name,
      description: form.description,
      key: form.key,
      type: form.type,
      lead: form.lead,
      codeGraphPath: form.codeGraphPath || null,
    } as any)
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const handleDeleteProject = async (projectId: string) => {
    await apiClient.deleteProject(projectId)
    if (currentProjectId === projectId && projects.length > 1) {
      const remaining = projects.find(project => project.id !== projectId)
      if (remaining) {
        handleLoadProject(remaining.id)
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const handleImportSamples = async () => {
    setIsImportingSamples(true)
    setImportSamplesResult(null)
    try {
      const response = await fetch('/api/projects/import-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: true, analyze: false }),
      })
      const result = await response.json()
      setImportSamplesResult(result)
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (error) {
      setImportSamplesResult({ success: false, error: 'Request failed' })
    } finally {
      setIsImportingSamples(false)
    }
  }

  const handleScaffoldFeature = async () => {
    if (!scaffoldProject || !scaffoldInput.trim() || isScaffolding) return
    setIsScaffolding(true)
    setScaffoldResult(null)
    try {
      const response = await fetch('/mcp/call/scaffold_feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: scaffoldProject.codeGraphPath || '',
          featureDescription: scaffoldInput.trim(),
          language: (scaffoldProject as any).data?.language || 'typescript',
        }),
      })
      const data = await response.json()
      setScaffoldResult(typeof data.plan === 'string' ? data.plan : JSON.stringify(data.plan, null, 2))
    } catch (error) {
      setScaffoldResult('Scaffold request failed. Make sure the server is running.')
    } finally {
      setIsScaffolding(false)
    }
  }

  const handleLoadProject = (projectId: string) => {
    setCurrentProjectId(projectId)
    window.dispatchEvent(new CustomEvent('projectChange', { detail: { projectId } }))
  }

  const handleImportProject = async (form: ProjectFormState, agentConfig: Record<string, string>) => {
    const created = await apiClient.createProject({
      name: form.name,
      description: form.description,
      key: form.key || generateProjectKey(form.name),
      type: form.type,
      lead: form.lead,
      codeGraphPath: form.codeGraphPath || null,
      agentConfig,
    } as any)
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
    if (created?.id) {
      handleLoadProject(created.id)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-32" />
          ))}
        </div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg font-semibold mb-2">Failed to load projects</div>
        <div className="text-gray-500">Please check your connection and try again.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Total Projects"
          value={overallStats.totalProjects}
          status="info"
          description="All projects"
          icon={FolderIcon}
        />
        <MetricCard
          title="Total Specs"
          value={overallStats.totalSpecs}
          color="blue"
          size="sm"
          unit=""
          change={{ value: 0, period: 'overall' }}
        />
        <MetricCard
          title="Total Agents"
          value={overallStats.totalAgents}
          color="green"
          size="sm"
          unit=""
          change={{ value: 0, period: 'overall' }}
        />
      </div>

      {/* Toolbar: Search, Filter, Create */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <input
            type="text"
            placeholder="Search projects by name, description, or key..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={typeFilter}
            onChange={event => setTypeFilter(event.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {PROJECT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 border border-blue-600 text-blue-600
                   dark:text-blue-400 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                   rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          <FolderArrowDownIcon className="h-5 w-5" />
          <span>Import</span>
        </button>
        <button
          onClick={handleImportSamples}
          disabled={isImportingSamples}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300
                   disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {isImportingSamples ? (
            <><ArrowPathIcon className="h-5 w-5 animate-spin" /><span>Importing...</span></>
          ) : (
            <><BeakerIcon className="h-5 w-5" /><span>Import Samples</span></>
          )}
        </button>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                   rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {projects.length === 0 ? 'No projects yet' : 'No projects match your search'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {projects.length === 0
              ? 'Create your first project to get started.'
              : 'Try adjusting your search terms or type filter.'}
          </p>
          {projects.length === 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const TypeIcon = getProjectTypeIcon(project.type)
            const typeColor = getProjectTypeColor(project.type)
            const isCurrentProject = currentProjectId === project.id
            const isExpanded = expandedProjectId === project.id

            return (
              <div
                key={project.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow border-2 transition-all duration-200
                  ${isCurrentProject
                    ? 'border-green-500 ring-2 ring-green-200 dark:ring-green-800'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <div className="p-6">
                  {/* Header: title + actions */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg bg-${typeColor}-100 dark:bg-${typeColor}-800/20`}>
                          <TypeIcon className={`h-6 w-6 text-${typeColor}-600 dark:text-${typeColor}-400`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                              {project.name}
                            </h3>
                            {isCurrentProject && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                                             bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm font-mono text-gray-500 dark:text-gray-400">{project.key}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize
                              bg-${typeColor}-100 text-${typeColor}-800 dark:bg-${typeColor}-800/20 dark:text-${typeColor}-400`}>
                              {project.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {!isCurrentProject && (
                        <button
                          onClick={() => handleLoadProject(project.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50
                                   dark:hover:bg-green-900/20 transition-colors"
                          title="Load this project"
                          aria-label={`Load ${project.name}`}
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={event => { event.stopPropagation(); setScaffoldProject(project); setScaffoldInput(''); setScaffoldResult(null) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50
                                 dark:hover:bg-yellow-900/20 transition-colors"
                        aria-label={`Scaffold feature for ${project.name}`}
                        title="Scaffold Feature"
                      >
                        <SparklesIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={event => { event.stopPropagation(); setEditingProject(project) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50
                                 dark:hover:bg-blue-900/20 transition-colors"
                        aria-label={`Edit ${project.name}`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={event => { event.stopPropagation(); setDeletingProject(project) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50
                                 dark:hover:bg-red-900/20 transition-colors"
                        aria-label={`Delete ${project.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                      {project.description}
                    </p>
                  )}

                  {/* Lead */}
                  {project.lead && (
                    <div className="flex items-center space-x-2 mb-4">
                      <UserIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Lead: {project.lead}</span>
                    </div>
                  )}

                  {/* Stats */}
                  {project.stats && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{project.stats.specsCount}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Specs</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <div className="font-semibold text-green-600 dark:text-green-400">{project.stats.agentsCount}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Agents</div>
                      </div>
                    </div>
                  )}

                  {/* CodeGraph Path */}
                  {project.codeGraphPath && (
                    <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <CodeBracketIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                        {project.codeGraphPath}
                      </span>
                    </div>
                  )}

                  {/* Updated */}
                  <div className="flex items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Expanded: Agent Config */}
                {isExpanded && project.agentConfig && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700/50">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Agent Configuration</h4>
                    <div className="space-y-2 text-sm">
                      {project.agentConfig.claudeMdPath && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Claude MD:</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">{project.agentConfig.claudeMdPath}</span>
                        </div>
                      )}
                      {project.agentConfig.agentMdPath && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Agent MD:</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">{project.agentConfig.agentMdPath}</span>
                        </div>
                      )}
                      {project.agentConfig.skillsDir && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Skills:</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">{project.agentConfig.skillsDir}</span>
                        </div>
                      )}
                      {project.agentConfig.agentsDir && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Agents:</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">{project.agentConfig.agentsDir}</span>
                        </div>
                      )}
                      {project.agentConfig.workflowsDir && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Workflows:</span>
                          <span className="font-mono text-gray-800 dark:text-gray-200">{project.agentConfig.workflowsDir}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportProjectModal
          isOpen={true}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportProject}
        />
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <ProjectFormModal
          title="Create New Project"
          initialForm={EMPTY_PROJECT_FORM}
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateProject}
          submitLabel="Create Project"
        />
      )}

      {/* Edit Modal */}
      {editingProject && (
        <ProjectFormModal
          title="Edit Project"
          initialForm={buildFormFromProject(editingProject)}
          isOpen={true}
          onClose={() => setEditingProject(null)}
          onSubmit={handleUpdateProject}
          submitLabel="Save Changes"
        />
      )}

      {/* Delete Confirm */}
      {deletingProject && (
        <DeleteConfirmModal
          projectName={deletingProject.name}
          isOpen={true}
          onClose={() => setDeletingProject(null)}
          onConfirm={() => handleDeleteProject(deletingProject.id)}
        />
      )}

      {/* Import Samples Result */}
      <Modal isOpen={!!importSamplesResult} onClose={() => setImportSamplesResult(null)} title="Sample Projects Import" size="md">
        <ModalBody>
          {importSamplesResult && (
            <div className="space-y-3">
              {importSamplesResult.success ? (
                <>
                  {importSamplesResult.imported?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Imported ({importSamplesResult.imported.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {importSamplesResult.imported.map((name: string) => (
                          <span key={name} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded text-xs">{name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {importSamplesResult.skipped?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Skipped ({importSamplesResult.skipped.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {importSamplesResult.skipped.map((name: string) => (
                          <span key={name} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs">{name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {importSamplesResult.indexed?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Indexed with CodeGraph ({importSamplesResult.indexed.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {importSamplesResult.indexed.map((name: string) => (
                          <span key={name} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded text-xs">{name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {importSamplesResult.errors?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Errors ({importSamplesResult.errors.length})</h4>
                      {importSamplesResult.errors.map((err: string, i: number) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400">{err}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-600">{importSamplesResult.error || 'Import failed'}</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end">
            <button onClick={() => setImportSamplesResult(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Close
            </button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Scaffold Feature Modal */}
      <Modal isOpen={!!scaffoldProject} onClose={() => setScaffoldProject(null)} title={`Scaffold Feature — ${scaffoldProject?.name || ''}`} size="xl">
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Feature Description</label>
              <textarea
                value={scaffoldInput}
                onChange={(e) => setScaffoldInput(e.target.value)}
                placeholder="Describe the feature you want to add... e.g., 'add dark mode toggle', 'add user authentication', 'add search functionality'"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleScaffoldFeature() }}
              />
            </div>
            <button
              onClick={handleScaffoldFeature}
              disabled={!scaffoldInput.trim() || isScaffolding}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600
                       disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isScaffolding ? (
                <><ArrowPathIcon className="h-4 w-4 animate-spin" /><span>Generating plan...</span></>
              ) : (
                <><SparklesIcon className="h-4 w-4" /><span>Generate Implementation Plan</span></>
              )}
            </button>
            {scaffoldResult && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Implementation Plan</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200
                             whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed">
                  {scaffoldResult}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end">
            <button onClick={() => setScaffoldProject(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Close
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default ProjectsSection
