/**
 * Data Access API
 * Provides methods for accessing language, species, and catalog data
 */

import { getGlobalGenerator } from './generator.js';
import { logDebug, logWarn } from '../utils/logger.js';
import {
  validateLanguage,
  validateSpecies
} from '../utils/api-input-validator.js';
import {
  createValidationError,
  ErrorType
} from '../utils/error-helper.js';

/**
 * Get available languages
 * @param {Object} generator - The generator instance
 * @returns {Promise<Array<string>>} Language codes
 */
export async function getAvailableLanguages(generator) {
  return await generator.getAvailableLanguages();
}

/**
 * Get available species for a language
 * @param {Object} generator - The generator instance
 * @param {string} language - Language code
 * @returns {Promise<Array<string>>} Species codes
 */
export async function getAvailableSpecies(generator, language) {
  // Validate language parameter
  const languageValidation = validateLanguage(language);
  if (!languageValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      error: languageValidation.error
    });
  }

  return await generator.getAvailableSpecies(languageValidation.normalized);
}

/**
 * Get all species codes across all languages
 * Used by the species configuration dialog
 * @param {Object} dataManager - The data manager instance
 * @returns {Array<string>} All species codes
 */
export function getAllSpeciesCodes(dataManager) {
  if (!dataManager) {
    logWarn("DataManager not initialized, returning empty species list");
    return [];
  }

  const speciesCodes = new Set();
  const packages = dataManager.getLoadedPackages();

  for (const packageCode of packages) {
    const pkg = dataManager.getPackage(packageCode);
    if (pkg && pkg.species) {
      speciesCodes.add(pkg.species);
    }
  }

  return Array.from(speciesCodes).sort();
}

/**
 * Get available catalogs (categories) for a package
 * @param {Object} generator - The generator instance
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @returns {Promise<Array<Object>>} Catalogs with code and name
 */
export async function getAvailableCatalogs(generator, language, species) {
  // Validate language parameter
  const languageValidation = validateLanguage(language);
  if (!languageValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      error: languageValidation.error
    });
  }

  // Get available species for the validated language and verify language exists
  const availableSpecies = await generator.getAvailableSpecies(languageValidation.normalized);

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

  // Validate species parameter
  const speciesValidation = validateSpecies(species, availableSpeciesCodes);
  if (!speciesValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_SPECIES, {
      value: species,
      language: languageValidation.normalized,
      error: speciesValidation.error
    });
  }

  const packageCode = `${speciesValidation.normalized}-${languageValidation.normalized}`;
  return await generator.getAvailableCatalogs(packageCode);
}

/**
 * Get available collections for a species-language combination
 * Collections are preset queries that define catalog + filter combinations, providing
 * convenient shortcuts for common name generation patterns (e.g., "noble names", "rare surnames").
 * This feature requires v4.0.1+ data format support.
 *
 * @param {Object} dataManager - The data manager instance
 * @param {string} language - Language code (e.g., 'de', 'en')
 * @param {string} species - Species code (e.g., 'human', 'elf', 'dwarf')
 * @returns {Promise<Array<{key: string, displayName: string}>>} Array of collection objects with key and localized displayName
 * @throws {NominaError} When validation fails or package doesn't exist
 *
 * @example
 * // Get available collections for German humans
 * const collections = await getAvailableCollections(dataManager, 'de', 'human');
 * // Returns: [
 * //   { key: 'noble', displayName: 'Adelige' },
 * //   { key: 'rare', displayName: 'Selten' },
 * //   { key: 'common', displayName: 'Häufig' }
 * // ]
 */
export async function getAvailableCollections(dataManager, language, species) {
  // === INPUT VALIDATION ===

  // Step 1: Validate language parameter
  const languageValidation = validateLanguage(language);
  if (!languageValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
      value: language,
      error: languageValidation.error
    });
  }
  const normalizedLanguage = languageValidation.normalized;

  // Step 2: Get available species for the validated language and verify language exists
  const generator = getGlobalGenerator();
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

  // Step 3: Validate species parameter
  const speciesValidation = validateSpecies(species, availableSpeciesCodes);
  if (!speciesValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_SPECIES, {
      value: species,
      language: normalizedLanguage,
      error: speciesValidation.error
    });
  }
  const normalizedSpecies = speciesValidation.normalized;

  // === RETRIEVE COLLECTIONS ===

  const packageCode = `${normalizedSpecies}-${normalizedLanguage}`;
  const collections = dataManager.getCollections(packageCode);

  // === LOCALIZE DISPLAY NAMES ===

  // Transform collections to return localized display names
  // Each collection has structure: { key, displayName: { de: "...", en: "..." }, query }
  return collections.map(collection => {
    let displayName;

    // Try to get displayName for the requested language
    if (collection.displayName && typeof collection.displayName === 'object') {
      displayName = collection.displayName[normalizedLanguage];
    }

    // Fallback 1: Try English displayName
    if (!displayName && collection.displayName && typeof collection.displayName === 'object') {
      displayName = collection.displayName.en;
    }

    // Fallback 2: Use the collection key capitalized
    if (!displayName) {
      displayName = collection.key.charAt(0).toUpperCase() + collection.key.slice(1);
    }

    return {
      key: collection.key,
      displayName: displayName
    };
  });
}
