import React from 'react'
import { 
  ArrowUpIcon, 
  ArrowDownIcon,
  MinusIcon 
} from '@heroicons/react/24/outline'
import { useTheme } from '../../../store/theme-store'

export interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  change?: {
    value: number
    period: string
    isPositive?: boolean
  }
  icon?: React.ComponentType<{ className?: string }>
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange' | 'indigo' | 'teal' | 'pink'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  onClick?: () => void
  className?: string
}

const colorConfig = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    accent: 'bg-blue-500'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    accent: 'bg-green-500'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    accent: 'bg-red-500'
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500',
    accent: 'bg-yellow-500'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-500',
    accent: 'bg-purple-500'
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    icon: 'text-orange-500',
    accent: 'bg-orange-500'
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    icon: 'text-indigo-500',
    accent: 'bg-indigo-500'
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    border: 'border-teal-200 dark:border-teal-800',
    icon: 'text-teal-500',
    accent: 'bg-teal-500'
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-900/20',
    border: 'border-pink-200 dark:border-pink-800',
    icon: 'text-pink-500',
    accent: 'bg-pink-500'
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    border: 'border-gray-200 dark:border-gray-700',
    icon: 'text-gray-500',
    accent: 'bg-gray-500'
  }
}

const sizeConfig = {
  sm: {
    padding: 'p-4',
    titleText: 'text-xs',
    valueText: 'text-lg',
    iconSize: 'w-4 h-4',
    changeText: 'text-xs'
  },
  md: {
    padding: 'p-5',
    titleText: 'text-sm',
    valueText: 'text-xl',
    iconSize: 'w-5 h-5',
    changeText: 'text-sm'
  },
  lg: {
    padding: 'p-6',
    titleText: 'text-sm',
    valueText: 'text-3xl',
    iconSize: 'w-6 h-6',
    changeText: 'text-sm'
  }
}

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  unit,
  change,
  icon: Icon,
  color = 'blue',
  size = 'md',
  loading = false,
  onClick,
  className = ''
}: MetricCardProps) {
  // Defensive programming: fallback to 'blue' if color is not supported
  const colorScheme = colorConfig[color as keyof typeof colorConfig] || colorConfig.blue
  const sizeScheme = sizeConfig[size] || sizeConfig.md
  const { style } = useTheme()
  const isClickable = Boolean(onClick)

  if (loading) {
    return (
      <div className={`
        ${colorScheme.bg} ${colorScheme.border} border rounded-lg ${sizeScheme.padding}
        ${style === 'glass' ? 'glass-panel' : ''}
        glass:bg-white/10 glass:backdrop-blur-md glass:border-white/20
        animate-pulse ${className}
      `}>
        <div className="space-y-3">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  const getTrendIcon = () => {
    if (!change) return null
    
    if (change.value > 0) return <ArrowUpIcon className="w-3 h-3" />
    if (change.value < 0) return <ArrowDownIcon className="w-3 h-3" />
    return <MinusIcon className="w-3 h-3" />
  }

  return (
    <div
      className={`
        ${colorScheme.bg} ${colorScheme.border} border rounded-lg ${sizeScheme.padding}
        transition-all duration-200 relative overflow-hidden
        ${style === 'glass' ? 'glass-panel' : ''}
        glass:bg-white/10 glass:backdrop-blur-md glass:border-white/20
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:scale-105 transform' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Accent Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${colorScheme.accent}`} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Title */}
          <div className="flex items-center space-x-2 mb-2">
            {Icon && (
              <Icon className={`${sizeScheme.iconSize} ${colorScheme.icon}`} />
            )}
            <h3 className={`${sizeScheme.titleText} font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide`}>
              {title}
            </h3>
          </div>

          {/* Value */}
          <div className="mb-2">
            <span className={`${sizeScheme.valueText} font-bold text-gray-900 dark:text-white`}>
              {value}
            </span>
            {unit && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">
                {unit}
              </span>
            )}
          </div>

          {/* Change Indicator */}
          {change && (
            <div className={`flex items-center space-x-1 ${
              change.isPositive 
                ? 'text-green-600 dark:text-green-400' 
                : change.value < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}>
              {getTrendIcon()}
              <span className={`${sizeScheme.changeText} font-medium`}>
                {Math.abs(change.value)}%
              </span>
              <span className={`${sizeScheme.changeText} text-gray-500 dark:text-gray-400`}>
                {change.period}
              </span>
            </div>
          )}
        </div>

        {/* Optional action indicator */}
        {isClickable && (
          <div className="ml-3">
            <ArrowUpIcon className="w-4 h-4 text-gray-400 transform rotate-45" />
          </div>
        )}
      </div>
    </div>
  )
})