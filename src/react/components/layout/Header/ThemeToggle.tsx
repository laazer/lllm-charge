import React from 'react'
import { SunIcon, MoonIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../../store/theme-store'

export function ThemeToggle() {
  const { theme, style, toggleTheme, toggleStyle } = useTheme()

  return (
    <div className="flex items-center space-x-2">
      {/* Theme Toggle (Light/Dark) */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600
                 transition-all duration-200 group"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <MoonIcon className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600" />
        ) : (
          <SunIcon className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-yellow-500" />
        )}
      </button>

      {/* Style Toggle (Normal/Glass) */}
      <button
        onClick={toggleStyle}
        className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600
                 transition-all duration-200 group"
        title={`Switch to ${style === 'flat' ? 'liquid glass' : 'flat'} style`}
      >
        <SparklesIcon 
          className={`w-5 h-5 transition-colors duration-200 ${
            style === 'glass' 
              ? 'text-blue-500 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-300 group-hover:text-blue-500'
          }`} 
        />
      </button>
    </div>
  )
}