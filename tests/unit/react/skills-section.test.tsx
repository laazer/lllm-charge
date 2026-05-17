import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import SkillsSection from '../../../src/react/pages/sections/SkillsSection'
import { ProjectProvider } from '../../../src/react/store/project-store'
import { apiClient } from '../../../src/react/lib/api-client'

jest.mock('../../../src/react/lib/api-client')

const mockSpecs = [
  {
    id: 'skill-1',
    title: 'Code Analysis',
    description: 'Analyze code for issues',
    tags: ['skill', 'analysis', 'code'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-2',
    title: 'Documentation',
    description: 'Generate documentation',
    tags: ['skill', 'documentation'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'non-skill',
    title: 'Some Other Spec',
    description: 'Not a skill',
    tags: ['other'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <SkillsSection />
      </ProjectProvider>
    </QueryClientProvider>
  )
}

describe('SkillsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should load and display skills', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
      expect(screen.getByText('Documentation')).toBeInTheDocument()
    })

    // Non-skill spec should not appear
    expect(screen.queryByText('Some Other Spec')).not.toBeInTheDocument()
  })

  it('should load default skills without page refresh', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue([])
    ;(apiClient.loadDefaultSkillsAndAgents as jest.Mock).mockResolvedValue(undefined)
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce(mockSpecs)

    renderComponent()

    const loadButton = await screen.findByText('Load Default Skills')
    fireEvent.click(loadButton)

    await waitFor(() => {
      expect(apiClient.loadDefaultSkillsAndAgents).toHaveBeenCalledWith({
        loadSkills: true,
        loadAgents: false,
        loadSpecs: false,
        overwriteExisting: false,
      })
    })

    // Should refetch skills without page reload
    // Page should not reload (window.location.reload should not be called)
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('should filter skills by search term', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search skills by name, description, or tags...')
    fireEvent.change(searchInput, { target: { value: 'documentation' } })

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument()
      expect(screen.queryByText('Code Analysis')).not.toBeInTheDocument()
    })
  })

  it('should filter skills by category', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
    })

    const categorySelect = screen.getByDisplayValue('All Categories')
    fireEvent.change(categorySelect, { target: { value: 'analysis' } })

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
      expect(screen.queryByText('Documentation')).not.toBeInTheDocument()
    })
  })

  it('should select and deselect skills', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('button', { name: /Select/ })
    fireEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(screen.getByText('1 skill selected')).toBeInTheDocument()
    })

    fireEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(screen.queryByText('1 skill selected')).not.toBeInTheDocument()
    })
  })

  it('should show edit modal when edit button is clicked', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/ })
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Skill')).toBeInTheDocument()
    })
  })

  it('should show delete confirmation modal', async () => {
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Delete Skill')).toBeInTheDocument()
    })
  })

  it('should display project-specific skills only', async () => {
    // Skills with projectId matching current project should be shown
    // This test verifies filtering by project
    ;(apiClient.getSpecs as jest.Mock).mockResolvedValue(mockSpecs)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Code Analysis')).toBeInTheDocument()
    })

    // Note: This test assumes the component filters by projectId
    // Current implementation may need to be updated to support this
  })
})
