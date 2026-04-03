import React, { ReactNode } from 'react'
import { DashboardHeader } from './Header/DashboardHeader'
import { NavigationBar } from './Navigation/NavigationBar'
import { DashboardFooter } from './Footer/DashboardFooter'
import { useTheme } from '../../store/theme-store'

interface DashboardLayoutProps {
  children: ReactNode
  currentSection?: string
  onSectionChange?: (section: string) => void
}

export function DashboardLayout({ children, currentSection = 'overview', onSectionChange }: DashboardLayoutProps) {
  const { theme, style } = useTheme()

  return (
    <div className={`min-h-screen bg-white dark:bg-slate-900 transition-all duration-300 ${
      style === 'glass' ? 'style-liquid-glass' : ''
    }`}>
      {/* Dashboard Header */}
      <DashboardHeader />
      
      {/* Navigation Bar */}
      <NavigationBar 
        currentSection={currentSection}
        onSectionChange={onSectionChange}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      
      {/* Dashboard Footer */}
      <DashboardFooter />
    </div>
  )
}