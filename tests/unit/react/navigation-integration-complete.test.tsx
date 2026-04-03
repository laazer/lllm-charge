import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavigationBar } from '../../../src/react/components/layout/Navigation/NavigationBar'
import '@testing-library/jest-dom'

// Mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  HomeIcon: () => <div data-testid="home-icon">HomeIcon</div>,
  DocumentTextIcon: () => <div data-testid="document-icon">DocumentTextIcon</div>,
  FolderIcon: () => <div data-testid="folder-icon">FolderIcon</div>,
  UserGroupIcon: () => <div data-testid="users-icon">UserGroupIcon</div>,
  Cog6ToothIcon: () => <div data-testid="workflows-icon">Cog6ToothIcon</div>,
  CommandLineIcon: () => <div data-testid="command-icon">CommandLineIcon</div>,
  CodeBracketIcon: () => <div data-testid="code-icon">CodeBracketIcon</div>,
  CpuChipIcon: () => <div data-testid="cpu-icon">CpuChipIcon</div>,
  AcademicCapIcon: () => <div data-testid="academic-icon">AcademicCapIcon</div>,
  Cog8ToothIcon: () => <div data-testid="cog8-icon">Cog8ToothIcon</div>,
  BookOpenIcon: () => <div data-testid="book-icon">BookOpenIcon</div>,
  BoltIcon: () => <div data-testid="bolt-icon">BoltIcon</div>,
  BeakerIcon: () => <div data-testid="beaker-icon">BeakerIcon</div>,
  CubeIcon: () => <div data-testid="cube-icon">CubeIcon</div>,
}))

