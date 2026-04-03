import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { jest } from '@jest/globals'
import ProjectsSection from '../../../../src/react/pages/sections/ProjectsSection'
import * as apiClient from '../../../../src/react/lib/api-client'

// Mock the API client
jest.mock('../../../../src/react/lib/api-client', () => ({
  apiClient: {
    getProjects: jest.fn(),
  },
}))

const mockApiClient = apiClient.apiClient as jest.Mocked<typeof apiClient.apiClient>

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  FolderIcon: () => <div data-testid="folder-icon">FolderIcon</div>,
  UserIcon: () => <div data-testid="user-icon">UserIcon</div>,
  ClockIcon: () => <div data-testid="clock-icon">ClockIcon</div>,
  CodeBracketIcon: () => <div data-testid="code-icon">CodeIcon</div>,
}))

const mockProjects = [
  {
    id: 'project-1',
    name: 'LLM-Charge Main Project',
    description: 'Main development project for LLM-Charge system',
    key: 'MAIN',
    type: 'software' as const,
    lead: 'developer',
    status: 'active' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    codeGraphPath: '/Users/test/workspace/lllm-charge',
    agentConfig: {
      claudeMdPath: './CLAUDE.md',
      agentMdPath: './AGENT.md',
      skillsDir: './skills',
      agentsDir: './agents',
      workflowsDir: './agent-workflows'
    },
    stats: {
      specsCount: 25,
      agentsCount: 8,
      workflowsCount: 3,
      notesCount: 5
    }
  },
  {
    id: 'project-2',
    name: 'Demo Project',
    description: 'Secondary project for testing project-scoped organization',
    key: 'DEMO',
    type: 'demo' as const,
    lead: 'tester',
    status: 'inactive' as const,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    stats: {
      specsCount: 5,
      agentsCount: 2,
      workflowsCount: 1,
      notesCount: 1
    }
  },
  {
    id: 'project-3',
    name: 'Research Project',
    description: 'Research and development project',
    key: 'RES',
    type: 'research' as const,
    lead: 'researcher',
    status: 'completed' as const,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-06T00:00:00Z',
    codeGraphPath: '/Users/test/research',
    stats: {
      specsCount: 12,
      agentsCount: 3,
      workflowsCount: 0,
      notesCount: 8
    }
  }
]

const renderProjectsSection = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsSection />
    </QueryClientProvider>
  )
}

