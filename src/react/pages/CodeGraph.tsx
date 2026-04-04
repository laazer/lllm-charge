import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MagnifyingGlassIcon,
  CodeBracketIcon,
  CircleStackIcon,
  ArrowsRightLeftIcon,
  DocumentIcon,
  ChevronRightIcon,
  ArrowUturnLeftIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '../lib/api-client'
import type { CodeGraphSymbol, CodeGraphRelation } from '../lib/api-client'
import { StatusCard } from '../components/ui/Cards/StatusCard'
import { KindBadge } from '../components/ui/CodeGraph/KindBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useProject } from '../store/project-store'
import { useWebSocket } from '../store/websocket-store'

function RelationList({ title, relations, onSymbolClick }: {
  title: string
  relations: CodeGraphRelation[]
  onSymbolClick: (id: string) => void
}) {
  if (relations.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</h4>
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">None found</p>
      </div>
    )
  }
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title} ({relations.length})</h4>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {relations.map((rel) => (
          <button
            key={rel.id}
            onClick={() => onSymbolClick(rel.id)}
            className="w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <KindBadge kind={rel.kind || rel.nodeKind || 'unknown'} />
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{rel.name}</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs truncate ml-auto">{rel.file}:{rel.line}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CodeGraph() {
  const [searchQuery, setSearchQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [searchResults, setSearchResults] = useState<CodeGraphSymbol[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState<number | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { currentProjectId } = useProject()
  const { lastMessage } = useWebSocket()

  // Listen for CodeGraph sync WebSocket events
  useEffect(() => {
    if (!lastMessage || (lastMessage as any).type !== 'codegraph_sync') return
    const event = lastMessage as any
    setSyncMessage(event.message || '')
    if (typeof event.progress === 'number') setSyncProgress(event.progress)
    if (event.status === 'completed' || event.status === 'failed') {
      setIsSyncing(false)
      setSyncProgress(null)
      if (event.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: ['codegraph-switch', currentProjectId] })
        queryClient.invalidateQueries({ queryKey: ['codegraph-status', currentProjectId] })
      }
      setTimeout(() => setSyncMessage(''), 5000)
    }
  }, [lastMessage])

  // Step 1: Switch the backend CodeGraph database to the current project.
  // This query re-fires whenever currentProjectId changes.
  // All downstream queries depend on this completing first.
  const switchQuery = useQuery({
    queryKey: ['codegraph-switch', currentProjectId],
    queryFn: async () => {
      const result = await apiClient.switchCodeGraphProject({ projectId: currentProjectId })
      return result
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' as const,
  })

  // When project changes, clear search state
  const switchedProjectRoot = switchQuery.data?.projectRoot
  const isBackendReady = switchQuery.isSuccess

  // Step 2: Fetch status only AFTER the switch query succeeds
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['codegraph-status', currentProjectId],
    queryFn: () => apiClient.getCodeGraphStatus(),
    enabled: isBackendReady,
    refetchOnWindowFocus: false,
  })

  const { data: symbolDetail } = useQuery({
    queryKey: ['codegraph-symbol', currentProjectId, selectedSymbolId],
    queryFn: () => selectedSymbolId ? apiClient.getCodeGraphSymbol(selectedSymbolId) : null,
    enabled: isBackendReady && !!selectedSymbolId,
  })

  const { data: callers = [] } = useQuery({
    queryKey: ['codegraph-callers', currentProjectId, selectedSymbolId],
    queryFn: () => selectedSymbolId ? apiClient.getCodeGraphCallers(selectedSymbolId) : [],
    enabled: isBackendReady && !!selectedSymbolId,
  })

  const { data: callees = [] } = useQuery({
    queryKey: ['codegraph-callees', currentProjectId, selectedSymbolId],
    queryFn: () => selectedSymbolId ? apiClient.getCodeGraphCallees(selectedSymbolId) : [],
    enabled: isBackendReady && !!selectedSymbolId,
  })

  const effectivePath = switchedProjectRoot || manualPath.trim() || null

  const handleSync = async () => {
    if (!effectivePath) return
    setIsSyncing(true)
    setSyncMessage('Starting sync...')
    try {
      const result = await apiClient.syncCodeGraph(effectivePath)
      // Save codeGraphPath if not set
      if (result.success && !switchedProjectRoot) {
        try {
          await apiClient.updateProject(currentProjectId, { codeGraphPath: effectivePath })
          queryClient.invalidateQueries({ queryKey: ['projects'] })
        } catch {
          // Non-critical
        }
      }
      // For async (202) response, isSyncing stays true until WebSocket event
      // For sync (200) response (fallback), handle immediately
      if (result.status !== 'indexing') {
        setIsSyncing(false)
        setSyncMessage('')
        await queryClient.invalidateQueries({ queryKey: ['codegraph-switch', currentProjectId] })
        await queryClient.invalidateQueries({ queryKey: ['codegraph-status', currentProjectId] })
      }
    } catch (error) {
      console.error('CodeGraph sync failed:', error)
      setIsSyncing(false)
      setSyncMessage('Sync failed')
      setTimeout(() => setSyncMessage(''), 3000)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const results = await apiClient.searchCodeGraph(searchQuery, kindFilter !== 'all' ? kindFilter : undefined, 50)
      setSearchResults(results)
      setSelectedSymbolId(null)
    } catch (error) {
      console.error('CodeGraph search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') handleSearch()
  }

  const handleSymbolClick = (symbolId: string) => {
    setSelectedSymbolId(symbolId)
  }

  if (switchQuery.isLoading || statusLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <LoadingSpinner size="lg" />
        {switchQuery.isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Switching CodeGraph to project...</p>
        )}
      </div>
    )
  }

  const nodeKindEntries = Object.entries(status?.nodesByKind || {}).sort((a, b) => b[1] - a[1])
  const availableKinds = nodeKindEntries.map(([kind]) => kind)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CodeBracketIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CodeGraph Explorer</h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Search and explore code symbols, relationships, and impact analysis
              </p>
              {switchedProjectRoot && (
                <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1 truncate max-w-lg" title={switchedProjectRoot}>
                  {switchedProjectRoot}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!switchedProjectRoot && (
              <input
                type="text"
                value={manualPath}
                onChange={(event) => setManualPath(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && effectivePath) handleSync() }}
                placeholder="Project path..."
                className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            )}
            {!isSyncing && (
              <button
                onClick={handleSync}
                disabled={!effectivePath}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                <ArrowPathIcon className="w-4 h-4" />
                {switchedProjectRoot ? 'Sync Index' : 'Initialize'}
              </button>
            )}
          </div>
          {syncMessage && (
            <div className="w-full max-w-md space-y-1.5">
              <div className={`text-xs px-3 py-1.5 rounded-lg truncate ${
                syncMessage.includes('failed') || syncMessage.includes('Failed')
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
              }`}>
                {isSyncing && <ArrowPathIcon className="inline h-3 w-3 animate-spin mr-1.5" />}
                {syncMessage}
              </div>
              {isSyncing && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress ?? 0}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for symbols (e.g., Router, handleRequest)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Kinds</option>
              {availableKinds.map((kind) => (
                <option key={kind} value={kind}>{kind} ({status?.nodesByKind[kind]})</option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="w-full px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300
                       disabled:cursor-not-allowed text-white rounded-lg font-medium
                       transition-colors flex items-center justify-center gap-2"
            >
              {isSearching ? <LoadingSpinner size="sm" /> : <MagnifyingGlassIcon className="h-5 w-5" />}
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      {status?.isAvailable && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatusCard title="Files Indexed" value={status.filesIndexed} status="info" description="Source files analyzed" icon={DocumentIcon} />
          <StatusCard title="Total Symbols" value={status.totalNodes} status="success" description="Code symbols indexed" icon={CodeBracketIcon} />
          <StatusCard title="Relationships" value={status.totalEdges} status="info" description="Symbol connections" icon={ArrowsRightLeftIcon} />
          <StatusCard title="Database" value={status.isAvailable ? 'Active' : 'Offline'} status={status.isAvailable ? 'success' : 'error'} description="CodeGraph status" icon={CircleStackIcon} />
        </div>
      )}

      {!status?.isAvailable && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-300 text-sm">
            {switchedProjectRoot
              ? <>CodeGraph not yet initialized. Click <strong>Sync Index</strong> above to run <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">codegraph init -i</code> on this project.</>
              : <>No project path configured. Enter the project directory path above and click <strong>Initialize</strong>. The path will be saved to this project automatically.</>
            }
          </p>
        </div>
      )}

      {/* Node Kind Breakdown */}
      {nodeKindEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Symbol Breakdown</h2>
          <div className="flex flex-wrap gap-3">
            {nodeKindEntries.map(([kind, count]) => (
              <button
                key={kind}
                onClick={() => { setKindFilter(kind); setSearchQuery('*'); handleSearch() }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <KindBadge kind={kind} />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results List */}
        {searchResults.length > 0 && (
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${selectedSymbolId ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Results ({searchResults.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {searchResults.map((symbol) => (
                <button
                  key={symbol.id}
                  onClick={() => handleSymbolClick(symbol.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedSymbolId === symbol.id
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <KindBadge kind={symbol.kind} />
                    <span className="font-medium text-gray-900 dark:text-white truncate">{symbol.name}</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {symbol.file}:{symbol.line}
                  </div>
                  {symbol.signature && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-mono truncate">
                      {symbol.signature}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Symbol Detail Panel */}
        {selectedSymbolId && symbolDetail && (
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <KindBadge kind={symbolDetail.kind} />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{symbolDetail.name}</h2>
              </div>
              <button
                onClick={() => setSelectedSymbolId(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowUturnLeftIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">File:</span> {symbolDetail.file}:{symbolDetail.line}
                {symbolDetail.end_line && ` - ${symbolDetail.end_line}`}
              </div>
              {symbolDetail.signature && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                  {symbolDetail.signature}
                </div>
              )}
              {symbolDetail.docstring && (
                <div className="text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  {symbolDetail.docstring}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RelationList title="Callers (who calls this)" relations={callers} onSymbolClick={handleSymbolClick} />
              <RelationList title="Callees (what this calls)" relations={callees} onSymbolClick={handleSymbolClick} />
            </div>

            {/* Relationships from symbol detail */}
            {symbolDetail.relationships && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <RelationList
                  title="Incoming Relationships"
                  relations={symbolDetail.relationships.incoming || []}
                  onSymbolClick={handleSymbolClick}
                />
                <RelationList
                  title="Outgoing Relationships"
                  relations={symbolDetail.relationships.outgoing || []}
                  onSymbolClick={handleSymbolClick}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CodeBracketIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
          <div className="text-sm text-purple-800 dark:text-purple-300">
            <p className="font-medium mb-1">About CodeGraph</p>
            <p>
              CodeGraph builds a semantic knowledge graph of your codebase for faster, smarter code exploration.
              Search for symbols by name, explore call relationships, and analyze the impact of changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CodeGraph
