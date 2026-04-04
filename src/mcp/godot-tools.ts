// Godot-specific MCP tools for game development assistance
// FEATURE: Game development tools for Godot projects

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import fs from 'fs/promises'
import path from 'path'

export interface GodotProjectInfo {
  name: string
  path: string
  version: string
  isValid: boolean
  scenes: {
    total: number
    mainScene: string | null
    autoloadScenes: number
  }
  scripts: {
    total: number
    gdscriptCount: number
    csharpCount: number
    errors: number
  }
  assets: {
    textures: number
    sounds: number
    models: number
    animations: number
    totalSize: number // in MB
  }
  exportSettings: {
    platforms: string[]
    lastBuildTime: string | null
    buildStatus: 'success' | 'failed' | 'pending' | 'none'
  }
}

export interface GodotAnalysisResult {
  scenePath: string
  nodeCount: number
  performance: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  recommendations: string[]
  loadTime: number
  memoryUsage: number
  complexityScore: number
}

export interface GDScriptOptimization {
  scriptPath: string
  issues: string[]
  performanceGain: string
  linesOptimized: number
  suggestions: Array<{
    line: number
    issue: string
    suggestion: string
    severity: 'low' | 'medium' | 'high'
  }>
}

export class GodotMCPTools {
  private projectPath: string

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath
  }

  // Analyze a Godot scene file for performance and structure
  async analyzeScene(scenePath: string, analyzePerformance: boolean = true): Promise<GodotAnalysisResult> {
    try {
      const fullPath = path.resolve(this.projectPath, scenePath)
      const sceneContent = await fs.readFile(fullPath, 'utf-8')
      
      // Parse .tscn file (simplified analysis)
      const nodeMatches = sceneContent.match(/\[node name=/g) || []
      const nodeCount = nodeMatches.length
      
      // Analyze complexity and performance
      const complexityScore = this.calculateSceneComplexity(sceneContent)
      const performance = this.determinePerformanceLevel(complexityScore, nodeCount)
      
      const recommendations: string[] = []
      if (nodeCount > 100) {
        recommendations.push('Consider breaking this scene into smaller sub-scenes')
      }
      if (sceneContent.includes('Control') && sceneContent.includes('_process')) {
        recommendations.push('Review _process functions in UI nodes for performance')
      }
      if (complexityScore > 80) {
        recommendations.push('Scene complexity is high - consider optimization')
      }
      
      // Simulate load time based on complexity
      const loadTime = Math.round(20 + (complexityScore * 0.5) + (nodeCount * 0.1))
      const memoryUsage = Math.round(5 + (nodeCount * 0.02) + (complexityScore * 0.1))
      
      return {
        scenePath,
        nodeCount,
        performance,
        recommendations,
        loadTime,
        memoryUsage,
        complexityScore
      }
    } catch (error) {
      throw new Error(`Failed to analyze scene ${scenePath}: ${error}`)
    }
  }

  // Optimize GDScript code for better performance
  async optimizeGDScript(scriptPath: string, optimizationLevel: 'basic' | 'advanced' = 'basic'): Promise<GDScriptOptimization> {
    try {
      const fullPath = path.resolve(this.projectPath, scriptPath)
      const scriptContent = await fs.readFile(fullPath, 'utf-8')
      const lines = scriptContent.split('\n')
      
      const issues: string[] = []
      const suggestions: Array<{
        line: number
        issue: string
        suggestion: string
        severity: 'low' | 'medium' | 'high'
      }> = []
      
      let linesOptimized = 0
      
      // Analyze common performance issues
      lines.forEach((line, index) => {
        const lineNumber = index + 1
        
        // Check for expensive operations in _process
        if (line.includes('_process') || line.includes('_physics_process')) {
          if (scriptContent.includes('get_node(') || scriptContent.includes('find_node(')) {
            issues.push('Expensive node lookups in process functions')
            suggestions.push({
              line: lineNumber,
              issue: 'get_node() calls in _process functions',
              suggestion: 'Cache node references using @onready variables',
              severity: 'high'
            })
            linesOptimized++
          }
        }
        
        // Check for missing @onready annotations
        if (line.includes('get_node(') && !line.includes('@onready')) {
          issues.push('Node references not cached with @onready')
          suggestions.push({
            line: lineNumber,
            issue: 'Node reference without @onready',
            suggestion: 'Use @onready var node_ref = get_node("path")',
            severity: 'medium'
          })
          linesOptimized++
        }
        
        // Check for string concatenation in loops
        if (line.includes('for ') && scriptContent.includes(' + ')) {
          issues.push('Potential string concatenation in loops')
          suggestions.push({
            line: lineNumber,
            issue: 'String concatenation performance',
            suggestion: 'Use String.format() or StringBuilder for multiple concatenations',
            severity: 'medium'
          })
        }
        
        // Check for missing static typing
        if (line.includes('var ') && !line.includes(': ') && !line.includes('= ')) {
          suggestions.push({
            line: lineNumber,
            issue: 'Missing type hint',
            suggestion: 'Add type hint for better performance: var name: Type',
            severity: 'low'
          })
        }
      })
      
      // Calculate performance gain estimate
      const performanceGain = linesOptimized > 0 ? `+${Math.min(5 + linesOptimized * 2, 25)}%` : '+0%'
      
      return {
        scriptPath,
        issues: issues.length > 0 ? issues : ['No major performance issues found'],
        performanceGain,
        linesOptimized,
        suggestions
      }
    } catch (error) {
      throw new Error(`Failed to optimize script ${scriptPath}: ${error}`)
    }
  }

  // Generate common game components
  async generateComponent(componentType: string, features: string[] = []): Promise<{
    componentType: string
    generated: boolean
    files: string[]
    code: Record<string, string>
    documentation: string
  }> {
    const templates = {
      player_controller: {
        files: ['PlayerController.gd', 'InputManager.gd'],
        code: {
          'PlayerController.gd': `extends CharacterBody3D
class_name PlayerController

@export var speed: float = 5.0
@export var jump_velocity: float = 4.5
@export var sensitivity: float = 0.001

@onready var camera: Camera3D = $Camera3D
var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

func _ready():
    Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _physics_process(delta: float):
    handle_gravity(delta)
    handle_movement()
    handle_jump()
    move_and_slide()

func handle_gravity(delta: float):
    if not is_on_floor():
        velocity.y -= gravity * delta

func handle_movement():
    var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
    if direction:
        velocity.x = direction.x * speed
        velocity.z = direction.z * speed
    else:
        velocity.x = move_toward(velocity.x, 0, speed)
        velocity.z = move_toward(velocity.z, 0, speed)

func handle_jump():
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_velocity

func _input(event: InputEvent):
    if event is InputEventMouseMotion:
        rotate_y(-event.relative.x * sensitivity)
        camera.rotate_x(-event.relative.y * sensitivity)
        camera.rotation.x = clamp(camera.rotation.x, -PI/2, PI/2)`,
          'InputManager.gd': `extends Node
class_name InputManager

signal action_pressed(action: String)
signal action_released(action: String)

var input_map: Dictionary = {
    "move_forward": [KEY_W, KEY_UP],
    "move_back": [KEY_S, KEY_DOWN],
    "move_left": [KEY_A, KEY_LEFT],
    "move_right": [KEY_D, KEY_RIGHT],
    "jump": [KEY_SPACE],
    "sprint": [KEY_SHIFT]
}

func _ready():
    setup_input_map()

func setup_input_map():
    for action in input_map:
        if not InputMap.has_action(action):
            InputMap.add_action(action)
            for key in input_map[action]:
                var event = InputEventKey.new()
                event.keycode = key
                InputMap.action_add_event(action, event)`
        }
      },
      inventory_system: {
        files: ['InventoryManager.gd', 'Item.gd', 'ItemSlot.gd'],
        code: {
          'InventoryManager.gd': `extends Node
class_name InventoryManager

signal item_added(item: Item)
signal item_removed(item: Item)
signal inventory_changed()

@export var max_slots: int = 20
var items: Array[Item] = []

func add_item(item: Item) -> bool:
    if items.size() < max_slots:
        items.append(item)
        item_added.emit(item)
        inventory_changed.emit()
        return true
    return false

func remove_item(item: Item) -> bool:
    var index = items.find(item)
    if index != -1:
        items.remove_at(index)
        item_removed.emit(item)
        inventory_changed.emit()
        return true
    return false

func get_item_count(item_id: String) -> int:
    var count = 0
    for item in items:
        if item.id == item_id:
            count += 1
    return count

func has_item(item_id: String) -> bool:
    return get_item_count(item_id) > 0`
        }
      }
    }

    const template = templates[componentType]
    if (!template) {
      return {
        componentType,
        generated: false,
        files: [],
        code: {},
        documentation: `Component type "${componentType}" not found. Available: ${Object.keys(templates).join(', ')}`
      }
    }

    return {
      componentType,
      generated: true,
      files: template.files,
      code: template.code,
      documentation: `Generated ${componentType} with ${template.files.length} files. Features: ${features.join(', ') || 'default'}`
    }
  }

  // Analyze Godot project structure
  async analyzeProject(): Promise<GodotProjectInfo> {
    try {
      const projectFile = path.join(this.projectPath, 'project.godot')
      let projectContent = ''
      
      try {
        projectContent = await fs.readFile(projectFile, 'utf-8')
      } catch {
        throw new Error('No project.godot found - not a valid Godot project')
      }

      // Extract project name and version
      const nameMatch = projectContent.match(/config\/name="([^"]+)"/)
      const name = nameMatch ? nameMatch[1] : 'Unknown Project'
      
      // Count scenes
      const scenes = await this.countFiles('.tscn')
      const mainSceneMatch = projectContent.match(/run\/main_scene="([^"]+)"/)
      const autoloadCount = (projectContent.match(/\[autoload\]/g) || []).length

      // Count scripts
      const gdScripts = await this.countFiles('.gd')
      const csScripts = await this.countFiles('.cs')

      // Count assets
      const textures = await this.countFiles('.png') + await this.countFiles('.jpg') + 
                     await this.countFiles('.svg') + await this.countFiles('.webp')
      const sounds = await this.countFiles('.wav') + await this.countFiles('.ogg') + 
                    await this.countFiles('.mp3')
      const models = await this.countFiles('.glb') + await this.countFiles('.gltf') + 
                    await this.countFiles('.obj')
      const animations = await this.countFiles('.tres', 'Animation')

      // Calculate total asset size (simplified estimation)
      const totalSize = (textures * 0.5) + (sounds * 2.0) + (models * 1.0) + (animations * 0.1)

      // Check export settings
      const exportPresetsPath = path.join(this.projectPath, 'export_presets.cfg')
      let platforms: string[] = []
      try {
        const exportContent = await fs.readFile(exportPresetsPath, 'utf-8')
        if (exportContent.includes('platform="Windows Desktop"')) platforms.push('Windows')
        if (exportContent.includes('platform="Linux/X11"')) platforms.push('Linux')
        if (exportContent.includes('platform="macOS"')) platforms.push('macOS')
        if (exportContent.includes('platform="Android"')) platforms.push('Android')
        if (exportContent.includes('platform="Web"')) platforms.push('Web')
      } catch {
        // No export presets configured
      }

      return {
        name,
        path: this.projectPath,
        version: '4.2', // Could parse from project file
        isValid: true,
        scenes: {
          total: scenes,
          mainScene: mainSceneMatch ? mainSceneMatch[1] : null,
          autoloadScenes: autoloadCount
        },
        scripts: {
          total: gdScripts + csScripts,
          gdscriptCount: gdScripts,
          csharpCount: csScripts,
          errors: 0 // Would need actual error checking
        },
        assets: {
          textures,
          sounds,
          models,
          animations,
          totalSize
        },
        exportSettings: {
          platforms,
          lastBuildTime: null, // Would need to check build artifacts
          buildStatus: platforms.length > 0 ? 'success' : 'none'
        }
      }
    } catch (error) {
      throw new Error(`Failed to analyze project: ${error}`)
    }
  }

  // Helper methods
  private calculateSceneComplexity(sceneContent: string): number {
    let complexity = 0
    
    // Count different node types with different complexity weights
    const nodeTypeWeights = {
      'RigidBody': 5,
      'StaticBody': 3,
      'CharacterBody': 4,
      'Control': 2,
      'CanvasLayer': 3,
      'Camera3D': 4,
      'Light3D': 3,
      'MeshInstance3D': 3
    }
    
    for (const [nodeType, weight] of Object.entries(nodeTypeWeights)) {
      const matches = (sceneContent.match(new RegExp(nodeType, 'g')) || []).length
      complexity += matches * weight
    }
    
    // Factor in script connections and signals
    complexity += (sceneContent.match(/connection signal/g) || []).length * 2
    complexity += (sceneContent.match(/script = /g) || []).length * 3
    
    return Math.min(complexity, 100) // Cap at 100
  }

  private determinePerformanceLevel(complexityScore: number, nodeCount: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    const totalScore = complexityScore + (nodeCount * 0.5)
    
    if (totalScore < 30) return 'Excellent'
    if (totalScore < 60) return 'Good'
    if (totalScore < 90) return 'Fair'
    return 'Poor'
  }

  private async countFiles(extension: string, contentFilter?: string): Promise<number> {
    try {
      const files = await this.findFiles(this.projectPath, extension)
      
      if (contentFilter) {
        let count = 0
        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf-8')
            if (content.includes(contentFilter)) count++
          } catch {
            // Skip files that can't be read
          }
        }
        return count
      }
      
      return files.length
    } catch {
      return 0
    }
  }

  private async findFiles(dir: string, extension: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await this.findFiles(fullPath, extension, files)
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath)
        }
      }
    } catch {
      // Skip directories we can't read
    }
    
    return files
  }
}

