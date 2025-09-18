/**
 * Shared constants for the Names module
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

export const NAME_CATEGORIES = {
  'firstnames': ['male', 'female', 'nonbinary'],
  'surnames': ['surnames'],
  'titles': ['titles'],
  'nicknames': ['nicknames'],
  'settlements': ['settlements']
};

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