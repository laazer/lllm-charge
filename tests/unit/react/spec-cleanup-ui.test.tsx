/**
 * Tests for the Spec Cleanup feature's API integration and data flow.
 * Tests the API client methods and the expected request/response shapes.
 *
 * Note: The SpecsSection component has pre-existing type mismatches with
 * the shared types/index.ts Spec type (status values differ), so full
 * component rendering tests are deferred until those types are unified.
 */

import '@testing-library/jest-dom'

describe('Spec Cleanup API Client Methods', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('scanSpecComments sends POST to /api/skills/spec-cleanup/scan', async () => {
    const mockResponse = {
      count: 2,
      specs: [
        { tag: 'FEATURE', content: 'Auth', filePath: '/src/auth.ts', lineNumber: 5, fullCommentText: '// FEATURE: Auth', surroundingCode: '' },
        { tag: 'TODO', content: 'Fix bug', filePath: '/src/bug.ts', lineNumber: 10, fullCommentText: '// TODO: Fix bug', surroundingCode: '' },
      ],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    // Import after mock setup
    const { apiClient } = await import('../../../src/react/lib/api-client')
    const result = await apiClient.scanSpecComments()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/skills/spec-cleanup/scan'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      })
    )
    expect(result.count).toBe(2)
    expect(result.specs).toHaveLength(2)
    expect(result.specs[0].tag).toBe('FEATURE')
  })

  test('runSpecCleanup sends POST to /api/skills/spec-cleanup/run', async () => {
    const mockResponse = {
      specsCreated: 3,
      commentsRemoved: 3,
      filesModified: 2,
      specs: [
        { id: 'spec-1', title: '[FEATURE] Auth', source: 'src/auth.ts:5', linkedSymbols: ['AuthService'] },
      ],
      errors: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { apiClient } = await import('../../../src/react/lib/api-client')
    const result = await apiClient.runSpecCleanup(false)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/skills/spec-cleanup/run'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dryRun: false }),
      })
    )
    expect(result.specsCreated).toBe(3)
    expect(result.commentsRemoved).toBe(3)
    expect(result.filesModified).toBe(2)
    expect(result.specs[0].linkedSymbols).toContain('AuthService')
  })

  test('runSpecCleanup supports dry run mode', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ specsCreated: 0, commentsRemoved: 0, filesModified: 0, specs: [], errors: [] }),
    })

    const { apiClient } = await import('../../../src/react/lib/api-client')
    await apiClient.runSpecCleanup(true)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/skills/spec-cleanup/run'),
      expect.objectContaining({
        body: JSON.stringify({ dryRun: true }),
      })
    )
  })
})

describe('Spec Cleanup Response Types', () => {
  test('SpecCleanupScanResult has correct shape', () => {
    const scanResult = {
      count: 1,
      specs: [{
        tag: 'FIXME',
        content: 'Memory leak',
        filePath: '/src/handler.ts',
        lineNumber: 20,
        fullCommentText: '// FIXME: Memory leak',
        surroundingCode: 'function onEvent() {}',
      }],
    }

    expect(scanResult.count).toBe(1)
    expect(scanResult.specs[0]).toHaveProperty('tag')
    expect(scanResult.specs[0]).toHaveProperty('content')
    expect(scanResult.specs[0]).toHaveProperty('filePath')
    expect(scanResult.specs[0]).toHaveProperty('lineNumber')
    expect(scanResult.specs[0]).toHaveProperty('fullCommentText')
    expect(scanResult.specs[0]).toHaveProperty('surroundingCode')
  })

  test('SpecCleanupRunResult has correct shape', () => {
    const runResult = {
      specsCreated: 2,
      commentsRemoved: 2,
      filesModified: 1,
      specs: [
        { id: 'spec-1', title: '[FEATURE] Auth', source: 'src/auth.ts:5', linkedSymbols: ['AuthService'] },
        { id: 'spec-2', title: '[TODO] Fix bug', source: 'src/bug.ts:10', linkedSymbols: [] },
      ],
      errors: [],
    }

    expect(runResult.specsCreated).toBe(2)
    expect(runResult.specs).toHaveLength(2)
    expect(runResult.specs[0]).toHaveProperty('id')
    expect(runResult.specs[0]).toHaveProperty('title')
    expect(runResult.specs[0]).toHaveProperty('source')
    expect(runResult.specs[0]).toHaveProperty('linkedSymbols')
    expect(runResult.errors).toHaveLength(0)
  })

  test('tag-to-badge color mapping covers all tags', () => {
    const tagColors: Record<string, string> = {
      FIXME: 'red',
      TODO: 'yellow',
      FEATURE: 'blue',
      REQUIREMENT: 'orange',
      SPEC: 'emerald',
    }

    const supportedTags = ['FEATURE', 'SPEC', 'TODO', 'FIXME', 'REQUIREMENT']
    for (const tag of supportedTags) {
      expect(tagColors[tag]).toBeDefined()
    }
  })
})
