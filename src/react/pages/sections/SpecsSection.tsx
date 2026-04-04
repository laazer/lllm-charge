import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DocumentTextIcon,
  ClockIcon,
  TagIcon,
  CheckCircleIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CodeBracketIcon,
  BeakerIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '../../lib/api-client'
import type { CodeGraphSymbol, SpecCleanupScanResult, SpecCleanupRunResult } from '../../lib/api-client'
import { DataTable } from '../../components/ui/Data/DataTable'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import { ReasoningButton } from '../../components/ui/ReasoningButton'
import { Modal, ModalBody, ModalFooter } from '../../components/ui/Modals/Modal'
import { KindBadge } from '../../components/ui/CodeGraph/KindBadge'
import { useProject } from '../../store/project-store'

interface LinkedSymbol {
  id: string
  name: string
  kind: string
  file: string
  line: number
}

type SpecType = 'feature' | 'spec' | 'task'

interface Spec {
  id: string
  title: string
  description?: string
  type?: SpecType
  parentId?: string | null
  status: 'draft' | 'active' | 'completed' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  createdAt: string
  updatedAt: string
  assignedAgent?: string
  projectId?: string
  linkedSymbols?: LinkedSymbol[]
  linkedTests?: LinkedSymbol[]
  linkedClasses?: string[]
  linkedMethods?: string[]
  comments?: any[]
}

interface SpecFormData {
  title: string
  description: string
  type: SpecType
  parentId: string | null
  status: Spec['status']
  priority: Spec['priority']
  tags: string
  linkedSymbols: LinkedSymbol[]
  linkedTests: LinkedSymbol[]
}

const EMPTY_FORM: SpecFormData = {
  title: '',
  description: '',
  type: 'spec',
  parentId: null,
  status: 'draft',
  priority: 'medium',
  tags: '',
  linkedSymbols: [],
  linkedTests: [],
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  feature: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  spec: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  task: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
}

/** Valid parent types for each spec type */
const VALID_PARENT_TYPES: Record<SpecType, SpecType[]> = {
  feature: [],          // Features have no parent
  spec: ['feature'],    // Specs belong to Features
  task: ['spec'],       // Tasks belong to Specs
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
  archived: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
}

const PRIORITY_CLASSES: Record<string, string> = {
  low: 'text-gray-700 dark:text-gray-300',
  medium: 'text-yellow-700 dark:text-yellow-400',
  high: 'text-orange-700 dark:text-orange-400',
  critical: 'text-red-700 dark:text-red-400',
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'

/**
 * Returns true if the file path looks like a test file.
 */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.[jt]sx?$/.test(filePath) || filePath.startsWith('tests/')
}

/**
 * Reusable symbol search picker with debounced CodeGraph search and removable chips.
 * Use `resultFilter` to restrict which symbols appear in results (e.g. only test files).
 */
function SymbolPicker({ selectedSymbols, onChange, label, icon: Icon, placeholder, resultFilter, searchKind }: {
  selectedSymbols: LinkedSymbol[]
  onChange: (symbols: LinkedSymbol[]) => void
  label: string
  icon: React.ComponentType<{ className?: string }>
  placeholder: string
  resultFilter?: (symbol: CodeGraphSymbol) => boolean
  searchKind?: string
}) {
  const [symbolQuery, setSymbolQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CodeGraphSymbol[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const searchSymbols = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setIsSearching(true)
    try {
      const results = await apiClient.searchCodeGraph(query, searchKind, 20)
      const selectedIds = new Set(selectedSymbols.map(s => s.id))
      let filtered = results.filter(r => !selectedIds.has(r.id))
      if (resultFilter) filtered = filtered.filter(resultFilter)
      setSearchResults(filtered.slice(0, 10))
      setShowDropdown(true)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [selectedSymbols, resultFilter, searchKind])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => searchSymbols(symbolQuery), 300)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [symbolQuery, searchSymbols])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addSymbol = (symbol: CodeGraphSymbol) => {
    const linked: LinkedSymbol = {
      id: symbol.id,
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
      line: symbol.line,
    }
    onChange([...selectedSymbols, linked])
    setSymbolQuery('')
    setShowDropdown(false)
    setSearchResults([])
  }

  const removeSymbol = (symbolId: string) => {
    onChange(selectedSymbols.filter(s => s.id !== symbolId))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <span className="flex items-center gap-1.5">
          <Icon className="w-4 h-4" />
          {label}
        </span>
      </label>

      {selectedSymbols.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedSymbols.map((symbol) => (
            <span key={symbol.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm">
              <KindBadge kind={symbol.kind} />
              <span className="font-medium text-gray-900 dark:text-gray-100">{symbol.name}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">{symbol.file}:{symbol.line}</span>
              <button
                type="button"
                onClick={() => removeSymbol(symbol.id)}
                className="ml-1 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className={`${INPUT_CLASS} pl-9`}
            value={symbolQuery}
            onChange={(e) => setSymbolQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
            placeholder={placeholder}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
            </div>
          )}
        </div>

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => addSymbol(result)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <KindBadge kind={result.kind} />
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{result.name}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto truncate">{result.file}:{result.line}</span>
              </button>
            ))}
          </div>
        )}

        {showDropdown && symbolQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm text-gray-500 dark:text-gray-400">
            No results found for "{symbolQuery}"
          </div>
        )}
      </div>
    </div>
  )
}

