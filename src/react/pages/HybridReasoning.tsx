import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { StatusCard } from '../components/ui/Cards/StatusCard'
import { MetricCard } from '../components/ui/Cards/MetricCard'
import {
  BoltIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CloudIcon,
  CpuChipIcon,
  ArrowPathIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface SkillUsageEntry {
  skillId: string
  skillName: string
  executionTimeMs: number
  resultType: string
  cost: number
}

interface HybridReasoningLog {
  timestamp: string
  prompt: string
  response?: string
  complexity: 'simple' | 'medium' | 'complex'
  localAttempted: boolean
  localSuccess: boolean
  fallbackReason?: string
  provider: string
  responseTime: number
  cost: number
  tokensUsed: number
  skillsUsed?: SkillUsageEntry[]
}

interface HybridReasoningStats {
  totalRequests: number
  localSuccessRate: number
  avgCostSavings: number
  totalSavings: number
  avgResponseTime: number
  failureReasons: Record<string, number>
  providerUsage: Record<string, number>
  totalSkillInvocations?: number
  skillUsageBreakdown?: Record<string, number>
}

function HybridReasoning() {
  const [logs, setLogs] = useState<HybridReasoningLog[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedLog, setSelectedLog] = useState<HybridReasoningLog | null>(null)
  const [promptInput, setPromptInput] = useState('')
  const [complexitySelect, setComplexitySelect] = useState<'simple' | 'medium' | 'complex'>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch hybrid reasoning statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['hybrid-reasoning-stats'],
    queryFn: async () => {
      const response = await fetch('/api/reasoning/stats')
      return response.json() as Promise<HybridReasoningStats>
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch hybrid reasoning logs
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['hybrid-reasoning-logs'],
    queryFn: async () => {
      const response = await fetch('/api/reasoning/logs')
      return response.json() as Promise<HybridReasoningLog[]>
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  useEffect(() => {
    if (logsData) {
      setLogs(logsData)
    }
  }, [logsData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchStats(), refetchLogs()])
    setIsRefreshing(false)
  }

  const handleSubmitPrompt = async () => {
    if (!promptInput.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const response = await fetch('/mcp/call/hybrid_reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptInput.trim(),
          complexity: complexitySelect,
          preferLocal: true,
        }),
      })
      const result = await response.json()
      await Promise.all([refetchStats(), refetchLogs()])
      setSelectedLog({
        timestamp: new Date().toISOString(),
        prompt: promptInput.trim(),
        response: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
        complexity: complexitySelect,
        localAttempted: true,
        localSuccess: result.provider === 'local',
        fallbackReason: result.provider === 'cloud' ? 'Used cloud provider' : undefined,
        provider: result.actualProviderName || result.provider || 'unknown',
        responseTime: result.responseTime || 0,
        cost: result.actualCost || 0,
        tokensUsed: Math.floor((result.result?.length || 0) / 4),
        skillsUsed: result.skillsUsed || [],
      })
      setPromptInput('')
    } catch (error) {
      console.error('Reasoning request failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400'
      case 'complex': return 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getProviderColor = (provider: string) => {
    if (provider.includes('local') || provider.includes('ollama') || provider.includes('lm-studio')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400'
    }
    return 'bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-400'
  }

  if (statsLoading || logsLoading) {
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
            <BoltIcon className="h-8 w-8 text-yellow-500" />
            <span>Hybrid Reasoning</span>
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Cost optimization through intelligent local/cloud LLM routing
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 
                   disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
        >
          <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Prompt Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
          <BoltIcon className="h-5 w-5 text-yellow-500" />
          <span>Run Reasoning</span>
        </h2>
        <div className="space-y-3">
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Enter a prompt to analyze with hybrid reasoning..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                     text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitPrompt()
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <select
                value={complexitySelect}
                onChange={(e) => setComplexitySelect(e.target.value as 'simple' | 'medium' | 'complex')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="simple">Simple</option>
                <option value="medium">Medium</option>
                <option value="complex">Complex</option>
              </select>
              <span className="text-xs text-gray-400 dark:text-gray-500">Cmd+Enter to submit</span>
            </div>
            <button
              onClick={handleSubmitPrompt}
              disabled={!promptInput.trim() || isSubmitting}
              className="flex items-center space-x-2 px-5 py-2 bg-yellow-500 hover:bg-yellow-600
                       disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg
                       font-medium transition-colors duration-200"
            >
              {isSubmitting ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <BoltIcon className="h-4 w-4" />
                  <span>Run Reasoning</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatusCard
              title="Local Success Rate"
              value={`${((stats.localSuccessRate || 0) * 100).toFixed(1)}%`}
              status={(stats.localSuccessRate || 0) > 0.7 ? 'success' : (stats.localSuccessRate || 0) > 0.4 ? 'warning' : 'error'}
              description="Requests handled locally"
              icon={CpuChipIcon}
            />
            <StatusCard
              title="Total Requests"
              value={stats.totalRequests}
              status="info"
              description="Hybrid reasoning requests"
              icon={BoltIcon}
            />
            <StatusCard
              title="Avg Response Time"
              value={`${(stats.avgResponseTime || 0).toFixed(0)}ms`}
              status="info"
              description="Average processing time"
              icon={ClockIcon}
            />
            <StatusCard
              title="Total Savings"
              value={`$${(stats.totalSavings || 0).toFixed(2)}`}
              status="success"
              description="Cost saved vs cloud-only"
              icon={CurrencyDollarIcon}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard
              title="Avg Cost Savings"
              value={`${(stats.avgCostSavings || 0).toFixed(1)}`}
              unit="%"
              icon={ChartBarIcon}
              color="green"
            />
            <MetricCard
              title="Cloud Fallbacks"
              value={((stats.totalRequests || 0) * (1 - (stats.localSuccessRate || 0))).toFixed(0)}
              icon={CloudIcon}
              color="purple"
            />
            <MetricCard
              title="Local Successes"
              value={((stats.totalRequests || 0) * (stats.localSuccessRate || 0)).toFixed(0)}
              icon={CpuChipIcon}
              color="blue"
            />
            <MetricCard
              title="Active Providers"
              value={Object.keys(stats.providerUsage || {}).length}
              icon={BoltIcon}
              color="yellow"
            />
            <MetricCard
              title="Skill Enrichments"
              value={stats.totalSkillInvocations || 0}
              icon={SparklesIcon}
              color="indigo"
            />
          </div>
        </>
      )}

      {/* Failure Reasons Analysis */}
      {stats?.failureReasons && Object.keys(stats.failureReasons).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
            <span>Local Reasoning Failure Analysis</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats.failureReasons).map(([reason, count]) => (
              <div key={reason} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {count}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {((count / (stats.totalRequests || 1)) * 100).toFixed(1)}% of requests
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider Usage */}
      {stats?.providerUsage && Object.keys(stats.providerUsage).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Provider Usage Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.providerUsage).map(([provider, count]) => (
              <div key={provider} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  {provider.includes('local') || provider.includes('ollama') || provider.includes('lm-studio') ? (
                    <CpuChipIcon className="h-5 w-5 text-blue-600" />
                  ) : (
                    <CloudIcon className="h-5 w-5 text-purple-600" />
                  )}
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {provider}
                  </h3>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {count}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {((count / (stats.totalRequests || 1)) * 100).toFixed(1)}% usage
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reasoning Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Reasoning Requests ({logs.length})
          </h2>
        </div>
        <div className="p-6">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <BoltIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hybrid reasoning requests yet</p>
              <p className="text-sm mt-1">Requests will appear here as they are processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.slice(0, 20).map((log, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedLog(log)}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4
                           hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {formatTimestamp(log.timestamp)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {log.prompt.length > 100 ? `${log.prompt.substring(0, 100)}...` : log.prompt}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getComplexityColor(log.complexity)
                      }`}>
                        {log.complexity}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Provider:</span>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          getProviderColor(log.provider)
                        }`}>
                          {log.provider}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Local Attempted:</span>
                      <div className="mt-1 font-medium text-gray-900 dark:text-white">
                        {log.localAttempted ? '✓ Yes' : '✗ No'}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Response Time:</span>
                      <div className="mt-1 font-medium text-gray-900 dark:text-white">
                        {(log.responseTime || 0).toFixed(0)}ms
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                      <div className="mt-1 font-medium text-gray-900 dark:text-white">
                        ${(log.cost || 0).toFixed(4)}
                      </div>
                    </div>
                  </div>
                  
                  {log.skillsUsed && log.skillsUsed.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-indigo-500" />
                      {log.skillsUsed.map((skill, skillIndex) => (
                        <span
                          key={skillIndex}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                   bg-indigo-100 text-indigo-800 dark:bg-indigo-800/20 dark:text-indigo-400"
                        >
                          {skill.skillName} ({skill.executionTimeMs}ms)
                        </span>
                      ))}
                    </div>
                  )}

                  {log.fallbackReason && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-start space-x-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Fallback Reason
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            {log.fallbackReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {logs.length > 20 && (
                <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing 20 most recent requests of {logs.length} total
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <BoltIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">About Hybrid Reasoning</p>
            <p>
              This system intelligently routes LLM requests between local models (Ollama, LM Studio) and cloud providers
              based on complexity, cost, and performance. Local processing provides significant cost savings while
              maintaining quality through smart fallback mechanisms.
            </p>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <BoltIcon className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Reasoning Detail
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  getComplexityColor(selectedLog.complexity)
                }`}>
                  {selectedLog.complexity}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  getProviderColor(selectedLog.provider)
                }`}>
                  {selectedLog.provider}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                         hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Metadata Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Time</span>
                  <p className="font-medium text-gray-900 dark:text-white">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Response Time</span>
                  <p className="font-medium text-gray-900 dark:text-white">{(selectedLog.responseTime || 0).toFixed(0)}ms</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <p className="font-medium text-gray-900 dark:text-white">${(selectedLog.cost || 0).toFixed(4)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tokens</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedLog.tokensUsed || 0}</p>
                </div>
              </div>

              {/* Skills Used */}
              {selectedLog.skillsUsed && selectedLog.skillsUsed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Skills Used</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.skillsUsed.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium
                                 bg-indigo-100 text-indigo-800 dark:bg-indigo-800/20 dark:text-indigo-400"
                      >
                        <SparklesIcon className="h-3 w-3 mr-1" />
                        {skill.skillName} ({skill.executionTimeMs}ms)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Prompt</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {selectedLog.prompt}
                </div>
              </div>

              {/* Response */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Response</h4>
                {selectedLog.response ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {selectedLog.response}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No response saved for this entry</p>
                )}
              </div>

              {/* Fallback Reason */}
              {selectedLog.fallbackReason && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Fallback Reason</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{selectedLog.fallbackReason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                         rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HybridReasoning