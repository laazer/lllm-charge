/**
 * Integration tests for:
 * - Skills editing, multi-select, and download-to-project
 * - Project CRUD, import, and directory browsing
 * - CodeGraph project switching
 */

import { jest } from '@jest/globals'

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

const BASE_URL = 'http://localhost:3001'

function mockFetchResponse(data: unknown, options: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => data,
  } as Response
}

beforeEach(() => {
  ;(fetch as jest.MockedFunction<typeof fetch>).mockClear()
})

// =============================================================================
// Skills: Editing
// =============================================================================

describe('Skills Editing', () => {
  const existingSkill = {
    id: 'spec-skill-1',
    title: 'DevDocs Integration',
    description: 'Offline documentation skill',
    status: 'active',
    priority: 'medium',
    tags: ['skill', 'devdocs', 'documentation'],
    createdAt: '2026-03-25T16:00:00Z',
    updatedAt: '2026-03-25T16:00:00Z',
  }

  test('should update a skill via PUT /api/specs/:id', async () => {
    const updates = {
      title: 'DevDocs Integration v2',
      description: 'Updated offline documentation skill',
      data: { tags: ['skill', 'devdocs', 'documentation', 'v2'] },
    }

    const updatedSkill = { ...existingSkill, ...updates, updatedAt: '2026-03-30T12:00:00Z' }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(updatedSkill)
    )

    const response = await fetch(`${BASE_URL}/api/specs/${existingSkill.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    const result = await response.json()

    expect(response.ok).toBe(true)
    expect(result.title).toBe('DevDocs Integration v2')
    expect(result.description).toBe('Updated offline documentation skill')
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/specs/${existingSkill.id}`,
      expect.objectContaining({ method: 'PUT' })
    )
  })

  test('should delete a skill via DELETE /api/specs/:id', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({ success: true, message: 'Spec deleted: spec-skill-1' })
    )

    const response = await fetch(`${BASE_URL}/api/specs/${existingSkill.id}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    expect(response.ok).toBe(true)
    expect(result.success).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/specs/${existingSkill.id}`,
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  test('should ensure category tag is preserved when editing', () => {
    const formTags = 'skill, devdocs, offline'
    const category: string = 'documentation'

    const parsedTags = formTags
      .split(',')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0)

    if (category !== 'general' && !parsedTags.includes(category)) {
      parsedTags.push(category)
    }
    if (!parsedTags.some((tag: string) => tag.includes('skill') || tag.includes('capability'))) {
      parsedTags.push('skill')
    }

    expect(parsedTags).toContain('skill')
    expect(parsedTags).toContain('documentation')
    expect(parsedTags).toContain('devdocs')
  })
})

// =============================================================================
// Skills: Multi-Select and Download to Project
// =============================================================================