// Mock OverflowMenu component
jest.mock('../../../src/react/components/ui/Menus/OverflowMenu', () => ({
  OverflowMenu: ({ items, buttonLabel, onItemClick }: any) => (
    <div data-testid="overflow-menu">
      <button data-testid="overflow-button">{buttonLabel}</button>
      <div data-testid="overflow-items">
        {items.map((item: any) => (
          <button 
            key={item.id} 
            data-testid={`overflow-item-${item.id}`}
            onClick={() => item.onClick?.()}
            className={item.variant === 'success' ? 'active-item' : ''}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}))

describe('Navigation Integration Complete Tests', () => {
  let mockOnSectionChange: jest.Mock

  beforeEach(() => {
    mockOnSectionChange = jest.fn()
    
    // Mock window.location.hash
    delete (window as any).location
    window.location = { ...window.location, hash: '' }
    
    // Mock window.dispatchEvent
    window.dispatchEvent = jest.fn()
  })

  const renderNavigation = (currentSection = 'overview') => {
    return render(
      <MemoryRouter>
        <NavigationBar 
          currentSection={currentSection} 
          onSectionChange={mockOnSectionChange} 
        />
      </MemoryRouter>
    )
  }

  describe('Primary Navigation Items', () => {
    test('should render all primary navigation items', () => {
      renderNavigation()
      
      // Check all primary navigation items are present
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Specs')).toBeInTheDocument()
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Agents')).toBeInTheDocument()
      expect(screen.getByText('Workflows')).toBeInTheDocument()
      expect(screen.getByText('API Dev')).toBeInTheDocument()
    })

    test('should display correct icons for primary navigation', () => {
      renderNavigation()
      
      // Check that icons are rendered
      expect(screen.getByTestId('home-icon')).toBeInTheDocument() // Overview
      expect(screen.getByTestId('document-icon')).toBeInTheDocument() // Specs
      expect(screen.getByTestId('folder-icon')).toBeInTheDocument() // Projects
      expect(screen.getByTestId('users-icon')).toBeInTheDocument() // Agents
      expect(screen.getByTestId('workflows-icon')).toBeInTheDocument() // Workflows
      expect(screen.getByTestId('command-icon')).toBeInTheDocument() // API Dev
    })

    test('should show correct descriptions for primary items', () => {
      renderNavigation()
      
      // Check API Dev description specifically (new addition)
      const apiDevButton = screen.getByText('API Dev').closest('button')
      expect(apiDevButton).toHaveAttribute('title', 'Django, FastAPI, and FastMCP development tools')
    })

    test('should highlight active section correctly', () => {
      renderNavigation('projects')
      
      const projectsButton = screen.getByText('Projects').closest('button')
      expect(projectsButton).toHaveClass(/bg-blue-100/) // Active state class
    })
  })

  describe('Secondary Navigation (Overflow Menu)', () => {
    test('should render overflow menu with More button', () => {
      renderNavigation()
      
      expect(screen.getByTestId('overflow-button')).toBeInTheDocument()
      expect(screen.getByText('More')).toBeInTheDocument()
    })

    test('should include all secondary navigation items', () => {
      renderNavigation()
      
      // Check that all secondary items are in the overflow menu
      expect(screen.getByTestId('overflow-item-react-dev')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-memory')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-skills')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-cronjobs')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-codegraph')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-devdocs')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-hybrid-reasoning')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-playground')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-mcp')).toBeInTheDocument()
      expect(screen.getByTestId('overflow-item-godot')).toBeInTheDocument()
    })

    test('should show correct text for Godot Dev in overflow menu', () => {
      renderNavigation()
      
      const godotItem = screen.getByTestId('overflow-item-godot')
      expect(godotItem).toHaveTextContent('Godot Dev')
    })

    test('should highlight active secondary item', () => {
      renderNavigation('godot')
      
      const godotItem = screen.getByTestId('overflow-item-godot')
      expect(godotItem).toHaveClass('active-item')
    })
  })

  describe('Navigation Interaction', () => {
    test('should call onSectionChange when primary navigation item is clicked', () => {
      renderNavigation()
      
      const specsButton = screen.getByText('Specs')
      fireEvent.click(specsButton)
      
      expect(mockOnSectionChange).toHaveBeenCalledWith('specs')
    })

    test('should call onSectionChange when API Dev is clicked', () => {
      renderNavigation()
      
      const apiDevButton = screen.getByText('API Dev')
      fireEvent.click(apiDevButton)
      
      expect(mockOnSectionChange).toHaveBeenCalledWith('api-dev')
    })

    test('should call onSectionChange when secondary navigation item is clicked', () => {
      renderNavigation()
      
      const godotItem = screen.getByTestId('overflow-item-godot')
      fireEvent.click(godotItem)
      
      expect(mockOnSectionChange).toHaveBeenCalledWith('godot')
    })

    test('should update window hash when navigation item is clicked', () => {
      renderNavigation()
      
      const projectsButton = screen.getByText('Projects')
      fireEvent.click(projectsButton)
      
      expect(window.location.hash).toBe('projects')
    })

    test('should dispatch custom sectionChange event', () => {
      renderNavigation()
      
      const agentsButton = screen.getByText('Agents')
      fireEvent.click(agentsButton)
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('sectionChange', { detail: { section: 'agents' } })
      )
    })
  })

  describe('Navigation State Management', () => {
    test('should handle overview section activation', () => {
      renderNavigation('overview')
      
      const overviewButton = screen.getByText('Overview').closest('button')
      expect(overviewButton).toHaveClass(/bg-blue-100/)
    })

    test('should handle workflows section activation', () => {
      renderNavigation('workflows')
      
      const workflowsButton = screen.getByText('Workflows').closest('button')
      expect(workflowsButton).toHaveClass(/bg-blue-100/)
    })

    test('should handle api-dev section activation', () => {
      renderNavigation('api-dev')
      
      const apiDevButton = screen.getByText('API Dev').closest('button')
      expect(apiDevButton).toHaveClass(/bg-blue-100/)
    })

    test('should handle secondary section activation in overflow menu', () => {
      renderNavigation('react-dev')
      
      const reactDevItem = screen.getByTestId('overflow-item-react-dev')
      expect(reactDevItem).toHaveClass('active-item')
    })
  })

  describe('Responsive Design', () => {
    test('should maintain layout structure on different screen sizes', () => {
      renderNavigation()
      
      // Should have primary navigation container
      const primaryNav = screen.getByText('Overview').closest('.flex')
      expect(primaryNav).toBeInTheDocument()
      
      // Should have overflow menu container
      const overflowContainer = screen.getByTestId('overflow-menu')
      expect(overflowContainer).toBeInTheDocument()
    })

    test('should show navigation items with proper spacing', () => {
      renderNavigation()
      
      // Check that navigation container has proper styling classes
      const navContainer = screen.getByRole('navigation')
      expect(navContainer).toHaveClass(/bg-gray-50/)
      expect(navContainer).toHaveClass(/dark:bg-slate-800/)
    })
  })

  describe('Theme Integration', () => {
    test('should apply dark mode classes correctly', () => {
      renderNavigation()
      
      const navigation = screen.getByRole('navigation')
      expect(navigation).toHaveClass(/dark:bg-slate-800/)
      expect(navigation).toHaveClass(/dark:border-slate-700/)
    })

    test('should apply glass theme classes', () => {
      renderNavigation()
      
      const navigation = screen.getByRole('navigation')
      expect(navigation).toHaveClass(/glass:bg-white\/5/)
      expect(navigation).toHaveClass(/glass:backdrop-blur-md/)
    })
  })

  describe('Navigation Item Descriptions', () => {
    test('should have correct description for each primary item', () => {
      renderNavigation()
      
      const buttons = screen.getAllByRole('button')
      const primaryButtons = buttons.filter(btn => 
        ['Overview', 'Specs', 'Projects', 'Agents', 'Workflows', 'API Dev'].includes(btn.textContent || '')
      )

      expect(primaryButtons).toHaveLength(6)
      
      // Check specific descriptions
      const apiDevButton = screen.getByText('API Dev').closest('button')
      expect(apiDevButton).toHaveAttribute('title', 'Django, FastAPI, and FastMCP development tools')
      
      const workflowsButton = screen.getByText('Workflows').closest('button')
      expect(workflowsButton).toHaveAttribute('title', 'Workflow automation and processes')
    })
  })

  describe('Edge Cases', () => {
    test('should handle unknown section gracefully', () => {
      expect(() => renderNavigation('unknown-section')).not.toThrow()
    })

    test('should handle undefined currentSection', () => {
      expect(() => renderNavigation(undefined as any)).not.toThrow()
    })

    test('should handle missing onSectionChange callback', () => {
      render(
        <MemoryRouter>
          <NavigationBar currentSection="overview" />
        </MemoryRouter>
      )
      
      const overviewButton = screen.getByText('Overview')
      expect(() => fireEvent.click(overviewButton)).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    test('should have proper navigation role', () => {
      renderNavigation()
      
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    test('should have accessible button elements', () => {
      renderNavigation()
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      
      // Each button should be accessible
      buttons.forEach(button => {
        expect(button).toBeInTheDocument()
        expect(button).not.toBeDisabled()
      })
    })

    test('should support keyboard navigation', () => {
      renderNavigation()
      
      const firstButton = screen.getByText('Overview')
      firstButton.focus()
      
      expect(document.activeElement).toBe(firstButton)
    })
  })
})