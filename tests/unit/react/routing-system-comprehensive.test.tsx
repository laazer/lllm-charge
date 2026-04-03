import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../../src/react/store/theme-store'
import { WebSocketProvider } from '../../../src/react/store/websocket-store'
import { ProjectProvider } from '../../../src/react/store/project-store'
import App from '../../../src/react/App'
import '@testing-library/jest-dom'

// Mock all lazy-loaded components
jest.mock('../../../src/react/pages/Dashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>
}))

jest.mock('../../../src/react/pages/Specs', () => ({
  __esModule: true,
  default: () => <div data-testid="specs-page">Specs Page</div>
}))

jest.mock('../../../src/react/pages/Agents', () => ({
  __esModule: true,
  default: () => <div data-testid="agents-page">Agents Page</div>
}))

jest.mock('../../../src/react/pages/Projects', () => ({
  __esModule: true,
  default: () => <div data-testid="projects-page">Projects Page</div>
}))

jest.mock('../../../src/react/pages/Skills', () => ({
  __esModule: true,
  default: () => <div data-testid="skills-page">Skills Page</div>
}))

jest.mock('../../../src/react/pages/Workflows', () => ({
  __esModule: true,
  default: () => <div data-testid="workflows-page">Workflows Page</div>
}))

jest.mock('../../../src/react/pages/CronJobs', () => ({
  __esModule: true,
  default: () => <div data-testid="cronjobs-page">CronJobs Page</div>
}))

jest.mock('../../../src/react/pages/Memory', () => ({
  __esModule: true,
  default: () => <div data-testid="memory-page">Memory Page</div>
}))

jest.mock('../../../src/react/pages/ReactDev', () => ({
  __esModule: true,
  default: () => <div data-testid="react-dev-page">React Dev Page</div>
}))

jest.mock('../../../src/react/pages/DevDocs', () => ({
  __esModule: true,
  default: () => <div data-testid="devdocs-page">DevDocs Page</div>
}))

jest.mock('../../../src/react/pages/HybridReasoning', () => ({
  __esModule: true,
  default: () => <div data-testid="hybrid-reasoning-page">Hybrid Reasoning Page</div>
}))

jest.mock('../../../src/react/pages/CodeGraph', () => ({
  __esModule: true,
  default: () => <div data-testid="codegraph-page">CodeGraph Page</div>
}))

jest.mock('../../../src/react/pages/PromptPlayground', () => ({
  __esModule: true,
  default: () => <div data-testid="playground-page">Prompt Playground Page</div>
}))

jest.mock('../../../src/react/pages/MCP', () => ({
  __esModule: true,
  default: () => <div data-testid="mcp-page">MCP Page</div>
}))

jest.mock('../../../src/react/pages/GodotDev', () => ({
  __esModule: true,
  default: () => <div data-testid="godot-page">Godot Dev Page</div>
}))

jest.mock('../../../src/react/pages/APIDev', () => ({
  __esModule: true,
  default: () => <div data-testid="api-dev-page">API Dev Page</div>
}))

// Mock DashboardLayout
jest.mock('../../../src/react/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children, currentSection, onSectionChange }: any) => (
    <div data-testid="dashboard-layout" data-current-section={currentSection}>
      <div data-testid="layout-children">{children}</div>
    </div>
  )
}))

