/**
 * Generation API
 * Single entry point for all name generation
 */

import { getGlobalDataManager } from '../core/data-manager.js';
import { logDebug, logWarn, logError } from '../utils/logger.js';

/**
 * Generation options
 * @typedef {Object} GenerationOptions
 * @property {string} packageCode - Package identifier (e.g., "human-de")
 * @property {string} locale - Target language (e.g., "de", "en")
 * @property {number} [n=1] - Number of results to generate
 * @property {string|string[]} recipes - Recipe ID(s) to use
 * @property {string} [seed] - Optional seed for deterministic generation
 * @property {boolean} [allowDuplicates=false] - Allow duplicate results
 */

/**
 * Generator
 * Provides API for generating names from v4.0 packages
 */
export class Generator {
  constructor() {
    this.dataManager = null;
  }

  /**
   * Extract gender from suggestion parts
   * Looks for gender information in tags or attrs of the parts
   * @param {Object} parts - The parts object from the engine suggestion
   * @returns {string|null} - 'male', 'female', 'nonbinary', or null if not found
   */
  _extractGenderFromParts(parts) {
    if (!parts) return null;

    // Priority: Check firstname parts first (FN, FN_OUT), then any part with gender info
    const priorityAliases = ['FN', 'FN_OUT'];

    // First check priority aliases
    for (const alias of priorityAliases) {
      if (parts[alias]) {
        const gender = this._getGenderFromPart(parts[alias]);
        if (gender) return gender;
      }
    }

    // Then check all other parts
    for (const [alias, part] of Object.entries(parts)) {
      if (priorityAliases.includes(alias)) continue; // Skip already checked
      const gender = this._getGenderFromPart(part);
      if (gender) return gender;
    }

    return null;
  }

  /**
   * Extract gender from a single part
   * @param {Object} part - A single part from the parts object
   * @returns {string|null} - 'male', 'female', 'nonbinary', or null
   */
  _getGenderFromPart(part) {
    if (!part) return null;

    // Check tags array first
    if (part.tags && Array.isArray(part.tags)) {
      if (part.tags.includes('male')) return 'male';
      if (part.tags.includes('female')) return 'female';
      if (part.tags.includes('nonbinary')) return 'nonbinary';
    }

    // Check attrs.gender as fallback
    if (part.attrs && part.attrs.gender) {
      const g = part.attrs.gender;
      if (g === 'm' || g === 'male') return 'male';
      if (g === 'f' || g === 'female') return 'female';
      if (g === 'nb' || g === 'nonbinary') return 'nonbinary';
    }

    return null;
  }

  /**
   * Initialize generator
   */
  async initialize() {
    this.dataManager = getGlobalDataManager();
    await this.dataManager.initializeData();
  }

  /**
   * Generate names
   *
 * @param {GenerationOptions} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generate(options) {
    const {
      packageCode,
      locale,
      n = 1,
      recipes,
      seed,
      allowDuplicates = false
    } = options;

    if (!this.dataManager) {
      await this.initialize();
    }

    // Get package
    const pkg = this.dataManager.getPackage(packageCode);

    if (!pkg) {
      throw new Error(`Package not found: ${packageCode}`);
    }

    // Get engine
    const engine = this.dataManager.getEngine();

    // Ensure recipes is an array
    const recipeList = Array.isArray(recipes) ? recipes : [recipes];

    try {
      const result = await engine.generate(packageCode, {
        n,
        locale,
        recipes: recipeList,
        seed,
        allowDuplicates
      });

      // Transform to unified format with gender extraction
      return {
        suggestions: result.suggestions.map(s => ({
          text: s.text,
          recipe: s.recipe,
          parts: s.parts,
          gender: this._extractGenderFromParts(s.parts),
          metadata: {
            seed: s.seed
          }
        })),
        errors: result.errors || []
      };
    } catch (error) {
      logError('Generation error:', error);
      return {
        suggestions: [],
        errors: [{ code: 'generation_failed', message: error.message }]
      };
    }
  }

  /**
   * Get available recipes for a package
   */
  async getAvailableRecipes(packageCode, locale = 'en') {
    if (!this.dataManager) {
      await this.initialize();
    }

    return this.dataManager.getRecipes(packageCode, locale);
  }

