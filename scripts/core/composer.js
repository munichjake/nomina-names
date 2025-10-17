/**
 * Composer - Pattern execution and output transformation
 * Implements recipe pattern execution from JSON Format 4.0 specification
 */

import { selectFromCatalog } from './selector.js';
import { buildPPPhrase, getLocalizedText, adaptTitleToGender } from '../utils/grammar.js';
import { logDebug, logWarn, logError } from '../utils/logger.js';

/**
 * Execute a recipe pattern and return generated text
 * @param {Array} pattern - Array of pattern blocks (select, literal, pp)
 * @param {Object} catalogs - Available catalogs
 * @param {Object} langRules - Language rules for grammar
 * @param {string} locale - Target locale
 * @param {string} seed - Random seed for deterministic generation
 * @param {Object} filters - Runtime filters per catalog key
 * @param {Object} components - Optional component flags
 * @param {Object} context - Execution context (recipes, package data)
 * @returns {Object} {text, parts} - Generated text and component parts
 */
export function executePattern(pattern, catalogs, langRules, locale, seed, filters = {}, components = {}, context = {}) {
  const parts = {}; // Store aliased selections
  const tokens = []; // Collect output tokens

  let blockIndex = 0;

  for (const block of pattern) {
    // Check if block is optional and should be skipped
    if (block.ext?.optional && block.ext?.componentKey) {
      const componentKey = block.ext.componentKey;
      if (components[componentKey] === false) {
        blockIndex++;
        continue; // Skip this block
      }
    }

    try {
      // Generate sub-seed for this block
      const blockSeed = seed ? `${seed}:b${blockIndex}` : null;

      if (block.select) {
        // SELECT block (legacy - still supported)
        const result = handleSelectBlock(block, catalogs, locale, parts, blockSeed, filters, context);

        // Check if block should be skipped
        if (result.skip) {
          blockIndex++;
          continue;
        }

        // Apply transformation if specified
        let finalText = result.text;
        if (block.transform) {
          // Normalize transform type to lowercase for case-insensitive comparison
          const transformType = typeof block.transform === 'string'
            ? block.transform.toLowerCase()
            : (typeof block.transform === 'object' && block.transform.type)
              ? block.transform.type.toLowerCase()
              : null;

          if (transformType === 'genderadapt') {
            finalText = applyGenderAdaptation(result.item, parts, langRules, locale);
          } else if (transformType === 'demonym') {
            // Extract toponym from item text
            const toponym = result.text;
            finalText = applyDemonymTransform(toponym, locale);
          } else if (transformType === 'genitive' || transformType === 'possessive') {
            // Convert name to genitive/possessive form
            const name = result.text;
            const gramData = result.item.gram || {};
            finalText = applyGenitiveTransform(name, locale, gramData);
          }
        }

        // Only add to output if not hidden (ext.hidden is for pre-generating aliases)
        if (!block.ext?.hidden) {
          tokens.push(finalText);
        }

        // Store alias if specified
        if (block.as) {
          parts[block.as] = result.item;
        }
      } else if (block.generate) {
        // GENERATE block (new syntax)
        const result = handleGenerateBlock(block, catalogs, langRules, locale, parts, blockSeed, filters, context);

        // Check if block should be skipped
        if (result.skip) {
          blockIndex++;
          continue;
        }

        // Apply transformation if specified
        let finalText = result.text;
        if (block.transform) {
          // Normalize transform type to lowercase for case-insensitive comparison
          const transformType = typeof block.transform === 'string'
            ? block.transform.toLowerCase()
            : (typeof block.transform === 'object' && block.transform.type)
              ? block.transform.type.toLowerCase()
              : null;

          if (transformType === 'genderadapt') {
            finalText = applyGenderAdaptation(result.item, parts, langRules, locale);
          } else if (transformType === 'demonym') {
            // Extract toponym from item text
            const toponym = result.text;
            finalText = applyDemonymTransform(toponym, locale);
          } else if (transformType === 'genitive' || transformType === 'possessive') {
            // Convert name to genitive/possessive form
            const name = result.text;
            const gramData = result.item.gram || {};
            finalText = applyGenitiveTransform(name, locale, gramData);
          }
        }

        // Only add to output if not hidden (ext.hidden is for pre-generating aliases)
        if (!block.ext?.hidden) {
          tokens.push(finalText);
        }

        // Store alias if specified
        if (block.as) {
          parts[block.as] = result.item;
        }
      } else if (block.literal) {
        // LITERAL block
        // Check if this literal should be skipped based on ext.optionalWith
        if (block.ext?.optionalWith) {
          const dependsOnAlias = block.ext.optionalWith;
          if (!parts[dependsOnAlias]) {
            // Skip this literal if the referenced alias wasn't set
            blockIndex++;
            continue;
          }
        }

        const literalText = getLocalizedText(block.literal, locale);
        tokens.push(literalText);
      } else if (block.pp) {
        // PP (preposition-article-phrase) block
        const ppText = handlePPBlock(block, catalogs, langRules, locale, parts, blockSeed, filters, context);
        tokens.push(ppText);
      } else if (block.ref) {
        // REF block - insert text from a previously generated alias
        const refAlias = block.ref;
        if (!parts[refAlias]) {
          logWarn(`Reference alias "${refAlias}" not found in parts`);
        } else {
          const refText = getLocalizedText(parts[refAlias].t, locale);
          tokens.push(refText);
        }
      } else {
        logWarn('Unknown block type:', block);
      }

      blockIndex++;
    } catch (error) {
      logError(`Error executing block ${blockIndex}:`, error);
      throw error;
    }
  }

  // Join tokens to create final text
  const text = tokens.join('');

  return { text, parts };
}

