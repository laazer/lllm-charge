// MCP Tool Execution and Validation System
// FEATURE: Advanced validation, security, and execution controls for MCP tools

import { Tool, CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { EventEmitter } from 'events'
import Ajv, { JSONSchemaType } from 'ajv'
import addFormats from 'ajv-formats'
import { CostTracker } from '@/utils/cost-tracker'

export interface ValidationRule {
  name: string
  description: string
  type: 'schema' | 'custom' | 'security' | 'cost' | 'rate_limit'
  severity: 'error' | 'warning' | 'info'
  condition: (args: any, context?: ValidationContext) => boolean | Promise<boolean>
  message?: string
}

export interface ValidationContext {
  toolName: string
  serverId: string
  userId?: string
  sessionId?: string
  assistant: 'claude' | 'cursor' | 'other'
  previousCalls?: number
  currentCost?: number
  timeWindow?: number // minutes
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    rule: string
    severity: 'error' | 'warning' | 'info'
    message: string
    field?: string
  }>
  warnings: Array<{
    rule: string
    message: string
    field?: string
  }>
  cost?: number
  executionTime?: number
}

export interface ExecutionPolicy {
  maxExecutionTime: number // milliseconds
  maxCostPerCall: number
  maxCallsPerMinute: number
  maxCallsPerHour: number
  allowedAssistants?: string[]
  blockedTools?: string[]
  requiresApproval?: boolean
  sandboxed?: boolean
}

export interface ToolMetrics {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  averageExecutionTime: number
  averageCost: number
  lastUsed: Date
  popularArgs: Record<string, number>
  errorPatterns: Array<{ pattern: string, count: number }>
}

export class MCPToolValidator extends EventEmitter {
  private ajv: Ajv
  private validationRules = new Map<string, ValidationRule[]>()
  private globalRules: ValidationRule[] = []
  private toolMetrics = new Map<string, ToolMetrics>()
  private rateLimits = new Map<string, { calls: number[], windowStart: number }>()
  private costTracker?: CostTracker

  constructor(private executionPolicy: ExecutionPolicy) {
    super()
    
    this.ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(this.ajv)
    
    if (executionPolicy.maxCostPerCall > 0) {
      this.costTracker = new CostTracker({
        providers: {},
        fallbackStrategy: 'local-first',
        maxCostPerHour: 100,
        trackUsage: true
      })
    }

    this.initializeBuiltInRules()
  }

  async validateToolCall(
    tool: Tool,
    args: any,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    }

