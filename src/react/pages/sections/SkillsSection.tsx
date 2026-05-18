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
import type { Skill } from '../../types'
import { StatusCard } from '../../components/ui/Cards/StatusCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Modal, ModalBody, ModalFooter } from '../../components/ui/Modals/Modal'
import { useProject } from '../../store/project-store'

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
  onSave: (id: string, updates: Partial<Skill>) => Promise<void>
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

      await onSave(skill.id, {
        title: form.title,
        description: form.description,
        category: form.category,
        tags: parsedTags,
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

  // Fetch skills from the Skills API, filtered by current project
  const { data: skills = [], isLoading, error } = useQuery({
    queryKey: ['skills', currentProjectId],
    queryFn: async () => {
      return await apiClient.getSkills(undefined, currentProjectId)
    },
    refetchInterval: 30000,
  })

  // Load default skills if none exist
  const loadDefaultSkills = async () => {
    try {
      await apiClient.loadDefaultSkillsAndAgents({
        loadSkills: true,
        loadAgents: false,
        loadSpecs: false,
        overwriteExisting: false,
      })
      // Refetch skills without page reload
      await queryClient.invalidateQueries({ queryKey: ['skills'] })
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
  const handleSaveSkill = async (skillId: string, updates: Partial<Skill>) => {
    await apiClient.updateSkill(skillId, updates)
    await queryClient.invalidateQueries({ queryKey: ['skills'] })
  }

  // Delete handler
  const handleDeleteSkill = async (skillId: string) => {
    await apiClient.deleteSkill(skillId)
    selectedSkillIds.delete(skillId)
    setSelectedSkillIds(new Set(selectedSkillIds))
    await queryClient.invalidateQueries({ queryKey: ['skills'] })
  }

  // Download selected skills to current project
  const handleDownloadToProject = async () => {
    if (selectedSkillIds.size === 0) return

    setIsDownloading(true)
    try {
      const selectedSkills = skills.filter(skill => selectedSkillIds.has(skill.id))

      // Create specs from selected skills in the current project
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
      await queryClient.invalidateQueries({ queryKey: ['skills'] })
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
          <AcademicCapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No skills found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || categoryFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by loading default skills'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map(skill => (
            <div
              key={skill.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg
                       transition-shadow dark:bg-gray-800 cursor-pointer"
              onClick={() => setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.has(skill.id)}
                      onChange={() => toggleSkillSelection(skill.id)}
                      onClick={event => event.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                    <h3 className="font-semibold text-gray-900 dark:text-white">{skill.title}</h3>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded
                      ${getCategoryColor(skill.category) === 'blue' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : ''}
                      ${getCategoryColor(skill.category) === 'purple' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : ''}
                      ${getCategoryColor(skill.category) === 'green' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : ''}
                      ${getCategoryColor(skill.category) === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' : ''}
                      ${getCategoryColor(skill.category) === 'red' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' : ''}
                      ${getCategoryColor(skill.category) === 'gray' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : ''}
                    `}>
                      {skill.category}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {skill.description}
                    </p>
                  )}
                  {skill.tags && skill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {skill.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="inline-block px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700
                                   text-gray-700 dark:text-gray-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {skill.tags.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 py-0.5">
                          +{skill.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  <button
                    onClick={event => {
                      event.stopPropagation()
                      setEditingSkill(skill)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={event => {
                      event.stopPropagation()
                      setDeletingSkill(skill)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>

              {/* Expanded view */}
              {expandedSkillId === skill.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                    <ClockIcon className="h-3 w-3" />
                    <span>Created {new Date(skill.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Download Button */}
      {selectedSkillIds.size > 0 && (
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={deselectAll}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                     hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Clear Selection
          </button>
          <button
            onClick={handleDownloadToProject}
            disabled={isDownloading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>{isDownloading ? 'Downloading...' : `Download (${selectedSkillIds.size})`}</span>
          </button>
        </div>
      )}

      {/* Modals */}
      {editingSkill && (
        <SkillEditModal
          skill={editingSkill}
          isOpen={true}
          onClose={() => setEditingSkill(null)}
          onSave={handleSaveSkill}
        />
      )}
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
