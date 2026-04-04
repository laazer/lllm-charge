import React from 'react'

interface NavigationButtonProps {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  isActive: boolean
  onClick: () => void
}

export function NavigationButton({ 
  id, 
  label, 
  icon: Icon, 
  description, 
  isActive, 
  onClick 
}: NavigationButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium text-sm
                transition-all duration-200 transform hover:scale-105 whitespace-nowrap
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700'
                }`}
      title={description}
      data-section={id}
    >
      <Icon className={`w-4 h-4 transition-colors duration-200 ${
        isActive 
          ? 'text-white' 
          : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
      }`} />
      <span>{label}</span>
    </button>
  )
}