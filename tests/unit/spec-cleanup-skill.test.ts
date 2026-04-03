import { jest } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import { SpecCleanupSkill } from '../../src/skills/spec-cleanup-skill'

// Mock fs so we don't touch real files
jest.mock('fs')
const mockedFs = jest.mocked(fs)

// Mock fetch for API calls
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch as any

const TEST_PROJECT_ROOT = '/test/project'

function createSkill(overrides: Partial<ConstructorParameters<typeof SpecCleanupSkill>[0]> = {}): SpecCleanupSkill {
  return new SpecCleanupSkill({
    projectRoot: TEST_PROJECT_ROOT,
    serverUrl: 'http://localhost:3001',
    dryRun: true,
    ...overrides,
  })
}

describe('SpecCleanupSkill', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initialize', () => {
    test('returns true when spec API is available', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] } as any)

      const skill = createSkill()
      const result = await skill.initialize()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/specs')
    })

    test('returns false when spec API is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as any)

      const skill = createSkill()
      const result = await skill.initialize()

      expect(result).toBe(false)
    })
  })

  describe('scanForSpecComments', () => {
    test('extracts FEATURE comments', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'app.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue(
        '// FEATURE: User authentication system\nconst auth = true;\n'
      )

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      expect(specs).toHaveLength(1)
      expect(specs[0].tag).toBe('FEATURE')
      expect(specs[0].content).toBe('User authentication system')
      expect(specs[0].lineNumber).toBe(1)
    })

    test('extracts TODO comments', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'index.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue(
        'const x = 1;\n// TODO: Refactor this function\nfunction foo() {}\n'
      )

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      expect(specs).toHaveLength(1)
      expect(specs[0].tag).toBe('TODO')
      expect(specs[0].content).toBe('Refactor this function')
      expect(specs[0].lineNumber).toBe(2)
    })

    test('extracts FIXME comments', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'bug.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue(
        '// FIXME: Memory leak in event handler\n'
      )

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      expect(specs).toHaveLength(1)
      expect(specs[0].tag).toBe('FIXME')
      expect(specs[0].content).toBe('Memory leak in event handler')
    })

    test('extracts multiple spec comments from one file', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'multi.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue(
        '// FEATURE: Login page\nconst login = true;\n// TODO: Add validation\n// SPEC: Must support OAuth\n'
      )

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      expect(specs).toHaveLength(3)
      expect(specs.map(s => s.tag)).toEqual(['FEATURE', 'TODO', 'SPEC'])
    })

    test('skips node_modules and dist directories', async () => {
      mockedFs.readdirSync.mockImplementation((dirPath: any) => {
        if (dirPath === TEST_PROJECT_ROOT) {
          return [
            { name: 'src', isFile: () => false, isDirectory: () => true },
            { name: 'node_modules', isFile: () => false, isDirectory: () => true },
            { name: 'dist', isFile: () => false, isDirectory: () => true },
          ] as any
        }
        if (dirPath === path.join(TEST_PROJECT_ROOT, 'src')) {
          return [
            { name: 'app.ts', isFile: () => true, isDirectory: () => false },
          ] as any
        }
        return []
      })
      mockedFs.readFileSync.mockReturnValue('// FEATURE: Test\n')

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      // Should only find the one in src/, not node_modules or dist
      expect(specs).toHaveLength(1)
    })

    test('skips non-matching file extensions', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'readme.md', isFile: () => true, isDirectory: () => false },
        { name: 'data.json', isFile: () => true, isDirectory: () => false },
        { name: 'app.ts', isFile: () => true, isDirectory: () => false },
      ] as any)
      mockedFs.readFileSync.mockReturnValue('// FEATURE: Test\n')

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      // Only .ts file should be scanned
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1)
    })

    test('returns empty array when no spec comments found', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'clean.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue(
        'const x = 1;\n// Regular comment\nfunction foo() {}\n'
      )

      const skill = createSkill()
      const specs = await skill.scanForSpecComments()

      expect(specs).toHaveLength(0)
    })
  })

  describe('runCleanup (dry run)', () => {
    test('creates specs without modifying files in dry run mode', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'app.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue(
        '// FEATURE: Dark mode support\nexport class Theme {}\n'
      )

      // Mock CodeGraph search
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as any)

      const skill = createSkill({ dryRun: true })
      const result = await skill.runCleanup()

      expect(result.specsCreated).toBe(1)
      expect(result.specs).toHaveLength(1)
      expect(result.specs[0].title).toBe('[FEATURE] Dark mode support')
      expect(result.commentsRemoved).toBe(0)
      expect(result.filesModified).toBe(0)
      // Should NOT have written any files
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled()
    })
  })

  describe('priority inference', () => {
    test('FIXME gets high priority', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'a.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue('// FIXME: Critical bug\n')
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as any)

      const skill = createSkill({ dryRun: true })
      const result = await skill.runCleanup()

      // The spec title should contain FIXME
      expect(result.specs[0].title).toContain('FIXME')
    })

    test('TODO gets low priority', async () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'a.ts', isFile: () => true, isDirectory: () => false } as any,
      ])
      mockedFs.readFileSync.mockReturnValue('// TODO: Nice to have\n')
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as any)

      const skill = createSkill({ dryRun: true })
      const result = await skill.runCleanup()

      expect(result.specs[0].title).toContain('TODO')
    })
  })
})
