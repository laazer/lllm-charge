import React from 'react'
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ClockIcon,
  XCircleIcon 
} from '@heroicons/react/24/outline'
import { useTheme } from '../../../store/theme-store'

export interface StatusCardProps {
  title: string
  value: string | number
  status: 'success' | 'warning' | 'error' | 'info' | 'pending'
  description?: string
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  className?: string
}

const statusConfig = {
  success: {
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    iconColor: 'text-green-500',
    icon: CheckCircleIcon
  },
  warning: {
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    iconColor: 'text-yellow-500',
    icon: ExclamationCircleIcon
  },
  error: {
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
    iconColor: 'text-red-500',
    icon: XCircleIcon
  },
  info: {
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    iconColor: 'text-blue-500',
    icon: ClockIcon
  },
  pending: {
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-700 dark:text-gray-300',
    iconColor: 'text-gray-500',
    icon: ClockIcon
  }
}

export function StatusCard({
  title,
  value,
  status,
  description,
  trend,
  icon: CustomIcon,
  onClick,
  className = ''
}: StatusCardProps) {
  const config = statusConfig[status]
  const IconComponent = CustomIcon || config.icon
  const { style } = useTheme()
  const isClickable = Boolean(onClick)

  return (
    <div
      className={`
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        border rounded-lg p-6 transition-all duration-200
        ${style === 'glass' ? 'glass-panel' : ''}
        glass:bg-white/10 glass:backdrop-blur-md glass:border-white/20
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:scale-105 transform' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-2">
            <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </h3>
          </div>

          {/* Main Value */}
          <div className="mb-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {description}
            </p>
          )}

          {/* Trend */}
          {trend && (
            <div className="flex items-center space-x-1">
              <span className={`text-sm font-medium ${
                trend.isPositive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {trend.label}
              </span>
            </div>
          )}
        </div>

        {/* Status Indicator Dot */}
        <div className={`w-3 h-3 rounded-full ${config.iconColor.replace('text-', 'bg-')} 
                       ${status === 'pending' ? 'animate-pulse' : ''}`} />
      </div>
    </div>
  )
}