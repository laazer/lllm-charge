import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { 
  BookOpenIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon 
} from '@heroicons/react/24/outline'

interface DevDocsSearchResult {
  title: string
  content: string
  url: string
  language: string
}

interface DevDocsLanguage {
  name: string
  slug: string
  version: string
  description?: string
}

function DevDocs() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [searchResults, setSearchResults] = useState<DevDocsSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Fetch available documentation languages
  const { data: languages = [], isLoading: languagesLoading } = useQuery({
    queryKey: ['devdocs-languages'],
    queryFn: async () => {
      const response = await fetch('/api/devdocs/languages')
      return response.json() as Promise<DevDocsLanguage[]>
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedLanguage) return

    setIsSearching(true)
    try {
      const response = await fetch('/api/devdocs/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          language: selectedLanguage
        }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const results = await response.json()
      setSearchResults(results || [])
    } catch (error) {
      console.error('DevDocs search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  if (languagesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <BookOpenIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              DevDocs Access
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Search offline documentation for popular programming languages and frameworks
            </p>
          </div>
        </div>

        {/* Search Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Query
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                id="search"
                placeholder="e.g., array methods, async await, css flexbox..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Language/Framework
            </label>
            <select
              id="language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select language...</option>
              {languages.map((lang) => (
                <option key={lang.slug} value={lang.slug}>
                  {lang.name} {lang.version && `(${lang.version})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || !selectedLanguage || isSearching}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 
                   disabled:cursor-not-allowed text-white rounded-lg font-medium
                   transition-colors duration-200 flex items-center space-x-2"
        >
          {isSearching ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="h-5 w-5" />
              <span>Search Documentation</span>
            </>
          )}
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Search Results ({searchResults.length})
          </h2>
          <div className="space-y-4">
            {searchResults.map((result, index) => (
              <div 
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg
                         hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {result.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 line-clamp-3">
                      {result.content}
                    </p>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400 rounded">
                        {result.language}
                      </span>
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                        >
                          <span>View Full Documentation</span>
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Languages */}
      {languages.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Available Documentation ({languages.length} languages)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {languages.map((lang) => (
              <div
                key={lang.slug}
                onClick={() => setSelectedLanguage(lang.slug)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedLanguage === lang.slug
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {lang.name}
                </div>
                {lang.version && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Version {lang.version}
                  </div>
                )}
                {lang.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {lang.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <BookOpenIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">About DevDocs Access</p>
            <p>
              Search through offline documentation for popular programming languages and frameworks. 
              This helps reduce API costs by providing instant access to reference materials without 
              requiring external API calls.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DevDocs