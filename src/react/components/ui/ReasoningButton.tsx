import React, { useState } from 'react'
import { Modal, ModalBody, ModalFooter } from './Modals/Modal'
import { BoltIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface SkillUsageEntry {
  skillId: string
  skillName: string
  executionTimeMs: number
  resultType: string
  cost: number
}

interface ReasoningResult {
  prompt: string
  response: string
  complexity: string
  provider: string
  responseTime: number
  cost: number
  tokensUsed: number
  skillsUsed: SkillUsageEntry[]
}

interface ReasoningButtonProps {
  prompt: string
  label?: string
  complexity?: 'simple' | 'medium' | 'complex'
  size?: 'sm' | 'md'
  className?: string
}

export function ReasoningButton({
  prompt,
  label = 'Analyze',
  complexity = 'medium',
  size = 'sm',
  className = '',
}: ReasoningButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ReasoningResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleClick = async () => {
    if (isLoading || !prompt.trim()) return
    setIsLoading(true)
    try {
      const response = await fetch('/mcp/call/hybrid_reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), complexity, preferLocal: true }),
      })
      const data = await response.json()
      setResult({
        prompt: prompt.trim(),
        response: typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
        complexity,
        provider: data.actualProviderName || data.provider || 'unknown',
        responseTime: data.responseTime || 0,
        cost: data.actualCost || 0,
        tokensUsed: Math.floor((data.result?.length || 0) / 4),
        skillsUsed: data.skillsUsed || [],
      })
      setIsModalOpen(true)
    } catch (error) {
      console.error('Reasoning request failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const buttonSizeClass = size === 'sm'
    ? 'px-2.5 py-1 text-xs'
    : 'px-3.5 py-1.5 text-sm'

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex items-center space-x-1.5 font-medium rounded-lg transition-colors duration-200
                   bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400
                   dark:hover:bg-yellow-900/40 disabled:opacity-50 disabled:cursor-not-allowed
                   ${buttonSizeClass} ${className}`}
      >
        {isLoading ? (
          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <BoltIcon className="h-3.5 w-3.5" />
        )}
        <span>{isLoading ? 'Analyzing...' : label}</span>
      </button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Reasoning Result" size="xl">
        <ModalBody>
          {result && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Provider</span>
                  <p className="font-medium text-gray-900 dark:text-white">{result.provider}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Response Time</span>
                  <p className="font-medium text-gray-900 dark:text-white">{result.responseTime}ms</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <p className="font-medium text-gray-900 dark:text-white">${result.cost.toFixed(4)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Complexity</span>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{result.complexity}</p>
                </div>
              </div>

              {/* Skills */}
              {result.skillsUsed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Skills Used</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.skillsUsed.map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
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
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-800 dark:text-gray-200
                             whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {result.prompt}
                </div>
              </div>

              {/* Response */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Response</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-800 dark:text-gray-200
                             whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                  {result.response}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200
                       rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </>
  )
}
