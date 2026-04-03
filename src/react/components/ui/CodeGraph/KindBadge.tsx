import React from 'react'

export const KIND_COLORS: Record<string, string> = {
  class: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  function: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  method: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  interface: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  variable: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
  import: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  type_alias: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  file: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300',
  constant: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  enum: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
}

export function KindBadge({ kind }: { kind: string }) {
  const colorClass = KIND_COLORS[kind] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {kind}
    </span>
  )
}
