import { GodotMCPTools } from '../../../src/mcp/godot-tools'
import * as fs from 'fs'
import * as path from 'path'

// Mock filesystem operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn(),
}))

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...paths) => paths.join('/')),
  extname: jest.fn((filePath) => {
    const lastDot = filePath.lastIndexOf('.')
    return lastDot !== -1 ? filePath.substring(lastDot) : ''
  }),
  basename: jest.fn((filePath) => filePath.split('/').pop() || ''),
}))

const mockFs = fs as jest.Mocked<typeof fs>
const mockPath = path as jest.Mocked<typeof path>

describe('GodotMCPTools Backend Integration Tests', () => {
  let godotTools: GodotMCPTools

  beforeEach(() => {
    godotTools = new GodotMCPTools()
    jest.clearAllMocks()
  })

  describe('Scene Analysis', () => {
    test('should analyze Godot scene file successfully', async () => {
      const mockSceneContent = `[gd_scene load_steps=3 format=2]

[node name="Root" type="Node2D"]

[node name="Player" type="KinematicBody2D" parent="."]

[node name="Sprite" type="Sprite" parent="Player"]

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]`

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(mockSceneContent)

      const result = await godotTools.analyzeScene('/path/to/scene.tscn', true)

      expect(result).toBeDefined()
      expect(result.scenePath).toBe('/path/to/scene.tscn')
      expect(result.nodeCount).toBeGreaterThan(0)
      expect(result.complexity).toBeDefined()
      expect(result.performance).toBeDefined()
      expect(result.recommendations).toBeInstanceOf(Array)
    })

    test('should handle missing scene file gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false)

      await expect(godotTools.analyzeScene('/nonexistent/scene.tscn'))
        .rejects.toThrow('Scene file not found')
    })

    test('should analyze scene complexity correctly', async () => {
      const complexSceneContent = `[gd_scene load_steps=10 format=2]

[node name="Root" type="Node2D"]
[node name="Player" type="KinematicBody2D" parent="."]
[node name="Sprite" type="Sprite" parent="Player"]
[node name="AnimationPlayer" type="AnimationPlayer" parent="Player"]
[node name="StateMachine" type="Node" parent="Player"]
[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]
[node name="UI" type="CanvasLayer" parent="."]
[node name="HealthBar" type="TextureProgress" parent="UI"]
[node name="MenuButton" type="Button" parent="UI"]
[node name="Background" type="ParallaxBackground" parent="."]`

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(complexSceneContent)

      const result = await godotTools.analyzeScene('/path/to/complex.tscn', true)

      expect(result.nodeCount).toBeGreaterThan(5)
      expect(result.complexity).toBe('high')
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    test('should provide performance analysis when requested', async () => {
      const sceneContent = `[gd_scene load_steps=3 format=2]

[node name="Root" type="Node2D"]
[node name="Player" type="KinematicBody2D" parent="."]`

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(sceneContent)

      const result = await godotTools.analyzeScene('/path/to/scene.tscn', true)

      expect(result.performance).toBeDefined()
      expect(result.performance.estimatedLoadTime).toBeDefined()
      expect(result.performance.memoryUsage).toBeDefined()
      expect(result.performance.bottlenecks).toBeInstanceOf(Array)
    })
  })

  describe('GDScript Optimization', () => {
    test('should optimize GDScript code successfully', async () => {
      const mockScriptContent = `extends Node2D

var player_speed = 100

func _ready():
    print("Game started")

func _process(delta):
    if Input.is_action_pressed("ui_right"):
        position.x += player_speed * delta
    if Input.is_action_pressed("ui_left"):
        position.x -= player_speed * delta`

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(mockScriptContent)

      const result = await godotTools.optimizeGDScript('/path/to/script.gd', 'basic')

      expect(result).toBeDefined()
      expect(result.scriptPath).toBe('/path/to/script.gd')
      expect(result.optimizationLevel).toBe('basic')
      expect(result.optimizations).toBeInstanceOf(Array)
      expect(result.performanceGain).toBeDefined()
      expect(result.optimizedCode).toBeDefined()
    })

    test('should handle advanced optimization level', async () => {
      const scriptContent = `extends KinematicBody2D

var velocity = Vector2()
var speed = 200

func _physics_process(delta):
    velocity = Vector2()
    if Input.is_action_pressed("ui_right"):
        velocity.x += speed
    if Input.is_action_pressed("ui_left"):
        velocity.x -= speed
    
    velocity = move_and_slide(velocity)`

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(scriptContent)

      const result = await godotTools.optimizeGDScript('/path/to/player.gd', 'advanced')

      expect(result.optimizationLevel).toBe('advanced')
      expect(result.optimizations.length).toBeGreaterThan(0)
      expect(result.performanceGain).toBeGreaterThan(0)
    })

    test('should handle missing script file', async () => {
      mockFs.existsSync.mockReturnValue(false)

      await expect(godotTools.optimizeGDScript('/nonexistent/script.gd'))
        .rejects.toThrow('Script file not found')
    })

    test('should detect common optimization opportunities', async () => {
      const inefficientScript = `extends Node

func _ready():
    for i in range(1000):
        print(str(i) + " iteration")
        
func _process(delta):
    get_node("Player").position += Vector2(1, 0)
    get_node("Enemy").position += Vector2(-1, 0)`

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(inefficientScript)

      const result = await godotTools.optimizeGDScript('/path/to/inefficient.gd', 'basic')

      expect(result.optimizations).toContainEqual(
        expect.objectContaining({
          type: 'caching',
          description: expect.stringContaining('Cache node references')
        })
      )
    })
  })

  describe('Component Generation', () => {
    test('should generate player controller component', async () => {
      const result = await godotTools.generateComponent('player_controller', ['movement', 'jumping'])

      expect(result).toBeDefined()
      expect(result.componentType).toBe('player_controller')
      expect(result.features).toContain('movement')
      expect(result.features).toContain('jumping')
      expect(result.code).toBeDefined()
      expect(result.code).toContain('extends KinematicBody2D')
      expect(result.dependencies).toBeInstanceOf(Array)
    })

    test('should generate health system component', async () => {
      const result = await godotTools.generateComponent('health_system', ['damage', 'regeneration'])

      expect(result.componentType).toBe('health_system')
      expect(result.code).toContain('health')
      expect(result.code).toContain('damage')
      expect(result.usage).toBeDefined()
    })

    test('should generate inventory system component', async () => {
      const result = await godotTools.generateComponent('inventory_system', ['items', 'slots', 'stacking'])

      expect(result.componentType).toBe('inventory_system')
      expect(result.features).toContain('items')
      expect(result.features).toContain('slots')
      expect(result.features).toContain('stacking')
      expect(result.code).toContain('inventory')
    })

    test('should handle unknown component type gracefully', async () => {
      const result = await godotTools.generateComponent('unknown_component', [])

      expect(result.componentType).toBe('unknown_component')
      expect(result.code).toBeDefined()
      expect(result.code).toContain('extends Node')
    })

    test('should provide usage documentation for generated components', async () => {
      const result = await godotTools.generateComponent('state_machine', ['states', 'transitions'])

      expect(result.usage).toBeDefined()
      expect(result.usage).toContain('state')
      expect(result.documentation).toBeDefined()
    })
  })

  describe('Project Analysis', () => {
    test('should analyze Godot project successfully', async () => {
      // Mock project structure
      mockFs.existsSync.mockImplementation((filePath) => {
        return filePath.toString().includes('project.godot')
      })
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (filePath.toString().includes('project.godot')) {
          return `[application]
config/name="My Game"
run/main_scene="res://scenes/Main.tscn"`
        }
        return ''
      })

      mockFs.readdirSync.mockReturnValue(['scenes', 'scripts', 'assets'] as any)
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any)

      const result = await godotTools.analyzeProject()

      expect(result).toBeDefined()
      expect(result.projectName).toBeDefined()
      expect(result.godotVersion).toBeDefined()
      expect(result.scenes).toBeDefined()
      expect(result.scripts).toBeDefined()
      expect(result.assets).toBeDefined()
      expect(result.analysis).toBeDefined()
    })

    test('should handle missing project.godot file', async () => {
      mockFs.existsSync.mockReturnValue(false)

      await expect(godotTools.analyzeProject())
        .rejects.toThrow('No Godot project found')
    })

    test('should count project assets correctly', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('[application]\nconfig/name="Test Game"')
      
      // Mock file structure
      mockFs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath.toString().includes('scenes')) {
          return ['Main.tscn', 'Player.tscn', 'Enemy.tscn'] as any
        }
        if (dirPath.toString().includes('scripts')) {
          return ['Player.gd', 'Enemy.gd', 'GameManager.gd'] as any
        }
        if (dirPath.toString().includes('assets')) {
          return ['textures', 'audio'] as any
        }
        return ['scenes', 'scripts', 'assets'] as any
      })

      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any)

      const result = await godotTools.analyzeProject()

      expect(result.scenes.length).toBe(3)
      expect(result.scripts.length).toBe(3)
    })

    test('should analyze project complexity', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('[application]\nconfig/name="Complex Game"')
      
      // Mock large project structure
      const manyFiles = Array.from({ length: 50 }, (_, i) => `file${i}.tscn`)
      mockFs.readdirSync.mockReturnValue(manyFiles as any)
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any)

      const result = await godotTools.analyzeProject()

      expect(result.analysis.complexity).toBe('high')
      expect(result.analysis.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Tool Integration', () => {
    test('should provide consistent data structures across tools', async () => {
      // Mock scene analysis
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(`[gd_scene load_steps=2 format=2]
[node name="Root" type="Node2D"]`)

      const sceneResult = await godotTools.analyzeScene('/test/scene.tscn')
      const componentResult = await godotTools.generateComponent('test_component', [])

      // Check data structure consistency
      expect(sceneResult).toHaveProperty('scenePath')
      expect(componentResult).toHaveProperty('componentType')
      
      // Check that both return proper recommendation arrays
      expect(Array.isArray(sceneResult.recommendations)).toBe(true)
      expect(Array.isArray(componentResult.dependencies)).toBe(true)
    })

    test('should handle concurrent operations', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('extends Node')

      // Run multiple operations concurrently
      const promises = [
        godotTools.analyzeScene('/test1.tscn'),
        godotTools.optimizeGDScript('/test1.gd'),
        godotTools.generateComponent('test_comp', []),
        godotTools.analyzeScene('/test2.tscn'),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(4)
      results.forEach(result => expect(result).toBeDefined())
    })

    test('should maintain performance under load', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('extends Node')

      const startTime = performance.now()
      
      // Simulate multiple rapid operations
      const operations = Array.from({ length: 10 }, () => 
        godotTools.generateComponent('perf_test', [])
      )
      
      await Promise.all(operations)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (less than 1 second for 10 operations)
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Error Handling', () => {
    test('should handle filesystem errors gracefully', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Filesystem error')
      })

      await expect(godotTools.analyzeScene('/test/scene.tscn'))
        .rejects.toThrow('Filesystem error')
    })

    test('should handle malformed Godot scene files', async () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('invalid scene content')

      const result = await godotTools.analyzeScene('/test/malformed.tscn')

      expect(result.nodeCount).toBe(0)
      expect(result.complexity).toBe('unknown')
      expect(result.recommendations).toContain(
        expect.objectContaining({
          type: 'error',
          description: expect.stringContaining('Unable to parse')
        })
      )
    })

    test('should validate input parameters', async () => {
      await expect(godotTools.analyzeScene(''))
        .rejects.toThrow('Scene path is required')

      await expect(godotTools.optimizeGDScript('', 'invalid' as any))
        .rejects.toThrow()

      await expect(godotTools.generateComponent('', []))
        .rejects.toThrow('Component type is required')
    })
  })

  describe('Tool Configuration', () => {
    test('should support different Godot versions', async () => {
      const tools = new GodotMCPTools()
      
      // Should handle Godot 4.x format
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(`[gd_scene load_steps=2 format=3]
[node name="Root" type="Node3D"]`)

      const result = await tools.analyzeScene('/test/godot4.tscn')
      
      expect(result).toBeDefined()
      expect(result.godotVersion).toContain('4.')
    })

    test('should provide tool metadata', () => {
      const tools = new GodotMCPTools()
      
      expect(tools.getAvailableTools).toBeDefined()
      
      const availableTools = tools.getAvailableTools()
      expect(availableTools).toContainEqual(
        expect.objectContaining({
          name: 'analyzeScene',
          description: expect.stringContaining('Analyze Godot scene')
        })
      )
    })
  })
})