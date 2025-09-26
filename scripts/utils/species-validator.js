/**
 * Species Data Validator - Validates incoming species data for API registration
 */

import { logDebug, logWarn, logError } from './logger.js';
import { getAvailableCategories } from '../shared/constants.js';

/**
 * Validates species data structure for API registration
 * @param {string} speciesCode - The species identifier
 * @param {Object} speciesData - The species data to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateSpeciesData(speciesCode, speciesData) {
  const errors = [];

  // Required fields validation
  if (!speciesCode || typeof speciesCode !== 'string') {
    errors.push('Species code must be a non-empty string');
  }

  if (!speciesData || typeof speciesData !== 'object') {
    errors.push('Species data must be an object');
    return { isValid: false, errors };
  }

  // Validate format field (optional but if present, must be valid)
  if (speciesData.format) {
    const validFormats = ['3.0.0', '3.0.1', '3.1.0'];
    if (!validFormats.includes(speciesData.format)) {
      errors.push(`Invalid format '${speciesData.format}'. Supported formats: ${validFormats.join(', ')}`);
    }
  }

  // Validate fileVersion field (optional, for tracking file updates)
  if (speciesData.fileVersion) {
    if (typeof speciesData.fileVersion !== 'string') {
      errors.push('fileVersion must be a string');
    }
  }

  // Validate displayName
  if (speciesData.displayName) {
    if (typeof speciesData.displayName !== 'string' && typeof speciesData.displayName !== 'object') {
      errors.push('displayName must be a string or localization object');
    }

    if (typeof speciesData.displayName === 'object') {
      const supportedLangs = ['de', 'en'];
      const hasValidLang = supportedLangs.some(lang =>
        speciesData.displayName[lang] && typeof speciesData.displayName[lang] === 'string'
      );
      if (!hasValidLang) {
        errors.push('displayName object must contain at least one supported language (de, en)');
      }
    }
  }

  // Validate languages array
  if (!speciesData.languages || !Array.isArray(speciesData.languages)) {
    errors.push('languages must be an array');
  } else {
    const validLanguages = ['de', 'en'];
    const invalidLangs = speciesData.languages.filter(lang => !validLanguages.includes(lang));
    if (invalidLangs.length > 0) {
      errors.push(`Invalid languages: ${invalidLangs.join(', ')}. Supported: ${validLanguages.join(', ')}`);
    }
  }

  // Validate categories (can be Set or Array, will be converted in sanitization)
  // Note: categories can be missing for legacy format and will be inferred from data
  if (speciesData.categories) {
    // Get available categories dynamically from the constants system
    const validCategories = getAvailableCategories();

    if (speciesData.categories instanceof Set || Array.isArray(speciesData.categories)) {
      for (const category of speciesData.categories) {
        if (validCategories.length > 0 && !validCategories.includes(category)) {
          logWarn(`Unknown category '${category}' for species '${speciesCode}'. Make sure it's defined in index.json.`);
        }
      }
    } else {
      errors.push('categories must be a Set or Array');
    }
  }
  // categories is not required - will be inferred from dataFiles/data if needed

  // Validate dataFiles (can be Map or Object, will be converted in sanitization)
  // Note: dataFiles can be missing for legacy format and will be created during sanitization
  if (speciesData.dataFiles) {
    if (speciesData.dataFiles instanceof Map) {
      // Validate each data file entry in Map
      for (const [key, data] of speciesData.dataFiles) {
        if (typeof key !== 'string' || !key.includes('.')) {
          errors.push(`Invalid dataFiles key '${key}'. Expected format: 'language.category'`);
        }

        if (!data || typeof data !== 'object') {
          errors.push(`Invalid data for key '${key}'. Must be an object`);
        }
      }
    } else if (typeof speciesData.dataFiles === 'object') {
      // Validate each data file entry in Object (will be converted to Map)
      for (const [key, data] of Object.entries(speciesData.dataFiles)) {
        if (typeof key !== 'string' || !key.includes('.')) {
          errors.push(`Invalid dataFiles key '${key}'. Expected format: 'language.category'`);
        }

        if (!data || typeof data !== 'object') {
          errors.push(`Invalid data for key '${key}'. Must be an object`);
        }
      }
    } else {
      errors.push('dataFiles must be a Map or Object');
    }
  }
  // dataFiles is not required - will be created from legacy 'data' field if needed

  const isValid = errors.length === 0;

  if (isValid) {
    logDebug(`Species data validation passed for '${speciesCode}'`);
  } else {
    logError(`Species data validation failed for '${speciesCode}':`, errors);
  }

  return { isValid, errors };
}

/**
 * Validates and sanitizes species data, applying fixes where possible
 * @param {string} speciesCode - The species identifier
 * @param {Object} speciesData - The species data to validate and fix
 * @returns {Object} Result with isValid, sanitizedData, and warnings
 */
