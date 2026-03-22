import { jest } from '@jest/globals'
import type {
  // Core types
  LLMProvider,
  LocalProvider,
  CostMetrics,
  OptimizationResult,
  CacheEntry,
  CommandPattern,
  
  // Workflow types
  WorkflowDefinition,
  WorkflowNode,
  WorkflowConnection,
  ExecutionContext,
  LLMTask,
  LLMTaskResult,
  
  // Agent types
  AgentConfig,
  AgentSession,
  AgentSpawnRequest,
  SecurityPolicy,
  
  // Network types
  NetworkNode,
  TaskRequest,
  NodeCapabilities,
  LoadBalanceStrategy,
  
  // Intelligence types
  ImageAnalysisRequest,
  DiagramGenerationRequest,
  ScreenshotAnalysisRequest,
  VisionCapabilities,
  
  // Dashboard types
  DashboardConfig,
  MetricsSnapshot,
  Alert,
  DashboardWidget
} from '../../src/types.js'

describe('Types Validation', () => {
  describe('Core Types', () => {
    test('LLMProvider should have required properties', () => {
      const provider: LLMProvider = {
        name: 'test-provider',
        type: 'cloud',
        endpoint: 'https://api.test.com',
        apiKey: 'test-key',
        models: ['test-model'],
        costPerToken: 0.001,
        maxTokens: 4096,
        timeout: 30000
      }

      expect(provider.name).toBe('test-provider')
      expect(provider.type).toBe('cloud')
      expect(provider.models).toContain('test-model')
      expect(provider.costPerToken).toBeGreaterThan(0)
    })

    test('LocalProvider should extend LLMProvider with local-specific fields', () => {
      const localProvider: LocalProvider = {
        name: 'ollama-provider',
        type: 'local',
        endpoint: 'http://localhost:11434',
        models: ['llama2', 'codellama'],
        costPerToken: 0,
        maxTokens: 4096,
        timeout: 60000,
        hostname: 'localhost',
        port: 11434,
        supportedFormats: ['chat', 'completion'],
        modelPath: '/models'
      }

      expect(localProvider.type).toBe('local')
      expect(localProvider.hostname).toBe('localhost')
      expect(localProvider.port).toBe(11434)
      expect(localProvider.supportedFormats).toContain('chat')
    })

    test('CostMetrics should track financial data correctly', () => {
      const costMetrics: CostMetrics = {
        totalCost: 15.75,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        breakdown: [
          {
            provider: 'openai',
            model: 'gpt-4',
            cost: 10.50,
            calls: 100,
            tokens: 50000
          },
          {
            provider: 'anthropic',
            model: 'claude-3',
            cost: 5.25,
            calls: 50,
            tokens: 25000
          }
        ],
        predictions: {
          nextHour: 0.50,
          nextDay: 12.00,
          nextWeek: 84.00
        },
        trends: {
          hourlyChange: 0.05,
          dailyChange: 2.50,
          direction: 'increasing'
        },
        optimizations: [
          {
            type: 'model-substitution',
            description: 'Use local model for simple tasks',
            potentialSaving: 3.00
          }
        ]
      }

      expect(costMetrics.totalCost).toBe(15.75)
      expect(costMetrics.breakdown).toHaveLength(2)
      expect(costMetrics.predictions.nextDay).toBe(12.00)
      expect(costMetrics.trends.direction).toBe('increasing')
    })

    test('CommandPattern should define command matching rules', () => {
      const gitCommitPattern: CommandPattern = {
        id: 'git-commit',
        name: 'Git Commit',
        pattern: /^git\s+commit/,
        category: 'git',
        description: 'Git commit operations',
        handler: 'git-handler',
        priority: 100,
        estimatedCost: 0.01,
        examples: [
          'git commit -m "message"',
          'git commit -am "message"',
          'git commit --amend'
        ],
        parameters: {
          message: { required: false, type: 'string' },
          all: { required: false, type: 'boolean' },
          amend: { required: false, type: 'boolean' }
        }
      }

      expect(gitCommitPattern.pattern.test('git commit -m "test"')).toBe(true)
      expect(gitCommitPattern.category).toBe('git')
      expect(gitCommitPattern.examples).toContain('git commit -m "message"')
      expect(gitCommitPattern.parameters.message?.type).toBe('string')
    })
  })

  describe('Workflow Types', () => {
    test('WorkflowDefinition should define complete workflow structure', () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test LLM Workflow',
        description: 'A test workflow for LLM operations',
        version: '1.0.0',
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            name: 'Start Node',
            position: { x: 100, y: 100 },
            parameters: {},
            connections: {
              main: [[{ node: 'llm-task', type: 'main', index: 0 }]]
            }
          },
          {
            id: 'llm-task',
            type: 'llm-completion',
            name: 'LLM Task',
            position: { x: 300, y: 100 },
            parameters: {
              provider: 'openai',
              model: 'gpt-3.5-turbo',
              prompt: 'Hello world',
              temperature: 0.7
            },
            connections: {
              main: [[{ node: 'end', type: 'main', index: 0 }]]
            }
          },
          {
            id: 'end',
            type: 'end',
            name: 'End Node',
            position: { x: 500, y: 100 },
            parameters: {},
            connections: {}
          }
        ],
        connections: {
          start: {
            main: [[{ node: 'llm-task', type: 'main', index: 0 }]]
          },
          'llm-task': {
            main: [[{ node: 'end', type: 'main', index: 0 }]]
          }
        },
        settings: {
          executionOrder: 'v1',
          saveManualExecutions: true,
          callerPolicy: 'workflowsFromSameOwner',
          errorWorkflow: undefined
        },
        tags: ['llm', 'test'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(workflow.nodes).toHaveLength(3)
      expect(workflow.nodes[1].type).toBe('llm-completion')
      expect(workflow.connections.start?.main?.[0]?.[0]?.node).toBe('llm-task')
      expect(workflow.settings.executionOrder).toBe('v1')
    })

    test('LLMTask should define LLM-specific operations', () => {
      const llmTask: LLMTask = {
        id: 'task-001',
        type: 'completion',
        provider: 'anthropic',
        model: 'claude-3-haiku',
        prompt: 'Explain quantum computing',
        parameters: {
          temperature: 0.3,
          maxTokens: 1000,
          topP: 0.9,
          systemPrompt: 'You are a helpful physics tutor'
        },
        context: {
          conversationId: 'conv-123',
          userId: 'user-456',
          sessionData: {
            previousQuestions: ['What is AI?', 'How does machine learning work?']
          }
        },
        priority: 'normal',
        timeout: 30000,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        },
        costBudget: {
          maxCost: 0.50,
          alertThreshold: 0.40
        }
      }

      expect(llmTask.type).toBe('completion')
      expect(llmTask.model).toBe('claude-3-haiku')
      expect(llmTask.parameters.temperature).toBe(0.3)
      expect(llmTask.retryConfig?.maxRetries).toBe(3)
      expect(llmTask.costBudget?.maxCost).toBe(0.50)
    })
  })

  describe('Agent Types', () => {
    test('AgentSpawnRequest should define agent creation parameters', () => {
      const spawnRequest: AgentSpawnRequest = {
        name: 'code-review-agent',
        type: 'code-reviewer',
        capabilities: ['static-analysis', 'security-scan', 'style-check'],
        resources: {
          maxMemory: '1GB',
          maxCpuTime: 120000,
          allowedPaths: ['/workspace/src', '/workspace/tests'],
          maxFileSize: '10MB'
        },
        securityPolicy: {
          allowedOperations: ['read', 'analyze'],
          blockedOperations: ['write', 'execute', 'network'],
          allowedPaths: ['/workspace'],
          blockedPaths: ['/system', '/etc'],
          networkAccess: false,
          maxMemory: '1GB',
          maxCpuTime: 120000,
          sandboxed: true
        },
        environment: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info'
        },
        timeout: 300000,
        priority: 'high'
      }

      expect(spawnRequest.capabilities).toContain('static-analysis')
      expect(spawnRequest.securityPolicy?.networkAccess).toBe(false)
      expect(spawnRequest.resources.maxMemory).toBe('1GB')
      expect(spawnRequest.priority).toBe('high')
    })

    test('SecurityPolicy should enforce access controls', () => {
      const policy: SecurityPolicy = {
        allowedOperations: ['read', 'list', 'analyze'],
        blockedOperations: ['write', 'delete', 'execute'],
        allowedPaths: ['/safe/workspace'],
        blockedPaths: ['/system', '/root', '/etc'],
        networkAccess: false,
        allowedDomains: [],
        blockedDomains: ['*'],
        maxMemory: '512MB',
        maxCpuTime: 60000,
        maxFileSize: '5MB',
        sandboxed: true,
        isolatedEnvironment: true,
        allowedEnvironmentVars: ['NODE_ENV', 'LOG_LEVEL'],
        timeRestrictions: {
          startTime: '09:00',
          endTime: '17:00',
          allowedDays: [1, 2, 3, 4, 5] // Monday-Friday
        }
      }

      expect(policy.allowedOperations).not.toContain('execute')
      expect(policy.blockedOperations).toContain('delete')
      expect(policy.networkAccess).toBe(false)
      expect(policy.sandboxed).toBe(true)
      expect(policy.timeRestrictions?.allowedDays).toHaveLength(5)
    })
  })

  describe('Network Types', () => {
    test('NetworkNode should define distributed network participants', () => {
      const node: NetworkNode = {
        id: 'node-gpu-001',
        address: '192.168.1.100',
        port: 8080,
        hostname: 'gpu-server-1',
        capabilities: {
          models: ['llama2-70b', 'codellama-34b', 'mistral-7b'],
          maxConcurrency: 8,
          totalMemory: 65536, // 64GB
          availableMemory: 32768, // 32GB available
          cpuCores: 16,
          gpuMemory: 49152, // 48GB GPU memory
          gpuCores: 10752, // A100 cores
          supportedFormats: ['chat', 'completion', 'embedding'],
          specializations: ['code-generation', 'reasoning', 'math']
        },
        status: 'active',
        load: 0.45,
        reputation: 0.98,
        lastSeen: new Date(),
        region: 'us-west-2',
        costProfile: {
          baseCost: 0.02,
          costPerToken: 0.00008,
          costPerSecond: 0.001,
          costPerGPUMinute: 0.05
        },
        metadata: {
          version: '1.2.3',
          uptime: 864000000, // 10 days
          totalTasks: 15420,
          successRate: 0.992
        }
      }

      expect(node.capabilities.models).toContain('llama2-70b')
      expect(node.capabilities.gpuMemory).toBeGreaterThan(40000)
      expect(node.reputation).toBeGreaterThan(0.9)
      expect(node.costProfile?.costPerGPUMinute).toBe(0.05)
    })

    test('TaskRequest should define distributed task parameters', () => {
      const taskRequest: TaskRequest = {
        id: 'task-distributed-001',
        type: 'completion',
        model: 'llama2-70b',
        prompt: 'Write a complex algorithm for graph traversal',
        parameters: {
          temperature: 0.2,
          maxTokens: 2048,
          topP: 0.95,
          stopSequences: ['```', '\n\n---']
        },
        requirements: {
          minMemory: '16GB',
          preferGPU: true,
          minGPUMemory: '24GB',
          maxLatency: 5000,
          specialization: 'code-generation'
        },
        priority: 'high',
        timeout: 60000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 2000,
          backoffMultiplier: 1.5
        },
        costConstraints: {
          maxCost: 1.00,
          preferLowerCost: true,
          costWeight: 0.3
        },
        optimizeFor: 'quality',
        metadata: {
          userId: 'user-123',
          projectId: 'proj-456',
          clientVersion: '2.1.0'
        }
      }

      expect(taskRequest.requirements?.preferGPU).toBe(true)
      expect(taskRequest.costConstraints?.maxCost).toBe(1.00)
      expect(taskRequest.optimizeFor).toBe('quality')
      expect(taskRequest.parameters.topP).toBe(0.95)
    })
  })

  describe('Intelligence Types', () => {
    test('ImageAnalysisRequest should define image processing parameters', () => {
      const analysisRequest: ImageAnalysisRequest = {
        imagePath: '/uploads/diagram.png',
        imageData: undefined, // Using file path instead
        analysisType: 'technical',
        extractText: true,
        detectObjects: true,
        generateDescription: true,
        confidenceThreshold: 0.8,
        customPrompt: 'Analyze this system architecture diagram',
        preprocessing: {
          resize: { width: 1024, height: 768 },
          enhance: true,
          denoise: false,
          sharpen: 0.2,
          normalize: true
        },
        filters: ['contrast', 'brightness'],
        filterStrength: 0.3,
        ocrEngine: 'tesseract',
        objectDetectionModel: 'yolo-v8',
        useCache: true,
        priority: 'normal',
        timeout: 30000
      }

      expect(analysisRequest.analysisType).toBe('technical')
      expect(analysisRequest.preprocessing?.resize?.width).toBe(1024)
      expect(analysisRequest.filters).toContain('contrast')
      expect(analysisRequest.ocrEngine).toBe('tesseract')
    })

    test('DiagramGenerationRequest should define diagram creation parameters', () => {
      const diagramRequest: DiagramGenerationRequest = {
        type: 'flowchart',
        title: 'User Authentication Flow',
        description: 'Complete user authentication process',
        elements: [
          {
            id: 'login',
            type: 'start',
            label: 'User Login',
            position: { x: 100, y: 50 },
            style: { backgroundColor: '#e1f5fe', borderColor: '#01579b' }
          },
          {
            id: 'validate',
            type: 'process',
            label: 'Validate Credentials',
            position: { x: 100, y: 150 },
            properties: ['username: string', 'password: string'],
            methods: ['validate()', 'hash()', 'compare()']
          },
          {
            id: 'decision',
            type: 'decision',
            label: 'Valid?',
            position: { x: 100, y: 250 },
            conditions: ['credentials.valid === true', 'user.active === true']
          }
        ],
        connections: [
          { from: 'login', to: 'validate', label: 'submit', type: 'data-flow' },
          { from: 'validate', to: 'decision', type: 'sequence' },
          { from: 'decision', to: 'success', label: 'Yes', condition: 'valid' },
          { from: 'decision', to: 'error', label: 'No', condition: 'invalid' }
        ],
        style: {
          backgroundColor: '#ffffff',
          primaryColor: '#1976d2',
          secondaryColor: '#42a5f5',
          fontSize: 12,
          fontFamily: 'Arial',
          theme: 'material'
        },
        outputFormat: 'png',
        outputPath: '/diagrams/auth-flow.png',
        resolution: { width: 800, height: 600, dpi: 150 }
      }

      expect(diagramRequest.elements).toHaveLength(3)
      expect(diagramRequest.connections[0].from).toBe('login')
      expect(diagramRequest.style?.theme).toBe('material')
      expect(diagramRequest.resolution?.dpi).toBe(150)
    })
  })

  describe('Dashboard Types', () => {
    test('DashboardConfig should define dashboard settings', () => {
      const config: DashboardConfig = {
        port: 3000,
        wsPort: 3001,
        host: '0.0.0.0',
        updateInterval: 5000,
        retentionPeriod: 604800000, // 7 days
        enableAlerts: true,
        enableExports: true,
        enableAuthentication: true,
        maxConnections: 100,
        compressionEnabled: true,
        corsEnabled: true,
        allowedOrigins: ['http://localhost:3000', 'https://dashboard.example.com'],
        rateLimiting: {
          enabled: true,
          maxRequests: 1000,
          windowMs: 900000 // 15 minutes
        },
        security: {
          apiKeyRequired: true,
          jwtSecret: 'dashboard-secret-key',
          tokenExpiry: 86400000, // 24 hours
          encryptionEnabled: true
        }
      }

      expect(config.port).toBe(3000)
      expect(config.retentionPeriod).toBe(604800000)
      expect(config.rateLimiting?.maxRequests).toBe(1000)
      expect(config.security?.jwtSecret).toBe('dashboard-secret-key')
    })

    test('Alert should define monitoring conditions', () => {
      const alert: Alert = {
        id: 'alert-high-cost',
        name: 'High Hourly Cost',
        description: 'Triggers when hourly cost exceeds $5',
        condition: {
          metric: 'hourly-cost',
          operator: 'greater-than',
          threshold: 5.0,
          timeWindow: 3600000, // 1 hour
          aggregation: 'sum',
          groupBy: ['provider', 'model']
        },
        severity: 'warning',
        enabled: true,
        acknowledged: false,
        timestamp: new Date(),
        notificationChannels: ['email', 'slack', 'webhook'],
        escalation: {
          enabled: true,
          levels: [
            { severity: 'critical', threshold: 10.0, delay: 300000 }, // 5 min
            { severity: 'emergency', threshold: 20.0, delay: 600000 }  // 10 min
          ]
        },
        metadata: {
          createdBy: 'admin',
          tags: ['cost', 'monitoring'],
          priority: 'high'
        }
      }

      expect(alert.condition.threshold).toBe(5.0)
      expect(alert.notificationChannels).toContain('slack')
      expect(alert.escalation?.levels).toHaveLength(2)
      expect(alert.metadata?.tags).toContain('cost')
    })

    test('DashboardWidget should define UI components', () => {
      const widget: DashboardWidget = {
        id: 'cost-trend-chart',
        type: 'line-chart',
        title: 'Cost Trend Over Time',
        description: 'Shows cost trends for the last 24 hours',
        position: { x: 0, y: 0, width: 8, height: 6 },
        config: {
          metric: 'cost',
          timeframe: '24h',
          refreshInterval: 30000,
          aggregation: 'sum',
          groupBy: 'hour',
          chartType: 'line',
          showLegend: true,
          showDataLabels: false,
          colors: ['#1976d2', '#388e3c', '#f57c00'],
          yAxis: {
            title: 'Cost ($)',
            min: 0,
            logarithmic: false
          },
          xAxis: {
            title: 'Time',
            format: 'HH:mm'
          },
          thresholds: [
            { value: 5.0, color: '#ff9800', label: 'Warning' },
            { value: 10.0, color: '#f44336', label: 'Critical' }
          ]
        },
        permissions: {
          view: ['admin', 'viewer'],
          edit: ['admin'],
          delete: ['admin']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(widget.type).toBe('line-chart')
      expect(widget.position.width).toBe(8)
      expect(widget.config.colors).toHaveLength(3)
      expect(widget.config.thresholds).toHaveLength(2)
      expect(widget.permissions?.view).toContain('viewer')
    })
  })

  describe('Type Guards and Validation', () => {
    test('should validate provider types', () => {
      const isValidProviderType = (type: string): type is 'local' | 'cloud' | 'hybrid' => {
        return ['local', 'cloud', 'hybrid'].includes(type)
      }

      expect(isValidProviderType('local')).toBe(true)
      expect(isValidProviderType('cloud')).toBe(true)
      expect(isValidProviderType('hybrid')).toBe(true)
      expect(isValidProviderType('invalid')).toBe(false)
    })

    test('should validate task priorities', () => {
      const isValidPriority = (priority: string): priority is 'low' | 'normal' | 'high' | 'urgent' => {
        return ['low', 'normal', 'high', 'urgent'].includes(priority)
      }

      expect(isValidPriority('low')).toBe(true)
      expect(isValidPriority('normal')).toBe(true)
      expect(isValidPriority('high')).toBe(true)
      expect(isValidPriority('urgent')).toBe(true)
      expect(isValidPriority('invalid')).toBe(false)
    })

    test('should validate alert severities', () => {
      const isValidSeverity = (severity: string): severity is 'info' | 'warning' | 'critical' | 'emergency' => {
        return ['info', 'warning', 'critical', 'emergency'].includes(severity)
      }

      expect(isValidSeverity('info')).toBe(true)
      expect(isValidSeverity('warning')).toBe(true)
      expect(isValidSeverity('critical')).toBe(true)
      expect(isValidSeverity('emergency')).toBe(true)
      expect(isValidSeverity('invalid')).toBe(false)
    })

    test('should validate memory sizes', () => {
      const isValidMemorySize = (size: string): boolean => {
        const memoryRegex = /^\d+(\.\d+)?(KB|MB|GB|TB)$/i
        return memoryRegex.test(size)
      }

      expect(isValidMemorySize('512MB')).toBe(true)
      expect(isValidMemorySize('1GB')).toBe(true)
      expect(isValidMemorySize('2.5GB')).toBe(true)
      expect(isValidMemorySize('invalid')).toBe(false)
      expect(isValidMemorySize('512')).toBe(false)
    })

    test('should validate cost values', () => {
      const isValidCost = (cost: number): boolean => {
        return typeof cost === 'number' && cost >= 0 && isFinite(cost)
      }

      expect(isValidCost(0)).toBe(true)
      expect(isValidCost(1.50)).toBe(true)
      expect(isValidCost(100)).toBe(true)
      expect(isValidCost(-1)).toBe(false)
      expect(isValidCost(Infinity)).toBe(false)
      expect(isValidCost(NaN)).toBe(false)
    })
  })

  describe('Type Compatibility', () => {
    test('should ensure workflow connections are type-safe', () => {
      const connection: WorkflowConnection = {
        node: 'target-node',
        type: 'main',
        index: 0
      }

      // Should be assignable to array element
      const connections: WorkflowConnection[] = [connection]
      expect(connections[0].node).toBe('target-node')
    })

    test('should ensure agent resources are compatible', () => {
      const resources: AgentSpawnRequest['resources'] = {
        maxMemory: '1GB',
        maxCpuTime: 30000,
        allowedPaths: ['/workspace']
      }

      const agentRequest: AgentSpawnRequest = {
        name: 'test-agent',
        type: 'general',
        capabilities: ['test'],
        resources
      }

      expect(agentRequest.resources?.maxMemory).toBe('1GB')
    })

    test('should ensure network node capabilities are extensible', () => {
      interface ExtendedCapabilities extends NodeCapabilities {
        customFeature: boolean
        experimentalModels: string[]
      }

      const extendedNode: NetworkNode & { capabilities: ExtendedCapabilities } = {
        id: 'extended-node',
        address: '192.168.1.200',
        port: 8080,
        capabilities: {
          models: ['custom-model'],
          maxConcurrency: 4,
          totalMemory: 8192,
          availableMemory: 4096,
          cpuCores: 4,
          supportedFormats: ['custom'],
          customFeature: true,
          experimentalModels: ['experimental-1', 'experimental-2']
        },
        status: 'active',
        load: 0.1,
        reputation: 1.0,
        lastSeen: new Date()
      }

      expect(extendedNode.capabilities.customFeature).toBe(true)
      expect(extendedNode.capabilities.experimentalModels).toHaveLength(2)
    })
  })

  describe('Default Values and Optionality', () => {
    test('should handle optional fields correctly', () => {
      // Minimal valid LLMProvider
      const minimalProvider: LLMProvider = {
        name: 'minimal',
        type: 'cloud',
        endpoint: 'https://api.minimal.com',
        models: ['minimal-model'],
        costPerToken: 0.001
      }

      expect(minimalProvider.apiKey).toBeUndefined()
      expect(minimalProvider.timeout).toBeUndefined()
      expect(minimalProvider.maxTokens).toBeUndefined()
    })

    test('should provide sensible defaults for complex types', () => {
      const basicTask: LLMTask = {
        id: 'basic-task',
        type: 'completion',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt'
      }

      // Optional fields should be undefined
      expect(basicTask.parameters).toBeUndefined()
      expect(basicTask.retryConfig).toBeUndefined()
      expect(basicTask.costBudget).toBeUndefined()
    })

    test('should handle partial updates correctly', () => {
      interface UpdateableConfig {
        name: string
        settings?: {
          timeout?: number
          retries?: number
          debug?: boolean
        }
        metadata?: Record<string, unknown>
      }

      const baseConfig: UpdateableConfig = {
        name: 'base-config'
      }

      const partialUpdate: Partial<UpdateableConfig> = {
        settings: {
          timeout: 5000
        },
        metadata: {
          version: '1.0.1'
        }
      }

      const merged = { ...baseConfig, ...partialUpdate }
      expect(merged.name).toBe('base-config')
      expect(merged.settings?.timeout).toBe(5000)
      expect(merged.metadata?.version).toBe('1.0.1')
    })
  })
})