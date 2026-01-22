/**
 * CatalogFilterCache - LRU cache for catalog filtering results
 * Caches filtered item arrays based on catalog key and filter criteria
 * to improve performance when the same filters are applied repeatedly.
 *
 * This is particularly useful for:
 * - Batch generation with consistent filters
 * - Repeated requests with the same gender/tag filters
 * - Agreement-based filtering that produces consistent results
 *
 * @module catalog-filter-cache
 */

import { logDebug } from '../utils/logger.js';
import { isNullOrUndefined } from '../utils/null-checks.js';

/**
 * Catalog Filter Cache
 * LRU (Least Recently Used) cache that stores filtered catalog results.
 * When the cache reaches its maximum size, the least recently accessed entry is evicted.
 *
 * Cache key is based on:
 * - Catalog key (e.g., "names", "settlements")
 * - Filter criteria (where clause: tags, kinds, anyOfTags, noneOfTags)
 *
 * @class CatalogFilterCache
 * @example
 * const cache = new CatalogFilterCache(100);
 * const filteredItems = cache.getOrCompute('names', { tags: ['female'] }, () => {
 *   return filterItems(catalog.items, { tags: ['female'] });
 * });
 */
export class CatalogFilterCache {
  /**
   * Creates a new CatalogFilterCache instance.
   *
   * @param {number} [maxSize=100] - Maximum number of cached filter results
   * @throws {TypeError} If maxSize is not a positive number
   * @example
   * const cache = new CatalogFilterCache(200); // Larger cache for many filter combinations
   */
  constructor(maxSize = 100) {
    if (typeof maxSize !== 'number' || maxSize <= 0) {
      throw new TypeError('maxSize must be a positive number');
    }

    /** @type {Map<string, {result: Array, timestamp: number}>} Cache storage with access tracking */
    this.cache = new Map();

    /** @type {number} Maximum number of entries before eviction */
    this.maxSize = maxSize;

    /** @type {number} Cache hit count for statistics */
    this.hits = 0;

    /** @type {number} Cache miss count for statistics */
    this.misses = 0;

    logDebug(`CatalogFilterCache initialized with maxSize=${maxSize}`);
  }

  /**
   * Generate a cache key from catalog and filter criteria.
   * The key includes the catalog key and a normalized JSON representation of filters.
   *
   * Filter normalization ensures that semantically equivalent filters produce the same key:
   * - Filter keys are sorted alphabetically
   * - Array values (tags, kinds) are sorted
   * - Empty/undefined values are omitted
   *
   * @param {string} catalog - Catalog key (e.g., "names", "settlements")
   * @param {Object} filters - Filter criteria (where clause)
   * @param {string[]} [filters.tags] - Required tags (ALL-of logic)
   * @param {string[]} [filters.kinds] - Required kinds (ANY-of logic)
   * @param {string[]} [filters.anyOfTags] - Optional tags (ANY-of logic)
   * @param {string[]} [filters.noneOfTags] - Excluded tags
   * @returns {string} Normalized cache key
   * @example
   * const key1 = cache.getCacheKey('names', { tags: ['female', 'noble'] });
   * const key2 = cache.getCacheKey('names', { tags: ['noble', 'female'] });
   * // Both produce the same key due to sorting
   * @private
   */
  getCacheKey(catalog, filters) {
    // Normalize filters for consistent cache keys
    const normalized = this._normalizeFilters(filters);
    return JSON.stringify({ catalog, filters: normalized });
  }

  /**
   * Normalize filter object for consistent cache keys.
   * Sorts keys and array values to ensure equivalent filters produce identical keys.
   *
   * @param {Object} filters - Raw filter object
   * @returns {Object} Normalized filter object with sorted keys and arrays
   * @private
   */
  _normalizeFilters(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return {};
    }

    const normalized = {};

    // Sort filter keys for consistent ordering
    const sortedKeys = Object.keys(filters).sort();

