/**
 * Error Helper Module for Nomina Names
 * Provides user-friendly error messages while logging technical details for debugging
 */

import { logError, logWarn, logDebug } from './logger.js';

/**
 * Error codes for structural error classification
 * These codes are used to identify structural errors that cannot be fixed by retrying
 */
export const ErrorCodes = {
  CATALOG_NOT_FOUND: 'CATALOG_NOT_FOUND',
  MISSING_REQUIRED_CATALOGS: 'MISSING_REQUIRED_CATALOGS',
  RECIPE_NOT_FOUND: 'RECIPE_NOT_FOUND',
  PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT'
};

/**
 * Error types for categorization
 */
export const ErrorType = {
  CATALOG_EMPTY: 'catalog.empty',
  CATALOG_NO_MATCH: 'catalog.no-match',
  CATALOG_NOT_FOUND: 'catalog.not-found',
  CATALOG_NO_DISTINCT: 'catalog.no-distinct',
  CATALOG_MISSING_REQUIRED: 'catalog.missing-required',
  PACKAGE_NOT_FOUND: 'package.not-found',
  PACKAGE_INVALID_FORMAT: 'package.invalid-format',
  PACKAGE_MISSING_DATA: 'package.missing-data',
  RECIPE_NOT_FOUND: 'recipe.not-found',
  RECIPE_INVALID_JSON: 'recipe.invalid-json',
  RECIPE_MISSING: 'recipe.missing',
  RECIPE_EXECUTION_FAILED: 'recipe.execution-failed',
  GENERATION_FAILED: 'generation.failed',
  GENERATION_PARTIAL: 'generation.partial',
  GENERATION_NO_COMPONENTS: 'generation.no-components',
  GENERATION_SPECIES_UNAVAILABLE: 'generation.species-unavailable',
  GENERATION_UNSUPPORTED_GENDER: 'generation.unsupported-gender',
  GENERATION_NO_SUBCATEGORIES: 'generation.no-subcategories',
  GENERATION_NO_DATA: 'generation.no-data',
  GENERATION_TEMPLATE_FAILED: 'generation.template-failed',
  // API-specific error types
  API_INVALID_LANGUAGE: 'api.invalid-language',
  API_INVALID_SPECIES: 'api.invalid-species',
  API_INVALID_GENDER: 'api.invalid-gender',
  API_INVALID_COMPONENTS: 'api.invalid-components',
  API_INVALID_FORMAT: 'api.invalid-format',
  API_INVALID_COUNT: 'api.invalid-count',
  API_INVALID_PACKAGE_CODE: 'api.invalid-package-code',
  API_INVALID_CATALOG: 'api.invalid-catalog',
  API_INVALID_TAGS: 'api.invalid-tags',
  API_MISSING_REQUIRED_PARAM: 'api.missing-required-param',
  API_MODULE_NOT_READY: 'api.module-not-ready'
};

/**
 * Mapping from ErrorType to ErrorCodes
 * Maps each ErrorType constant to its corresponding ErrorCode for structural error detection
 * NOTE: This map must be defined AFTER ErrorType since it references ErrorType constants
 */
const ErrorTypeToCodeMap = {
  [ErrorType.CATALOG_NOT_FOUND]: ErrorCodes.CATALOG_NOT_FOUND,
  [ErrorType.CATALOG_MISSING_REQUIRED]: ErrorCodes.MISSING_REQUIRED_CATALOGS,
  [ErrorType.PACKAGE_NOT_FOUND]: ErrorCodes.PACKAGE_NOT_FOUND,
  [ErrorType.RECIPE_NOT_FOUND]: ErrorCodes.RECIPE_NOT_FOUND,
  [ErrorType.PACKAGE_INVALID_FORMAT]: ErrorCodes.INVALID_FORMAT
};

/**
 * Generates a unique correlation ID for error tracking
 * @returns {string} A unique correlation ID in format: err_<timestamp>_<random>
 */
