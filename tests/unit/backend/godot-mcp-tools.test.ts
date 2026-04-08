import { GodotMCPTools } from '../../../src/mcp/godot-tools'
import * as fsPromises from 'fs/promises'
import * as path from 'path'

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
}))

const mockReadFile = fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>
const mockReaddir = fsPromises.readdir as jest.MockedFunction<typeof fsPromises.readdir>
const mockAccess = fsPromises.access as jest.MockedFunction<typeof fsPromises.access>

describe('GodotMCPTools', () => {
  const proj = '/tmp/godot-test-proj'

  beforeEach(() => {
    jest.clearAllMocks()
    mockAccess.mockResolvedValue(undefined)
  })

  describe('assertValidGodotProjectRoot', () => {
    test('resolves when project.godot exists', async () => {
      mockAccess.mockResolvedValueOnce(undefined)
      await expect(GodotMCPTools.assertValidGodotProjectRoot(proj)).resolves.toBeUndefined()
      expect(mockAccess).toHaveBeenCalledWith(path.join(path.resolve(proj), 'project.godot'))
    })

    test('throws when project.godot missing', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'))
      await expect(GodotMCPTools.assertValidGodotProjectRoot(proj)).rejects.toThrow(
        'No project.godot found'
      )
    })
  })

  describe('analyzeScene', () => {
    test('reads scene with relative path under project root', async () => {
      const scene = `[gd_scene load_steps=2 format=3]
[node name="Root" type="Node3D"]
[node name="Mesh" type="MeshInstance3D" parent="."]`
      mockReadFile.mockResolvedValueOnce(scene)

      const tools = new GodotMCPTools(proj)
      const result = await tools.analyzeScene('scenes/level.tscn', true)

      expect(mockReadFile).toHaveBeenCalledWith(path.join(proj, 'scenes/level.tscn'), 'utf-8')
      expect(result.scenePath).toBe('scenes/level.tscn')
      expect(result.nodeCount).toBe(2)
      expect(result.performance).toBeDefined()
      expect(result.complexityScore).toBeDefined()
    })

    test('strips res:// prefix', async () => {
      mockReadFile.mockResolvedValueOnce('[gd_scene format=3]\n[node name="R" type="Node"]')
      const tools = new GodotMCPTools(proj)
      await tools.analyzeScene('res://foo/bar.tscn', true)
      expect(mockReadFile).toHaveBeenCalledWith(path.join(proj, 'foo/bar.tscn'), 'utf-8')
    })

    test('strips res:/ single-slash prefix', async () => {
      mockReadFile.mockResolvedValueOnce('[gd_scene format=3]\n[node name="R" type="Node"]')
      const tools = new GodotMCPTools(proj)
      await tools.analyzeScene('res:/foo/bar.tscn', true)
      expect(mockReadFile).toHaveBeenCalledWith(path.join(proj, 'foo/bar.tscn'), 'utf-8')
    })

    test('uses run/main_scene when scenePath omitted', async () => {
      const projectGodot = `config_version=5
[application]
run/main_scene="res://scenes/main_entry.tscn"
`
      const scene = '[gd_scene format=3]\n[node name="X" type="Node"]'
      mockReadFile
        .mockResolvedValueOnce(projectGodot)
        .mockResolvedValueOnce(scene)

      const tools = new GodotMCPTools(proj)
      const result = await tools.analyzeScene(undefined, true)

      expect(result.scenePath).toBe('scenes/main_entry.tscn')
      expect(mockReadFile).toHaveBeenLastCalledWith(path.join(proj, 'scenes/main_entry.tscn'), 'utf-8')
    })

  })

  describe('optimizeGDScript', () => {
    test('resolves res:// and reads script', async () => {
      const gd = `extends Node
func _process(_d):
    get_node("Player")`
      mockReadFile.mockResolvedValueOnce(gd)
      const tools = new GodotMCPTools(proj)
      const result = await tools.optimizeGDScript('res://scripts/a.gd', 'basic')
      expect(mockReadFile).toHaveBeenCalledWith(path.join(proj, 'scripts/a.gd'), 'utf-8')
      expect(result.scriptPath).toBe('scripts/a.gd')
      expect(result.suggestions.length).toBeGreaterThan(0)
    })

    test('rejects empty scriptPath', async () => {
      const tools = new GodotMCPTools(proj)
      await expect(tools.optimizeGDScript('', 'basic')).rejects.toThrow('scriptPath is required')
    })
  })

  describe('analyzeProject', () => {
    test('returns project info when project.godot readable', async () => {
      mockReadFile.mockImplementation(async (p: unknown) => {
        if (String(p).endsWith('project.godot')) {
          return `config_version=5
[application]
config/name="TestGame"
run/main_scene="res://scenes/a.tscn"
`
        }
        throw new Error('not project file')
      })
      mockReaddir.mockResolvedValue([] as any)

      const tools = new GodotMCPTools(proj)
      const result = await tools.analyzeProject()
      expect(result.name).toBe('TestGame')
      expect(result.isValid).toBe(true)
      expect(result.path).toBe(path.resolve(proj))
    })
  })

  describe('generateComponent', () => {
    test('returns player_controller template', async () => {
      const tools = new GodotMCPTools(proj)
      const result = await tools.generateComponent('player_controller', ['jump'])
      expect(result.generated).toBe(true)
      expect(result.files).toContain('PlayerController.gd')
      expect(result.code['PlayerController.gd']).toContain('CharacterBody3D')
    })
  })
})
