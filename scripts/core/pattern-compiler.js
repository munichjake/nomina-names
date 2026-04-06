/**
 * Pattern Compiler - Pre-compilation and caching of recipe patterns
 * Implements pattern compilation optimization from JSON Format 4.0 specification.
 *
 * This module handles:
 * - Pre-compiling pattern blocks for faster execution
 * - Catalog reference resolution at compile time
 * - Caching compiled patterns to avoid redundant compilation
 * - Separating compilation concerns from runtime execution
 *
 * @module pattern-compiler
 */

import { logDebug, logWarn, logError } from '../utils/logger.js';
import { createNominaError, ErrorType } from '../utils/error-helper.js';

/**
 * Pattern Compiler - Compiles and caches recipe patterns.
 * Pre-resolves catalog references and optimizes pattern structure.
 *
 * Performance Benefits:
 * - Catalog resolution happens once at compilation, not per execution
 * - Cross-package references are resolved upfront
 * - Pattern structure validation happens during compilation
 * - Cached compiled patterns eliminate redundant parsing
 *
 * @class PatternCompiler
 */
export class PatternCompiler {
  /**
   * Create a new PatternCompiler.
   *
   * @param {Object} catalogs - Available catalogs in the current package
   * @param {Object} langRules - Language rules for grammar (articles, prepositions)
   * @param {Function} [getPackageCatalog] - Optional function to resolve cross-package catalogs
   * @example
   * const compiler = new PatternCompiler(pkg.catalogs, langRules, context.getPackageCatalog);
   * const compiled = compiler.compile(recipe.pattern);
   */
  constructor(catalogs, langRules, getPackageCatalog = null) {
    this.catalogs = catalogs;
    this.langRules = langRules;
    this.getPackageCatalog = getPackageCatalog;
    this.cache = new Map();

    // Statistics for debugging
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0
    };
  }

  /**
   * Compile a pattern for faster execution.
   * Returns cached compilation if available, otherwise compiles and caches.
   *
   * Compilation includes:
   * - Resolving all catalog references (local and cross-package)
   * - Validating block structure
   * - Pre-computing static values where possible
   * - Storing resolved catalog metadata
   *
   * @param {Array<Object>} pattern - Array of pattern blocks to compile
   * @returns {Array<Object>} Compiled pattern blocks with resolved references
   * @example
   * const compiled = compiler.compile([
   *   { select: { from: 'catalog', key: 'names' }, as: 'FN' },
   *   { literal: ' ' },
   *   { ref: 'FN' }
   * ]);
   */
  compile(pattern) {
    // Create cache key from pattern structure
    const cacheKey = this.createCacheKey(pattern);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.stats.hits++;
      logDebug(`Pattern cache hit: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    // Cache miss - compile the pattern
    this.stats.misses++;
    this.stats.compilations++;

    const compiled = pattern.map(block => this.compileBlock(block));

    // Cache the compiled pattern
    this.cache.set(cacheKey, compiled);

    logDebug(`Pattern compiled and cached: ${cacheKey} (${compiled.length} blocks)`);
    return compiled;
  }

  /**
   * Compile a single pattern block.
   * Resolves catalog references and validates block structure.
   *
   * @param {Object} block - Pattern block to compile
   * @returns {Object} Compiled block with resolved references
   * @private
   */
  compileBlock(block) {
    // Create a copy to avoid mutating the original
    const compiled = { ...block };

    // Compile extension data if present
    if (block.ext) {
      compiled.ext = { ...block.ext };
    }

    // Handle SELECT block
    if (block.select) {
      return this.compileSelectBlock(compiled);
    }

    // Handle GENERATE block
    if (block.generate) {
      return this.compileGenerateBlock(compiled);
    }

    // Handle PP block
    if (block.pp) {
      return this.compilePPBlock(compiled);
    }

    // Handle LITERAL block - no compilation needed
    if (block.literal) {
      return compiled;
    }

    // Handle REF block - no compilation needed
    if (block.ref) {
      return compiled;
    }

    // Handle oneOf block
    if (block.oneOf) {
      compiled.oneOf = block.oneOf.map(option => ({
        ...option,
        pattern: option.pattern ? option.pattern.map(b => this.compileBlock(b)) : option.pattern
      }));
      return compiled;
    }

    logWarn(`Unknown block type in compilation: ${Object.keys(block).join(', ')}`);
    return compiled;
  }

  /**
   * Compile a SELECT block.
   * Resolves catalog reference and stores metadata.
   *
   * @param {Object} block - SELECT block to compile
   * @returns {Object} Compiled SELECT block with resolved catalog
   * @private
   */
  compileSelectBlock(block) {
    const { select } = block;

    if (select.from === 'catalog' && select.key) {
      // Resolve catalog reference
      const resolvedCatalog = this.resolveCatalog(select.key);

      // Store resolved catalog metadata in compiled block
      block._compiled = {
        catalog: resolvedCatalog.catalog,
        catalogKey: resolvedCatalog.catalogKey,
        isCrossPackage: resolvedCatalog.isCrossPackage,
        packageCode: resolvedCatalog.packageCode
      };

      // Validate catalog exists
      if (!resolvedCatalog.catalog) {
        const error = `Catalog not found during compilation: ${select.key}`;
        if (block.ext?.optional) {
          logWarn(`${error} (optional block, will be skipped)`);
          block._compiled.skipOnExecution = true;
        } else {
          throw createNominaError(ErrorType.CATALOG_NOT_FOUND, {
            catalog: select.key
          });
        }
      }
    }

    // Generator blocks don't need catalog resolution
    if (select.from === 'generator') {
      block._compiled = {
        isGenerator: true,
        recipeId: select.key
      };
    }

    return block;
  }

  /**
   * Compile a GENERATE block.
   * Resolves catalog references for catalog mode.
   *
   * @param {Object} block - GENERATE block to compile
   * @returns {Object} Compiled GENERATE block with resolved references
   * @private
   */
  compileGenerateBlock(block) {
    const { generate } = block;
    const { from, key } = generate;

    block._compiled = {
      mode: from
    };

    // Catalog mode - resolve catalog reference
    if (from === 'catalog' && key) {
      const resolvedCatalog = this.resolveCatalog(key);

      block._compiled.catalog = resolvedCatalog.catalog;
      block._compiled.catalogKey = resolvedCatalog.catalogKey;
      block._compiled.isCrossPackage = resolvedCatalog.isCrossPackage;
      block._compiled.packageCode = resolvedCatalog.packageCode;

      // Validate catalog exists
      if (!resolvedCatalog.catalog) {
        throw createNominaError(ErrorType.CATALOG_NOT_FOUND, {
          catalog: key
        });
      }
    }

    // Recipe mode - store recipe ID
    if (from === 'recipe' && key) {
      block._compiled.recipeId = key;
    }

    // Simplified syntax (package name) - no catalog resolution needed
    if (from !== 'catalog' && from !== 'recipe') {
      block._compiled.packageName = from;
    }

    return block;
  }

  /**
   * Compile a PP (preposition-article-phrase) block.
   * Resolves catalog references for inline select.
   *
   * @param {Object} block - PP block to compile
   * @returns {Object} Compiled PP block with resolved references
   * @private
   */
  compilePPBlock(block) {
    const { pp } = block;

    block._compiled = {
      prep: pp.prep
    };

    // If ref has inline select, resolve catalog
    if (pp.ref && pp.ref.select && pp.ref.select.from === 'catalog') {
      const resolvedCatalog = this.resolveCatalog(pp.ref.select.key);

      block._compiled.hasInlineSelect = true;
      block._compiled.catalog = resolvedCatalog.catalog;
      block._compiled.catalogKey = resolvedCatalog.catalogKey;
      block._compiled.isCrossPackage = resolvedCatalog.isCrossPackage;
    }

    return block;
  }

  /**
   * Resolve a catalog reference (local or cross-package).
   *
   * @param {string} catalogKey - Catalog key, optionally with package code prefix
   * @returns {Object} Resolution result
   * @returns {Object} return.catalog - Resolved catalog object or null
   * @returns {string} return.catalogKey - Clean catalog key without package prefix
   * @returns {boolean} return.isCrossPackage - Whether this is a cross-package reference
   * @returns {string} return.packageCode - Package code if cross-package
   * @private
   */
  resolveCatalog(catalogKey) {
    // Check if this is a cross-package reference
    if (catalogKey.includes(':')) {
      const [packageCode, remoteCatalogKey] = catalogKey.split(':', 2);

      if (!this.getPackageCatalog) {
        logError(`Cross-package reference requires getPackageCatalog function: ${catalogKey}`);
        return {
          catalog: null,
          catalogKey: remoteCatalogKey,
          isCrossPackage: true,
          packageCode
        };
      }

      try {
        const catalog = this.getPackageCatalog(packageCode, remoteCatalogKey);
        return {
          catalog,
          catalogKey: remoteCatalogKey,
          isCrossPackage: true,
          packageCode
        };
      } catch (error) {
        logError(`Failed to resolve cross-package catalog: ${catalogKey}`, error);
        return {
          catalog: null,
          catalogKey: remoteCatalogKey,
          isCrossPackage: true,
          packageCode
        };
      }
    }

    // Local catalog reference
    return {
      catalog: this.catalogs[catalogKey],
      catalogKey,
      isCrossPackage: false,
      packageCode: null
    };
  }

  /**
   * Create a cache key from a pattern.
   * Uses JSON.stringify for deterministic key generation.
   *
   * @param {Array<Object>} pattern - Pattern to create key from
   * @returns {string} Cache key
   * @private
   */
  createCacheKey(pattern) {
    try {
      return JSON.stringify(pattern);
    } catch (error) {
      logError('Failed to create pattern cache key', error);
      return `pattern_${Date.now()}_${Math.random()}`;
    }
  }

  /**
   * Clear the compilation cache.
   * Useful for testing or when catalogs change.
   *
   * @example
   * compiler.clearCache();
   */
  clearCache() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0
    };
    logDebug('Pattern compiler cache cleared');
  }

  /**
   * Get cache statistics.
   * Useful for monitoring cache effectiveness.
   *
   * @returns {Object} Statistics object with hits, misses, compilations, and hit rate
   * @example
   * const stats = compiler.getStats();
   * console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      ...this.stats,
      hitRate,
      cacheSize: this.cache.size,
      totalRequests
    };
  }

  /**
   * Validate a compiled pattern.
   * Checks that all referenced catalogs were successfully resolved.
   *
   * @param {Array<Object>} compiledPattern - Compiled pattern to validate
   * @returns {Object} Validation result
   * @returns {boolean} return.valid - Whether pattern is valid
   * @returns {string[]} return.errors - Array of error messages
   * @example
   * const validation = compiler.validateCompiled(compiledPattern);
   * if (!validation.valid) {
   *   console.error('Pattern validation failed:', validation.errors);
   * }
   */
  validateCompiled(compiledPattern) {
    const errors = [];

    for (let i = 0; i < compiledPattern.length; i++) {
      const block = compiledPattern[i];

      // Check SELECT blocks
      if (block.select && block.select.from === 'catalog') {
        if (!block._compiled?.catalog && !block._compiled?.skipOnExecution) {
          errors.push(`Block ${i}: Catalog "${block.select.key}" not resolved`);
        }
      }

      // Check GENERATE blocks with catalog mode
      if (block.generate && block.generate.from === 'catalog') {
        if (!block._compiled?.catalog) {
          errors.push(`Block ${i}: Catalog "${block.generate.key}" not resolved`);
        }
      }

      // Check PP blocks with inline select
      if (block.pp && block.pp.ref?.select?.from === 'catalog') {
        if (!block._compiled?.catalog) {
          errors.push(`Block ${i}: PP catalog "${block.pp.ref.select.key}" not resolved`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Create a default PatternCompiler instance.
 * Convenience function for quick instantiation.
 *
 * @param {Object} catalogs - Available catalogs in the package
 * @param {Object} langRules - Language rules for grammar
 * @param {Function} [getPackageCatalog] - Optional cross-package catalog resolver
 * @returns {PatternCompiler} New compiler instance
 * @example
 * const compiler = createPatternCompiler(pkg.catalogs, langRules);
 */
export function createPatternCompiler(catalogs, langRules, getPackageCatalog = null) {
  return new PatternCompiler(catalogs, langRules, getPackageCatalog);
}