function generateCorrelationId() {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * NominaError Class - Enhanced error class with context tracking
 * Provides structured error information with correlation IDs for debugging
 */
export class NominaError extends Error {
  /**
   * Creates a new NominaError instance
   * @param {string} message - The user-friendly error message
   * @param {string} type - The error type from ErrorType enum
   * @param {Object} context - Context data for the error (e.g., catalog name, species, etc.)
   * @param {Error} [originalError] - The original technical error if any
   */
  constructor(message, type, context = {}, originalError = null) {
    super(message);
    this.name = 'NominaError';
    this.type = type;
    this.errorType = type; // Alias for backward compatibility
    this.code = ErrorTypeToCodeMap[type] || null;
    this.originalError = originalError;
    this.isNominaError = true;

    // Enhanced context with timestamp and correlation ID
    this.context = {
      ...context,
      timestamp: new Date().toISOString(),
      correlationId: generateCorrelationId()
    };

    // Maintain proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NominaError);
    }
  }

  /**
   * Returns a detailed error summary for logging
   * @returns {Object} Detailed error information
   */
  toDetailedObject() {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      context: this.context,
      correlationId: this.context.correlationId,
      timestamp: this.context.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Creates a user-friendly error with technical details logged to console
 * @param {string} errorType - The error type from ErrorType enum
 * @param {Object} context - Context data for the error (e.g., catalog name, species, etc.)
 * @param {Error} [originalError] - The original technical error if any
 * @returns {NominaError} A NominaError with user-friendly message and enhanced context
 */
export function createNominaError(errorType, context = {}, originalError = null) {
  // Get localized message
  const messageKey = `names.errors.${errorType}`;
  const hintKey = `names.errors.${errorType}-hint`;

  let userMessage = game.i18n.has(messageKey)
    ? game.i18n.format(messageKey, context)
    : `Error: ${errorType}`;

  const hint = game.i18n.has(hintKey)
    ? game.i18n.format(hintKey, context)
    : null;

  if (hint) {
    userMessage = `${userMessage}\n${hint}`;
  }

  // Log technical details to console
  logTechnicalDetails(errorType, context, originalError);

  // Create enhanced NominaError with context tracking
  const error = new NominaError(userMessage, errorType, context, originalError);

  return error;
}

/**
 * Logs technical error details to console for debugging
 * @param {string} errorType - The error type
 * @param {Object} context - Error context
 * @param {Error} [originalError] - Original error if any
 */
function logTechnicalDetails(errorType, context, originalError) {
  const debugInfo = {
    errorType,
    context,
    timestamp: new Date().toISOString()
  };

  if (originalError) {
    debugInfo.originalError = {
      message: originalError.message,
      stack: originalError.stack
    };
  }

  logError(`[NominaError] ${errorType}`, debugInfo);
}

/**
 * Extracts user-friendly message from an error (handles both Nomina and standard errors)
 *
 * NOTE: This function serves as a FALLBACK for non-Nomina errors. Since the introduction
 * of the Error Code System, all NominaErrors should already have user-friendly messages
 * via createNominaError(). This function only handles legacy errors or errors from
 * external sources that don't use the Nomina error system.
 *
 * @param {Error} error - The error to extract message from
 * @returns {string} User-friendly message
 */
export function getUserFriendlyMessage(error) {
  // NominaErrors already have properly formatted messages from createNominaError()
  if (error.isNominaError) {
    return error.message;
  }

  // Fallback for legacy/external errors: minimal string matching for common patterns
  // This should be rarely used since all new code should use createNominaError()
  const message = error.message || '';
  const lowerMessage = message.toLowerCase();

  // Map common legacy error patterns to localized messages
  if (lowerMessage.includes('catalog is empty') || lowerMessage.includes('selectionerror')) {
    return game.i18n.localize('names.errors.catalog.empty');
  }

  if (lowerMessage.includes('no candidates match') || lowerMessage.includes('filter criteria')) {
    return game.i18n.localize('names.errors.catalog.no-match');
  }

  if (lowerMessage.includes('package not found')) {
    return game.i18n.localize('names.errors.package.not-found');
  }

  if (lowerMessage.includes('recipe not found')) {
    return game.i18n.localize('names.errors.recipe.not-found');
  }

  if (lowerMessage.includes('catalog not found')) {
    const match = message.match(/catalog not found:\s*(\w+)/i);
    const catalogName = match ? match[1] : 'unknown';
    return game.i18n.format('names.errors.catalog.not-found', { catalog: catalogName });
  }

  if (lowerMessage.includes('missing required catalogs')) {
    const match = message.match(/missing required catalogs:\s*([^.]+)/i);
    const catalogNames = match ? match[1] : 'unknown';
    return game.i18n.format('names.errors.catalog.missing-required', { catalogs: catalogNames });
  }

  if (lowerMessage.includes('no suggestions could be generated') ||
      lowerMessage.includes('no names could be generated')) {
    return game.i18n.localize('names.errors.generation.failed');
  }

  if (lowerMessage.includes('no name components')) {
    return game.i18n.localize('names.errors.generation.no-components');
  }

  // Generic fallback for completely unknown errors
  return game.i18n.localize('names.errors.generation.failed');
}

/**
 * Shows a user-friendly notification for an error
 * @param {Error} error - The error to notify about
 * @param {string} [level='error'] - Notification level ('error', 'warn', 'info')
 */
export function notifyError(error, level = 'error') {
  const message = getUserFriendlyMessage(error);

  switch (level) {
    case 'warn':
      ui.notifications.warn(message);
      break;
    case 'info':
      ui.notifications.info(message);
      break;
    default:
      ui.notifications.error(message);
  }
}

/**
 * Wraps a function to catch errors and convert them to user-friendly messages
 * @param {Function} fn - The function to wrap
 * @param {Object} context - Context for error messages
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = {}) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      if (!error.isNominaError) {
        logError('Uncaught error in Nomina Names:', error);
      }
      throw error;
    }
  };
}

/**
 * Creates a validation error for API input validation
 * @param {string} errorType - The validation error type from ErrorType enum (e.g., API_INVALID_LANGUAGE)
 * @param {Object} context - Context data for the error (e.g., { value: 'xyz', allowed: ['en', 'de'] })
 * @returns {Error} A NominaError with validation details
 */
export function createValidationError(errorType, context = {}) {
  return createNominaError(errorType, context);
}

/**
 * Throws a validation error if the validation condition fails
 * @param {boolean} validation - The validation condition to check
 * @param {string} errorType - The error type to throw if validation fails
 * @param {Object} context - Context data for the error message
 * @throws {Error} Throws a NominaError if validation is false
 */
export function throwIfInvalid(validation, errorType, context = {}) {
  if (!validation) {
    throw createValidationError(errorType, context);
  }
}

/**
 * Checks if an error is a structural error that cannot be fixed by retrying
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is structural, false otherwise
 */
export function isStructuralError(error) {
  if (!error || !error.code) {
    return false;
  }
  return Object.values(ErrorCodes).includes(error.code);
}
