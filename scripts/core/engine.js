/**
 * Engine - Main generation engine for JSON Format 4.0
 * Provides unified generation API following the v4.0 specification
 */

import { addItemIndices } from './selector.js';
import { executePattern, applyTransforms } from './composer.js';
import { getLocalizedText } from '../utils/grammar.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

/**
 * Generation Engine
 * Handles package loading, recipe execution, and output generation
 */
export class Engine {
  constructor() {
    this.packages = new Map(); // Loaded packages by code
  }

  /**
   * Load a v4 package
   * @param {Object} packageData - Package JSON data
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
   * Get loaded package by code
   * @param {string} code - Package code
   * @returns {Object} Package data
   */
  getPackage(code) {
    return this.packages.get(code);
  }

  /**
   * Unified generation function - main API entry point
   * @param {string} packageCode - Package code to use
   * @param {Object} options - Generation options
   * @param {Object} options.filters - Runtime filters per catalog key (e.g. {first_names: {tags: ["female"]}})
   * @param {Object} options.components - Optional component flags (e.g. {useTitle: true, useByname: false})
   * @returns {Object} Generation response
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
      throw new Error('At least one recipe must be specified');
    }

    if (n <= 0 || n > 100) {
      throw new Error('n must be between 1 and 100');
    }

    // Get package
    const pkg = this.getPackage(packageCode);
    if (!pkg) {
      throw new Error(`Package not found: ${packageCode}`);
    }

    // Validate locale
    if (!pkg.package.languages.includes(locale)) {
      logWarn(`Locale ${locale} not in package languages, using fallback`);
    }

    // Generate suggestions
    const suggestions = [];
    const errors = [];
    const seenTexts = new Set();

    let attempts = 0;
    const maxAttempts = n * 10; // Allow retries for uniqueness

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
      } catch (error) {
        logError(`Generation error (attempt ${attempts}):`, error);
        errors.push({
          code: 'generation_failed',
          message: error.message,
          attempt: attempts
        });
      }

      attempts++;
    }

    // Check if we got enough results
    if (suggestions.length === 0) {
      throw new Error('No suggestions could be generated');
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
   * Generate a single result from a recipe
   * @param {Object} pkg - Package data
   * @param {string} recipeId - Recipe ID
   * @param {string} locale - Target locale
   * @param {string} seed - Random seed
   * @param {Object} filters - Runtime filters per catalog key
   * @param {Object} components - Optional component flags
   * @returns {Object} {text, recipe, seed, parts}
   */
  generateOne(pkg, recipeId, locale, seed, filters = {}, components = {}) {
    // Find recipe
    const recipe = this.findRecipe(pkg, recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
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
   * Find recipe by ID in package
   * @param {Object} pkg - Package data
   * @param {string} recipeId - Recipe ID
   * @returns {Object} Recipe object
   */
  findRecipe(pkg, recipeId) {
    if (!pkg.recipes || pkg.recipes.length === 0) {
      return null;
    }

    return pkg.recipes.find(r => r.id === recipeId);
  }

  /**
   * Get available recipes from package
   * @param {string} packageCode - Package code
   * @param {string} locale - Locale for display names
   * @returns {Array} Recipe list with {id, displayName}
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
   * Get available catalogs from package
   * @param {string} packageCode - Package code
   * @param {string} locale - Locale for display names
   * @returns {Array} Catalog list with {key, displayName}
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
   * Get loaded package codes
   * @returns {Array<string>} Package codes
   */
  getLoadedPackages() {
    return Array.from(this.packages.keys());
  }
}

/**
 * Simple hash function for seed-based selection
 * @param {string} str - Input string
 * @returns {number} Hash code
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
 * Get or create global engine instance
 * @returns {Engine}
 */
export function getGlobalEngine() {
  if (!globalEngine) {
    globalEngine = new Engine();
  }
  return globalEngine;
}
