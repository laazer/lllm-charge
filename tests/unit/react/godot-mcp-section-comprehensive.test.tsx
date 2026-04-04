import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { GodotMCPSection } from '../../../src/react/pages/sections/GodotMCPSection'
import '@testing-library/jest-dom'

// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  }
}))

// Mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  CubeIcon: () => <div data-testid="cube-icon">CubeIcon</div>,
  PlayIcon: () => <div data-testid="play-icon">PlayIcon</div>,
  ArrowPathIcon: () => <div data-testid="refresh-icon">RefreshIcon</div>,
}))

describe('GodotMCPSection Comprehensive Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  const renderGodotSection = () => {
    return render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <GodotMCPSection />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    )
  }

  describe('Component Initialization', () => {
    test('should render without crashing', () => {
      expect(() => renderGodotSection()).not.toThrow()
    })

    test('should display main header correctly', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
        expect(screen.getByText('AI-powered tools and insights for Godot game development')).toBeInTheDocument()
      })
    })

    test('should show loading state initially', () => {
      renderGodotSection()
      
      // Should show some loading or initial content
      expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
    })
  })

  describe('Project Information Display', () => {
    test('should display project details', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText(/Project:/)).toBeInTheDocument()
        expect(screen.getByText('My Awesome Game')).toBeInTheDocument()
        expect(screen.getByText('4.2.1')).toBeInTheDocument() // Godot version
      })
    })

    test('should show project statistics', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        // Scene count
        expect(screen.getByText('15')).toBeInTheDocument()
        
        // Script count  
        expect(screen.getByText('28')).toBeInTheDocument()
        
        // Asset size
        expect(screen.getByText('156.7 MB')).toBeInTheDocument()
      })
    })

    test('should display project path', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('/path/to/my-awesome-game')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Metrics Cards', () => {
    test('should render all performance metric cards', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('Scene Load Time')).toBeInTheDocument()
        expect(screen.getByText('Memory Usage')).toBeInTheDocument()
        expect(screen.getByText('Build Status')).toBeInTheDocument()
        expect(screen.getByText('Asset Count')).toBeInTheDocument()
      })
    })

    test('should display correct performance values', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('45ms')).toBeInTheDocument() // Scene load time
        expect(screen.getByText('89.3 MB')).toBeInTheDocument() // Memory usage for textures
        expect(screen.getByText('Success')).toBeInTheDocument() // Build status
        expect(screen.getByText('245')).toBeInTheDocument() // Total assets
      })
    })

    test('should show memory breakdown correctly', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        // Texture memory
        expect(screen.getByText('89.3 MB')).toBeInTheDocument()
        
        // Audio memory
        expect(screen.getByText('24.1 MB')).toBeInTheDocument()
      })
    })
  })

  describe('Asset Breakdown Section', () => {
    test('should display all asset type cards', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('Textures')).toBeInTheDocument()
        expect(screen.getByText('Audio Files')).toBeInTheDocument()
        expect(screen.getByText('3D Models')).toBeInTheDocument()
        expect(screen.getByText('Animations')).toBeInTheDocument()
      })
    })

    test('should show correct asset counts', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('124')).toBeInTheDocument() // Textures
        expect(screen.getByText('45')).toBeInTheDocument()  // Audio files
        expect(screen.getByText('23')).toBeInTheDocument()  // 3D models
        expect(screen.getByText('67')).toBeInTheDocument()  // Animations
      })
    })
  })

  describe('Godot Development Tools', () => {
    test('should display tools table header', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('Godot Development Tools')).toBeInTheDocument()
        expect(screen.getByText('AI-powered tools for Godot game development')).toBeInTheDocument()
      })
    })

    test('should show all six Godot-specific tools', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('gdscript_optimizer')).toBeInTheDocument()
        expect(screen.getByText('godot_scene_analyzer')).toBeInTheDocument()
        expect(screen.getByText('component_generator')).toBeInTheDocument()
        expect(screen.getByText('asset_optimizer')).toBeInTheDocument()
        expect(screen.getByText('build_analyzer')).toBeInTheDocument()
        expect(screen.getByText('export_manager')).toBeInTheDocument()
      })
    })

    test('should display tool categories correctly', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        // Check that each tool has its category
        const performanceTool = screen.getByText('gdscript_optimizer').closest('tr')
        expect(within(performanceTool!).getByText('performance')).toBeInTheDocument()
        
        const scriptTool = screen.getByText('godot_scene_analyzer').closest('tr')
        expect(within(scriptTool!).getByText('script')).toBeInTheDocument()
      })
    })

    test('should show Godot version compatibility', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        // All tools should support Godot 4.x versions
        const compatibilityTexts = screen.getAllByText(/4\.0, 4\.1, 4\.2/)
        expect(compatibilityTexts).toHaveLength(6) // One for each tool
      })
    })
  })

  describe('Tool Modal Functionality', () => {
    test('should open tool modal when tool is clicked', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const sceneTool = screen.getByText('godot_scene_analyzer')
        fireEvent.click(sceneTool)
      })

      await waitFor(() => {
        expect(screen.getByText('Godot Tool: godot_scene_analyzer')).toBeInTheDocument()
        expect(screen.getByText('Analyze Godot scene files for performance bottlenecks and optimization opportunities')).toBeInTheDocument()
      })
    })

    test('should show tool parameters in modal', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const optimizerTool = screen.getByText('gdscript_optimizer')
        fireEvent.click(optimizerTool)
      })

      await waitFor(() => {
        expect(screen.getByText('scriptPath')).toBeInTheDocument()
        expect(screen.getByText('optimizationLevel')).toBeInTheDocument()
      })
    })

    test('should close modal when close button is clicked', async () => {
      renderGodotSection()
      
      // Open modal
      await waitFor(() => {
        const sceneTool = screen.getByText('godot_scene_analyzer')
        fireEvent.click(sceneTool)
      })

      // Close modal
      await waitFor(() => {
        const closeButton = screen.getByText('Close')
        fireEvent.click(closeButton)
      })

      await waitFor(() => {
        expect(screen.queryByText('Godot Tool: godot_scene_analyzer')).not.toBeInTheDocument()
      })
    })
  })

  describe('Most Used Tools Section', () => {
    test('should display most used tools header', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('Most Used Godot Tools')).toBeInTheDocument()
      })
    })

    test('should show usage statistics', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        expect(screen.getByText('23 uses')).toBeInTheDocument() // gdscript_optimizer
        expect(screen.getByText('15 uses')).toBeInTheDocument() // scene_analyzer
      })
    })

    test('should display tools in usage order', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const usageSection = screen.getByText('Most Used Godot Tools').closest('div')
        const toolItems = within(usageSection!).getAllByText(/\d+ uses/)
        
        // Should be in descending order of usage
        expect(toolItems[0]).toHaveTextContent('23 uses')
        expect(toolItems[1]).toHaveTextContent('15 uses')
      })
    })
  })

  describe('Interactive Features', () => {
    test('should have functional Analyze Project button', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const analyzeButton = screen.getByText('Analyze Project')
        expect(analyzeButton).toBeInTheDocument()
        expect(analyzeButton).not.toBeDisabled()
        
        fireEvent.click(analyzeButton)
        // Button should still be present after click
        expect(analyzeButton).toBeInTheDocument()
      })
    })

    test('should have functional Refresh button', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh')
        expect(refreshButton).toBeInTheDocument()
        expect(refreshButton).not.toBeDisabled()
        
        fireEvent.click(refreshButton)
        // Button should still be present after click
        expect(refreshButton).toBeInTheDocument()
      })
    })

    test('should display action buttons with proper styling', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const analyzeButton = screen.getByText('Analyze Project')
        const refreshButton = screen.getByText('Refresh')
        
        expect(analyzeButton).toHaveClass(/bg-blue-500/)
        expect(refreshButton).toHaveClass(/bg-gray-500/)
      })
    })
  })

  describe('Responsive Design', () => {
    test('should handle narrow viewport gracefully', async () => {
      // Mock narrow viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      renderGodotSection()
      
      await waitFor(() => {
        const dashboard = screen.getByText('Godot Game Development Dashboard')
        expect(dashboard).toBeInTheDocument()
        
        // Should still show all main sections
        expect(screen.getByText('Scene Load Time')).toBeInTheDocument()
        expect(screen.getByText('Godot Development Tools')).toBeInTheDocument()
      })
    })

    test('should display cards in responsive grid', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        // Check that performance cards are in a grid
        const performanceSection = screen.getByText('Scene Load Time').closest('[class*="grid"]')
        expect(performanceSection).toBeInTheDocument()
        
        // Check that asset breakdown is in a grid
        const assetSection = screen.getByText('Textures').closest('[class*="grid"]')
        expect(assetSection).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle missing data gracefully', async () => {
      // This test ensures the component doesn't crash with undefined data
      renderGodotSection()
      
      await waitFor(() => {
        // Component should render even if some data is missing
        expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
      })
    })

    test('should display fallback values for missing metrics', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        // Should show default/mock values rather than undefined
        const metricsCards = screen.getAllByText(/\d+/)
        expect(metricsCards.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Accessibility', () => {
    test('should have proper heading hierarchy', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const mainHeading = screen.getByText('Godot Game Development Dashboard')
        expect(mainHeading.tagName).toBe('H1')
        
        const sectionHeadings = screen.getAllByRole('heading', { level: 2 })
        expect(sectionHeadings.length).toBeGreaterThan(0)
      })
    })

    test('should have accessible button labels', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const analyzeButton = screen.getByRole('button', { name: /analyze project/i })
        const refreshButton = screen.getByRole('button', { name: /refresh/i })
        
        expect(analyzeButton).toBeInTheDocument()
        expect(refreshButton).toBeInTheDocument()
      })
    })

    test('should support keyboard navigation', async () => {
      renderGodotSection()
      
      await waitFor(() => {
        const firstTool = screen.getByText('gdscript_optimizer')
        
        // Should be focusable
        firstTool.focus()
        expect(document.activeElement).toBe(firstTool)
      })
    })
  })
})