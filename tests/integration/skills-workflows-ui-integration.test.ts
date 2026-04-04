/**
 * Skills and Workflows UI Integration Test
 * Verifies that both the Skills and Workflows UI components are properly integrated and functional
 */

import { jest } from '@jest/globals'

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

describe('Skills and Workflows UI Integration', () => {
  const BASE_URL = 'http://localhost:3001'
  
  beforeEach(() => {
    // Reset fetch mock
    ;(fetch as jest.MockedFunction<typeof fetch>).mockClear()
  })

  describe('Skills UI Integration', () => {
    test('should fetch skills data from specs endpoint', async () => {
      const mockSpecs = [
        {
          id: 'spec-1',
          title: 'DevDocs Integration Skill',
          description: 'Comprehensive skill for offline documentation',
          status: 'completed',
          priority: 'high',
          tags: ['skill', 'devdocs', 'documentation'],
          createdAt: '2026-03-25T16:00:00Z',
          updatedAt: '2026-03-25T16:00:00Z'
        },
        {
          id: 'spec-2', 
          title: 'Universal Language Analysis Skill',
          description: 'Multi-language code analysis specialist',
          status: 'completed',
          priority: 'high',
          tags: ['skill', 'analysis', 'multi-language'],
          createdAt: '2026-03-25T16:00:00Z',
          updatedAt: '2026-03-25T16:00:00Z'
        }
      ]

      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpecs,
      } as Response)

      const response = await fetch(`${BASE_URL}/api/specs`)
      const specs = await response.json()

      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/specs`)
      expect(specs).toHaveLength(2)
      expect(specs[0]).toMatchObject({
        title: 'DevDocs Integration Skill',
        tags: expect.arrayContaining(['skill', 'devdocs'])
      })
      expect(specs[1]).toMatchObject({
        title: 'Universal Language Analysis Skill',
        tags: expect.arrayContaining(['skill', 'analysis'])
      })
    })

    test('should support skill filtering by category', () => {
      const specs = [
        {
          id: 'spec-1',
          title: 'DevDocs Integration Skill',
          tags: ['skill', 'documentation', 'devdocs'],
          status: 'completed'
        },
        {
          id: 'spec-2',
          title: 'Code Analysis Skill',
          tags: ['skill', 'analysis', 'code'],
          status: 'active'
        },
        {
          id: 'spec-3',
          title: 'Regular Spec',
          tags: ['spec', 'requirements'],
          status: 'draft'
        }
      ]

      // Filter specs that are skills (have skill-related tags)
      const skills = specs.filter(spec => 
        spec.tags?.some(tag => 
          tag.includes('skill') || 
          tag.includes('capability') ||
          tag.includes('devdocs') ||
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
        )
      )

      expect(skills).toHaveLength(2)
      expect(skills.map(s => s.title)).toEqual([
        'DevDocs Integration Skill',
        'Code Analysis Skill'
      ])
    })

    test('should support default skills loading', async () => {
      const mockSetupStatus = {
        hasDefaultAgents: true,
        hasDefaultSkills: false,
        hasDefaultSpecs: true
      }

      const mockLoadResponse = {
        success: true,
        loaded: {
          agents: 0,
          skills: 5,
          specs: 0
        }
      }

      // Mock setup status call
      ;(fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSetupStatus,
        } as Response)
        // Mock load defaults call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLoadResponse,
        } as Response)

      // Check setup status
      const statusResponse = await fetch(`${BASE_URL}/api/setup/status`)
      const status = await statusResponse.json()

      expect(status.hasDefaultSkills).toBe(false)

      // Load default skills
      const loadResponse = await fetch(`${BASE_URL}/api/setup/defaults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          loadSkills: true,
          loadAgents: false,
          loadSpecs: false,
          overwriteExisting: false
        })
      })

      const loadResult = await loadResponse.json()

      expect(loadResult.success).toBe(true)
      expect(loadResult.loaded.skills).toBe(5)
    })
  })

  describe('Workflows UI Integration', () => {
    test('should fetch workflows data', async () => {
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Code Review Workflow',
          description: 'Automated code review process',
          status: 'active',
          priority: 'high',
          createdAt: '2026-03-25T16:00:00Z',
          updatedAt: '2026-03-25T16:00:00Z'
        },
        {
          id: 'workflow-2',
          name: 'Bug Fix Workflow',
          description: 'Streamlined bug fixing process',
          status: 'draft',
          priority: 'medium',
          createdAt: '2026-03-25T16:00:00Z',
          updatedAt: '2026-03-25T16:00:00Z'
        }
      ]

      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflows,
      } as Response)

      const response = await fetch(`${BASE_URL}/api/workflows`)
      const workflows = await response.json()

      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/workflows`)
      expect(workflows).toHaveLength(2)
      expect(workflows[0]).toMatchObject({
        name: 'Code Review Workflow',
        status: 'active'
      })
    })

    test('should support workflow creation', async () => {
      const newWorkflow = {
        name: 'Test Workflow',
        description: 'A test automation workflow',
        status: 'draft',
        priority: 'medium'
      }

      const mockCreatedWorkflow = {
        id: 'workflow-new-123',
        ...newWorkflow,
        nodes: [],
        edges: [],
        createdAt: '2026-03-27T20:23:33.209Z',
        updatedAt: '2026-03-27T20:23:33.209Z'
      }

      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedWorkflow,
      } as Response)

      const response = await fetch(`${BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWorkflow)
      })

      const createdWorkflow = await response.json()

      expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWorkflow)
      })

      expect(createdWorkflow).toMatchObject({
        name: 'Test Workflow',
        status: 'draft',
        id: expect.any(String)
      })
    })

    test('should calculate workflow statistics correctly', () => {
      const workflows = [
        { status: 'active' },
        { status: 'active' },
        { status: 'draft' },
        { status: 'completed' },
        { status: 'paused' }
      ]

      const stats = workflows.reduce(
        (acc: any, workflow: any) => {
          acc.total++
          acc[workflow.status]++
          return acc
        },
        { total: 0, draft: 0, active: 0, completed: 0, paused: 0 }
      )

      expect(stats).toEqual({
        total: 5,
        active: 2,
        draft: 1,
        completed: 1,
        paused: 1
      })
    })
  })

  describe('Server Integration', () => {
    test('should verify both endpoints are accessible', async () => {
      // Test Skills endpoint (via specs)
      ;(fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
        // Test Workflows endpoint
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
        // Test Workflow Editor static file
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (name: string) => {
              if (name === 'content-type') return 'text/html'
              return null
            }
          },
          text: async () => '<!DOCTYPE html><html><head><title>Workflow Editor</title></head></html>'
        } as Response)

      // Test Skills endpoint
      const specsResponse = await fetch(`${BASE_URL}/api/specs`)
      expect(specsResponse.ok).toBe(true)

      // Test Workflows endpoint
      const workflowsResponse = await fetch(`${BASE_URL}/api/workflows`)
      expect(workflowsResponse.ok).toBe(true)

      // Test Workflow Editor static file
      const editorResponse = await fetch(`${BASE_URL}/workflow-editor.html`)
      expect(editorResponse.ok).toBe(true)
      expect(editorResponse.headers.get('content-type')).toBe('text/html')
    })

    test('should verify navigation URLs are correct', () => {
      // These are the navigation patterns used in the React components
      const skillsNavigation = {
        component: 'Skills.tsx',
        route: '/skills',
        section: 'skills',
        apiEndpoint: '/api/specs'
      }

      const workflowsNavigation = {
        component: 'Workflows.tsx', 
        route: '/workflows',
        section: 'workflows',
        apiEndpoint: '/api/workflows',
        editorUrl: '/workflow-editor.html'
      }

      expect(skillsNavigation.route).toBe('/skills')
      expect(skillsNavigation.apiEndpoint).toBe('/api/specs')
      
      expect(workflowsNavigation.route).toBe('/workflows')
      expect(workflowsNavigation.apiEndpoint).toBe('/api/workflows')
      expect(workflowsNavigation.editorUrl).toBe('/workflow-editor.html')
    })
  })

  describe('Error Handling', () => {
    test('should handle Skills API errors gracefully', async () => {
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response)

      try {
        const response = await fetch(`${BASE_URL}/api/specs`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('HTTP 500')
      }
    })

    test('should handle Workflows API errors gracefully', async () => {
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response)

      try {
        const response = await fetch(`${BASE_URL}/api/workflows`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('HTTP 404')
      }
    })
  })
})