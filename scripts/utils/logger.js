/**
 * Logging utility for the Names module
 */

import { MODULE_ID } from '../shared/constants.js';

// Log levels (hierarchical - higher numbers include lower levels)
export const LOG_LEVELS = {
  ERROR: 0,   // Only errors
  WARN: 1,    // Warnings and errors
  INFO: 2,    // Info, warnings, and errors
  DEBUG: 3    // Everything including debug info
};

// Current log level (cached for performance)
let currentLogLevel = LOG_LEVELS.INFO;

/**
 * Updates the cached log level from settings
 * Should be called when log level setting changes
 */
export function updateLogLevel() {
  try {
    const settingValue = game.settings.get(MODULE_ID, "logLevel");
    // Setting is now stored as number directly
    currentLogLevel = (typeof settingValue === 'number') ? settingValue : LOG_LEVELS.INFO;
  } catch (error) {
    // Fallback if setting doesn't exist yet
    currentLogLevel = LOG_LEVELS.INFO;
  }
  console.warn(`Names | Log level set to ${getLogLevelName(currentLogLevel)} (${currentLogLevel})`);
}

/**
 * Creates a formatted prefix for log messages
 * @param {string} modulePrefix - The module name or custom prefix
 * @returns {string} Formatted prefix
 */
function createLogPrefix(modulePrefix = null) {
  if (modulePrefix && modulePrefix !== "Names") {
    return `${modulePrefix} via Names |`;
  }
  return "Names |";
}

/**
 * Central logging function
 * @param {number} level - Log level (use LOG_LEVELS constants)
 * @param {string} message - Message to log
 * @param {Object|Error} data - Optional data object or error
 * @param {Object} options - Optional formatting options
 */
export function log(level, message, data = null, options = {}) {
  // Skip if level is higher than current setting
  if (level > currentLogLevel) {
    return;
  }

  const { 
    prefix = null,
    modulePrefix = null,
    localize = false,
    params = null 
  } = options;

  // Prepare message
  let finalMessage = message;
  
  if (localize) {
    try {
      finalMessage = params ? 
        game.i18n.format(`names.${message}`, params) : 
        game.i18n.localize(`names.${message}`);
    } catch (e) {
      finalMessage = message; // Fallback if localization fails
    }
  }

  // Use custom prefix or create formatted prefix
  const logPrefix = prefix || createLogPrefix(modulePrefix);
  const prefixedMessage = `${logPrefix} ${finalMessage}`;

  // Choose appropriate console method based on level
  switch (level) {
    case LOG_LEVELS.ERROR:
      if (data instanceof Error) {
        console.error(prefixedMessage, data);
      } else if (data) {
        console.error(prefixedMessage, data);
      } else {
        console.error(prefixedMessage);
      }
      break;
      
    case LOG_LEVELS.WARN:
      if (data) {
        console.warn(prefixedMessage, data);
      } else {
        console.warn(prefixedMessage);
      }
      break;
      
    case LOG_LEVELS.INFO:
      if (data) {
        console.log(prefixedMessage, data);
      } else {
        console.log(prefixedMessage);
      }
      break;
      
    case LOG_LEVELS.DEBUG:
      if (data) {
        console.debug(prefixedMessage, data);
      } else {
        console.debug(prefixedMessage);
      }
      break;
  }
}

/**
 * Convenience functions for different log levels
 * These functions provide easier access to logging without specifying level constants
 */

export function logError(message, error = null, options = {}) {
  log(LOG_LEVELS.ERROR, message, error, options);
}

export function logWarn(message, data = null, options = {}) {
  log(LOG_LEVELS.WARN, message, data, options);
}

export function logInfo(message, data = null, options = {}) {
  log(LOG_LEVELS.INFO, message, data, options);
}

export function logDebug(message, data = null, options = {}) {
  log(LOG_LEVELS.DEBUG, message, data, options);
}

/**
 * Localized logging functions (automatically set localize option)
 * These functions automatically translate message keys using game.i18n
 */

