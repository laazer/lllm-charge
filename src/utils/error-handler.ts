/**
 * Comprehensive Error Handling System for LLM-Charge
 * Provides structured error handling, logging, and recovery mechanisms
 */

// Error Types and Classifications
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic',
  INTEGRATION = 'integration'
}

// Base Error Classes
export class LLMChargeError extends Error {
  public readonly errorId: string;
  public readonly timestamp: Date;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context?: Record<string, any> | null;
  public readonly userMessage?: string;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    options: {
      userMessage?: string;
      context?: Record<string, any> | null;
      recoverable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.severity = severity;
    this.category = category;
    this.context = options.context;
    this.userMessage = options.userMessage;
    this.recoverable = options.recoverable ?? true;
    this.errorId = this.generateErrorId();

    if (options.cause) {
      this.cause = options.cause;
    }

    // Ensure stack trace points to where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  private generateErrorId(): string {
    return `${this.category.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      errorId: this.errorId,
      name: this.name,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack
    };
  }
}

// Specific Error Classes
export class ValidationError extends LLMChargeError {
  constructor(message: string, fieldName?: string, value?: any) {
    super(
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Please check your input and try again.',
        context: { fieldName, value },
        recoverable: true
      }
    );
  }
}

export class DatabaseError extends LLMChargeError {
  constructor(message: string, operation?: string, query?: string) {
    super(
      message,
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      {
        userMessage: 'A database error occurred. Please try again later.',
        context: { operation, query },
        recoverable: true
      }
    );
  }
}

export class NetworkError extends LLMChargeError {
  constructor(message: string, endpoint?: string, statusCode?: number) {
    super(
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      {
        userMessage: 'Network connectivity issue. Please check your connection.',
        context: { endpoint, statusCode },
        recoverable: true
      }
    );
  }
}

export class AuthenticationError extends LLMChargeError {
  constructor(message: string, userId?: string) {
    super(
      message,
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHENTICATION,
      {
        userMessage: 'Authentication failed. Please log in again.',
        context: { userId },
        recoverable: false
      }
    );
  }
}

export class PermissionError extends LLMChargeError {
  constructor(message: string, resource?: string, action?: string) {
    super(
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.PERMISSION,
      {
        userMessage: 'You do not have permission to perform this action.',
        context: { resource, action },
        recoverable: false
      }
    );
  }
}

export class BusinessLogicError extends LLMChargeError {
  constructor(message: string, rule?: string, context?: Record<string, any>) {
    super(
      message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.BUSINESS_LOGIC,
      {
        userMessage: 'This operation is not allowed due to business rules.',
        context: { rule, ...context },
        recoverable: true
      }
    );
  }
}

export class IntegrationError extends LLMChargeError {
  constructor(message: string, service?: string, endpoint?: string) {
    super(
      message,
      ErrorSeverity.HIGH,
      ErrorCategory.INTEGRATION,
      {
        userMessage: 'External service integration failed. Please try again later.',
        context: { service, endpoint },
        recoverable: true
      }
    );
  }
}

// Error Handler Class
export class ErrorHandler {
  private readonly loggers = new Map<ErrorSeverity, (error: LLMChargeError) => void>();
  private readonly recoveryStrategies = new Map<ErrorCategory, (error: LLMChargeError) => Promise<void>>();
  private readonly errorCounts = new Map<string, number>();

  constructor() {
    this.setupDefaultLoggers();
    this.setupDefaultRecoveryStrategies();
  }

  private setupDefaultLoggers(): void {
    this.loggers.set(ErrorSeverity.LOW, (error) => {
      console.info(`[${error.severity.toUpperCase()}] ${error.name}: ${error.message}`, {
        errorId: error.errorId,
        category: error.category,
        context: error.context
      });
    });

    this.loggers.set(ErrorSeverity.MEDIUM, (error) => {
      console.warn(`[${error.severity.toUpperCase()}] ${error.name}: ${error.message}`, {
        errorId: error.errorId,
        category: error.category,
        context: error.context,
        stack: error.stack
      });
    });

    this.loggers.set(ErrorSeverity.HIGH, (error) => {
      console.error(`[${error.severity.toUpperCase()}] ${error.name}: ${error.message}`, {
        errorId: error.errorId,
        category: error.category,
        context: error.context,
        stack: error.stack
      });
    });

    this.loggers.set(ErrorSeverity.CRITICAL, (error) => {
      console.error(`[${error.severity.toUpperCase()}] CRITICAL ERROR - ${error.name}: ${error.message}`, {
        errorId: error.errorId,
        category: error.category,
        context: error.context,
        stack: error.stack,
        timestamp: error.timestamp
      });
      
      // For critical errors, also try to notify external monitoring
      this.notifyExternalMonitoring(error).catch(console.error);
    });
  }

  private setupDefaultRecoveryStrategies(): void {
    // Database error recovery
    this.recoveryStrategies.set(ErrorCategory.DATABASE, async (error) => {
      console.log(`Attempting database error recovery for: ${error.errorId}`);
      // Could implement connection retry, failover, etc.
    });

    // Network error recovery
    this.recoveryStrategies.set(ErrorCategory.NETWORK, async (error) => {
      console.log(`Attempting network error recovery for: ${error.errorId}`);
      // Could implement retry with backoff, circuit breaker reset, etc.
    });

    // Integration error recovery
    this.recoveryStrategies.set(ErrorCategory.INTEGRATION, async (error) => {
      console.log(`Attempting integration error recovery for: ${error.errorId}`);
      // Could implement service health check, failover to backup service, etc.
    });
  }

  async handleError(error: Error | LLMChargeError): Promise<void> {
    const llmError = error instanceof LLMChargeError 
      ? error 
      : this.convertToLLMChargeError(error);

    // Track error count
    this.trackError(llmError);

    // Log the error
    await this.logError(llmError);

    // Attempt recovery if applicable
    await this.attemptRecovery(llmError);
  }

  private convertToLLMChargeError(error: Error): LLMChargeError {
    return new LLMChargeError(
      error.message,
      ErrorSeverity.MEDIUM,
      ErrorCategory.SYSTEM,
      {
        context: { originalError: error.name },
        cause: error
      }
    );
  }

  private trackError(error: LLMChargeError): void {
    const key = `${error.category}_${error.name}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  private async logError(error: LLMChargeError): Promise<void> {
    const logger = this.loggers.get(error.severity);
    if (logger) {
      logger(error);
    } else {
      console.error('No logger configured for severity:', error.severity, error);
    }
  }

  private async attemptRecovery(error: LLMChargeError): Promise<void> {
    if (!error.recoverable) {
      return;
    }

    const recoveryStrategy = this.recoveryStrategies.get(error.category);
    if (recoveryStrategy) {
      try {
        await recoveryStrategy(error);
      } catch (recoveryError) {
        console.error(`Recovery failed for error ${error.errorId}:`, recoveryError);
      }
    }
  }

  private async notifyExternalMonitoring(error: LLMChargeError): Promise<void> {
    // Placeholder for external monitoring integration
    // Could integrate with Sentry, DataDog, New Relic, etc.
    console.log(`Would notify external monitoring for critical error: ${error.errorId}`);
  }

  // Public methods for error statistics and management
  getErrorCounts(): Map<string, number> {
    return new Map(this.errorCounts);
  }

  clearErrorCounts(): void {
    this.errorCounts.clear();
  }

  registerLogger(severity: ErrorSeverity, logger: (error: LLMChargeError) => void): void {
    this.loggers.set(severity, logger);
  }

  registerRecoveryStrategy(category: ErrorCategory, strategy: (error: LLMChargeError) => Promise<void>): void {
    this.recoveryStrategies.set(category, strategy);
  }
}

// Singleton instance
export const globalErrorHandler = new ErrorHandler();

// Utility functions for common error scenarios
export function handleAsyncError<T>(
  asyncFn: () => Promise<T>,
  fallbackValue?: T,
  errorCategory: ErrorCategory = ErrorCategory.SYSTEM
): Promise<T> {
  return asyncFn().catch(async (error) => {
    const llmError = error instanceof LLMChargeError 
      ? error 
      : new LLMChargeError(
          error.message || 'An unexpected error occurred',
          ErrorSeverity.MEDIUM,
          errorCategory,
          { cause: error }
        );
    
    await globalErrorHandler.handleError(llmError);
    
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw llmError;
  });
}

export function createErrorBoundary<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorCategory: ErrorCategory = ErrorCategory.SYSTEM
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const llmError = error instanceof LLMChargeError 
        ? error 
        : new LLMChargeError(
            error instanceof Error ? error.message : 'Unknown error',
            ErrorSeverity.MEDIUM,
            errorCategory,
            { cause: error instanceof Error ? error : undefined }
          );
      
      await globalErrorHandler.handleError(llmError);
      throw llmError;
    }
  };
}