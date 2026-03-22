// Global test setup for LLM-Charge test suite
import * as path from 'path'
import * as fs from 'fs/promises'
import { execSync } from 'child_process'

// Custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R
      toHaveValidCostMetrics(): R
    }
  }
}

// Add Jest matchers if expect is available
if (typeof expect !== 'undefined') {
  expect.extend({
    toBeWithinRange(received: number, floor: number, ceiling: number) {
      const pass = received >= floor && received <= ceiling
      return {
        message: () => pass 
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass
      }
    },

    toHaveValidCostMetrics(received: any) {
      const isValid = received && 
        typeof received.cost === 'number' &&
        received.cost >= 0 &&
        typeof received.executionTime === 'number' &&
        received.executionTime >= 0

      return {
        message: () => isValid 
          ? `expected ${JSON.stringify(received)} not to be valid cost metrics`
          : `expected ${JSON.stringify(received)} to be valid cost metrics`,
        pass: isValid
      }
    }
  })
}

// Global test constants
export const TEST_CONFIG = {
  TEST_PROJECT_DIR: path.join(__dirname, 'fixtures', 'test-project'),
  TEST_CACHE_DIR: path.join(__dirname, 'fixtures', 'cache'),
  TEST_TIMEOUT: 10000,
  MOCK_LLM_RESPONSE_DELAY: 100
}

// Mock LLM Provider for consistent testing
export class MockLLMProvider {
  private costPerToken = 0.0015 / 1000 // Approximate cost per token
  
  async generateResponse(prompt: string, options?: any): Promise<string> {
    // Simulate realistic response time
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.MOCK_LLM_RESPONSE_DELAY))
    
    // Pattern-based responses for testing
    const lowerPrompt = prompt.toLowerCase()
    
    if (lowerPrompt.includes('react')) {
      return 'React is a JavaScript library for building user interfaces. It allows you to create reusable UI components.'
    }
    
    if (lowerPrompt.includes('typescript')) {
      return 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.'
    }
    
    if (lowerPrompt.includes('test')) {
      return 'Testing is essential for maintaining code quality and preventing regressions.'
    }
    
    if (lowerPrompt.includes('error') || lowerPrompt.includes('debug')) {
      return 'To debug this issue, check the console logs and verify your configuration.'
    }
    
    // Default response
    return `Mock response for: ${prompt.slice(0, 50)}...`
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    // Simple deterministic embedding based on text hash
    const hash = this.simpleHash(text)
    const embedding = []
    for (let i = 0; i < 384; i++) {
      embedding.push(Math.sin(hash + i) * 0.5)
    }
    return embedding
  }
  
  calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens + outputTokens) * this.costPerToken
  }
  
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

// Test configuration factory
export function createMockConfig(): any {
  return {
    providers: {
      ollama: {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        models: ['llama2', 'codellama']
      },
      lmstudio: {
        enabled: true,
        baseUrl: 'http://localhost:1234',
        models: ['local-model']
      }
    },
    intelligence: {
      semanticSearch: {
        enabled: true,
        threshold: 0.7,
        maxResults: 10
      },
      knowledgeBase: {
        path: TEST_CONFIG.TEST_CACHE_DIR,
        maxSize: 1000000 // 1MB for testing
      }
    },
    commands: {
      patterns: {
        enabled: true,
        customPatterns: []
      }
    }
  }
}

// Test directory management
export async function setupTestDirectories(): Promise<void> {
  try {
    await fs.mkdir(TEST_CONFIG.TEST_PROJECT_DIR, { recursive: true })
    await fs.mkdir(TEST_CONFIG.TEST_CACHE_DIR, { recursive: true })
    
    // Create sample test files
    await fs.writeFile(
      path.join(TEST_CONFIG.TEST_PROJECT_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'typescript': '^4.0.0'
        }
      }, null, 2)
    )
    
    await fs.writeFile(
      path.join(TEST_CONFIG.TEST_PROJECT_DIR, 'src', 'index.ts'),
      'console.log("Hello, World!")'
    )
  } catch (error) {
    // Directory might already exist, ignore
  }
}

export async function cleanupTestDirectories(): Promise<void> {
  try {
    await fs.rm(TEST_CONFIG.TEST_PROJECT_DIR, { recursive: true, force: true })
    await fs.rm(TEST_CONFIG.TEST_CACHE_DIR, { recursive: true, force: true })
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Test query generators
export function generateTestQuery(type: 'simple' | 'complex' | 'code' = 'simple'): string {
  switch (type) {
    case 'simple':
      return 'What is React?'
    case 'complex':
      return 'How do I implement authentication with JWT tokens in a React TypeScript application?'
    case 'code':
      return 'Show me how to create a custom hook for API calls'
    default:
      return 'Test query'
  }
}

// Performance helpers
export function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T, time: number }> {
  return new Promise(async (resolve, reject) => {
    const start = Date.now()
    try {
      const result = await fn()
      const time = Date.now() - start
      resolve({ result, time })
    } catch (error) {
      reject(error)
    }
  })
}

// Validation helpers
export function validateCostMetrics(metrics: any): boolean {
  return typeof metrics === 'object' &&
    typeof metrics.totalCost === 'number' &&
    metrics.totalCost >= 0 &&
    typeof metrics.tokensUsed === 'number' &&
    metrics.tokensUsed >= 0 &&
    typeof metrics.executionTime === 'number' &&
    metrics.executionTime >= 0
}