/** Filter that restricts results to test files only. */
const testFileFilter = (symbol: CodeGraphSymbol): boolean => isTestFile(symbol.file)

/** Filter that excludes test files (source code only). */
const sourceFileFilter = (symbol: CodeGraphSymbol): boolean => !isTestFile(symbol.file)

const SpecsSection: React.FC = () => {
  const { currentProjectId } = useProject()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [parentFilter, setParentFilter] = useState<string>('all')
  const [codeLinkedFilter, setCodeLinkedFilter] = useState<string>('all')
  const [testLinkedFilter, setTestLinkedFilter] = useState<string>('all')
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSpec, setEditingSpec] = useState<Spec | null>(null)
  const [formData, setFormData] = useState<SpecFormData>(EMPTY_FORM)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [cleanupScanResult, setCleanupScanResult] = useState<SpecCleanupScanResult | null>(null)
  const [cleanupRunResult, setCleanupRunResult] = useState<SpecCleanupRunResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRunningCleanup, setIsRunningCleanup] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await apiClient.syncCodeGraph()
    } catch (error) {
      console.error('CodeGraph sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSpecCleanupScan = async () => {
    setIsScanning(true)
    setCleanupRunResult(null)
    try {
      const result = await apiClient.scanSpecComments()
      setCleanupScanResult(result)
      setShowCleanupModal(true)
    } catch (error) {
      console.error('Spec cleanup scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleSpecCleanupRun = async () => {
    setIsRunningCleanup(true)
    try {
      const result = await apiClient.runSpecCleanup(false)
      setCleanupRunResult(result)
      setCleanupScanResult(null)
      invalidateSpecs()
    } catch (error) {
      console.error('Spec cleanup run failed:', error)
    } finally {
      setIsRunningCleanup(false)
    }
  }

  const closeCleanupModal = () => {
    setShowCleanupModal(false)
    setCleanupScanResult(null)
    setCleanupRunResult(null)
  }

  const specsQueryKey = ['specs', currentProjectId]

  const { data: specs = [], isLoading, error } = useQuery({
    queryKey: specsQueryKey,
    queryFn: () => apiClient.getSpecs(currentProjectId),
  })

  const invalidateSpecs = () => queryClient.invalidateQueries({ queryKey: specsQueryKey })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Spec>) => apiClient.createSpec(data),
    onSuccess: () => { invalidateSpecs(); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Spec> }) => apiClient.updateSpec(id, data),
    onSuccess: () => { invalidateSpecs(); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteSpec(id),
    onSuccess: () => { invalidateSpecs(); setDeleteConfirmId(null) },
  })

  const openCreateModal = () => {
    setEditingSpec(null)
    setFormData(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (spec: Spec) => {
    setEditingSpec(spec)
    setFormData({
      title: spec.title,
      description: spec.description || '',
      type: spec.type || 'spec',
      parentId: spec.parentId || null,
      status: spec.status,
      priority: spec.priority,
      tags: (spec.tags || []).join(', '),
      linkedSymbols: spec.linkedSymbols || [],
      linkedTests: spec.linkedTests || [],
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingSpec(null)
    setFormData(EMPTY_FORM)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!formData.title.trim()) return

    const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    const specPayload: Partial<Spec> = {
      title: formData.title,
      description: formData.description,
      type: formData.type,
      parentId: formData.parentId,
      status: formData.status,
      priority: formData.priority,
      tags,
      linkedSymbols: formData.linkedSymbols,
      linkedTests: formData.linkedTests,
      projectId: currentProjectId || undefined,
    }

    if (editingSpec) {
      updateMutation.mutate({ id: editingSpec.id, data: specPayload })
    } else {
      createMutation.mutate(specPayload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const features = specs.filter((s: Spec) => (s.type || 'spec') === 'feature')

  const activeFilterCount = [typeFilter, statusFilter, priorityFilter, parentFilter, codeLinkedFilter, testLinkedFilter]
    .filter(f => f !== 'all').length

  const filteredSpecs = specs.filter((spec: Spec) => {
    const matchesSearch =
      spec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spec.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (spec.tags || []).some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = typeFilter === 'all' || (spec.type || 'spec') === typeFilter
    const matchesStatus = statusFilter === 'all' || spec.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || spec.priority === priorityFilter
    const matchesParent = parentFilter === 'all' || spec.parentId === parentFilter ||
      (parentFilter === 'none' && !spec.parentId)
    const matchesCodeLinked = codeLinkedFilter === 'all' ||
      (codeLinkedFilter === 'yes' && (spec.linkedSymbols || []).length > 0) ||
      (codeLinkedFilter === 'no' && (spec.linkedSymbols || []).length === 0)
    const matchesTestLinked = testLinkedFilter === 'all' ||
      (testLinkedFilter === 'yes' && (spec.linkedTests || []).length > 0) ||
      (testLinkedFilter === 'no' && (spec.linkedTests || []).length === 0)
    return matchesSearch && matchesType && matchesStatus && matchesPriority && matchesParent && matchesCodeLinked && matchesTestLinked
  })

  const clearAllFilters = () => {
    setSearchTerm('')
    setTypeFilter('all')
    setStatusFilter('all')
    setPriorityFilter('all')
    setParentFilter('all')
    setCodeLinkedFilter('all')
    setTestLinkedFilter('all')
  }

  const toggleFeatureExpand = (specId: string) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev)
      if (next.has(specId)) next.delete(specId)
      else next.add(specId)
      return next
    })
  }

  /** Build hierarchical list: features first with children nested below them */
  const buildHierarchicalList = (specsList: Spec[]): Spec[] => {
    const topLevel = specsList.filter(s => !s.parentId)
    const childrenMap = new Map<string, Spec[]>()
    for (const spec of specsList) {
      if (spec.parentId) {
        const siblings = childrenMap.get(spec.parentId) || []
        siblings.push(spec)
        childrenMap.set(spec.parentId, siblings)
      }
    }

    const result: Spec[] = []
    for (const spec of topLevel) {
      result.push(spec)
      if (expandedFeatures.has(spec.id)) {
        const children = childrenMap.get(spec.id) || []
        for (const child of children) {
          result.push(child)
          if (expandedFeatures.has(child.id)) {
            const grandchildren = childrenMap.get(child.id) || []
            result.push(...grandchildren)
          }
        }
      }
    }
    return result
  }

  const hierarchicalSpecs = buildHierarchicalList(filteredSpecs)
  const hasChildren = (specId: string) => filteredSpecs.some(s => s.parentId === specId)

  /** Get valid parent options for the current form type */
  const getParentOptions = (): Spec[] => {
    const validParentTypes = VALID_PARENT_TYPES[formData.type]
    if (validParentTypes.length === 0) return []
    return specs.filter((s: Spec) => validParentTypes.includes((s.type || 'spec') as SpecType))
  }

  const stats = specs.reduce(
    (acc: Record<string, number>, spec: Spec) => {
      acc.total++
      acc[spec.status] = (acc[spec.status] || 0) + 1
      return acc
    },
    { total: 0, draft: 0, active: 0, completed: 0, archived: 0 }
  )

  const depthMap = new Map<string, number>()
  for (const spec of specs) {
    if (!spec.parentId) depthMap.set(spec.id, 0)
    else {
      const parentDepth = depthMap.get(spec.parentId) ?? 0
      depthMap.set(spec.id, parentDepth + 1)
    }
  }

  // Store raw sortable values; use render functions for JSX display
  const specsTableData = hierarchicalSpecs.map((spec: Spec) => ({
    id: spec.id,
    title: spec.title,
    description: spec.description || '',
    type: spec.type || 'spec',
    status: spec.status,
    priority: spec.priority,
    linkedCodeCount: (spec.linkedSymbols || []).length,
    linkedTestsCount: (spec.linkedTests || []).length,
    updated: spec.updatedAt,
    _spec: spec,
    _depth: depthMap.get(spec.id) || 0,
    _hasChildren: hasChildren(spec.id),
    _isExpanded: expandedFeatures.has(spec.id),
  }))

  const tableColumns = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (val: string) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${TYPE_BADGE_CLASSES[val] || ''}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Title & Description',
      sortable: true,
      render: (_val: string, row: any) => {
        const indent = (row._depth || 0) * 24
        return (
          <div className="flex items-start gap-2" style={{ paddingLeft: `${indent}px` }}>
            {row._hasChildren && (
              <button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleFeatureExpand(row.id) }}
                className="mt-1 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${row._isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {!row._hasChildren && row._depth > 0 && <div className="w-5 flex-shrink-0" />}
            <div className="flex flex-col min-w-0">
              <span className={`font-medium text-gray-900 dark:text-gray-100 ${row.type === 'feature' ? 'text-base' : 'text-sm'}`}>
                {row.title}
              </span>
              {row.description && (
                <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1 mt-0.5">
                  {row.description.length > 80 ? `${row.description.substring(0, 80)}...` : row.description}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[val] || ''}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (val: string) => (
        <span className={`font-medium capitalize ${PRIORITY_CLASSES[val] || ''}`}>{val}</span>
      ),
    },
    {
      key: 'linkedCodeCount',
      label: 'Linked Code',
      sortable: true,
      render: (_val: number, row: any) => {
        const symbols = row._spec?.linkedSymbols || []
        if (symbols.length === 0) return <span className="text-xs text-gray-400 italic">None</span>
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {symbols.slice(0, 2).map((sym: LinkedSymbol) => (
              <span key={sym.id} className="inline-flex items-center gap-1 text-xs">
                <KindBadge kind={sym.kind} />
                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[80px]">{sym.name}</span>
              </span>
            ))}
            {symbols.length > 2 && <span className="text-xs text-gray-500">+{symbols.length - 2}</span>}
          </div>
        )
      },
    },
    {
      key: 'linkedTestsCount',
      label: 'Tests',
      sortable: true,
      render: (_val: number, row: any) => {
        const tests = row._spec?.linkedTests || []
        if (tests.length === 0) return <span className="text-xs text-gray-400 italic">None</span>
        return (
          <div className="flex flex-wrap gap-1 items-center">
            {tests.slice(0, 1).map((test: LinkedSymbol) => (
              <span key={test.id} className="inline-flex items-center gap-1 text-xs">
                <BeakerIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[100px]">{test.name}</span>
              </span>
            ))}
            {tests.length > 1 && <span className="text-xs text-gray-500">+{tests.length - 1}</span>}
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_val: any, row: any) => (
        <div className="flex items-center gap-2" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <ReasoningButton
            prompt={`Analyze this specification and provide insights:\n\nTitle: ${row._spec.title}\n\nDescription: ${row._spec.description || 'No description'}\n\nStatus: ${row._spec.status}\nPriority: ${row._spec.priority}`}
            label="Analyze"
          />
          <button
            onClick={() => openEditModal(row._spec)}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Edit spec"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirmId(row.id)}
            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete spec"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
    {
      key: 'updated',
      label: 'Updated',
      sortable: true,
      render: (val: string) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {new Date(val).toLocaleDateString()}
        </span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-32" />
          ))}
        </div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg font-semibold mb-2">Failed to load specifications</div>
        <div className="text-gray-500">Please check your connection and try again.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatusCard title="Total Specs" value={stats.total} status="info" description="All specifications" icon={DocumentTextIcon} />
        <StatusCard title="Draft" value={stats.draft} status="pending" description="In development" icon={ClockIcon} />
        <StatusCard title="Active" value={stats.active} status="info" description="Currently active" icon={DocumentTextIcon} />
        <StatusCard title="Completed" value={stats.completed} status="success" description="Finished specs" icon={CheckCircleIcon} />
        <StatusCard title="Archived" value={stats.archived} status="warning" description="Archived items" icon={TagIcon} />
      </div>

      {/* Filters, Search, and Create Button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Specifications Management</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm transition-colors whitespace-nowrap"
              title="Re-sync CodeGraph index for symbol linking"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={handleSpecCleanupScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-3 py-2 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              title="Scan code comments for specs (FEATURE, TODO, SPEC, FIXME) and import them"
            >
              <SparklesIcon className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
              {isScanning ? 'Scanning...' : 'Spec Cleanup'}
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              <PlusIcon className="w-4 h-4" />
              New Spec
            </button>
          </div>
        </div>

        {/* Primary filters row */}
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <input
            type="text"
            placeholder="Search specs..."
            className={`${INPUT_CLASS} max-w-[200px]`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className={`${INPUT_CLASS} max-w-[120px]`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="feature">Feature</option>
            <option value="spec">Spec</option>
            <option value="task">Task</option>
          </select>
          <select className={`${INPUT_CLASS} max-w-[130px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <select className={`${INPUT_CLASS} max-w-[130px]`} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors whitespace-nowrap ${
              showAdvancedFilters || activeFilterCount > 0
                ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-blue-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Advanced filters row (collapsible) */}
        {showAdvancedFilters && (
          <div className="flex flex-wrap gap-3 items-center mb-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
            <select className={`${INPUT_CLASS} max-w-[160px]`} value={parentFilter} onChange={(e) => setParentFilter(e.target.value)}>
              <option value="all">All Parents</option>
              <option value="none">Top-level only</option>
              {features.map((f: Spec) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
            <select className={`${INPUT_CLASS} max-w-[140px]`} value={codeLinkedFilter} onChange={(e) => setCodeLinkedFilter(e.target.value)}>
              <option value="all">Code Links</option>
              <option value="yes">Has code links</option>
              <option value="no">No code links</option>
            </select>
            <select className={`${INPUT_CLASS} max-w-[140px]`} value={testLinkedFilter} onChange={(e) => setTestLinkedFilter(e.target.value)}>
              <option value="all">Test Links</option>
              <option value="yes">Has tests</option>
              <option value="no">No tests</option>
            </select>
          </div>
        )}

        <div className="mb-4">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Showing {filteredSpecs.length} of {specs.length} specifications
            {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
          </span>
        </div>

        <DataTable
          data={specsTableData}
          columns={tableColumns}
          searchTerm={searchTerm}
          onRowClick={(row) => {
            if (row._spec) openEditModal(row._spec)
          }}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingSpec ? 'Edit Specification' : 'New Specification'} size="xl">
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className={INPUT_CLASS}
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Specification title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  rows={4}
                  className={INPUT_CLASS}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the specification..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    className={INPUT_CLASS}
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value as SpecType
                      setFormData(prev => ({
                        ...prev,
                        type: newType,
                        parentId: VALID_PARENT_TYPES[newType].length === 0 ? null : prev.parentId,
                      }))
                    }}
                  >
                    <option value="feature">Feature</option>
                    <option value="spec">Spec</option>
                    <option value="task">Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent</label>
                  {VALID_PARENT_TYPES[formData.type].length === 0 ? (
                    <div className={`${INPUT_CLASS} text-gray-400 italic cursor-not-allowed`}>
                      Features have no parent
                    </div>
                  ) : (
                    <select
                      className={INPUT_CLASS}
                      value={formData.parentId || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value || null }))}
                    >
                      <option value="">No parent</option>
                      {getParentOptions().map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          [{(parent.type || 'spec').toUpperCase()}] {parent.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select className={INPUT_CLASS} value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Spec['status'] }))}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select className={INPUT_CLASS} value={formData.priority} onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Spec['priority'] }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="feature, api, documentation"
                />
              </div>

              {/* Code Symbol Picker */}
              <SymbolPicker
                selectedSymbols={formData.linkedSymbols}
                onChange={(symbols) => setFormData(prev => ({ ...prev, linkedSymbols: symbols }))}
                label="Linked Code Symbols"
                icon={CodeBracketIcon}
                placeholder="Search functions, classes, methods..."
                resultFilter={sourceFileFilter}
              />

              {/* Test Picker */}
              <SymbolPicker
                selectedSymbols={formData.linkedTests}
                onChange={(tests) => setFormData(prev => ({ ...prev, linkedTests: tests }))}
                label="Linked Tests (Acceptance Criteria)"
                icon={BeakerIcon}
                placeholder="Search test files and test functions..."
                resultFilter={testFileFilter}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSaving || !formData.title.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
                {isSaving ? 'Saving...' : editingSpec ? 'Update' : 'Create'}
              </button>
            </div>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Specification" size="sm">
        <ModalBody>
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this specification? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </ModalFooter>
      </Modal>
      {/* Spec Cleanup Preview Modal */}
      <Modal isOpen={showCleanupModal} onClose={closeCleanupModal} title="Spec Cleanup" size="xl" closeOnOverlayClick closeOnEscape>
        <ModalBody className="p-6 max-h-[70vh] overflow-y-auto">
          {cleanupRunResult ? (
            /* Results after running cleanup */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{cleanupRunResult.specsCreated}</div>
                  <div className="text-sm text-green-600 dark:text-green-300">Specs Created</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{cleanupRunResult.commentsRemoved}</div>
                  <div className="text-sm text-blue-600 dark:text-blue-300">Comments Removed</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{cleanupRunResult.filesModified}</div>
                  <div className="text-sm text-purple-600 dark:text-purple-300">Files Modified</div>
                </div>
              </div>

              {cleanupRunResult.specs.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Created Specs</h4>
                  <div className="space-y-2">
                    {cleanupRunResult.specs.map((spec, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{spec.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{spec.source}</div>
                        {spec.linkedSymbols.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {spec.linkedSymbols.map((symbol, symbolIndex) => (
                              <span key={symbolIndex} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {symbol}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cleanupRunResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">Errors</h4>
                  <div className="space-y-1">
                    {cleanupRunResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : cleanupScanResult ? (
            /* Preview of found spec comments */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div>
                  <div className="font-medium text-purple-800 dark:text-purple-200">
                    Found {cleanupScanResult.count} spec comment{cleanupScanResult.count !== 1 ? 's' : ''} in your code
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-300">
                    Review below, then click "Run Cleanup" to create specs and remove the comments.
                  </div>
                </div>
              </div>

              {cleanupScanResult.count === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="font-medium text-gray-900 dark:text-white">All clean!</p>
                  <p className="text-sm">No spec comments found in your source code.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cleanupScanResult.specs.map((spec, index) => {
                    const relativePath = spec.filePath.replace(/.*\/src\//, 'src/')
                    return (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              spec.tag === 'FIXME' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                              spec.tag === 'TODO' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                              spec.tag === 'FEATURE' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                              spec.tag === 'REQUIREMENT' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                              'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                            }`}>
                              {spec.tag}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{spec.content}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {relativePath}:{spec.lineNumber}
                        </div>
                        <div className="mt-2 bg-gray-900 dark:bg-gray-950 rounded p-2 overflow-x-auto">
                          <pre className="text-xs text-gray-300 whitespace-pre">{spec.surroundingCode}</pre>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <SparklesIcon className="w-12 h-12 mx-auto mb-3 animate-pulse" />
              <p>Scanning source files...</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-3">
            <button
              onClick={closeCleanupModal}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {cleanupRunResult ? 'Done' : 'Cancel'}
            </button>
            {cleanupScanResult && cleanupScanResult.count > 0 && !cleanupRunResult && (
              <button
                onClick={handleSpecCleanupRun}
                disabled={isRunningCleanup}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isRunningCleanup ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Running...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    Run Cleanup ({cleanupScanResult.count} spec{cleanupScanResult.count !== 1 ? 's' : ''})
                  </>
                )}
              </button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default SpecsSection
