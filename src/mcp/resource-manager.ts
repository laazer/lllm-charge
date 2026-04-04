// MCP Resource Discovery and Management System
// FEATURE: Advanced resource management for MCP servers and clients

import { EventEmitter } from 'events'
import { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js'
import { MCPClientManager, ToolResult } from './client-tools'
import { CostTracker } from '@/utils/cost-tracker'
import path from 'path'
import fs from 'fs/promises'

export interface ResourceDiscoveryConfig {
  autoDiscovery: boolean
  discoveryInterval: number // milliseconds
  maxResourcesPerServer: number
  cacheResourceList: boolean
  enableMetrics: boolean
}

export interface ResourceMetadata {
  serverId: string
  uri: string
  name?: string
  description?: string
  mimeType?: string
  size?: number
  lastModified?: Date
  tags?: string[]
  permissions?: string[]
  cost?: number // estimated cost to access
  popularity?: number // usage frequency
}

export interface ResourceIndex {
  resources: ResourceMetadata[]
  lastUpdated: Date
  totalResources: number
  serverCount: number
  categories: Record<string, number>
}

export interface ResourceQuery {
  text?: string
  category?: string
  mimeType?: string
  server?: string
  tags?: string[]
  maxCost?: number
  sortBy?: 'relevance' | 'cost' | 'popularity' | 'date'
  limit?: number
}

export interface ResourceAccessResult {
  resource: ResourceMetadata
  content: any
  success: boolean
  cost: number
  executionTime: number
  fromCache?: boolean
}

export class MCPResourceManager extends EventEmitter {
  private resourceIndex = new Map<string, ResourceMetadata>()
  private resourceCache = new Map<string, { content: any, expires: number }>()
  private discoveryTimers = new Map<string, NodeJS.Timeout>()
  private initialized = false
  private costTracker?: CostTracker

  constructor(
    private clientManager: MCPClientManager,
    private config: ResourceDiscoveryConfig
  ) {
    super()
    
    if (config.enableMetrics) {
      this.costTracker = new CostTracker({
        providers: {},
        fallbackStrategy: 'local-first',
        maxCostPerHour: 100,
        trackUsage: true
      })
    }

    // Listen for client manager events
    this.clientManager.on('server-connected', this.onServerConnected.bind(this))
    this.clientManager.on('server-disconnected', this.onServerDisconnected.bind(this))
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    this.emit('initializing')
    
    // Initial discovery of all connected servers
    const allResources = await this.clientManager.listAvailableResources()
    for (const [serverId, resources] of Object.entries(allResources)) {
      await this.indexServerResources(serverId, resources)
    }

    this.initialized = true
    this.emit('initialized', { resourceCount: this.resourceIndex.size })
  }

  async discoverResources(serverId?: string): Promise<ResourceIndex> {
    const startTime = Date.now()
    
    try {
      const allResources = await this.clientManager.listAvailableResources(serverId)
      let totalDiscovered = 0
      
      for (const [sId, resources] of Object.entries(allResources)) {
        const discoveredCount = await this.indexServerResources(sId, resources)
        totalDiscovered += discoveredCount
        this.emit('resources-discovered', sId, discoveredCount)
      }

      const index = this.buildResourceIndex()
      const executionTime = Date.now() - startTime
      
      this.emit('discovery-complete', { 
        resourceCount: totalDiscovered, 
        executionTime 
      })
      
      return index

    } catch (error) {
      this.emit('discovery-error', error)
      throw error
    }
  }

  async searchResources(query: ResourceQuery): Promise<ResourceMetadata[]> {
    const resources = Array.from(this.resourceIndex.values())
    
    let filtered = resources.filter(resource => {
      // Text search in name and description
      if (query.text) {
        const searchText = query.text.toLowerCase()
        const resourceText = `${resource.name || ''} ${resource.description || ''}`.toLowerCase()
        if (!resourceText.includes(searchText)) return false
      }

      // Filter by server
      if (query.server && resource.serverId !== query.server) return false

      // Filter by mime type
      if (query.mimeType && resource.mimeType !== query.mimeType) return false

      // Filter by cost
      if (query.maxCost && resource.cost && resource.cost > query.maxCost) return false

      // Filter by tags
      if (query.tags && query.tags.length > 0) {
        const resourceTags = resource.tags || []
        if (!query.tags.some(tag => resourceTags.includes(tag))) return false
      }

      return true
    })

    // Sort results
    filtered = this.sortResources(filtered, query.sortBy || 'relevance', query.text)

    // Apply limit
    if (query.limit && query.limit > 0) {
      filtered = filtered.slice(0, query.limit)
    }

    return filtered
  }

  async accessResource(
    resourceUri: string, 
    useCache: boolean = true
  ): Promise<ResourceAccessResult> {
    const startTime = Date.now()
    const resource = this.resourceIndex.get(resourceUri)
    
    if (!resource) {
      throw new Error(`Resource not found: ${resourceUri}`)
    }

    // Check cache first
    if (useCache && this.resourceCache.has(resourceUri)) {
      const cached = this.resourceCache.get(resourceUri)!
      if (cached.expires > Date.now()) {
        return {
          resource,
          content: cached.content,
          success: true,
          cost: 0,
          executionTime: Date.now() - startTime,
          fromCache: true
        }
      }
    }

    try {
      const result = await this.clientManager.readResource(resource.serverId, resourceUri)
      const executionTime = Date.now() - startTime
      const cost = this.estimateResourceCost(resource)

      // Cache successful results
      if (result.success && this.config.cacheResourceList) {
        this.resourceCache.set(resourceUri, {
          content: result.content,
          expires: Date.now() + 300000 // 5 minutes
        })
      }

      // Update popularity
      resource.popularity = (resource.popularity || 0) + 1
      
      // Track costs
      if (this.costTracker) {
        this.costTracker.recordRequest({
          isLocal: true,
          cost,
          tokens: 0,
          model: `mcp-resource-${resource.serverId}`,
          latencyMs: executionTime
        })
      }

      return {
        resource,
        content: result.content,
        success: result.success,
        cost,
        executionTime,
        fromCache: false
      }

    } catch (error) {
      return {
        resource,
        content: null,
        success: false,
        cost: 0,
        executionTime: Date.now() - startTime
      }
    }
  }

  async batchAccessResources(resourceUris: string[]): Promise<ResourceAccessResult[]> {
    const promises = resourceUris.map(uri => this.accessResource(uri))
    return Promise.all(promises)
  }

  async createResourceTemplate(
    name: string,
    uri: string,
    description?: string
  ): Promise<ResourceTemplate> {
    const template: ResourceTemplate = {
      uriTemplate: uri,
      name,
      description,
      mimeType: this.inferMimeType(uri)
    }

    // Store template for future use
    this.emit('template-created', template)
    return template
  }

  getResourceStatistics(): Record<string, any> {
    const resources = Array.from(this.resourceIndex.values())
    const serverStats = new Map<string, number>()
    const mimeTypeStats = new Map<string, number>()
    const tagStats = new Map<string, number>()

    for (const resource of resources) {
      // Server statistics
      serverStats.set(resource.serverId, (serverStats.get(resource.serverId) || 0) + 1)

      // MIME type statistics
      if (resource.mimeType) {
        mimeTypeStats.set(resource.mimeType, (mimeTypeStats.get(resource.mimeType) || 0) + 1)
      }

      // Tag statistics
      if (resource.tags) {
        for (const tag of resource.tags) {
          tagStats.set(tag, (tagStats.get(tag) || 0) + 1)
        }
      }
    }

    return {
      totalResources: resources.length,
      totalCached: this.resourceCache.size,
      serverDistribution: Object.fromEntries(serverStats),
      mimeTypeDistribution: Object.fromEntries(mimeTypeStats),
      tagDistribution: Object.fromEntries(tagStats),
      averageCost: resources.reduce((sum, r) => sum + (r.cost || 0), 0) / resources.length,
      mostPopular: resources
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 10)
        .map(r => ({ uri: r.uri, name: r.name, popularity: r.popularity }))
    }
  }

  async optimizeResourceAccess(): Promise<{
    recommendations: string[]
    potentialSavings: number
    optimizedQueries: ResourceQuery[]
  }> {
    const stats = this.getResourceStatistics()
    const resources = Array.from(this.resourceIndex.values())
    
    const recommendations: string[] = []
    let potentialSavings = 0

    // Analyze access patterns
    const highCostResources = resources
      .filter(r => r.cost && r.cost > 0.01)
      .sort((a, b) => (b.cost || 0) - (a.cost || 0))

    if (highCostResources.length > 0) {
      recommendations.push(`Consider caching ${highCostResources.length} high-cost resources`)
      potentialSavings += highCostResources.reduce((sum, r) => sum + (r.cost || 0), 0) * 0.8
    }

    // Identify unused resources
    const unusedResources = resources.filter(r => !r.popularity || r.popularity < 1)
    if (unusedResources.length > 10) {
      recommendations.push(`${unusedResources.length} resources are unused and could be archived`)
    }

    // Suggest optimized queries
    const optimizedQueries: ResourceQuery[] = []
    
    if (stats.mostPopular.length > 0) {
      optimizedQueries.push({
        text: 'popular',
        sortBy: 'popularity',
        limit: 20
      })
    }

    return {
      recommendations,
      potentialSavings,
      optimizedQueries
    }
  }

  exportResourceIndex(): ResourceIndex {
    return this.buildResourceIndex()
  }

  async importResourceIndex(index: ResourceIndex): Promise<void> {
    this.resourceIndex.clear()
    
    for (const resource of index.resources) {
      this.resourceIndex.set(resource.uri, resource)
    }

    this.emit('index-imported', { resourceCount: index.resources.length })
  }

  private async onServerConnected(serverId: string): Promise<void> {
    if (this.config.autoDiscovery) {
      // Start periodic discovery for this server
      const timer = setInterval(async () => {
        try {
          await this.discoverResources(serverId)
        } catch (error) {
          this.emit('auto-discovery-error', serverId, error)
        }
      }, this.config.discoveryInterval)

      this.discoveryTimers.set(serverId, timer)
    }

    // Initial discovery
    await this.discoverResources(serverId)
  }

  private onServerDisconnected(serverId: string): void {
    // Remove server resources from index
    for (const [uri, resource] of this.resourceIndex) {
      if (resource.serverId === serverId) {
        this.resourceIndex.delete(uri)
      }
    }

    // Stop periodic discovery
    const timer = this.discoveryTimers.get(serverId)
    if (timer) {
      clearInterval(timer)
      this.discoveryTimers.delete(serverId)
    }

    this.emit('server-resources-removed', serverId)
  }

  private async indexServerResources(
    serverId: string, 
    resources: Resource[]
  ): Promise<number> {
    let indexed = 0
    
    for (const resource of resources.slice(0, this.config.maxResourcesPerServer)) {
      const metadata: ResourceMetadata = {
        serverId,
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        tags: this.extractTags(resource),
        cost: this.estimateResourceCost(resource),
        popularity: 0,
        lastModified: new Date()
      }

      this.resourceIndex.set(resource.uri, metadata)
      indexed++
    }

    return indexed
  }

  private buildResourceIndex(): ResourceIndex {
    const resources = Array.from(this.resourceIndex.values())
    const serverIds = new Set(resources.map(r => r.serverId))
    const categories = new Map<string, number>()

    for (const resource of resources) {
      const category = this.categorizeResource(resource)
      categories.set(category, (categories.get(category) || 0) + 1)
    }

    return {
      resources,
      lastUpdated: new Date(),
      totalResources: resources.length,
      serverCount: serverIds.size,
      categories: Object.fromEntries(categories)
    }
  }

  private sortResources(
    resources: ResourceMetadata[], 
    sortBy: string, 
    searchText?: string
  ): ResourceMetadata[] {
    switch (sortBy) {
      case 'cost':
        return resources.sort((a, b) => (a.cost || 0) - (b.cost || 0))
      
      case 'popularity':
        return resources.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      
      case 'date':
        return resources.sort((a, b) => 
          (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0)
        )
      
      case 'relevance':
      default:
        if (searchText) {
          return resources.sort((a, b) => 
            this.calculateRelevanceScore(b, searchText) - this.calculateRelevanceScore(a, searchText)
          )
        }
        return resources
    }
  }

  private calculateRelevanceScore(resource: ResourceMetadata, searchText: string): number {
    const text = searchText.toLowerCase()
    let score = 0
    
    if (resource.name?.toLowerCase().includes(text)) score += 10
    if (resource.description?.toLowerCase().includes(text)) score += 5
    if (resource.tags?.some(tag => tag.toLowerCase().includes(text))) score += 3
    
    // Boost popular resources
    score += (resource.popularity || 0) * 0.1
    
    return score
  }

  private extractTags(resource: Resource): string[] {
    const tags: string[] = []
    
    // Extract from URI path
    if (resource.uri) {
      const pathParts = resource.uri.split('/').filter(Boolean)
      tags.push(...pathParts.slice(-2)) // Last 2 path components
    }

    // Extract from MIME type
    if (resource.mimeType) {
      const [type, subtype] = resource.mimeType.split('/')
      tags.push(type, subtype)
    }

    return [...new Set(tags)] // Remove duplicates
  }

  private categorizeResource(resource: ResourceMetadata): string {
    if (resource.mimeType) {
      const [type] = resource.mimeType.split('/')
      return type
    }
    
    if (resource.uri.includes('api')) return 'api'
    if (resource.uri.includes('doc')) return 'documentation'
    if (resource.uri.includes('config')) return 'configuration'
    
    return 'other'
  }

  private estimateResourceCost(resource: Resource | ResourceMetadata): number {
    // Simple cost model based on estimated complexity
    let cost = 0.001 // Base cost
    
    if (resource.mimeType?.includes('image')) cost += 0.005
    if (resource.mimeType?.includes('video')) cost += 0.01
    if (resource.uri.includes('large') || resource.uri.includes('full')) cost += 0.003
    
    return cost
  }

  private inferMimeType(uri: string): string {
    const ext = path.extname(uri).toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf'
    }

    return mimeTypes[ext] || 'application/octet-stream'
  }

  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.discoveryTimers.values()) {
      clearInterval(timer)
    }
    
    this.discoveryTimers.clear()
    this.resourceIndex.clear()
    this.resourceCache.clear()
    this.initialized = false
    
    this.emit('cleanup-complete')
  }
}

export class MCPResourceOptimizer {
  constructor(private resourceManager: MCPResourceManager) {}

  async analyzeResourceUsage(timeframe: string = 'day'): Promise<{
    totalAccesses: number
    averageCost: number
    topResources: Array<{ uri: string, accesses: number, cost: number }>
    recommendations: string[]
  }> {
    const stats = this.resourceManager.getResourceStatistics()
    const optimization = await this.resourceManager.optimizeResourceAccess()
    
    return {
      totalAccesses: stats.totalResources,
      averageCost: stats.averageCost,
      topResources: stats.mostPopular.map((r: any) => ({
        uri: r.uri || 'unknown',
        accesses: r.popularity || 0,
        cost: 0.001 // placeholder
      })),
      recommendations: optimization.recommendations
    }
  }

  async suggestResourceCaching(threshold: number = 5): Promise<{
    resourcesToCached: string[]
    estimatedSavings: number
  }> {
    const stats = this.resourceManager.getResourceStatistics()
    const popular = stats.mostPopular.filter((r: any) => r.popularity >= threshold)
    
    return {
      resourcesToCached: popular.map((r: any) => r.uri),
      estimatedSavings: popular.length * 0.001 * threshold // rough estimate
    }
  }
}