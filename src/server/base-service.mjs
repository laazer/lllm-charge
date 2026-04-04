/**
 * Base service class following DRY principles
 * Provides common functionality for all services
 */
export class BaseService {
  constructor() {
    this.startTime = Date.now()
    this.isInitialized = false
  }

  /**
   * Common initialization pattern
   */
  async initialize() {
    try {
      await this.setup()
      this.isInitialized = true
      console.log(`✅ ${this.constructor.name} initialized successfully`)
      return true
    } catch (error) {
      console.error(`❌ ${this.constructor.name} initialization failed:`, error)
      this.isInitialized = false
      return false
    }
  }

  /**
   * Override in subclasses
   */
  async setup() {
    // Base implementation
  }

  /**
   * Common cleanup pattern
   */
  async cleanup() {
    try {
      await this.teardown()
      this.isInitialized = false
      console.log(`✅ ${this.constructor.name} cleaned up`)
    } catch (error) {
      console.error(`❌ ${this.constructor.name} cleanup failed:`, error)
    }
  }

  /**
   * Override in subclasses
   */
  async teardown() {
    // Base implementation
  }

  /**
   * Common uptime calculation
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }

  /**
   * Common validation pattern
   */
  validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field])
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
  }

  /**
   * Common ID generation pattern
   */
  generateId(prefix = '') {
    return prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Common error handling wrapper
   */
  async safeExecute(operation, fallback = null) {
    try {
      return await operation()
    } catch (error) {
      console.warn(`Safe execution failed: ${error.message}`)
      return fallback
    }
  }

  /**
   * Common response formatting
   */
  formatResponse(data, success = true, message = null) {
    return {
      success,
      data,
      message,
      timestamp: new Date().toISOString()
    }
  }
}

export default BaseService