/**
 * Engine - Main generation engine for JSON Format 4.0
 * Provides unified generation API following the v4.0 specification
 */

import { addItemIndices } from './selector.js';
import { executePattern, applyTransforms, validatePatternCatalogs } from './composer.js';
import { getLocalizedText } from '../utils/grammar.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { createNominaError, ErrorType } from '../utils/error-helper.js';

/**
 * Generation Engine
 * Core engine for name generation following the JSON Format 4.0 specification.
 * Handles package loading, recipe execution, pattern processing, and output generation.
 *
 * @class Engine
 * @example
 * const engine = getGlobalEngine();
 * engine.loadPackage(packageData);
 * const result = await engine.generate('human-de', { recipes: ['full_name'], n: 5 });
 */
export class Engine {
  /**
   * Creates a new Engine instance.
   */
  constructor() {
    /** @type {Map<string, Object>} Map of package code to loaded package data */
    this.packages = new Map();
  }

  /**
   * Load a v4.0.0 format package into the engine.
   * Validates the package format and adds indices to catalog items for identity tracking.
   * If a package with the same code already exists, it will be replaced.
   *
   * @param {Object} packageData - Package JSON data in v4.0.0 format
   * @param {string} packageData.format - Must be "4.0.0"
   * @param {Object} packageData.package - Package metadata including code
   * @param {Object} packageData.catalogs - Catalog definitions with items
   * @param {Array} [packageData.recipes] - Recipe definitions
   * @param {Object} [packageData.langRules] - Language-specific grammar rules
   * @param {Object} [packageData.output] - Output transformation configuration
   * @throws {Error} If format version is not 4.0.0
   * @throws {Error} If package.code is missing
   * @throws {Error} If no catalogs are defined
   * @example
   * engine.loadPackage({
   *   format: '4.0.0',
   *   package: { code: 'human-de', languages: ['de'] },
   *   catalogs: { names: { items: [...] } },
   *   recipes: [...]
   * });
   */
  loadPackage(packageData) {
    // Validate format
    if (packageData.format !== '4.0.0') {
      throw new Error(`Invalid format version: ${packageData.format}. Expected 4.0.0`);
    }

    // Validate required fields
    if (!packageData.package || !packageData.package.code) {
      throw new Error('Package must have package.code');
    }

    if (!packageData.catalogs || Object.keys(packageData.catalogs).length === 0) {
      throw new Error('Package must have at least one catalog');
    }

    // Add indices to catalog items for identity tracking
    const packageWithIndices = {
      ...packageData,
      catalogs: {}
    };

    for (const [catalogKey, catalog] of Object.entries(packageData.catalogs)) {
      packageWithIndices.catalogs[catalogKey] = {
        ...catalog,
        items: addItemIndices(catalog.items || [])
      };
    }

    const code = packageData.package.code;
    this.packages.set(code, packageWithIndices);

    logInfo(`Loaded v4 package: ${code}`);
  }

  /**
   * Get a loaded package by its code.
   *
   * @param {string} code - Package code (e.g., "human-de")
   * @returns {Object|undefined} Package data object or undefined if not loaded
   */
  getPackage(code) {
    return this.packages.get(code);
  }

