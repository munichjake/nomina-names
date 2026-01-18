/**
 * Selector - Weighted random selection with filters and distinctness
 * Implements the selection logic from JSON Format 4.0 specification
 */

import { logDebug, logWarn } from '../utils/logger.js';
import { createNominaError, ErrorType } from '../utils/error-helper.js';

/**
 * Select an item from a catalog with optional filtering and weighting
 * @param {Array} items - Catalog items
 * @param {Object} where - Filter criteria (optional)
 * @param {Array<string>} distinctFrom - Array of item identities to avoid (optional)
 * @param {string} seed - Random seed for deterministic selection (optional)
 * @param {number} maxRetries - Maximum retry attempts for distinctness (default: 20)
 * @returns {Object} Selected item
 */
export function selectFromCatalog(items, { where = null, distinctFrom = [], seed = null, maxRetries = 20 } = {}) {
  if (!items || items.length === 0) {
    throw createNominaError(ErrorType.CATALOG_EMPTY, {
      catalog: this.catalogKey || 'unknown'
    });
  }

  // Filter candidates
  let candidates = where ? filterItems(items, where) : items;

  if (candidates.length === 0) {
    throw createNominaError(ErrorType.CATALOG_NO_MATCH, {
      catalog: this.catalogKey || 'unknown',
      totalItems: items.length,
      filters: JSON.stringify(where || {})
    });
  }

  // Handle distinctness
  if (distinctFrom && distinctFrom.length > 0) {
    return selectDistinct(candidates, distinctFrom, seed, maxRetries);
  }

  // Weighted random selection
  return weightedRandomSelect(candidates, seed);
}

/**
 * Filter items based on where criteria
 * @param {Array} items - Items to filter
 * @param {Object} where - Filter object with kinds, tags, anyOfTags, noneOfTags
 * @returns {Array} Filtered items
 */
function filterItems(items, where) {
  logDebug(`Filtering ${items.length} items with where clause:`, where);
  
  const filtered = items.filter(item => {
    // kinds: ANY-of logic - at least one kind must match
    if (where.kinds && where.kinds.length > 0) {
      if (!item.kinds || item.kinds.length === 0) {
        return false;
      }
      const hasMatchingKind = where.kinds.some(k => item.kinds.includes(k));
      if (!hasMatchingKind) {
        return false;
      }
    }

    // tags: ALL-of logic - all required tags must be present
    if (where.tags && where.tags.length > 0) {
      if (!item.tags || item.tags.length === 0) {
        return false;
      }
      const hasAllTags = where.tags.every(t => item.tags.includes(t));
      if (!hasAllTags) {
        return false;
      }
    }

    // anyOfTags: ANY-of logic - at least one tag must match (optional extension)
    if (where.anyOfTags && where.anyOfTags.length > 0) {
      if (!item.tags || item.tags.length === 0) {
        return false;
      }
      const hasAnyTag = where.anyOfTags.some(t => item.tags.includes(t));
      if (!hasAnyTag) {
        return false;
      }
    }

    // noneOfTags: NONE-of logic - none of these tags may be present (optional extension)
    if (where.noneOfTags && where.noneOfTags.length > 0) {
      if (item.tags && item.tags.length > 0) {
        const hasForbiddenTag = where.noneOfTags.some(t => item.tags.includes(t));
        if (hasForbiddenTag) {
          return false;
        }
      }
    }

    return true;
  });
  
  logDebug(`Filter result: ${filtered.length}/${items.length} items matched`);
  if (filtered.length === 0 && where.tags) {
    logDebug('No items matched tags filter. Sample item tags:', items[0]?.tags);
  }
  if (filtered.length > 0 && filtered.length < 20 && where.tags) {
    logDebug(`First 3 filtered items:`, filtered.slice(0, 3).map(i => ({ text: i.t, tags: i.tags })));
  }

  return filtered;
}

/**
 * Select an item that is distinct from previous selections
 * @param {Array} candidates - Filtered candidates
 * @param {Array<string>} distinctFrom - Item identities to avoid
 * @param {string} seed - Random seed
 * @param {number} maxRetries - Maximum retries
 * @returns {Object} Selected item
 */
function selectDistinct(candidates, distinctFrom, seed, maxRetries) {
  let attempts = 0;

  while (attempts < maxRetries) {
    const selected = weightedRandomSelect(candidates, seed ? `${seed}:retry${attempts}` : null);
    const selectedId = getItemIdentity(selected);

    if (!distinctFrom.includes(selectedId)) {
      return selected;
    }

    attempts++;
  }

  throw createNominaError(ErrorType.CATALOG_NO_DISTINCT, {
    attempts: maxRetries
  });
}

/**
 * Weighted random selection from candidates
 * @param {Array} candidates - Items to choose from
 * @param {string} seed - Random seed for deterministic selection
 * @returns {Object} Selected item
 */
function weightedRandomSelect(candidates, seed = null) {
  // Calculate total weight
  const totalWeight = candidates.reduce((sum, item) => {
    const weight = item.w !== undefined ? item.w : 1;
    if (weight <= 0 || !isFinite(weight)) {
      logWarn('Invalid weight detected, using 1:', item);
      return sum + 1;
    }
    return sum + weight;
  }, 0);

  // Generate random value (deterministic if seed provided)
  const random = seed ? seededRandom(seed) : Math.random();
  let threshold = random * totalWeight;

  // Select item based on weighted threshold
  for (const item of candidates) {
    const weight = item.w !== undefined && item.w > 0 && isFinite(item.w) ? item.w : 1;
    threshold -= weight;
    if (threshold <= 0) {
      return item;
    }
  }

  // Fallback: return last item
  return candidates[candidates.length - 1];
}

/**
 * Get item identity for distinctness checking
 * Uses array index if available, otherwise generates from content
 * @param {Object} item - Item object
 * @returns {string} Unique identifier
 */
function getItemIdentity(item) {
  // If item has an explicit index/id, use it
  if (item._index !== undefined) {
    return `idx:${item._index}`;
  }

  // Otherwise, use text content as identity
  const text = typeof item.t === 'object' ? JSON.stringify(item.t) : String(item.t);
  return `text:${text}`;
}

/**
 * Seeded random number generator (simple hash-based)
 * @param {string} seed - Seed string
 * @returns {number} Pseudo-random number between 0 and 1
 */
function seededRandom(seed) {
  // Simple hash function for seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to [0, 1) range
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

/**
 * Add index metadata to catalog items for identity tracking
 * @param {Array} items - Catalog items
 * @returns {Array} Items with _index property
 */
export function addItemIndices(items) {
  return items.map((item, index) => ({
    ...item,
    _index: index
  }));
}
