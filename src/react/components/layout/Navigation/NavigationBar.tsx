import React from 'react'
import { NavigationButton } from './NavigationButton'
import { OverflowMenu } from '../../ui/Menus/OverflowMenu'
import {
  HomeIcon,
  DocumentTextIcon,
  CpuChipIcon,
  FolderIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  BookOpenIcon,
  BoltIcon,
  AcademicCapIcon,
  CodeBracketIcon,
  BeakerIcon,
  Cog8ToothIcon,
  CommandLineIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'

interface NavigationBarProps {
  currentSection: string
  onSectionChange?: (section: string) => void
}

// Primary navigation items (always visible)
const primaryNavigationItems = [
  {
    id: 'overview',
    label: 'Overview',
    icon: HomeIcon,
    description: 'Dashboard overview and metrics'
  },
  {
    id: 'specs',
    label: 'Specs',
    icon: DocumentTextIcon,
    description: 'Specifications and documentation'
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderIcon,
    description: 'Project management and organization'
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: UserGroupIcon,
    description: 'AI agents and automation'
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: Cog6ToothIcon,
    description: 'Workflow automation and processes'
  },
  {
    id: 'api-dev',
    label: 'API Dev',
    icon: CommandLineIcon,
    description: 'Django, FastAPI, and FastMCP development tools'
  }
]

// Secondary navigation items (overflow menu)
const secondaryNavigationItems = [
  {
    id: 'react-dev',
    label: 'React Dev',
    icon: CodeBracketIcon,
    description: 'React component scaffolding and analysis tools'
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: CpuChipIcon,
    description: 'Notes and memory management'
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: AcademicCapIcon,
    description: 'Agent skills and capabilities'
  },
  {
    id: 'cronjobs',
    label: 'Cron Jobs',
    icon: Cog8ToothIcon,
    description: 'Scheduled background tasks and monitoring'
  },
  {
    id: 'codegraph',
    label: 'CodeGraph',
    icon: CodeBracketIcon,
    description: 'Code symbol search and analysis'
  },
  {
    id: 'devdocs',
    label: 'DevDocs',
    icon: BookOpenIcon,
    description: 'Offline documentation access'
  },
  {
    id: 'hybrid-reasoning',
    label: 'Reasoning',
    icon: BoltIcon,
    description: 'Hybrid reasoning and cost tracking'
  },
  {
    id: 'playground',
    label: 'Playground',
    icon: BeakerIcon,
    description: 'Interactive prompt testing and comparison'
  },
  {
    id: 'mcp',
    label: 'MCP',
    icon: CommandLineIcon,
    description: 'Model Context Protocol tools and monitoring'
  },
  {
    id: 'godot',
    label: 'Godot Dev',
    icon: CubeIcon,
    description: 'Game development tools and Godot project management'
  },
  {
    id: 'buddies',
    label: 'Buddies',
    icon: ChatBubbleLeftRightIcon,
    description: 'Customizable AI companion tools'
  },
  {
    id: 'blender',
    label: 'Blender 3D',
    icon: CubeIcon,
    description: '3D generation pipeline with Blender integration'
  }
]

export function NavigationBar({ currentSection, onSectionChange }: NavigationBarProps) {
  const handleSectionChange = (sectionId: string) => {
    // Update URL hash
    window.location.hash = sectionId
    
    // Call parent handler if provided
    onSectionChange?.(sectionId)
    
    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('sectionChange', { 
      detail: { section: sectionId } 
    }))
  }

  return (
    <nav className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700
                  glass:bg-white/5 glass:backdrop-blur-md glass:border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center space-x-1 py-2">
          {/* Primary navigation tabs */}
          <div className="flex space-x-1 flex-1">
            {primaryNavigationItems.map((item) => (
              <NavigationButton
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                description={item.description}
                isActive={currentSection === item.id}
                onClick={() => handleSectionChange(item.id)}
              />
            ))}
          </div>
          
          {/* Overflow menu for secondary tabs */}
          <div className="flex-shrink-0">
            <OverflowMenu
              items={secondaryNavigationItems.map((item) => ({
                id: item.id,
                label: item.label,
                icon: item.icon,
                onClick: () => handleSectionChange(item.id),
                variant: currentSection === item.id ? 'success' : 'default'
              }))}
              buttonLabel="More"
              buttonVariant="outline"
              position="bottom-right"
              className=""
            />
          </div>
        </div>
      </div>
    </nav>
  )
}