/**
 * Handle SELECT block execution
 * @param {Object} block - Select block
 * @param {Object} catalogs - Available catalogs
 * @param {string} locale - Target locale
 * @param {Object} parts - Existing aliased parts
 * @param {string} seed - Random seed
 * @param {Object} filters - Runtime filters per catalog key
 * @param {Object} context - Execution context (recipes, package data)
 * @returns {Object} {text, item}
 */
function handleSelectBlock(block, catalogs, locale, parts, seed, filters = {}, context = {}) {
  const { select, distinctFrom } = block;

  // Handle different source types
  if (select.from === 'generator') {
    // Generator: execute a recipe to generate text
    return handleGeneratorSelect(select, locale, seed, context);
  } else if (select.from === 'catalog') {
    // Catalog: select from existing items (original behavior)
    return handleCatalogSelect(select, catalogs, locale, parts, seed, filters, distinctFrom, block.ext, context);
  } else {
    throw new Error(`Unsupported select source: ${select.from}`);
  }
}

/**
 * Handle generator selection (execute a recipe)
 * @param {Object} select - Select configuration
 * @param {string} locale - Target locale
 * @param {string} seed - Random seed
 * @param {Object} context - Execution context
 * @returns {Object} {text, item}
 */
function handleGeneratorSelect(select, locale, seed, context) {
  const { key: recipeId, params = {} } = select;

  // Validate context
  if (!context.recipes || !context.executeRecipe) {
    throw new Error('Generator requires context with recipes and executeRecipe function');
  }

  // Find the recipe
  const recipe = context.recipes.find(r => r.id === recipeId);
  if (!recipe) {
    throw new Error(`Generator recipe not found: ${recipeId}`);
  }

  // Execute the recipe to generate text
  const generatedText = context.executeRecipe(recipeId, locale, seed, params);

  // Create a synthetic item for consistency with catalog selection
  // This allows transforms and other operations to work the same way
  const syntheticItem = {
    t: { [locale]: generatedText },
    tags: ['generated'],
    _synthetic: true
  };

  return { text: generatedText, item: syntheticItem };
}

/**
 * Handle catalog selection (original implementation)
 * @param {Object} select - Select configuration
 * @param {Object} catalogs - Available catalogs
 * @param {string} locale - Target locale
 * @param {Object} parts - Existing aliased parts
 * @param {string} seed - Random seed
 * @param {Object} filters - Runtime filters per catalog key
 * @param {Array} distinctFrom - Aliases to be distinct from
 * @param {Object} blockExt - Block extension data (for agreeWith etc.)
 * @param {Object} context - Execution context (for cross-package references)
 * @returns {Object} {text, item}
 */
function handleCatalogSelect(select, catalogs, locale, parts, seed, filters = {}, distinctFrom, blockExt = {}, context = {}) {

  // Parse catalog key - support cross-package references
  // Format: "packageCode:catalogKey" or just "catalogKey" for current package
  let catalog;
  let catalogKey = select.key;

  if (catalogKey.includes(':')) {
    // Cross-package reference
    const [packageCode, remoteCatalogKey] = catalogKey.split(':', 2);

    if (!context.getPackageCatalog) {
      throw new Error(`Cross-package references require context.getPackageCatalog function`);
    }

    catalog = context.getPackageCatalog(packageCode, remoteCatalogKey);
    catalogKey = remoteCatalogKey; // Use just the catalog key for filters
  } else {
    // Local catalog
    catalog = catalogs[catalogKey];
  }

  if (!catalog || !catalog.items) {
    throw new Error(`Catalog not found: ${select.key}`);
  }

  // Merge recipe where with runtime filters for this catalog key
  let effectiveWhere = mergeFilters(select.where, filters[catalogKey]);

  // Apply ext.agreeWith if present
  const agreeCfg = blockExt?.agreeWith;
  if (agreeCfg) {
    const agreementFilters = applyAgreement(agreeCfg, parts);
    effectiveWhere = mergeFilters(effectiveWhere, agreementFilters);
  }

  // Resolve distinctFrom aliases to actual item identities
  const distinctFromIds = [];
  if (distinctFrom && Array.isArray(distinctFrom)) {
    for (const alias of distinctFrom) {
      if (parts[alias]) {
        const identity = getItemIdentity(parts[alias]);
        distinctFromIds.push(identity);
      }
    }
  }

  // Select item from catalog with fallback handling
  let candidates = catalog.items;
  try {
    const selectedItem = selectFromCatalog(candidates, {
      where: effectiveWhere,
      distinctFrom: distinctFromIds,
      seed
    });

    // Extract text in target locale
    const text = getLocalizedText(selectedItem.t, locale);

    return { text, item: selectedItem };
  } catch (error) {
    // Handle optional blocks - skip if no items found
    if (blockExt?.optional === true && error.message.includes('SelectionError')) {
      logWarn(`Optional component skipped: ${error.message}`);
      return { skip: true };
    }

    // Handle fallback if agreeWith is configured and selection failed
    if (agreeCfg?.fallback) {
      if (agreeCfg.fallback === 'skip') {
        return { skip: true };
      } else if (agreeCfg.fallback === 'error') {
        throw error;
      } else if (typeof agreeCfg.fallback === 'object') {
        // Apply fallback filters
        const fallbackWhere = mergeFilters(effectiveWhere, agreeCfg.fallback);
        const selectedItem = selectFromCatalog(candidates, {
          where: fallbackWhere,
          distinctFrom: distinctFromIds,
          seed
        });
        const text = getLocalizedText(selectedItem.t, locale);
        return { text, item: selectedItem };
      }
    }
    throw error;
  }
}

