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
 * @returns {Object} {text, parts} - Generated text and component parts
 */
export function executePattern(pattern, catalogs, langRules, locale, seed, filters = {}, components = {}) {
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
        // SELECT block
        const result = handleSelectBlock(block, catalogs, locale, parts, blockSeed, filters);

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
        const ppText = handlePPBlock(block, catalogs, langRules, locale, parts, blockSeed, filters);
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
 * @returns {Object} {text, item}
 */
function handleSelectBlock(block, catalogs, locale, parts, seed, filters = {}) {
  const { select, distinctFrom } = block;

  // Currently only 'catalog' source is implemented
  if (select.from !== 'catalog') {
    throw new Error(`Unsupported select source: ${select.from}`);
  }

  // Get catalog
  const catalogKey = select.key;
  const catalog = catalogs[catalogKey];

  if (!catalog || !catalog.items) {
    throw new Error(`Catalog not found: ${catalogKey}`);
  }

  // Merge recipe where with runtime filters for this catalog key
  let effectiveWhere = mergeFilters(select.where, filters[catalogKey]);

  // Apply ext.agreeWith if present
  const agreeCfg = block.ext?.agreeWith;
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
    if (block.optional === true && error.message.includes('SelectionError')) {
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
 * @returns {string} Formatted pp phrase
 */
function handlePPBlock(block, catalogs, langRules, locale, parts, seed, filters = {}) {
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
    const result = handleSelectBlock(inlineBlock, catalogs, locale, parts, seed, filters);
    targetItem = result.item;
  } else {
    throw new Error('PP Error: Invalid ref - must be alias string or inline select');
  }

  // Build phrase using grammar rules
  return buildPPPhrase(targetItem, locale, prep, langRules);
}

/**
 * Apply Demonym transformation (Toponym → Demonym)
 * Converts place names to inhabitant names according to German rules
 * @param {string} toponym - Place name
 * @param {string} locale - Target locale (currently only 'de' supported)
 * @returns {string} Demonym (inhabitant name)
 */
function applyDemonymTransform(toponym, locale) {
  if (!toponym || typeof toponym !== 'string') {
    logWarn('Invalid toponym for Demonym transform');
    return toponym;
  }

  // Only German rules implemented for now
  if (locale !== 'de') {
    logWarn(`Demonym transform not implemented for locale: ${locale}`);
    return toponym;
  }

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

  // Use Unicode letter property to match all word characters including diacritics
  // \p{L} matches any Unicode letter, \p{N} matches any Unicode number
  return text.replace(/[\p{L}\p{N}]+/gu, (word, index) => {
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
