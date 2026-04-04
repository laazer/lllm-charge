import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Theme, Style, ThemeConfig } from '../types'

interface ThemeContextType {
  theme: Theme
  style: Style
  toggleTheme: () => void
  toggleStyle: () => void
  setTheme: (theme: Theme) => void
  setStyle: (style: Style) => void
  setThemeConfig: (config: ThemeConfig) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultStyle?: Style
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'light',
  defaultStyle = 'glass'
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first, then system preference, then default
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('llm-charge-theme') as Theme
      if (stored && ['light', 'dark'].includes(stored)) {
        return stored
      }
      
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    }
    
    return defaultTheme
  })

  const [style, setStyleState] = useState<Style>(() => {
    // Check localStorage first, then default
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('llm-charge-style') as Style
      if (stored && ['flat', 'glass'].includes(stored)) {
        return stored
      }
    }
    
    return defaultStyle
  })

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem('llm-charge-theme', newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      updateDocumentClass()
    }
  }

  const setStyle = (newStyle: Style) => {
    setStyleState(newStyle)
    if (typeof window !== 'undefined') {
      localStorage.setItem('llm-charge-style', newStyle)
      updateDocumentClass()
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const toggleStyle = () => {
    setStyle(style === 'flat' ? 'glass' : 'flat')
  }

  const setThemeConfig = (config: ThemeConfig) => {
    setTheme(config.theme)
    setStyle(config.style)
  }

  const updateDocumentClass = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Apply both theme and style classes to document body
      document.body.className = `theme-${theme} style-${style}`
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.setAttribute('data-style', style)
    }
  }, [theme, style])

  useEffect(() => {
    // Apply theme and style to document
    updateDocumentClass()
  }, [updateDocumentClass])

  useEffect(() => {
    // Listen for system theme changes
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if user hasn't set a preference
        const storedTheme = localStorage.getItem('llm-charge-theme')
        if (!storedTheme) {
          setThemeState(e.matches ? 'dark' : 'light')
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const value = {
    theme,
    style,
    toggleTheme,
    toggleStyle,
    setTheme,
    setStyle,
    setThemeConfig,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}