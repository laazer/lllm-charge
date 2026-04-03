import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NavigationBar } from '../../../src/react/components/layout/Navigation/NavigationBar'
import { DashboardHeader } from '../../../src/react/components/layout/Header/DashboardHeader'
import { OverflowMenu } from '../../../src/react/components/ui/Menus/OverflowMenu'

// Mock the theme store
jest.mock('../../../src/react/store/theme-store', () => ({
  useTheme: jest.fn(() => ({ style: 'default' }))
}))

// Mock the project selector and other components
jest.mock('../../../src/react/components/layout/Header/ProjectSelector', () => ({
  ProjectSelector: () => <div data-testid="project-selector">Project Selector</div>
}))

jest.mock('../../../src/react/components/layout/Header/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>
}))

jest.mock('../../../src/react/components/layout/Header/ConnectionStatus', () => ({
  ConnectionStatus: () => <div data-testid="connection-status">Connection Status</div>
}))

jest.mock('../../../src/react/components/layout/Navigation/NavigationButton', () => ({
  NavigationButton: ({ id, label, isActive, onClick }: any) => (
    <button data-testid={`nav-button-${id}`} onClick={onClick} className={isActive ? 'active' : ''}>
      {label}
    </button>
  )
}))

describe('Overflow Menu Integration Tests', () => {
  beforeEach(() => {
    // Clear any previous DOM state
    document.body.innerHTML = ''
  })

  test('NavigationBar renders overflow menu with correct positioning', () => {
    render(
      <NavigationBar currentSection="overview" onSectionChange={jest.fn()} />
    )

    // Check that primary navigation buttons are visible
    expect(screen.getByTestId('nav-button-overview')).toBeInTheDocument()
    expect(screen.getByTestId('nav-button-specs')).toBeInTheDocument()
    expect(screen.getByTestId('nav-button-projects')).toBeInTheDocument()
    expect(screen.getByTestId('nav-button-agents')).toBeInTheDocument()
    expect(screen.getByTestId('nav-button-workflows')).toBeInTheDocument()

    // Check that overflow menu button is present
    const moreButton = screen.getByText('More')
    expect(moreButton).toBeInTheDocument()
    expect(moreButton.closest('div')).toHaveClass('flex-shrink-0')
  })

  test('NavigationBar overflow menu shows secondary items when clicked', async () => {
    const mockSectionChange = jest.fn()
    render(
      <NavigationBar currentSection="overview" onSectionChange={mockSectionChange} />
    )

    // Click the More button
    const moreButton = screen.getByText('More')
    fireEvent.click(moreButton)

    // Check that secondary navigation items appear
    await waitFor(() => {
      expect(screen.getByText('Memory')).toBeInTheDocument()
      expect(screen.getByText('Skills')).toBeInTheDocument()
      expect(screen.getByText('Cron Jobs')).toBeInTheDocument()
      expect(screen.getByText('CodeGraph')).toBeInTheDocument()
      expect(screen.getByText('DevDocs')).toBeInTheDocument()
      expect(screen.getByText('Reasoning')).toBeInTheDocument()
      expect(screen.getByText('Playground')).toBeInTheDocument()
      expect(screen.getByText('MCP')).toBeInTheDocument()
    })

    // Click on a secondary item
    fireEvent.click(screen.getByText('Memory'))
    expect(mockSectionChange).toHaveBeenCalledWith('memory')
  })

  test('DashboardHeader overflow menu has different positioning', () => {
    render(<DashboardHeader />)

    // Find the header overflow menu button (should be ellipsis only)
    const headerMoreButtons = screen.getAllByRole('button')
    const headerOverflowButton = headerMoreButtons.find(button => 
      button.querySelector('svg') && !button.textContent?.includes('More')
    )
    expect(headerOverflowButton).toBeInTheDocument()
  })

  test('Both overflow menus can coexist without overlap', async () => {
    // Render both components together to test for conflicts
    render(
      <div>
        <DashboardHeader />
        <NavigationBar currentSection="overview" onSectionChange={jest.fn()} />
      </div>
    )

    // Open navigation overflow menu
    const navMoreButton = screen.getByText('More')
    fireEvent.click(navMoreButton)

    await waitFor(() => {
      expect(screen.getByText('Memory')).toBeInTheDocument()
    })

    // Find and open header overflow menu
    const headerMoreButtons = screen.getAllByRole('button')
    const headerOverflowButton = headerMoreButtons.find(button => 
      button.querySelector('svg') && !button.textContent?.includes('More')
    )
    
    if (headerOverflowButton) {
      fireEvent.click(headerOverflowButton)
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })
    }

    // Both menus should be open and visible without conflicting
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('OverflowMenu component handles positioning props correctly', () => {
    const mockItems = [
      { id: 'test1', label: 'Test 1', onClick: jest.fn() },
      { id: 'test2', label: 'Test 2', onClick: jest.fn(), variant: 'success' as const }
    ]

    const { rerender } = render(
      <OverflowMenu 
        items={mockItems} 
        buttonLabel="Test More" 
        position="bottom-right" 
      />
    )

    const button = screen.getByText('Test More')
    fireEvent.click(button)

    // Menu should appear with bottom-right positioning
    const menuContainer = document.querySelector('.origin-top-right.right-0.mt-2')
    expect(menuContainer).toBeInTheDocument()

    // Test different positioning
    rerender(
      <OverflowMenu 
        items={mockItems} 
        buttonLabel="Test More" 
        position="bottom-left" 
      />
    )

    fireEvent.click(button)
    const leftMenuContainer = document.querySelector('.origin-top-left.left-0.mt-2')
    expect(leftMenuContainer).toBeInTheDocument()
  })

  test('OverflowMenu handles keyboard navigation and accessibility', () => {
    const mockItems = [
      { id: 'test1', label: 'Test 1', onClick: jest.fn() },
      { id: 'test2', label: 'Test 2', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu 
        items={mockItems} 
        buttonLabel="Test More" 
      />
    )

    const button = screen.getByText('Test More')
    
    // Check ARIA attributes
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-haspopup', 'true')
    
    // Open menu
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Test ESC key closes menu
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})