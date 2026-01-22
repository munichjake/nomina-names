/**
 * Centralized error handling utilities.
 * Provides consistent error logging and throwing patterns throughout the codebase.
 *
 * @module utils/error-handler
 */

import { isNullOrUndefined } from './null-checks.js';

/**
 * Error severity levels for categorization and potential filtering.
 *
 * @enum {string}
 */
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Error categories for better error classification.
 *
 * @enum {string}
 */
export const ErrorCategory = {
  VALIDATION: 'validation',
  CONFIGURATION: 'configuration',
  DATA: 'data',
  NETWORK: 'network',
  RUNTIME: 'runtime',
  UNKNOWN: 'unknown'
};

/**
 * Creates a standardized error object with additional context.
 *
 * @param {string} message - The error message
 * @param {Object} [options={}] - Additional error options
 * @param {string} [options.category] - Error category for classification
 * @param {string} [options.severity] - Error severity level
 * @param {*} [options.cause] - Original error/cause
 * @param {Object} [options.context] - Additional context data
 * @returns {Error} Enhanced error object
 *
 * @example
 * const error = createError('Failed to load data', {
 *   category: ErrorCategory.DATA,
 *   severity: ErrorSeverity.HIGH,
 *   cause: originalError,
 *   context: { filename: 'names.json' }
 * });
 */
export function createError(message, options = {}) {
  const {
    category = ErrorCategory.UNKNOWN,
    severity = ErrorSeverity.MEDIUM,
    cause = null,
    context = {}
  } = options;

  const error = new Error(message);
  error.category = category;
  error.severity = severity;
  error.cause = cause;
  error.context = context;
  error.timestamp = new Date().toISOString();

  return error;
}

/**
 * Logs an error message to console with optional context.
 * Always throws the error after logging (fail-fast principle).
 *
 * @param {string} message - The error message to log
 * @param {Error|string} [error=null] - Optional error object or message
 * @param {Object} [context={}] - Additional context for debugging
 * @throws {Error} Always throws after logging
 *
 * @example
 * logAndThrow('Configuration file not found');
 * logAndThrow('Invalid API key', error, { endpoint: '/api/names' });
 * logAndThrow('Required parameter missing', null, { param: 'count' });
 */
export function logAndThrow(message, error = null, context = {}) {
  // Build the error message with context
  let fullMessage = message;

  if (Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    fullMessage += ` [Context: ${contextStr}]`;
  }

  // Log to console with appropriate level
  console.error(`[ERROR] ${fullMessage}`);

  if (error) {
    if (error instanceof Error) {
      console.error(`[CAUSE] ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    } else if (typeof error === 'string') {
      console.error(`[DETAILS] ${error}`);
    }
  }

  // Throw the error (fail-fast)
  const throwError = error instanceof Error ? error : new Error(fullMessage);
  throw throwError;
}

/**
 * Logs a warning message without throwing.
 * Use for non-critical issues that should be brought to attention.
 *
 * @param {string} message - The warning message
 * @param {Object} [context={}] - Additional context for debugging
 *
 * @example
 * logWarning('Using default value', { parameter: 'count', default: 10 });
 * logWarning('Deprecated method called', { method: 'oldFunction', use: 'newFunction' });
 */
export function logWarning(message, context = {}) {
  let fullMessage = message;

  if (Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    fullMessage += ` [Context: ${contextStr}]`;
  }

  console.warn(`[WARNING] ${fullMessage}`);
}

/**
 * Logs an info message for debugging/monitoring.
 *
 * @param {string} message - The info message
 * @param {Object} [context={}] - Additional context
 *
 * @example
 * logInfo('Processing request', { endpoint: '/generate', count: 5 });
 */
export function logInfo(message, context = {}) {
  let fullMessage = message;

  if (Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    fullMessage += ` [Context: ${contextStr}]`;
  }

  console.info(`[INFO] ${fullMessage}`);
}

/**
 * Validates required parameters and throws if any are missing.
 * Convenience function for validating multiple parameters at once.
 *
 * @param {Object} params - Object containing parameter names and values
 * @param {string} [prefix=''] - Optional prefix for error messages
 * @throws {Error} If any required parameter is null or undefined
 *
 * @example
 * validateRequired({ name, count, gender }, 'generateNames');
 * // Throws: "Required parameter 'count' is missing in generateNames"
 */
export function validateRequired(params, prefix = '') {
  const missing = [];

  for (const [name, value] of Object.entries(params)) {
    if (isNullOrUndefined(value)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    const missingList = missing.map(n => `'${n}'`).join(', ');
    const context = prefix ? { operation: prefix } : {};
    logAndThrow(
      `Required parameter(s) ${missingList} ${prefix ? `in ${prefix}` : ''} is/are missing`,
      null,
      context
    );
  }
}

/**
 * Wraps a function with try-catch and standardized error handling.
 * Returns a new function that will catch errors and re-throw with context.
 *
 * @param {Function} fn - The function to wrap
 * @param {string} [context='Function execution'] - Context description for error messages
 * @returns {Function} Wrapped function with error handling
 *
 * @example
 * const safeLoad = withErrorHandling(loadData, 'loadData');
 * // If loadData throws, it will be re-thrown with: "Error in loadData: ..."
 */
export function withErrorHandling(fn, context = 'Function execution') {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      const message = `Error in ${context}`;
      logAndThrow(message, error, { arguments: args });
    }
  };
}

/**
 * Asserts a condition and throws if false.
 * Useful for invariant checking and defensive programming.
 *
 * @param {boolean} condition - The condition to check
 * @param {string} [message='Assertion failed'] - Error message if condition is false
 * @throws {Error} If condition is false
 *
 * @example
 * assert(count > 0, 'Count must be positive');
 * assert(result.length === expected, 'Array length mismatch');
 */
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    logAndThrow(message);
  }
}
