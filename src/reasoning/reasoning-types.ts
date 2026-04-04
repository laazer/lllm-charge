// Reasoning provider type definitions

export interface LLMResponse {
  response: string
  provider: string
  model?: string
  cost: number
  tokens: number
  executionTime?: number
  executionTimeMs?: number
  isLocal: boolean
  error?: string
  metadata?: Record<string, any>
}

export interface ProviderCapabilities {
  reasoning: string
  codeGeneration: string
  analysis: string
  writing: string
  multiModal: boolean
  costPerInputToken: number
  costPerOutputToken: number
  maxTokens: number
  contextWindow: number
  speed: string
  strengths: string[]
  limitations: string[]
}

export interface LLMProvider {
  generateResponse(request: any): Promise<LLMResponse>
  getCapabilities(): ProviderCapabilities
}