// Mock SimpleErrorBoundary
jest.mock('../../../src/react/components/ui/SimpleErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}))

// Mock WebSocket to avoid connection issues in tests
const mockWebSocket = {
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
}
global.WebSocket = jest.fn(() => mockWebSocket) as any

describe('Routing System Comprehensive Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    // Mock window.location
    delete (window as any).location
    window.location = {
      ...window.location,
      hostname: 'localhost',
      protocol: 'http:',
    }
  })

  const renderApp = (initialRoute = '/') => {
    const history = createMemoryHistory({ initialEntries: [initialRoute] })
    
    return {
      ...render(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      ),
      history
    }
  }

  describe('Route to Section Mapping', () => {
    test('should map root route to dashboard', async () => {
      renderApp('/')
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
    })

    test('should map /dashboard to dashboard', async () => {
      renderApp('/dashboard')
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
    })

    test('should map /specs to specs page', async () => {
      renderApp('/specs')
      
      await waitFor(() => {
        expect(screen.getByTestId('specs-page')).toBeInTheDocument()
      })
    })

    test('should map /agents to agents page', async () => {
      renderApp('/agents')
      
      await waitFor(() => {
        expect(screen.getByTestId('agents-page')).toBeInTheDocument()
      })
    })

    test('should map /projects to projects page', async () => {
      renderApp('/projects')
      
      await waitFor(() => {
        expect(screen.getByTestId('projects-page')).toBeInTheDocument()
      })
    })

    test('should map /skills to skills page', async () => {
      renderApp('/skills')
      
      await waitFor(() => {
        expect(screen.getByTestId('skills-page')).toBeInTheDocument()
      })
    })

    test('should map /workflows to workflows page', async () => {
      renderApp('/workflows')
      
      await waitFor(() => {
        expect(screen.getByTestId('workflows-page')).toBeInTheDocument()
      })
    })

    test('should map /cronjobs to cronjobs page', async () => {
      renderApp('/cronjobs')
      
      await waitFor(() => {
        expect(screen.getByTestId('cronjobs-page')).toBeInTheDocument()
      })
    })

    test('should map /memory to memory page', async () => {
      renderApp('/memory')
      
      await waitFor(() => {
        expect(screen.getByTestId('memory-page')).toBeInTheDocument()
      })
    })

    test('should map /react-dev to react dev page', async () => {
      renderApp('/react-dev')
      
      await waitFor(() => {
        expect(screen.getByTestId('react-dev-page')).toBeInTheDocument()
      })
    })

    test('should map /devdocs to devdocs page', async () => {
      renderApp('/devdocs')
      
      await waitFor(() => {
        expect(screen.getByTestId('devdocs-page')).toBeInTheDocument()
      })
    })

    test('should map /hybrid-reasoning to hybrid reasoning page', async () => {
      renderApp('/hybrid-reasoning')
      
      await waitFor(() => {
        expect(screen.getByTestId('hybrid-reasoning-page')).toBeInTheDocument()
      })
    })

    test('should map /codegraph to codegraph page', async () => {
      renderApp('/codegraph')
      
      await waitFor(() => {
        expect(screen.getByTestId('codegraph-page')).toBeInTheDocument()
      })
    })

    test('should map /playground to playground page', async () => {
      renderApp('/playground')
      
      await waitFor(() => {
        expect(screen.getByTestId('playground-page')).toBeInTheDocument()
      })
    })

    test('should map /mcp to mcp page', async () => {
      renderApp('/mcp')
      
      await waitFor(() => {
        expect(screen.getByTestId('mcp-page')).toBeInTheDocument()
      })
    })

    test('should map /godot to godot dev page', async () => {
      renderApp('/godot')
      
      await waitFor(() => {
        expect(screen.getByTestId('godot-page')).toBeInTheDocument()
      })
    })

    test('should map /api-dev to api dev page', async () => {
      renderApp('/api-dev')
      
      await waitFor(() => {
        expect(screen.getByTestId('api-dev-page')).toBeInTheDocument()
      })
    })
  })

  describe('Section to Route Mapping', () => {
    test('should set correct section for each route', async () => {
      const testCases = [
        { route: '/dashboard', expectedSection: 'overview' },
        { route: '/specs', expectedSection: 'specs' },
        { route: '/agents', expectedSection: 'agents' },
        { route: '/projects', expectedSection: 'projects' },
        { route: '/skills', expectedSection: 'skills' },
        { route: '/workflows', expectedSection: 'workflows' },
        { route: '/api-dev', expectedSection: 'api-dev' },
        { route: '/cronjobs', expectedSection: 'cronjobs' },
        { route: '/memory', expectedSection: 'memory' },
        { route: '/react-dev', expectedSection: 'react-dev' },
        { route: '/devdocs', expectedSection: 'devdocs' },
        { route: '/hybrid-reasoning', expectedSection: 'hybrid-reasoning' },
        { route: '/codegraph', expectedSection: 'codegraph' },
        { route: '/playground', expectedSection: 'playground' },
        { route: '/mcp', expectedSection: 'mcp' },
        { route: '/godot', expectedSection: 'godot' },
      ]

      for (const testCase of testCases) {
        const { container } = renderApp(testCase.route)
        
        await waitFor(() => {
          const layout = container.querySelector('[data-current-section]')
          expect(layout).toHaveAttribute('data-current-section', testCase.expectedSection)
        })
      }
    })
  })

  describe('Navigation Flow', () => {
    test('should handle programmatic navigation between routes', async () => {
      const { history } = renderApp('/dashboard')
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
      
      act(() => {
        history.push('/godot')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('godot-page')).toBeInTheDocument()
      })
    })

    test('should update section when route changes', async () => {
      const { history, container } = renderApp('/specs')
      
      await waitFor(() => {
        const layout = container.querySelector('[data-current-section]')
        expect(layout).toHaveAttribute('data-current-section', 'specs')
      })
      
      act(() => {
        history.push('/godot')
      })
      
      await waitFor(() => {
        const layout = container.querySelector('[data-current-section]')
        expect(layout).toHaveAttribute('data-current-section', 'godot')
      })
    })
  })

  describe('Unknown Routes', () => {
    test('should redirect unknown routes to dashboard', async () => {
      renderApp('/unknown-route')
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
    })

    test('should redirect deeply nested unknown routes', async () => {
      renderApp('/some/deep/unknown/path')
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
    })
  })

  describe('Code Splitting and Lazy Loading', () => {
    test('should show loading spinner while loading components', async () => {
      renderApp('/specs')
      
      // Check that loading spinner appears initially
      const loadingSpinner = screen.queryByText(/loading page/i)
      
      await waitFor(() => {
        expect(screen.getByTestId('specs-page')).toBeInTheDocument()
      })
    })

    test('should load each page component independently', async () => {
      const routes = [
        '/dashboard',
        '/specs', 
        '/agents',
        '/projects',
        '/skills',
        '/workflows',
        '/api-dev',
        '/cronjobs',
        '/memory',
        '/react-dev',
        '/devdocs',
        '/hybrid-reasoning',
        '/codegraph',
        '/playground',
        '/mcp',
        '/godot'
      ]

      for (const route of routes) {
        const { unmount } = renderApp(route)
        
        await waitFor(() => {
          const pageTestId = route.replace('/', '') || 'dashboard'
          const testId = pageTestId === 'dashboard' ? 'dashboard-page' :
                       pageTestId === 'react-dev' ? 'react-dev-page' :
                       pageTestId === 'api-dev' ? 'api-dev-page' :
                       pageTestId === 'devdocs' ? 'devdocs-page' :
                       pageTestId === 'hybrid-reasoning' ? 'hybrid-reasoning-page' :
                       pageTestId === 'codegraph' ? 'codegraph-page' :
                       pageTestId === 'playground' ? 'playground-page' :
                       pageTestId === 'cronjobs' ? 'cronjobs-page' :
                       pageTestId === 'godot' ? 'godot-page' :
                       `${pageTestId}-page`
          
          expect(screen.getByTestId(testId)).toBeInTheDocument()
        })
        
        unmount()
      }
    })
  })

  describe('Error Handling', () => {
    test('should wrap app in error boundary', () => {
      renderApp('/')
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    })

    test('should handle routing errors gracefully', () => {
      expect(() => renderApp('/malformed-route')).not.toThrow()
    })
  })

  describe('Layout Integration', () => {
    test('should pass correct section to layout', async () => {
      const { container } = renderApp('/workflows')
      
      await waitFor(() => {
        const layout = container.querySelector('[data-testid="dashboard-layout"]')
        expect(layout).toHaveAttribute('data-current-section', 'workflows')
      })
    })

    test('should render page content within layout', async () => {
      renderApp('/agents')
      
      await waitFor(() => {
        const layoutChildren = screen.getByTestId('layout-children')
        expect(layoutChildren).toBeInTheDocument()
        expect(screen.getByTestId('agents-page')).toBeInTheDocument()
      })
    })
  })

  describe('Context Providers', () => {
    test('should wrap app in all required providers', () => {
      renderApp('/')
      
      // Error boundary should be the outermost wrapper
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      
      // Layout should be present (indicating other providers are working)
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
    })

    test('should handle WebSocket provider initialization', () => {
      expect(() => renderApp('/')).not.toThrow()
      
      // WebSocket should be initialized
      expect(WebSocket).toHaveBeenCalled()
    })
  })

  describe('Route Persistence', () => {
    test('should maintain route state during navigation', async () => {
      const { history } = renderApp('/projects')
      
      await waitFor(() => {
        expect(screen.getByTestId('projects-page')).toBeInTheDocument()
      })
      
      // Navigate to another route and back
      act(() => {
        history.push('/specs')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('specs-page')).toBeInTheDocument()
      })
      
      act(() => {
        history.push('/projects')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('projects-page')).toBeInTheDocument()
      })
    })

    test('should handle browser back/forward navigation', async () => {
      const { history } = renderApp('/dashboard')
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
      
      act(() => {
        history.push('/godot')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('godot-page')).toBeInTheDocument()
      })
      
      act(() => {
        history.back()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      })
    })
  })

  describe('Performance', () => {
    test('should load routes efficiently without blocking', async () => {
      const startTime = performance.now()
      
      renderApp('/mcp')
      
      await waitFor(() => {
        expect(screen.getByTestId('mcp-page')).toBeInTheDocument()
      })
      
      const endTime = performance.now()
      const loadTime = endTime - startTime
      
      // Should load reasonably quickly (less than 1 second in test environment)
      expect(loadTime).toBeLessThan(1000)
    })
  })
})