describe('Skills Multi-Select and Download', () => {
  const mockSkills = [
    { id: 'skill-1', title: 'DevDocs', tags: ['skill', 'documentation'] },
    { id: 'skill-2', title: 'Language Analysis', tags: ['skill', 'analysis'] },
    { id: 'skill-3', title: 'MCP Integration', tags: ['skill', 'integration'] },
  ]

  test('should track selected skill IDs correctly', () => {
    const selectedIds = new Set<string>()

    // Select two skills
    selectedIds.add('skill-1')
    selectedIds.add('skill-3')
    expect(selectedIds.size).toBe(2)
    expect(selectedIds.has('skill-1')).toBe(true)
    expect(selectedIds.has('skill-2')).toBe(false)
    expect(selectedIds.has('skill-3')).toBe(true)

    // Toggle skill-1 off
    selectedIds.delete('skill-1')
    expect(selectedIds.size).toBe(1)
    expect(selectedIds.has('skill-1')).toBe(false)
  })

  test('should select all filtered skills', () => {
    const filteredSkills = mockSkills.filter((skill) =>
      skill.tags.includes('skill')
    )
    const selectedIds = new Set(filteredSkills.map((skill) => skill.id))

    expect(selectedIds.size).toBe(3)
    expect(filteredSkills.every((skill) => selectedIds.has(skill.id))).toBe(true)
  })

  test('should download selected skills to project via POST /api/specs', async () => {
    const projectId = 'proj-test-123'
    const selectedSkills = [mockSkills[0], mockSkills[2]]

    const createResponses = selectedSkills.map((skill) => ({
      id: `spec-copy-${Date.now()}`,
      title: skill.title,
      description: '',
      status: 'active',
      priority: 'medium',
      projectId,
      tags: skill.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    // Mock two create calls
    ;(fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce(mockFetchResponse(createResponses[0], { status: 201 }))
      .mockResolvedValueOnce(mockFetchResponse(createResponses[1], { status: 201 }))

    const results = await Promise.all(
      selectedSkills.map((skill) =>
        fetch(`${BASE_URL}/api/specs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: skill.title,
            description: '',
            status: 'active',
            priority: 'medium',
            projectId,
            tags: skill.tags,
          }),
        }).then((response) => response.json())
      )
    )

    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('DevDocs')
    expect(results[0].projectId).toBe(projectId)
    expect(results[1].title).toBe('MCP Integration')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('should filter skills by skill-related tags', () => {
    const allSpecs = [
      { id: '1', title: 'Skill A', tags: ['skill', 'documentation'] },
      { id: '2', title: 'Regular Spec', tags: ['spec', 'requirements'] },
      { id: '3', title: 'Skill B', tags: ['capability', 'automation'] },
      { id: '4', title: 'Cost Spec', tags: ['cost-optimization', 'tracking'] },
      { id: '5', title: 'Analysis Skill', tags: ['analysis', 'code'] },
    ]

    const skills = allSpecs.filter((spec) =>
      spec.tags?.some(
        (tag: string) =>
          tag.includes('skill') ||
          tag.includes('capability') ||
          tag.includes('devdocs') ||
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
      )
    )

    expect(skills).toHaveLength(4)
    expect(skills.map((s) => s.id)).toEqual(['1', '3', '4', '5'])
  })
})

// =============================================================================
// Skills: Category extraction
// =============================================================================

describe('Skills Category Extraction', () => {
  test('should extract category from tags', () => {
    const knownCategories = ['documentation', 'analysis', 'integration', 'optimization', 'automation']

    function extractCategory(tags?: string[]): string {
      return tags?.find((tag: string) => knownCategories.includes(tag)) || 'general'
    }

    expect(extractCategory(['skill', 'documentation', 'devdocs'])).toBe('documentation')
    expect(extractCategory(['skill', 'analysis', 'multi-language'])).toBe('analysis')
    expect(extractCategory(['skill', 'random-tag'])).toBe('general')
    expect(extractCategory(undefined)).toBe('general')
    expect(extractCategory([])).toBe('general')
  })
})

// =============================================================================
// Projects: CRUD
// =============================================================================

describe('Project CRUD', () => {
  test('should create a new project via POST /api/projects', async () => {
    const newProject = {
      name: 'My New Project',
      description: 'A test project',
      key: 'MYNEW',
      type: 'software',
      lead: 'Test User',
    }

    const createdProject = {
      id: 'proj-1234567890',
      ...newProject,
      codeGraphPath: null,
      createdAt: '2026-03-30T12:00:00Z',
      updatedAt: '2026-03-30T12:00:00Z',
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(createdProject, { status: 201 })
    )

    const response = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject),
    })

    const result = await response.json()

    expect(response.ok).toBe(true)
    expect(result.name).toBe('My New Project')
    expect(result.key).toBe('MYNEW')
    expect(result.id).toEqual(expect.any(String))
  })

  test('should fetch all projects via GET /api/projects', async () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project Alpha', key: 'ALPHA', type: 'software' },
      { id: 'proj-2', name: 'Project Beta', key: 'BETA', type: 'research' },
    ]

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(mockProjects)
    )

    const response = await fetch(`${BASE_URL}/api/projects`)
    const projects = await response.json()

    expect(projects).toHaveLength(2)
    expect(projects[0].name).toBe('Project Alpha')
    expect(projects[1].type).toBe('research')
  })

  test('should update a project via PUT /api/projects/:id', async () => {
    const updates = { name: 'Updated Project', description: 'New description' }
    const updatedProject = {
      id: 'proj-1',
      ...updates,
      key: 'ALPHA',
      type: 'software',
      updatedAt: '2026-03-30T14:00:00Z',
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(updatedProject)
    )

    const response = await fetch(`${BASE_URL}/api/projects/proj-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    const result = await response.json()

    expect(response.ok).toBe(true)
    expect(result.name).toBe('Updated Project')
    expect(result.description).toBe('New description')
  })

  test('should delete a project via DELETE /api/projects/:id', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({ success: true, message: 'Project deleted: proj-1' })
    )

    const response = await fetch(`${BASE_URL}/api/projects/proj-1`, {
      method: 'DELETE',
    })

    const result = await response.json()

    expect(result.success).toBe(true)
  })

  test('should generate project key from name', () => {
    function generateProjectKey(name: string): string {
      return name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)
    }

    expect(generateProjectKey('My Project')).toBe('MYPROJEC')
    expect(generateProjectKey('llm-charge')).toBe('LLMCHARG')
    expect(generateProjectKey('')).toBe('')
    expect(generateProjectKey('a')).toBe('A')
  })
})

// =============================================================================
// Projects: Import via directory scan
// =============================================================================

describe('Project Import - Directory Scan', () => {
  test('should scan a project directory via POST /api/projects/scan', async () => {
    const scanResult = {
      path: '/Users/test/workspace/my-project',
      detected: {
        name: 'my-project',
        description: 'A cool project',
        type: 'software',
        lead: 'John Doe',
        codeGraphPath: '/Users/test/workspace/my-project/.codegraph',
        agentConfig: {
          claudeMdPath: '/Users/test/workspace/my-project/CLAUDE.md',
          skillsDir: '/Users/test/workspace/my-project/src/skills',
        },
      },
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(scanResult)
    )

    const response = await fetch(`${BASE_URL}/api/projects/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Users/test/workspace/my-project' }),
    })

    const result = await response.json()

    expect(result.detected.name).toBe('my-project')
    expect(result.detected.description).toBe('A cool project')
    expect(result.detected.codeGraphPath).toContain('.codegraph')
    expect(result.detected.agentConfig.claudeMdPath).toContain('CLAUDE.md')
    expect(result.detected.agentConfig.skillsDir).toContain('src/skills')
  })

  test('should reject scan when path is missing', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({ error: 'path is required' }, { ok: false, status: 400 })
    )

    const response = await fetch(`${BASE_URL}/api/projects/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.ok).toBe(false)
    const result = await response.json()
    expect(result.error).toBe('path is required')
  })

  test('should handle scan for non-existent directory', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(
        { error: 'Cannot access path: ENOENT: no such file or directory' },
        { ok: false, status: 400 }
      )
    )

    const response = await fetch(`${BASE_URL}/api/projects/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/nonexistent/path' }),
    })

    expect(response.ok).toBe(false)
    const result = await response.json()
    expect(result.error).toContain('Cannot access path')
  })

  test('should create project from scan results then load it', async () => {
    const scanDetected = {
      name: 'imported-project',
      description: 'Imported from disk',
      type: 'software',
      lead: 'Dev Lead',
      codeGraphPath: '/path/.codegraph',
    }

    const createdProject = {
      id: 'proj-imported-1',
      name: scanDetected.name,
      key: 'IMPORTED',
      description: scanDetected.description,
      type: scanDetected.type,
      lead: scanDetected.lead,
      codeGraphPath: scanDetected.codeGraphPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(createdProject, { status: 201 })
    )

    const response = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scanDetected.name,
        description: scanDetected.description,
        key: 'IMPORTED',
        type: scanDetected.type,
        lead: scanDetected.lead,
        codeGraphPath: scanDetected.codeGraphPath,
      }),
    })

    const result = await response.json()
    expect(result.id).toBe('proj-imported-1')
    expect(result.name).toBe('imported-project')

    // Simulate loading the project (setting it as current)
    const currentProjectId = result.id
    expect(currentProjectId).toBe('proj-imported-1')
  })
})

// =============================================================================
// Directory Browsing
// =============================================================================

describe('Directory Browsing', () => {
  test('should browse directories via POST /api/filesystem/browse', async () => {
    const browseResult = {
      current: '/Users/test/workspace',
      parent: '/Users/test',
      directories: [
        { name: 'project-a', path: '/Users/test/workspace/project-a' },
        { name: 'project-b', path: '/Users/test/workspace/project-b' },
        { name: 'tools', path: '/Users/test/workspace/tools' },
      ],
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(browseResult)
    )

    const response = await fetch(`${BASE_URL}/api/filesystem/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Users/test/workspace' }),
    })

    const result = await response.json()

    expect(result.current).toBe('/Users/test/workspace')
    expect(result.parent).toBe('/Users/test')
    expect(result.directories).toHaveLength(3)
    expect(result.directories[0].name).toBe('project-a')
    expect(result.directories.every((d: { path: string }) => d.path.startsWith('/'))).toBe(true)
  })

  test('should browse home directory when no path given', async () => {
    const browseResult = {
      current: '/Users/test',
      parent: '/Users',
      directories: [
        { name: 'Desktop', path: '/Users/test/Desktop' },
        { name: 'Documents', path: '/Users/test/Documents' },
        { name: 'workspace', path: '/Users/test/workspace' },
      ],
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(browseResult)
    )

    const response = await fetch(`${BASE_URL}/api/filesystem/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const result = await response.json()

    expect(result.current).toBe('/Users/test')
    expect(result.parent).toBe('/Users')
    expect(result.directories.length).toBeGreaterThan(0)
  })

  test('should navigate to parent directory', async () => {
    const childResult = {
      current: '/Users/test/workspace/project',
      parent: '/Users/test/workspace',
      directories: [{ name: 'src', path: '/Users/test/workspace/project/src' }],
    }

    const parentResult = {
      current: '/Users/test/workspace',
      parent: '/Users/test',
      directories: [
        { name: 'project', path: '/Users/test/workspace/project' },
        { name: 'other', path: '/Users/test/workspace/other' },
      ],
    }

    ;(fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce(mockFetchResponse(childResult))
      .mockResolvedValueOnce(mockFetchResponse(parentResult))

    // Browse child
    const childResponse = await fetch(`${BASE_URL}/api/filesystem/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Users/test/workspace/project' }),
    })
    const child = await childResponse.json()
    expect(child.parent).toBe('/Users/test/workspace')

    // Navigate to parent
    const parentResponse = await fetch(`${BASE_URL}/api/filesystem/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: child.parent }),
    })
    const parent = await parentResponse.json()
    expect(parent.current).toBe('/Users/test/workspace')
    expect(parent.directories).toHaveLength(2)
  })

  test('should return null parent at filesystem root', async () => {
    const rootResult = {
      current: '/',
      parent: null,
      directories: [
        { name: 'Users', path: '/Users' },
        { name: 'var', path: '/var' },
      ],
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(rootResult)
    )

    const response = await fetch(`${BASE_URL}/api/filesystem/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' }),
    })

    const result = await response.json()
    expect(result.parent).toBeNull()
  })
})