  /**
   * Get available packages
   */
  async getAvailablePackages() {
    if (!this.dataManager) {
      await this.initialize();
    }

    const packages = [];
    const packageCodes = this.dataManager.getLoadedPackages();

    for (const code of packageCodes) {
      const pkg = this.dataManager.getPackage(code);
      packages.push({
        code,
        displayName: pkg.data.package.displayName,
        languages: pkg.data.package.languages
      });
    }

    return packages;
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages() {
    if (!this.dataManager) {
      await this.initialize();
    }

    return this.dataManager.getLanguages();
  }

  /**
   * Get available species for a language with localized names
   * @param {string} language - Language code (e.g., 'de')
   * @param {string} locale - UI locale for species names (defaults to language)
   * @returns {Array<Object>} Array of { code, name } objects
   */
  async getAvailableSpecies(language, locale = null) {
    if (!this.dataManager) {
      await this.initialize();
    }

    // Default locale to language if not specified
    return this.dataManager.getSpecies(language, locale || language);
  }

  /**
   * Get available catalogs (categories) for a package
   */
  async getAvailableCatalogs(packageCode, locale = 'en') {
    if (!this.dataManager) {
      await this.initialize();
    }

    return this.dataManager.getCatalogs(packageCode, locale);
  }

  /**
   * Generate a person name from components (firstname, surname, title, nickname)
   * Creates a dynamic recipe based on selected components and gender
   */
  async generatePersonName(packageCode, options = {}) {
    const {
      locale,
      n = 1,
      gender = null, // 'male', 'female', 'nonbinary', or null for any
      components = ['firstname', 'surname'], // Array of: 'firstname', 'surname', 'title', 'nickname'
      format = '{firstname} {surname}', // Name format template
      seed,
      allowDuplicates = false
    } = options;

    if (!this.dataManager) {
      await this.initialize();
    }

    const engine = this.dataManager.getEngine();
    const pkg = this.dataManager.getPackage(packageCode);

    if (!pkg) {
      throw new Error(`Package not found: ${packageCode}`);
    }

    // Build pattern from components and format
    const pattern = [];
    const genderTag = gender === 'male' ? 'male' : gender === 'female' ? 'female' : gender === 'nonbinary' ? 'nonbinary' : null;

    logDebug(`generatePersonName: package=${packageCode}, gender=${gender}, genderTag=${genderTag}, components=`, components);

    // THREE-PHASE APPROACH:
    // Phase 1: Check if firstname is in the components (needed for agreement)
    const hasFirstname = components.includes('firstname');
    const firstnameAlias = hasFirstname ? 'FN' : null;
    const firstnameOutputAlias = hasFirstname ? 'FN_OUT' : null;

    // Phase 2: If we have title or nickname that need agreement, generate firstname FIRST
    // Store as FN for agreement, but output will use FN_OUT
    const needsAgreement = hasFirstname && (components.includes('title') || components.includes('nickname'));
    if (needsAgreement) {
      // Generate firstname first for agreement, but hide from output
      const firstnameBlock = {
        select: {
          from: 'catalog',
          key: 'names',
          where: { tags: ['firstnames'] }
        },
        as: firstnameAlias,
        optional: true,
        ext: { hidden: true } // Don't output text yet - will be output at correct position
      };

      // Apply gender filter to firstname
      if (genderTag) {
        firstnameBlock.select.where.tags.push(genderTag);
      }

      pattern.push(firstnameBlock);
    }

    // Phase 3: Parse format and create pattern
    const formatParts = format.split(/(\{[^}]+\})/g);

    for (const part of formatParts) {
      if (part.startsWith('{') && part.endsWith('}')) {
        // This is a component placeholder
        const componentName = part.slice(1, -1); // Remove { and }

        if (components.includes(componentName)) {
          // All name components now use the "names" catalog
          const catalogKey = 'names';

          // Map component to tag
          const componentTag = componentName === 'firstname' ? 'firstnames' :
                              componentName === 'surname' ? 'surnames' :
                              componentName === 'title' ? 'titles' :
                              componentName === 'nickname' ? 'nicknames' :
                              componentName;

          // Check if catalog exists in the package
          if (!pkg.data.catalogs || !pkg.data.catalogs[catalogKey]) {
            logWarn(`Catalog '${catalogKey}' not found in package '${packageCode}', skipping component '${componentName}'`);
            continue;
          }

          // Build base select block
          const selectBlock = {
            select: {
              from: 'catalog',
              key: catalogKey,
              where: { tags: [componentTag] }
            },
            optional: true // Mark as optional - skip if no items found
          };

          // Handle firstname: apply gender filter and save alias
          if (componentName === 'firstname') {
            if (needsAgreement) {
              // We already generated firstname for agreement at the beginning
              // Now just reference it to output the text at this position
              pattern.push({
                ref: firstnameAlias
              });
            } else {
              // Generate firstname normally (no agreement needed)
              selectBlock.as = firstnameAlias;

              // Apply gender filter to firstname
              if (genderTag) {
                selectBlock.select.where.tags.push(genderTag);
              }
              pattern.push(selectBlock);
            }
          }
          // Handle title: use agreeWith if we have a firstname + add settlement with prep
          else if (componentName === 'title') {
            selectBlock.as = 'T';

            // Add agreement with firstname to inherit gender tags (if firstname exists)
            if (firstnameAlias) {
              selectBlock.ext = {
                agreeWith: {
                  ref: firstnameAlias,
                  features: [
                    {
                      from: 'tags',
                      requireAllOf: ['male', 'female', 'nonbinary']
                    }
                  ],
                  fallback: 'skip' // Skip if no matching gendered item found
                }
              };
            }

            pattern.push(selectBlock);

            // Add space before settlement (only if title was successful)
            pattern.push({
              literal: ' ',
              ext: { optionalWith: 'T' }
            });

            // Add PP block: "von/of Settlement" (only if title was successful)
            // Get preposition from langRules if available, otherwise use defaults
            let prep = 'von'; // Default fallback
            if (pkg.data.langRules && pkg.data.langRules[locale]) {
              const langRule = pkg.data.langRules[locale];
              if (langRule.defaults && langRule.defaults.titlePrep) {
                prep = langRule.defaults.titlePrep;
              }
            } else if (locale === 'en') {
              prep = 'of';
            }

            pattern.push({
              pp: {
                prep: prep,
                ref: {
                  select: {
                    from: 'catalog',
                    key: 'settlements'
                    // No where clause - select from all settlements regardless of tags
                  }
                }
              },
              ext: { optionalWith: 'T' }
            });
          }
          // Handle nickname: use agreeWith if we have a firstname
          else if (componentName === 'nickname' && firstnameAlias) {
            selectBlock.as = 'N';

            // Add agreement with firstname to inherit gender tags
            selectBlock.ext = {
              agreeWith: {
                ref: firstnameAlias,
                features: [
                  {
                    from: 'tags',
                    requireAllOf: ['male', 'female', 'nonbinary']
                  }
                ],
                fallback: 'skip' // Skip if no matching gendered item found
              }
            };
            pattern.push(selectBlock);
          }
          // Handle surname: no gender filter needed
          else if (componentName === 'surname') {
            selectBlock.as = 'LN';
            pattern.push(selectBlock);
          }
        }
      } else if (part.length > 0) {
        // This is literal text (spaces, punctuation, etc.)
        // Don't use trim() here as we want to preserve spaces!
        pattern.push({ literal: part });
      }
    }

    // Create dynamic recipe ID
    const recipeId = `_dynamic_person_${gender || 'any'}_${components.join('_')}`;

    // Create recipe
    const recipe = {
      id: recipeId,
      displayName: { [locale]: `Person (${components.join(' + ')})` },
      pattern: pattern,
      post: ['TrimSpaces', 'CollapseSpaces']
    };

    // Debug: log the generated pattern
    logDebug(`Generated recipe pattern:`, JSON.stringify(pattern, null, 2));

    // Add recipe temporarily to package
    if (!pkg.data.recipes) {
      pkg.data.recipes = [];
    }

    // Replace if exists, or add new
    const existingIndex = pkg.data.recipes.findIndex(r => r.id === recipeId);
    if (existingIndex >= 0) {
      pkg.data.recipes[existingIndex] = recipe;
    } else {
      pkg.data.recipes.push(recipe);
    }

    // Reload package in engine
    engine.loadPackage(pkg.data);

    // Generate using the recipe
    return await this.generate({
      packageCode,
      locale,
      n,
      recipes: [recipeId],
      seed,
      allowDuplicates
    });
  }

