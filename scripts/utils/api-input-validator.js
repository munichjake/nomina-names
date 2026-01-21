/**
 * Input validation utilities for the Names API
 * Provides comprehensive validation and normalization for all API input parameters
 *
 * @module utils/api-input-validator
 * @author Nombres Module
 * @version 1.0.0
 */

import { getSupportedGenders } from '../shared/constants.js';

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
  if (language === null || language === undefined) {
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
  if (species === null || species === undefined) {
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
  if (gender === null || gender === undefined) {
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
  if (components === null || components === undefined) {
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
    if (component === null || component === undefined) {
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
  if (format === null || format === undefined) {
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
  if (count === null || count === undefined) {
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
  if (packageCode === null || packageCode === undefined) {
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
  if (catalog === null || catalog === undefined) {
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
  if (tags === null || tags === undefined) {
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
    if (tag === null || tag === undefined) {
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