    try {
      // Schema validation
      await this.validateSchema(tool, args, result)
      
      // Global rules validation
      await this.validateRules(this.globalRules, args, context, result)
      
      // Tool-specific rules validation
      const toolRules = this.validationRules.get(tool.name) || []
      await this.validateRules(toolRules, args, context, result)
      
      // Policy validation
      await this.validateExecutionPolicy(tool, args, context, result)
      
      // Rate limiting
      await this.validateRateLimit(tool.name, context, result)

      // Cost estimation
      result.cost = this.estimateToolCost(tool, args, context)
      
      result.executionTime = Date.now() - startTime
      result.valid = result.errors.length === 0

      this.emit('validation-complete', tool.name, result)
      
      return result

    } catch (error) {
      result.valid = false
      result.errors.push({
        rule: 'validation-error',
        severity: 'error',
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
      })
      
      return result
    }
  }

  addValidationRule(toolName: string | '*', rule: ValidationRule): void {
    if (toolName === '*') {
      this.globalRules.push(rule)
    } else {
      if (!this.validationRules.has(toolName)) {
        this.validationRules.set(toolName, [])
      }
      this.validationRules.get(toolName)!.push(rule)
    }

    this.emit('rule-added', toolName, rule.name)
  }

  removeValidationRule(toolName: string | '*', ruleName: string): void {
    if (toolName === '*') {
      this.globalRules = this.globalRules.filter(r => r.name !== ruleName)
    } else {
      const rules = this.validationRules.get(toolName)
      if (rules) {
        this.validationRules.set(toolName, rules.filter(r => r.name !== ruleName))
      }
    }
  }

  async preExecutionCheck(
    tool: Tool,
    args: any,
    context: ValidationContext
  ): Promise<{ allowed: boolean, reason?: string }> {
    const validation = await this.validateToolCall(tool, args, context)
    
    if (!validation.valid) {
      const errors = validation.errors.filter(e => e.severity === 'error')
      return {
        allowed: false,
        reason: errors.map(e => e.message).join('; ')
      }
    }

    if (this.executionPolicy.requiresApproval) {
      return {
        allowed: false,
        reason: 'Tool requires manual approval'
      }
    }

    return { allowed: true }
  }

  recordToolExecution(
    toolName: string,
    args: any,
    result: CallToolResult,
    executionTime: number,
    cost: number
  ): void {
    let metrics = this.toolMetrics.get(toolName)
    
    if (!metrics) {
      metrics = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        averageCost: 0,
        lastUsed: new Date(),
        popularArgs: {},
        errorPatterns: []
      }
      this.toolMetrics.set(toolName, metrics)
    }

    // Update metrics
    metrics.totalCalls++
    if (result.isError) {
      metrics.failedCalls++
    } else {
      metrics.successfulCalls++
    }
    
    metrics.lastUsed = new Date()
    metrics.averageExecutionTime = (metrics.averageExecutionTime * (metrics.totalCalls - 1) + executionTime) / metrics.totalCalls
    metrics.averageCost = (metrics.averageCost * (metrics.totalCalls - 1) + cost) / metrics.totalCalls

    // Track popular arguments
    this.trackPopularArgs(metrics.popularArgs, args)

    // Track error patterns
    if (result.isError) {
      this.trackErrorPattern(metrics.errorPatterns, result)
    }

    this.emit('execution-recorded', toolName, metrics)
  }

  getToolMetrics(toolName?: string): Record<string, ToolMetrics> {
    if (toolName) {
      const metrics = this.toolMetrics.get(toolName)
      return metrics ? { [toolName]: metrics } : {}
    }

    return Object.fromEntries(this.toolMetrics)
  }

  generateSecurityReport(): {
    highRiskTools: string[]
    suspiciousPatterns: Array<{ tool: string, pattern: string, frequency: number }>
    policyViolations: Array<{ tool: string, violation: string, count: number }>
    recommendations: string[]
  } {
    const highRiskTools: string[] = []
    const suspiciousPatterns: Array<{ tool: string, pattern: string, frequency: number }> = []
    const policyViolations: Array<{ tool: string, violation: string, count: number }> = []
    const recommendations: string[] = []

    for (const [toolName, metrics] of this.toolMetrics) {
      // High failure rate indicates risk
      const failureRate = metrics.failedCalls / metrics.totalCalls
      if (failureRate > 0.3) {
        highRiskTools.push(toolName)
      }

      // High cost tools need monitoring
      if (metrics.averageCost > this.executionPolicy.maxCostPerCall * 0.8) {
        recommendations.push(`Consider optimizing ${toolName} - high average cost: $${metrics.averageCost.toFixed(4)}`)
      }

      // Identify error patterns
      for (const errorPattern of metrics.errorPatterns) {
        if (errorPattern.count > 5) {
          suspiciousPatterns.push({
            tool: toolName,
            pattern: errorPattern.pattern,
            frequency: errorPattern.count
          })
        }
      }
    }

    return {
      highRiskTools,
      suspiciousPatterns,
      policyViolations,
      recommendations
    }
  }

  optimizeValidationRules(): {
    removedRules: string[]
    modifiedRules: string[]
    suggestions: string[]
  } {
    const removedRules: string[] = []
    const modifiedRules: string[] = []
    const suggestions: string[] = []

    // Analyze rule effectiveness
    for (const [toolName, metrics] of this.toolMetrics) {
      const rules = this.validationRules.get(toolName) || []
      
      // Remove rules that never trigger
      for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i]
        if (rule.severity === 'warning' && metrics.totalCalls > 100) {
          // Could track rule trigger frequency and remove unused ones
          // For now, just suggest optimization
          suggestions.push(`Consider reviewing rule '${rule.name}' for ${toolName} - may be redundant`)
        }
      }

      // Suggest new rules based on common errors
      for (const errorPattern of metrics.errorPatterns) {
        if (errorPattern.count > 10) {
          suggestions.push(`Consider adding validation rule for ${toolName} to prevent: ${errorPattern.pattern}`)
        }
      }
    }

    return {
      removedRules,
      modifiedRules,
      suggestions
    }
  }

  private async validateSchema(tool: Tool, args: any, result: ValidationResult): Promise<void> {
    if (!tool.inputSchema) return

    try {
      const valid = this.ajv.validate(tool.inputSchema, args)
      
      if (!valid && this.ajv.errors) {
        for (const error of this.ajv.errors) {
          result.errors.push({
            rule: 'schema-validation',
            severity: 'error',
            message: `${error.instancePath || 'root'}: ${error.message}`,
            field: error.instancePath
          })
        }
      }
    } catch (error) {
      result.errors.push({
        rule: 'schema-validation',
        severity: 'error',
        message: `Schema validation error: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  private async validateRules(
    rules: ValidationRule[],
    args: any,
    context: ValidationContext,
    result: ValidationResult
  ): Promise<void> {
    for (const rule of rules) {
      try {
        const isValid = await rule.condition(args, context)
        
        if (!isValid) {
          const error = {
            rule: rule.name,
            severity: rule.severity,
            message: rule.message || `Validation rule '${rule.name}' failed`
          }

          if (rule.severity === 'error') {
            result.errors.push(error)
          } else {
            result.warnings.push(error)
          }
        }
      } catch (error) {
        result.errors.push({
          rule: rule.name,
          severity: 'error',
          message: `Rule evaluation error: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }
  }

  private async validateExecutionPolicy(
    tool: Tool,
    args: any,
    context: ValidationContext,
    result: ValidationResult
  ): Promise<void> {
    // Check blocked tools
    if (this.executionPolicy.blockedTools?.includes(tool.name)) {
      result.errors.push({
        rule: 'execution-policy',
        severity: 'error',
        message: `Tool ${tool.name} is blocked by execution policy`
      })
    }

    // Check allowed assistants
    if (this.executionPolicy.allowedAssistants && 
        !this.executionPolicy.allowedAssistants.includes(context.assistant)) {
      result.errors.push({
        rule: 'execution-policy',
        severity: 'error',
        message: `Assistant ${context.assistant} not allowed to use this tool`
      })
    }

    // Check cost limits
    const estimatedCost = this.estimateToolCost(tool, args, context)
    if (estimatedCost > this.executionPolicy.maxCostPerCall) {
      result.errors.push({
        rule: 'execution-policy',
        severity: 'error',
        message: `Estimated cost $${estimatedCost.toFixed(4)} exceeds limit $${this.executionPolicy.maxCostPerCall.toFixed(4)}`
      })
    }
  }

  private async validateRateLimit(
    toolName: string,
    context: ValidationContext,
    result: ValidationResult
  ): Promise<void> {
    const now = Date.now()
    const key = `${context.userId || 'anonymous'}:${toolName}`
    
    let rateLimitData = this.rateLimits.get(key)
    if (!rateLimitData) {
      rateLimitData = { calls: [], windowStart: now }
      this.rateLimits.set(key, rateLimitData)
    }

    // Clean old calls outside window
    const minuteWindow = now - 60000
    const hourWindow = now - 3600000
    
    rateLimitData.calls = rateLimitData.calls.filter(call => call > hourWindow)

    // Check minute limit
    const callsLastMinute = rateLimitData.calls.filter(call => call > minuteWindow).length
    if (callsLastMinute >= this.executionPolicy.maxCallsPerMinute) {
      result.errors.push({
        rule: 'rate-limit',
        severity: 'error',
        message: `Rate limit exceeded: ${callsLastMinute} calls in last minute (limit: ${this.executionPolicy.maxCallsPerMinute})`
      })
    }

    // Check hour limit  
    if (rateLimitData.calls.length >= this.executionPolicy.maxCallsPerHour) {
      result.errors.push({
        rule: 'rate-limit',
        severity: 'error',
        message: `Rate limit exceeded: ${rateLimitData.calls.length} calls in last hour (limit: ${this.executionPolicy.maxCallsPerHour})`
      })
    }

    // Record this call
    rateLimitData.calls.push(now)
  }

  private estimateToolCost(tool: Tool, args: any, context: ValidationContext): number {
    // Basic cost model - could be enhanced with real pricing data
    let cost = 0.001 // Base cost per tool call
    
    // Add complexity-based cost
    const argCount = Object.keys(args).length
    cost += argCount * 0.0001
    
    // Add assistant-specific multiplier
    const assistantMultipliers: Record<string, number> = {
      claude: 1.2,
      cursor: 1.0,
      other: 1.1
    }
    cost *= assistantMultipliers[context.assistant] || 1.0

    // Tool-specific cost adjustments
    if (tool.name.includes('reasoning')) cost *= 2.0
    if (tool.name.includes('search')) cost *= 1.5
    if (tool.name.includes('memory')) cost *= 1.3

    return cost
  }

  private trackPopularArgs(popularArgs: Record<string, number>, args: any): void {
    for (const [key, value] of Object.entries(args)) {
      const argKey = `${key}:${typeof value === 'object' ? 'object' : String(value).slice(0, 50)}`
      popularArgs[argKey] = (popularArgs[argKey] || 0) + 1
    }
  }

  private trackErrorPattern(errorPatterns: Array<{ pattern: string, count: number }>, result: CallToolResult): void {
    if (!result.content || result.content.length === 0) return
    
    const errorText = result.content[0].type === 'text' ? result.content[0].text : 'unknown'
    const pattern = this.extractErrorPattern(errorText)
    
    const existing = errorPatterns.find(p => p.pattern === pattern)
    if (existing) {
      existing.count++
    } else {
      errorPatterns.push({ pattern, count: 1 })
    }
  }

  private extractErrorPattern(errorText: string): string {
    // Extract common error patterns
    if (errorText.includes('timeout')) return 'timeout'
    if (errorText.includes('permission')) return 'permission_denied'
    if (errorText.includes('not found')) return 'not_found'
    if (errorText.includes('invalid')) return 'invalid_input'
    if (errorText.includes('connection')) return 'connection_error'
    
    // Return first 100 chars as fallback pattern
    return errorText.slice(0, 100)
  }

  private initializeBuiltInRules(): void {
    // Security rules
    this.addValidationRule('*', {
      name: 'no-sensitive-data',
      description: 'Prevent sensitive data in arguments',
      type: 'security',
      severity: 'error',
      condition: (args) => {
        const argsStr = JSON.stringify(args).toLowerCase()
        const sensitivePatterns = ['password', 'secret', 'key', 'token', 'credential']
        return !sensitivePatterns.some(pattern => argsStr.includes(pattern))
      },
      message: 'Arguments may contain sensitive data'
    })

    // Cost control rules
    this.addValidationRule('*', {
      name: 'reasonable-string-length',
      description: 'Prevent excessively long string arguments',
      type: 'cost',
      severity: 'warning',
      condition: (args) => {
        for (const value of Object.values(args)) {
          if (typeof value === 'string' && value.length > 10000) {
            return false
          }
        }
        return true
      },
      message: 'String argument exceeds reasonable length (10,000 chars)'
    })

    // Performance rules
    this.addValidationRule('*', {
      name: 'max-array-size',
      description: 'Prevent large array arguments',
      type: 'custom',
      severity: 'warning',
      condition: (args) => {
        for (const value of Object.values(args)) {
          if (Array.isArray(value) && value.length > 1000) {
            return false
          }
        }
        return true
      },
      message: 'Array argument exceeds reasonable size (1,000 items)'
    })
  }
}