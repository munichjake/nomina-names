/**
 * Input validation utilities for the Names API
 * Provides comprehensive validation and normalization for all API input parameters
 *
 * @module utils/api-input-validator
 * @author Nombres Module
 * @version 1.0.0
 */

import { getSupportedGenders } from '../shared/constants.js';
import { isNullOrUndefined } from './null-checks.js';

/**
 * Standard validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the input passed validation
 * @property {string|null} error - Error message if validation failed, null otherwise
 * @property {*} normalized - The normalized/cleaned input value, or null if invalid
 */

/**
 * Validates a language code
 * Language codes must be 2-5 lowercase letters (ISO 639-1 or ISO 639-2/3/5)
 *
 * @param {*} language - The language code to validate
 * @returns {ValidationResult} Validation result with normalized lowercase language code
 *
 * @example
 * validateLanguage('en')        // { isValid: true, error: null, normalized: 'en' }
 * validateLanguage('ENG')       // { isValid: true, error: null, normalized: 'eng' }
 * validateLanguage('en-US')     // { isValid: false, error: '...', normalized: null }
 * validateLanguage(null)        // { isValid: false, error: '...', normalized: null }
 */
export function validateLanguage(language) {
  // Handle null/undefined
  if (isNullOrUndefined(language)) {
    return {
      isValid: false,
      error: 'Language cannot be null or undefined',
      normalized: null
    };
  }

  // Convert to string and normalize
  const normalized = String(language).trim().toLowerCase();

  // Check if empty after trimming
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: 'Language cannot be empty',
      normalized: null
    };
  }

  // Validate format: 2-5 lowercase letters
  const languageRegex = /^[a-z]{2,5}$/;
  if (!languageRegex.test(normalized)) {
    return {
      isValid: false,
      error: `Invalid language code '${language}'. Must be 2-5 lowercase letters (e.g., 'en', 'eng', 'en-us' not supported)`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a species code against available species
 *
 * @param {*} species - The species code to validate
 * @param {string[]} availableSpecies - Array of available species codes
 * @returns {ValidationResult} Validation result with normalized lowercase species code
 *
 * @example
 * validateSpecies('human', ['human', 'elf', 'dwarf'])
 * // { isValid: true, error: null, normalized: 'human' }
 *
 * validateSpecies('Human', ['human', 'elf', 'dwarf'])
 * // { isValid: true, error: null, normalized: 'human' }
 *
 * validateSpecies('orc', ['human', 'elf', 'dwarf'])
 * // { isValid: false, error: '...', normalized: null }
 */
export function validateSpecies(species, availableSpecies) {
  // Handle null/undefined
  if (isNullOrUndefined(species)) {
    return {
      isValid: false,
      error: 'Species cannot be null or undefined',
      normalized: null
    };
  }

  // Validate availableSpecies is provided and is an array
  if (!Array.isArray(availableSpecies) || availableSpecies.length === 0) {
    return {
      isValid: false,
      error: 'Available species list must be a non-empty array',
      normalized: null
    };
  }

  // Convert to string and normalize
  const normalized = String(species).trim().toLowerCase();

  // Check if empty after trimming
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: 'Species cannot be empty',
      normalized: null
    };
  }

  // Check if species is in available list
  const normalizedAvailable = availableSpecies.map(s => String(s).trim().toLowerCase());
  if (!normalizedAvailable.includes(normalized)) {
    return {
      isValid: false,
      error: `Species '${species}' is not available. Available species: ${availableSpecies.join(', ')}`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a gender parameter
 * Accepts: null, 'random', or a supported gender code
 *
 * @param {*} gender - The gender to validate
 * @param {string[]} [supportedGenders] - Optional array of supported genders (defaults to getSupportedGenders())
 * @returns {ValidationResult} Validation result with normalized lowercase gender
 *
 * @example
 * validateGender(null)           // { isValid: true, error: null, normalized: null }
 * validateGender('random')       // { isValid: true, error: null, normalized: 'random' }
 * validateGender('male')         // { isValid: true, error: null, normalized: 'male' }
 * validateGender('MALE')         // { isValid: true, error: null, normalized: 'male' }
 * validateGender('invalid')      // { isValid: false, error: '...', normalized: null }
 */
export function validateGender(gender, supportedGenders = null) {
  // Handle null (valid - means no gender preference)
  if (isNullOrUndefined(gender)) {
    return {
      isValid: true,
      error: null,
      normalized: null
    };
  }

  // Get supported genders if not provided
  if (!supportedGenders) {
    supportedGenders = getSupportedGenders();
  }

  // Convert to string and normalize
  const normalized = String(gender).trim().toLowerCase();

  // Check if empty after trimming
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: 'Gender cannot be an empty string',
      normalized: null
    };
  }

  // 'random' is always valid
  if (normalized === 'random') {
    return {
      isValid: true,
      error: null,
      normalized: 'random'
    };
  }

  // Check if gender is in supported list
  const normalizedSupported = supportedGenders.map(g => String(g).trim().toLowerCase());
  if (!normalizedSupported.includes(normalized)) {
    return {
      isValid: false,
      error: `Gender '${gender}' is not supported. Supported genders: ${supportedGenders.join(', ')}, 'random', or null`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a components array
 * Components specify which name parts to generate
 *
 * @param {*} components - The components array to validate
 * @returns {ValidationResult} Validation result with normalized components array
 *
 * @example
 * validateComponents(['firstname', 'surname'])
 * // { isValid: true, error: null, normalized: ['firstname', 'surname'] }
 *
 * validateComponents(['firstname', 'invalid'])
 * // { isValid: false, error: '...', normalized: null }
 */
export function validateComponents(components) {
  // Handle null/undefined - default to all components
  if (isNullOrUndefined(components)) {
    return {
      isValid: true,
      error: null,
      normalized: ['firstname', 'surname', 'title', 'nickname']
    };
  }

  // Validate it's an array
  if (!Array.isArray(components)) {
    return {
      isValid: false,
      error: `Components must be an array, received ${typeof components}`,
      normalized: null
    };
  }

  // Check if empty
  if (components.length === 0) {
    return {
      isValid: false,
      error: 'Components array cannot be empty',
      normalized: null
    };
  }

  // Valid component types
  const validComponents = ['firstname', 'surname', 'title', 'nickname'];

  // Normalize and validate each component
  const normalized = [];
  for (const component of components) {
    if (isNullOrUndefined(component)) {
      return {
        isValid: false,
        error: 'Components array cannot contain null or undefined values',
        normalized: null
      };
    }

    const normalizedComponent = String(component).trim().toLowerCase();

    if (normalizedComponent.length === 0) {
      return {
        isValid: false,
        error: 'Components array cannot contain empty strings',
        normalized: null
      };
    }

    if (!validComponents.includes(normalizedComponent)) {
      return {
        isValid: false,
        error: `Invalid component '${component}'. Valid components: ${validComponents.join(', ')}`,
        normalized: null
      };
    }

    // Avoid duplicates
    if (!normalized.includes(normalizedComponent)) {
      normalized.push(normalizedComponent);
    }
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a format string against available components
 * Format strings use placeholders like {firstname}, {surname}, etc.
 *
 * @param {*} format - The format string to validate
 * @param {string[]} [components] - Array of available components (optional, defaults to all)
 * @returns {ValidationResult} Validation result with normalized format string
 *
 * @example
 * validateFormat('{firstname} {surname}', ['firstname', 'surname'])
 * // { isValid: true, error: null, normalized: '{firstname} {surname}' }
 *
 * validateFormat('{firstname} {unknown}', ['firstname', 'surname'])
 * // { isValid: false, error: '...', normalized: null }
 */
export function validateFormat(format, components = null) {
  // Handle null/undefined
  if (isNullOrUndefined(format)) {
    return {
      isValid: false,
      error: 'Format cannot be null or undefined',
      normalized: null
    };
  }

  // Convert to string and normalize
  const normalized = String(format).trim();

  // Check if empty after trimming
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: 'Format cannot be empty',
      normalized: null
    };
  }

  // Extract placeholders from format string
  const placeholderRegex = /\{([^}]+)\}/g;
  const placeholders = [];
  let match;

  while ((match = placeholderRegex.exec(normalized)) !== null) {
    placeholders.push(match[1].toLowerCase());
  }

  // If no placeholders found, that's valid but unusual
  if (placeholders.length === 0) {
    return {
      isValid: true,
      error: null,
      normalized
    };
  }

  // Determine valid components
  const validComponents = components || ['firstname', 'surname', 'title', 'nickname'];
  const normalizedValid = validComponents.map(c => String(c).trim().toLowerCase());

  // Check all placeholders are valid
  for (const placeholder of placeholders) {
    if (!normalizedValid.includes(placeholder)) {
      return {
        isValid: false,
        error: `Format contains invalid placeholder '{${placeholder}}'. Valid placeholders: ${normalizedValid.map(c => `{${c}}`).join(', ')}`,
        normalized: null
      };
    }
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a count parameter
 * Count must be between 1 and 100 inclusive
 *
 * @param {*} count - The count to validate
 * @returns {ValidationResult} Validation result with normalized number
 *
 * @example
 * validateCount(5)              // { isValid: true, error: null, normalized: 5 }
 * validateCount('10')           // { isValid: true, error: null, normalized: 10 }
 * validateCount(0)              // { isValid: false, error: '...', normalized: null }
 * validateCount(101)            // { isValid: false, error: '...', normalized: null }
 */
export function validateCount(count) {
  // Handle null/undefined
  if (isNullOrUndefined(count)) {
    return {
      isValid: false,
      error: 'Count cannot be null or undefined',
      normalized: null
    };
  }

  // Convert to number
  let normalized;
  if (typeof count === 'number') {
    normalized = count;
  } else if (typeof count === 'string') {
    const trimmed = count.trim();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'Count cannot be an empty string',
        normalized: null
      };
    }
    normalized = Number(trimmed);
  } else {
    return {
      isValid: false,
      error: `Count must be a number, received ${typeof count}`,
      normalized: null
    };
  }

  // Check if NaN
  if (isNaN(normalized)) {
    return {
      isValid: false,
      error: `Count '${count}' is not a valid number`,
      normalized: null
    };
  }

  // Check if integer
  if (!Number.isInteger(normalized)) {
    return {
      isValid: false,
      error: `Count must be an integer, received ${normalized}`,
      normalized: null
    };
  }

  // Check range (1-100)
  if (normalized < 1) {
    return {
      isValid: false,
      error: `Count must be at least 1, received ${normalized}`,
      normalized: null
    };
  }

  if (normalized > 100) {
    return {
      isValid: false,
      error: `Count cannot exceed 100, received ${normalized}`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a package code
 * Package codes must be in "species-language" format
 *
 * @param {*} packageCode - The package code to validate
 * @returns {ValidationResult} Validation result with normalized package code
 *
 * @example
 * validatePackageCode('human-en')     // { isValid: true, error: null, normalized: 'human-en' }
 * validatePackageCode('Human-EN')     // { isValid: true, error: null, normalized: 'human-en' }
 * validatePackageCode('human')        // { isValid: false, error: '...', normalized: null }
 * validatePackageCode('human-en-gb')  // { isValid: false, error: '...', normalized: null }
 */
export function validatePackageCode(packageCode) {
  // Handle null/undefined
  if (isNullOrUndefined(packageCode)) {
    return {
      isValid: false,
      error: 'Package code cannot be null or undefined',
      normalized: null
    };
  }

  // Convert to string and normalize
  const normalized = String(packageCode).trim().toLowerCase();

  // Check if empty after trimming
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: 'Package code cannot be empty',
      normalized: null
    };
  }

  // Validate format: species-language (two parts separated by hyphen)
  const parts = normalized.split('-');

  if (parts.length !== 2) {
    return {
      isValid: false,
      error: `Invalid package code '${packageCode}'. Must be in format 'species-language' (e.g., 'human-en', 'elf-de')`,
      normalized: null
    };
  }

  const [species, language] = parts;

  // Check both parts are non-empty
  if (species.length === 0 || language.length === 0) {
    return {
      isValid: false,
      error: `Invalid package code '${packageCode}'. Both species and language must be specified`,
      normalized: null
    };
  }

  // Validate language part (2-5 letters)
  const languageRegex = /^[a-z]{2,5}$/;
  if (!languageRegex.test(language)) {
    return {
      isValid: false,
      error: `Invalid language in package code '${packageCode}'. Language must be 2-5 lowercase letters`,
      normalized: null
    };
  }

  // Species can be more flexible (alphanumeric with potential underscores/hyphens)
  // But must be at least 2 characters and contain only letters, numbers, underscores, or hyphens
  const speciesRegex = /^[a-z0-9_-]{2,}$/;
  if (!speciesRegex.test(species)) {
    return {
      isValid: false,
      error: `Invalid species in package code '${packageCode}'. Species must be at least 2 characters (letters, numbers, underscores, hyphens)`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a catalog code against available catalogs
 *
 * @param {*} catalog - The catalog code to validate
 * @param {string[]} availableCatalogs - Array of available catalog codes
 * @returns {ValidationResult} Validation result with normalized lowercase catalog code
 *
 * @example
 * validateCatalog('default', ['default', 'fantasy', 'scifi'])
 * // { isValid: true, error: null, normalized: 'default' }
 *
 * validateCatalog('Default', ['default', 'fantasy', 'scifi'])
 * // { isValid: true, error: null, normalized: 'default' }
 *
 * validateCatalog('horror', ['default', 'fantasy', 'scifi'])
 * // { isValid: false, error: '...', normalized: null }
 */
export function validateCatalog(catalog, availableCatalogs) {
  // Handle null/undefined
  if (isNullOrUndefined(catalog)) {
    return {
      isValid: false,
      error: 'Catalog cannot be null or undefined',
      normalized: null
    };
  }

  // Validate availableCatalogs is provided and is an array
  if (!Array.isArray(availableCatalogs) || availableCatalogs.length === 0) {
    return {
      isValid: false,
      error: 'Available catalogs list must be a non-empty array',
      normalized: null
    };
  }

  // Convert to string and normalize
  const normalized = String(catalog).trim().toLowerCase();

  // Check if empty after trimming
  if (normalized.length === 0) {
    return {
      isValid: false,
      error: 'Catalog cannot be empty',
      normalized: null
    };
  }

  // Check if catalog is in available list
  const normalizedAvailable = availableCatalogs.map(c => String(c).trim().toLowerCase());
  if (!normalizedAvailable.includes(normalized)) {
    return {
      isValid: false,
      error: `Catalog '${catalog}' is not available. Available catalogs: ${availableCatalogs.join(', ')}`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates tags parameter
 * Tags must be an array of strings
 *
 * @param {*} tags - The tags to validate
 * @returns {ValidationResult} Validation result with normalized array of lowercase tags
 *
 * @example
 * validateTags(['medieval', 'fantasy'])
 * // { isValid: true, error: null, normalized: ['medieval', 'fantasy'] }
 *
 * validateTags(['Medieval', 'FANTASY'])
 * // { isValid: true, error: null, normalized: ['medieval', 'fantasy'] }
 *
 * validateTags('medieval')        // { isValid: false, error: '...', normalized: null }
 * validateTags([123, 'fantasy'])  // { isValid: false, error: '...', normalized: null }
 */
export function validateTags(tags) {
  // Handle null/undefined - empty tags array is valid
  if (isNullOrUndefined(tags)) {
    return {
      isValid: true,
      error: null,
      normalized: []
    };
  }

  // Validate it's an array
  if (!Array.isArray(tags)) {
    return {
      isValid: false,
      error: `Tags must be an array, received ${typeof tags}`,
      normalized: null
    };
  }

  // Empty array is valid
  if (tags.length === 0) {
    return {
      isValid: true,
      error: null,
      normalized: []
    };
  }

  // Normalize and validate each tag
  const normalized = [];
  for (const tag of tags) {
    if (isNullOrUndefined(tag)) {
      return {
        isValid: false,
        error: 'Tags array cannot contain null or undefined values',
        normalized: null
      };
    }

    const normalizedTag = String(tag).trim().toLowerCase();

    if (normalizedTag.length === 0) {
      return {
        isValid: false,
        error: 'Tags array cannot contain empty strings',
        normalized: null
      };
    }

    // Avoid duplicates
    if (!normalized.includes(normalizedTag)) {
      normalized.push(normalizedTag);
    }
  }

  return {
    isValid: true,
    error: null,
    normalized
  };
}

/**
 * Validates a seed parameter
 * Seeds are optional strings for deterministic generation. If provided, they are
 * sanitized to remove potentially dangerous characters and limited in length.
 *
 * @param {*} seed - The seed to validate (null/undefined are valid)
 * @param {Object} [options={}] - Validation options
 * @param {number} [options.maxLength=200] - Maximum allowed seed length
 * @param {RegExp} [options.allowedChars] - Regex for allowed characters (optional, not enforced)
 * @returns {ValidationResult} Validation result with sanitized seed
 *
 * @example
 * validateSeed(null)              // { isValid: true, error: null, normalized: null }
 * validateSeed('my-seed-123')     // { isValid: true, error: null, normalized: 'my-seed-123' }
 * validateSeed('seed<script>')    // { isValid: true, error: null, normalized: 'seedscript' }
 * validateSeed('a'.repeat(201))   // { isValid: false, error: '...', normalized: null }
 */
export function validateSeed(seed, options = {}) {
  const { maxLength = 200 } = options;

  // null/undefined seeds are valid (means no seeding)
  if (isNullOrUndefined(seed)) {
    return {
      isValid: true,
      error: null,
      normalized: null
    };
  }

  // Convert to string
  const str = String(seed);

  // Check length
  if (str.length > maxLength) {
    return {
      isValid: false,
      error: `Seed too long (max ${maxLength} characters, got ${str.length})`,
      normalized: null,
      context: { length: str.length, maxLength }
    };
  }

  // Filter dangerous characters that could be used for injection attacks
  // Remove: < > " ' (common XSS/SQL injection characters)
  const sanitized = str.replace(/[<>\"']/g, '');

  return {
    isValid: true,
    error: null,
    normalized: sanitized
  };
}

/**
 * Configuration for transform validation
 * @typedef {Object} TransformValidationConfig
 * @property {number} maxDepth - Maximum recursion depth for transform chains (default: 10)
 * @property {number} maxTransforms - Maximum number of transforms in a catalog (default: 1000)
 * @property {Set<string>} visitedTransformIds - Set of visited transform IDs for circular reference detection
 */

/**
 * Validates a transform definition
 * Transforms are used to modify generated names (e.g., add prefixes, suffixes, patterns)
 *
 * @param {Object} transform - The transform object to validate
 * @param {TransformValidationConfig} config - Validation configuration
 * @returns {ValidationResult} Validation result
 *
 * @example
 * validateTransform({
 *   id: 'add-noble-prefix',
 *   type: 'prefix',
 *   value: 'von ',
 *   weight: 1
 * }, {})
 * // { isValid: true, error: null, normalized: {...} }
 */
export function validateTransform(transform, config = {}) {
  const {
    maxDepth = 10,
    visitedTransformIds = new Set()
  } = config;

  // Handle null/undefined
  if (isNullOrUndefined(transform)) {
    return {
      isValid: false,
      error: 'Transform cannot be null or undefined',
      normalized: null
    };
  }

  // Ensure transform is an object
  if (typeof transform !== 'object' || Array.isArray(transform)) {
    return {
      isValid: false,
      error: `Transform must be an object, received ${typeof transform}`,
      normalized: null
    };
  }

  // === VALIDATE REQUIRED FIELDS ===

  // Check for required 'id' field
  if (!('id' in transform) || isNullOrUndefined(transform.id)) {
    return {
      isValid: false,
      error: 'Transform must have an "id" field',
      normalized: null
    };
  }

  // Ensure id is a non-empty string
  if (typeof transform.id !== 'string') {
    return {
      isValid: false,
      error: `Transform "id" must be a string, received ${typeof transform.id}`,
      normalized: null
    };
  }

  const transformId = transform.id.trim();
  if (transformId.length === 0) {
    return {
      isValid: false,
      error: 'Transform "id" cannot be empty',
      normalized: null
    };
  }

  // === CIRCULAR REFERENCE DETECTION ===

  // Check if this transform ID has already been visited in the current chain
  if (visitedTransformIds.has(transformId)) {
    return {
      isValid: false,
      error: `Circular reference detected: transform "${transformId}" references itself`,
      normalized: null
    };
  }

  // Check for required 'type' field
  if (!('type' in transform) || isNullOrUndefined(transform.type)) {
    return {
      isValid: false,
      error: `Transform "${transformId}" must have a "type" field`,
      normalized: null
    };
  }

  // Ensure type is a valid transform type
  const validTypes = ['prefix', 'suffix', 'replace', 'pattern', 'custom'];
  if (typeof transform.type !== 'string') {
    return {
      isValid: false,
      error: `Transform "${transformId}" "type" must be a string, received ${typeof transform.type}`,
      normalized: null
    };
  }

  const transformType = transform.type.trim().toLowerCase();
  if (transformType.length === 0) {
    return {
      isValid: false,
      error: `Transform "${transformId}" "type" cannot be empty`,
      normalized: null
    };
  }

  if (!validTypes.includes(transformType)) {
    return {
      isValid: false,
      error: `Transform "${transformId}" has invalid type "${transform.type}". Valid types: ${validTypes.join(', ')}`,
      normalized: null
    };
  }

  // === VALIDATE TYPE-SPECIFIC FIELDS ===

  // All transform types need a 'value' field (or 'pattern' for pattern type)
  if (transformType === 'pattern') {
    if (!('pattern' in transform) || isNullOrUndefined(transform.pattern)) {
      return {
        isValid: false,
        error: `Transform "${transformId}" of type "pattern" must have a "pattern" field`,
        normalized: null
      };
    }

    if (typeof transform.pattern !== 'string' || transform.pattern.trim().length === 0) {
      return {
        isValid: false,
        error: `Transform "${transformId}" "pattern" must be a non-empty string`,
        normalized: null
      };
    }
  } else {
    if (!('value' in transform) || isNullOrUndefined(transform.value)) {
      return {
        isValid: false,
        error: `Transform "${transformId}" of type "${transformType}" must have a "value" field`,
        normalized: null
      };
    }

    if (typeof transform.value !== 'string' || transform.value.trim().length === 0) {
      return {
        isValid: false,
        error: `Transform "${transformId}" "value" must be a non-empty string`,
        normalized: null
      };
    }
  }

  // For 'replace' type, validate 'replacement' field
  if (transformType === 'replace') {
    if (!('replacement' in transform) || isNullOrUndefined(transform.replacement)) {
      return {
        isValid: false,
        error: `Transform "${transformId}" of type "replace" must have a "replacement" field`,
        normalized: null
      };
    }

    // replacement can be a string or a function reference
    if (typeof transform.replacement !== 'string' && typeof transform.replacement !== 'function') {
      return {
        isValid: false,
        error: `Transform "${transformId}" "replacement" must be a string or function, received ${typeof transform.replacement}`,
        normalized: null
      };
    }
  }

  // === VALIDATE OPTIONAL FIELDS ===

  // Validate 'weight' if present
  if ('weight' in transform && transform.weight !== null && transform.weight !== undefined) {
    const weight = Number(transform.weight);
    if (isNaN(weight) || weight < 0 || weight > 100) {
      return {
        isValid: false,
        error: `Transform "${transformId}" "weight" must be a number between 0 and 100, received ${transform.weight}`,
        normalized: null
      };
    }
  }

  // Validate 'condition' if present
  if ('condition' in transform && transform.condition !== null && transform.condition !== undefined) {
    if (typeof transform.condition !== 'object' || Array.isArray(transform.condition)) {
      return {
        isValid: false,
        error: `Transform "${transformId}" "condition" must be an object, received ${typeof transform.condition}`,
        normalized: null
      };
    }

    // Validate condition structure
    if (transform.condition.type && typeof transform.condition.type === 'string') {
      const validConditionTypes = ['tag', 'length', 'pattern', 'custom'];
      if (!validConditionTypes.includes(transform.condition.type)) {
        return {
          isValid: false,
          error: `Transform "${transformId}" has invalid condition type "${transform.condition.type}". Valid types: ${validConditionTypes.join(', ')}`,
          normalized: null
        };
      }
    }
  }

  // === RECURSIVE TRANSFORM CHAIN VALIDATION ===

  // If transform has 'next' field, validate the chain (recursive transforms)
  if ('next' in transform && transform.next !== null && transform.next !== undefined) {
    // Check recursion depth
    if (visitedTransformIds.size >= maxDepth) {
      return {
        isValid: false,
        error: `Transform chain exceeds maximum depth of ${maxDepth}. Transforms may be too deeply nested.`,
        normalized: null
      };
    }

    // Create new visited set for this branch
    const newVisitedIds = new Set(visitedTransformIds);
    newVisitedIds.add(transformId);

    // Validate next transform
    const nextResult = validateTransform(transform.next, {
      maxDepth,
      visitedTransformIds: newVisitedIds
    });

    if (!nextResult.isValid) {
      return {
        isValid: false,
        error: `Transform "${transformId}" has invalid "next" transform: ${nextResult.error}`,
        normalized: null
      };
    }
  }

  // === TRANSFORM PASSED ALL VALIDATIONS ===

  return {
    isValid: true,
    error: null,
    normalized: {
      id: transformId,
      type: transformType,
      value: transformType === 'pattern' ? transform.pattern : transform.value?.trim(),
      replacement: transformType === 'replace' ? transform.replacement : undefined,
      weight: typeof transform.weight === 'number' ? transform.weight : 1,
      condition: transform.condition || null,
      next: transform.next || null
    }
  };
}

/**
 * Validates all transforms in a catalog
 * Checks for circular references and maximum depth violations across all transforms
 *
 * @param {Object} catalog - The catalog object containing transforms
 * @param {TransformValidationConfig} config - Validation configuration
 * @returns {ValidationResult} Validation result with details about invalid transforms
 *
 * @example
 * validateCatalogTransforms({
 *   transforms: {
 *     'add-prefix': { id: 'add-prefix', type: 'prefix', value: 'von ' }
 *   }
 * }, {})
 * // { isValid: true, error: null, normalized: {...} }
 */
export function validateCatalogTransforms(catalog, config = {}) {
  const {
    maxDepth = 10,
    maxTransforms = 1000
  } = config;

  // Handle null/undefined
  if (isNullOrUndefined(catalog)) {
    return {
      isValid: true,
      error: null,
      normalized: null
    };
  }

  // Ensure catalog is an object
  if (typeof catalog !== 'object' || Array.isArray(catalog)) {
    return {
      isValid: false,
      error: `Catalog must be an object, received ${typeof catalog}`,
      normalized: null
    };
  }

  // Check if catalog has transforms
  if (!('transforms' in catalog) || isNullOrUndefined(catalog.transforms)) {
    // No transforms is valid
    return {
      isValid: true,
      error: null,
      normalized: null
    };
  }

  const transforms = catalog.transforms;

  // Ensure transforms is an object
  if (typeof transforms !== 'object' || Array.isArray(transforms)) {
    return {
      isValid: false,
      error: `Catalog transforms must be an object, received ${typeof transforms}`,
      normalized: null
    };
  }

  const transformIds = Object.keys(transforms);

  // Check if too many transforms
  if (transformIds.length > maxTransforms) {
    return {
      isValid: false,
      error: `Catalog has too many transforms (${transformIds.length}). Maximum allowed: ${maxTransforms}`,
      normalized: null
    };
  }

  // No transforms is valid
  if (transformIds.length === 0) {
    return {
      isValid: true,
      error: null,
      normalized: {}
    };
  }

  // === VALIDATE EACH TRANSFORM ===

  const validatedTransforms = {};
  const errors = [];

  for (const transformId of transformIds) {
    const transform = transforms[transformId];

    // Each transform validation starts with a fresh visited set
    // This allows different transform chains to reference the same transform
    // but prevents self-reference within a single chain
    const result = validateTransform(transform, {
      maxDepth,
      visitedTransformIds: new Set()
    });

    if (!result.isValid) {
      errors.push(`Transform "${transformId}": ${result.error}`);
    } else {
      validatedTransforms[transformId] = result.normalized;
    }
  }

  // === CHECK FOR CIRCULAR REFERENCES ACROSS TRANSFORM CHAINS ===

  // Build a dependency graph: transformId -> set of transformIds it references via 'next'
  const dependencyGraph = {};
  for (const transformId of transformIds) {
    dependencyGraph[transformId] = new Set();
    let currentTransform = transforms[transformId];

    // Walk the transform chain to collect all dependencies
    while (currentTransform && currentTransform.next) {
      const nextId = currentTransform.next.id;
      if (nextId) {
        dependencyGraph[transformId].add(nextId);
      }
      currentTransform = currentTransform.next;
    }
  }

  // Detect cycles using depth-first search
  const detectCycle = (nodeId, path = []) => {
    if (path.includes(nodeId)) {
      return [...path, nodeId];
    }

    const newPath = [...path, nodeId];

    for (const dependencyId of dependencyGraph[nodeId] || []) {
      const cycle = detectCycle(dependencyId, newPath);
      if (cycle) {
        return cycle;
      }
    }

    return null;
  };

  for (const transformId of transformIds) {
    const cycle = detectCycle(transformId);
    if (cycle) {
      errors.push(`Circular reference detected in transform chain: ${cycle.join(' -> ')}`);
      break;
    }
  }

  // === RETURN RESULTS ===

  if (errors.length > 0) {
    return {
      isValid: false,
      error: `Catalog transforms validation failed:\n- ${errors.join('\n- ')}`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized: validatedTransforms
  };
}

/**
 * Validates recipe data structure for custom name generation
 * Recipes define how to assemble names from catalogs and transforms
 *
 * @param {Object} recipe - The recipe object to validate
 * @param {string[]} availableCatalogs - Array of available catalog codes
 * @param {TransformValidationConfig} transformConfig - Transform validation configuration
 * @returns {ValidationResult} Validation result
 *
 * @example
 * validateRecipe({
 *   id: 'noble-name',
 *   parts: [
 *     { catalog: 'titles', transform: 'add-prefix' },
 *     { catalog: 'firstnames' }
 *   ],
 *   format: '{title} {firstname}'
 * }, ['titles', 'firstnames'], {})
 * // { isValid: true, error: null, normalized: {...} }
 */
export function validateRecipe(recipe, availableCatalogs = [], transformConfig = {}) {
  // Handle null/undefined
  if (isNullOrUndefined(recipe)) {
    return {
      isValid: false,
      error: 'Recipe cannot be null or undefined',
      normalized: null
    };
  }

  // Ensure recipe is an object
  if (typeof recipe !== 'object' || Array.isArray(recipe)) {
    return {
      isValid: false,
      error: `Recipe must be an object, received ${typeof recipe}`,
      normalized: null
    };
  }

  // === VALIDATE REQUIRED FIELDS ===

  // Check for required 'id' field
  if (!('id' in recipe) || isNullOrUndefined(recipe.id)) {
    return {
      isValid: false,
      error: 'Recipe must have an "id" field',
      normalized: null
    };
  }

  if (typeof recipe.id !== 'string' || recipe.id.trim().length === 0) {
    return {
      isValid: false,
      error: 'Recipe "id" must be a non-empty string',
      normalized: null
    };
  }

  const recipeId = recipe.id.trim();

  // === VALIDATE PARTS ARRAY ===

  if (!('parts' in recipe) || isNullOrUndefined(recipe.parts)) {
    return {
      isValid: false,
      error: `Recipe "${recipeId}" must have a "parts" array`,
      normalized: null
    };
  }

  if (!Array.isArray(recipe.parts)) {
    return {
      isValid: false,
      error: `Recipe "${recipeId}" "parts" must be an array, received ${typeof recipe.parts}`,
      normalized: null
    };
  }

  if (recipe.parts.length === 0) {
    return {
      isValid: false,
      error: `Recipe "${recipeId}" "parts" array cannot be empty`,
      normalized: null
    };
  }

  // Validate each part
  const validatedParts = [];
  const partErrors = [];

  for (let i = 0; i < recipe.parts.length; i++) {
    const part = recipe.parts[i];

    if (isNullOrUndefined(part)) {
      partErrors.push(`Part ${i}: cannot be null or undefined`);
      continue;
    }

    if (typeof part !== 'object' || Array.isArray(part)) {
      partErrors.push(`Part ${i}: must be an object, received ${typeof part}`);
      continue;
    }

    // Each part must have a 'catalog' field
    if (!('catalog' in part) || isNullOrUndefined(part.catalog)) {
      partErrors.push(`Part ${i}: missing required "catalog" field`);
      continue;
    }

    if (typeof part.catalog !== 'string' || part.catalog.trim().length === 0) {
      partErrors.push(`Part ${i}: "catalog" must be a non-empty string`);
      continue;
    }

    const catalogName = part.catalog.trim();

    // Check if catalog exists in available catalogs (if provided)
    if (availableCatalogs.length > 0 && !availableCatalogs.includes(catalogName)) {
      partErrors.push(`Part ${i}: catalog "${catalogName}" is not available. Available catalogs: ${availableCatalogs.join(', ')}`);
      continue;
    }

    const validatedPart = {
      catalog: catalogName,
      transform: null,
      weight: 1
    };

    // Validate optional 'transform' field
    if ('transform' in part && part.transform !== null && part.transform !== undefined) {
      if (typeof part.transform !== 'string' || part.transform.trim().length === 0) {
        partErrors.push(`Part ${i}: "transform" must be a non-empty string`);
        continue;
      }
      validatedPart.transform = part.transform.trim();
    }

    // Validate optional 'weight' field
    if ('weight' in part && part.weight !== null && part.weight !== undefined) {
      const weight = Number(part.weight);
      if (isNaN(weight) || weight < 0 || weight > 100) {
        partErrors.push(`Part ${i}: "weight" must be a number between 0 and 100`);
        continue;
      }
      validatedPart.weight = weight;
    }

    validatedParts.push(validatedPart);
  }

  if (partErrors.length > 0) {
    return {
      isValid: false,
      error: `Recipe "${recipeId}" has invalid parts:\n- ${partErrors.join('\n- ')}`,
      normalized: null
    };
  }

  // === VALIDATE OPTIONAL FORMAT FIELD ===

  if ('format' in recipe && recipe.format !== null && recipe.format !== undefined) {
    if (typeof recipe.format !== 'string' || recipe.format.trim().length === 0) {
      return {
        isValid: false,
        error: `Recipe "${recipeId}" "format" must be a non-empty string`,
        normalized: null
      };
    }
  }

  // === VALIDATE OPTIONAL TRANSFORMS OBJECT ===

  let validatedTransforms = {};
  if ('transforms' in recipe && recipe.transforms !== null && recipe.transforms !== undefined) {
    if (typeof recipe.transforms !== 'object' || Array.isArray(recipe.transforms)) {
      return {
        isValid: false,
        error: `Recipe "${recipeId}" "transforms" must be an object, received ${typeof recipe.transforms}`,
        normalized: null
      };
    }

    // Create a mock catalog structure for transform validation
    const mockCatalog = { transforms: recipe.transforms };
    const transformResult = validateCatalogTransforms(mockCatalog, transformConfig);

    if (!transformResult.isValid) {
      return {
        isValid: false,
        error: `Recipe "${recipeId}" has invalid transforms:\n- ${transformResult.error}`,
        normalized: null
      };
    }

    validatedTransforms = transformResult.normalized;
  }

  // === RECIPE PASSED ALL VALIDATIONS ===

  return {
    isValid: true,
    error: null,
    normalized: {
      id: recipeId,
      parts: validatedParts,
      format: recipe.format?.trim() || null,
      transforms: validatedTransforms
    }
  };
}

/**
 * Validates all recipes in a package
 * Checks for recipe ID uniqueness and validates each recipe
 *
 * @param {Object} packageData - The package data object
 * @param {string[]} availableCatalogs - Array of available catalog codes
 * @param {TransformValidationConfig} config - Transform validation configuration
 * @returns {ValidationResult} Validation result
 */
export function validatePackageRecipes(packageData, availableCatalogs = [], config = {}) {
  // Handle null/undefined
  if (isNullOrUndefined(packageData)) {
    return {
      isValid: true,
      error: null,
      normalized: null
    };
  }

  // Ensure packageData is an object
  if (typeof packageData !== 'object' || Array.isArray(packageData)) {
    return {
      isValid: false,
      error: `Package data must be an object, received ${typeof packageData}`,
      normalized: null
    };
  }

  // Check if package has recipes
  if (!('recipes' in packageData) || isNullOrUndefined(packageData.recipes)) {
    // No recipes is valid
    return {
      isValid: true,
      error: null,
      normalized: null
    };
  }

  const recipes = packageData.recipes;

  // Ensure recipes is an object
  if (typeof recipes !== 'object' || Array.isArray(recipes)) {
    return {
      isValid: false,
      error: `Package recipes must be an object, received ${typeof recipes}`,
      normalized: null
    };
  }

  const recipeIds = Object.keys(recipes);

  // No recipes is valid
  if (recipeIds.length === 0) {
    return {
      isValid: true,
      error: null,
      normalized: {}
    };
  }

  // === VALIDATE EACH RECIPE ===

  const validatedRecipes = {};
  const errors = [];

  for (const recipeId of recipeIds) {
    const recipe = recipes[recipeId];

    const result = validateRecipe(recipe, availableCatalogs, config);

    if (!result.isValid) {
      errors.push(`Recipe "${recipeId}": ${result.error}`);
    } else {
      validatedRecipes[recipeId] = result.normalized;
    }
  }

  // === RETURN RESULTS ===

  if (errors.length > 0) {
    return {
      isValid: false,
      error: `Package recipes validation failed:\n- ${errors.join('\n- ')}`,
      normalized: null
    };
  }

  return {
    isValid: true,
    error: null,
    normalized: validatedRecipes
  };
}
