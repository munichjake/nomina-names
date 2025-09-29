/**
 * Shared constants for the Names module
 * Updated for dynamic category management
 */

import { logWarn } from '../utils/logger.js';

export const BASE_GENDERS = ['male', 'female'];
export const NONBINARY_GENDER = 'nonbinary';

// Function to get supported genders based on settings
export function getSupportedGenders() {
  try {
    const includeNonbinary = game.settings.get('nomina-names', 'includeNonbinaryNames');
    return includeNonbinary ? [...BASE_GENDERS, NONBINARY_GENDER] : BASE_GENDERS;
  } catch (error) {
    // Fallback if setting doesn't exist yet
    return BASE_GENDERS;
  }
}

// Dynamic category management - will be populated from index.json
let CATEGORY_DEFINITIONS = {};
let CATEGORY_GROUPS = {};
let INDEX_LOADED = false;

/**
 * Sets category definitions from loaded index data (old format)
 * @param {Object} categories - Category definitions from index.json
 */
export function setCategoryDefinitions(categories) {
  CATEGORY_DEFINITIONS = categories || {};

  // Merge with fallback definitions to ensure all necessary properties exist
  for (const [category, fallbackDef] of Object.entries(FALLBACK_CATEGORIES)) {
    if (CATEGORY_DEFINITIONS[category]) {
      // Merge fallback properties that are missing
      CATEGORY_DEFINITIONS[category] = {
        ...fallbackDef,
        ...CATEGORY_DEFINITIONS[category]
      };
    } else {
      // Use fallback definition if category is missing entirely
      CATEGORY_DEFINITIONS[category] = { ...fallbackDef };
    }
  }

  CATEGORY_GROUPS = {};
  INDEX_LOADED = true;
  console.debug("Names | Category definitions updated:", Object.keys(CATEGORY_DEFINITIONS));
}

/**
 * Sets category definitions from grouped structure (new format)
 * @param {Object} categoryGroups - Category group definitions from index.json
 */
export function setCategoryDefinitionsFromGroups(categoryGroups) {
  CATEGORY_GROUPS = categoryGroups || {};
  CATEGORY_DEFINITIONS = {};

  // Flatten the groups into the old structure for backward compatibility
  for (const [groupKey, groupData] of Object.entries(CATEGORY_GROUPS)) {
    if (groupData.categories) {
      Object.assign(CATEGORY_DEFINITIONS, groupData.categories);
    }
  }

  // Merge with fallback definitions to ensure all necessary properties exist
  for (const [category, fallbackDef] of Object.entries(FALLBACK_CATEGORIES)) {
    if (CATEGORY_DEFINITIONS[category]) {
      // Merge fallback properties that are missing
      CATEGORY_DEFINITIONS[category] = {
        ...fallbackDef,
        ...CATEGORY_DEFINITIONS[category]
      };
    } else {
      // Use fallback definition if category is missing entirely
      CATEGORY_DEFINITIONS[category] = { ...fallbackDef };
    }
  }

  INDEX_LOADED = true;
  console.debug("Names | Category groups loaded:", Object.keys(CATEGORY_GROUPS));
  console.debug("Names | Flattened categories:", Object.keys(CATEGORY_DEFINITIONS));
}

/**
 * Gets all category definitions
 * @returns {Object} All category definitions
 */
export function getCategoryDefinitions() {
  return CATEGORY_DEFINITIONS;
}

/**
 * Gets category groups
 * @returns {Object} Category groups
 */
export function getCategoryGroups() {
  return CATEGORY_GROUPS;
}

/**
 * Gets available categories (just the keys)
 * @returns {Array} Array of category names
 */
export function getAvailableCategories() {
  return Object.keys(CATEGORY_DEFINITIONS);
}

/**
 * Check if a category has subcategories (categorized content) - 3.0.0 format only
 * @param {string} category - Category to check
 * @returns {boolean} True if category has subcategories
 */
