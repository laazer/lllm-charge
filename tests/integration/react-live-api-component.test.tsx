/**
 * Live API Integration Tests
 * Tests React components against the actual running backend APIs
 * Verifies that components display real data from independent databases
 */

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { WebSocketProvider } from '../../src/react/store/websocket-store'
import { ThemeProvider } from '../../src/react/store/theme-store'
import { ProjectProvider } from '../../src/react/store/project-store'
import Dashboard from '../../src/react/pages/Dashboard'
import SpecsSection from '../../src/react/pages/sections/SpecsSection'
import AgentsSection from '../../src/react/pages/sections/AgentsSection'
import ProjectsSection from '../../src/react/pages/sections/ProjectsSection'

// Import real API client (not mocked)
import * as apiClient from '../../src/react/lib/api-client'

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { 
        retry: 1, // Limited retries for faster tests
        staleTime: 0 // Always fetch fresh data
      }
    }
  })

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ProjectProvider>
            <WebSocketProvider>
              {children}
            </WebSocketProvider>
          </ProjectProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

describe('Live API Integration Tests', () => {
  // Skip tests if backend is not running
  const BACKEND_URL = 'http://localhost:3001'
  let backendAvailable = false

  beforeAll(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/projects`)
      backendAvailable = response.ok
    } catch (error) {
      console.warn('Backend not available for live tests, skipping...')
      backendAvailable = false
    }
  })

  const skipIfBackendUnavailable = () => {
    if (!backendAvailable) {
      pending('Backend not available')
    }
  }

  describe('Live Dashboard Data Integration', () => {
    test('should display real metrics from running backend', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/)).toBeInTheDocument()
      })

      // Should display real metric cards (not just loading states)
      await waitFor(() => {
        // Look for StatusCard and MetricCard components
        const cards = screen.getAllByRole('article')
        expect(cards.length).toBeGreaterThan(0)
      }, { timeout: 10000 })

      // Verify real data is displayed (not default/mock values)
      await waitFor(() => {
        // Should show real project count (2 based on previous setup)
        const projectElements = screen.queryAllByText('2')
        expect(projectElements.length).toBeGreaterThan(0)
      }, { timeout: 5000 })
    })

    test('should show WebSocket connection status', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      // Should show connection status indicator
      await waitFor(() => {
        // Look for connection status in header or status cards
        const connectionElements = screen.queryAllByText(/connected|active/i)
        expect(connectionElements.length).toBeGreaterThan(0)
      }, { timeout: 5000 })
    })
  })

  describe('Live Specs Section Integration', () => {
    test('should display actual specs from database', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <SpecsSection />
        </TestWrapper>
      )

      // Wait for data to load
      await waitFor(() => {
        // Should show the actual specs created during our testing
        // Look for any spec titles that contain "React" or "Database" or "Phase"
        const specTitles = screen.queryAllByText(/React|Database|Phase|Migration|Complete/i)
        expect(specTitles.length).toBeGreaterThan(0)
      }, { timeout: 10000 })

      // Should show real status indicators
      await waitFor(() => {
        const statusElements = screen.queryAllByText(/completed|active|draft/i)
        expect(statusElements.length).toBeGreaterThan(0)
      })
    })

    test('should display real spec count (49+ specs)', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <SpecsSection />
        </TestWrapper>
      )

      // Should show the real count from backend (49+ specs)
      await waitFor(() => {
        const countElements = screen.queryAllByText(/49|[5-9][0-9]/)
        expect(countElements.length).toBeGreaterThan(0)
      }, { timeout: 10000 })
    })
  })

  describe('Live Agents Section Integration', () => {
    test('should display independent agents (projectId: null)', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <AgentsSection />
        </TestWrapper>
      )

      // Should display agent names from real database
      await waitFor(() => {
        // Look for agent types we know exist
        const agentElements = screen.queryAllByText(/Architecture|Specialist|Engineer|Expert|Manager/i)
        expect(agentElements.length).toBeGreaterThan(0)
      }, { timeout: 10000 })

      // Should show real agent count (13+ agents)
      await waitFor(() => {
        const countElements = screen.queryAllByText(/13|1[4-9]|[2-9][0-9]/)
        expect(countElements.length).toBeGreaterThan(0)
      })
    })

    test('should not show project associations for agents', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <AgentsSection />
        </TestWrapper>
      )

      await waitFor(() => {
        // Agents should be displayed without project context
        // Should NOT show "Project:" labels since agents are independent
        expect(screen.queryByText('Project:')).not.toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Live Projects Section Integration', () => {
    test('should display real projects as one resource type', async () => {
      skipIfBackendUnavailable()

      render(
        <TestWrapper>
          <ProjectsSection />
        </TestWrapper>
      )

      // Should display the real projects
      await waitFor(() => {
        // Look for project indicators
        const projectElements = screen.queryAllByText(/Main|Project|LLM|Charge/i)
        expect(projectElements.length).toBeGreaterThan(0)
      }, { timeout: 10000 })

      // Should show real project count (2 projects)
      await waitFor(() => {
        const countElements = screen.queryAllByText('2')
        expect(countElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('API Data Structure Verification', () => {
    test('should verify APIs return independent agents', async () => {
      skipIfBackendUnavailable()

      const agents = await apiClient.getAgents()
      
      // Verify all agents have projectId: null (independent)
      agents.forEach(agent => {
        expect(agent.projectId).toBeNull()
      })

      // Should have at least 13 agents
      expect(agents.length).toBeGreaterThanOrEqual(13)

      // Each agent should have required fields
      agents.forEach(agent => {
        expect(agent.id).toBeDefined()
        expect(agent.name).toBeDefined()
        expect(agent.primaryRole).toBeDefined()
        expect(agent.capabilities).toBeDefined()
      })
    })

    test('should verify specs API returns real data', async () => {
      skipIfBackendUnavailable()

      const specs = await apiClient.getSpecs()

      // Should have at least 49 specs
      expect(specs.length).toBeGreaterThanOrEqual(49)

      // Each spec should have required fields
      specs.forEach(spec => {
        expect(spec.id).toBeDefined()
        expect(spec.title).toBeDefined()
        expect(spec.status).toMatch(/draft|active|completed|archived/)
      })
    })

    test('should verify projects API returns correct structure', async () => {
      skipIfBackendUnavailable()

      const projects = await apiClient.getProjects()

      // Should have exactly 2 projects
      expect(projects.length).toBe(2)

      // Each project should have required fields
      projects.forEach(project => {
        expect(project.id).toBeDefined()
        expect(project.name).toBeDefined()
        expect(project.key).toBeDefined()
      })
    })
  })

  describe('WebSocket Data Flow Verification', () => {
    test('should receive real-time metrics via WebSocket', async () => {
      skipIfBackendUnavailable()

      const wsUrl = 'ws://localhost:3001'
      let metricsReceived = false
      let receivedMetrics: any = null

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl)
        
        const timeout = setTimeout(() => {
          ws.close()
          if (!metricsReceived) {
            reject(new Error('No metrics received via WebSocket'))
          }
        }, 10000)

        ws.onopen = () => {
          console.log('WebSocket connected for test')
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            if (message.type === 'metrics' || message.type === 'metrics_update') {
              receivedMetrics = message.data
              metricsReceived = true

              // Verify metrics structure
              expect(receivedMetrics.specsCount).toBeGreaterThanOrEqual(49)
              expect(receivedMetrics.agentsCount).toBeGreaterThanOrEqual(13)
              expect(receivedMetrics.projectsCount).toBe(2)
              expect(receivedMetrics.workflowsCount).toBeGreaterThanOrEqual(3)

              clearTimeout(timeout)
              ws.close()
              resolve()
            }
          } catch (error) {
            clearTimeout(timeout)
            ws.close()
            reject(error)
          }
        }

        ws.onerror = (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      })
    }, 15000) // Increased timeout for WebSocket connection
  })

  describe('Component Rendering with Real Data', () => {
    test('should render dashboard cards with actual backend metrics', async () => {
      skipIfBackendUnavailable()

      // First get the actual metrics from API
      const response = await fetch(`${BACKEND_URL}/api/metrics`)
      const metrics = await response.json()

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      // Wait for dashboard to render with real data
      await waitFor(() => {
        expect(screen.getByText(/Dashboard/)).toBeInTheDocument()
      })

      // Should display the actual spec count from backend
      await waitFor(() => {
        const specCountText = metrics.specsCount.toString()
        expect(screen.getByText(specCountText)).toBeInTheDocument()
      }, { timeout: 10000 })

      // Should display the actual agent count from backend  
      await waitFor(() => {
        const agentCountText = metrics.agentsCount.toString()
        expect(screen.getByText(agentCountText)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    test('should handle real API data transformations correctly', async () => {
      skipIfBackendUnavailable()

      const specs = await apiClient.getSpecs()
      
      render(
        <TestWrapper>
          <SpecsSection />
        </TestWrapper>
      )

      // Component should handle the actual data structure
      await waitFor(() => {
        // If we have specs, at least one title should be displayed
        if (specs.length > 0) {
          const firstSpecTitle = specs[0].title
          expect(screen.getByText(firstSpecTitle)).toBeInTheDocument()
        }
      }, { timeout: 10000 })
    })
  })
})