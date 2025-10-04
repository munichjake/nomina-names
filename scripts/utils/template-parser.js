/**
 * Template Parser - Handles template-based name generation with placeholders
 * Format 3.2.0 Feature
 *
 * Supports:
 * - Simple placeholders: {prefix}, {suffix}
 * - Filtered placeholders: {settlement|dativ} (prepared for future grammar features)
 */

import { logDebug, logWarn } from './logger.js';

/**
 * Regular expression to match template placeholders
 * Matches: {placeholder} or {placeholder|filter}
 */
const PLACEHOLDER_REGEX = /{(\w+)(?:\|(\w+))?}/g;

/**
 * Parse a template string and replace placeholders with random components
 *
 * @param {string} template - Template string with placeholders (e.g., "{prefix}{suffix}")
 * @param {Object} components - Component definitions with language-specific arrays
 * @param {string} language - Target language code
 * @returns {string} Generated name with placeholders replaced
 *
 * @example
 * parseTemplate("{metal}schmiede", {
 *   metal: { de: ["Eisen", "Gold"] }
 * }, "de")
 * // Returns: "Eisenschmiede" or "Goldschmiede"
 */
export function parseTemplate(template, components, language) {
  if (!template || typeof template !== 'string') {
    throw new Error('Template must be a non-empty string');
  }

  if (!components || typeof components !== 'object') {
    throw new Error('Components must be an object');
  }

  logDebug(`Parsing template: "${template}" for language: ${language}`);

  // Replace all placeholders in the template
  const result = template.replace(PLACEHOLDER_REGEX, (match, key, filter) => {
    logDebug(`Processing placeholder: ${match} (key: ${key}, filter: ${filter || 'none'})`);

    // Get component data for this placeholder
    const componentData = components[key];

    if (!componentData) {
      logWarn(`Component "${key}" not found in components. Available: ${Object.keys(components).join(', ')}`);
      return match; // Return placeholder unchanged if component not found
    }

    // Get language-specific options, fallback to direct array if not language-specific
    let options = componentData[language];

    if (!options) {
      // Fallback: if component is directly an array (not language-specific)
      if (Array.isArray(componentData)) {
        options = componentData;
      } else {
        logWarn(`No options found for component "${key}" in language "${language}"`);
        return match;
      }
    }

    if (!Array.isArray(options) || options.length === 0) {
      logWarn(`Component "${key}" has no valid options for language "${language}"`);
      return match;
    }

    // Pick random value from options
    const value = pickRandom(options);
    logDebug(`Selected value for ${key}: "${value}"`);

    // Apply filter if specified (prepared for future grammar features)
    if (filter) {
      return applyFilter(value, filter, language);
    }

    return value;
  });

  logDebug(`Template parsing result: "${result}"`);
  return result;
}

/**
 * Extract all placeholder keys from a template string
 *
 * @param {string} template - Template string to analyze
 * @returns {Array<string>} Array of placeholder keys found
 *
 * @example
 * extractPlaceholders("{prefix}{suffix}halle")
 * // Returns: ["prefix", "suffix"]
 */
export function extractPlaceholders(template) {
  if (!template || typeof template !== 'string') {
    return [];
  }

  const placeholders = [];
  let match;

  // Create a new regex instance to avoid issues with global flag
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);

  while ((match = regex.exec(template)) !== null) {
    placeholders.push(match[1]); // Extract just the key (without filter)
  }

  return placeholders;
}

/**
 * Validate that a template has all required components
 *
 * @param {string} template - Template string to validate
 * @param {Object} components - Available component definitions
 * @param {string} language - Target language
 * @returns {Object} Validation result with isValid boolean and missing array
 */
export function validateTemplate(template, components, language) {
  const placeholders = extractPlaceholders(template);
  const missing = [];

  for (const key of placeholders) {
    const componentData = components[key];

    if (!componentData) {
      missing.push(key);
      continue;
    }

    // Check if language-specific data exists
    const options = componentData[language] || componentData;
    if (!Array.isArray(options) || options.length === 0) {
      missing.push(key);
    }
  }

  return {
    isValid: missing.length === 0,
    missing: missing,
    placeholders: placeholders
  };
}

/**
 * Apply a filter to a value (prepared for future grammar features)
 *
 * @param {string} value - Value to filter
 * @param {string} filterName - Filter to apply (e.g., "dativ", "genitiv")
 * @param {string} language - Language code for language-specific filters
 * @returns {string} Filtered value
 *
 * @private
 */
function applyFilter(value, filterName, language) {
  logDebug(`Applying filter "${filterName}" to "${value}" (language: ${language})`);

  // Placeholder for future grammar features
  // For now, just return the value unchanged with a debug message
  logDebug(`Filter "${filterName}" not yet implemented, returning value unchanged`);

  // TODO: Implement grammar filters in future version
  // Examples:
  // - Declension for German articles (der/die/das -> des/der/dem)
  // - Case transformations (uppercase, lowercase, capitalize)
  // - Pluralization rules

  return value;
}

/**
 * Pick a random element from an array
 *
 * @param {Array} array - Array to pick from
 * @returns {*} Random element from array
 *
 * @private
 */
function pickRandom(array) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error('Cannot pick from empty or invalid array');
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate multiple names from a template
 *
 * @param {string} template - Template string
 * @param {Object} components - Component definitions
 * @param {string} language - Target language
 * @param {number} count - Number of names to generate
 * @returns {Array<string>} Array of generated names
 */
export function generateMultiple(template, components, language, count = 1) {
  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      results.push(parseTemplate(template, components, language));
    } catch (error) {
      logWarn(`Failed to generate name ${i + 1}/${count}:`, error);
    }
  }

  return results;
}

// Export for testing
export const _test = {
  PLACEHOLDER_REGEX,
  pickRandom,
  applyFilter
};