  /**
   * Unified generation function - main API entry point.
   * Generates one or more name suggestions using specified recipes.
   * Handles retries for uniqueness and error recovery.
   *
   * @async
   * @param {string} packageCode - Package code to use (e.g., "human-de")
   * @param {Object} [options={}] - Generation options
   * @param {number} [options.n=1] - Number of suggestions to generate (1-100)
   * @param {string} [options.locale='en'] - Target locale for text output
   * @param {string[]} [options.recipes=[]] - Array of recipe IDs to use
   * @param {string|null} [options.seed=null] - Optional seed for deterministic generation
   * @param {string} [options.distinctBy='text'] - Field to use for duplicate detection
   * @param {boolean} [options.allowDuplicates=false] - Allow duplicate results
   * @param {Object} [options.filters={}] - Runtime filters per catalog key (e.g., {names: {tags: ["female"]}})
   * @param {Object} [options.components={}] - Optional component flags (e.g., {useTitle: true})
   * @returns {Promise<Object>} Generation response with suggestions and optional errors
   * @returns {Array<Object>} return.suggestions - Array of generated suggestions
   * @returns {Array<Object>} [return.errors] - Array of errors if any occurred
   * @throws {Error} If no recipes specified or n is out of range
   * @example
   * const result = await engine.generate('human-de', {
   *   n: 5,
   *   locale: 'de',
   *   recipes: ['full_name'],
   *   filters: { names: { tags: ['female'] } }
   * });
   * // Returns: { suggestions: [{ text: 'Anna Müller', recipe: 'full_name', parts: {...} }, ...] }
   */
  async generate(packageCode, options = {}) {
    const {
      n = 1,
      locale = 'en',
      recipes = [],
      seed = null,
      distinctBy = 'text',
      allowDuplicates = false,
      filters = {},
      components = {}
    } = options;

    // Validate inputs
    if (!recipes || recipes.length === 0) {
      throw createNominaError(ErrorType.RECIPE_MISSING, {});
    }

    if (n <= 0 || n > 100) {
      throw new Error('n must be between 1 and 100');
    }

    // Get package
    const pkg = this.getPackage(packageCode);
    if (!pkg) {
      throw createNominaError(ErrorType.PACKAGE_NOT_FOUND, {
        species: packageCode,
        language: 'unknown'
      });
    }

    // Validate locale
    if (!pkg.package.languages.includes(locale)) {
      logWarn(`Locale ${locale} not in package languages, using fallback`);
    }

    // Generate suggestions
    const suggestions = [];
    const errors = [];
    const seenTexts = new Set();
    let lastErrorMessage = null;
    let consecutiveErrors = 0;

    let attempts = 0;
    const maxAttempts = n * 10; // Allow retries for uniqueness
    const maxConsecutiveErrors = 3; // Stop after 3 consecutive identical errors (structural problem)

    while (suggestions.length < n && attempts < maxAttempts) {
      try {
        // Select recipe (cycle through if multiple)
        const recipeId = recipes[suggestions.length % recipes.length];

        // Generate sub-seed
        const genSeed = seed ? `${seed}:${attempts}` : null;

        // Generate single result
        const result = this.generateOne(pkg, recipeId, locale, genSeed, filters, components);

        // Check for duplicates if needed
        if (!allowDuplicates && seenTexts.has(result.text)) {
          attempts++;
          continue;
        }

        seenTexts.add(result.text);
        suggestions.push(result);

        // Reset error counter on success
        consecutiveErrors = 0;
        lastErrorMessage = null;
      } catch (error) {
        const errorMessage = error.message;

        // Check if this is a structural error that won't be fixed by retrying
        const isStructuralError =
          errorMessage.includes('Catalog not found') ||
          errorMessage.includes('missing required catalogs') ||
          errorMessage.includes('Recipe not found') ||
          errorMessage.includes('Package not found') ||
          errorMessage.includes('Invalid format');

        if (isStructuralError) {
          // Structural errors: log once and stop immediately
          logError(`Structural error (not retrying):`, error);
          errors.push({
            code: 'structural_error',
            message: errorMessage,
            attempt: attempts
          });
          break; // Exit loop - retrying won't help
        }

        // Track consecutive identical errors
        if (errorMessage === lastErrorMessage) {
          consecutiveErrors++;
        } else {
          consecutiveErrors = 1;
          lastErrorMessage = errorMessage;
        }

        // If we get the same error multiple times, it's likely structural
        if (consecutiveErrors >= maxConsecutiveErrors) {
          logError(`Repeated error (${consecutiveErrors}x), stopping:`, error);
          errors.push({
            code: 'repeated_error',
            message: errorMessage,
            attempt: attempts
          });
          break; // Exit loop - this error keeps happening
        }

        logWarn(`Generation error (attempt ${attempts}):`, error.message);
        errors.push({
          code: 'generation_failed',
          message: errorMessage,
          attempt: attempts
        });
      }

      attempts++;
    }

    // Check if we got enough results
    if (suggestions.length === 0) {
      // If we have errors, include the first error message in the thrown error
      if (errors.length > 0) {
        const firstError = errors[0];
        throw new Error(firstError.message);
      }
      throw createNominaError(ErrorType.GENERATION_FAILED, {});
    }

    if (suggestions.length < n) {
      logWarn(`Only generated ${suggestions.length}/${n} suggestions`);
    }

    return {
      suggestions,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Generate a single name result from a recipe.
   * Handles pattern selection (direct or oneOf), pattern execution, and post-processing transforms.
   *
   * @param {Object} pkg - Loaded package data
   * @param {string} recipeId - Recipe ID to execute
   * @param {string} locale - Target locale for text output
   * @param {string|null} seed - Random seed for deterministic generation
   * @param {Object} [filters={}] - Runtime filters per catalog key
   * @param {Object} [components={}] - Optional component flags for conditional blocks
   * @returns {Object} Generation result
   * @returns {string} return.text - Generated name text
   * @returns {string} return.recipe - Recipe ID used
   * @returns {string} [return.seed] - Seed used (if provided)
   * @returns {Object} return.parts - Named parts from pattern execution
   * @returns {string[]} [return.tags] - Aggregated tags from all parts
   * @throws {Error} If recipe not found or pattern execution fails
   */
  generateOne(pkg, recipeId, locale, seed, filters = {}, components = {}) {
    // Find recipe
    const recipe = this.findRecipe(pkg, recipeId);
    if (!recipe) {
      throw createNominaError(ErrorType.RECIPE_NOT_FOUND, {
        recipe: recipeId
      });
    }

    // Determine pattern to use
    let pattern;

    if (recipe.pattern) {
      // Direct pattern
      pattern = recipe.pattern;
    } else if (recipe.oneOf) {
      // Select random pattern from oneOf
      const options = recipe.oneOf;

      // Use seed for deterministic selection if provided
      let selectedIndex;
      if (seed) {
        selectedIndex = Math.abs(hashCode(seed)) % options.length;
      } else {
        selectedIndex = Math.floor(Math.random() * options.length);
      }

      const selected = options[selectedIndex];

      if (selected.pattern) {
        pattern = selected.pattern;
      } else if (selected.ref) {
        // Reference to another recipe
        return this.generateOne(pkg, selected.ref, locale, seed, filters, components);
      } else {
        throw new Error('Invalid oneOf entry: must have pattern or ref');
      }
    } else {
      throw new Error('Recipe must have pattern or oneOf');
    }

    // Prepare context for generator support and cross-package references
    const context = {
      recipes: pkg.recipes || [],
      collections: pkg.collections || [],
      executeRecipe: (recipeId, recipLocale, recipeSeed, params) => {
        // Execute another recipe within this package
        const result = this.generateOne(pkg, recipeId, recipLocale, recipeSeed, filters, components);
        return result.text;
      },
      getPackageCatalog: (packageCode, catalogKey) => {
        // Get catalog from another package
        const targetPkg = this.getPackage(packageCode);
        if (!targetPkg) {
          throw new Error(`Cross-package reference failed: Package not found: ${packageCode}`);
        }
        const catalog = targetPkg.catalogs[catalogKey];
        if (!catalog) {
          throw new Error(`Cross-package reference failed: Catalog not found: ${packageCode}:${catalogKey}`);
        }
        return catalog;
      }
    };

    // Validate pattern catalogs before execution
    const validation = validatePatternCatalogs(pattern, pkg.catalogs);
    if (!validation.valid) {
      const errorMsg = `Recipe '${recipeId}' references missing required catalogs: ${validation.missingRequired.join(', ')}. ` +
        `Available catalogs: ${Object.keys(pkg.catalogs || {}).join(', ') || '(none)'}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    // Execute pattern
    const { text: rawText, parts } = executePattern(
      pattern,
      pkg.catalogs,
      pkg.langRules || {},
      locale,
      seed,
      filters,
      components,
      context
    );

    // Apply transforms
    const transforms = [
      ...(pkg.output?.transforms || []),
      ...(recipe.post || [])
    ];

    const finalText = applyTransforms(rawText, transforms);

    // Extract tags from parts for convenience
    const tags = [];
    for (const part of Object.values(parts)) {
      if (part && part.tags && Array.isArray(part.tags)) {
        tags.push(...part.tags);
      }
    }

    return {
      text: finalText,
      recipe: recipeId,
      seed: seed || undefined,
      parts,
      tags: tags.length > 0 ? [...new Set(tags)] : undefined // Remove duplicates
    };
  }

  /**
   * Find a recipe by its ID within a package.
   *
   * @param {Object} pkg - Loaded package data
   * @param {string} recipeId - Recipe ID to find
   * @returns {Object|null} Recipe object if found, null otherwise
   */
  findRecipe(pkg, recipeId) {
    if (!pkg.recipes || pkg.recipes.length === 0) {
      return null;
    }

    return pkg.recipes.find(r => r.id === recipeId);
  }

  /**
   * Get all available recipes from a package with localized display names.
   *
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @param {string} [locale='en'] - Locale for display name resolution
   * @returns {Array<{id: string, displayName: string}>} Array of recipe metadata
   * @example
   * const recipes = engine.getAvailableRecipes('human-de', 'de');
   * // Returns: [{ id: 'full_name', displayName: 'Vollständiger Name' }, ...]
   */
  getAvailableRecipes(packageCode, locale = 'en') {
    const pkg = this.getPackage(packageCode);
    if (!pkg || !pkg.recipes) {
      return [];
    }

    return pkg.recipes.map(recipe => ({
      id: recipe.id,
      displayName: getLocalizedText(recipe.displayName, locale, pkg.package.languages[0])
    }));
  }

  /**
   * Get all available catalogs from a package with localized display names.
   *
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @param {string} [locale='en'] - Locale for display name resolution
   * @returns {Array<{key: string, displayName: string}>} Array of catalog metadata
   * @example
   * const catalogs = engine.getAvailableCatalogs('human-de', 'de');
   * // Returns: [{ key: 'names', displayName: 'Namen' }, { key: 'settlements', displayName: 'Siedlungen' }]
   */
  getAvailableCatalogs(packageCode, locale = 'en') {
    const pkg = this.getPackage(packageCode);
    if (!pkg || !pkg.catalogs) {
      return [];
    }

    return Object.entries(pkg.catalogs).map(([key, catalog]) => ({
      key,
      displayName: getLocalizedText(catalog.displayName, locale, pkg.package.languages[0])
    }));
  }

  /**
   * Get all loaded package codes.
   *
   * @returns {string[]} Array of package codes (e.g., ["human-de", "human-en", "elf-de"])
   */
  getLoadedPackages() {
    return Array.from(this.packages.keys());
  }
}

/**
 * Simple hash function for seed-based deterministic selection.
 * Used to convert string seeds into numeric values for random selection.
 *
 * @param {string} str - Input string to hash
 * @returns {number} 32-bit integer hash code
 * @private
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Global engine instance
let globalEngine = null;

/**
 * Get or create the global Engine singleton instance.
 * The Engine is shared across all components to ensure consistent package state.
 *
 * @returns {Engine} The global Engine instance
 * @example
 * const engine = getGlobalEngine();
 * engine.loadPackage(packageData);
 */
export function getGlobalEngine() {
  if (!globalEngine) {
    globalEngine = new Engine();
  }
  return globalEngine;
}
