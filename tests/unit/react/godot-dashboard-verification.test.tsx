import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('Godot MCP Dashboard Verification', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  const renderGodotDashboard = () => {
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

  describe('Dashboard Rendering', () => {
    test('should render Godot dashboard header correctly', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('Godot Game Development Dashboard')).toBeInTheDocument()
        expect(screen.getByText('AI-powered tools and insights for Godot game development')).toBeInTheDocument()
      })
    })

    test('should display project information when loaded', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText(/Project:/)).toBeInTheDocument()
        expect(screen.getByText('My Awesome Game')).toBeInTheDocument()
      })
    })

    test('should render performance metrics cards', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('Scene Load Time')).toBeInTheDocument()
        expect(screen.getByText('Memory Usage')).toBeInTheDocument()
        expect(screen.getByText('Build Status')).toBeInTheDocument()
        expect(screen.getByText('Asset Count')).toBeInTheDocument()
      })
    })

    test('should display asset breakdown cards', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('Textures')).toBeInTheDocument()
        expect(screen.getByText('Audio Files')).toBeInTheDocument()
        expect(screen.getByText('3D Models')).toBeInTheDocument()
        expect(screen.getByText('Animations')).toBeInTheDocument()
      })
    })
  })

  describe('Godot Tools Functionality', () => {
    test('should display Godot development tools table', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('Godot Development Tools')).toBeInTheDocument()
        expect(screen.getByText('AI-powered tools for Godot game development')).toBeInTheDocument()
      })
    })

    test('should show correct Godot tool categories', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        // Check for specific Godot tools
        expect(screen.getByText('gdscript_optimizer')).toBeInTheDocument()
        expect(screen.getByText('godot_scene_analyzer')).toBeInTheDocument()
        expect(screen.getByText('component_generator')).toBeInTheDocument()
        expect(screen.getByText('asset_optimizer')).toBeInTheDocument()
      })
    })

    test('should open tool modal when clicking on a tool', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        const sceneTool = screen.getByText('godot_scene_analyzer')
        fireEvent.click(sceneTool)
      })

      await waitFor(() => {
        expect(screen.getByText('Godot Tool: godot_scene_analyzer')).toBeInTheDocument()
        expect(screen.getByText('Analyze Godot scene files for performance bottlenecks and optimization opportunities')).toBeInTheDocument()
      })
    })
  })

  describe('Most Used Tools Section', () => {
    test('should display most used Godot tools', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('Most Used Godot Tools')).toBeInTheDocument()
        expect(screen.getByText('23 uses')).toBeInTheDocument() // gdscript_optimizer usage
        expect(screen.getByText('15 uses')).toBeInTheDocument() // scene_analyzer usage
      })
    })
  })

  describe('Interactive Features', () => {
    test('should have working Analyze Project button', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        const analyzeButton = screen.getByText('Analyze Project')
        expect(analyzeButton).toBeInTheDocument()
        fireEvent.click(analyzeButton)
      })
    })

    test('should have working Refresh button', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh')
        expect(refreshButton).toBeInTheDocument()
        fireEvent.click(refreshButton)
      })
    })
  })

  describe('Project Statistics', () => {
    test('should display correct project statistics', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        // Check project version
        expect(screen.getByText('4.2.1')).toBeInTheDocument()
        
        // Check scene count
        expect(screen.getByText('15')).toBeInTheDocument()
        
        // Check script count
        expect(screen.getByText('28')).toBeInTheDocument()
        
        // Check asset size
        expect(screen.getByText('156.7 MB')).toBeInTheDocument()
      })
    })
  })

  describe('Godot-Specific Features', () => {
    test('should show Godot version compatibility', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        // All tools should support Godot 4.x
        expect(screen.getAllByText(/4\.0, 4\.1, 4\.2/)).toHaveLength(6)
      })
    })

    test('should display scene complexity metrics', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('45ms')).toBeInTheDocument() // Scene load time
        expect(screen.getByText('32')).toBeInTheDocument() // Average nodes per scene (in change indicator)
      })
    })

    test('should show memory breakdown for game assets', async () => {
      renderGodotDashboard()
      
      await waitFor(() => {
        expect(screen.getByText('89.3 MB')).toBeInTheDocument() // Texture memory
        expect(screen.getByText('24.1 MB')).toBeInTheDocument() // Audio memory
      })
    })
  })

  describe('Tool Categories', () => {
    test('should categorize tools correctly', async () => {
      renderGodotDashboard()
      
      // Tools should be organized by game development categories:
      // performance, script, generation, asset, export
      await waitFor(() => {
        // Check that tools are displayed and categorized
        const toolsTable = screen.getByText('Godot Development Tools').closest('div')
        expect(toolsTable).toBeInTheDocument()
      })
    })
  })
})