export function logErrorL(messageKey, error = null, params = null, modulePrefix = null) {
  log(LOG_LEVELS.ERROR, messageKey, error, { localize: true, params, modulePrefix });
}

export function logWarnL(messageKey, data = null, params = null, modulePrefix = null) {
  log(LOG_LEVELS.WARN, messageKey, data, { localize: true, params, modulePrefix });
}

export function logInfoL(messageKey, data = null, params = null, modulePrefix = null) {
  log(LOG_LEVELS.INFO, messageKey, data, { localize: true, params, modulePrefix });
}

export function logDebugL(messageKey, data = null, params = null, modulePrefix = null) {
  log(LOG_LEVELS.DEBUG, messageKey, data, { localize: true, params, modulePrefix });
}

/**
 * API functions for external modules - includes module prefix automatically
 * Creates a logger instance with a specific module prefix for external modules
 * @param {string} modulePrefix - The prefix to use for log messages
 * @returns {Object} Logger instance with all logging functions
 */

export function createModuleLogger(modulePrefix) {
  return {
    error: (message, error = null, options = {}) => 
      log(LOG_LEVELS.ERROR, message, error, { ...options, modulePrefix }),
    warn: (message, data = null, options = {}) => 
      log(LOG_LEVELS.WARN, message, data, { ...options, modulePrefix }),
    info: (message, data = null, options = {}) => 
      log(LOG_LEVELS.INFO, message, data, { ...options, modulePrefix }),
    debug: (message, data = null, options = {}) => 
      log(LOG_LEVELS.DEBUG, message, data, { ...options, modulePrefix }),
    
    // Localized versions
    errorL: (messageKey, error = null, params = null) => 
      log(LOG_LEVELS.ERROR, messageKey, error, { localize: true, params, modulePrefix }),
    warnL: (messageKey, data = null, params = null) => 
      log(LOG_LEVELS.WARN, messageKey, data, { localize: true, params, modulePrefix }),
    infoL: (messageKey, data = null, params = null) => 
      log(LOG_LEVELS.INFO, messageKey, data, { localize: true, params, modulePrefix }),
    debugL: (messageKey, data = null, params = null) => 
      log(LOG_LEVELS.DEBUG, messageKey, data, { localize: true, params, modulePrefix })
  };
}

/**
 * Gets the string representation of a log level
 * @param {number} level - Log level number
 * @returns {string} Log level name
 */
export function getLogLevelName(level) {
  switch (level) {
    case LOG_LEVELS.ERROR: return 'ERROR';
    case LOG_LEVELS.WARN: return 'WARN';
    case LOG_LEVELS.INFO: return 'INFO';
    case LOG_LEVELS.DEBUG: return 'DEBUG';
    default: return 'UNKNOWN';
  }
}

/**
 * Gets all available log levels for settings
 * @returns {Object} Object with level names as keys and numbers as values
 */
export function getAvailableLogLevels() {
  // Use fallback strings if localization isn't available
  const errorLabel = (() => {
    try {
      return game.i18n.localize("names.settings.logLevel.error") || "Nur Fehler";
    } catch (e) {
      return "Nur Fehler";
    }
  })();
  
  const warnLabel = (() => {
    try {
      return game.i18n.localize("names.settings.logLevel.warn") || "Warnungen";
    } catch (e) {
      return "Warnungen";
    }
  })();
  
  const infoLabel = (() => {
    try {
      return game.i18n.localize("names.settings.logLevel.info") || "Informationen";
    } catch (e) {
      return "Informationen";
    }
  })();
  
  const debugLabel = (() => {
    try {
      return game.i18n.localize("names.settings.logLevel.debug") || "Alle Details";
    } catch (e) {
      return "Alle Details";
    }
  })();

  return {
    [errorLabel]: LOG_LEVELS.ERROR,
    [warnLabel]: LOG_LEVELS.WARN,
    [infoLabel]: LOG_LEVELS.INFO,
    [debugLabel]: LOG_LEVELS.DEBUG
  };
}