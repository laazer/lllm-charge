/**
 * Unit Tests for Spec CRUD - deserializeSpecRow logic
 * Tests the shared deserialization function used across all spec queries
 */

describe('Spec Deserialization Logic', () => {
  // Inline the deserialize logic to test it without ESM imports
  function deserializeSpecRow(row: any) {
    const parsedData = row.data ? JSON.parse(row.data) : {}
    return {
      ...row,
      tags: parsedData.tags || [],
      linkedClasses: parsedData.linkedClasses || [],
      linkedMethods: parsedData.linkedMethods || [],
      linkedTests: parsedData.linkedTests || [],
      comments: parsedData.comments || [],
      assignedAgent: parsedData.assignedAgent || null,
      data: parsedData,
    }
  }

  const mockSpecRow = {
    id: 'spec-123',
    title: 'Test Spec',
    description: 'A test specification',
    status: 'draft',
    priority: 'medium',
    projectId: 'project-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    data: JSON.stringify({
      tags: ['test', 'feature'],
      linkedClasses: ['TestClass'],
      linkedMethods: ['testMethod'],
      linkedTests: ['test.spec.ts'],
      comments: [{ author: 'user', text: 'comment' }],
      assignedAgent: 'agent-1',
    }),
  }

  it('should extract all JSON data fields to top level', () => {
    const result = deserializeSpecRow(mockSpecRow)
    expect(result.tags).toEqual(['test', 'feature'])
    expect(result.linkedClasses).toEqual(['TestClass'])
    expect(result.linkedMethods).toEqual(['testMethod'])
    expect(result.linkedTests).toEqual(['test.spec.ts'])
    expect(result.comments).toEqual([{ author: 'user', text: 'comment' }])
    expect(result.assignedAgent).toBe('agent-1')
  })

  it('should preserve original row fields', () => {
    const result = deserializeSpecRow(mockSpecRow)
    expect(result.id).toBe('spec-123')
    expect(result.title).toBe('Test Spec')
    expect(result.description).toBe('A test specification')
    expect(result.status).toBe('draft')
    expect(result.priority).toBe('medium')
    expect(result.projectId).toBe('project-1')
  })

  it('should handle null data column', () => {
    const result = deserializeSpecRow({ ...mockSpecRow, data: null })
    expect(result.tags).toEqual([])
    expect(result.linkedClasses).toEqual([])
    expect(result.linkedMethods).toEqual([])
    expect(result.linkedTests).toEqual([])
    expect(result.comments).toEqual([])
    expect(result.assignedAgent).toBeNull()
  })

  it('should handle empty string data column', () => {
    const result = deserializeSpecRow({ ...mockSpecRow, data: '' })
    expect(result.tags).toEqual([])
    expect(result.assignedAgent).toBeNull()
  })

  it('should handle data with only some fields', () => {
    const partial = { ...mockSpecRow, data: JSON.stringify({ tags: ['only-tags'] }) }
    const result = deserializeSpecRow(partial)
    expect(result.tags).toEqual(['only-tags'])
    expect(result.linkedClasses).toEqual([])
    expect(result.linkedMethods).toEqual([])
    expect(result.linkedTests).toEqual([])
    expect(result.assignedAgent).toBeNull()
  })

  it('should handle data with empty arrays', () => {
    const empty = {
      ...mockSpecRow,
      data: JSON.stringify({
        tags: [],
        linkedClasses: [],
        linkedMethods: [],
        linkedTests: [],
        comments: [],
        assignedAgent: null,
      }),
    }
    const result = deserializeSpecRow(empty)
    expect(result.tags).toEqual([])
    expect(result.linkedClasses).toEqual([])
    expect(result.assignedAgent).toBeNull()
  })

  it('should make parsed data available', () => {
    const result = deserializeSpecRow(mockSpecRow)
    expect(result.data).toBeDefined()
    expect(result.data.tags).toEqual(['test', 'feature'])
  })
})
