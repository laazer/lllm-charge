/**
 * Comprehensive test suite for the LLM-Charge error handling system
 * Tests all error classes, error handler functionality, and utility functions
 */

import { 
  LLMChargeError, 
  ValidationError, 
  DatabaseError, 
  NetworkError, 
  AuthenticationError, 
  PermissionError, 
  BusinessLogicError, 
  IntegrationError,
  ErrorSeverity, 
  ErrorCategory, 
  ErrorHandler,
  globalErrorHandler,
  handleAsyncError,
  createErrorBoundary 
} from '../../../src/utils/error-handler';

describe('LLM-Charge Error Handling System', () => {
  let errorHandler: ErrorHandler;
  let consoleSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('LLMChargeError Base Class', () => {
    it('should create a basic error with default properties', () => {
      const error = new LLMChargeError('Test error message');
      
      expect(error.message).toBe('Test error message');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.recoverable).toBe(true);
      expect(error.errorId).toMatch(/^SYSTEM_\d+_[a-zA-Z0-9]+$/);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create an error with custom properties', () => {
      const context = { userId: '123', action: 'test' };
      const error = new LLMChargeError(
        'Custom error',
        ErrorSeverity.HIGH,
        ErrorCategory.AUTHENTICATION,
        {
          userMessage: 'Custom user message',
          context,
          recoverable: false
        }
      );
      
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.userMessage).toBe('Custom user message');
      expect(error.context).toEqual(context);
      expect(error.recoverable).toBe(false);
      expect(error.errorId).toMatch(/^AUTHENTICATION_\d+_[a-zA-Z0-9]+$/);
    });

    it('should generate unique error IDs', () => {
      const error1 = new LLMChargeError('Error 1');
      const error2 = new LLMChargeError('Error 2');
      
      expect(error1.errorId).not.toBe(error2.errorId);
    });

    it('should serialize to JSON correctly', () => {
      const error = new LLMChargeError(
        'Serialization test',
        ErrorSeverity.HIGH,
        ErrorCategory.VALIDATION,
        {
          userMessage: 'User-friendly message',
          context: { field: 'test' }
        }
      );
      
      const json = error.toJSON();
      
      expect(json).toHaveProperty('errorId', error.errorId);
      expect(json).toHaveProperty('name', 'LLMChargeError');
      expect(json).toHaveProperty('message', 'Serialization test');
      expect(json).toHaveProperty('userMessage', 'User-friendly message');
      expect(json).toHaveProperty('severity', ErrorSeverity.HIGH);
      expect(json).toHaveProperty('category', ErrorCategory.VALIDATION);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('context', { field: 'test' });
      expect(json).toHaveProperty('stack');
    });
  });

  describe('Specific Error Classes', () => {
    it('should create ValidationError with correct defaults', () => {
      const error = new ValidationError('Invalid input', 'email', 'invalid-email');
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.message).toBe('Invalid input');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.userMessage).toBe('Please check your input and try again.');
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual({ fieldName: 'email', value: 'invalid-email' });
    });

    it('should create DatabaseError with correct defaults', () => {
      const error = new DatabaseError('Connection failed', 'SELECT', 'SELECT * FROM users');
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.userMessage).toBe('A database error occurred. Please try again later.');
      expect(error.context).toEqual({ operation: 'SELECT', query: 'SELECT * FROM users' });
    });

    it('should create NetworkError with correct defaults', () => {
      const error = new NetworkError('Request timeout', '/api/test', 408);
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.userMessage).toBe('Network connectivity issue. Please check your connection.');
      expect(error.context).toEqual({ endpoint: '/api/test', statusCode: 408 });
    });

    it('should create AuthenticationError with correct defaults', () => {
      const error = new AuthenticationError('Invalid token', 'user123');
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.userMessage).toBe('Authentication failed. Please log in again.');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({ userId: 'user123' });
    });

    it('should create PermissionError with correct defaults', () => {
      const error = new PermissionError('Access denied', 'users', 'delete');
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe(ErrorCategory.PERMISSION);
      expect(error.userMessage).toBe('You do not have permission to perform this action.');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({ resource: 'users', action: 'delete' });
    });

    it('should create BusinessLogicError with correct defaults', () => {
      const error = new BusinessLogicError('Invalid operation', 'age-limit', { age: 16, limit: 18 });
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.userMessage).toBe('This operation is not allowed due to business rules.');
      expect(error.context).toEqual({ rule: 'age-limit', age: 16, limit: 18 });
    });

    it('should create IntegrationError with correct defaults', () => {
      const error = new IntegrationError('Service unavailable', 'external-api', '/v1/data');
      
      expect(error).toBeInstanceOf(LLMChargeError);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.category).toBe(ErrorCategory.INTEGRATION);
      expect(error.userMessage).toBe('External service integration failed. Please try again later.');
      expect(error.context).toEqual({ service: 'external-api', endpoint: '/v1/data' });
    });
  });

  describe('ErrorHandler Class', () => {
    it('should handle LLMChargeError correctly', async () => {
      const error = new ValidationError('Test validation error');
      
      await errorHandler.handleError(error);
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEDIUM] ValidationError: Test validation error'),
        expect.objectContaining({
          errorId: error.errorId,
          category: ErrorCategory.VALIDATION
        })
      );
    });

    it('should convert regular Error to LLMChargeError', async () => {
      const regularError = new Error('Regular error message');
      
      await errorHandler.handleError(regularError);
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEDIUM] LLMChargeError: Regular error message'),
        expect.objectContaining({
          category: ErrorCategory.SYSTEM
        })
      );
    });

    it('should track error counts', async () => {
      const error1 = new ValidationError('Error 1');
      const error2 = new ValidationError('Error 2');
      const error3 = new DatabaseError('DB Error');
      
      await errorHandler.handleError(error1);
      await errorHandler.handleError(error2);
      await errorHandler.handleError(error3);
      
      const counts = errorHandler.getErrorCounts();
      expect(counts.get('validation_ValidationError')).toBe(2);
      expect(counts.get('database_DatabaseError')).toBe(1);
    });

    it('should clear error counts', async () => {
      const error = new ValidationError('Test error');
      await errorHandler.handleError(error);
      
      expect(errorHandler.getErrorCounts().size).toBeGreaterThan(0);
      
      errorHandler.clearErrorCounts();
      
      expect(errorHandler.getErrorCounts().size).toBe(0);
    });

    it('should register custom loggers', async () => {
      const customLogger = jest.fn();
      errorHandler.registerLogger(ErrorSeverity.HIGH, customLogger);
      
      const error = new DatabaseError('Test database error');
      await errorHandler.handleError(error);
      
      expect(customLogger).toHaveBeenCalledWith(error);
    });

    it('should register custom recovery strategies', async () => {
      const recoveryStrategy = jest.fn().mockResolvedValue(undefined);
      errorHandler.registerRecoveryStrategy(ErrorCategory.DATABASE, recoveryStrategy);
      
      const error = new DatabaseError('Test database error');
      await errorHandler.handleError(error);
      
      expect(recoveryStrategy).toHaveBeenCalledWith(error);
    });

    it('should not attempt recovery for non-recoverable errors', async () => {
      const recoveryStrategy = jest.fn();
      errorHandler.registerRecoveryStrategy(ErrorCategory.AUTHENTICATION, recoveryStrategy);
      
      const error = new AuthenticationError('Invalid credentials');
      await errorHandler.handleError(error);
      
      expect(recoveryStrategy).not.toHaveBeenCalled();
    });

    it('should handle recovery strategy failures gracefully', async () => {
      const failingRecoveryStrategy = jest.fn().mockRejectedValue(new Error('Recovery failed'));
      errorHandler.registerRecoveryStrategy(ErrorCategory.NETWORK, failingRecoveryStrategy);
      
      const error = new NetworkError('Connection failed');
      
      await expect(errorHandler.handleError(error)).resolves.not.toThrow();
      expect(failingRecoveryStrategy).toHaveBeenCalled();
    });
  });

  describe('Error Severity Logging', () => {
    it('should log LOW severity errors with console.info', async () => {
      const infoSpy = jest.spyOn(console, 'info');
      const error = new LLMChargeError('Low priority error', ErrorSeverity.LOW);
      
      await errorHandler.handleError(error);
      
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LOW]'),
        expect.objectContaining({ errorId: error.errorId })
      );
    });

    it('should log MEDIUM severity errors with console.warn', async () => {
      const warnSpy = jest.spyOn(console, 'warn');
      const error = new LLMChargeError('Medium priority error', ErrorSeverity.MEDIUM);
      
      await errorHandler.handleError(error);
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MEDIUM]'),
        expect.objectContaining({ errorId: error.errorId })
      );
    });

    it('should log HIGH severity errors with console.error', async () => {
      const error = new LLMChargeError('High priority error', ErrorSeverity.HIGH);
      
      await errorHandler.handleError(error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HIGH]'),
        expect.objectContaining({ errorId: error.errorId })
      );
    });

    it('should log CRITICAL severity errors with enhanced details', async () => {
      const error = new LLMChargeError('Critical error', ErrorSeverity.CRITICAL);
      
      await errorHandler.handleError(error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL] CRITICAL ERROR'),
        expect.objectContaining({ 
          errorId: error.errorId,
          timestamp: error.timestamp
        })
      );
    });
  });

  describe('Utility Functions', () => {
    describe('handleAsyncError', () => {
      it('should return result from successful async function', async () => {
        const successfulFn = async () => 'success';
        
        const result = await handleAsyncError(successfulFn);
        
        expect(result).toBe('success');
      });

      it('should return fallback value on error', async () => {
        const failingFn = async () => {
          throw new Error('Function failed');
        };
        
        const result = await handleAsyncError(failingFn, 'fallback');
        
        expect(result).toBe('fallback');
      });

      it('should throw error if no fallback provided', async () => {
        const failingFn = async () => {
          throw new ValidationError('Validation failed');
        };
        
        await expect(handleAsyncError(failingFn)).rejects.toThrow(ValidationError);
      });

      it('should convert regular errors to LLMChargeError', async () => {
        const failingFn = async () => {
          throw new Error('Regular error');
        };
        
        try {
          await handleAsyncError(failingFn);
          fail('Expected error to be thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(LLMChargeError);
          const e = error as LLMChargeError;
          expect(e.message).toBe('Regular error');
          expect(e.category).toBe(ErrorCategory.SYSTEM);
        }
      });

      it('should use specified error category', async () => {
        const failingFn = async () => {
          throw new Error('Database connection failed');
        };
        
        try {
          await handleAsyncError(failingFn, undefined, ErrorCategory.DATABASE);
          fail('Expected error to be thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(LLMChargeError);
          expect((error as LLMChargeError).category).toBe(ErrorCategory.DATABASE);
        }
      });
    });

    describe('createErrorBoundary', () => {
      it('should return result from successful function', async () => {
        const successfulFn = async (arg: string) => `Hello ${arg}`;
        const boundaryFn = createErrorBoundary(successfulFn);
        
        const result = await boundaryFn('World');
        
        expect(result).toBe('Hello World');
      });

      it('should throw LLMChargeError on function failure', async () => {
        const failingFn = async (arg: string) => {
          throw new Error(`Failed with ${arg}`);
        };
        const boundaryFn = createErrorBoundary(failingFn, ErrorCategory.VALIDATION);
        
        await expect(boundaryFn('test')).rejects.toThrow(LLMChargeError);
      });

      it('should preserve LLMChargeError instances', async () => {
        const originalError = new ValidationError('Original validation error');
        const failingFn = async () => {
          throw originalError;
        };
        const boundaryFn = createErrorBoundary(failingFn);
        
        await expect(boundaryFn()).rejects.toBe(originalError);
      });

      it('should convert regular errors with specified category', async () => {
        const failingFn = async () => {
          throw new Error('Regular error');
        };
        const boundaryFn = createErrorBoundary(failingFn, ErrorCategory.NETWORK);
        
        try {
          await boundaryFn();
          fail('Expected error to be thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(LLMChargeError);
          expect((error as LLMChargeError).category).toBe(ErrorCategory.NETWORK);
        }
      });

      it('should handle function with multiple arguments', async () => {
        const fn = async (a: number, b: number, c: string) => `${a + b} ${c}`;
        const boundaryFn = createErrorBoundary(fn);
        
        const result = await boundaryFn(2, 3, 'test');
        
        expect(result).toBe('5 test');
      });
    });
  });

  describe('Global Error Handler', () => {
    it('should be an instance of ErrorHandler', () => {
      expect(globalErrorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should be a singleton instance', () => {
      // Import globalErrorHandler multiple times to ensure it's the same instance
      const { globalErrorHandler: instance1 } = require('../../../src/utils/error-handler');
      const { globalErrorHandler: instance2 } = require('../../../src/utils/error-handler');
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(globalErrorHandler);
    });
  });

  describe('Error Context and Metadata', () => {
    it('should preserve error stack trace', () => {
      const error = new ValidationError('Test error with stack');
      
      expect(error.stack).toContain('ValidationError');
      expect(error.stack).toContain('Test error with stack');
    });

    it('should set cause property when provided', () => {
      const originalError = new Error('Original error');
      const error = new LLMChargeError(
        'Wrapper error',
        ErrorSeverity.HIGH,
        ErrorCategory.SYSTEM,
        { cause: originalError }
      );
      
      expect(error.cause).toBe(originalError);
    });

    it('should handle complex context objects', () => {
      const complexContext = {
        user: { id: '123', name: 'Test User' },
        request: { method: 'POST', url: '/api/test' },
        metadata: { timestamp: new Date(), version: '1.0.0' }
      };
      
      const error = new LLMChargeError(
        'Complex context error',
        ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        { context: complexContext }
      );
      
      expect(error.context).toEqual(complexContext);
      expect(error.toJSON().context).toEqual(complexContext);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle undefined error messages gracefully', () => {
      // @ts-expect-error: Testing edge case with undefined message
      const error = new LLMChargeError(undefined);
      
      // Native Error coerces undefined message to empty string
      expect(error.message).toBe('');
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle null context gracefully', () => {
      const error = new LLMChargeError(
        'Null context error',
        ErrorSeverity.LOW,
        ErrorCategory.SYSTEM,
        { context: null }
      );
      
      expect(error.context).toBeNull();
    });

    it('should handle error handler with no registered logger', async () => {
      const customHandler = new ErrorHandler();
      const error = new LLMChargeError('Test error');
      
      // Clear all loggers
      customHandler.registerLogger(ErrorSeverity.LOW, () => {});
      customHandler.registerLogger(ErrorSeverity.MEDIUM, () => {});
      customHandler.registerLogger(ErrorSeverity.HIGH, () => {});
      customHandler.registerLogger(ErrorSeverity.CRITICAL, () => {});
      
      // This should not throw
      await expect(customHandler.handleError(error)).resolves.not.toThrow();
    });
  });
});