/**
 * Handle PP (preposition-article-phrase) block execution
 * @param {Object} block - PP block
 * @param {Object} catalogs - Available catalogs
 * @param {Object} langRules - Language rules
 * @param {string} locale - Target locale
 * @param {Object} parts - Existing aliased parts
 * @param {string} seed - Random seed
 * @param {Object} filters - Runtime filters per catalog key
 * @param {Object} context - Execution context (recipes, package data)
 * @returns {string} Formatted pp phrase
 */
function handlePPBlock(block, catalogs, langRules, locale, parts, seed, filters = {}, context = {}) {
  const { pp } = block;
  const prep = pp.prep;

  // Resolve reference
  let targetItem;

  if (typeof pp.ref === 'string') {
    // Reference to alias
    targetItem = parts[pp.ref];
    if (!targetItem) {
      throw new Error(`PP Error: Unknown alias "${pp.ref}"`);
    }
  } else if (pp.ref && pp.ref.select) {
    // Inline select
    const inlineBlock = { select: pp.ref.select };
    const result = handleSelectBlock(inlineBlock, catalogs, locale, parts, seed, filters, context);
    targetItem = result.item;
  } else {
    throw new Error('PP Error: Invalid ref - must be alias string or inline select');
  }

  // Build phrase using grammar rules
  return buildPPPhrase(targetItem, locale, prep, langRules);
}

/**
 * Handle GENERATE block execution (new syntax)
 * @param {Object} block - Generate block
 * @param {Object} catalogs - Available catalogs
 * @param {Object} langRules - Language rules
 * @param {string} locale - Target locale
 * @param {Object} parts - Existing aliased parts
 * @param {string} seed - Random seed
 * @param {Object} filters - Runtime filters per catalog key
 * @param {Object} context - Execution context (recipes, package data)
 * @returns {Object} {text, item, skip?}
 */
