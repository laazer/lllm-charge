import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'

interface OverflowMenuItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'danger' | 'success'
}

interface OverflowMenuProps {
  items: OverflowMenuItem[]
  buttonLabel?: string
  buttonVariant?: 'default' | 'secondary' | 'outline'
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  className?: string
}

export function OverflowMenu({
  items,
  buttonLabel = 'More',
  buttonVariant = 'secondary',
  position = 'bottom-right',
  className = ''
}: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close menu on ESC key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Calculate menu position relative to the viewport (fixed positioning)
  const calculateMenuPosition = () => {
    if (!buttonRef.current) return

    const buttonRect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 200

    let top = 0
    let left = 0

    switch (position) {
      case 'bottom-left':
        top = buttonRect.bottom + 8
        left = buttonRect.left
        break
      case 'bottom-right':
        top = buttonRect.bottom + 8
        left = buttonRect.right - menuWidth
        break
      case 'top-left':
        top = buttonRect.top - 8
        left = buttonRect.left
        break
      case 'top-right':
        top = buttonRect.top - 8
        left = buttonRect.right - menuWidth
        break
    }

    // Clamp to viewport bounds
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))

    setMenuPosition({ top, left })
  }

  // Update position when menu opens, and on resize/scroll
  useEffect(() => {
    if (isOpen) {
      calculateMenuPosition()

      const handleResize = () => calculateMenuPosition()
      const handleScroll = () => setIsOpen(false)
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isOpen, position])

  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
    
    switch (buttonVariant) {
      case 'default':
        return `${baseClasses} bg-blue-600 hover:bg-blue-700 text-white`
      case 'outline':
        return `${baseClasses} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700`
      case 'secondary':
      default:
        return `${baseClasses} bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white`
    }
  }


  const getItemClasses = (item: OverflowMenuItem) => {
    const baseClasses = 'flex items-center px-4 py-2 text-sm transition-colors'
    
    if (item.disabled) {
      return `${baseClasses} text-gray-400 dark:text-gray-500 cursor-not-allowed`
    }

    switch (item.variant) {
      case 'danger':
        return `${baseClasses} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer`
      case 'success':
        return `${baseClasses} text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer`
      case 'default':
      default:
        return `${baseClasses} text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer`
    }
  }

  const handleItemClick = (event: React.MouseEvent, item: OverflowMenuItem) => {
    event.stopPropagation()
    if (!item.disabled) {
      item.onClick()
      setIsOpen(false)
    }
  }

  return (
    <>
      <div className={`relative inline-block text-left ${className}`}>
        <button
          ref={buttonRef}
          type="button"
          className={getButtonClasses()}
          onClick={(event) => {
            event.stopPropagation()
            setIsOpen(!isOpen)
          }}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="sr-only">Open menu</span>
          <EllipsisHorizontalIcon className="h-4 w-4" />
          {buttonLabel && <span className="ml-2">{buttonLabel}</span>}
        </button>
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999]"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <div className="rounded-md bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none min-w-48 border border-gray-200 dark:border-gray-700">
            <div className="py-1" role="menu" aria-orientation="vertical">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={getItemClasses(item)}
                  onClick={(event) => handleItemClick(event, item)}
                  role="menuitem"
                >
                  {item.icon && (
                    <item.icon className="h-4 w-4 mr-3" />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}