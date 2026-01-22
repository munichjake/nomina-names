/**
 * Package Registration API
 * Provides methods for registering custom name data packages
 */

import { logInfo, logWarn, logError, logDebug } from '../utils/logger.js';
import { validatePackageCode } from '../utils/api-input-validator.js';
import {
  createValidationError,
  ErrorType
} from '../utils/error-helper.js';

/**
 * Register a new package (species-language combination)
 * @param {Object} dataManager - The data manager instance
 * @param {Object} options - Package registration options
 * @param {string} options.code - Package code (e.g., 'goblin-de')
 * @param {Object} options.data - Package data following V4 format
 * @returns {Promise<void>}
 *
 * @example
 * await registerPackage(dataManager, {
 *   code: 'goblin-de',
 *   data: {
 *     format: "4.0.0",
 *     package: {
 *       code: "goblin-de",
 *       displayName: { de: "Goblins", en: "Goblins" },
 *       languages: ["de"],
 *       phoneticLanguage: "de"
 *     },
 *     catalogs: {
 *       names: {
 *         displayName: { de: "Namen", en: "Names" },
 *         items: [
 *           { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1 }
 *         ]
 *       }
 *     }
 *   }
 * });
 */
export async function registerPackage(dataManager, options) {
  // === SAFETY WRAPPER: This method must NEVER crash Foundry ===

  // === VALIDATION LAYER 1: options parameter ===
  // Type-safe check before accessing any properties
  if (options === null || options === undefined) {
    throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
      param: 'options',
      error: 'options cannot be null or undefined'
    });
  }

  // Ensure options is an object (not array, string, number, etc.)
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
      param: 'options',
      received: typeof options,
      error: 'options must be an object'
    });
  }

  // === VALIDATION LAYER 2: code parameter ===
  // Check if code exists
  if (!('code' in options) || options.code === null || options.code === undefined) {
    throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
      param: 'code',
      error: 'options.code is required'
    });
  }

  // Validate code using the Validator module
  const codeValidation = validatePackageCode(options.code);
  if (!codeValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_PACKAGE_CODE, {
      value: options.code,
      error: codeValidation.error
    });
  }

  const packageCode = codeValidation.normalized;

  // === VALIDATION LAYER 3: data parameter ===
  // Check if data exists
  if (!('data' in options) || options.data === null || options.data === undefined) {
    throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
      param: 'data',
      error: 'options.data is required'
    });
  }

  // Ensure data is an object
  const data = options.data;
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
      param: 'data',
      received: typeof data,
      error: 'options.data must be an object'
    });
  }

  // === VALIDATION LAYER 4: data.format ===
  // Check if format exists
  if (!('format' in data) || data.format === null || data.format === undefined) {
    throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
      error: 'data.format is required'
    });
  }

  // Ensure format is a string
  if (typeof data.format !== 'string') {
    throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
      value: data.format,
      received: typeof data.format,
      error: 'data.format must be a string'
    });
  }

  // Validate format value (ONLY 4.0.0 is supported)
  if (data.format !== '4.0.0') {
    throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
      value: data.format,
      supported: '4.0.0',
      error: `Unsupported format "${data.format}". Only format "4.0.0" is supported.`
    });
  }

  // === VALIDATION LAYER 5: data.package ===
  // Check if package object exists
  if (!('package' in data) || data.package === null || data.package === undefined) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'package',
      error: 'data.package is required'
    });
  }

  // Ensure package is an object
  const packageInfo = data.package;
  if (typeof packageInfo !== 'object' || Array.isArray(packageInfo)) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'package',
      received: typeof packageInfo,
      error: 'data.package must be an object'
    });
  }

  // Check if package.code exists (required field)
  if (!('code' in packageInfo) || packageInfo.code === null || packageInfo.code === undefined) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'package.code',
      error: 'data.package.code is required'
    });
  }

  // Ensure package.code is a string
  if (typeof packageInfo.code !== 'string') {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'package.code',
      received: typeof packageInfo.code,
      error: 'data.package.code must be a string'
    });
  }

  // Verify package.code matches options.code
  if (packageInfo.code.trim() !== packageCode) {
    logWarn(`Package code mismatch: options.code="${packageCode}" but data.package.code="${packageInfo.code}". Using options.code.`);
  }

  // === VALIDATION LAYER 6: data.catalogs ===
  // Check if catalogs object exists
  if (!('catalogs' in data) || data.catalogs === null || data.catalogs === undefined) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'catalogs',
      error: 'data.catalogs is required'
    });
  }

  // Ensure catalogs is an object
  const catalogs = data.catalogs;
  if (typeof catalogs !== 'object' || Array.isArray(catalogs)) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'catalogs',
      received: typeof catalogs,
      error: 'data.catalogs must be an object'
    });
  }

  // Check if catalogs has at least one entry
  const catalogKeys = Object.keys(catalogs);
  if (catalogKeys.length === 0) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'catalogs',
      error: 'data.catalogs must contain at least one catalog'
    });
  }

  // === VALIDATION LAYER 7: Individual catalog validation (with try-catch) ===
  // This validation uses try-catch to ensure individual catalog errors don't crash Foundry
  let validCatalogCount = 0;
  const catalogValidationErrors = [];

  for (const catalogKey of catalogKeys) {
    try {
      const catalog = catalogs[catalogKey];

      // Skip null/undefined catalogs (log warning)
      if (catalog === null || catalog === undefined) {
        catalogValidationErrors.push(`${catalogKey}: catalog is ${catalog}`);
        logWarn(`Catalog "${catalogKey}" in package "${packageCode}" is ${catalog}, skipping.`);
        continue;
      }

      // Ensure catalog is an object
      if (typeof catalog !== 'object' || Array.isArray(catalog)) {
        catalogValidationErrors.push(`${catalogKey}: catalog must be an object, got ${typeof catalog}`);
        logWarn(`Catalog "${catalogKey}" in package "${packageCode}" is not an object, skipping.`);
        continue;
      }

      // Check for displayName (recommended but not required)
      if ('displayName' in catalog && catalog.displayName !== null && catalog.displayName !== undefined) {
        if (typeof catalog.displayName !== 'object' || Array.isArray(catalog.displayName)) {
          logWarn(`Catalog "${catalogKey}" has invalid displayName type, skipping validation.`);
        }
      }

      // Check for items array (required for a functional catalog)
      if (!('items' in catalog) || catalog.items === null || catalog.items === undefined) {
        catalogValidationErrors.push(`${catalogKey}: missing required items array`);
        logWarn(`Catalog "${catalogKey}" in package "${packageCode}" is missing items array, skipping.`);
        continue;
      }

      // Ensure items is an array
      if (!Array.isArray(catalog.items)) {
        catalogValidationErrors.push(`${catalogKey}: items must be an array, got ${typeof catalog.items}`);
        logWarn(`Catalog "${catalogKey}" in package "${packageCode}" has non-array items, skipping.`);
        continue;
      }

      // Check if items array has at least one item
      if (catalog.items.length === 0) {
        catalogValidationErrors.push(`${catalogKey}: items array is empty`);
        logWarn(`Catalog "${catalogKey}" in package "${packageCode}" has empty items array, skipping.`);
        continue;
      }

      // Catalog passed all validation checks
      validCatalogCount++;

    } catch (error) {
      // Individual catalog errors should never crash Foundry
      const errorMsg = `${catalogKey}: ${error.message}`;
      catalogValidationErrors.push(errorMsg);
      logError(`Error validating catalog "${catalogKey}" in package "${packageCode}":`, error);
    }
  }

  // Check if we have at least one valid catalog
  if (validCatalogCount === 0) {
    throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
      field: 'catalogs',
      errors: catalogValidationErrors,
      error: `No valid catalogs found. All ${catalogKeys.length} catalog(s) failed validation.`
    });
  }

  // Log warnings for any catalogs that failed validation (but don't fail registration)
  if (catalogValidationErrors.length > 0) {
    logWarn(`Package "${packageCode}" has ${catalogValidationErrors.length} catalog(s) with validation errors:`, catalogValidationErrors);
  }

  // === REGISTRATION: All validation passed, register the package ===
  try {
    await dataManager.registerPackage(packageCode, data);

    logInfo(`Successfully registered package: ${packageCode} with ${validCatalogCount} valid catalog(s)`);

  } catch (error) {
    logError(`Failed to register package ${packageCode}:`, error);

    // Re-throw NominaErrors as-is
    if (error.isNominaError) {
      throw error;
    }

    // Wrap system errors in NominaError
    throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
      packageCode,
      error: error.message
    });
  }
}

