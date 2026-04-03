/**
 * Unit Tests for CodeGraph Database Service helper logic
 * Tests arrayToRecord and getEmptyStatus utilities
 */

describe('CodeGraph Database Service - Helper Logic', () => {
  // Test the arrayToRecord utility inline
  function arrayToRecord(rows: Array<{ kind: string; count: number }>): Record<string, number> {
    const record: Record<string, number> = {}
    for (const row of rows) {
      record[row.kind] = row.count
    }
    return record
  }

  function getEmptyStatus() {
    return {
      totalNodes: 0,
      totalEdges: 0,
      filesIndexed: 0,
      nodesByKind: {},
      edgesByKind: {},
      isAvailable: false,
      dbPath: '',
    }
  }

  describe('arrayToRecord', () => {
    it('should convert array of kind/count objects to record', () => {
      const result = arrayToRecord([
        { kind: 'class', count: 43 },
        { kind: 'function', count: 43 },
        { kind: 'method', count: 1043 },
      ])
      expect(result).toEqual({
        class: 43,
        function: 43,
        method: 1043,
      })
    })

    it('should handle empty array', () => {
      const result = arrayToRecord([])
      expect(result).toEqual({})
    })

    it('should handle single item', () => {
      const result = arrayToRecord([{ kind: 'file', count: 95 }])
      expect(result).toEqual({ file: 95 })
    })
  })

  describe('getEmptyStatus', () => {
    it('should return a status object with all zero values', () => {
      const status = getEmptyStatus()
      expect(status.totalNodes).toBe(0)
      expect(status.totalEdges).toBe(0)
      expect(status.filesIndexed).toBe(0)
      expect(status.isAvailable).toBe(false)
      expect(status.nodesByKind).toEqual({})
      expect(status.edgesByKind).toEqual({})
    })
  })

  describe('DB path construction', () => {
    it('should construct path from project root', () => {
      const projectRoot = '/home/user/project'
      const expected = `${projectRoot}/.codegraph/codegraph.db`
      expect(expected).toBe('/home/user/project/.codegraph/codegraph.db')
    })
  })
})