export function isCategorizedContent(category) {
  // Check if category is defined in CATEGORY_DEFINITIONS and has type 'categorized'
  const categoryDef = CATEGORY_DEFINITIONS[category];
  if (categoryDef && categoryDef.type === 'categorized') {
    return true;
  }

  // Fallback: assume non-names categories are categorized content by default
  // This allows dynamic addition of new categories without code changes
  return category !== 'names' &&
         !['male', 'female', 'nonbinary', 'surnames', 'nicknames', 'titles'].includes(category);
}

/**
 * Get subcategories for a category
 * @param {string} category - Category to get subcategories for
 * @returns {Object} Object with subcategory keys and localization keys as values
 */
export function getSubcategories(category) {
  const categoryDef = CATEGORY_DEFINITIONS[category];
  return categoryDef?.subcategories || {};
}

/**
 * Check if category should only be available in specific generators
 * @param {string} category - Category to check
 * @returns {boolean} True if category is generator-only
 */
export function isGeneratorOnlyCategory(category) {
  const categoryDef = CATEGORY_DEFINITIONS[category];
  return categoryDef?.generators?.includes('generator') && 
         !categoryDef?.generators?.includes('picker');
}

/**
 * Get categories available for a specific generator type
 * @param {string} generatorType - Type of generator ('generator', 'picker', 'emergency')
 * @returns {Array} Array of category names available for this generator
 */
export function getCategoriesForGenerator(generatorType) {
  const availableCategories = [];
  
  for (const [category, definition] of Object.entries(CATEGORY_DEFINITIONS)) {
    // If no generators specified, available for all
    if (!definition.generators || definition.generators.includes(generatorType)) {
      availableCategories.push(category);
    }
  }
  
  return availableCategories;
}

/**
 * Get localization key for a category
 * @param {string} category - Category to get localization for
 * @returns {string} Localization key
 */
export function getCategoryLocalization(category) {
  const categoryDef = CATEGORY_DEFINITIONS[category];
  return categoryDef?.localization || `names.categories.${category}`;
}

/**
 * Get category type ('traditional', 'simple', 'categorized')
 * @param {string} category - Category to check
 * @returns {string} Category type
 */
export function getCategoryType(category) {
  const categoryDef = CATEGORY_DEFINITIONS[category];
  return categoryDef?.type || 'simple';
}

/**
 * Get localized category name
 * @param {string} category - Category to get name for
 * @param {Object} [context] - Optional context for 3.1.0 format lookups
 * @param {string} [context.language] - Language code for displayName lookup
 * @param {string} [context.species] - Species code for displayName lookup
 * @param {Function} [context.getCategoryDisplayName] - Function to get cached displayName
 * @returns {string} Localized category name
 */
