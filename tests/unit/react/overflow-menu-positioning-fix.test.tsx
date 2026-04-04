import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OverflowMenu } from '../../../src/react/components/ui/Menus/OverflowMenu'

describe('OverflowMenu Positioning Fixes', () => {
  test('Menu positioned correctly with top-full to avoid overlap', () => {
    const mockItems = [
      { id: 'test1', label: 'Test Item 1', onClick: jest.fn() },
      { id: 'test2', label: 'Test Item 2', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu 
        items={mockItems}
        buttonLabel="More"
        buttonVariant="outline"
        position="bottom-right"
      />
    )

    // Open the menu
    const button = screen.getByText('More')
    fireEvent.click(button)

    // Check that the menu container has the correct positioning classes (portal-based)
    const menuContainer = document.querySelector('.fixed.z-\\[9999\\]')
    expect(menuContainer).toBeInTheDocument()
    
    // Check for fixed positioning class and inline styles
    expect(menuContainer).toHaveClass('fixed')
    expect(menuContainer).toHaveClass('z-[9999]')
    
    // Check that position is calculated and applied via inline styles
    expect(menuContainer).toHaveAttribute('style')
    expect(menuContainer?.getAttribute('style')).toContain('top:')
    expect(menuContainer?.getAttribute('style')).toContain('left:')

    // Verify high z-index for proper layering
    expect(menuContainer).toHaveClass('z-[9999]')
  })

  test('Bottom-left position uses correct classes to avoid header overlap', () => {
    const mockItems = [
      { id: 'settings', label: 'Settings', onClick: jest.fn() },
      { id: 'help', label: 'Help & Support', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu 
        items={mockItems}
        buttonLabel=""
        buttonVariant="secondary"
        position="bottom-left"
      />
    )

    // Open the menu
    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Check that the menu container has the correct positioning for header (portal-based)
    const menuContainer = document.querySelector('.fixed.z-\\[9999\\]')
    expect(menuContainer).toBeInTheDocument()
    
    // Check for fixed positioning class and inline styles
    expect(menuContainer).toHaveClass('fixed')
    expect(menuContainer).toHaveClass('z-[9999]')
    
    // Check that position is calculated and applied
    expect(menuContainer).toHaveAttribute('style')
    expect(menuContainer?.getAttribute('style')).toContain('top:')
    expect(menuContainer?.getAttribute('style')).toContain('left:')
  })

  test('Menu has improved visual styling', () => {
    const mockItems = [
      { id: 'test', label: 'Test Item', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu items={mockItems} buttonLabel="More" />
    )

    fireEvent.click(screen.getByText('More'))

    // Check that the menu has improved styling
    const menuContent = document.querySelector('.rounded-md.bg-white')
    expect(menuContent).toBeInTheDocument()
    expect(menuContent).toHaveClass('shadow-xl')
    expect(menuContent).toHaveClass('border')
    expect(menuContent).toHaveClass('border-gray-200')
  })

  test('Menu items are visible and clickable without overlap', () => {
    const mockItems = [
      { id: 'memory', label: 'Memory', onClick: jest.fn() },
      { id: 'skills', label: 'Skills', onClick: jest.fn() },
      { id: 'cronjobs', label: 'Cron Jobs', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu 
        items={mockItems}
        buttonLabel="More"
        position="bottom-right"
      />
    )

    // Open menu
    fireEvent.click(screen.getByText('More'))

    // All items should be visible
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Cron Jobs')).toBeInTheDocument()

    // Items should be clickable
    fireEvent.click(screen.getByText('Memory'))
    expect(mockItems[0].onClick).toHaveBeenCalled()
  })
})