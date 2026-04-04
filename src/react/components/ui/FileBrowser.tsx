import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import LoadingSpinner from './LoadingSpinner'
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  HomeIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface FileBrowserProps {
  onSelectPath: (path: string) => void
  onClose: () => void
  initialPath?: string
  title?: string
  selectFoldersOnly?: boolean
  className?: string
}

interface DirectoryItem {
  name: string
  path: string
  isDirectory?: boolean
}

interface BrowseResponse {
  current: string
  parent: string | null
  directories: DirectoryItem[]
  files?: DirectoryItem[]
}

export function FileBrowser({
  onSelectPath,
  onClose,
  initialPath = '',
  title = 'Select Project Path',
  selectFoldersOnly = true,
  className = ''
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [selectedPath, setSelectedPath] = useState('')

  const { data: browseData, isLoading, error, refetch } = useQuery<BrowseResponse>({
    queryKey: ['browse-directory', currentPath],
    queryFn: async () => {
      return await apiClient.browseDirectories(currentPath || undefined)
    },
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    setSelectedPath(currentPath)
  }, [currentPath])

  const handleDirectoryClick = (item: DirectoryItem) => {
    if (item.isDirectory !== false) { // Directory or unknown
      setCurrentPath(item.path)
    }
    setSelectedPath(item.path)
  }

  const handleParentClick = () => {
    if (browseData?.parent) {
      setCurrentPath(browseData.parent)
    }
  }

  const handleHomeClick = () => {
    setCurrentPath('')
  }

  const handleSelect = () => {
    onSelectPath(selectedPath)
    onClose()
  }

  const allItems = React.useMemo(() => {
    if (!browseData) return []
    
    const items = [...(browseData.directories || [])]
    if (!selectFoldersOnly && browseData.files) {
      items.push(...browseData.files)
    }
    
    return items.sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory !== false && b.isDirectory === false) return -1
      if (a.isDirectory === false && b.isDirectory !== false) return 1
      return a.name.localeCompare(b.name)
    })
  }, [browseData, selectFoldersOnly])

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 
                    w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 
                     rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
          <button
            onClick={handleHomeClick}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                     rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            title="Home"
          >
            <HomeIcon className="w-4 h-4" />
          </button>
          
          {browseData?.parent && (
            <button
              onClick={handleParentClick}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                       rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              title="Parent Directory"
            >
              <ChevronUpIcon className="w-4 h-4" />
            </button>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
              Current: {browseData?.current || 'Loading...'}
            </div>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">
                Error loading directory
              </p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 
                         rounded hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : allItems.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              {selectFoldersOnly ? 'No directories found' : 'No files or directories found'}
            </div>
          ) : (
            <div className="space-y-1">
              {allItems.map((item, index) => {
                const isDirectory = item.isDirectory !== false
                const isSelected = selectedPath === item.path
                const Icon = isDirectory ? 
                  (isSelected ? FolderOpenIcon : FolderIcon) : 
                  DocumentIcon

                return (
                  <button
                    key={`${item.path}-${index}`}
                    onClick={() => handleDirectoryClick(item)}
                    className={`w-full flex items-center space-x-3 p-2 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${
                      isDirectory 
                        ? 'text-blue-500 dark:text-blue-400' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`} />
                    <span className="truncate">{item.name}</span>
                    {isDirectory && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                        DIR
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Path Display */}
        {selectedPath && (
          <div className="p-3 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Selected Path:</div>
            <div className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 
                          p-2 rounded border border-gray-200 dark:border-slate-600 truncate">
              {selectedPath}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                     bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 
                     rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedPath}
            className="px-4 py-2 text-sm font-medium text-white 
                     bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600
                     disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Select Path
          </button>
        </div>
      </div>
    </div>
  )
}

export default FileBrowser