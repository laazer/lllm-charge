import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { apiClient } from '../../../src/react/lib/api-client'

// Mock API client
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
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt to process' },
        complexity: { type: 'string', description: 'Task complexity level' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'search_docs',
    description: 'Search offline documentation',
    category: 'docs',
    isActive: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        language: { type: 'string', description: 'Target language' },
      },
      required: ['query'],
    },
  },
  {
    name: 'no_schema_tool',
    description: 'A tool with no input schema',
    category: 'other',
    isActive: true,
    inputSchema: null,
  },
]

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={createQueryClient()}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
)

describe('ToolExplorer', () => {
  let ToolExplorer: React.ComponentType

  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.getMCPTools as jest.Mock).mockResolvedValue({
      tools: mockMCPTools,
      summary: { total: 3 },
    })
    ;(apiClient.callMCPTool as jest.Mock).mockResolvedValue({
      result: { answer: 'hello' },
      success: true,
    })
    // Reset module to avoid caching
    jest.resetModules()
  })

  beforeAll(async () => {
    const mod = await import('../../../src/react/pages/sections/ToolExplorerSection')
    ToolExplorer = mod.ToolExplorerSection
  })

  it('renders tool list from live /mcp/tools API', async () => {
    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('hybrid_reasoning')).toBeInTheDocument()
    })

    expect(screen.getByText('search_docs')).toBeInTheDocument()
    expect(screen.getByText('no_schema_tool')).toBeInTheDocument()
  })

  it('shows tool descriptions in the list', async () => {
    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Route requests to optimal LLM provider')).toBeInTheDocument()
    })
    expect(screen.getByText('Search offline documentation')).toBeInTheDocument()
  })

  it('does not hardcode tool names — drives list from API response', async () => {
    ;(apiClient.getMCPTools as jest.Mock).mockResolvedValue({
      tools: [
        {
          name: 'custom_dynamic_tool',
          description: 'A dynamically loaded tool',
          category: 'custom',
          isActive: true,
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        },
      ],
      summary: { total: 1 },
    })

    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('custom_dynamic_tool')).toBeInTheDocument()
    })
    expect(screen.queryByText('hybrid_reasoning')).not.toBeInTheDocument()
  })

  it('clicking a tool renders a param form matching its JSON schema', async () => {
    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('hybrid_reasoning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('hybrid_reasoning'))

    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/complexity/i)).toBeInTheDocument()
  })

  it('shows required field indicator for required params', async () => {
    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('hybrid_reasoning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('hybrid_reasoning'))

    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument()
    })

    // Required field should have some indicator (asterisk or "required" text)
    const container = document.body
    expect(container.textContent).toMatch(/prompt.*\*|required/i)
  })

  it('submitting the form calls /mcp/call/{tool_name} and displays result', async () => {
    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('hybrid_reasoning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('hybrid_reasoning'))

    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/prompt/i), {
      target: { value: 'test prompt' },
    })

    const submitButton = screen.getByRole('button', { name: /run|execute|submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(apiClient.callMCPTool).toHaveBeenCalledWith('hybrid_reasoning', {
        prompt: 'test prompt',
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/answer|hello/i)).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching tools', async () => {
    let resolveTools: (value: any) => void
    ;(apiClient.getMCPTools as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveTools = resolve
      })
    )

    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    // Should show some loading indicator before tools load
    expect(
      screen.queryByText('hybrid_reasoning') || screen.queryByText(/loading/i)
    ).toBeTruthy()

    resolveTools!({ tools: mockMCPTools, summary: { total: 3 } })

    await waitFor(() => {
      expect(screen.getByText('hybrid_reasoning')).toBeInTheDocument()
    })
  })

  it('handles tool with no schema gracefully', async () => {
    render(
      <TestWrapper>
        <ToolExplorer />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('no_schema_tool')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('no_schema_tool'))

    await waitFor(() => {
      // Should still render the detail view — with a "no parameters" message or a raw JSON textarea
      const body = document.body.textContent
      expect(body).toMatch(/no param|no schema|parameters|raw|JSON/i)
    })
  })
})
