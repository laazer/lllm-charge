/**
 * Server Configuration Schema
 *
 * Validates environment variables and configuration at startup.
 * Uses zod for schema validation with clear error messages.
 */

import { z } from 'zod'

export const ServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3001),
  databasePath: z.string().min(1).default('./data/llm-charge.db'),
  agentsDatabasePath: z.string().min(1).default('./data/agents.db'),
  flowsDatabasePath: z.string().min(1).default('./data/flows.db'),
  codegraphBin: z.string().default('/Users/jacob.brandt/.local/bin/codegraph'),
  corsOrigins: z.array(z.string()).default(['*']),
})

export const LLMProviderConfigSchema = z.object({
  ollama: z.object({
    endpoint: z.string().url().default('http://localhost:11434'),
    enabled: z.boolean().default(true),
    timeout: z.number().min(1000).default(30000),
  }).default({}),
  lmStudio: z.object({
    endpoint: z.string().url().default('http://localhost:1234'),
    enabled: z.boolean().default(true),
    timeout: z.number().min(1000).default(30000),
  }).default({}),
})

/**
 * Load and validate server configuration from environment variables.
 */
export function loadServerConfig() {
  const raw = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    databasePath: process.env.DATABASE_PATH || './data/llm-charge.db',
    agentsDatabasePath: process.env.AGENTS_DATABASE_PATH || './data/agents.db',
    flowsDatabasePath: process.env.FLOWS_DATABASE_PATH || './data/flows.db',
    codegraphBin: process.env.CODEGRAPH_BIN || '/Users/jacob.brandt/.local/bin/codegraph',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  }

  const result = ServerConfigSchema.safeParse(raw)

  if (!result.success) {
    console.error('❌ Invalid server configuration:')
    for (const issue of result.error.issues) {
      console.error(`   • ${issue.path.join('.')}: ${issue.message}`)
    }
    throw new Error('Server configuration validation failed')
  }

  return result.data
}

export function loadLLMProviderConfig() {
  const raw = {
    ollama: {
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      enabled: process.env.OLLAMA_ENABLED !== 'false',
      timeout: process.env.OLLAMA_TIMEOUT ? parseInt(process.env.OLLAMA_TIMEOUT) : 30000,
    },
    lmStudio: {
      endpoint: process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234',
      enabled: process.env.LM_STUDIO_ENABLED !== 'false',
      timeout: process.env.LM_STUDIO_TIMEOUT ? parseInt(process.env.LM_STUDIO_TIMEOUT) : 30000,
    },
  }

  const result = LLMProviderConfigSchema.safeParse(raw)

  if (!result.success) {
    console.warn('⚠️ LLM provider configuration issues:')
    for (const issue of result.error.issues) {
      console.warn(`   • ${issue.path.join('.')}: ${issue.message}`)
    }
    return LLMProviderConfigSchema.parse({}) // Return defaults
  }

  return result.data
}
