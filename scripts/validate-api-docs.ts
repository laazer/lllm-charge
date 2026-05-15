#!/usr/bin/env npx tsx

/**
 * API Documentation Checker Script
 * Validates API endpoint documentation and consistency
 * Part of MODERATE-002: API endpoint validation implementation
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

interface ApiEndpoint {
  method: string
  path: string
  description: string
  parameters?: string[]
  responses?: string[]
  documented: boolean
  implemented: boolean
  tested: boolean
}

interface ValidationResult {
  endpoint: string
  issues: string[]
  severity: 'error' | 'warning' | 'info'
}

/**
 * Known API endpoints from the codebase analysis
 */
const API_ENDPOINTS: ApiEndpoint[] = [
  // Core API
  { method: 'GET', path: '/api/health', description: 'Health check endpoint', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/test', description: 'Test endpoint for basic connectivity', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/metrics', description: 'System metrics and statistics', documented: false, implemented: true, tested: true },
  
  // Provider Management
  { method: 'GET', path: '/api/providers/status', description: 'LLM provider status and availability', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/providers/test/:provider', description: 'Test specific LLM provider', documented: false, implemented: true, tested: true },
  
  // Project Management
  { method: 'GET', path: '/api/projects', description: 'List all projects', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/projects', description: 'Create new project', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/projects/:id', description: 'Get project by ID', documented: false, implemented: true, tested: true },
  { method: 'PUT', path: '/api/projects/:id', description: 'Update project', documented: false, implemented: true, tested: true },
  { method: 'DELETE', path: '/api/projects/:id', description: 'Delete project', documented: false, implemented: true, tested: true },
  
  // Project-scoped Resources
  { method: 'GET', path: '/api/projects/:id/specs', description: 'Get project specifications', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/projects/:id/specs', description: 'Create specification in project', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/projects/:id/agents', description: 'Get project agents', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/projects/:id/agents', description: 'Create agent in project', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/projects/:id/workflows', description: 'Get project workflows', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/projects/:id/workflows', description: 'Create workflow in project', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/projects/:id/notes', description: 'Get project notes', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/projects/:id/notes', description: 'Create note in project', documented: false, implemented: true, tested: true },
  
  // Global Resource Management (Independent Architecture)
  { method: 'GET', path: '/api/agents', description: 'List all agents (independent)', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/agents', description: 'Create new agent', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/agents/:id', description: 'Get agent by ID', documented: false, implemented: true, tested: true },
  { method: 'PUT', path: '/api/agents/:id', description: 'Update agent', documented: false, implemented: true, tested: true },
  { method: 'DELETE', path: '/api/agents/:id', description: 'Delete agent', documented: false, implemented: true, tested: true },
  
  { method: 'GET', path: '/api/workflows', description: 'List all workflows (independent)', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/workflows', description: 'Create new workflow', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/workflows/:id', description: 'Get workflow by ID', documented: false, implemented: true, tested: true },
  { method: 'PUT', path: '/api/workflows/:id', description: 'Update workflow', documented: false, implemented: true, tested: true },
  { method: 'DELETE', path: '/api/workflows/:id', description: 'Delete workflow', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/workflows/:id/execute', description: 'Execute workflow', documented: false, implemented: true, tested: true },
  
  { method: 'GET', path: '/api/specs', description: 'List all specifications', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/specs', description: 'Create new specification', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/specs/:id', description: 'Get specification by ID', documented: false, implemented: true, tested: true },
  { method: 'PUT', path: '/api/specs/:id', description: 'Update specification', documented: false, implemented: true, tested: true },
  { method: 'DELETE', path: '/api/specs/:id', description: 'Delete specification', documented: false, implemented: true, tested: true },
  
  // Memory Management
  { method: 'GET', path: '/api/memory/notes', description: 'List memory notes', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/memory/notes', description: 'Create memory note', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/memory/checkpoints', description: 'List memory checkpoints', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/memory/checkpoints', description: 'Create memory checkpoint', documented: false, implemented: true, tested: true },
  
  // MCP (Model Context Protocol)
  { method: 'GET', path: '/mcp/tools', description: 'List available MCP tools', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/mcp/resources', description: 'List available MCP resources', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/mcp/call/:tool', description: 'Execute MCP tool', documented: false, implemented: true, tested: true },
  
  // Specialized Services
  { method: 'GET', path: '/api/devdocs/languages', description: 'List supported DevDocs languages', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/devdocs/search', description: 'Search DevDocs documentation', documented: false, implemented: true, tested: true },
  
  { method: 'GET', path: '/api/universal-lang/languages', description: 'List supported programming languages', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/universal-lang/analyze', description: 'Analyze code in multiple languages', documented: false, implemented: true, tested: true },
  
  { method: 'GET', path: '/api/codegraph/status', description: 'CodeGraph service status', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/codegraph/search', description: 'Search code using CodeGraph', documented: false, implemented: true, tested: true },
  
  { method: 'GET', path: '/api/hybrid-routing/metrics', description: 'Hybrid routing metrics', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/hybrid-routing/route', description: 'Route request to optimal provider', documented: false, implemented: true, tested: true },
  
  // System Introspection
  { method: 'GET', path: '/api/reasoning/stats', description: 'Reasoning system statistics', documented: false, implemented: true, tested: true },
  { method: 'GET', path: '/api/reasoning/logs', description: 'Reasoning system logs', documented: false, implemented: true, tested: true },
  
  // Setup and Configuration
  { method: 'GET', path: '/api/setup/status', description: 'Setup system status', documented: false, implemented: true, tested: true },
  { method: 'POST', path: '/api/setup/defaults', description: 'Load default configuration', documented: false, implemented: true, tested: true }
]

/**
 * Check if endpoint is documented in README or CLAUDE.md
 */
function checkDocumentation(): Promise<void> {
  return new Promise((resolve) => {
    const docFiles = [
      path.join(projectRoot, 'README.md'),
      path.join(projectRoot, 'CLAUDE.md'),
      path.join(projectRoot, 'docs', 'API.md'),
      path.join(projectRoot, 'docs', 'api.md')
    ]
    
    const documentationContent = docFiles
      .filter(file => fs.existsSync(file))
      .map(file => fs.readFileSync(file, 'utf-8'))
      .join('\n')
    
    // Update documentation status for endpoints
    API_ENDPOINTS.forEach(endpoint => {
      const pathInDocs = documentationContent.includes(endpoint.path) ||
                        documentationContent.includes(endpoint.description)
      endpoint.documented = pathInDocs
    })
    
    resolve()
  })
}

/**
 * Check if endpoint is implemented in server code
 */
function checkImplementation(): Promise<void> {
  return new Promise((resolve) => {
    const serverFiles = [
      path.join(projectRoot, 'src', 'server', 'comprehensive-working-server.mjs'),
      path.join(projectRoot, 'src', 'server', 'working-server.mjs'),
      path.join(projectRoot, 'src', 'server', 'independent-database-manager.mjs')
    ]
    
    const serverContent = serverFiles
      .filter(file => fs.existsSync(file))
      .map(file => fs.readFileSync(file, 'utf-8'))
      .join('\n')
    
    // Update implementation status for endpoints
    API_ENDPOINTS.forEach(endpoint => {
      // Check if the route path is mentioned in server code
      const pathPattern = endpoint.path.replace(':id', '.*').replace(':tool', '.*').replace(':provider', '.*')
      const routeRegex = new RegExp(`(['"\`])${pathPattern}\\1`, 'i')
      const implemented = routeRegex.test(serverContent) || 
                         serverContent.includes(endpoint.path) ||
                         serverContent.includes(endpoint.path.replace(/:\w+/g, ''))
      endpoint.implemented = implemented
    })
    
    resolve()
  })
}

/**
 * Check if endpoint is covered by tests
 */
function checkTestCoverage(): Promise<void> {
  return new Promise((resolve) => {
    const testFiles = [
      path.join(projectRoot, 'tests', 'integration', 'api-endpoint-validation.test.ts'),
      path.join(projectRoot, 'tests', 'integration', 'websocket-validation.test.ts'),
      path.join(projectRoot, 'tests', 'performance', 'api-performance-benchmarks.test.ts')
    ]
    
    const testContent = testFiles
      .filter(file => fs.existsSync(file))
      .map(file => fs.readFileSync(file, 'utf-8'))
      .join('\n')
    
    // Update test coverage status for endpoints
    API_ENDPOINTS.forEach(endpoint => {
      const tested = testContent.includes(endpoint.path) ||
                    testContent.includes(endpoint.description) ||
                    testContent.includes(endpoint.path.replace(/:\w+/g, '.*'))
      endpoint.tested = tested
    })
    
    resolve()
  })
}

/**
 * Validate endpoint consistency and generate issues
 */
function validateEndpoints(): ValidationResult[] {
  const results: ValidationResult[] = []
  
  API_ENDPOINTS.forEach(endpoint => {
    const issues: string[] = []
    let severity: 'error' | 'warning' | 'info' = 'info'
    
    // Check if implemented but not documented
    if (endpoint.implemented && !endpoint.documented) {
      issues.push('Endpoint is implemented but not documented')
      severity = 'warning'
    }
    
    // Check if documented but not implemented
    if (endpoint.documented && !endpoint.implemented) {
      issues.push('Endpoint is documented but not implemented')
      severity = 'error'
    }
    
    // Check if implemented but not tested
    if (endpoint.implemented && !endpoint.tested) {
      issues.push('Endpoint is implemented but not tested')
      severity = 'warning'
    }
    
    // Check if not implemented at all
    if (!endpoint.implemented) {
      issues.push('Endpoint is not implemented')
      severity = 'error'
    }
    
    if (issues.length > 0) {
      results.push({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        issues,
        severity
      })
    }
  })
  
  return results
}

/**
 * Generate summary statistics
 */
function generateSummary(): void {
  const total = API_ENDPOINTS.length
  const implemented = API_ENDPOINTS.filter(e => e.implemented).length
  const documented = API_ENDPOINTS.filter(e => e.documented).length
  const tested = API_ENDPOINTS.filter(e => e.tested).length
  
  console.log('\n📊 API Documentation Summary')
  console.log('===============================')
  console.log(`Total endpoints: ${total}`)
  console.log(`Implemented: ${implemented}/${total} (${Math.round(implemented/total*100)}%)`)
  console.log(`Documented: ${documented}/${total} (${Math.round(documented/total*100)}%)`)
  console.log(`Tested: ${tested}/${total} (${Math.round(tested/total*100)}%)`)
  
  const coverage = {
    implementation: Math.round(implemented/total*100),
    documentation: Math.round(documented/total*100),
    testing: Math.round(tested/total*100)
  }
  
  console.log(`\n📈 Coverage Scores:`)
  console.log(`Implementation Coverage: ${coverage.implementation}%`)
  console.log(`Documentation Coverage: ${coverage.documentation}%`)
  console.log(`Testing Coverage: ${coverage.testing}%`)
  
  // Overall grade
  const overall = Math.round((coverage.implementation + coverage.documentation + coverage.testing) / 3)
  console.log(`Overall API Quality: ${overall}%`)
  
  if (overall >= 90) {
    console.log('🎉 Excellent API quality!')
  } else if (overall >= 75) {
    console.log('👍 Good API quality')
  } else if (overall >= 60) {
    console.log('⚠️  API quality needs improvement')
  } else {
    console.log('❌ Poor API quality - immediate attention required')
  }
}

/**
 * Generate detailed report
 */
function generateDetailedReport(validationResults: ValidationResult[]): void {
  console.log('\n📋 Detailed Validation Report')
  console.log('==============================')
  
  const errors = validationResults.filter(r => r.severity === 'error')
  const warnings = validationResults.filter(r => r.severity === 'warning')
  const infos = validationResults.filter(r => r.severity === 'info')
  
  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`)
    errors.forEach(result => {
      console.log(`  ${result.endpoint}:`)
      result.issues.forEach(issue => console.log(`    - ${issue}`))
    })
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`)
    warnings.forEach(result => {
      console.log(`  ${result.endpoint}:`)
      result.issues.forEach(issue => console.log(`    - ${issue}`))
    })
  }
  
  if (infos.length > 0) {
    console.log(`\n💡 INFO (${infos.length}):`)
    infos.forEach(result => {
      console.log(`  ${result.endpoint}:`)
      result.issues.forEach(issue => console.log(`    - ${issue}`))
    })
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ No critical issues found!')
  }
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  console.log('🔍 API Documentation Validation Starting...')
  console.log('===========================================')
  
  console.log('📖 Checking documentation...')
  await checkDocumentation()
  
  console.log('🔧 Checking implementation...')
  await checkImplementation()
  
  console.log('🧪 Checking test coverage...')
  await checkTestCoverage()
  
  console.log('⚖️  Validating consistency...')
  const validationResults = validateEndpoints()
  
  generateSummary()
  generateDetailedReport(validationResults)
  
  // Export results for potential CI/CD integration
  const reportPath = path.join(projectRoot, 'coverage', 'api-docs-report.json')
  const reportDir = path.dirname(reportPath)
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: API_ENDPOINTS.length,
      implemented: API_ENDPOINTS.filter(e => e.implemented).length,
      documented: API_ENDPOINTS.filter(e => e.documented).length,
      tested: API_ENDPOINTS.filter(e => e.tested).length
    },
    endpoints: API_ENDPOINTS,
    validationResults
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Detailed report saved to: ${reportPath}`)
  
  // Exit with error code if critical issues found
  const criticalIssues = validationResults.filter(r => r.severity === 'error').length
  if (criticalIssues > 0) {
    console.log(`\n❌ Validation failed with ${criticalIssues} critical issues`)
    process.exit(1)
  } else {
    console.log('\n✅ API documentation validation passed!')
    process.exit(0)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Validation failed:', error)
    process.exit(1)
  })
}

export { main as validateApiDocs }