function handleGenerateBlock(block, catalogs, langRules, locale, parts, seed, filters = {}, context = {}) {
  const { generate } = block;
  const { from, key, collection, where } = generate;

  // Smart detection: if 'from' is 'recipe' or 'catalog', use explicit mode
  // Otherwise, treat 'from' as a package/category name (simplified syntax)
  if (from === 'recipe') {
    // Explicit recipe mode
    if (!context.recipes || !context.executeRecipe) {
      const errorMsg = `GENERATE Error: Recipe execution requires context.\n` +
        `Query: { "from": "recipe", "key": "${key}" }\n` +
        `Problem: Missing context.recipes or context.executeRecipe\n` +
        `Available context keys: ${Object.keys(context).join(', ')}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const recipe = context.recipes.find(r => r.id === key);
    if (!recipe) {
      const availableRecipes = context.recipes.map(r => r.id).join(', ');
      const errorMsg = `GENERATE Error: Recipe not found.\n` +
        `Query: { "from": "recipe", "key": "${key}" }\n` +
        `Requested recipe: "${key}"\n` +
        `Available recipes: ${availableRecipes || '(none)'}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const generatedText = context.executeRecipe(key, locale, seed, {});

      const syntheticItem = {
        t: { [locale]: generatedText },
        tags: ['generated'],
        _synthetic: true
      };

      return { text: generatedText, item: syntheticItem };
    } catch (error) {
      const errorMsg = `GENERATE Error: Recipe execution failed.\n` +
        `Query: { "from": "recipe", "key": "${key}" }\n` +
        `Recipe: "${key}"\n` +
        `Locale: ${locale}\n` +
        `Original error: ${error.message}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

  } else if (from === 'catalog') {
    // Explicit catalog mode
    // Generate from a catalog (optionally filtered by collection)
    let catalog;
    let catalogKey = key;

    // Parse catalog key - support cross-package references
    if (catalogKey.includes(':')) {
      const [packageCode, remoteCatalogKey] = catalogKey.split(':', 2);

      if (!context.getPackageCatalog) {
        const errorMsg = `GENERATE Error: Cross-package reference not supported.\n` +
          `Query: { "from": "catalog", "key": "${key}", "collection": "${collection || 'none'}" }\n` +
          `Problem: context.getPackageCatalog function is missing\n` +
          `Requested: ${packageCode}:${remoteCatalogKey}`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        catalog = context.getPackageCatalog(packageCode, remoteCatalogKey);
        catalogKey = remoteCatalogKey;
      } catch (error) {
        const errorMsg = `GENERATE Error: Cross-package catalog not found.\n` +
          `Query: { "from": "catalog", "key": "${key}", "collection": "${collection || 'none'}" }\n` +
          `Requested package: "${packageCode}"\n` +
          `Requested catalog: "${remoteCatalogKey}"\n` +
          `Original error: ${error.message}`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      catalog = catalogs[catalogKey];
    }

    if (!catalog || !catalog.items) {
      const availableCatalogs = Object.keys(catalogs).join(', ');
      const errorMsg = `GENERATE Error: Catalog not found.\n` +
        `Query: { "from": "catalog", "key": "${key}", "collection": "${collection || 'none'}" }\n` +
        `Requested catalog: "${key}"\n` +
        `Available catalogs: ${availableCatalogs || '(none)'}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    // If collection is specified, filter by collection
    let candidates = catalog.items;
    let effectiveWhere = where || {};

    if (collection) {
      // Look up collection in the package
      if (!context.collections) {
        const errorMsg = `GENERATE Error: Collections not available.\n` +
          `Query: { "from": "catalog", "key": "${key}", "collection": "${collection}" }\n` +
          `Problem: context.collections is missing\n` +
          `Available context keys: ${Object.keys(context).join(', ')}`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      const collectionDef = context.collections.find(c => c.key === collection);
      if (!collectionDef) {
        const availableCollections = context.collections.map(c => c.key).join(', ');
        const errorMsg = `GENERATE Error: Collection not found.\n` +
          `Query: { "from": "catalog", "key": "${key}", "collection": "${collection}" }\n` +
          `Requested collection: "${collection}"\n` +
          `Available collections: ${availableCollections || '(none)'}`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      if (collectionDef.query) {
        // Merge collection query with block where
        effectiveWhere = mergeFilters(collectionDef.query.tags ? { tags: collectionDef.query.tags } : {}, effectiveWhere);
      }
    }

    // Select from catalog
    try {
      const selectedItem = selectFromCatalog(candidates, {
        where: effectiveWhere,
        seed
      });

      const text = getLocalizedText(selectedItem.t, locale);
      return { text, item: selectedItem };
    } catch (error) {
      const errorMsg = `GENERATE Error: Catalog selection failed.\n` +
        `Query: { "from": "catalog", "key": "${key}", "collection": "${collection || 'none'}", "where": ${JSON.stringify(where || {})} }\n` +
        `Catalog: "${key}"\n` +
        `Effective filters: ${JSON.stringify(effectiveWhere)}\n` +
        `Total items in catalog: ${candidates.length}\n` +
        `Original error: ${error.message}`;
      logError(errorMsg);
      throw new Error(errorMsg);
    }

  } else {
    // Simplified syntax: 'from' is a package/category name
    // Example: { "from": "settlements", "collection": "procedural" }
    const packageOrCategoryName = from;

    // If collection is specified, look up the collection and execute a random recipe from it
    if (collection) {
      if (!context.collections) {
        const errorMsg = `GENERATE Error: Collections not available in context.\n` +
          `Query: { "from": "${from}", "collection": "${collection}" }\n` +
          `Problem: context.collections is missing\n` +
          `Available context keys: ${Object.keys(context).join(', ')}\n` +
          `Hint: Make sure the package has collections defined`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      const collectionDef = context.collections.find(c => c.key === collection);
      if (!collectionDef) {
        const availableCollections = context.collections.map(c => `"${c.key}"`).join(', ');
        const errorMsg = `GENERATE Error: Collection not found.\n` +
          `Query: { "from": "${from}", "collection": "${collection}" }\n` +
          `Requested collection: "${collection}"\n` +
          `Available collections: ${availableCollections || '(none)'}\n` +
          `Package: ${from}`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      // Check if collection has recipes
      if (collectionDef.query && collectionDef.query.recipes && collectionDef.query.recipes.length > 0) {
        // Pick a random recipe from the collection
        const recipes = collectionDef.query.recipes;
        const randomIndex = seed ? hashSeed(seed) % recipes.length : Math.floor(Math.random() * recipes.length);
        const selectedRecipeId = recipes[randomIndex];

        // Execute the recipe
        if (!context.executeRecipe) {
          const errorMsg = `GENERATE Error: Recipe execution not available.\n` +
            `Query: { "from": "${from}", "collection": "${collection}" }\n` +
            `Selected recipe: "${selectedRecipeId}"\n` +
            `Problem: context.executeRecipe function is missing`;
          logError(errorMsg);
          throw new Error(errorMsg);
        }

        try {
          const generatedText = context.executeRecipe(selectedRecipeId, locale, seed, {});

          const syntheticItem = {
            t: { [locale]: generatedText },
            tags: ['generated', collection],
            _synthetic: true
          };

          logDebug(`GENERATE Success: Generated from collection "${collection}" using recipe "${selectedRecipeId}"`);

          return { text: generatedText, item: syntheticItem };
        } catch (error) {
          const errorMsg = `GENERATE Error: Recipe execution failed.\n` +
            `Query: { "from": "${from}", "collection": "${collection}" }\n` +
            `Collection: "${collection}"\n` +
            `Selected recipe: "${selectedRecipeId}"\n` +
            `Available recipes in collection: ${recipes.join(', ')}\n` +
            `Locale: ${locale}\n` +
            `Original error: ${error.message}`;
          logError(errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        const errorMsg = `GENERATE Error: Collection has no recipes.\n` +
          `Query: { "from": "${from}", "collection": "${collection}" }\n` +
          `Collection: "${collection}"\n` +
          `Problem: Collection.query.recipes is empty or missing\n` +
          `Collection structure: ${JSON.stringify(collectionDef.query || {}, null, 2)}\n` +
          `Hint: Collections must define recipes to use GENERATE. Use SELECT to pick catalog items.`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      // No collection specified - find a default collection or first recipe
      // GENERATE should always produce complete results, not catalog items

      if (!context.collections || context.collections.length === 0) {
        const errorMsg = `GENERATE Error: No collection specified and none available.\n` +
          `Query: { "from": "${from}" }\n` +
          `Problem: No collections defined in package\n` +
          `Solution 1: Specify a collection: { "from": "${from}", "collection": "collection_key" }\n` +
          `Solution 2: Use SELECT to pick individual catalog items: { "select": { "from": "catalog", "key": "${from}" } }`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      // Look for a default/first collection in this package that has recipes
      const defaultCollection = context.collections.find(c =>
        c.query && c.query.recipes && c.query.recipes.length > 0
      );

      if (!defaultCollection) {
        const availableCollections = context.collections.map(c => `"${c.key}" (recipes: ${c.query?.recipes?.length || 0})`).join(', ');
        const errorMsg = `GENERATE Error: No collections with recipes found.\n` +
          `Query: { "from": "${from}" }\n` +
          `Problem: Package has ${context.collections.length} collection(s) but none have recipes defined\n` +
          `Available collections: ${availableCollections}\n` +
          `Solution 1: Specify a collection with recipes: { "from": "${from}", "collection": "collection_key" }\n` +
          `Solution 2: Use explicit recipe mode: { "generate": { "from": "recipe", "key": "recipe_id" } }\n` +
          `Solution 3: Use SELECT to pick catalog items: { "select": { "from": "catalog", "key": "${from}" } }`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      // Use the first recipe from the default collection
      const recipes = defaultCollection.query.recipes;
      const randomIndex = seed ? hashSeed(seed) % recipes.length : Math.floor(Math.random() * recipes.length);
      const selectedRecipeId = recipes[randomIndex];

      // Execute the recipe
      if (!context.executeRecipe) {
        const errorMsg = `GENERATE Error: Recipe execution not available.\n` +
          `Query: { "from": "${from}" }\n` +
          `Auto-selected collection: "${defaultCollection.key}"\n` +
          `Selected recipe: "${selectedRecipeId}"\n` +
          `Problem: context.executeRecipe function is missing`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        const generatedText = context.executeRecipe(selectedRecipeId, locale, seed, {});

        const syntheticItem = {
          t: { [locale]: generatedText },
          tags: ['generated', defaultCollection.key],
          _synthetic: true
        };

        logDebug(`GENERATE Success: Auto-selected collection "${defaultCollection.key}" with recipe "${selectedRecipeId}"`);

        return { text: generatedText, item: syntheticItem };
      } catch (error) {
        const errorMsg = `GENERATE Error: Recipe execution failed.\n` +
          `Query: { "from": "${from}" }\n` +
          `Auto-selected collection: "${defaultCollection.key}"\n` +
          `Selected recipe: "${selectedRecipeId}"\n` +
          `Available recipes in collection: ${recipes.join(', ')}\n` +
          `Locale: ${locale}\n` +
          `Original error: ${error.message}`;
        logError(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }
}

/**
 * Simple hash function for seed-based randomness
 * @param {string} seed - Seed string
 * @returns {number} Hash value
 */
function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Apply Demonym transformation (Toponym → Demonym)
 * Converts place names to inhabitant names according to language-specific rules
 * @param {string} toponym - Place name
 * @param {string} locale - Target locale ('de' and 'en' supported)
 * @returns {string} Demonym (inhabitant name)
 */
function applyDemonymTransform(toponym, locale) {
  if (!toponym || typeof toponym !== 'string') {
    logWarn('Invalid toponym for Demonym transform');
    return toponym;
  }

  if (locale === 'de') {
    return applyGermanDemonym(toponym);
  } else if (locale === 'en') {
    return applyEnglishDemonym(toponym);
  } else {
    logWarn(`Demonym transform not implemented for locale: ${locale}`);
    return toponym;
  }
}

/**
 * Apply German demonym transformation rules
 * @param {string} toponym - Place name
 * @returns {string} German demonym
 */
function applyGermanDemonym(toponym) {
  // German Demonym transformation rules
  const rules = [
    { pattern: /ingen$/i, replacement: 'inger' },
    { pattern: /ing$/i, replacement: 'inger' },
    { pattern: /au$/i, replacement: 'auer' },
    { pattern: /ach$/i, replacement: 'acher' },
    { pattern: /heim$/i, replacement: 'heimer' },
    { pattern: /stein$/i, replacement: 'steiner' },
    { pattern: /burg$/i, replacement: 'burger' },
    { pattern: /dorf$/i, replacement: 'dorfer' },
    { pattern: /feld$/i, replacement: 'felder' },
    { pattern: /furt$/i, replacement: 'furter' },
    { pattern: /thal$/i, replacement: 'taler' },
    { pattern: /tal$/i, replacement: 'taler' },
    { pattern: /wald$/i, replacement: 'walder' },
    { pattern: /hagen$/i, replacement: 'hagener' },
    { pattern: /hausen$/i, replacement: 'hausener' },
    { pattern: /kirchen$/i, replacement: 'kirchner' },
    { pattern: /bach$/i, replacement: 'bacher' },
    { pattern: /bruch$/i, replacement: 'brucher' },
    { pattern: /born$/i, replacement: 'borner' },
    { pattern: /see$/i, replacement: 'seer' },
    { pattern: /zell$/i, replacement: 'zeller' }
  ];

  // Try each rule
  for (const rule of rules) {
    if (rule.pattern.test(toponym)) {
      return toponym.replace(rule.pattern, rule.replacement);
    }
  }

  // For words ending in 'e', remove the 'e' before adding 'er'
  if (/e$/i.test(toponym)) {
    return toponym.slice(0, -1) + 'er';
  }

  // Default: just add 'er'
  return toponym + 'er';
}

/**
 * Apply English demonym transformation rules
 * Converts English place names to demonyms (inhabitant names)
 * @param {string} toponym - Place name
 * @returns {string} English demonym
 */
function applyEnglishDemonym(toponym) {
  // English Demonym transformation rules
  const rules = [
    // -land → -lander (e.g., Iceland → Icelander, Finland → Finlander)
    { pattern: /land$/i, replacement: 'lander' },

    // -ia → -ian (e.g., India → Indian, Australia → Australian)
    { pattern: /ia$/i, replacement: 'ian' },

    // -nia → -nian (e.g., California → Californian, Virginia → Virginian)
    { pattern: /nia$/i, replacement: 'nian' },

    // -a → -an (e.g., America → American, Africa → African)
    { pattern: /a$/i, replacement: 'an' },

    // -y → -ian (e.g., Germany → German is exception, but Sicily → Sicilian)
    { pattern: /y$/i, replacement: 'ian' },

    // -o → -an (e.g., Mexico → Mexican, Morocco → Moroccan)
    { pattern: /o$/i, replacement: 'an' },

    // -us → -an (e.g., Cyprus → Cyprian)
    { pattern: /us$/i, replacement: 'an' },

    // -burg → -burger (e.g., Hamburg → Hamburger)
    { pattern: /burg$/i, replacement: 'burger' },

    // -burgh → -burgher (e.g., Edinburgh → Edinburgher)
    { pattern: /burgh$/i, replacement: 'burgher' },

    // -ton → -tonian (e.g., Boston → Bostonian, Washington → Washingtonian)
    { pattern: /ton$/i, replacement: 'tonian' },

    // -ham → -hamite (e.g., Birmingham → Birminghamite)
    { pattern: /ham$/i, replacement: 'hamite' },

    // -ville → -villian (e.g., Nashville → Nashvillian)
    { pattern: /ville$/i, replacement: 'villian' },

    // -ford → -fordian (e.g., Oxford → Oxfordian)
    { pattern: /ford$/i, replacement: 'fordian' },

    // -shire → -shire person/man (just add 'ian' for simplicity)
    { pattern: /shire$/i, replacement: 'shirian' },

    // -pool → -pudlian (e.g., Liverpool → Liverpudlian, Blackpool → Blackpudlian)
    { pattern: /pool$/i, replacement: 'pudlian' },

    // -mouth → -mouthian (e.g., Plymouth → Plymouthian)
    { pattern: /mouth$/i, replacement: 'mouthian' },

    // -port → -portian (e.g., Newport → Newportian)
    { pattern: /port$/i, replacement: 'portian' },

    // -dale → -dalian (e.g., Rochdale → Rochdalian)
    { pattern: /dale$/i, replacement: 'dalian' },

    // -wood → -woodian (e.g., Hollywood → Hollywoodian)
    { pattern: /wood$/i, replacement: 'woodian' },

    // -field → -fieldian (e.g., Springfield → Springfieldian)
    { pattern: /field$/i, replacement: 'fieldian' },

    // -bridge → -bridgean (e.g., Cambridge → Cantabrigian is exception, but most get -bridgean)
    { pattern: /bridge$/i, replacement: 'bridgean' },

    // -castle → -castrian (e.g., Newcastle → Novocastrian, but simpler: -castlian)
    { pattern: /castle$/i, replacement: 'castlian' },

    // -haven → -havener (e.g., New Haven → New Havener)
    { pattern: /haven$/i, replacement: 'havener' },

    // -wick → -wicker (e.g., Brunswick → Brunswicker)
    { pattern: /wick$/i, replacement: 'wicker' },

    // -worth → -worthian (e.g., Letchworth → Letchworthian)
    { pattern: /worth$/i, replacement: 'worthian' }
  ];

  // Try each rule
  for (const rule of rules) {
    if (rule.pattern.test(toponym)) {
      return toponym.replace(rule.pattern, rule.replacement);
    }
  }

  // Handle words ending in 'e' - check if it's a silent 'e'
  if (/e$/i.test(toponym)) {
    // For most cases with silent 'e', just add 'an' or 'ian'
    // Rome → Roman (special case, but 'an' works)
    return toponym.slice(0, -1) + 'an';
  }

  // Default: add 'ian' for most English place names
  return toponym + 'ian';
}

/**
 * Apply Genitive/Possessive transformation
 * Converts names to genitive case according to language-specific grammar rules
 * @param {string} name - Name to convert
 * @param {string} locale - Target locale (currently 'de' and 'en' supported)
 * @param {Object} gramData - Grammatical metadata from item.gram (optional)
 * @returns {string} Genitive/possessive form of the name
 */
function applyGenitiveTransform(name, locale, gramData = {}) {
  if (!name || typeof name !== 'string') {
    logWarn('Invalid name for Genitive transform');
    return name;
  }

  if (locale === 'de') {
    return applyGermanGenitive(name, gramData);
  } else if (locale === 'en') {
    return applyEnglishPossessive(name);
  } else {
    logWarn(`Genitive transform not implemented for locale: ${locale}`);
    return name;
  }
}

/**
 * Apply German genitive case rules
 * German genitive rules depend on gender, declension class, and ending
 * @param {string} name - Name to convert
 * @param {Object} gramData - Grammatical metadata (gender, declension, etc.)
 * @returns {string} German genitive form
 */
function applyGermanGenitive(name, gramData) {
  // Extract gender from gram data (can be locale-specific or general)
  const gender = gramData.de?.gender || gramData.gender;

  // Proper names in German typically take -s in genitive
  // But there are exceptions based on ending sounds

  // 1. Names ending in -s, -ss, -ß, -x, -z, -tz take no additional ending (or use "von + Dative")
  //    However, in written form often use apostrophe: Hans → Hans' or Hans's
  if (/[sßxz]$/i.test(name) || /tz$/i.test(name)) {
    // For names ending in sibilants, use apostrophe
    return name + "'";
  }

  // 2. Names ending in -e often get -ns (especially older/traditional names)
  //    Modern names just get -s
  if (/e$/i.test(name)) {
    // Check if it's a traditional name pattern (this is heuristic)
    // For simplicity, we'll just add -s for most cases
    return name + 's';
  }

  // 3. Names ending in -er, -el, -en typically just add -s
  if (/(?:er|el|en)$/i.test(name)) {
    return name + 's';
  }

  // 4. Default: add -s for most proper names
  return name + 's';
}

/**
 * Apply English possessive rules
 * English possessive is simpler: add 's or just apostrophe for names ending in s
 * @param {string} name - Name to convert
 * @returns {string} English possessive form
 */
function applyEnglishPossessive(name) {
  // 1. Names ending in -s: traditionally just apostrophe (Charles' hat)
  //    Modern usage also accepts 's (Charles's hat)
  //    We'll use just apostrophe for classical style
  if (/s$/i.test(name)) {
    return name + "'";
  }

  // 2. All other names: add 's
  return name + "'s";
}

/**
 * Apply gender adaptation to title based on Person alias
 * @param {Object} titleItem - Title item
 * @param {Object} parts - All aliased parts
 * @param {Object} langRules - Language rules
 * @param {string} locale - Target locale
 * @returns {string} Gender-adapted title
 */
function applyGenderAdaptation(titleItem, parts, langRules, locale) {
  // Look for Person alias to determine gender
  const person = parts.Person;

  if (!person) {
    logWarn('Gender adaptation requested but no Person alias found');
    return getLocalizedText(titleItem.t, locale);
  }

  // Get person's gender from attrs
  const personGender = person.attrs?.gender;

  if (!personGender) {
    logWarn('Person has no gender attribute');
    return getLocalizedText(titleItem.t, locale);
  }

  // Adapt title
  return adaptTitleToGender(titleItem, personGender, langRules, locale);
}

/**
 * Apply agreement logic from ext.agreeWith
 * @param {Object} agreeCfg - ext.agreeWith configuration
 * @param {Object} parts - Existing aliased parts
 * @returns {Object} Filter object derived from agreement
 */
function applyAgreement(agreeCfg, parts) {
  const { ref, features = [], fallback } = agreeCfg;

  // Get source item
  const srcItem = parts[ref];
  if (!srcItem) {
    logWarn(`Agreement reference "${ref}" not found in parts`);
    return {};
  }

  const agreedFilters = { tags: [] };

  // Process each feature
  for (const feature of features) {
    if (feature.from === 'tags') {
      // Extract matching tags from source item
      const srcTags = srcItem.tags || [];
      const requireAllOf = feature.requireAllOf || [];
      const matchingTags = srcTags.filter(t => requireAllOf.includes(t));

      if (matchingTags.length > 0) {
        agreedFilters.tags.push(...matchingTags);
      }
    } else if (feature.from === 'gram') {
      // Read from gram path and map to tags
      const gramValue = getNestedValue(srcItem.gram, feature.path);
      if (gramValue && feature.mapToTags) {
        const mappedTag = feature.mapToTags[gramValue];
        if (mappedTag) {
          agreedFilters.tags.push(mappedTag);
        }
      }
    } else if (feature.from === 'kinds') {
      // Intersect kinds
      const srcKinds = new Set(srcItem.kinds || []);
      const requiredKinds = new Set(feature.anyOf || []);
      const intersection = [...srcKinds].filter(k => requiredKinds.has(k));

      if (intersection.length > 0) {
        agreedFilters.kinds = intersection;
      }
    }
  }

  // Clean up empty arrays
  if (agreedFilters.tags.length === 0) {
    delete agreedFilters.tags;
  }

  return agreedFilters;
}

/**
 * Get nested value from object using dot notation path
 * @param {Object} obj - Source object
 * @param {string} path - Dot notation path (e.g., "de.gender")
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Merge recipe where clause with runtime filters
 * @param {Object} recipeWhere - Where clause from recipe
 * @param {Object} runtimeFilter - Runtime filter for this catalog key
 * @returns {Object} Merged where clause
 */
function mergeFilters(recipeWhere, runtimeFilter) {
  if (!runtimeFilter) {
    return recipeWhere || {};
  }

  const merged = { ...(recipeWhere || {}) };

  // Merge tags (ALL-of logic - combine both sets)
  if (runtimeFilter.tags) {
    merged.tags = [...(merged.tags || []), ...runtimeFilter.tags];
  }

  // Merge kinds (ANY-of logic - intersect if both present, otherwise use available)
  if (runtimeFilter.kinds) {
    if (merged.kinds && merged.kinds.length > 0) {
      // Intersect: only kinds present in both
      const recipeSet = new Set(merged.kinds);
      const runtimeSet = new Set(runtimeFilter.kinds);
      merged.kinds = [...recipeSet].filter(k => runtimeSet.has(k));
    } else {
      // Use runtime kinds if recipe has none
      merged.kinds = runtimeFilter.kinds;
    }
  }

  // Add optional filter extensions
  if (runtimeFilter.anyOfTags) {
    merged.anyOfTags = runtimeFilter.anyOfTags;
  }
  if (runtimeFilter.noneOfTags) {
    merged.noneOfTags = runtimeFilter.noneOfTags;
  }

  return merged;
}

/**
 * Get item identity for distinctness checking
 * @param {Object} item - Item object
 * @returns {string} Unique identifier
 */
function getItemIdentity(item) {
  if (item._index !== undefined) {
    return `idx:${item._index}`;
  }
  const text = typeof item.t === 'object' ? JSON.stringify(item.t) : String(item.t);
  return `text:${text}`;
}

/**
 * Apply post-processing transforms to generated text
 * @param {string} text - Input text
 * @param {Array<string>} transforms - Transform names
 * @returns {string} Transformed text
 */
export function applyTransforms(text, transforms) {
  if (!transforms || transforms.length === 0) {
    return text;
  }

  let result = text;

  for (const transform of transforms) {
    result = applyTransform(result, transform);
  }

  return result;
}

/**
 * Apply a single transform
 * @param {string} text - Input text
 * @param {string} transformName - Transform name
 * @returns {string} Transformed text
 */
function applyTransform(text, transformName) {
  switch (transformName) {
    case 'TrimSpaces':
      return text.trim();

    case 'CollapseSpaces':
      return text.replace(/\s+/g, ' ');

    case 'TitleCase':
      return titleCase(text);

    case 'ConcatNoSpace':
      return text.replace(/\s+/g, '');

    case 'NormalizeUmlauts':
      return normalizeUmlauts(text);

    default:
      logWarn(`Unknown transform: ${transformName}`);
      return text;
  }
}

/**
 * Title case transformation
 * @param {string} text - Input text
 * @returns {string} Title cased text
 */
function titleCase(text) {
  const particles = ['of', 'the', 'and', 'in', 'on', 'at', 'to', 'a', 'an',
                     'von', 'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'in', 'an', 'am', 'bei'];

  // Match words, including those with apostrophes (for possessives like "Peter's")
  // \p{L} matches any Unicode letter, \p{N} matches any Unicode number
  // We include apostrophe within the word pattern to keep possessives together
  return text.replace(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]*)?/gu, (word, index) => {
    // Check if word contains an apostrophe (possessive)
    const apostropheIndex = word.indexOf("'");

    if (apostropheIndex > 0) {
      // Handle possessive: capitalize only the part before the apostrophe
      // "peter's" -> "Peter's" (not "Peter'S")
      const beforeApostrophe = word.slice(0, apostropheIndex);
      const afterApostrophe = word.slice(apostropheIndex); // includes the apostrophe

      // Capitalize first letter of the word before apostrophe
      if (index === 0) {
        // First word: always capitalize
        return beforeApostrophe.charAt(0).toUpperCase() + beforeApostrophe.slice(1).toLowerCase() + afterApostrophe.toLowerCase();
      } else if (particles.includes(beforeApostrophe.toLowerCase())) {
        // Particle: keep lowercase
        return word.toLowerCase();
      } else {
        // Regular word: capitalize first letter
        return beforeApostrophe.charAt(0).toUpperCase() + beforeApostrophe.slice(1).toLowerCase() + afterApostrophe.toLowerCase();
      }
    }

    // Regular word without apostrophe (original logic)
    // Always capitalize first word
    if (index === 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    // Keep particles lowercase
    if (particles.includes(word.toLowerCase())) {
      return word.toLowerCase();
    }

    // Capitalize other words
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/**
 * Normalize German umlauts to ASCII equivalents
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeUmlauts(text) {
  return text
    .replace(/ä/g, 'ae')
    .replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe')
    .replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
}
