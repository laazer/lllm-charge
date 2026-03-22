import { jest } from '@jest/globals'
import { EventEmitter } from 'events'
import { MultiModalIntelligence } from '../../../src/intelligence/multi-modal-intelligence.js'
import type {
  ImageAnalysisRequest,
  ImageAnalysisResult,
  DiagramGenerationRequest,
  DiagramGenerationResult,
  ScreenshotAnalysisRequest,
  ScreenshotAnalysisResult,
  VisionCapabilities
} from '../../../src/intelligence/types.js'

// Mock sharp for image processing
jest.mock('sharp', () => {
  const mockSharp = {
    metadata: jest.fn().mockResolvedValue({
      width: 1024,
      height: 768,
      format: 'png',
      channels: 3,
      density: 72
    }),
    resize: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image-data')),
    extract: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis()
  }
  return jest.fn(() => mockSharp)
})

// Mock canvas for diagram generation
jest.mock('canvas', () => ({
  createCanvas: jest.fn(() => ({
    width: 800,
    height: 600,
    getContext: jest.fn(() => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '14px Arial',
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 100 })),
      arc: jest.fn(),
      closePath: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn()
    })),
    toBuffer: jest.fn(() => Buffer.from('generated-diagram'))
  })),
  loadImage: jest.fn().mockResolvedValue({
    width: 100,
    height: 100
  })
}))

// Mock filesystem operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn()
}))

// Mock child process for external tools
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn()
}))