describe('ProjectsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading skeleton while fetching projects', async () => {
      mockApiClient.getProjects.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderProjectsSection()

      // Should show loading skeletons
      expect(screen.getAllByTestId(/animate-pulse/i)).toHaveLength(5) // 5 skeleton cards
    })
  })

  describe('Overview Statistics', () => {
    it('should display correct overview statistics', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeInTheDocument()
      })

      // Check statistics cards
      expect(screen.getByText('3')).toBeInTheDocument() // Total projects
      expect(screen.getByText('1')).toBeInTheDocument() // Active projects (only project-1 is active)
      expect(screen.getByText('42')).toBeInTheDocument() // Total specs (25 + 5 + 12)
      expect(screen.getByText('13')).toBeInTheDocument() // Total agents (8 + 2 + 3)
      expect(screen.getByText('4')).toBeInTheDocument() // Total workflows (3 + 1 + 0)
    })
  })

  describe('Project Cards Display', () => {
    it('should display project cards with correct information', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check that all project names are displayed
      expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      expect(screen.getByText('Demo Project')).toBeInTheDocument()
      expect(screen.getByText('Research Project')).toBeInTheDocument()

      // Check project keys
      expect(screen.getByText('MAIN')).toBeInTheDocument()
      expect(screen.getByText('DEMO')).toBeInTheDocument()
      expect(screen.getByText('RES')).toBeInTheDocument()

      // Check project types
      expect(screen.getByText('software')).toBeInTheDocument()
      expect(screen.getByText('demo')).toBeInTheDocument()
      expect(screen.getByText('research')).toBeInTheDocument()

      // Check project leads
      expect(screen.getByText('Lead: developer')).toBeInTheDocument()
      expect(screen.getByText('Lead: tester')).toBeInTheDocument()
      expect(screen.getByText('Lead: researcher')).toBeInTheDocument()
    })

    it('should display project statistics correctly', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check project-specific statistics
      expect(screen.getByText('25')).toBeInTheDocument() // Main project specs
      expect(screen.getByText('8')).toBeInTheDocument() // Main project agents
      expect(screen.getByText('5')).toBeInTheDocument() // Demo project specs
      expect(screen.getByText('2')).toBeInTheDocument() // Demo project agents
      expect(screen.getByText('12')).toBeInTheDocument() // Research project specs
      expect(screen.getByText('3')).toBeInTheDocument() // Research project agents
    })

    it('should display project status badges correctly', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check status badges
      const statusBadges = screen.getAllByText(/active|inactive|completed/)
      expect(statusBadges).toHaveLength(3)
      
      // Verify specific statuses
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('inactive')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('should display CodeGraph paths when available', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check CodeGraph paths
      expect(screen.getByText('/Users/test/workspace/lllm-charge')).toBeInTheDocument()
      expect(screen.getByText('/Users/test/research')).toBeInTheDocument()
    })
  })

  describe('Project Card Interactions', () => {
    it('should expand and collapse project details', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Initially, agent configuration should not be visible
      expect(screen.queryByText('Agent Configuration')).not.toBeInTheDocument()

      // Click on the project card to expand
      const projectCard = screen.getByText('LLM-Charge Main Project').closest('.cursor-pointer')
      expect(projectCard).toBeInTheDocument()
      
      fireEvent.click(projectCard!)

      // Agent configuration should now be visible
      await waitFor(() => {
        expect(screen.getByText('Agent Configuration')).toBeInTheDocument()
      })

      // Check agent configuration details
      expect(screen.getByText('./CLAUDE.md')).toBeInTheDocument()
      expect(screen.getByText('./AGENT.md')).toBeInTheDocument()
      expect(screen.getByText('./skills')).toBeInTheDocument()
      expect(screen.getByText('./agents')).toBeInTheDocument()
      expect(screen.getByText('./agent-workflows')).toBeInTheDocument()

      // Click again to collapse
      fireEvent.click(projectCard!)

      // Agent configuration should be hidden again
      await waitFor(() => {
        expect(screen.queryByText('Agent Configuration')).not.toBeInTheDocument()
      })
    })

    it('should handle project selection state correctly', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      const projectCard = screen.getByText('LLM-Charge Main Project').closest('.cursor-pointer')
      expect(projectCard).not.toHaveClass('border-blue-500')

      // Click to select
      fireEvent.click(projectCard!)

      // Should have selected styling
      await waitFor(() => {
        expect(projectCard).toHaveClass('border-blue-500', 'ring-2', 'ring-blue-200')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error state when API call fails', async () => {
      mockApiClient.getProjects.mockRejectedValue(new Error('API Error'))

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Failed to load projects')).toBeInTheDocument()
      })

      expect(screen.getByText('Please check your connection and try again.')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no projects exist', async () => {
      mockApiClient.getProjects.mockResolvedValue([])

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeInTheDocument()
      })

      // Should show zero counts in statistics
      expect(screen.getByText('0')).toBeInTheDocument() // Total projects should be 0

      // Should show empty state message
      expect(screen.getByText('No projects found')).toBeInTheDocument()
      expect(screen.getByText('Get started by creating your first project.')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('should render statistics cards in responsive grid', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeInTheDocument()
      })

      // Check that overview statistics container has responsive grid classes
      const statsContainer = screen.getByText('Total Projects').closest('.grid')
      expect(statsContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-5')
    })

    it('should render project cards in responsive grid', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check that projects grid has responsive classes
      const projectsGrid = screen.getByText('LLM-Charge Main Project').closest('.grid')
      expect(projectsGrid).toHaveClass('grid-cols-1', 'lg:grid-cols-2', 'xl:grid-cols-3')
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check project title headings
      const projectTitles = screen.getAllByText(/Project$|Demo Project|Research Project/)
      projectTitles.forEach(title => {
        expect(title.tagName).toBe('H3')
      })

      // Check agent configuration heading
      const projectCard = screen.getByText('LLM-Charge Main Project').closest('.cursor-pointer')
      fireEvent.click(projectCard!)

      await waitFor(() => {
        expect(screen.getByText('Agent Configuration')).toBeInTheDocument()
      })

      const agentConfigHeading = screen.getByText('Agent Configuration')
      expect(agentConfigHeading.tagName).toBe('H4')
    })

    it('should have proper click targets and hover states', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('LLM-Charge Main Project')).toBeInTheDocument()
      })

      // Check that project cards have cursor-pointer class
      const projectCards = screen.getAllByRole('generic', { name: /cursor-pointer/ })
      expect(projectCards.length).toBeGreaterThan(0)

      // Check hover classes
      const projectCard = screen.getByText('LLM-Charge Main Project').closest('.cursor-pointer')
      expect(projectCard).toHaveClass('hover:shadow-lg', 'hover:-translate-y-1')
    })
  })

  describe('Performance', () => {
    it('should render efficiently with multiple projects', async () => {
      // Create a dataset with more projects
      const manyProjects = Array.from({ length: 20 }, (_, index) => ({
        ...mockProjects[0],
        id: `project-${index}`,
        name: `Test Project ${index}`,
        key: `TEST${index}`,
        stats: {
          specsCount: Math.floor(Math.random() * 50),
          agentsCount: Math.floor(Math.random() * 10),
          workflowsCount: Math.floor(Math.random() * 5),
          notesCount: Math.floor(Math.random() * 20)
        }
      }))

      mockApiClient.getProjects.mockResolvedValue(manyProjects)

      const startTime = performance.now()
      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeInTheDocument()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000)

      // Should show correct total count
      expect(screen.getByText('20')).toBeInTheDocument() // Total projects
    })
  })

  describe('Data Consistency', () => {
    it('should correctly aggregate statistics from all projects', async () => {
      mockApiClient.getProjects.mockResolvedValue(mockProjects)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeInTheDocument()
      })

      // Manual calculation verification:
      // Total specs: 25 + 5 + 12 = 42
      // Total agents: 8 + 2 + 3 = 13
      // Total workflows: 3 + 1 + 0 = 4
      // Active projects: 1 (only MAIN is active)
      expect(screen.getByText('42')).toBeInTheDocument() // Total specs
      expect(screen.getByText('13')).toBeInTheDocument() // Total agents
      expect(screen.getByText('4')).toBeInTheDocument() // Total workflows
      expect(screen.getByText('1')).toBeInTheDocument() // Active projects
    })

    it('should handle projects without statistics gracefully', async () => {
      const projectsWithoutStats = [
        {
          ...mockProjects[0],
          stats: undefined
        },
        {
          ...mockProjects[1],
          stats: {
            specsCount: 10,
            agentsCount: 2,
            workflowsCount: 1,
            notesCount: 3
          }
        }
      ]

      mockApiClient.getProjects.mockResolvedValue(projectsWithoutStats)

      renderProjectsSection()

      await waitFor(() => {
        expect(screen.getByText('Total Projects')).toBeInTheDocument()
      })

      // Should handle missing stats gracefully (counts as 0)
      expect(screen.getByText('10')).toBeInTheDocument() // Only from second project
      expect(screen.getByText('2')).toBeInTheDocument() // Only from second project
    })
  })
})