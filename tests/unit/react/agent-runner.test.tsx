import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { apiClient } from '../../../src/react/lib/api-client'

jest.mock('../../../src/react/lib/api-client', () => ({
  apiClient: {
    getMCPTools: jest.fn(),
    callMCPTool: jest.fn(),
    runMCPAgent: jest.fn(),
  },
}))

const mockMCPTools = [
  {
    name: 'hybrid_reasoning',
    description: 'Route requests to optimal LLM provider',
    category: 'reasoning',
    isActive: true,
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
  },
  {
    name: 'search_docs',
    description: 'Search offline documentation',
    category: 'docs',
    isActive: true,
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
  },
]

const mockAgentResponse = {
  success: true,
  steps: [
    { step: 1, action: 'Analyzing goal', tool: null, result: null },
    { step: 2, action: 'Calling hybrid_reasoning', tool: 'hybrid_reasoning', result: { answer: 'Done' } },
  ],
  finalResponse: 'Task completed successfully',
  totalSteps: 2,
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={createQueryClient()}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
)

describe('AgentRunner', () => {
  let AgentRunner: React.ComponentType

  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.getMCPTools as jest.Mock).mockResolvedValue({
      tools: mockMCPTools,
      summary: { total: 2 },
    })
    ;(apiClient.runMCPAgent as jest.Mock).mockResolvedValue(mockAgentResponse)
    jest.resetModules()
  })

  beforeAll(async () => {
    const mod = await import('../../../src/react/pages/sections/AgentRunnerSection')
    AgentRunner = mod.AgentRunnerSection
  })

  it('renders the agent runner form', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })
  })

  it('has a textarea for goal prompt', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      const textarea = screen.getByRole('textbox')
      expect(textarea.tagName).toBe('TEXTAREA')
    })
  })

  it('populates allowed tools list from /mcp/tools API response', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('hybrid_reasoning')).toBeInTheDocument()
    })
    expect(screen.getByText('search_docs')).toBeInTheDocument()
  })

  it('does not hardcode tool names in the tool selector', async () => {
    ;(apiClient.getMCPTools as jest.Mock).mockResolvedValue({
      tools: [
        {
          name: 'my_special_tool',
          description: 'Dynamic tool',
          category: 'test',
          isActive: true,
          inputSchema: {},
        },
      ],
      summary: { total: 1 },
    })

    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('my_special_tool')).toBeInTheDocument()
    })
    expect(screen.queryByText('hybrid_reasoning')).not.toBeInTheDocument()
  })

  it('has a max_steps control', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })

    const body = document.body.textContent
    expect(body).toMatch(/max.?steps|maximum steps/i)
  })

  it('has a prefer_local toggle', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })

    const body = document.body.textContent
    expect(body).toMatch(/prefer.?local|local.?model/i)
  })

  it('has a complexity selector', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })

    const body = document.body.textContent
    expect(body).toMatch(/complexity/i)
  })

  it('has a Run button', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    })
  })

  it('submitting the agent form calls /mcp/agent/run', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })

    const goalInput = screen.getByPlaceholderText(/goal|describe|what/i)
    fireEvent.change(goalInput, { target: { value: 'Summarize all projects' } })

    const runButton = screen.getByRole('button', { name: /run/i })
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(apiClient.runMCPAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          goal: 'Summarize all projects',
        })
      )
    })
  })

  it('shows step output after running the agent', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/goal|describe|what/i), {
      target: { value: 'Do something useful' },
    })

    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText('Analyzing goal')).toBeInTheDocument()
    })
  })

  it('shows final response after agent completes', async () => {
    render(
      <TestWrapper>
        <AgentRunner />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/goal|describe|what/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/goal|describe|what/i), {
      target: { value: 'Do something useful' },
    })

    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText(/Task completed successfully/i)).toBeInTheDocument()
    })
  })
})