  /**
   * Generate from a catalog directly (simplified API)
   * Creates a simple recipe on-the-fly if needed
   */
  async generateFromCatalog(packageCode, catalogKey, options = {}) {
    const {
      locale,
      n = 1,
      tags = [],
      anyOfTags = false, // Use OR logic instead of AND for tags
      seed,
      allowDuplicates = false
    } = options;

    if (!this.dataManager) {
      await this.initialize();
    }

    // Check if there's an existing recipe for this catalog
    const recipes = await this.getAvailableRecipes(packageCode, locale);
    let recipeId = null;

    logDebug(`=== RECIPE LOOKUP DEBUG ===`);
    logDebug(`Looking for recipe for catalog: ${catalogKey}`);
    logDebug(`Available recipes: ${recipes.map(r => r.id).join(', ')}`);
    logDebug(`=== END RECIPE LOOKUP DEBUG ===`);

    // Look for a recipe that uses only this catalog
    // BUT: Skip dynamic recipes to avoid using stale cached recipes with old tags
    const catalogRecipe = recipes.find(r =>
      !r.id.startsWith('_dynamic_') && // Skip dynamic recipes
      (r.id === catalogKey ||
       r.id === `simple_${catalogKey}` ||
       r.displayName?.toLowerCase() === catalogKey.toLowerCase())
    );

    if (catalogRecipe) {
      logDebug(`Found existing static catalog recipe: ${catalogRecipe.id} - using it`);
      recipeId = catalogRecipe.id;
    } else {
      // Create a dynamic simple recipe
      // Include tags in recipe ID to ensure different tag combinations create different recipes
      const tagsSuffix = tags.length > 0 ? `_${tags.sort().join('_')}` : '';
      recipeId = `_dynamic_${catalogKey}${tagsSuffix}`;

      logDebug(`=== RECIPE CREATION DEBUG ===`);
      logDebug(`Creating recipe: ${recipeId}`);
      logDebug(`Tags: [${tags.join(', ')}]`);
      logDebug(`anyOfTags: ${anyOfTags}`);
      logDebug(`=== END RECIPE DEBUG ===`);

      // Register dynamic recipe with engine
      const engine = this.dataManager.getEngine();
      const pkg = this.dataManager.getPackage(packageCode);

      if (!pkg) {
        throw new Error(`Package not found: ${packageCode}`);
      }

      // Create where clause based on tag logic
      let whereClause = null;
      if (tags.length > 0) {
        if (anyOfTags) {
          // OR logic: match ANY of the tags
          whereClause = { anyOfTags: tags };
        } else {
          // AND logic: match ALL tags (single collection)
          whereClause = { tags: tags };
        }
      }

      // Create simple recipe pattern
      const recipe = {
        id: recipeId,
        displayName: { [locale]: catalogKey },
        pattern: [
          {
            select: {
              from: 'catalog',
              key: catalogKey,
              ...(whereClause ? { where: whereClause } : {})
            }
          }
        ],
        post: ['TrimSpaces', 'CollapseSpaces']
      };

      // Add recipe temporarily to package
      if (!pkg.data.recipes) {
        pkg.data.recipes = [];
      }

      // Replace existing recipe with same ID if it exists, or add new one
      const existingIndex = pkg.data.recipes.findIndex(r => r.id === recipeId);
      if (existingIndex >= 0) {
        pkg.data.recipes[existingIndex] = recipe;
      } else {
        pkg.data.recipes.push(recipe);
      }

      // Always reload package in engine to apply changes
      engine.loadPackage(pkg.data);
    }

    // Generate using the recipe
    return await this.generate({
      packageCode,
      locale,
      n,
      recipes: [recipeId],
      seed,
      allowDuplicates
    });
  }

