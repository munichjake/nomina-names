/**
 * Shared constants for the Names module
 * Updated for dynamic category management
 */

export const BASE_GENDERS = ['male', 'female'];
export const NONBINARY_GENDER = 'nonbinary';

// Function to get supported genders based on settings
export function getSupportedGenders() {
  try {
    const includeNonbinary = game.settings.get('names', 'includeNonbinaryNames');
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
 * Check if a category has subcategories (categorized content)
 * @param {string} category - Category to check
 * @returns {boolean} True if category has subcategories
 */
export function isCategorizedContent(category) {
  const categoryDef = CATEGORY_DEFINITIONS[category];
  return categoryDef?.type === 'categorized';
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
 * @returns {string} Localized category name
 */
export function getLocalizedCategoryName(category) {
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
      'religious_books': 'names.subcategories.books.religious_books',
      'novels': 'names.subcategories.books.novels',
      'scientific_treatises': 'names.subcategories.books.scientific_treatises',
      'humorous_books': 'names.subcategories.books.humorous_books'
    }
  },
  'taverns': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.taverns',
    'subcategories': {
      'upscale_inns': 'names.subcategories.taverns.upscale_inns',
      'common_taverns': 'names.subcategories.taverns.common_taverns',
      'harbor_taverns': 'names.subcategories.taverns.harbor_taverns',
      'adventurer_taverns': 'names.subcategories.taverns.adventurer_taverns'
    }
  },
  'ships': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.ships',
    'subcategories': {
      'merchant_ship': 'names.subcategories.ships.merchant_ship',
      'warship': 'names.subcategories.ships.warship',
      'pirate_ship': 'names.subcategories.ships.pirate_ship',
      'small_boat': 'names.subcategories.ships.small_boat',
      'exploration_ship': 'names.subcategories.ships.exploration_ship',
      'mystical_ship': 'names.subcategories.ships.mystical_ship'
    }
  },
  'shops': {
    'type': 'categorized',
    'generators': ['generator'],
    'localization': 'names.categories.shops',
    'subcategories': {
      'blacksmiths': 'names.subcategories.shops.blacksmiths',
      'alchemists': 'names.subcategories.shops.alchemists',
      'general_stores': 'names.subcategories.shops.general_stores',
      'adventure_supplies': 'names.subcategories.shops.adventure_supplies',
      'weaponsmiths': 'names.subcategories.shops.weaponsmiths',
      'armorers': 'names.subcategories.shops.armorers'
    }
  }
};

/**
 * Initialize fallback categories if index loading fails
 */
export function initializeFallbackCategories() {
  if (!INDEX_LOADED) {
    setCategoryDefinitions(FALLBACK_CATEGORIES);
    console.warn("Names | Using fallback category definitions");
  }
}

// Legacy constants for backwards compatibility
export const DEFAULT_NAME_FORMAT = '{firstname} {nickname} {surname}, {title}';

export const MODULE_ID = 'names';

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
  generator: 'modules/names/templates/names.hbs',
  picker: 'modules/names/templates/names-picker.hbs',
  emergency: 'modules/names/templates/emergency-names.hbs',
  roleConfig: 'modules/names/templates/role-config.hbs'
};

export const DATA_PATHS = {
  base: 'modules/names/data/',
  index: 'modules/names/data/index.json',
  langConfig: 'modules/names/lang/_config.json',
  speciesMapping: 'modules/names/lang/_species-mapping.json'
};