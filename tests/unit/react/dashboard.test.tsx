import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../../../src/react/pages/Dashboard'
import { WebSocketProvider } from '../../../src/react/store/websocket-store'
import { ProjectProvider } from '../../../src/react/store/project-store'
import { apiClient } from '../../../src/react/lib/api-client'
import { MockWebSocket, MockWebSocketServer } from '../../__mocks__/websocket-mock'

// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getProjects: jest.fn(),
    getAgents: jest.fn(),
    getSpecs: jest.fn(),
  },
}))

// Mock WebSocket globally
global.WebSocket = MockWebSocket as any

const mockProjects = [
  { id: '1', name: 'Project 1', description: 'Test project 1' },
  { id: '2', name: 'Project 2', description: 'Test project 2' },
]

const mockAgents = [
  { id: '1', name: 'Agent 1', description: 'Test agent 1', primaryRole: 'developer' },
  { id: '2', name: 'Agent 2', description: 'Test agent 2', primaryRole: 'tester' },
  { id: '3', name: 'Agent 3', description: 'Test agent 3', primaryRole: 'analyst' },
]

const mockSpecs = [
  { id: '1', title: 'Spec 1', description: 'Test spec 1', status: 'active' },
  { id: '2', title: 'Spec 2', description: 'Test spec 2', status: 'completed' },
  { id: '3', title: 'Spec 3', description: 'Test spec 3', status: 'draft' },
  { id: '4', title: 'Spec 4', description: 'Test spec 4', status: 'active' },
]

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProjectProvider>
          <WebSocketProvider wsUrl="ws://localhost:3001">
            {children}
          </WebSocketProvider>
        </ProjectProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Dashboard Component', () => {
  let mockWsServer: MockWebSocketServer

  beforeEach(() => {
    mockWsServer = new MockWebSocketServer()
    MockWebSocket.resetMocks()
    MockWebSocket.setMockServer(mockWsServer)

    // Setup API mocks
    ;(apiClient.getProjects as jest.Mock).mockResolvedValue(mockProjects)
    ;(apiClient.getAgents as jest.Mock).mockResolvedValue(mockAgents)
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)
  })

  afterEach(() => {
    mockWsServer.cleanup()
    MockWebSocket.resetMocks()
    jest.clearAllMocks()
  })

  it('should render dashboard with loading state initially', () => {
    // Mock loading state
    ;(apiClient.getProjects as jest.Mock).mockImplementation(() => new Promise(() => {}))
    ;(apiClient.getAgents as jest.Mock).mockImplementation(() => new Promise(() => {}))
    ;(apiClient.getSpecs as jest.Mock).mockImplementation(() => new Promise(() => {}))

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    expect(screen.getByRole('status')).toBeInTheDocument() // LoadingSpinner has role="status"
  })

  it('should render dashboard stats cards with correct data', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Check stats cards
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // 2 projects

    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // 3 agents

    expect(screen.getByText('Specifications')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument() // 4 specs
  })

  it('should show connection status as inactive initially', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Connection')).toBeInTheDocument()
    })

    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('should show connection status as active when WebSocket connects', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Simulate WebSocket connection
    mockWsServer.simulateConnection()

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('should display real-time metrics when received via WebSocket', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Connect WebSocket and send metrics
    mockWsServer.simulateConnection()
    mockWsServer.simulateMessage({
      type: 'metrics',
      data: {
        totalRequests: 1250,
        successRate: 0.984,
        avgResponseTime: 145
      }
    })

    await waitFor(() => {
      expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
    })

    // Check metrics values
    expect(screen.getByText('1,250')).toBeInTheDocument() // formatted totalRequests
    expect(screen.getByText('98.4%')).toBeInTheDocument() // formatted successRate
    expect(screen.getByText('145ms')).toBeInTheDocument() // formatted avgResponseTime
  })

  it('should handle metrics with zero/null values gracefully', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Connect WebSocket and send metrics with null/zero values
    mockWsServer.simulateConnection()
    mockWsServer.simulateMessage({
      type: 'metrics',
      data: {
        totalRequests: null,
        successRate: null,
        avgResponseTime: 0
      }
    })

    await waitFor(() => {
      expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
    })

    // Check fallback values
    expect(screen.getByText('0')).toBeInTheDocument() // fallback totalRequests
    expect(screen.getByText('0%')).toBeInTheDocument() // fallback successRate  
    expect(screen.getByText('0ms')).toBeInTheDocument() // zero avgResponseTime
  })

  it('should display React migration progress section', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('React Migration Progress')).toBeInTheDocument()
    })

    // Check migration phases
    expect(screen.getByText(/Phase 1: React Project Setup & Architecture/)).toBeInTheDocument()
    expect(screen.getByText(/Phase 2: Core Component Library & Dashboard/)).toBeInTheDocument()
    expect(screen.getByText(/Phase 3: State Management & Data Integration/)).toBeInTheDocument()
    expect(screen.getByText(/Phase 4: Comprehensive Testing Framework/)).toBeInTheDocument()
    expect(screen.getByText(/Phase 5: Performance Optimization & Production/)).toBeInTheDocument()

    // Check status indicators
    expect(screen.getByText('Completed')).toBeInTheDocument() // Phase 1
    expect(screen.getByText('In Progress')).toBeInTheDocument() // Phase 2
    expect(screen.getAllByText('Pending')).toHaveLength(3) // Phases 3, 4, 5
  })

  it('should hide real-time metrics section when no metrics available', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Should not show real-time metrics section
    expect(screen.queryByText('Real-time Metrics')).not.toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    // Mock API failures
    ;(apiClient.getProjects as jest.Mock).mockRejectedValue(new Error('API Error'))
    ;(apiClient.getAgents as jest.Mock).mockRejectedValue(new Error('API Error'))
    ;(apiClient.getSpecs as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    // Should show fallback values when APIs fail
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument() // fallback counts
    }, { timeout: 5000 })
  })

  it('should format large numbers correctly', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Connect WebSocket and send large numbers
    mockWsServer.simulateConnection()
    mockWsServer.simulateMessage({
      type: 'metrics',
      data: {
        totalRequests: 1234567,
        successRate: 0.9876,
        avgResponseTime: 1500
      }
    })

    await waitFor(() => {
      expect(screen.getByText('Real-time Metrics')).toBeInTheDocument()
    })

    // Check formatted numbers
    expect(screen.getByText('1,234,567')).toBeInTheDocument() // thousands separator
    expect(screen.getByText('98.8%')).toBeInTheDocument() // rounded percentage
    expect(screen.getByText('1500ms')).toBeInTheDocument() // response time
  })

  it('should handle WebSocket disconnection gracefully', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Connect then disconnect
    mockWsServer.simulateConnection()
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    mockWsServer.simulateDisconnection()

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })
})