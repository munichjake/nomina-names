/**
 * Name Generation API
 * Provides methods for generating names with validation
 */

import { getGlobalGenerator } from './generator.js';
import { getSupportedGenders } from '../shared/constants.js';
import { logDebug, logError } from '../utils/logger.js';
import {
  validateLanguage,
  validateSpecies,
  validateGender,
  validateComponents,
  validateFormat,
  validateTags,
  validateCount
} from '../utils/api-input-validator.js';
import {
  createValidationError,
  ErrorType
} from '../utils/error-helper.js';

/**
 * Generate a name using V4 system with full validation
 * @param {Object} generator - The generator instance
 * @param {Object} options - Generation options
 * @param {string} options.language - Language code (default: 'de')
 * @param {string} options.species - Species code (default: 'human')
 * @param {string} options.gender - Gender for names ('male', 'female', 'nonbinary')
 * @param {Array} options.components - Name components ['firstname', 'surname', 'title', 'nickname']
 * @param {string} options.format - Name format (default: '{firstname} {surname}')
 * @param {number} options.count - Number of names to generate (default: 1)
 * @returns {Promise<string|Array>} Generated name(s)
 * @throws {NominaError} When validation fails or generation errors occur
 */
export async function generateName(generator, options = {}) {
  const {
    language = 'de',
    species = 'human',
    gender = null,
    components = ['firstname', 'surname'],
    format = '{firstname} {surname}',
    count = 1
  } = options;

  // === Input Validation ===

  // Step 1: Validate language format
  const languageResult = validateLanguage(language);
  if (!languageResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      error: languageResult.error
    });
  }
  const normalizedLanguage = languageResult.normalized;

  // Step 2: Get available species for the language and verify language exists
  const availableSpecies = await generator.getAvailableSpecies(normalizedLanguage);

  // Check if language has any species (if not, language doesn't exist)
  if (!availableSpecies || availableSpecies.length === 0) {
    const allLanguages = await generator.getAvailableLanguages();
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      available: allLanguages.join(', '),
      error: `Language '${language}' is not available. Available languages: ${allLanguages.join(', ')}`
    });
  }

  // Extract codes from species objects for validation
  const availableSpeciesCodes = availableSpecies.map(s => s.code);

  // Step 3: Validate species against available species
  const speciesResult = validateSpecies(species, availableSpeciesCodes);
  if (!speciesResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_SPECIES, {
      value: species,
      language: normalizedLanguage,
      error: speciesResult.error
    });
  }
  const normalizedSpecies = speciesResult.normalized;

  // Step 4: Validate gender against supported genders
  const supportedGenders = getSupportedGenders();
  const genderResult = validateGender(gender, supportedGenders);
  if (!genderResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_GENDER, {
      value: gender,
      supported: supportedGenders,
      error: genderResult.error
    });
  }
  const normalizedGender = genderResult.normalized;

  // Step 5: Validate components array
  const componentsResult = validateComponents(components);
  if (!componentsResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_COMPONENTS, {
      value: components,
      error: componentsResult.error
    });
  }
  const normalizedComponents = componentsResult.normalized;

  // Step 6: Validate format string against components
  const formatResult = validateFormat(format, normalizedComponents);
  if (!formatResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_FORMAT, {
      value: format,
      components: normalizedComponents,
      error: formatResult.error
    });
  }
  const normalizedFormat = formatResult.normalized;

  // Step 7: Validate count
  const countResult = validateCount(count);
  if (!countResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_COUNT, {
      value: count,
      error: countResult.error
    });
  }
  const normalizedCount = countResult.normalized;

  // === Generation ===

  const packageCode = `${normalizedSpecies}-${normalizedLanguage}`;

  logDebug("Generating name with validated options:", {
    language: normalizedLanguage,
    species: normalizedSpecies,
    gender: normalizedGender,
    components: normalizedComponents,
    format: normalizedFormat,
    count: normalizedCount
  });

  try {
    const result = await generator.generatePersonName(packageCode, {
      locale: normalizedLanguage,
      n: normalizedCount,
      gender: normalizedGender,
      components: normalizedComponents,
      format: normalizedFormat,
      allowDuplicates: false
    });

    // Return single name or array based on count
    if (normalizedCount === 1 && result.suggestions && result.suggestions.length > 0) {
      return result.suggestions[0].text;
    }

    return result.suggestions ? result.suggestions.map(s => s.text) : [];

  } catch (error) {
    // Re-throw NominaErrors as-is
    if (error.isNominaError) {
      throw error;
    }

    // Wrap other errors in a NominaError
    logError("Failed to generate name:", error);
    throw createValidationError(ErrorType.GENERATION_FAILED, {
      language: normalizedLanguage,
      species: normalizedSpecies,
      originalError: error.message
    });
  }
}

