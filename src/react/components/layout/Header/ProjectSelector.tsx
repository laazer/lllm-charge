import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { apiClient } from '../../../lib/api-client'
import type { Project } from '../../../types'
import { useProject } from '../../../store/project-store'

export function ProjectSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const { currentProjectId, setCurrentProjectId } = useProject()

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects()
  })

  const selectedProject = projects.find(project => project.id === currentProjectId)

  const handleProjectChange = (projectId: string) => {
    setCurrentProjectId(projectId)
    setIsOpen(false)
    window.dispatchEvent(new CustomEvent('projectChange', { detail: { projectId } }))
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="min-w-64 px-4 py-2.5 border-2 border-blue-500 rounded-lg
                 bg-white dark:bg-slate-800 hover:bg-blue-500 hover:text-white
                 text-gray-900 dark:text-white font-semibold text-sm
                 transition-all duration-300 transform hover:-translate-y-0.5
                 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30
                 flex items-center justify-between"
      >
        <span className="truncate">
          {selectedProject?.name || 'Select Project'}
        </span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800
                      border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl
                      z-50 max-h-64 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectChange(project.id)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700
                        transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg
                        ${currentProjectId === project.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-white'}`}
            >
              <div className="font-medium">{project.name}</div>
              {project.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {project.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
