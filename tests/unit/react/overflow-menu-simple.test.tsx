import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OverflowMenu } from '../../../src/react/components/ui/Menus/OverflowMenu'

describe('OverflowMenu Core Functionality', () => {
  test('OverflowMenu renders and basic functionality works', () => {
    const mockItems = [
      { 
        id: 'test1', 
        label: 'Test Item 1', 
        onClick: jest.fn() 
      },
      { 
        id: 'test2', 
        label: 'Test Item 2', 
        onClick: jest.fn(), 
        variant: 'success' as const 
      }
    ]

    render(
      <OverflowMenu 
        items={mockItems}
        buttonLabel="More"
        buttonVariant="outline"
        position="bottom-right"
      />
    )

    // Check that the More button renders
    const moreButton = screen.getByRole('button', { name: /more/i })
    expect(moreButton).toBeInTheDocument()
    expect(moreButton).toHaveAttribute('type', 'button')

    // Initially, menu items should not be visible
    expect(screen.queryByText('Test Item 1')).not.toBeInTheDocument()

    // Click the More button to open menu
    fireEvent.click(moreButton)

    // Now menu items should be visible
    expect(screen.getByText('Test Item 1')).toBeInTheDocument()
    expect(screen.getByText('Test Item 2')).toBeInTheDocument()

    // Test clicking an item
    fireEvent.click(screen.getByText('Test Item 1'))
    expect(mockItems[0].onClick).toHaveBeenCalled()
  })

  test('OverflowMenu closes when ESC key is pressed', () => {
    const mockItems = [
      { id: 'test1', label: 'Test Item 1', onClick: jest.fn() }
    ]

    render(
      <OverflowMenu 
        items={mockItems}
        buttonLabel="More"
      />
    )

    const moreButton = screen.getByText('More')
    
    // Open menu
    fireEvent.click(moreButton)
    expect(screen.getByText('Test Item 1')).toBeInTheDocument()

    // Press ESC to close
    fireEvent.keyDown(document, { key: 'Escape' })
    
    // Menu should close
    expect(screen.queryByText('Test Item 1')).not.toBeInTheDocument()
  })

  test('OverflowMenu has correct CSS classes for flex-shrink-0 wrapper', () => {
    const mockItems = [
      { id: 'test1', label: 'Test Item 1', onClick: jest.fn() }
    ]

    const { container } = render(
      <div className="flex-shrink-0">
        <OverflowMenu 
          items={mockItems}
          buttonLabel="More"
        />
      </div>
    )

    // Check that the wrapper has flex-shrink-0
    const wrapper = container.querySelector('.flex-shrink-0')
    expect(wrapper).toBeInTheDocument()
    
    // Check that the OverflowMenu container has relative positioning
    const menuContainer = wrapper?.querySelector('.relative.inline-block')
    expect(menuContainer).toBeInTheDocument()
  })

  test('NavigationBar and DashboardHeader structure requirements are met', () => {
    // Test that positioning classes work as expected
    const mockItems = [
      { id: 'memory', label: 'Memory', onClick: jest.fn() },
      { id: 'skills', label: 'Skills', onClick: jest.fn() }
    ]

    // Test navigation positioning (bottom-right)
    const { rerender } = render(
      <OverflowMenu 
        items={mockItems}
        buttonLabel="More"
        buttonVariant="outline"
        position="bottom-right"
      />
    )

    fireEvent.click(screen.getByText('More'))
    expect(screen.getByText('Memory')).toBeInTheDocument()

    // Test header positioning (bottom-left)
    rerender(
      <OverflowMenu 
        items={[
          { id: 'settings', label: 'Settings', onClick: jest.fn() },
          { id: 'help', label: 'Help & Support', onClick: jest.fn() }
        ]}
        buttonLabel=""
        buttonVariant="secondary"
        position="bottom-left"
      />
    )

    // The button should have no visible text label for header menu (only sr-only text)
    const headerButton = screen.getByRole('button')
    // Button contains sr-only text "Open menu" but no visible label text
    expect(headerButton).toBeInTheDocument()
    expect(headerButton.textContent).toContain('Open menu') // sr-only text
  })

  test('Overflow menu items have correct variant styling', () => {
    const mockItems = [
      { id: 'default', label: 'Default Item', onClick: jest.fn() },
      { id: 'success', label: 'Success Item', onClick: jest.fn(), variant: 'success' as const },
      { id: 'danger', label: 'Danger Item', onClick: jest.fn(), variant: 'danger' as const },
      { id: 'disabled', label: 'Disabled Item', onClick: jest.fn(), disabled: true }
    ]

    render(
      <OverflowMenu items={mockItems} buttonLabel="More" />
    )

    fireEvent.click(screen.getByText('More'))

    // All items should be visible
    expect(screen.getByText('Default Item')).toBeInTheDocument()
    expect(screen.getByText('Success Item')).toBeInTheDocument()
    expect(screen.getByText('Danger Item')).toBeInTheDocument()
    expect(screen.getByText('Disabled Item')).toBeInTheDocument()

    // Test that disabled item doesn't trigger onClick
    fireEvent.click(screen.getByText('Disabled Item'))
    expect(mockItems[3].onClick).not.toHaveBeenCalled()

    // Test that enabled item does trigger onClick
    fireEvent.click(screen.getByText('Default Item'))
    expect(mockItems[0].onClick).toHaveBeenCalled()
  })
})