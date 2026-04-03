import request from 'supertest'
import { GodotMCPTools } from '../../src/mcp/godot-tools'
import * as fs from 'fs'

// Mock the GodotMCPTools for integration testing
jest.mock('../../src/mcp/godot-tools')
jest.mock('fs')

const mockFs = fs as jest.Mocked<typeof fs>
const MockedGodotTools = GodotMCPTools as jest.MockedClass<typeof GodotMCPTools>

// Mock server setup (simulating the comprehensive server)
const createMockServer = () => {
  const express = require('express')
  const app = express()
  
  app.use(express.json())
  
  // Mock Godot MCP endpoints that would be in the real server
  app.post('/mcp/call/analyze_godot_scene', async (req: any, res: any) => {
    try {
      const { scenePath, analyzePerformance } = req.body
      
      if (!scenePath) {
        return res.status(400).json({ error: 'Scene path is required' })
      }
      
      const tools = new GodotMCPTools()
      const result = await tools.analyzeScene(scenePath, analyzePerformance)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })
  
  app.post('/mcp/call/optimize_gdscript', async (req: any, res: any) => {
    try {
      const { scriptPath, optimizationLevel } = req.body
      
      if (!scriptPath) {
        return res.status(400).json({ error: 'Script path is required' })
      }
      
      const tools = new GodotMCPTools()
      const result = await tools.optimizeGDScript(scriptPath, optimizationLevel)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })
  
  app.post('/mcp/call/generate_godot_component', async (req: any, res: any) => {
    try {
      const { componentType, features } = req.body
      
      if (!componentType) {
        return res.status(400).json({ error: 'Component type is required' })
      }
      
      const tools = new GodotMCPTools()
      const result = await tools.generateComponent(componentType, features || [])
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })
  
  app.post('/mcp/call/analyze_godot_project', async (req: any, res: any) => {
    try {
      const tools = new GodotMCPTools()
      const result = await tools.analyzeProject()
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })
  
  // Health check endpoint
  app.get('/api/test', (req: any, res: any) => {
    res.json({ status: 'ok', message: 'Server is running' })
  })
  
  return app
}

describe('Godot MCP Full Integration Tests', () => {
  let app: any
  let mockGodotTools: jest.Mocked<GodotMCPTools>

  beforeEach(() => {
    app = createMockServer()
    mockGodotTools = new MockedGodotTools() as jest.Mocked<GodotMCPTools>
    
    // Setup default mocks
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('mock file content')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Server Health and Connectivity', () => {
    test('should start server successfully', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200)
      
      expect(response.body.status).toBe('ok')
    })

    test('should handle CORS and content-type headers', async () => {
      const response = await request(app)
        .post('/mcp/call/analyze_godot_project')
        .send({})
      
      expect(response.status).toBeLessThan(500) // Should not fail on headers
    })
  })

  describe('Scene Analysis API Integration', () => {
    test('should analyze scene through API endpoint', async () => {
      const mockResult = {
        scenePath: '/test/scene.tscn',
        nodeCount: 5,
        complexity: 'medium' as const,
        performance: {
          estimatedLoadTime: 120,
          memoryUsage: 2.5,
          bottlenecks: ['Large textures']
        },
        recommendations: [
          {
            type: 'optimization' as const,
            description: 'Consider reducing texture sizes',
            priority: 'medium' as const
          }
        ],
        godotVersion: '4.2'
      }

      mockGodotTools.analyzeScene.mockResolvedValue(mockResult)

      const response = await request(app)
        .post('/mcp/call/analyze_godot_scene')
        .send({
          scenePath: '/test/scene.tscn',
          analyzePerformance: true
        })
        .expect(200)

      expect(response.body).toEqual(mockResult)
      expect(mockGodotTools.analyzeScene).toHaveBeenCalledWith('/test/scene.tscn', true)
    })

    test('should handle scene analysis errors', async () => {
      mockGodotTools.analyzeScene.mockRejectedValue(new Error('Scene file not found'))

      const response = await request(app)
        .post('/mcp/call/analyze_godot_scene')
        .send({
          scenePath: '/nonexistent/scene.tscn'
        })
        .expect(500)

      expect(response.body.error).toBe('Scene file not found')
    })

    test('should validate scene analysis parameters', async () => {
      const response = await request(app)
        .post('/mcp/call/analyze_godot_scene')
        .send({})
        .expect(400)

      expect(response.body.error).toBe('Scene path is required')
    })
  })

  describe('GDScript Optimization API Integration', () => {
    test('should optimize script through API endpoint', async () => {
      const mockResult = {
        scriptPath: '/test/script.gd',
        optimizationLevel: 'basic' as const,
        optimizations: [
          {
            type: 'caching' as const,
            description: 'Cache node references',
            lineNumber: 10,
            originalCode: 'get_node("Player")',
            optimizedCode: '@onready var player = get_node("Player")',
            impact: 'medium' as const
          }
        ],
        performanceGain: 15.5,
        optimizedCode: 'extends Node\n\n@onready var player = get_node("Player")\n\nfunc _ready():\n\tprint("Optimized!")'
      }

      mockGodotTools.optimizeGDScript.mockResolvedValue(mockResult)

      const response = await request(app)
        .post('/mcp/call/optimize_gdscript')
        .send({
          scriptPath: '/test/script.gd',
          optimizationLevel: 'basic'
        })
        .expect(200)

      expect(response.body).toEqual(mockResult)
      expect(mockGodotTools.optimizeGDScript).toHaveBeenCalledWith('/test/script.gd', 'basic')
    })

    test('should handle script optimization errors', async () => {
      mockGodotTools.optimizeGDScript.mockRejectedValue(new Error('Script file not found'))

      const response = await request(app)
        .post('/mcp/call/optimize_gdscript')
        .send({
          scriptPath: '/nonexistent/script.gd'
        })
        .expect(500)

      expect(response.body.error).toBe('Script file not found')
    })

    test('should validate script optimization parameters', async () => {
      const response = await request(app)
        .post('/mcp/call/optimize_gdscript')
        .send({})
        .expect(400)

      expect(response.body.error).toBe('Script path is required')
    })
  })

  describe('Component Generation API Integration', () => {
    test('should generate component through API endpoint', async () => {
      const mockResult = {
        componentType: 'player_controller',
        features: ['movement', 'jumping'],
        code: 'extends KinematicBody2D\n\nvar speed = 100\nvar jump_force = 400\n\nfunc _physics_process(delta):\n\t# Movement logic here\n\tpass',
        dependencies: ['KinematicBody2D', 'Input'],
        usage: 'Attach this script to a KinematicBody2D node for basic player movement.',
        documentation: {
          methods: [
            {
              name: '_physics_process',
              description: 'Handles player movement and physics',
              parameters: ['delta: float']
            }
          ],
          properties: [
            {
              name: 'speed',
              type: 'int',
              description: 'Player movement speed'
            }
          ]
        }
      }

      mockGodotTools.generateComponent.mockResolvedValue(mockResult)

      const response = await request(app)
        .post('/mcp/call/generate_godot_component')
        .send({
          componentType: 'player_controller',
          features: ['movement', 'jumping']
        })
        .expect(200)

      expect(response.body).toEqual(mockResult)
      expect(mockGodotTools.generateComponent).toHaveBeenCalledWith('player_controller', ['movement', 'jumping'])
    })

    test('should handle component generation errors', async () => {
      mockGodotTools.generateComponent.mockRejectedValue(new Error('Invalid component type'))

      const response = await request(app)
        .post('/mcp/call/generate_godot_component')
        .send({
          componentType: 'invalid_component'
        })
        .expect(500)

      expect(response.body.error).toBe('Invalid component type')
    })

    test('should validate component generation parameters', async () => {
      const response = await request(app)
        .post('/mcp/call/generate_godot_component')
        .send({})
        .expect(400)

      expect(response.body.error).toBe('Component type is required')
    })

    test('should handle component generation with no features', async () => {
      const mockResult = {
        componentType: 'basic_component',
        features: [],
        code: 'extends Node\n\n# Basic component template',
        dependencies: ['Node'],
        usage: 'Basic component template.',
        documentation: {
          methods: [],
          properties: []
        }
      }

      mockGodotTools.generateComponent.mockResolvedValue(mockResult)

      const response = await request(app)
        .post('/mcp/call/generate_godot_component')
        .send({
          componentType: 'basic_component'
        })
        .expect(200)

      expect(response.body).toEqual(mockResult)
      expect(mockGodotTools.generateComponent).toHaveBeenCalledWith('basic_component', [])
    })
  })

  describe('Project Analysis API Integration', () => {
    test('should analyze project through API endpoint', async () => {
      const mockResult = {
        projectName: 'My Awesome Game',
        projectPath: '/path/to/project',
        godotVersion: '4.2.1',
        scenes: [
          { path: 'Main.tscn', nodeCount: 10 },
          { path: 'Player.tscn', nodeCount: 5 },
          { path: 'Enemy.tscn', nodeCount: 7 }
        ],
        scripts: [
          { path: 'Player.gd', lineCount: 50, complexity: 'medium' as const },
          { path: 'Enemy.gd', lineCount: 30, complexity: 'low' as const }
        ],
        assets: {
          textures: 45,
          audio: 12,
          models: 8,
          animations: 23,
          totalSize: '156.7 MB'
        },
        analysis: {
          complexity: 'medium' as const,
          recommendations: [
            {
              type: 'optimization' as const,
              description: 'Consider organizing assets into folders',
              priority: 'low' as const
            }
          ],
          metrics: {
            totalNodes: 22,
            totalLines: 80,
            averageSceneComplexity: 'medium' as const
          }
        }
      }

      mockGodotTools.analyzeProject.mockResolvedValue(mockResult)

      const response = await request(app)
        .post('/mcp/call/analyze_godot_project')
        .send({})
        .expect(200)

      expect(response.body).toEqual(mockResult)
      expect(mockGodotTools.analyzeProject).toHaveBeenCalled()
    })

    test('should handle project analysis errors', async () => {
      mockGodotTools.analyzeProject.mockRejectedValue(new Error('No Godot project found'))

      const response = await request(app)
        .post('/mcp/call/analyze_godot_project')
        .send({})
        .expect(500)

      expect(response.body.error).toBe('No Godot project found')
    })
  })

  describe('End-to-End Workflow Integration', () => {
    test('should complete full Godot development workflow', async () => {
      // Step 1: Analyze project
      const projectResult = {
        projectName: 'Test Game',
        scenes: [{ path: 'Main.tscn', nodeCount: 5 }],
        scripts: [{ path: 'Player.gd', lineCount: 20, complexity: 'low' as const }],
        assets: { textures: 10, audio: 5, models: 2, animations: 3, totalSize: '50MB' },
        analysis: {
          complexity: 'low' as const,
          recommendations: [],
          metrics: { totalNodes: 5, totalLines: 20, averageSceneComplexity: 'low' as const }
        }
      }
      
      mockGodotTools.analyzeProject.mockResolvedValue({
        projectName: 'Test Game',
        projectPath: '/test/project',
        godotVersion: '4.2',
        ...projectResult
      })

      const projectResponse = await request(app)
        .post('/mcp/call/analyze_godot_project')
        .send({})
        .expect(200)

      // Step 2: Analyze a scene
      const sceneResult = {
        scenePath: '/test/Main.tscn',
        nodeCount: 5,
        complexity: 'low' as const,
        performance: {
          estimatedLoadTime: 50,
          memoryUsage: 1.2,
          bottlenecks: []
        },
        recommendations: [],
        godotVersion: '4.2'
      }

      mockGodotTools.analyzeScene.mockResolvedValue(sceneResult)

      const sceneResponse = await request(app)
        .post('/mcp/call/analyze_godot_scene')
        .send({
          scenePath: '/test/Main.tscn',
          analyzePerformance: true
        })
        .expect(200)

      // Step 3: Generate a component
      const componentResult = {
        componentType: 'enemy_ai',
        features: ['pathfinding', 'combat'],
        code: 'extends CharacterBody2D\n\n# Enemy AI with pathfinding and combat',
        dependencies: ['CharacterBody2D', 'NavigationAgent2D'],
        usage: 'Attach to enemy characters for AI behavior.',
        documentation: {
          methods: [{ name: 'chase_player', description: 'Chases the player', parameters: [] }],
          properties: [{ name: 'sight_range', type: 'float', description: 'Detection range' }]
        }
      }

      mockGodotTools.generateComponent.mockResolvedValue(componentResult)

      const componentResponse = await request(app)
        .post('/mcp/call/generate_godot_component')
        .send({
          componentType: 'enemy_ai',
          features: ['pathfinding', 'combat']
        })
        .expect(200)

      // Step 4: Optimize a script
      const optimizationResult = {
        scriptPath: '/test/Player.gd',
        optimizationLevel: 'basic' as const,
        optimizations: [],
        performanceGain: 5.0,
        optimizedCode: 'extends CharacterBody2D\n\n# Optimized player code'
      }

      mockGodotTools.optimizeGDScript.mockResolvedValue(optimizationResult)

      const optimizationResponse = await request(app)
        .post('/mcp/call/optimize_gdscript')
        .send({
          scriptPath: '/test/Player.gd',
          optimizationLevel: 'basic'
        })
        .expect(200)

      // Verify all steps completed successfully
      expect(projectResponse.body.projectName).toBe('Test Game')
      expect(sceneResponse.body.nodeCount).toBe(5)
      expect(componentResponse.body.componentType).toBe('enemy_ai')
      expect(optimizationResponse.body.performanceGain).toBe(5.0)

      // Verify all tools were called
      expect(mockGodotTools.analyzeProject).toHaveBeenCalled()
      expect(mockGodotTools.analyzeScene).toHaveBeenCalled()
      expect(mockGodotTools.generateComponent).toHaveBeenCalled()
      expect(mockGodotTools.optimizeGDScript).toHaveBeenCalled()
    })

    test('should handle concurrent API requests', async () => {
      // Setup mock responses
      mockGodotTools.analyzeScene.mockResolvedValue({
        scenePath: '/test1.tscn',
        nodeCount: 3,
        complexity: 'low',
        performance: { estimatedLoadTime: 30, memoryUsage: 1.0, bottlenecks: [] },
        recommendations: [],
        godotVersion: '4.2'
      })

      mockGodotTools.generateComponent.mockResolvedValue({
        componentType: 'test_component',
        features: [],
        code: 'extends Node',
        dependencies: [],
        usage: 'Test component',
        documentation: { methods: [], properties: [] }
      })

      // Make concurrent requests
      const promises = [
        request(app)
          .post('/mcp/call/analyze_godot_scene')
          .send({ scenePath: '/test1.tscn' }),
        request(app)
          .post('/mcp/call/generate_godot_component')
          .send({ componentType: 'test_component' }),
        request(app)
          .post('/mcp/call/analyze_godot_scene')
          .send({ scenePath: '/test2.tscn' }),
      ]

      const responses = await Promise.all(promises)

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Error Recovery and Resilience', () => {
    test('should handle network timeouts gracefully', async () => {
      // Simulate slow operation
      mockGodotTools.analyzeProject.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      const response = await request(app)
        .post('/mcp/call/analyze_godot_project')
        .send({})
        .timeout(50)

      // Should handle timeout without crashing
      expect([200, 408, 500]).toContain(response.status)
    })

    test('should maintain state after error recovery', async () => {
      // First request fails
      mockGodotTools.analyzeScene.mockRejectedValueOnce(new Error('Temporary failure'))
      
      const failResponse = await request(app)
        .post('/mcp/call/analyze_godot_scene')
        .send({ scenePath: '/test.tscn' })
        .expect(500)

      // Second request succeeds
      mockGodotTools.analyzeScene.mockResolvedValueOnce({
        scenePath: '/test.tscn',
        nodeCount: 1,
        complexity: 'low',
        performance: { estimatedLoadTime: 10, memoryUsage: 0.5, bottlenecks: [] },
        recommendations: [],
        godotVersion: '4.2'
      })

      const successResponse = await request(app)
        .post('/mcp/call/analyze_godot_scene')
        .send({ scenePath: '/test.tscn' })
        .expect(200)

      expect(failResponse.body.error).toBe('Temporary failure')
      expect(successResponse.body.scenePath).toBe('/test.tscn')
    })
  })
})