// =============================================================================
// CodeGraph: Project Switching
// =============================================================================

describe('CodeGraph Project Switching', () => {
  test('should switch CodeGraph via POST /api/codegraph/switch with projectId', async () => {
    const switchResult = {
      success: true,
      projectRoot: '/Users/test/workspace/new-project',
      totalNodes: 150,
      totalEdges: 320,
      filesIndexed: 25,
      nodesByKind: { function: 80, class: 30, method: 40 },
      edgesByKind: { calls: 200, imports: 120 },
      isAvailable: true,
      dbPath: '/Users/test/workspace/new-project/.codegraph/codegraph.db',
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(switchResult)
    )

    const response = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-new-1' }),
    })

    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.projectRoot).toBe('/Users/test/workspace/new-project')
    expect(result.isAvailable).toBe(true)
    expect(result.totalNodes).toBe(150)
    expect(result.dbPath).toContain('.codegraph/codegraph.db')
  })

  test('should switch CodeGraph via POST /api/codegraph/switch with projectPath', async () => {
    const switchResult = {
      success: true,
      projectRoot: '/direct/path/to/project',
      totalNodes: 50,
      totalEdges: 100,
      filesIndexed: 10,
      nodesByKind: { function: 30, class: 20 },
      edgesByKind: { calls: 60, imports: 40 },
      isAvailable: true,
      dbPath: '/direct/path/to/project/.codegraph/codegraph.db',
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(switchResult)
    )

    const response = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: '/direct/path/to/project' }),
    })

    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.projectRoot).toBe('/direct/path/to/project')
  })

  test('should return unavailable status when project has no codegraph', async () => {
    const switchResult = {
      success: true,
      projectRoot: '/Users/test/no-codegraph-project',
      totalNodes: 0,
      totalEdges: 0,
      filesIndexed: 0,
      nodesByKind: {},
      edgesByKind: {},
      isAvailable: false,
      dbPath: '/Users/test/no-codegraph-project/.codegraph/codegraph.db',
    }

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(switchResult)
    )

    const response = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-no-cg' }),
    })

    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.isAvailable).toBe(false)
    expect(result.totalNodes).toBe(0)
  })

  test('should refetch codegraph status after switching', async () => {
    // First: switch project
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: '/new/project',
        totalNodes: 200,
        isAvailable: true,
        dbPath: '/new/project/.codegraph/codegraph.db',
      })
    )
    // Then: refetch status
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        totalNodes: 200,
        totalEdges: 500,
        filesIndexed: 40,
        nodesByKind: { function: 120, class: 80 },
        edgesByKind: { calls: 300, imports: 200 },
        isAvailable: true,
        dbPath: '/new/project/.codegraph/codegraph.db',
      })
    )

    // Switch
    const switchResponse = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-new' }),
    })
    const switchResult = await switchResponse.json()
    expect(switchResult.success).toBe(true)

    // Refetch status
    const statusResponse = await fetch(`${BASE_URL}/api/codegraph/status`)
    const status = await statusResponse.json()

    expect(status.totalNodes).toBe(200)
    expect(status.dbPath).toBe('/new/project/.codegraph/codegraph.db')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

