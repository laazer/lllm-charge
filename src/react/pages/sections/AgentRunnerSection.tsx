import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import {
  PlayIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface MCPTool {
  name: string
  description: string
  category: string
  isActive: boolean
}

interface AgentStep {
  step: number
  action: string
  tool: string | null
  result: unknown
}

interface AgentRunResult {
  success: boolean
  steps: AgentStep[]
  finalResponse: string
  totalSteps: number
}

type ComplexityLevel = 'simple' | 'moderate' | 'complex'

const COMPLEXITY_OPTIONS: ComplexityLevel[] = ['simple', 'moderate', 'complex']
const DEFAULT_MAX_STEPS = 5

function ToolSelector({
  tools,
  selectedTools,
  onChange,
}: {
  tools: MCPTool[]
  selectedTools: string[]
  onChange: (selected: string[]) => void
}) {
  const toggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onChange(selectedTools.filter((name) => name !== toolName))
    } else {
      onChange([...selectedTools, toolName])
    }
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-3">
      {tools.map((tool) => (
        <label key={tool.name} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedTools.includes(tool.name)}
            onChange={() => toggleTool(tool.name)}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tool.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
            — {tool.description}
          </span>
        </label>
      ))}
    </div>
  )
}

function StepList({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((agentStep) => (
        <li key={agentStep.step} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40
                           text-blue-700 dark:text-blue-300 text-xs font-bold
                           flex items-center justify-center mt-0.5">
            {agentStep.step}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 dark:text-gray-200">{agentStep.action}</p>
            {agentStep.tool && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Tool: <code className="font-mono">{agentStep.tool}</code>
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function AgentRunnerForm({
  tools,
  onResult,
}: {
  tools: MCPTool[]
  onResult: (result: AgentRunResult) => void
}) {
  const [goal, setGoal] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [maxSteps, setMaxSteps] = useState(DEFAULT_MAX_STEPS)
  const [preferLocal, setPreferLocal] = useState(true)
  const [complexity, setComplexity] = useState<ComplexityLevel>('moderate')

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.runMCPAgent({
        goal,
        allowedTools: selectedTools.length > 0 ? selectedTools : undefined,
        maxSteps,
        preferLocal,
        complexity,
      }),
    onSuccess: (data) => onResult(data),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!goal.trim()) return
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Goal textarea */}
      <div>
        <label
          htmlFor="agent-goal"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Goal
        </label>
        <textarea
          id="agent-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe what you want the agent to accomplish…"
          rows={4}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        />
      </div>

      {/* Allowed tools */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Allowed Tools{' '}
          <span className="text-xs font-normal text-gray-500">(leave all unchecked to allow any)</span>
        </p>
        <ToolSelector tools={tools} selectedTools={selectedTools} onChange={setSelectedTools} />
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Max Steps */}
        <div>
          <label
            htmlFor="max-steps"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Max Steps: {maxSteps}
          </label>
          <input
            id="max-steps"
            type="range"
            min={1}
            max={20}
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        {/* Complexity */}
        <div>
          <label
            htmlFor="complexity"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Complexity
          </label>
          <select
            id="complexity"
            value={complexity}
            onChange={(e) => setComplexity(e.target.value as ComplexityLevel)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                       focus:ring-2 focus:ring-blue-500"
          >
            {COMPLEXITY_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Prefer Local toggle */}
        <div className="flex flex-col justify-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferLocal}
              onChange={(e) => setPreferLocal(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Prefer Local Model
            </span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
            Route to local LLM when possible
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending || !goal.trim()}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                   text-white text-sm font-medium rounded-md transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? (
          <>
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <PlayIcon className="h-4 w-4" />
            Run
          </>
        )}
      </button>
    </form>
  )
}

function AgentResultPanel({ result }: { result: AgentRunResult }) {
  return (
    <div className="space-y-6">
      {/* Steps */}
      {result.steps && result.steps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Steps ({result.totalSteps})
          </h3>
          <StepList steps={result.steps} />
        </div>
      )}

      {/* Final Response */}
      {result.finalResponse && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Final Response
            </h3>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                          rounded-md p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {result.finalResponse}
          </div>
        </div>
      )}
    </div>
  )
}

export function AgentRunnerSection() {
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['mcp-tools-agent'],
    queryFn: () => apiClient.getMCPTools(),
    refetchInterval: 60000,
  })

  const tools: MCPTool[] = data?.tools ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Runner</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Give the AI agent a goal and let it choose which tools to use.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Form panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Run</h2>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <AgentRunnerForm tools={tools} onResult={setRunResult} />
            )}
          </div>
        </div>

        {/* Result panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {runResult ? 'Results' : 'Output'}
            </h2>
          </div>
          <div className="p-6">
            {runResult ? (
              <AgentResultPanel result={runResult} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <PlayIcon className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Run the agent to see step-by-step output here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