export function validateAndSanitizeSpeciesData(speciesCode, speciesData) {
  const warnings = [];
  let sanitizedData = { ...speciesData };

  // Convert categories array to Set if needed
  if (Array.isArray(sanitizedData.categories)) {
    sanitizedData.categories = new Set(sanitizedData.categories);
    warnings.push('Converted categories array to Set');
  } else if (!sanitizedData.categories) {
    // Create categories from dataFiles or legacy data
    const inferredCategories = new Set();

    if (sanitizedData.dataFiles && sanitizedData.dataFiles instanceof Map) {
      for (const key of sanitizedData.dataFiles.keys()) {
        const parts = key.split('.');
        if (parts.length === 2) {
          inferredCategories.add(parts[1]); // category part
        }
      }
    } else if (sanitizedData.data && typeof sanitizedData.data === 'object') {
      for (const key of Object.keys(sanitizedData.data)) {
        const parts = key.split('.');
        if (parts.length === 2) {
          inferredCategories.add(parts[1]); // category part
        }
      }
    }

    if (inferredCategories.size === 0) {
      // Default categories for species
      inferredCategories.add('names');
      inferredCategories.add('settlements');
    }

    sanitizedData.categories = inferredCategories;
    warnings.push(`Inferred categories from data: ${Array.from(inferredCategories).join(', ')}`);
  }

  // Ensure dataFiles is a Map
  if (sanitizedData.dataFiles) {
    if (!(sanitizedData.dataFiles instanceof Map)) {
      if (typeof sanitizedData.dataFiles === 'object') {
        sanitizedData.dataFiles = new Map(Object.entries(sanitizedData.dataFiles));
        warnings.push('Converted dataFiles object to Map');
      }
    }
  } else {
    // Create dataFiles from legacy 'data' field if available
    sanitizedData.dataFiles = new Map();

    if (sanitizedData.data && typeof sanitizedData.data === 'object') {
      // 3.0.1 format: data contains category-specific structures
      for (const [category, categoryData] of Object.entries(sanitizedData.data)) {
        // For each language, create a dataFiles entry
        if (sanitizedData.languages && Array.isArray(sanitizedData.languages)) {
          for (const language of sanitizedData.languages) {
            const langCatKey = `${language}.${category}`;
            sanitizedData.dataFiles.set(langCatKey, categoryData);
          }
        }
      }
      warnings.push('Created dataFiles Map from 3.0.1 data object');
    } else {
      // No data available - create empty Map
      warnings.push('Created empty dataFiles Map (no legacy data available)');
    }
  }

  // Apply default displayName if missing
  if (!sanitizedData.displayName) {
    sanitizedData.displayName = speciesCode.charAt(0).toUpperCase() + speciesCode.slice(1);
    warnings.push('Added default displayName based on species code');
  }

  // Validate sanitized data
  const validation = validateSpeciesData(speciesCode, sanitizedData);

  if (warnings.length > 0) {
    logDebug(`Species data sanitization applied ${warnings.length} fixes for '${speciesCode}':`, warnings);
  }

  return {
    isValid: validation.isValid,
    sanitizedData,
    errors: validation.errors,
    warnings
  };
}