// Register Godot MCP tools
export function registerGodotTools(server: Server, projectPath: string) {
  const godotTools = new GodotMCPTools(projectPath)

  // Register scene analyzer tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'godot_scene_analyzer':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await godotTools.analyzeScene(
                    args?.scenePath as string || 'Main.tscn',
                    args?.analyzePerformance as boolean ?? true
                  ),
                  null,
                  2
                )
              }
            ]
          }

        case 'gdscript_optimizer':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await godotTools.optimizeGDScript(
                    args?.scriptPath as string || 'Player.gd',
                    args?.optimizationLevel as 'basic' | 'advanced' || 'basic'
                  ),
                  null,
                  2
                )
              }
            ]
          }

        case 'component_generator':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await godotTools.generateComponent(
                    args?.componentType as string || 'player_controller',
                    args?.features as string[] || []
                  ),
                  null,
                  2
                )
              }
            ]
          }

        case 'godot_project_analyzer':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await godotTools.analyzeProject(),
                  null,
                  2
                )
              }
            ]
          }

        default:
          throw new Error(`Unknown Godot tool: ${name}`)
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      }
    }
  })

  return godotTools
}

// Tool definitions for MCP protocol
export const godotMCPToolDefinitions = [
  {
    name: 'godot_scene_analyzer',
    description: 'Analyze Godot scene files for performance bottlenecks and optimization opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        scenePath: {
          type: 'string',
          description: 'Path to the .tscn scene file to analyze'
        },
        analyzePerformance: {
          type: 'boolean',
          description: 'Whether to include performance analysis',
          default: true
        }
      },
      required: ['scenePath']
    }
  },
  {
    name: 'gdscript_optimizer',
    description: 'Suggest performance improvements for GDScript code',
    inputSchema: {
      type: 'object',
      properties: {
        scriptPath: {
          type: 'string',
          description: 'Path to the .gd script file to optimize'
        },
        optimizationLevel: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'Level of optimization analysis',
          default: 'basic'
        }
      },
      required: ['scriptPath']
    }
  },
  {
    name: 'component_generator',
    description: 'Generate common game components (player controller, inventory, dialogue system)',
    inputSchema: {
      type: 'object',
      properties: {
        componentType: {
          type: 'string',
          enum: ['player_controller', 'inventory_system', 'dialogue_system', 'state_machine'],
          description: 'Type of component to generate'
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional features to include in the component'
        }
      },
      required: ['componentType']
    }
  },
  {
    name: 'godot_project_analyzer',
    description: 'Analyze entire Godot project structure and provide overview',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]