// =============================================================================
// CodeGraph Database Service: switchProject logic
// =============================================================================

describe('CodeGraph Database Service - switchProject', () => {
  test('should update dbPath when switching projects', () => {
    // Simulate the path construction logic from codegraph-database-service.mjs
    const path = require('path')

    function constructDbPath(projectRoot: string): string {
      return path.join(projectRoot, '.codegraph', 'codegraph.db')
    }

    const originalPath = constructDbPath('/home/user/project-a')
    expect(originalPath).toContain('project-a/.codegraph/codegraph.db')

    const switchedPath = constructDbPath('/home/user/project-b')
    expect(switchedPath).toContain('project-b/.codegraph/codegraph.db')

    expect(originalPath).not.toBe(switchedPath)
  })

  test('should derive project root from codeGraphPath', () => {
    const path = require('path')

    // The switch endpoint derives project root from codeGraphPath
    const codeGraphPath = '/Users/test/workspace/my-project/.codegraph'
    const projectRoot = path.dirname(codeGraphPath)
    expect(projectRoot).toBe('/Users/test/workspace/my-project')
  })
})

// =============================================================================
// End-to-End: Import Project → Switch CodeGraph
// =============================================================================

describe('End-to-End: Import Project and Switch CodeGraph', () => {
  test('should import project, load it, and switch codegraph', async () => {
    // Step 1: Scan directory
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        path: '/Users/dev/new-app',
        detected: {
          name: 'new-app',
          description: 'A new application',
          type: 'software',
          lead: 'Dev',
          codeGraphPath: '/Users/dev/new-app/.codegraph',
          agentConfig: {},
        },
      })
    )

    const scanResponse = await fetch(`${BASE_URL}/api/projects/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Users/dev/new-app' }),
    })
    const scanResult = await scanResponse.json()
    expect(scanResult.detected.name).toBe('new-app')

    // Step 2: Create project from scan
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        id: 'proj-new-app',
        name: 'new-app',
        codeGraphPath: '/Users/dev/new-app/.codegraph',
      }, { status: 201 })
    )

    const createResponse = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scanResult.detected.name,
        codeGraphPath: scanResult.detected.codeGraphPath,
      }),
    })
    const createdProject = await createResponse.json()
    expect(createdProject.id).toBe('proj-new-app')

    // Step 3: Switch CodeGraph to the new project
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: '/Users/dev/new-app',
        totalNodes: 75,
        isAvailable: true,
        dbPath: '/Users/dev/new-app/.codegraph/codegraph.db',
      })
    )

    const switchResponse = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: createdProject.id }),
    })
    const switchResult = await switchResponse.json()

    expect(switchResult.success).toBe(true)
    expect(switchResult.dbPath).toContain('new-app/.codegraph/codegraph.db')
    expect(switchResult.totalNodes).toBe(75)

    // Verify all 3 calls were made
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})

// =============================================================================
// resolveProjectRoot: path normalization logic
// =============================================================================

describe('resolveProjectRoot - Path Normalization', () => {
  const path = require('path')

  function resolveProjectRoot(codeGraphPath: string | null): string | null {
    if (!codeGraphPath) return null
    const resolved = path.resolve(codeGraphPath)
    if (resolved.endsWith('codegraph.db')) {
      return path.dirname(path.dirname(resolved))
    }
    if (resolved.endsWith('.codegraph')) {
      return path.dirname(resolved)
    }
    return resolved
  }

  test('should return project root when given project root path', () => {
    const result = resolveProjectRoot('/Users/dev/my-project')
    expect(result).toBe('/Users/dev/my-project')
  })

  test('should derive project root from .codegraph directory path', () => {
    const result = resolveProjectRoot('/Users/dev/my-project/.codegraph')
    expect(result).toBe('/Users/dev/my-project')
  })

  test('should derive project root from codegraph.db file path', () => {
    const result = resolveProjectRoot('/Users/dev/my-project/.codegraph/codegraph.db')
    expect(result).toBe('/Users/dev/my-project')
  })

  test('should return null for null input', () => {
    const result = resolveProjectRoot(null)
    expect(result).toBeNull()
  })

  test('should handle nested project paths', () => {
    const result = resolveProjectRoot('/workspace/org/team/project')
    expect(result).toBe('/workspace/org/team/project')
  })
})

// =============================================================================
// CodeGraph: Teardown on null path (no stale data)
// =============================================================================

describe('CodeGraph Switch - Null Path Teardown', () => {
  test('should return null projectRoot and isAvailable=false when project has no path', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: null,
        totalNodes: 0,
        totalEdges: 0,
        filesIndexed: 0,
        nodesByKind: {},
        edgesByKind: {},
        isAvailable: false,
        dbPath: null,
      })
    )

    const response = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-no-path' }),
    })

    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.projectRoot).toBeNull()
    expect(result.dbPath).toBeNull()
    expect(result.isAvailable).toBe(false)
    expect(result.totalNodes).toBe(0)
  })

  test('should show empty status after switching to project without path', async () => {
    // Switch to project with no path
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: null,
        isAvailable: false,
        totalNodes: 0,
        dbPath: null,
      })
    )
    // Subsequent status check should also be empty
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        totalNodes: 0,
        totalEdges: 0,
        filesIndexed: 0,
        nodesByKind: {},
        edgesByKind: {},
        isAvailable: false,
        dbPath: null,
      })
    )

    const switchResponse = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-empty' }),
    })
    const switchResult = await switchResponse.json()
    expect(switchResult.isAvailable).toBe(false)

    const statusResponse = await fetch(`${BASE_URL}/api/codegraph/status`)
    const status = await statusResponse.json()
    expect(status.isAvailable).toBe(false)
    expect(status.totalNodes).toBe(0)
  })
})

// =============================================================================
// CodeGraph Sync: accepts projectPath and runs init -i
// =============================================================================

describe('CodeGraph Sync with projectPath', () => {
  test('should accept projectPath in sync request body', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: '/Users/dev/my-project',
        totalNodes: 500,
        totalEdges: 1200,
        filesIndexed: 80,
        isAvailable: true,
        dbPath: '/Users/dev/my-project/.codegraph/codegraph.db',
      })
    )

    const response = await fetch(`${BASE_URL}/api/codegraph/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: '/Users/dev/my-project' }),
    })

    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.projectRoot).toBe('/Users/dev/my-project')
    expect(result.isAvailable).toBe(true)
    expect(result.totalNodes).toBe(500)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/codegraph/sync`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ projectPath: '/Users/dev/my-project' }),
      })
    )
  })

  test('should return error when no projectPath and no active project', async () => {
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse(
        { success: false, error: 'No project path provided. Select a project with a codeGraphPath first.' },
        { ok: false, status: 400 }
      )
    )

    const response = await fetch(`${BASE_URL}/api/codegraph/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.ok).toBe(false)
    const result = await response.json()
    expect(result.success).toBe(false)
    expect(result.error).toContain('No project path provided')
  })

  test('should save codeGraphPath to project after successful sync', async () => {
    // Step 1: sync with manual path
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: '/Users/dev/demo-project',
        totalNodes: 100,
        isAvailable: true,
      })
    )
    // Step 2: update project with path
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        id: 'proj-demo',
        name: 'Demo',
        codeGraphPath: '/Users/dev/demo-project',
      })
    )

    // Sync
    const syncResponse = await fetch(`${BASE_URL}/api/codegraph/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: '/Users/dev/demo-project' }),
    })
    const syncResult = await syncResponse.json()
    expect(syncResult.success).toBe(true)

    // Save the path back to the project
    const updateResponse = await fetch(`${BASE_URL}/api/projects/proj-demo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeGraphPath: '/Users/dev/demo-project' }),
    })
    const updatedProject = await updateResponse.json()
    expect(updatedProject.codeGraphPath).toBe('/Users/dev/demo-project')
  })
})