/**
 * Register multiple packages at once
 * @param {Object} dataManager - The data manager instance
 * @param {Array<Object>} packages - Array of package registration options
 * @returns {Promise<void>}
 */
export async function registerPackages(dataManager, packages) {
  if (!Array.isArray(packages)) {
    throw new Error('registerPackages expects an array of package options');
  }

  for (const pkg of packages) {
    await registerPackage(dataManager, pkg);
  }
}

/**
 * Check if a package (species-language combination) exists in the loaded data
 * @param {Object} dataManager - The data manager instance
 * @param {string} species - The species code (e.g., 'human', 'elf', 'goblin')
 * @param {string} language - The language code (e.g., 'de', 'en', 'fr')
 * @returns {Promise<boolean>} True if the package exists, false otherwise
 * @throws {NominaError} When validation fails for species or language parameters
 *
 * @example
 * // Check if German human names are available
 * const hasGermanHumans = await hasPackage(dataManager, 'human', 'de');
 * if (hasGermanHumans) {
 *   // Package exists, safe to generate names
 * }
 */
export async function hasPackage(dataManager, species, language) {
  // Validate package code format (species-language) without checking against available packages
  // The goal is to check if a package EXISTS, not to validate against available packages
  const packageCode = `${species}-${language}`;
  const packageCodeValidation = validatePackageCode(packageCode);
  if (!packageCodeValidation.isValid) {
    throw createValidationError(ErrorType.API_INVALID_PACKAGE_CODE, {
      packageCode,
      error: packageCodeValidation.error
    });
  }

  const pkg = dataManager.getPackage(packageCodeValidation.normalized);
  return pkg !== null && pkg !== undefined;
}
