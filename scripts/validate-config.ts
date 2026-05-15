import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface ConfigRequirement {
  key: string
  required: boolean
  type: 'string' | 'number' | 'boolean' | 'path' | 'url'
  defaultValue?: string
  validation?: (value: string) => boolean
  description?: string
}

const requiredConfig: ConfigRequirement[] = [
  // Core Configuration
  { key: 'NODE_ENV', required: true, type: 'string', description: 'Application environment' },
  { key: 'PORT', required: true, type: 'number', defaultValue: '3001', description: 'Main server port' },
  { key: 'WEBSOCKET_PORT', required: false, type: 'number', defaultValue: '3002', description: 'WebSocket server port' },

  // Database Configuration
  { key: 'MAIN_DATABASE_PATH', required: true, type: 'path', description: 'Main database file path' },
  { key: 'AGENTS_DATABASE_PATH', required: true, type: 'path', description: 'Independent agents database path' },
  { key: 'FLOWS_DATABASE_PATH', required: true, type: 'path', description: 'Independent flows database path' },

  // LLM Providers
  { key: 'OLLAMA_HOST', required: false, type: 'url', defaultValue: 'http://localhost:11434', description: 'Ollama server URL' },
  { key: 'LM_STUDIO_HOST', required: false, type: 'url', defaultValue: 'http://localhost:1234', description: 'LM Studio server URL' },
  { key: 'VLLM_HOST', required: false, type: 'url', defaultValue: 'http://localhost:8000', description: 'vLLM server URL' },

  // Security Configuration
  { key: 'AGENT_SECURITY_SANDBOX', required: false, type: 'boolean', defaultValue: 'true', description: 'Enable agent sandboxing' },
  { key: 'AGENT_MAX_MEMORY', required: false, type: 'string', defaultValue: '512MB', description: 'Maximum memory per agent' },
  { key: 'AGENT_MAX_CPU_TIME', required: false, type: 'number', defaultValue: '60000', description: 'Maximum CPU time per agent (ms)' },

  // Workflow Engine
  { key: 'WORKFLOW_MAX_EXECUTION_TIME', required: false, type: 'number', defaultValue: '300000', description: 'Maximum workflow execution time (ms)' },
  { key: 'WORKFLOW_MAX_CONCURRENT_JOBS', required: false, type: 'number', defaultValue: '5', description: 'Maximum concurrent workflow jobs' },

  // Monitoring & Logging
  { key: 'REASONING_LOG_LEVEL', required: false, type: 'string', defaultValue: 'info', description: 'Reasoning system log level' },
  { key: 'LOG_LEVEL', required: false, type: 'string', defaultValue: 'info', description: 'General log level' },

  // Intelligence System
  { key: 'CODEGRAPH_CACHE_SIZE', required: false, type: 'number', defaultValue: '1000', description: 'CodeGraph cache size' },
  { key: 'MEMORY_GRAPH_EMBEDDING_MODEL', required: false, type: 'string', defaultValue: 'all-MiniLM-L6-v2', description: 'Memory graph embedding model' },

  // Performance
  { key: 'MAX_CONCURRENT_REQUESTS', required: false, type: 'number', defaultValue: '100', description: 'Maximum concurrent requests' },
  { key: 'REQUEST_TIMEOUT', required: false, type: 'number', defaultValue: '30000', description: 'Request timeout (ms)' }
]

function validateValue(value: string, requirement: ConfigRequirement): { valid: boolean; error?: string } {
  if (!value) {
    if (requirement.required) {
      return { valid: false, error: `Required environment variable ${requirement.key} is missing` }
    }
    return { valid: true }
  }

  switch (requirement.type) {
    case 'number':
      const num = parseInt(value)
      if (isNaN(num)) {
        return { valid: false, error: `${requirement.key} must be a valid number, got: ${value}` }
      }
      if (requirement.key.includes('PORT') && (num < 1000 || num > 65535)) {
        return { valid: false, error: `${requirement.key} must be a valid port (1000-65535), got: ${num}` }
      }
      break

    case 'boolean':
      if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        return { valid: false, error: `${requirement.key} must be a boolean (true/false), got: ${value}` }
      }
      break

    case 'path':
      const dir = path.dirname(value)
      if (!existsSync(dir)) {
        return { valid: false, error: `Directory for ${requirement.key} does not exist: ${dir}` }
      }
      break

    case 'url':
      try {
        new URL(value)
      } catch {
        return { valid: false, error: `${requirement.key} must be a valid URL, got: ${value}` }
      }
      break

    case 'string':
      if (requirement.key.includes('LOG_LEVEL')) {
        const validLevels = ['error', 'warn', 'info', 'verbose', 'debug']
        if (!validLevels.includes(value.toLowerCase())) {
          return { valid: false, error: `${requirement.key} must be one of: ${validLevels.join(', ')}, got: ${value}` }
        }
      }
      break
  }

  if (requirement.validation && !requirement.validation(value)) {
    return { valid: false, error: `${requirement.key} failed custom validation: ${value}` }
  }

  return { valid: true }
}

export function validateConfiguration(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    errors.push('Missing .env file. Copy .env.template to .env and configure.')
    return { valid: false, errors, warnings }
  }

  // Load environment variables manually if needed
  if (!process.env.NODE_ENV) {
    try {
      const envContent = readFileSync(envPath, 'utf8')
      const envLines = envContent.split('\n')
      for (const line of envLines) {
        if (line.trim() && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim()
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = value
            }
          }
        }
      }
    } catch (err) {
      errors.push(`Failed to read .env file: ${err.message}`)
      return { valid: false, errors, warnings }
    }
  }
  
  // Validate each requirement
  for (const req of requiredConfig) {
    const value = process.env[req.key]
    
    if (!value && req.required) {
      errors.push(`Missing required environment variable: ${req.key}${req.description ? ` (${req.description})` : ''}`)
      continue
    }

    if (!value && req.defaultValue) {
      warnings.push(`Using default value for ${req.key}: ${req.defaultValue}${req.description ? ` (${req.description})` : ''}`)
      continue
    }

    if (value) {
      const validation = validateValue(value, req)
      if (!validation.valid) {
        errors.push(validation.error!)
      }
    }
  }

  // Check for database directory creation
  const dbPaths = ['MAIN_DATABASE_PATH', 'AGENTS_DATABASE_PATH', 'FLOWS_DATABASE_PATH']
  for (const pathKey of dbPaths) {
    const dbPath = process.env[pathKey]
    if (dbPath) {
      const dbDir = path.dirname(dbPath)
      if (!existsSync(dbDir)) {
        warnings.push(`Database directory will be created: ${dbDir} (for ${pathKey})`)
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// CLI execution - Check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  const result = validateConfiguration()
  
  console.log('🔍 LLM-Charge Configuration Validation')
  console.log('=====================================')
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    result.warnings.forEach(warning => console.log(`  - ${warning}`))
  }
  
  if (result.valid) {
    console.log('\n✅ Configuration validation passed')
    console.log(`   Validated ${requiredConfig.length} configuration parameters`)
    process.exit(0)
  } else {
    console.log('\n❌ Configuration validation failed:')
    result.errors.forEach(error => console.log(`  - ${error}`))
    console.log('\n💡 Recommendations:')
    console.log('  - Copy .env.template to .env: cp .env.template .env')
    console.log('  - Edit .env with your specific settings')
    console.log('  - Create required directories: mkdir -p data logs')
    console.log('  - Run validation again: npm run validate-config')
    process.exit(1)
  }
}