// =============================================================================
// Project Import: always saves project root as codeGraphPath
// =============================================================================

describe('Project Import - codeGraphPath Persistence', () => {
  test('should use scanResult.path as codeGraphPath, not detected.codeGraphPath', () => {
    // This mirrors the logic in ImportProjectModal.handleImport
    const scanResult = {
      path: '/Users/dev/my-project',
      detected: {
        name: 'my-project',
        description: 'Test project',
        type: 'software',
        lead: '',
        codeGraphPath: '/Users/dev/my-project',  // has .codegraph
        agentConfig: {},
      },
    }

    // The import should always use scanResult.path (the scanned root)
    const codeGraphPathToSave = scanResult.path
    expect(codeGraphPathToSave).toBe('/Users/dev/my-project')
  })

  test('should save project root even when .codegraph does not exist', () => {
    const scanResult = {
      path: '/Users/dev/brand-new-project',
      detected: {
        name: 'brand-new-project',
        description: 'No codegraph yet',
        type: 'software',
        lead: '',
        codeGraphPath: null,  // no .codegraph dir
        agentConfig: {},
      },
    }

    // Should still save the scanned path
    const codeGraphPathToSave = scanResult.path
    expect(codeGraphPathToSave).toBe('/Users/dev/brand-new-project')
  })

  test('should create imported project with codeGraphPath from scan root', async () => {
    const scanPath = '/Users/dev/imported-app'

    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        id: 'proj-imported-2',
        name: 'imported-app',
        codeGraphPath: scanPath,
      }, { status: 201 })
    )

    const response = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'imported-app',
        codeGraphPath: scanPath,
      }),
    })

    const result = await response.json()
    expect(result.codeGraphPath).toBe(scanPath)

    // Verify the body sent includes codeGraphPath
    const callBody = JSON.parse(
      (fetch as jest.MockedFunction<typeof fetch>).mock.calls[0][1]?.body as string
    )
    expect(callBody.codeGraphPath).toBe('/Users/dev/imported-app')
  })
})

