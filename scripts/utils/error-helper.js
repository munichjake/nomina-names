/**
 * Error Helper Module for Nomina Names
 * Provides user-friendly error messages while logging technical details for debugging
 */

import { logError, logWarn, logDebug } from './logger.js';

/**
 * Error types for categorization
 */
export const ErrorType = {
  CATALOG_EMPTY: 'catalog.empty',
  CATALOG_NO_MATCH: 'catalog.no-match',
  CATALOG_NOT_FOUND: 'catalog.not-found',
  CATALOG_NO_DISTINCT: 'catalog.no-distinct',
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
  GENERATION_TEMPLATE_FAILED: 'generation.template-failed'
};

/**
 * Creates a user-friendly error with technical details logged to console
 * @param {string} errorType - The error type from ErrorType enum
 * @param {Object} context - Context data for the error (e.g., catalog name, species, etc.)
 * @param {Error} [originalError] - The original technical error if any
 * @returns {Error} An error with user-friendly message
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

  // Create error with user-friendly message
  const error = new Error(userMessage);
  error.name = 'NominaError';
  error.errorType = errorType;
  error.context = context;
  error.originalError = originalError;
  error.isNominaError = true;

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
 * @param {Error} error - The error to extract message from
 * @returns {string} User-friendly message
 */
export function getUserFriendlyMessage(error) {
  if (error.isNominaError) {
    return error.message;
  }

  // Try to map common error patterns to friendly messages
  const message = error.message || '';

  if (message.includes('Catalog is empty') || message.includes('SelectionError: Catalog is empty')) {
    return game.i18n.localize('names.errors.catalog.empty');
  }

  if (message.includes('No candidates match') || message.includes('filter criteria')) {
    return game.i18n.localize('names.errors.catalog.no-match');
  }

  if (message.includes('Package not found')) {
    return game.i18n.localize('names.errors.package.not-found');
  }

  if (message.includes('Recipe not found')) {
    return game.i18n.localize('names.errors.recipe.not-found');
  }

  if (message.includes('No suggestions could be generated') || message.includes('No names could be generated')) {
    return game.i18n.localize('names.errors.generation.failed');
  }

  if (message.includes('No name components')) {
    return game.i18n.localize('names.errors.generation.no-components');
  }

  // Fallback to generic error
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
