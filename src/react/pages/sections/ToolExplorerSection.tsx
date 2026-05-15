import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import {
  CommandLineIcon,
  ChevronRightIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

interface MCPTool {
  name: string
  description: string
  category: string
  isActive: boolean
  inputSchema: Record<string, unknown> | null
}

interface SchemaProperty {
  type: string
  description?: string
}

function buildInitialParams(schema: Record<string, unknown> | null): Record<string, string> {
  if (!schema?.properties) return {}
  const properties = schema.properties as Record<string, SchemaProperty>
  return Object.fromEntries(Object.keys(properties).map((key) => [key, '']))
}

function isRequired(schema: Record<string, unknown> | null, fieldName: string): boolean {
  if (!schema?.required) return false
  return (schema.required as string[]).includes(fieldName)
}

interface ToolParamFormProps {
  tool: MCPTool
  onResult: (result: unknown) => void
}

function ToolParamForm({ tool, onResult }: ToolParamFormProps) {
  const schema = tool.inputSchema
  const hasProperties = schema?.properties && Object.keys(schema.properties as object).length > 0

  const [params, setParams] = useState<Record<string, string>>(buildInitialParams(schema))
  const [rawJson, setRawJson] = useState('{}')

  const mutation = useMutation({
    mutationFn: (callParams: Record<string, unknown>) =>
      apiClient.callMCPTool(tool.name, callParams),
    onSuccess: (data) => onResult(data),
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!hasProperties) {
      let parsed: Record<string, unknown> = {}
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        parsed = {}
      }
      mutation.mutate(parsed)
      return
    }

    // Only include non-empty param values
    const callParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '')
    )
    mutation.mutate(callParams)
  }

  if (!hasProperties) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No parameters defined — enter raw JSON parameters below.
        </p>
        <div>
          <label htmlFor="raw-json" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Raw JSON parameters
          </label>
          <textarea
            id="raw-json"
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <SubmitButton isLoading={mutation.isPending} />
      </form>
    )
  }

  const properties = (schema!.properties as Record<string, SchemaProperty>)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(properties).map(([fieldName, fieldSchema]) => {
        const required = isRequired(schema, fieldName)
        const labelId = `param-${tool.name}-${fieldName}`

        return (
          <div key={fieldName}>
            <label htmlFor={labelId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {fieldName}
              {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
              {required && <span className="sr-only"> (required)</span>}
            </label>
            {fieldSchema.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {fieldSchema.description}
              </p>
            )}
            <input
              id={labelId}
              type="text"
              value={params[fieldName] ?? ''}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, [fieldName]: e.target.value }))
              }
              required={required}
              aria-label={fieldName}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )
      })}
      <SubmitButton isLoading={mutation.isPending} />
    </form>
  )
}

function SubmitButton({ isLoading }: { isLoading: boolean }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                 text-white text-sm font-medium rounded-md transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <PlayIcon className="h-4 w-4" />
      {isLoading ? 'Running...' : 'Run'}
    </button>
  )
}

interface ToolDetailPanelProps {
  tool: MCPTool
}

function ToolDetailPanel({ tool }: ToolDetailPanelProps) {
  const [result, setResult] = useState<unknown>(null)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tool.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tool.description}</p>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                         bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 mt-2">
          {tool.category}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Parameters</h4>
        <ToolParamForm tool={tool} onResult={setResult} />
      </div>

      {result !== null && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Result</h4>
          <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                          rounded-md p-4 text-xs text-gray-800 dark:text-gray-200 overflow-auto max-h-64">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function ToolListItem({
  tool,
  isSelected,
  onSelect,
}: {
  tool: MCPTool
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tool.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {tool.description}
          </p>
        </div>
        <ChevronRightIcon
          className={`h-4 w-4 flex-shrink-0 ml-2 transition-transform ${
            isSelected ? 'text-blue-500 rotate-90' : 'text-gray-400'
          }`}
        />
      </div>
    </button>
  )
}

export function ToolExplorerSection() {
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: () => apiClient.getMCPTools(),
    refetchInterval: 60000,
  })

  const tools: MCPTool[] = data?.tools ?? []
  const selectedTool = tools.find((t) => t.name === selectedToolName) ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">
          Failed to load tools. Check that the backend is running.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tool Explorer</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Browse and invoke MCP tools directly from the dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <CommandLineIcon className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tools ({tools.length})
            </h2>
          </div>
          <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
            {tools.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                No tools available
              </p>
            ) : (
              tools.map((tool) => (
                <ToolListItem
                  key={tool.name}
                  tool={tool}
                  isSelected={selectedToolName === tool.name}
                  onSelect={() => setSelectedToolName(tool.name)}
                />
              ))
            )}
          </div>
        </div>

        {/* Tool Detail Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedTool ? 'Tool Details' : 'Select a Tool'}
            </h2>
          </div>
          <div className="p-6">
            {selectedTool ? (
              <ToolDetailPanel key={selectedTool.name} tool={selectedTool} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CommandLineIcon className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Click a tool on the left to see its parameters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
