import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AcademicCapIcon,
  TagIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { apiClient } from '../../lib/api-client'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Modal, ModalBody, ModalFooter } from '../../components/ui/Modals/Modal'
import { useProject } from '../../store/project-store'

interface Skill {
  id: string
  title: string
  description?: string
  category: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

const SKILL_CATEGORIES = ['documentation', 'analysis', 'integration', 'optimization', 'automation', 'general'] as const

interface SkillEditFormState {
  title: string
  description: string
  category: string
  tags: string
}

function buildEditFormFromSkill(skill: Skill): SkillEditFormState {
  return {
    title: skill.title,
    description: skill.description || '',
    category: skill.category,
    tags: skill.tags?.join(', ') || '',
  }
}

function SkillEditModal({
  skill,
  isOpen,
  onClose,
  onSave
}: {
  skill: Skill
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>
}) {
  const [form, setForm] = useState<SkillEditFormState>(buildEditFormFromSkill(skill))
  const [isSaving, setIsSaving] = useState(false)

  const handleFieldChange = (field: keyof SkillEditFormState, value: string) => {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const parsedTags = form.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      // Ensure category tag is included
      if (form.category !== 'general' && !parsedTags.includes(form.category)) {
        parsedTags.push(form.category)
      }
      if (!parsedTags.some(tag => tag.includes('skill') || tag.includes('capability'))) {
        parsedTags.push('skill')
      }

      await onSave(skill.id, {
        title: form.title,
        description: form.description,
        data: { tags: parsedTags },
      })
      onClose()
    } catch (error) {
      console.error('Failed to save skill:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const inputClassName = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
    focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`

  const labelClassName = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Skill" size="lg">
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className={labelClassName}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={event => handleFieldChange('title', event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Description</label>
            <textarea
              value={form.description}
              onChange={event => handleFieldChange('description', event.target.value)}
              rows={4}
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Category</label>
            <select
              value={form.category}
              onChange={event => handleFieldChange('category', event.target.value)}
              className={inputClassName}
            >
              {SKILL_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClassName}>Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={event => handleFieldChange('tags', event.target.value)}
              placeholder="skill, documentation, cost-optimization"
              className={inputClassName}
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
            onClick={handleSave}
            disabled={isSaving || !form.title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

function DeleteConfirmModal({
  skillTitle,
  isOpen,
  onClose,
  onConfirm,
}: {
  skillTitle: string
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
      console.error('Failed to delete skill:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Skill" size="sm">
      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to delete <strong>{skillTitle}</strong>? This action cannot be undone.
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

const CATEGORY_COLORS: Record<string, string> = {
  documentation: 'blue',
  analysis: 'purple',
  integration: 'green',
  optimization: 'yellow',
  automation: 'red',
  general: 'gray',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || 'gray'
}

function extractCategoryFromTags(tags?: string[]): string {
  return tags?.find(tag =>
    ['documentation', 'analysis', 'integration', 'optimization', 'automation'].includes(tag)
  ) || 'general'
}

function isSkillSpec(spec: { tags?: string[] }): boolean {
  return spec.tags?.some(tag =>
    tag.includes('skill') ||
    tag.includes('capability') ||
    tag.includes('devdocs') ||
    tag.includes('analysis') ||
    tag.includes('cost-optimization')
  ) ?? false
}

const SkillsSection: React.FC = () => {
  const queryClient = useQueryClient()
  const { currentProjectId } = useProject()

  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Multi-select state
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)

  // Modal state
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [deletingSkill, setDeletingSkill] = useState<Skill | null>(null)

  // Fetch skills (stored as specs with special tags)
  const { data: allSpecs = [], isLoading, error } = useQuery({
    queryKey: ['skills', currentProjectId],
    queryFn: async () => {
      const specs = await apiClient.getSpecs(currentProjectId)
      return specs.filter(isSkillSpec)
    },
    refetchInterval: 30000,
  })

  // Transform specs into skills format
  const skills: Skill[] = allSpecs.map(spec => ({
    id: spec.id,
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    createdAt: spec.createdAt,
    updatedAt: spec.updatedAt,
    category: extractCategoryFromTags(spec.tags),
  }))

  // Load default skills if none exist
  const loadDefaultSkills = async () => {
    try {
      await apiClient.loadDefaultSkillsAndAgents({
        projectId: currentProjectId,
        loadSkills: true,
        loadAgents: false,
        loadSpecs: false,
        overwriteExisting: false,
      })
      window.location.reload()
    } catch (loadError) {
      console.error('Failed to load default skills:', loadError)
    }
  }

  // Filter skills based on search and category
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !searchTerm ||
      skill.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || skill.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  // Calculate statistics
  const stats = {
    total: skills.length,
    selected: selectedSkillIds.size,
    categories: [...new Set(skills.map(skill => skill.category))].length,
  }

  // Selection helpers
  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds(previous => {
      const next = new Set(previous)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else {
        next.add(skillId)
      }
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedSkillIds(new Set(filteredSkills.map(skill => skill.id)))
  }

  const deselectAll = () => {
    setSelectedSkillIds(new Set())
  }

  const allFilteredSelected = filteredSkills.length > 0 && filteredSkills.every(skill => selectedSkillIds.has(skill.id))

  // Edit handler
  const handleSaveSkill = async (skillId: string, updates: Record<string, unknown>) => {
    await apiClient.updateSpec(skillId, updates)
    await queryClient.invalidateQueries({ queryKey: ['skills', currentProjectId] })
  }

  // Delete handler
  const handleDeleteSkill = async (skillId: string) => {
    await apiClient.deleteSpec(skillId)
    selectedSkillIds.delete(skillId)
    setSelectedSkillIds(new Set(selectedSkillIds))
    await queryClient.invalidateQueries({ queryKey: ['skills', currentProjectId] })
  }

  // Download selected skills to current project
  const handleDownloadToProject = async () => {
    if (selectedSkillIds.size === 0) return

    setIsDownloading(true)
    try {
      const selectedSkills = skills.filter(skill => selectedSkillIds.has(skill.id))

      const createPromises = selectedSkills.map(skill =>
        apiClient.createSpec({
          title: skill.title,
          description: skill.description || '',
          status: 'active',
          priority: 'medium',
          projectId: currentProjectId,
          tags: skill.tags || [],
        })
      )
      await Promise.all(createPromises)
      deselectAll()
      await queryClient.invalidateQueries({ queryKey: ['skills', currentProjectId] })
      await queryClient.invalidateQueries({ queryKey: ['specs', currentProjectId] })
    } catch (downloadError) {
      console.error('Failed to download skills to project:', downloadError)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg font-semibold mb-2">Failed to load skills</div>
        <div className="text-gray-500">Please check your connection and try again.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
            <AcademicCapIcon className="h-8 w-8 text-blue-500" />
            <span>Skills</span>
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Manage and deploy agent skills and capabilities
          </p>
        </div>

        {skills.length === 0 && (
          <button
            onClick={loadDefaultSkills}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Load Default Skills
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Total Skills"
          value={stats.total}
          status="info"
          description="All available skills"
          icon={AcademicCapIcon}
        />
        <StatusCard
          title="Selected"
          value={stats.selected}
          status={stats.selected > 0 ? 'success' : 'info'}
          description="Skills selected for download"
          icon={CheckIcon}
        />
        <StatusCard
          title="Categories"
          value={stats.categories}
          status="info"
          description="Skill categories"
          icon={TagIcon}
        />
      </div>

      {/* Search, Filter, and Select All */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <input
            type="text"
            placeholder="Search skills by name, description, or tags..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="documentation">Documentation</option>
            <option value="analysis">Analysis</option>
            <option value="integration">Integration</option>
            <option value="optimization">Optimization</option>
            <option value="automation">Automation</option>
          </select>
        </div>
        {filteredSkills.length > 0 && (
          <button
            onClick={allFilteredSelected ? deselectAll : selectAllFiltered}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                     border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                     hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
          >
            {allFilteredSelected ? (
              <>
                <XMarkIcon className="h-4 w-4" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                <span>Select All</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="text-center py-12">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {skills.length === 0 ? 'No skills found' : 'No skills match your criteria'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {skills.length === 0
              ? 'Load default skills to get started with pre-built capabilities.'
              : 'Try adjusting your search terms or category filter.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSkills.map(skill => {
            const isSelected = selectedSkillIds.has(skill.id)
            const isExpanded = expandedSkillId === skill.id
            const categoryColor = getCategoryColor(skill.category)

            return (
              <div
                key={skill.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow border-2 transition-all duration-200
                  ${isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <div className="p-6">
                  {/* Top row: checkbox + header + actions */}
                  <div className="flex items-start gap-3 mb-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSkillSelection(skill.id)}
                      className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 dark:border-gray-500 hover:border-blue-400'}
                      `}
                      aria-label={isSelected ? `Deselect ${skill.title}` : `Select ${skill.title}`}
                    >
                      {isSelected && <CheckIcon className="h-3 w-3" />}
                    </button>

                    {/* Skill info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg bg-${categoryColor}-100 dark:bg-${categoryColor}-800/20`}>
                          <AcademicCapIcon className={`h-6 w-6 text-${categoryColor}-600 dark:text-${categoryColor}-400`} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {skill.title}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize mt-1
                            bg-${categoryColor}-100 text-${categoryColor}-800 dark:bg-${categoryColor}-800/20 dark:text-${categoryColor}-400`}>
                            {skill.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        onClick={event => { event.stopPropagation(); setEditingSkill(skill) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        aria-label={`Edit ${skill.title}`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={event => { event.stopPropagation(); setDeletingSkill(skill) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        aria-label={`Delete ${skill.title}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {skill.description && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                      {skill.description}
                    </p>
                  )}

                  {/* Tags */}
                  {skill.tags && skill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {skill.tags.slice(0, 5).map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                   bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                      {skill.tags.length > 5 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{skill.tags.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Last Updated */}
                  <div className="flex items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      Updated {new Date(skill.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700/50">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Skill Details</h4>

                    {skill.description && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {skill.description}
                        </p>
                      </div>
                    )}

                    {skill.tags && skill.tags.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h5>
                        <div className="flex flex-wrap gap-1">
                          {skill.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                       bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Action Bar for Multi-Select */}
      {selectedSkillIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center space-x-4 px-6 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-2xl">
            <span className="text-sm font-medium">
              {selectedSkillIds.size} skill{selectedSkillIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="w-px h-6 bg-gray-600" />
            <button
              onClick={handleDownloadToProject}
              disabled={isDownloading}
              className="flex items-center space-x-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>{isDownloading ? 'Downloading...' : 'Download to Project'}</span>
            </button>
            <button
              onClick={deselectAll}
              className="p-1.5 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              aria-label="Deselect all"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AcademicCapIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">About Skills</p>
            <p>
              Skills are modular capabilities that agents can use to perform specific tasks.
              They provide cost-optimized solutions by enabling local processing and intelligent
              resource management. Select multiple skills and download them to your current project.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingSkill && (
        <SkillEditModal
          skill={editingSkill}
          isOpen={true}
          onClose={() => setEditingSkill(null)}
          onSave={handleSaveSkill}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingSkill && (
        <DeleteConfirmModal
          skillTitle={deletingSkill.title}
          isOpen={true}
          onClose={() => setDeletingSkill(null)}
          onConfirm={() => handleDeleteSkill(deletingSkill.id)}
        />
      )}
    </div>
  )
}

export default SkillsSection