    for (const key of sortedKeys) {
      const value = filters[key];

      // Skip undefined or null values
      if (isNullOrUndefined(value)) {
        continue;
      }

      // Sort array values (tags, kinds, etc.)
      if (Array.isArray(value)) {
        if (value.length > 0) {
          normalized[key] = [...value].sort();
        }
      } else if (typeof value === 'object') {
        // Recursively normalize nested objects
        normalized[key] = this._normalizeFilters(value);
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  /**
   * Retrieve a cached filter result.
   *
   * @param {string} catalog - Catalog key
   * @param {Object} filters - Filter criteria
   * @returns {Array|undefined} Cached filtered items array, or undefined if not found
   * @example
   * const cached = cache.get('names', { tags: ['female'] });
   * if (cached) {
   *   // Use cached filtered items
   * }
   */
  get(catalog, filters) {
    const key = this.getCacheKey(catalog, filters);
    const entry = this.cache.get(key);

    if (entry) {
      this.hits++;
      // Update timestamp for LRU tracking
      entry.timestamp = Date.now();
      return entry.result;
    }

    this.misses++;
    return undefined;
  }

  /**
   * Store a filter result in the cache.
   * Implements LRU eviction: if cache is full, removes the least recently used entry.
   *
   * @param {string} catalog - Catalog key
   * @param {Object} filters - Filter criteria
   * @param {Array} result - Filtered items array to cache
   * @returns {void}
   * @example
   * const filtered = catalog.items.filter(item => item.tags?.includes('female'));
   * cache.set('names', { tags: ['female'] }, filtered);
   */
  set(catalog, filters, result) {
    const key = this.getCacheKey(catalog, filters);

    // Check if we need to evict an entry (LRU eviction)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    // Store with timestamp for LRU tracking
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Get or compute a cached filter result.
   * If the result is cached, returns it immediately.
   * Otherwise, computes the result using the provided function and caches it.
   *
   * This is the preferred way to use the cache as it handles both
   * cache hits and misses in a single operation.
   *
   * @param {string} catalog - Catalog key
   * @param {Object} filters - Filter criteria
   * @param {Function} computeFn - Function that computes the filtered result
   * @returns {Array} Filtered items array (cached or computed)
   * @example
   * const filteredItems = cache.getOrCompute('names', { tags: ['female'] }, () => {
   *   return catalog.items.filter(item =>
   *     item.tags?.includes('female')
   *   );
   * });
   */
  getOrCompute(catalog, filters, computeFn) {
    // Check cache first
    const cached = this.get(catalog, filters);
    if (cached !== undefined) {
      return cached;
    }

    // Compute and cache
    const result = computeFn();
    this.set(catalog, filters, result);
    return result;
  }

  /**
   * Evict the least recently used cache entry.
   * Finds the entry with the oldest timestamp and removes it.
   *
   * @returns {void}
   * @private
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logDebug(`CatalogFilterCache evicted LRU entry (cache size: ${this.cache.size}/${this.maxSize})`);
    }
  }

  /**
   * Clear all cached filter results.
   * Resets the cache to an empty state and resets statistics.
   *
   * Use this method when:
   * - Packages are unloaded (to free memory)
   * - Catalog data is modified (to prevent stale cached results)
   * - Testing scenarios requiring clean state
   *
   * @returns {void}
   * @example
   * // After unloading a package
   * engine.unloadPackage('human-de');
   * catalogFilterCache.clear();
   */
  clear() {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logDebug(`CatalogFilterCache cleared (${previousSize} entries removed)`);
  }

  /**
   * Get cache statistics for monitoring and debugging.
   *
   * @returns {Object} Statistics object with size, hits, misses, and hit rate
   * @returns {number} return.size - Current number of cached entries
   * @returns {number} return.maxSize - Maximum cache size
   * @returns {number} return.hits - Number of cache hits
   * @returns {number} return.misses - Number of cache misses
   * @returns {number} return.hitRate - Hit rate as a percentage (0-100)
   * @example
   * const stats = cache.getStats();
   * console.log(`Cache hit rate: ${stats.hitRate.toFixed(1)}%`);
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate
    };
  }

  /**
   * Check if a cache entry exists for the given catalog and filters.
   * Does not update the access timestamp (unlike get()).
   *
   * @param {string} catalog - Catalog key
   * @param {Object} filters - Filter criteria
   * @returns {boolean} True if a cached entry exists
   * @example
   * if (cache.has('names', { tags: ['female'] })) {
   *   const result = cache.get('names', { tags: ['female'] });
   * }
   */
  has(catalog, filters) {
    const key = this.getCacheKey(catalog, filters);
    return this.cache.has(key);
  }

  /**
   * Remove a specific cache entry.
   *
   * @param {string} catalog - Catalog key
   * @param {Object} filters - Filter criteria
   * @returns {boolean} True if an entry was removed, false otherwise
   * @example
   * cache.invalidate('names', { tags: ['female'] });
   */
  invalidate(catalog, filters) {
    const key = this.getCacheKey(catalog, filters);
    const deleted = this.cache.delete(key);
    if (deleted) {
      logDebug(`CatalogFilterCache invalidated entry for catalog "${catalog}"`);
    }
    return deleted;
  }

  /**
   * Invalidate all cache entries for a specific catalog.
   * Useful when a catalog's data is modified or reloaded.
   *
   * @param {string} catalog - Catalog key to invalidate
   * @returns {number} Number of entries invalidated
   * @example
   * // After updating a catalog
   * cache.invalidateCatalog('names');
   */
  invalidateCatalog(catalog) {
    let count = 0;

    for (const key of this.cache.keys()) {
      try {
        const parsed = JSON.parse(key);
        if (parsed.catalog === catalog) {
          this.cache.delete(key);
          count++;
        }
      } catch {
        // Skip invalid keys
      }
    }

    if (count > 0) {
      logDebug(`CatalogFilterCache invalidated ${count} entries for catalog "${catalog}"`);
    }

    return count;
  }

  /**
   * Get the current cache size.
   *
   * @returns {number} Number of entries currently in the cache
   * @example
   * if (cache.size >= cache.maxSize * 0.9) {
   *   console.warn('Cache is 90% full');
   * }
   */
  get size() {
    return this.cache.size;
  }
}