  /**
   * Generate from a collection (v4.0.1)
   * A collection is a preset query that defines catalog + tags filter
   */
  async generateFromCollection(packageCode, collectionKey, options = {}) {
    const {
      locale = 'en',
      n = 1,
      seed,
      allowDuplicates = false
    } = options;

    if (!this.dataManager) {
      await this.initialize();
    }

    // Get the collection
    const collection = this.dataManager.getCollection(packageCode, collectionKey);

    if (!collection) {
      throw new Error(`Collection '${collectionKey}' not found in package '${packageCode}'`);
    }

    // Extract query parameters
    const catalogKey = collection.query?.category;
    const tags = collection.query?.tags || [];

    if (!catalogKey) {
      throw new Error(`Collection '${collectionKey}' has no category defined in query`);
    }

    // Use generateFromCatalog with the collection's query parameters
    return await this.generateFromCatalog(packageCode, catalogKey, {
      locale,
      n,
      tags,
      seed,
      allowDuplicates
    });
  }
}

// Global instance
let globalGenerator = null;

/**
 * Get or create global generator
 */
export function getGlobalGenerator() {
  if (!globalGenerator) {
    globalGenerator = new Generator();
  }
  return globalGenerator;
}

/**
 * Convenience function: Generate names with simple options
 */
export async function generateNames(packageCode, options = {}) {
  const generator = getGlobalGenerator();
  return await generator.generate({
    packageCode,
    ...options
  });
}
