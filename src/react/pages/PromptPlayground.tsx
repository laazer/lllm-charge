import React, { useState, useEffect } from 'react'
import {
  BeakerIcon,
  BoltIcon,
  ArrowPathIcon,
  TrashIcon,
  ClockIcon,
  SparklesIcon,
  CpuChipIcon,
  CloudIcon,
} from '@heroicons/react/24/outline'

interface SkillUsageEntry {
  skillId: string
  skillName: string
  executionTimeMs: number
  resultType: string
  cost: number
}

interface PlaygroundRun {
  id: string
  prompt: string
  complexity: string
  preferLocal: boolean
  response: string
  provider: string
  responseTime: number
  cost: number
  tokensUsed: number
  skillsUsed: SkillUsageEntry[]
  timestamp: string
}

const HISTORY_STORAGE_KEY = 'llm-charge-playground-history'

function loadHistory(): PlaygroundRun[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveHistory(history: PlaygroundRun[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)))
}

function PromptPlayground() {
  const [prompt, setPrompt] = useState('')
  const [complexity, setComplexity] = useState<'simple' | 'medium' | 'complex'>('medium')
  const [preferLocal, setPreferLocal] = useState(true)
  const [temperature, setTemperature] = useState(0.3)
  const [maxTokens, setMaxTokens] = useState(2500)
  const [isRunning, setIsRunning] = useState(false)
  const [currentResult, setCurrentResult] = useState<PlaygroundRun | null>(null)
  const [history, setHistory] = useState<PlaygroundRun[]>(loadHistory)

  useEffect(() => {
    saveHistory(history)
  }, [history])

  const handleRun = async () => {
    if (!prompt.trim() || isRunning) return
    setIsRunning(true)
    try {
      const response = await fetch('/mcp/call/hybrid_reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), complexity, preferLocal, temperature, maxTokens }),
      })
      const data = await response.json()

      // Response is already cleaned server-side by extractAnswerContent()
      const rawResponse = (typeof data.result === 'string' ? data.result : JSON.stringify(data.result)).trim()

      const run: PlaygroundRun = {
        id: `run-${Date.now()}`,
        prompt: prompt.trim(),
        complexity,
        preferLocal,
        response: rawResponse,
        provider: data.actualProviderName || data.provider || 'unknown',
        responseTime: data.responseTime || 0,
        cost: data.actualCost || 0,
        tokensUsed: Math.floor((data.result?.length || 0) / 4),
        skillsUsed: data.skillsUsed || [],
        timestamp: new Date().toISOString(),
      }

      setCurrentResult(run)
      setHistory(prev => [run, ...prev])
    } catch (error) {
      console.error('Playground run failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const loadFromHistory = (run: PlaygroundRun) => {
    setPrompt(run.prompt)
    setComplexity(run.complexity as 'simple' | 'medium' | 'complex')
    setPreferLocal(run.preferLocal)
    setCurrentResult(run)
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_STORAGE_KEY)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
          <BeakerIcon className="h-8 w-8 text-purple-500" />
          <span>Prompt Playground</span>
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Test prompts interactively with hybrid reasoning, compare local vs cloud, and iterate on results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input + Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Prompt Input */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here... Try mentioning code, git, api, cost, files, etc. to trigger skill enrichment."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                       text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun()
              }}
            />

            {/* Controls Row */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Complexity</label>
                  <select
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value as 'simple' | 'medium' | 'complex')}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="simple">Simple</option>
                    <option value="medium">Medium</option>
                    <option value="complex">Complex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Routing</label>
                  <button
                    onClick={() => setPreferLocal(!preferLocal)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      preferLocal
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}
                  >
                    {preferLocal ? (
                      <><CpuChipIcon className="h-4 w-4" /><span>Local</span></>
                    ) : (
                      <><CloudIcon className="h-4 w-4" /><span>Cloud</span></>
                    )}
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Temp: {temperature}</label>
                  <input
                    type="range"
                    min="0" max="1" step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-20 h-1.5 accent-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tokens</label>
                  <input
                    type="number"
                    min="50" max="4096" step="50"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 800)}
                    className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Cmd+Enter</span>
                <button
                  onClick={handleRun}
                  disabled={!prompt.trim() || isRunning}
                  className="flex items-center space-x-2 px-5 py-2 bg-purple-600 hover:bg-purple-700
                           disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg
                           font-medium transition-colors duration-200"
                >
                  {isRunning ? (
                    <><ArrowPathIcon className="h-4 w-4 animate-spin" /><span>Running...</span></>
                  ) : (
                    <><BoltIcon className="h-4 w-4" /><span>Run</span></>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Result Panel */}
          {currentResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {/* Result Header */}
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Result</h3>
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${
                    currentResult.provider.includes('local') || currentResult.provider.includes('lm-studio') || currentResult.provider.includes('ollama')
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                  }`}>
                    {currentResult.provider}
                  </span>
                  <span className="flex items-center space-x-1">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>{currentResult.responseTime}ms</span>
                  </span>
                  <span>${currentResult.cost.toFixed(4)}</span>
                  <span>{currentResult.tokensUsed} tokens</span>
                </div>
              </div>

              {/* Skills */}
              {currentResult.skillsUsed.length > 0 && (
                <div className="px-5 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-indigo-500" />
                  {currentResult.skillsUsed.map((skill, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                               bg-indigo-100 text-indigo-800 dark:bg-indigo-800/20 dark:text-indigo-400"
                    >
                      {skill.skillName} ({skill.executionTimeMs}ms)
                    </span>
                  ))}
                </div>
              )}

              {/* Response Body */}
              <div className="p-5">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200
                             whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto leading-relaxed">
                  {currentResult.response}
                </div>
              </div>
            </div>
          )}

          {!currentResult && !isRunning && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <BeakerIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Enter a prompt and click Run to see results</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Skills will automatically enrich your prompt based on keywords
              </p>
            </div>
          )}
        </div>

        {/* Right: History Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                History ({history.length})
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear history"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No runs yet
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {history.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => loadFromHistory(run)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        currentResult?.id === run.id ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                      }`}
                    >
                      <p className="text-sm text-gray-900 dark:text-white truncate">{run.prompt}</p>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          run.complexity === 'simple' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                          run.complexity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {run.complexity}
                        </span>
                        <span>{run.provider}</span>
                        <span>{run.responseTime}ms</span>
                        {run.skillsUsed.length > 0 && (
                          <span className="flex items-center">
                            <SparklesIcon className="h-3 w-3 mr-0.5 text-indigo-400" />
                            {run.skillsUsed.length}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromptPlayground
