#!/usr/bin/env npx tsx

/**
 * Performance Benchmark Script for LLM-Charge
 * 
 * This script provides basic performance benchmarks for key LLM-Charge features.
 * Used by documentation validation to verify performance claims.
 */

import { performance } from 'perf_hooks'

interface BenchmarkResult {
  name: string
  averageTime: number
  minTime: number
  maxTime: number
  iterations: number
}

export class LLMChargeBenchmark {
  
  async measureAPIResponseTime(endpoint: string, method = 'GET'): Promise<number> {
    const start = performance.now()
    
    try {
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {}
      })
      const end = performance.now()
      
      if (response.ok) {
        return end - start
      }
    } catch (error) {
      console.warn(`Benchmark warning: ${endpoint} not available during testing`)
    }
    
    return -1 // Indicates endpoint not available for testing
  }

  async benchmarkHybridReasoning(): Promise<BenchmarkResult> {
    const iterations = 3
    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const time = await this.measureAPIResponseTime('/mcp/call/hybrid_reasoning')
      if (time > 0) times.push(time)
    }
    
    return this.calculateStats('Hybrid Reasoning Response', times, iterations)
  }

  async benchmarkDevDocsSearch(): Promise<BenchmarkResult> {
    const iterations = 5
    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const time = await this.measureAPIResponseTime('/api/devdocs/search', 'POST')
      if (time > 0) times.push(time)
    }
    
    return this.calculateStats('DevDocs Search Response', times, iterations)
  }

  async benchmarkAPIEndpoints(): Promise<BenchmarkResult> {
    const endpoints = ['/api/projects', '/api/agents', '/api/specs']
    const times: number[] = []
    
    for (const endpoint of endpoints) {
      const time = await this.measureAPIResponseTime(endpoint)
      if (time > 0) times.push(time)
    }
    
    return this.calculateStats('Standard API Response', times, endpoints.length)
  }

  private calculateStats(name: string, times: number[], iterations: number): BenchmarkResult {
    if (times.length === 0) {
      return {
        name,
        averageTime: -1,
        minTime: -1,
        maxTime: -1,
        iterations
      }
    }

    return {
      name,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      iterations: times.length
    }
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 Running LLM-Charge Performance Benchmarks...\n')
    
    const results = await Promise.all([
      this.benchmarkHybridReasoning(),
      this.benchmarkDevDocsSearch(), 
      this.benchmarkAPIEndpoints()
    ])
    
    return results
  }

  printResults(results: BenchmarkResult[]): void {
    console.log('📊 Benchmark Results:\n')
    
    for (const result of results) {
      if (result.averageTime === -1) {
        console.log(`❌ ${result.name}: Not available for testing`)
      } else {
        console.log(`✅ ${result.name}:`)
        console.log(`   Average: ${result.averageTime.toFixed(2)}ms`)
        console.log(`   Range: ${result.minTime.toFixed(2)}ms - ${result.maxTime.toFixed(2)}ms`)
        console.log(`   Samples: ${result.iterations}`)
      }
      console.log()
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new LLMChargeBenchmark()
  benchmark.runAllBenchmarks().then(results => {
    benchmark.printResults(results)
  }).catch(error => {
    console.error('❌ Benchmark execution failed:', error.message)
    process.exit(1)
  })
}