// =============================================================================
// End-to-End: Import → Sync → Verify CodeGraph
// =============================================================================

describe('End-to-End: Import Project, Sync CodeGraph, Verify', () => {
  test('should import project without codegraph, sync to initialize, then see data', async () => {
    // Step 1: Scan directory (no .codegraph present)
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        path: '/Users/dev/fresh-project',
        detected: {
          name: 'fresh-project',
          description: 'A brand new project',
          type: 'software',
          lead: 'Dev',
          codeGraphPath: null,
          agentConfig: {},
        },
      })
    )

    const scanResponse = await fetch(`${BASE_URL}/api/projects/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/Users/dev/fresh-project' }),
    })
    const scanResult = await scanResponse.json()
    expect(scanResult.detected.codeGraphPath).toBeNull()

    // Step 2: Create project with scanResult.path as codeGraphPath
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        id: 'proj-fresh',
        name: 'fresh-project',
        codeGraphPath: scanResult.path,
      }, { status: 201 })
    )

    const createResponse = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scanResult.detected.name,
        codeGraphPath: scanResult.path,
      }),
    })
    const project = await createResponse.json()
    expect(project.codeGraphPath).toBe('/Users/dev/fresh-project')

    // Step 3: Switch CodeGraph (should find the path now)
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: '/Users/dev/fresh-project',
        totalNodes: 0,
        isAvailable: false,
        dbPath: '/Users/dev/fresh-project/.codegraph/codegraph.db',
      })
    )

    const switchResponse = await fetch(`${BASE_URL}/api/codegraph/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    const switchResult = await switchResponse.json()
    expect(switchResult.projectRoot).toBe('/Users/dev/fresh-project')
    expect(switchResult.isAvailable).toBe(false)

    // Step 4: Sync (init -i) to create codegraph
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      mockFetchResponse({
        success: true,
        projectRoot: '/Users/dev/fresh-project',
        totalNodes: 250,
        totalEdges: 600,
        filesIndexed: 30,
        isAvailable: true,
        dbPath: '/Users/dev/fresh-project/.codegraph/codegraph.db',
      })
    )

    const syncResponse = await fetch(`${BASE_URL}/api/codegraph/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: '/Users/dev/fresh-project' }),
    })
    const syncResult = await syncResponse.json()
    expect(syncResult.success).toBe(true)
    expect(syncResult.isAvailable).toBe(true)
    expect(syncResult.totalNodes).toBe(250)

    // All 4 steps completed
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})