describe('MultiModalIntelligence', () => {
  let intelligence: MultiModalIntelligence

  beforeEach(() => {
    intelligence = new MultiModalIntelligence({
      visionModels: ['gpt-4-vision', 'claude-3-vision'],
      enableScreenshots: true,
      enableDiagrams: true,
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp']
    })
  })

  afterEach(() => {
    intelligence.removeAllListeners()
  })

  describe('Image Analysis', () => {
    test('should analyze image and extract insights', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake-image-data'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/sample.png',
        analysisType: 'general',
        extractText: true,
        detectObjects: true,
        generateDescription: true
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true)
      expect(result.description).toBeDefined()
      expect(result.extractedText).toBeDefined()
      expect(result.detectedObjects).toBeDefined()
      expect(result.metadata.width).toBe(1024)
      expect(result.metadata.height).toBe(768)
      expect(result.metadata.format).toBe('png')
    })

    test('should analyze image from base64 data', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const request: ImageAnalysisRequest = {
        imageData: base64Data,
        analysisType: 'technical',
        extractText: false,
        detectObjects: true,
        generateDescription: true,
        customPrompt: 'Analyze this technical diagram'
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true)
      expect(result.description).toContain('technical')
      expect(result.extractedText).toBe('')
    })

    test('should handle different image formats', async () => {
      const formats = ['png', 'jpg', 'jpeg', 'gif', 'webp']

      for (const format of formats) {
        const fs = await import('fs/promises')
        ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(`fake-${format}-data`))

        const request: ImageAnalysisRequest = {
          imagePath: `/test/images/sample.${format}`,
          analysisType: 'general'
        }

        const result = await intelligence.analyzeImage(request)

        expect(result.success).toBe(true)
        expect(result.metadata.format).toBe(format === 'jpg' ? 'jpeg' : format)
      }
    })

    test('should extract text using OCR', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('text-image-data'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/text-document.png',
        analysisType: 'text-extraction',
        extractText: true,
        ocrEngine: 'tesseract'
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true)
      expect(result.extractedText).toBeDefined()
      expect(result.extractedText.length).toBeGreaterThan(0)
    })

    test('should detect and classify objects', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('object-image-data'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/objects.jpg',
        analysisType: 'object-detection',
        detectObjects: true,
        confidenceThreshold: 0.8
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true)
      expect(result.detectedObjects).toBeDefined()
      expect(Array.isArray(result.detectedObjects)).toBe(true)
      
      if (result.detectedObjects.length > 0) {
        const obj = result.detectedObjects[0]
        expect(obj.label).toBeDefined()
        expect(obj.confidence).toBeGreaterThan(0)
        expect(obj.boundingBox).toBeDefined()
      }
    })

    test('should reject oversized images', async () => {
      const fs = await import('fs/promises')
      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 20 * 1024 * 1024 }) // 20MB

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/huge-image.png',
        analysisType: 'general'
      }

      await expect(intelligence.analyzeImage(request)).rejects.toThrow('Image size exceeds maximum allowed size')
    })

    test('should emit image-analyzed event', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('event-test-image'))

      const eventPromise = new Promise((resolve) => {
        intelligence.on('image-analyzed', resolve)
      })

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/event-test.png',
        analysisType: 'general'
      }

      await intelligence.analyzeImage(request)

      const event = await eventPromise
      expect(event).toEqual(
        expect.objectContaining({
          imagePath: '/test/images/event-test.png',
          analysisType: 'general',
          success: true
        })
      )
    })
  })

  describe('Diagram Generation', () => {
    test('should generate flowchart diagram', async () => {
      const request: DiagramGenerationRequest = {
        type: 'flowchart',
        title: 'Test Process Flow',
        description: 'A simple test flowchart',
        elements: [
          { id: 'start', type: 'start', label: 'Start', position: { x: 100, y: 50 } },
          { id: 'process1', type: 'process', label: 'Process Data', position: { x: 100, y: 150 } },
          { id: 'decision1', type: 'decision', label: 'Valid?', position: { x: 100, y: 250 } },
          { id: 'end', type: 'end', label: 'End', position: { x: 100, y: 350 } }
        ],
        connections: [
          { from: 'start', to: 'process1' },
          { from: 'process1', to: 'decision1' },
          { from: 'decision1', to: 'end', label: 'Yes' }
        ],
        style: {
          backgroundColor: '#ffffff',
          primaryColor: '#0066cc',
          fontSize: 12
        }
      }

      const result = await intelligence.generateDiagram(request)

      expect(result.success).toBe(true)
      expect(result.imageBuffer).toBeDefined()
      expect(result.metadata.width).toBeGreaterThan(0)
      expect(result.metadata.height).toBeGreaterThan(0)
      expect(result.metadata.format).toBe('png')
    })

    test('should generate system architecture diagram', async () => {
      const request: DiagramGenerationRequest = {
        type: 'architecture',
        title: 'System Architecture',
        description: 'Microservices architecture diagram',
        elements: [
          { id: 'frontend', type: 'component', label: 'Frontend App', position: { x: 50, y: 50 } },
          { id: 'api', type: 'component', label: 'API Gateway', position: { x: 200, y: 50 } },
          { id: 'service1', type: 'service', label: 'User Service', position: { x: 50, y: 200 } },
          { id: 'service2', type: 'service', label: 'Data Service', position: { x: 200, y: 200 } },
          { id: 'database', type: 'database', label: 'Database', position: { x: 125, y: 350 } }
        ],
        connections: [
          { from: 'frontend', to: 'api' },
          { from: 'api', to: 'service1' },
          { from: 'api', to: 'service2' },
          { from: 'service1', to: 'database' },
          { from: 'service2', to: 'database' }
        ]
      }

      const result = await intelligence.generateDiagram(request)

      expect(result.success).toBe(true)
      expect(result.imageBuffer).toBeDefined()
      expect(result.generatedElements.length).toBe(5)
    })

    test('should generate UML class diagram', async () => {
      const request: DiagramGenerationRequest = {
        type: 'uml-class',
        title: 'Class Diagram',
        elements: [
          {
            id: 'user',
            type: 'class',
            label: 'User',
            position: { x: 100, y: 100 },
            properties: ['id: string', 'name: string', 'email: string'],
            methods: ['login()', 'logout()', 'updateProfile()']
          },
          {
            id: 'order',
            type: 'class',
            label: 'Order',
            position: { x: 300, y: 100 },
            properties: ['id: string', 'userId: string', 'total: number'],
            methods: ['calculate()', 'submit()', 'cancel()']
          }
        ],
        connections: [
          { from: 'user', to: 'order', type: 'association', label: '1..*' }
        ]
      }

      const result = await intelligence.generateDiagram(request)

      expect(result.success).toBe(true)
      expect(result.imageBuffer).toBeDefined()
    })

    test('should generate mermaid-style diagram', async () => {
      const mermaidCode = `
        graph TD
          A[Start] --> B{Is it working?}
          B -->|Yes| C[Great!]
          B -->|No| D[Debug]
          D --> B
          C --> E[End]
      `

      const request: DiagramGenerationRequest = {
        type: 'mermaid',
        mermaidCode,
        style: {
          theme: 'default',
          backgroundColor: '#f9f9f9'
        }
      }

      const result = await intelligence.generateDiagram(request)

      expect(result.success).toBe(true)
      expect(result.imageBuffer).toBeDefined()
    })

    test('should save diagram to file when requested', async () => {
      const fs = await import('fs/promises')
      ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)

      const request: DiagramGenerationRequest = {
        type: 'flowchart',
        title: 'Save Test Diagram',
        elements: [
          { id: 'test', type: 'process', label: 'Test', position: { x: 100, y: 100 } }
        ],
        outputPath: '/test/diagrams/save-test.png'
      }

      const result = await intelligence.generateDiagram(request)

      expect(result.success).toBe(true)
      expect(result.savedPath).toBe('/test/diagrams/save-test.png')
      expect(fs.writeFile).toHaveBeenCalledWith('/test/diagrams/save-test.png', expect.any(Buffer))
    })
  })

  describe('Screenshot Analysis', () => {
    test('should capture and analyze screen', async () => {
      // Mock screenshot capture
      const mockScreenshotBuffer = Buffer.from('screenshot-data')

      const request: ScreenshotAnalysisRequest = {
        region: { x: 0, y: 0, width: 1920, height: 1080 },
        analysisType: 'ui-analysis',
        extractText: true,
        detectElements: true
      }

      const result = await intelligence.analyzeScreenshot(request)

      expect(result.success).toBe(true)
      expect(result.description).toBeDefined()
      expect(result.uiElements).toBeDefined()
      expect(result.screenshot).toBeDefined()
    })

    test('should detect UI elements in screenshot', async () => {
      const request: ScreenshotAnalysisRequest = {
        analysisType: 'element-detection',
        detectElements: true,
        elementTypes: ['button', 'input', 'link', 'image']
      }

      const result = await intelligence.analyzeScreenshot(request)

      expect(result.success).toBe(true)
      expect(result.uiElements).toBeDefined()
      expect(Array.isArray(result.uiElements)).toBe(true)
    })

    test('should compare screenshots for changes', async () => {
      const request1: ScreenshotAnalysisRequest = {
        analysisType: 'ui-analysis',
        saveReference: true,
        referenceId: 'comparison-test'
      }

      const result1 = await intelligence.analyzeScreenshot(request1)
      expect(result1.success).toBe(true)

      // Take second screenshot for comparison
      const request2: ScreenshotAnalysisRequest = {
        analysisType: 'change-detection',
        compareWith: 'comparison-test'
      }

      const result2 = await intelligence.analyzeScreenshot(request2)

      expect(result2.success).toBe(true)
      expect(result2.changeDetection).toBeDefined()
      expect(result2.changeDetection?.hasChanges).toBeDefined()
    })

    test('should analyze specific window or application', async () => {
      const request: ScreenshotAnalysisRequest = {
        windowTitle: 'Test Application',
        analysisType: 'app-analysis',
        extractText: true,
        detectElements: true
      }

      const result = await intelligence.analyzeScreenshot(request)

      expect(result.success).toBe(true)
      expect(result.windowInfo).toBeDefined()
      expect(result.windowInfo?.title).toBe('Test Application')
    })
  })

  describe('Vision Capabilities', () => {
    test('should list available vision models', async () => {
      const capabilities = await intelligence.getVisionCapabilities()

      expect(capabilities.models).toContain('gpt-4-vision')
      expect(capabilities.models).toContain('claude-3-vision')
      expect(capabilities.supportedFormats).toEqual(['png', 'jpg', 'jpeg', 'gif', 'webp'])
      expect(capabilities.maxImageSize).toBe(10 * 1024 * 1024)
    })

    test('should check if specific feature is supported', async () => {
      const ocrSupported = await intelligence.isFeatureSupported('ocr')
      const objectDetectionSupported = await intelligence.isFeatureSupported('object-detection')
      const diagramGenerationSupported = await intelligence.isFeatureSupported('diagram-generation')

      expect(ocrSupported).toBe(true)
      expect(objectDetectionSupported).toBe(true)
      expect(diagramGenerationSupported).toBe(true)
    })

    test('should get optimal model for task', async () => {
      const textExtractionModel = await intelligence.getOptimalModel('text-extraction')
      const objectDetectionModel = await intelligence.getOptimalModel('object-detection')
      const generalAnalysisModel = await intelligence.getOptimalModel('general-analysis')

      expect(textExtractionModel).toBeDefined()
      expect(objectDetectionModel).toBeDefined()
      expect(generalAnalysisModel).toBeDefined()
    })
  })

  describe('Image Processing Pipeline', () => {
    test('should preprocess image before analysis', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('raw-image-data'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/noisy-image.png',
        analysisType: 'general',
        preprocessing: {
          resize: { width: 800, height: 600 },
          enhance: true,
          denoise: true,
          sharpen: 0.5
        }
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true)
      expect(result.preprocessing).toBeDefined()
      expect(result.preprocessing?.applied).toBe(true)
    })

    test('should apply image filters', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('filter-test-image'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/filter-test.jpg',
        analysisType: 'enhanced',
        filters: ['contrast', 'brightness', 'saturation'],
        filterStrength: 0.3
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true)
      expect(result.filtersApplied).toEqual(['contrast', 'brightness', 'saturation'])
    })

    test('should batch process multiple images', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('batch-image-data'))

      const imagePaths = [
        '/test/images/batch1.png',
        '/test/images/batch2.jpg',
        '/test/images/batch3.png'
      ]

      const results = await intelligence.batchAnalyzeImages(imagePaths, {
        analysisType: 'general',
        extractText: true,
        detectObjects: true
      })

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.description).toBeDefined()
      })
    })
  })

  describe('Performance and Caching', () => {
    test('should cache analysis results', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('cache-test-image'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/cache-test.png',
        analysisType: 'general',
        useCache: true
      }

      // First analysis
      const start1 = Date.now()
      const result1 = await intelligence.analyzeImage(request)
      const duration1 = Date.now() - start1

      // Second analysis (should use cache)
      const start2 = Date.now()
      const result2 = await intelligence.analyzeImage(request)
      const duration2 = Date.now() - start2

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.description).toBe(result2.description)
      expect(duration2).toBeLessThan(duration1) // Cached should be faster
    })

    test('should track performance metrics', async () => {
      const metrics = await intelligence.getPerformanceMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.totalAnalyses).toBeGreaterThanOrEqual(0)
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.successRate).toBeGreaterThanOrEqual(0)
    })

    test('should optimize analysis based on content type', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('optimization-test'))

      const textRequest: ImageAnalysisRequest = {
        imagePath: '/test/images/document.png',
        analysisType: 'text-extraction',
        optimizeFor: 'text'
      }

      const objectRequest: ImageAnalysisRequest = {
        imagePath: '/test/images/scene.jpg',
        analysisType: 'object-detection',
        optimizeFor: 'objects'
      }

      const textResult = await intelligence.analyzeImage(textRequest)
      const objectResult = await intelligence.analyzeImage(objectRequest)

      expect(textResult.success).toBe(true)
      expect(objectResult.success).toBe(true)
      expect(textResult.optimizationApplied).toBe('text')
      expect(objectResult.optimizationApplied).toBe('objects')
    })
  })

  describe('Error Handling and Validation', () => {
    test('should handle unsupported image formats', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('unsupported-format'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/unsupported.tiff',
        analysisType: 'general'
      }

      await expect(intelligence.analyzeImage(request)).rejects.toThrow('Unsupported image format')
    })

    test('should handle corrupted images gracefully', async () => {
      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('corrupted-data'))

      // Mock sharp to throw error for corrupted image
      const sharp = await import('sharp')
      ;(sharp as any).mockImplementation(() => ({
        metadata: jest.fn().mockRejectedValue(new Error('Invalid image data'))
      }))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/corrupted.png',
        analysisType: 'general'
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid image data')
    })

    test('should validate diagram generation parameters', async () => {
      const invalidRequest: DiagramGenerationRequest = {
        type: 'flowchart',
        title: '',
        elements: [], // No elements
        connections: []
      }

      await expect(intelligence.generateDiagram(invalidRequest)).rejects.toThrow('Diagram must have at least one element')
    })

    test('should handle vision model failures', async () => {
      // Mock vision model failure
      const originalAnalyze = intelligence.analyzeWithVisionModel
      intelligence.analyzeWithVisionModel = jest.fn().mockRejectedValue(new Error('Vision model unavailable'))

      const fs = await import('fs/promises')
      ;(fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('fallback-test-image'))

      const request: ImageAnalysisRequest = {
        imagePath: '/test/images/fallback-test.png',
        analysisType: 'general',
        fallbackEnabled: true
      }

      const result = await intelligence.analyzeImage(request)

      expect(result.success).toBe(true) // Should succeed with fallback
      expect(result.usedFallback).toBe(true)

      // Restore original method
      intelligence.analyzeWithVisionModel = originalAnalyze
    })
  })
})