export function getLocalizedCategoryName(category, context = null) {
  // Try 3.1.0 format displayName from cache first (if context provided)
  if (context && context.language && context.species && context.getCategoryDisplayName) {
    const displayName = context.getCategoryDisplayName(context.language, context.species, category);
    if (displayName) {
      // Priority: current language -> English -> German -> first available -> fallback
      const currentLang = context.language;
      const langOptions = [currentLang, 'en', 'de', ...Object.keys(displayName)];

      for (const lang of langOptions) {
        if (displayName[lang]) {
          return displayName[lang];
        }
      }
    }
  }

  // Fallback to traditional i18n system
  const locKey = getCategoryLocalization(category);
  try {
    return game.i18n.localize(locKey) || category.charAt(0).toUpperCase() + category.slice(1);
  } catch (error) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

/**
 * Check if index has been loaded
 * @returns {boolean} True if index with categories has been loaded
 */
export function isIndexLoaded() {
  return INDEX_LOADED;
}

/**
 * Fallback category definitions for when index.json is not available
 */
const FALLBACK_CATEGORIES = {
  'names': {
    'type': 'traditional',
    'generators': ['generator', 'picker'],
    'localization': 'names.categories.names'
  },
  'surnames': {
    'type': 'simple',
    'generators': ['generator', 'picker', 'emergency'],
    'localization': 'names.categories.surnames'
  },
  'titles': {
    'type': 'simple',
    'generators': ['generator', 'picker'],
    'localization': 'names.categories.titles'
  },
  'nicknames': {
    'type': 'simple',
    'generators': ['generator', 'picker'],
    'localization': 'names.categories.nicknames'
  },
  'settlements': {
    'type': 'simple',
    'generators': ['generator', 'picker', 'emergency'],
    'localization': 'names.categories.settlements'
  },
  'books': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.books',
    'subcategories': {
      'religious_books': 'names.subcategory-translations.books.religious_books',
      'novels': 'names.subcategory-translations.books.novels',
      'scientific_treatises': 'names.subcategory-translations.books.scientific_treatises',
      'humorous_books': 'names.subcategory-translations.books.humorous_books'
    }
  },
  'taverns': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.taverns',
    'subcategories': {
      'upscale_inns': 'names.subcategory-translations.taverns.upscale_inns',
      'common_taverns': 'names.subcategory-translations.taverns.common_taverns',
      'harbor_taverns': 'names.subcategory-translations.taverns.harbor_taverns',
      'adventurer_taverns': 'names.subcategory-translations.taverns.adventurer_taverns'
    }
  },
  'ships': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.ships',
    'subcategories': {
      'merchant_ship': 'names.subcategory-translations.ships.merchant_ship',
      'warship': 'names.subcategory-translations.ships.warship',
      'pirate_ship': 'names.subcategory-translations.ships.pirate_ship',
      'small_boat': 'names.subcategory-translations.ships.small_boat',
      'exploration_ship': 'names.subcategory-translations.ships.exploration_ship',
      'mystical_ship': 'names.subcategory-translations.ships.mystical_ship'
    }
  },
  'shops': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.shops',
    'subcategories': {
      'blacksmiths': 'names.subcategory-translations.shops.blacksmiths',
      'alchemists': 'names.subcategory-translations.shops.alchemists',
      'general_stores': 'names.subcategory-translations.shops.general_stores',
      'adventure_supplies': 'names.subcategory-translations.shops.adventure_supplies',
      'weaponsmiths': 'names.subcategory-translations.shops.weaponsmiths',
      'armorers': 'names.subcategory-translations.shops.armorers'
    }
  }
};

/**
 * Initialize fallback categories if index loading fails
 */
export function initializeFallbackCategories() {
  if (!INDEX_LOADED) {
    setCategoryDefinitions(FALLBACK_CATEGORIES);
    logWarn("Names | Using fallback category definitions");
  }
}

// Legacy constants for backwards compatibility
export const DEFAULT_NAME_FORMAT = '{firstname} {nickname} {surname}, {title}';

export const MODULE_ID = 'nomina-names';

// Gender symbols for UI display
export const GENDER_SYMBOLS = {
  male: '♂',
  female: '♀',
  nonbinary: '⚧'
};

export const CSS_CLASSES = {
  moduleApp: 'names-module-app',
  pickerApp: 'names-picker-app',
  emergencyApp: 'emergency-names-app',
  loadingIndicator: 'names-loading-indicator',
  generatedName: 'names-module-generated-name',
  emergencyButton: 'emergency-names-chat-button'
};

export const TEMPLATE_PATHS = {
  generator: 'modules/nomina-names/templates/names.hbs',
  picker: 'modules/nomina-names/templates/names-picker.hbs',
  emergency: 'modules/nomina-names/templates/emergency-names.hbs',
  roleConfig: 'modules/nomina-names/templates/role-config.hbs'
};

export const DATA_PATHS = {
  base: 'modules/nomina-names/data/',
  index: 'modules/nomina-names/data/index.json',
  langConfig: 'modules/nomina-names/lang/_config.json',
  speciesMapping: 'modules/nomina-names/lang/_species-mapping.json'
};