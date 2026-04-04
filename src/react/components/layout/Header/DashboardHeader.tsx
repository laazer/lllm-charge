import React from 'react'
import { ProjectSelector } from './ProjectSelector'
import { ThemeToggle } from './ThemeToggle'
import { ConnectionStatus } from './ConnectionStatus'
import { OverflowMenu } from '../../ui/Menus/OverflowMenu'
import { useTheme } from '../../../store/theme-store'
import { 
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  UserIcon
} from '@heroicons/react/24/outline'

export function DashboardHeader() {
  const { style } = useTheme()
  
  return (
    <header className={`bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 
                     shadow-sm transition-all duration-300
                     ${style === 'glass' ? 'glass-panel' : ''}
                     glass:bg-white/10 glass:backdrop-blur-md glass:border-white/20`}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">LC</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                LLM-Charge Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Intelligent LLM Optimization Platform
              </p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center space-x-4">
            <ProjectSelector />
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <ConnectionStatus />
              <OverflowMenu
                items={[
                  {
                    id: 'settings',
                    label: 'Settings',
                    icon: Cog6ToothIcon,
                    onClick: () => window.open('/settings', '_blank')
                  },
                  {
                    id: 'help',
                    label: 'Help & Support',
                    icon: QuestionMarkCircleIcon,
                    onClick: () => window.open('/help', '_blank')
                  },
                  {
                    id: 'documentation',
                    label: 'Documentation',
                    icon: DocumentTextIcon,
                    onClick: () => window.open('/docs', '_blank')
                  },
                  {
                    id: 'profile',
                    label: 'User Profile',
                    icon: UserIcon,
                    onClick: () => console.log('Open user profile')
                  }
                ]}
                buttonLabel=""
                buttonVariant="secondary"
                position="bottom-left"
                className="ml-2"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}