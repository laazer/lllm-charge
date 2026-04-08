/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'

import Workflows from '../../../src/react/pages/Workflows'
import { apiClient } from '../../../src/react/lib/api-client'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { ProjectProvider } from '../../../src/react/store/project-store'
import type { Workflow } from '../../../src/react/types'

jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getWorkflows: jest.fn(),
    createWorkflow: jest.fn(),
    deleteWorkflow: jest.fn(),
  },
}))

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ProjectProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </ProjectProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function openTemplatesModal() {
  fireEvent.click(screen.getByRole('button', { name: /^templates$/i }))
}

function openExamplesFromTemplatesCard() {
  const heading = screen.getByRole('heading', { name: 'Workflow Templates' })
  const card = heading.closest('.rounded-lg')
  if (!card) throw new Error('Workflow Templates card not found')
  const menuBtn = within(card as HTMLElement).getByRole('button', { name: /open menu/i })
  fireEvent.click(menuBtn)
  fireEvent.click(screen.getByText('View Examples'))
}

describe('Workflows — templates modal (project-scoped)', () => {
  const mockWorkflows: Workflow[] = [
    {
      id: 'workflow-1',
      title: 'Existing One',
      description: 'Desc',
      status: 'draft',
      priority: 'medium',
      projectId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ]

  const mockCreateWorkflow = {
    id: 'workflow-new',
    title: 'Code Review Workflow',
    description: 'Automated code review and approval process',
    status: 'draft' as const,
    priority: 'medium' as const,
    projectId: 'main-1773934155652',
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.getWorkflows.mockResolvedValue(mockWorkflows)
    mockApiClient.createWorkflow.mockResolvedValue(mockCreateWorkflow)
    mockApiClient.deleteWorkflow.mockResolvedValue(undefined)
  })

  it('opens modal and lists built-in templates', async () => {
    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openTemplatesModal()
    expect(screen.getByRole('heading', { level: 3, name: 'Workflow Templates' })).toBeInTheDocument()
    expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
    expect(screen.getByText('Bug Fix Pipeline')).toBeInTheDocument()
  })

  it('closes templates modal via accessible close control', async () => {
    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openTemplatesModal()
    await waitFor(() => {
      expect(screen.getByText('Simple Code Review Workflow')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /close modal/i }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 3, name: 'Workflow Templates' })).not.toBeInTheDocument()
    })
  })

  it('calls createWorkflow with template payload and current project id', async () => {
    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openTemplatesModal()
    await waitFor(() => {
      expect(screen.getAllByText('Use Template').length).toBeGreaterThan(0)
    })
    const useButtons = screen.getAllByText('Use Template')
    fireEvent.click(useButtons[0])
    await waitFor(() => {
      expect(mockApiClient.createWorkflow).toHaveBeenCalled()
    })
    const payload = mockApiClient.createWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(payload.projectId).toBe('main-1773934155652')
    expect(payload.title).toBe('Code Review Workflow')
    expect(payload.nodes).toBeDefined()
    expect(payload.edges).toBeDefined()
  })

  it('handles createWorkflow rejection without crashing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockApiClient.createWorkflow.mockRejectedValue(new Error('API Error'))
    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openTemplatesModal()
    await waitFor(() => {
      expect(screen.getAllByText('Use Template').length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByText('Use Template')[0])
    await waitFor(() => {
      expect(mockApiClient.createWorkflow).toHaveBeenCalled()
    })
    consoleErrorSpy.mockRestore()
  })
})

describe('Workflows — examples browser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApiClient.deleteWorkflow.mockResolvedValue(undefined)
  })

  it('shows example workflows and excludes titles containing "test"', async () => {
    const mockWorkflowsWithTest: Workflow[] = [
      {
        id: 'workflow-1',
        title: 'Code Review Workflow',
        description: 'Automated code review',
        status: 'active',
        priority: 'medium',
        projectId: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
      {
        id: 'workflow-2',
        title: 'Bug Fix Pipeline',
        description: 'Streamlined bug fixing',
        status: 'draft',
        priority: 'low',
        projectId: null,
        createdAt: '2023-01-02T00:00:00Z',
        updatedAt: '2023-01-02T00:00:00Z',
      },
      {
        id: 'workflow-test',
        title: 'Test Only Workflow',
        description: 'Used for filtering tests',
        status: 'draft',
        priority: 'low',
        projectId: null,
        createdAt: '2023-01-03T00:00:00Z',
        updatedAt: '2023-01-03T00:00:00Z',
      },
    ]
    mockApiClient.getWorkflows.mockResolvedValue(mockWorkflowsWithTest)

    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openExamplesFromTemplatesCard()
    await waitFor(() => {
      expect(screen.getByText('Example Workflows')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Code Review Workflow').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bug Fix Pipeline').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText('Test Only Workflow')).toHaveLength(1)
  })

  it('shows empty state when no workflows exist', async () => {
    mockApiClient.getWorkflows.mockResolvedValue([])
    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openExamplesFromTemplatesCard()
    await waitFor(() => {
      expect(screen.getByText('Example Workflows')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('No examples yet')).toBeInTheDocument()
    })
  })

  it('closes examples panel when ✕ is clicked', async () => {
    mockApiClient.getWorkflows.mockResolvedValue([
      {
        id: 'workflow-1',
        title: 'Code Review Workflow',
        description: 'x',
        status: 'active',
        priority: 'medium',
        projectId: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
    ])
    render(
      <TestWrapper>
        <Workflows />
      </TestWrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Workflow Engine')).toBeInTheDocument()
    })
    openExamplesFromTemplatesCard()
    expect(screen.getByText('Example Workflows')).toBeInTheDocument()
    fireEvent.click(screen.getByText('✕'))
    expect(screen.queryByText('Example Workflows')).not.toBeInTheDocument()
  })
})
