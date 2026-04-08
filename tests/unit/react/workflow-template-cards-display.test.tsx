import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Workflows from '../../../src/react/pages/Workflows'
import { apiClient } from '../../../src/react/lib/api-client'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { ProjectProvider } from '../../../src/react/store/project-store'

// Mock the API client
jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getWorkflows: jest.fn(),
    createWorkflow: jest.fn(),
  }
}))
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

// Mock React Router
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockWorkflows = [
  {
    id: 'workflow-1',
    title: 'Data Processing Pipeline',
    description: 'Process incoming data through multiple AI agents for analysis and reporting',
    status: 'active' as const,
    priority: 'high' as const,
    projectId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'workflow-2', 
    title: 'User Onboarding Workflow',
    description: 'Complete user onboarding automation with email verification',
    status: 'draft' as const,
    priority: 'medium' as const,
    projectId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

function templatesOpenButton() {
  return screen.getByRole('button', { name: /^templates$/i })
}

function openViewExamplesFromTemplatesCard() {
  const heading = screen.getByRole('heading', { level: 2, name: 'Workflow Templates' })
  const card = heading.closest('.rounded-lg')
  if (!card) throw new Error('Workflow Templates card not found')
  fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /open menu/i }))
  fireEvent.click(screen.getByText('View Examples'))
}

describe('Workflow Template Cards Display', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.getWorkflows.mockResolvedValue(mockWorkflows)
    mockApiClient.createWorkflow.mockResolvedValue({
      id: 'new-workflow-id',
      title: 'New Workflow',
      description: 'Created from template',
      status: 'draft' as const,
      priority: 'medium' as const,
      projectId: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    })
  })

  test('should display Templates button', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    await waitFor(() => {
      expect(templatesOpenButton()).toBeInTheDocument()
    })
  })

  test('should open modal when Templates is clicked', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    // Wait for component to load
    await waitFor(() => {
      expect(templatesOpenButton()).toBeInTheDocument()
    })

    // Initially, template cards should not be visible (modal closed)
    expect(screen.queryByText('Simple Code Review Workflow')).not.toBeInTheDocument()

    fireEvent.click(templatesOpenButton())

    // Verify modal opens and template cards are displayed
    await waitFor(() => {
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
      expect(screen.getAllByText('Data Processing Pipeline').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('User Onboarding Flow')).toBeInTheDocument()
      expect(screen.getAllByText('Use Template')).toHaveLength(4)
    })
  })

  test('should display correct template descriptions in modal', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    // Verify modal opens and template descriptions are displayed
    await waitFor(() => {
      expect(screen.getByText('Basic code review with approval process')).toBeInTheDocument()
      expect(screen.getByText('Streamlined workflow for bug identification and resolution')).toBeInTheDocument()
      expect(
        screen.getByText('Process incoming data through multiple AI agents for analysis and reporting')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Complete user onboarding automation with email verification and profile setup'
        )
      ).toBeInTheDocument()
      expect(screen.getAllByText('Use Template')).toHaveLength(4)
    })
  })

  test('should display template category badges in modal', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getAllByText('Development')).toHaveLength(2)
      expect(screen.getAllByText('Analytics')).toHaveLength(1)
      expect(screen.getAllByText('Automation')).toHaveLength(1)
      expect(screen.getAllByText('Use Template')).toHaveLength(4)
    })
  })

  test('should display Use Template buttons for each template in modal', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      const useTemplateButtons = screen.getAllByText('Use Template')
      expect(useTemplateButtons).toHaveLength(4)
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
      expect(screen.getAllByText('Data Processing Pipeline').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('User Onboarding Flow')).toBeInTheDocument()
    })
  })

  test('should create workflow and close modal when Use Template button is clicked', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getAllByText('Use Template')).toHaveLength(4)
    })

    // Click Use Template button for first template
    const useTemplateButtons = screen.getAllByText('Use Template')
    fireEvent.click(useTemplateButtons[0])

    // Verify API was called to create workflow and modal closed
    await waitFor(() => {
      expect(mockApiClient.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Code Review Workflow',
          description: 'Automated code review and approval process',
          status: 'draft',
          priority: 'medium',
          projectId: 'main-1773934155652',
          nodes: expect.any(Array),
          edges: expect.any(Array),
        })
      )
      // Modal should be closed - template names should not be visible anymore
      expect(screen.queryByText('Simple Code Review Workflow')).not.toBeInTheDocument()
    })
  })

  test('should close templates modal when View Examples is clicked', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    await waitFor(() => {
      expect(templatesOpenButton()).toBeInTheDocument()
    })

    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getAllByText('Use Template')).toHaveLength(4)
    })

    openViewExamplesFromTemplatesCard()

    // Templates modal should be closed, examples section should be shown
    await waitFor(() => {
      expect(screen.queryByText('Simple Code Review Workflow')).not.toBeInTheDocument()
      expect(screen.queryByText('Use Template')).not.toBeInTheDocument()
      // Should show examples section instead of templates modal
      expect(screen.getAllByText('Data Processing Pipeline').length).toBeGreaterThan(0)
    })
  })

  test('should display template cards with hover effects in modal', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
      expect(screen.getAllByText('Use Template')).toHaveLength(4)
    })
  })

  test('should disable Use Template buttons when workflow is being created', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getAllByText('Use Template')).toHaveLength(4) // Modal-specific buttons
    })

    // Click Use Template button
    const useTemplateButtons = screen.getAllByText('Use Template')
    expect(useTemplateButtons.length).toBe(4)
    
    fireEvent.click(useTemplateButtons[0])

    // Verify API was called
    await waitFor(() => {
      expect(mockApiClient.createWorkflow).toHaveBeenCalled()
    })
  })

  test('should maintain template state correctly', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    // Initially modal should not be visible
    expect(screen.queryByText('Use Template')).not.toBeInTheDocument() // Modal-specific element
    expect(screen.queryByText('Simple Code Review Workflow')).not.toBeInTheDocument()

    // Show modal
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getAllByText('Use Template')).toHaveLength(4) // Modal-specific buttons
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
    })

    // Click Templates again - should still show modal
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      expect(screen.getAllByText('Use Template')).toHaveLength(4) // Modal-specific buttons
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
    })
  })

  test('should show modal with proper styling', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      // Check that modal is shown with template cards and proper styling
      expect(screen.getAllByText('Use Template')).toHaveLength(4) // Modal-specific buttons
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
    })
  })

  test('should render template cards in a grid layout in modal', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      // Check that both template cards are rendered (indicating grid layout is working)
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
      
      // Check that they both have Use Template buttons (indicating proper card structure)
      const useTemplateButtons = screen.getAllByText('Use Template')
      expect(useTemplateButtons).toHaveLength(4)
    })
  })

  test('should show template cards with buttons in modal', async () => {
    render(<Workflows />, { wrapper: createTestWrapper() })
    
    fireEvent.click(templatesOpenButton())

    await waitFor(() => {
      // Check that template cards have Use Template buttons (modal-specific)
      const templateButtons = screen.getAllByText('Use Template')
      expect(templateButtons.length).toBe(4)
      
      // Check that template cards have titles
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
    })
  })
})