/**
 * Generate from a specific catalog with validation
 * @param {Object} generator - The generator instance
 * @param {Object} options - Options
 * @param {string} options.language - Language code
 * @param {string} options.species - Species code
 * @param {string} options.catalog - Catalog key (e.g., 'surnames', 'titles')
 * @param {Array} options.tags - Filter tags
 * @param {number} options.count - Number of items
 * @returns {Promise<Array<string>>} Generated items
 */
export async function generateFromCatalog(generator, options = {}) {
  const {
    language = 'de',
    species = 'human',
    catalog = 'surnames',
    tags = [],
    count = 1
  } = options;

  // === Input Validation ===

  // Validate language format
  const languageResult = validateLanguage(language);
  if (!languageResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      error: languageResult.error
    });
  }
  const normalizedLanguage = languageResult.normalized;

  // Get available species for validation and verify language exists
  const availableSpecies = await generator.getAvailableSpecies(normalizedLanguage);

  // Check if language has any species (if not, language doesn't exist)
  if (!availableSpecies || availableSpecies.length === 0) {
    const allLanguages = await generator.getAvailableLanguages();
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      available: allLanguages.join(', '),
      error: `Language '${language}' is not available. Available languages: ${allLanguages.join(', ')}`
    });
  }

  // Extract codes from species objects for validation
  const availableSpeciesCodes = availableSpecies.map(s => s.code);

  // Validate species
  const speciesResult = validateSpecies(species, availableSpeciesCodes);
  if (!speciesResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_SPECIES, {
      value: species,
      language: normalizedLanguage,
      error: speciesResult.error
    });
  }
  const normalizedSpecies = speciesResult.normalized;

  // Get available catalogs for validation
  const packageCode = `${normalizedSpecies}-${normalizedLanguage}`;
  const availableCatalogs = await generator.getAvailableCatalogs(packageCode);
  const catalogCodes = availableCatalogs.map(c => c.code);

  // Validate catalog
  const { validateCatalog } = await import('../utils/api-input-validator.js');
  const catalogResult = validateCatalog(catalog, catalogCodes);
  if (!catalogResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_CATALOG, {
      value: catalog,
      package: packageCode,
      error: catalogResult.error
    });
  }
  const normalizedCatalog = catalogResult.normalized;

  // Validate tags
  const tagsResult = validateTags(tags);
  if (!tagsResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_TAGS, {
      value: tags,
      error: tagsResult.error
    });
  }
  const normalizedTags = tagsResult.normalized;

  // Validate count
  const countResult = validateCount(count);
  if (!countResult.isValid) {
    throw createValidationError(ErrorType.API_INVALID_COUNT, {
      value: count,
      error: countResult.error
    });
  }
  const normalizedCount = countResult.normalized;

  // === Generation ===

  logDebug("Generating from catalog with options:", {
    language: normalizedLanguage,
    species: normalizedSpecies,
    catalog: normalizedCatalog,
    tags: normalizedTags,
    count: normalizedCount
  });

  try {
    const result = await generator.generateFromCatalog(packageCode, normalizedCatalog, {
      locale: normalizedLanguage,
      n: normalizedCount,
      tags: normalizedTags,
      allowDuplicates: false
    });

    return result.suggestions ? result.suggestions.map(s => s.text) : [];
  } catch (error) {
    // Re-throw NominaErrors as-is
    if (error.isNominaError) {
      throw error;
    }
    // Wrap other errors in NominaError
    logError("Failed to generate from catalog:", error);
    throw createValidationError(ErrorType.GENERATION_FAILED, {
      catalog: normalizedCatalog,
      language: normalizedLanguage,
      species: normalizedSpecies
    });
  }
}
