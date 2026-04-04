import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CpuChipIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '../lib/api-client'
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modals/Modal'
import { StatusCard } from '../components/ui/Cards/StatusCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useProject } from '../store/project-store'
import type { MemoryNote } from '../types'

interface NoteFormState {
  title: string
  content: string
  tags: string
}

const EMPTY_NOTE_FORM: NoteFormState = { title: '', content: '', tags: '' }

function buildFormFromNote(note: MemoryNote): NoteFormState {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags?.join(', ') || '',
  }
}

function NoteFormModal({
  title,
  initialForm,
  isOpen,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string
  initialForm: NoteFormState
  isOpen: boolean
  onClose: () => void
  onSubmit: (form: NoteFormState) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState<NoteFormState>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClassName = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
    focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))}
              placeholder="Note title"
              className={inputClassName}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={event => setForm(previous => ({ ...previous, content: event.target.value }))}
              rows={8}
              placeholder="Write your note..."
              className={inputClassName}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={event => setForm(previous => ({ ...previous, tags: event.target.value }))}
              placeholder="architecture, decision, bug-fix"
              className={inputClassName}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

const Memory: React.FC = () => {
  const queryClient = useQueryClient()
  const { currentProjectId } = useProject()
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<MemoryNote | null>(null)
  const [deletingNote, setDeletingNote] = useState<MemoryNote | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['memory-notes'],
    queryFn: () => apiClient.getMemoryNotes(),
    refetchInterval: 30000,
  })

  const filteredNotes = notes.filter(note => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return note.title.toLowerCase().includes(term) ||
      note.content.toLowerCase().includes(term) ||
      note.tags?.some((tag: string) => tag.toLowerCase().includes(term))
  })

  const handleCreate = async (form: NoteFormState) => {
    const tags = form.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    await apiClient.createMemoryNote({
      title: form.title,
      content: form.content,
      tags,
      projectId: currentProjectId,
    })
    await queryClient.invalidateQueries({ queryKey: ['memory-notes'] })
  }

  const handleUpdate = async (form: NoteFormState) => {
    if (!editingNote) return
    const tags = form.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    await apiClient.updateMemoryNote(editingNote.id, {
      title: form.title,
      content: form.content,
      tags,
    } as any)
    await queryClient.invalidateQueries({ queryKey: ['memory-notes'] })
  }

  const handleDelete = async () => {
    if (!deletingNote) return
    await apiClient.deleteMemoryNote(deletingNote.id)
    setDeletingNote(null)
    await queryClient.invalidateQueries({ queryKey: ['memory-notes'] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
            <CpuChipIcon className="h-8 w-8 text-blue-500" />
            <span>Memory</span>
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Project memory notes, decisions, and knowledge
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard title="Total Notes" value={notes.length} status="info" description="All memory notes" icon={CpuChipIcon} />
        <StatusCard title="Tags Used" value={[...new Set(notes.flatMap((note: MemoryNote) => note.tags || []))].length} status="info" description="Unique tags" icon={TagIcon} />
        <StatusCard title="Recent" value={notes.filter((note: MemoryNote) => Date.now() - new Date(note.createdAt).getTime() < 7 * 86400000).length} status="success" description="Created this week" icon={ClockIcon} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search notes by title, content, or tags..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white
                   rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          <span>New Note</span>
        </button>
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <CpuChipIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {notes.length === 0 ? 'No notes yet' : 'No notes match your search'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {notes.length === 0 ? 'Create your first memory note to start tracking decisions and knowledge.' : 'Try different search terms.'}
          </p>
          {notes.length === 0 && (
            <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Create Note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note: MemoryNote) => {
            const isExpanded = expandedNoteId === note.id

            return (
              <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{note.title}</h3>
                      {!isExpanded && (
                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 line-clamp-2">
                          {note.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        onClick={() => setEditingNote(note)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingNote(note)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {note.content}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {note.tags?.map((tag: string) => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <NoteFormModal
          title="Create Note"
          initialForm={EMPTY_NOTE_FORM}
          isOpen={true}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreate}
          submitLabel="Create"
        />
      )}

      {/* Edit Modal */}
      {editingNote && (
        <NoteFormModal
          title="Edit Note"
          initialForm={buildFormFromNote(editingNote)}
          isOpen={true}
          onClose={() => setEditingNote(null)}
          onSubmit={handleUpdate}
          submitLabel="Save"
        />
      )}

      {/* Delete Confirm */}
      {deletingNote && (
        <Modal isOpen={true} onClose={() => setDeletingNote(null)} title="Delete Note" size="sm">
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Delete <strong>{deletingNote.title}</strong>? This cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeletingNote(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Delete
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}

export default Memory
