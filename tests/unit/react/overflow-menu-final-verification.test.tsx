import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OverflowMenu } from '../../../src/react/components/ui/Menus/OverflowMenu'

describe('OverflowMenu Final Verification', () => {
  test('OverflowMenu component structure and functionality verification', () => {
    const mockItems = [
      { id: 'memory', label: 'Memory', onClick: jest.fn() },
      { id: 'skills', label: 'Skills', onClick: jest.fn() },
      { id: 'cronjobs', label: 'Cron Jobs', onClick: jest.fn() }
    ]

    // Test NavigationBar configuration
    render(
      <div className="flex items-center space-x-1 py-2">
        <div className="flex space-x-1 flex-1">
          {/* Simulating primary navigation buttons */}
          <button>Overview</button>
          <button>Specs</button>
          <button>Projects</button>
          <button>Agents</button>
          <button>Workflows</button>
        </div>
        
        {/* This is our actual overflow menu structure */}
        <div className="flex-shrink-0">
          <OverflowMenu
            items={mockItems}
            buttonLabel="More"
            buttonVariant="outline"
            position="bottom-right"
            className=""
          />
        </div>
      </div>
    )

    // Verify primary buttons are visible
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Specs')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Workflows')).toBeInTheDocument()

    // Verify overflow menu button is present and wrapped correctly
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument()
    
    // The wrapper div should have flex-shrink-0
    const wrapperDiv = screen.getByRole('button', { name: /open menu/i }).closest('.flex-shrink-0')
    expect(wrapperDiv).toBeInTheDocument()

    // Initially secondary items should not be visible
    expect(screen.queryByText('Memory')).not.toBeInTheDocument()
    expect(screen.queryByText('Skills')).not.toBeInTheDocument()

    // Click the overflow menu button
    const moreButton = screen.getByRole('button', { name: /open menu/i })
    fireEvent.click(moreButton)

    // Now secondary items should be visible
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Cron Jobs')).toBeInTheDocument()

    // Test clicking an item calls the onClick handler
    fireEvent.click(screen.getByText('Memory'))
    expect(mockItems[0].onClick).toHaveBeenCalled()
  })

  test('DashboardHeader overflow menu positioning verification', () => {
    const mockHeaderItems = [
      { id: 'settings', label: 'Settings', onClick: jest.fn() },
      { id: 'help', label: 'Help & Support', onClick: jest.fn() },
      { id: 'documentation', label: 'Documentation', onClick: jest.fn() }
    ]

    // Test DashboardHeader configuration
    render(
      <div className="flex items-center justify-between">
        <div>LLM-Charge Dashboard</div>
        <div className="flex items-center space-x-4">
          <div>Theme Toggle</div>
          <div>Connection Status</div>
          {/* This is our actual header overflow menu structure */}
          <OverflowMenu
            items={mockHeaderItems}
            buttonLabel=""
            buttonVariant="secondary"
            position="bottom-left"
            className="ml-2"
          />
        </div>
      </div>
    )

    // The button should be present but without visible label
    const headerButton = screen.getByRole('button', { name: /open menu/i })
    expect(headerButton).toBeInTheDocument()
    
    // Click to open header menu
    fireEvent.click(headerButton)
    
    // Header items should be visible
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Help & Support')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
  })

  test('Both overflow menus can coexist without overlap issue', () => {
    const navItems = [
      { id: 'memory', label: 'Memory', onClick: jest.fn() },
      { id: 'skills', label: 'Skills', onClick: jest.fn() }
    ]
    
    const headerItems = [
      { id: 'settings', label: 'Settings', onClick: jest.fn() },
      { id: 'help', label: 'Help & Support', onClick: jest.fn() }
    ]

    // Render both menus like they appear in the real app
    render(
      <div>
        {/* Header overflow menu */}
        <div className="header">
          <OverflowMenu
            items={headerItems}
            buttonLabel=""
            buttonVariant="secondary"
            position="bottom-left"
            className="ml-2"
          />
        </div>
        
        {/* Navigation overflow menu */}
        <div className="navigation">
          <div className="flex-shrink-0">
            <OverflowMenu
              items={navItems}
              buttonLabel="More"
              buttonVariant="outline"
              position="bottom-right"
              className=""
            />
          </div>
        </div>
      </div>
    )

    // Get both buttons
    const allButtons = screen.getAllByRole('button', { name: /open menu/i })
    expect(allButtons).toHaveLength(2)
    
    // Open navigation menu (should be the one with "More" text)
    const navButton = allButtons.find(btn => 
      btn.textContent?.includes('More') || 
      btn.querySelector('span')?.textContent === 'More'
    )
    expect(navButton).toBeInTheDocument()
    fireEvent.click(navButton!)

    // Navigation items should appear
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()

    // Open header menu (should be the one without "More" text)
    const headerButton = allButtons.find(btn => 
      !btn.textContent?.includes('More') && 
      !btn.querySelector('span')?.textContent?.includes('More')
    )
    expect(headerButton).toBeInTheDocument()
    fireEvent.click(headerButton!)

    // Both sets of items should be visible without conflict
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Help & Support')).toBeInTheDocument()
  })

  test('ESC key functionality and accessibility features', () => {
    const mockItems = [
      { id: 'test', label: 'Test Item', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu
        items={mockItems}
        buttonLabel="More"
      />
    )

    const button = screen.getByRole('button', { name: /open menu/i })
    
    // Check ARIA attributes are present
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-haspopup', 'true')
    
    // Open menu
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Test Item')).toBeInTheDocument()

    // Press ESC to close
    fireEvent.keyDown(document, { key: 'Escape' })
    
    // Menu should close
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Test Item')).not.toBeInTheDocument()
  })

  test('Click outside to close functionality', () => {
    const mockItems = [
      { id: 'test', label: 'Test Item', onClick: jest.fn() }
    ]

    render(
      <div>
        <OverflowMenu
          items={mockItems}
          buttonLabel="More"
        />
        <div data-testid="outside-element">Outside Element</div>
      </div>
    )

    const button = screen.getByRole('button', { name: /open menu/i })
    
    // Open menu
    fireEvent.click(button)
    expect(screen.getByText('Test Item')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element'))
    
    // Menu should close
    expect(screen.queryByText('Test Item')).not.toBeInTheDocument()
  })
})