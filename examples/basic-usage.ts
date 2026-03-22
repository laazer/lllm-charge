// Basic usage example of LLM-Charge system
// FEATURE: Simple examples for getting started with LLM-Charge

import { LLMCharge, LLMChargeConfig } from 'llm-charge'

async function basicUsageExample() {
  // Configuration for Ollama setup
  const config: LLMChargeConfig = {
    intelligence: {
      enableCodeGraph: true,
      enableContextPlus: true,
      enableSemanticSearch: true,
      enableMemoryGraph: true,
      cacheDir: './.llm-charge/cache',
      maxFileSize: 1048576,
      embedModel: 'nomic-embed-text'
    },
    reasoning: {
      enableRLM: true,
      maxDepth: 5,
      environment: 'local',
      timeoutMs: 120000,
      maxIterations: 10
    },
    local: {
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      models: {
        primary: 'llama3.2',
        reasoning: 'llama3.2',
        embedding: 'nomic-embed-text',
        chat: 'llama3.2'
      },
      maxTokens: 4000,
      temperature: 0.3
    },
    api: {
      providers: {
        openai: { 
          apiKey: process.env.OPENAI_API_KEY! 
        }
      },
      fallbackStrategy: 'local-first',
      maxCostPerHour: 1.0,
      trackUsage: true
    },
    cache: {
      enableEmbeddingCache: true,
      enableContextCache: true,
      enableResultCache: true,
      ttlSeconds: 3600,
      maxSizeMB: 500
    }
  }

  // Initialize LLM-Charge
  const llmCharge = new LLMCharge(config, process.cwd())
  await llmCharge.initialize()

  try {
    // Example 1: Simple code question (will use local model)
    console.log('🔍 Example 1: Simple code question')
    const result1 = await llmCharge.processQuery(
      'Explain what this function does: function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
      { complexity: 'simple', preferLocal: true }
    )
    
    console.log('Answer:', result1.answer)
    console.log('Model used:', result1.model, result1.isLocal ? '(local)' : '(API)')
    console.log('Cost:', `$${result1.cost.toFixed(4)}`)
    console.log('---')

    // Example 2: Complex reasoning (may use RLM)
    console.log('🧠 Example 2: Complex reasoning task')
    const result2 = await llmCharge.processQuery(
      'Design a caching system for a web application. Consider different cache levels, eviction policies, and consistency models.',
      { complexity: 'complex', requiresReasoning: true }
    )
    
    console.log('Answer:', result2.answer.slice(0, 200) + '...')
    console.log('Model used:', result2.model, result2.isLocal ? '(local)' : '(API)')
    console.log('Confidence:', result2.confidence)
    console.log('---')

    // Example 3: Codebase search
    console.log('📊 Example 3: Codebase search')
    const searchResults = await llmCharge.searchCodebase(
      'authentication functions',
      { includeSemanticSearch: true, maxResults: 10 }
    )
    
    console.log('Found symbols:', searchResults.symbols.length)
    console.log('Relevant files:', searchResults.files.slice(0, 5))
    console.log('Semantic matches:', searchResults.semanticMatches.length)
    console.log('---')

    // Example 4: System optimization
    console.log('⚡ Example 4: System optimization')
    const optimization = await llmCharge.optimizeSetup()
    
    console.log('Projected savings:')
    console.log('  Cost: $' + optimization.savings.cost.toFixed(4))
    console.log('  Tokens:', optimization.savings.tokens.toLocaleString())
    console.log('  Latency:', optimization.savings.latency + 'ms')
    console.log('Auto-applied optimizations:', optimization.applied)
    console.log('---')

    // Example 5: System metrics
    console.log('📈 Example 5: System metrics')
    const metrics = await llmCharge.getSystemMetrics()
    
    console.log('Today\'s usage:')
    console.log('  Total requests:', metrics.cost.totalRequests)
    console.log('  Local requests:', metrics.cost.localRequests)
    console.log('  Cost saved: $' + metrics.cost.costSaved.toFixed(4))
    console.log('  Average latency:', metrics.cost.avgLatency.toFixed(0) + 'ms')
    
    console.log('\nModel performance:')
    metrics.performance.forEach((model: any) => {
      console.log(`  ${model.model}: ${(model.qualityScore * 100).toFixed(1)}% quality, ${model.avgLatency.toFixed(0)}ms latency`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await llmCharge.shutdown()
  }
}

// LM Studio example
async function lmStudioExample() {
  const config: LLMChargeConfig = {
    intelligence: {
      enableCodeGraph: true,
      enableContextPlus: true,
      enableSemanticSearch: true,
      enableMemoryGraph: true,
      cacheDir: './.llm-charge/cache',
      maxFileSize: 1048576,
      embedModel: 'nomic-embed-text'
    },
    reasoning: {
      enableRLM: false, // Disable RLM for simpler setup
      maxDepth: 3,
      environment: 'local',
      timeoutMs: 60000,
      maxIterations: 5
    },
    local: {
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234', // LM Studio default port
      models: {
        primary: 'your-model-name',
        reasoning: 'your-model-name',
        embedding: 'nomic-embed-text', // May need separate Ollama for embeddings
        chat: 'your-model-name'
      },
      maxTokens: 2000,
      temperature: 0.4
    },
    api: {
      providers: {},
      fallbackStrategy: 'local-first',
      maxCostPerHour: 0.5,
      trackUsage: true
    },
    cache: {
      enableEmbeddingCache: true,
      enableContextCache: true,
      enableResultCache: true,
      ttlSeconds: 1800,
      maxSizeMB: 300
    }
  }

  const llmCharge = new LLMCharge(config, process.cwd())
  await llmCharge.initialize()

  try {
    const result = await llmCharge.processQuery(
      'Review this code for potential issues: async function fetchData() { const response = fetch("/api/data"); return response.json(); }',
      { complexity: 'medium', preferLocal: true }
    )
    
    console.log('LM Studio Response:', result.answer)
    console.log('Used local model:', result.isLocal)
    console.log('Tokens used:', result.tokensUsed)
    
  } catch (error) {
    console.error('LM Studio example error:', error)
  } finally {
    await llmCharge.shutdown()
  }
}

// Run examples
if (require.main === module) {
  console.log('🚀 LLM-Charge Basic Usage Examples\n')
  
  basicUsageExample()
    .then(() => {
      console.log('\n' + '='.repeat(50))
      console.log('🎯 LM Studio Example\n')
      return lmStudioExample()
    })
    .catch(console.error)
}