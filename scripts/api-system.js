/**
 * Names Module API - Public interface for other modules
 * Updated to use V4 generation system
 */

import { getGlobalGenerator } from './api/generator.js';
import { getGlobalDataManager } from './core/data-manager.js';
import { NamesGeneratorApp } from './apps/generator-app.js';
import { NamesPickerApp } from './apps/picker-app.js';
import { EmergencyNamesApp } from './apps/emergency-app.js';
import { hasNamesGeneratorPermission } from './utils/permissions.js';
import { getSupportedGenders } from './shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from './utils/logger.js';
import {
  validateLanguage,
  validateSpecies,
  validateGender,
  validateComponents,
  validateFormat,
  validateCatalog,
  validateTags,
  validateCount,
  validatePackageCode
} from './utils/api-input-validator.js';
import {
  throwIfInvalid,
  createValidationError,
  ErrorType
} from './utils/error-helper.js';

/**
 * Names Module API - Public interface for other modules
 * Provides methods for generating names, accessing data, and extending functionality
 */
class NamesModuleAPI {
  // Event name constants for external modules
  static EVENTS = {
    API_READY: 'nomina-names.api.ready',
    CORE_LOADED: 'nomina-names:coreLoaded',
    MODULE_READY: 'namesModuleReady' // Deprecated, use API_READY instead
  };

  /**
   * Creates a new Names Module API instance
   */
  constructor() {
    // Extension tracking
    this.registeredExtensions = new Map();
    this.hooks = {
      'names.beforeGenerate': [],
      'names.afterGenerate': [],
      'names.dataLoaded': []
    };

    // Initialize V4 system
    this.generator = null;
    this.dataManager = null;

    // Setup will be called after DataManager is ready
    this._isSetup = false;
  }

  /**
   * Setup the API with the V4 system
   */
  setup() {
    if (this._isSetup) return;

    this.generator = getGlobalGenerator();
    this.dataManager = getGlobalDataManager();

    if (this.generator && this.dataManager) {
      this._isSetup = true;
      logDebug("NamesModuleAPI setup completed with V4 system");
    }
  }

  /**
   * Ensure API is setup before use
   */
  async _ensureSetup() {
    if (!this._isSetup) {
      this.setup();
    }
    if (!this.generator) {
      throw createValidationError(ErrorType.API_MODULE_NOT_READY, {
        error: "Generator not available - ensure nomina-names module is initialized"
      });
    }
    await this.generator.initialize();
  }

  /**
   * Wait for the API to be ready before use
   *
   * **Recommended**: Use the `nomina-names.api.ready` event instead:
   * ```javascript
   * Hooks.once('nomina-names.api.ready', (api) => {
   *   // API is ready, use it directly
   *   const name = await api.generateName({ species: 'human' });
   * });
   * ```
   *
   * **Alternative**: Use this method for async/await pattern:
   * ```javascript
   * await game.modules.get('nomina-names').api.ready();
   * const name = await api.generateName({ species: 'human' });
   * ```
   *
   * @returns {Promise<void>} Resolves when API is ready
   *
   * @example
   * // Wait for API to be ready before generating names
   * await game.modules.get('nomina-names').api.ready();
   * const name = await game.modules.get('nomina-names').api.generateName({
   *   language: 'de',
   *   species: 'human'
   * });
   */
  async ready() {
    while (!this._isSetup) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await this._ensureSetup();
  }

  /**
   * Main API functions for external modules
   */

  /**
   * Generate a name using V4 system
   * @param {Object} options - Generation options
   * @param {string} options.language - Language code (default: 'de')
   * @param {string} options.species - Species code (default: 'human')
   * @param {string} options.gender - Gender for names ('male', 'female', 'nonbinary')
   * @param {Array} options.components - Name components ['firstname', 'surname', 'title', 'nickname']
   * @param {string} options.format - Name format (default: '{firstname} {surname}')
   * @param {number} options.count - Number of names to generate (default: 1)
   * @returns {Promise<string|Array>} Generated name(s)
   * @throws {NominaError} When validation fails or generation errors occur
   */
  async generateName(options = {}) {
    await this._ensureSetup();

    const {
      language = 'de',
      species = 'human',
      gender = null,
      components = ['firstname', 'surname'],
      format = '{firstname} {surname}',
      count = 1
    } = options;

    // === Input Validation ===

    // Step 1: Validate language format
    const languageResult = validateLanguage(language);
    if (!languageResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        error: languageResult.error
      });
    }
    const normalizedLanguage = languageResult.normalized;

    // Step 2: Get available species for the language and verify language exists
    const availableSpecies = await this.generator.getAvailableSpecies(normalizedLanguage);

    // Check if language has any species (if not, language doesn't exist)
    if (!availableSpecies || availableSpecies.length === 0) {
      const allLanguages = await this.generator.getAvailableLanguages();
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        available: allLanguages.join(', '),
        error: `Language '${language}' is not available. Available languages: ${allLanguages.join(', ')}`
      });
    }

    // Extract codes from species objects for validation
    const availableSpeciesCodes = availableSpecies.map(s => s.code);

    // Step 3: Validate species against available species
    const speciesResult = validateSpecies(species, availableSpeciesCodes);
    if (!speciesResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_SPECIES, {
        value: species,
        language: normalizedLanguage,
        error: speciesResult.error
      });
    }
    const normalizedSpecies = speciesResult.normalized;

    // Step 4: Validate gender against supported genders
    const supportedGenders = getSupportedGenders();
    const genderResult = validateGender(gender, supportedGenders);
    if (!genderResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_GENDER, {
        value: gender,
        supported: supportedGenders,
        error: genderResult.error
      });
    }
    const normalizedGender = genderResult.normalized;

    // Step 5: Validate components array
    const componentsResult = validateComponents(components);
    if (!componentsResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_COMPONENTS, {
        value: components,
        error: componentsResult.error
      });
    }
    const normalizedComponents = componentsResult.normalized;

    // Step 6: Validate format string against components
    const formatResult = validateFormat(format, normalizedComponents);
    if (!formatResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_FORMAT, {
        value: format,
        components: normalizedComponents,
        error: formatResult.error
      });
    }
    const normalizedFormat = formatResult.normalized;

    // Step 7: Validate count
    const countResult = validateCount(count);
    if (!countResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_COUNT, {
        value: count,
        error: countResult.error
      });
    }
    const normalizedCount = countResult.normalized;

    // === Generation ===

    const packageCode = `${normalizedSpecies}-${normalizedLanguage}`;

    logDebug("Generating name with validated options:", {
      language: normalizedLanguage,
      species: normalizedSpecies,
      gender: normalizedGender,
      components: normalizedComponents,
      format: normalizedFormat,
      count: normalizedCount
    });

    // Fire beforeGenerate hook
    this._fireHook('names.beforeGenerate', { options });

    try {
      const result = await this.generator.generatePersonName(packageCode, {
        locale: normalizedLanguage,
        n: normalizedCount,
        gender: normalizedGender,
        components: normalizedComponents,
        format: normalizedFormat,
        allowDuplicates: false
      });

      // Fire afterGenerate hook
      this._fireHook('names.afterGenerate', { options, result });

      // Return single name or array based on count
      if (normalizedCount === 1 && result.suggestions && result.suggestions.length > 0) {
        return result.suggestions[0].text;
      }

      return result.suggestions ? result.suggestions.map(s => s.text) : [];

    } catch (error) {
      // Re-throw NominaErrors as-is
      if (error.isNominaError) {
        throw error;
      }

      // Wrap other errors in a NominaError
      logError("Failed to generate name:", error);
      throw createValidationError(ErrorType.GENERATION_FAILED, {
        language: normalizedLanguage,
        species: normalizedSpecies,
        originalError: error.message
      });
    }
  }

  /**
   * Generate multiple names
   * @param {Object} options - Same as generateName
   * @returns {Promise<Array<string>>} Array of generated names
   */
  async generateNames(options = {}) {
    // Handle null/undefined options
    if (options === null || options === undefined) {
      options = {};
    }
    const count = options.count || options.n || 10;
    return await this.generateName({ ...options, count });
  }

  /**
   * Get available languages
   * @returns {Promise<Array<string>>} Language codes
   */
  async getAvailableLanguages() {
    await this._ensureSetup();
    return await this.generator.getAvailableLanguages();
  }

  /**
   * Get available species for a language
   * @param {string} language - Language code
   * @returns {Promise<Array<string>>} Species codes
   */
  async getAvailableSpecies(language) {
    await this._ensureSetup();

    // Validate language parameter
    const languageValidation = validateLanguage(language);
    if (!languageValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        error: languageValidation.error
      });
    }

    return await this.generator.getAvailableSpecies(languageValidation.normalized);
  }

  /**
   * Get all species codes across all languages
   * Used by the species configuration dialog
   * @returns {Array<string>} All species codes
   */
  getAllSpeciesCodes() {
    if (!this._isSetup || !this.dataManager) {
      logWarn("DataManager not initialized, returning empty species list");
      return [];
    }

    const speciesCodes = new Set();
    const packages = this.dataManager.getLoadedPackages();

    for (const packageCode of packages) {
      const pkg = this.dataManager.getPackage(packageCode);
      if (pkg && pkg.species) {
        speciesCodes.add(pkg.species);
      }
    }

    return Array.from(speciesCodes).sort();
  }

  /**
   * Get available catalogs (categories) for a package
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @returns {Promise<Array<Object>>} Catalogs with code and name
   */
  async getAvailableCatalogs(language, species) {
    await this._ensureSetup();

    // Validate language parameter
    const languageValidation = validateLanguage(language);
    if (!languageValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        error: languageValidation.error
      });
    }

    // Get available species for the validated language and verify language exists
    const availableSpecies = await this.generator.getAvailableSpecies(languageValidation.normalized);

    // Check if language has any species (if not, language doesn't exist)
    if (!availableSpecies || availableSpecies.length === 0) {
      const allLanguages = await this.generator.getAvailableLanguages();
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        available: allLanguages.join(', '),
        error: `Language '${language}' is not available. Available languages: ${allLanguages.join(', ')}`
      });
    }

    // Extract codes from species objects for validation
    const availableSpeciesCodes = availableSpecies.map(s => s.code);

    // Validate species parameter
    const speciesValidation = validateSpecies(species, availableSpeciesCodes);
    if (!speciesValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_SPECIES, {
        value: species,
        language: languageValidation.normalized,
        error: speciesValidation.error
      });
    }

    const packageCode = `${speciesValidation.normalized}-${languageValidation.normalized}`;
    return await this.generator.getAvailableCatalogs(packageCode);
  }

  /**
   * Get available collections for a species-language combination
   * Collections are preset queries that define catalog + filter combinations, providing
   * convenient shortcuts for common name generation patterns (e.g., "noble names", "rare surnames").
   * This feature requires v4.0.1+ data format support.
   *
   * @param {string} language - Language code (e.g., 'de', 'en')
   * @param {string} species - Species code (e.g., 'human', 'elf', 'dwarf')
   * @returns {Promise<Array<{key: string, displayName: string}>>} Array of collection objects with key and localized displayName
   * @throws {NominaError} When validation fails or package doesn't exist
   *
   * @example
   * // Get available collections for German humans
   * const collections = await api.getAvailableCollections('de', 'human');
   * // Returns: [
   * //   { key: 'noble', displayName: 'Adelige' },
   * //   { key: 'rare', displayName: 'Selten' },
   * //   { key: 'common', displayName: 'Häufig' }
   * // ]
   *
   * @example
   * // Use collection keys with generateFromCatalog
   * const collections = await api.getAvailableCollections('de', 'human');
   * if (collections.length > 0) {
   *   const collectionKey = collections[0].key;
   *   // Collection keys can be used to filter catalog generation
   *   // (implementation depends on how collections are consumed)
   * }
   */
  async getAvailableCollections(language, species) {
    await this._ensureSetup();

    // === INPUT VALIDATION ===

    // Step 1: Validate language parameter
    const languageValidation = validateLanguage(language);
    if (!languageValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        error: languageValidation.error
      });
    }
    const normalizedLanguage = languageValidation.normalized;

    // Step 2: Get available species for the validated language and verify language exists
    const availableSpecies = await this.generator.getAvailableSpecies(normalizedLanguage);

    // Check if language has any species (if not, language doesn't exist)
    if (!availableSpecies || availableSpecies.length === 0) {
      const allLanguages = await this.generator.getAvailableLanguages();
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        available: allLanguages.join(', '),
        error: `Language '${language}' is not available. Available languages: ${allLanguages.join(', ')}`
      });
    }

    // Extract codes from species objects for validation
    const availableSpeciesCodes = availableSpecies.map(s => s.code);

    // Step 3: Validate species parameter
    const speciesValidation = validateSpecies(species, availableSpeciesCodes);
    if (!speciesValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_SPECIES, {
        value: species,
        language: normalizedLanguage,
        error: speciesValidation.error
      });
    }
    const normalizedSpecies = speciesValidation.normalized;

    // === RETRIEVE COLLECTIONS ===

    const packageCode = `${normalizedSpecies}-${normalizedLanguage}`;
    const collections = this.dataManager.getCollections(packageCode);

    // === LOCALIZE DISPLAY NAMES ===

    // Transform collections to return localized display names
    // Each collection has structure: { key, displayName: { de: "...", en: "..." }, query }
    return collections.map(collection => {
      let displayName;

      // Try to get displayName for the requested language
      if (collection.displayName && typeof collection.displayName === 'object') {
        displayName = collection.displayName[normalizedLanguage];
      }

      // Fallback 1: Try English displayName
      if (!displayName && collection.displayName && typeof collection.displayName === 'object') {
        displayName = collection.displayName.en;
      }

      // Fallback 2: Use the collection key capitalized
      if (!displayName) {
        displayName = collection.key.charAt(0).toUpperCase() + collection.key.slice(1);
      }

      return {
        key: collection.key,
        displayName: displayName
      };
    });
  }

  /**
   * Generate from a specific catalog
   * @param {Object} options - Options
   * @param {string} options.language - Language code
   * @param {string} options.species - Species code
   * @param {string} options.catalog - Catalog key (e.g., 'surnames', 'titles')
   * @param {Array} options.tags - Filter tags
   * @param {number} options.count - Number of items
   * @returns {Promise<Array<string>>} Generated items
   */
  async generateFromCatalog(options = {}) {
    await this._ensureSetup();

    const {
      language = 'de',
      species = 'human',
      catalog = 'surnames',
      tags = [],
      count = 1
    } = options;

    // === Input Validation ===

    // Validate language format
    const languageResult = validateLanguage(language);
    if (!languageResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        error: languageResult.error
      });
    }
    const normalizedLanguage = languageResult.normalized;

    // Get available species for validation and verify language exists
    const availableSpecies = await this.generator.getAvailableSpecies(normalizedLanguage);

    // Check if language has any species (if not, language doesn't exist)
    if (!availableSpecies || availableSpecies.length === 0) {
      const allLanguages = await this.generator.getAvailableLanguages();
      throw createValidationError(ErrorType.API_INVALID_LANGUAGE, {
        value: language,
        available: allLanguages.join(', '),
        error: `Language '${language}' is not available. Available languages: ${allLanguages.join(', ')}`
      });
    }

    // Extract codes from species objects for validation
    const availableSpeciesCodes = availableSpecies.map(s => s.code);

    // Validate species
    const speciesResult = validateSpecies(species, availableSpeciesCodes);
    if (!speciesResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_SPECIES, {
        value: species,
        language: normalizedLanguage,
        error: speciesResult.error
      });
    }
    const normalizedSpecies = speciesResult.normalized;

    // Get available catalogs for validation
    const packageCode = `${normalizedSpecies}-${normalizedLanguage}`;
    const availableCatalogs = await this.generator.getAvailableCatalogs(packageCode);
    const catalogCodes = availableCatalogs.map(c => c.code);

    // Validate catalog
    const catalogResult = validateCatalog(catalog, catalogCodes);
    if (!catalogResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_CATALOG, {
        value: catalog,
        package: packageCode,
        error: catalogResult.error
      });
    }
    const normalizedCatalog = catalogResult.normalized;

    // Validate tags
    const tagsResult = validateTags(tags);
    if (!tagsResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_TAGS, {
        value: tags,
        error: tagsResult.error
      });
    }
    const normalizedTags = tagsResult.normalized;

    // Validate count
    const countResult = validateCount(count);
    if (!countResult.isValid) {
      throw createValidationError(ErrorType.API_INVALID_COUNT, {
        value: count,
        error: countResult.error
      });
    }
    const normalizedCount = countResult.normalized;

    // === Generation ===

    logDebug("Generating from catalog with options:", {
      language: normalizedLanguage,
      species: normalizedSpecies,
      catalog: normalizedCatalog,
      tags: normalizedTags,
      count: normalizedCount
    });

    try {
      const result = await this.generator.generateFromCatalog(packageCode, normalizedCatalog, {
        locale: normalizedLanguage,
        n: normalizedCount,
        tags: normalizedTags,
        allowDuplicates: false
      });

      return result.suggestions ? result.suggestions.map(s => s.text) : [];
    } catch (error) {
      // Re-throw NominaErrors as-is
      if (error.isNominaError) {
        throw error;
      }
      // Wrap other errors in NominaError
      logError("Failed to generate from catalog:", error);
      throw createValidationError(ErrorType.GENERATION_FAILED, {
        catalog: normalizedCatalog,
        language: normalizedLanguage,
        species: normalizedSpecies
      });
    }
  }

  /**
   * UI Functions
   */

  /**
   * Open the main generator app
   */
  openGenerator() {
    if (!hasNamesGeneratorPermission()) {
      ui.notifications.warn(game.i18n.localize("names.no-permission"));
      return;
    }
    new NamesGeneratorApp().render(true);
  }

  /**
   * Open the picker app for an actor
   * @param {Actor} actor - The actor to pick a name for
   */
  openPicker(actor) {
    if (!hasNamesGeneratorPermission()) {
      ui.notifications.warn(game.i18n.localize("names.no-permission"));
      return;
    }
    new NamesPickerApp({ actor }).render(true);
  }

  /**
   * Open the emergency names app
   */
  openEmergency() {
    if (!hasNamesGeneratorPermission()) {
      ui.notifications.warn(game.i18n.localize("names.no-permission"));
      return;
    }
    new EmergencyNamesApp().render(true);
  }

  /**
   * Extension System
   */

  /**
   * Register a hook
   * @param {string} hookName - Hook name
   * @param {Function} callback - Callback function
   */
  registerHook(hookName, callback) {
    if (this.hooks[hookName]) {
      this.hooks[hookName].push(callback);
      logDebug(`Registered hook: ${hookName}`);
    } else {
      logWarn(`Unknown hook: ${hookName}`);
    }
  }

  /**
   * Fire a hook
   * @param {string} hookName - Hook name
   * @param {Object} data - Hook data
   */
  _fireHook(hookName, data) {
    // Fire internal hooks
    if (this.hooks[hookName]) {
      for (const callback of this.hooks[hookName]) {
        try {
          callback(data);
        } catch (error) {
          logError(`Error in hook ${hookName}:`, error);
        }
      }
    }

    // Also fire global Foundry hooks for third-party modules
    Hooks.callAll(hookName, data);
  }

  /**
   * Get supported genders
   * @returns {Array<string>} Gender codes
   */
  getSupportedGenders() {
    return getSupportedGenders();
  }

  /**
   * Register a new package (species-language combination)
   * @param {Object} options - Package registration options
   * @param {string} options.code - Package code (e.g., 'goblin-de')
   * @param {Object} options.data - Package data following V4 format
   * @returns {Promise<void>}
   *
   * @example
   * await api.registerPackage({
   *   code: 'goblin-de',
   *   data: {
   *     format: "4.0.0",
   *     package: {
   *       code: "goblin-de",
   *       displayName: { de: "Goblins", en: "Goblins" },
   *       languages: ["de"],
   *       phoneticLanguage: "de"
   *     },
   *     catalogs: {
   *       names: {
   *         displayName: { de: "Namen", en: "Names" },
   *         items: [
   *           { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1 }
   *         ]
   *       }
   *     }
   *   }
   * });
   */
  async registerPackage(options) {
    // === SAFETY WRAPPER: This method must NEVER crash Foundry ===
    try {
      await this._ensureSetup();
    } catch (error) {
      throw createValidationError(ErrorType.API_MODULE_NOT_READY, {
        error: error.message
      });
    }

    // === VALIDATION LAYER 1: options parameter ===
    // Type-safe check before accessing any properties
    if (options === null || options === undefined) {
      throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
        param: 'options',
        error: 'options cannot be null or undefined'
      });
    }

    // Ensure options is an object (not array, string, number, etc.)
    if (typeof options !== 'object' || Array.isArray(options)) {
      throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
        param: 'options',
        received: typeof options,
        error: 'options must be an object'
      });
    }

    // === VALIDATION LAYER 2: code parameter ===
    // Check if code exists
    if (!('code' in options) || options.code === null || options.code === undefined) {
      throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
        param: 'code',
        error: 'options.code is required'
      });
    }

    // Validate code using the Validator module
    const codeValidation = validatePackageCode(options.code);
    if (!codeValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_PACKAGE_CODE, {
        value: options.code,
        error: codeValidation.error
      });
    }

    const packageCode = codeValidation.normalized;

    // === VALIDATION LAYER 3: data parameter ===
    // Check if data exists
    if (!('data' in options) || options.data === null || options.data === undefined) {
      throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
        param: 'data',
        error: 'options.data is required'
      });
    }

    // Ensure data is an object
    const data = options.data;
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw createValidationError(ErrorType.API_MISSING_REQUIRED_PARAM, {
        param: 'data',
        received: typeof data,
        error: 'options.data must be an object'
      });
    }

    // === VALIDATION LAYER 4: data.format ===
    // Check if format exists
    if (!('format' in data) || data.format === null || data.format === undefined) {
      throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
        error: 'data.format is required'
      });
    }

    // Ensure format is a string
    if (typeof data.format !== 'string') {
      throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
        value: data.format,
        received: typeof data.format,
        error: 'data.format must be a string'
      });
    }

    // Validate format value (ONLY 4.0.0 is supported)
    if (data.format !== '4.0.0') {
      throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
        value: data.format,
        supported: '4.0.0',
        error: `Unsupported format "${data.format}". Only format "4.0.0" is supported.`
      });
    }

    // === VALIDATION LAYER 5: data.package ===
    // Check if package object exists
    if (!('package' in data) || data.package === null || data.package === undefined) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'package',
        error: 'data.package is required'
      });
    }

    // Ensure package is an object
    const packageInfo = data.package;
    if (typeof packageInfo !== 'object' || Array.isArray(packageInfo)) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'package',
        received: typeof packageInfo,
        error: 'data.package must be an object'
      });
    }

    // Check if package.code exists (required field)
    if (!('code' in packageInfo) || packageInfo.code === null || packageInfo.code === undefined) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'package.code',
        error: 'data.package.code is required'
      });
    }

    // Ensure package.code is a string
    if (typeof packageInfo.code !== 'string') {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'package.code',
        received: typeof packageInfo.code,
        error: 'data.package.code must be a string'
      });
    }

    // Verify package.code matches options.code
    if (packageInfo.code.trim() !== packageCode) {
      logWarn(`Package code mismatch: options.code="${packageCode}" but data.package.code="${packageInfo.code}". Using options.code.`);
    }

    // === VALIDATION LAYER 6: data.catalogs ===
    // Check if catalogs object exists
    if (!('catalogs' in data) || data.catalogs === null || data.catalogs === undefined) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'catalogs',
        error: 'data.catalogs is required'
      });
    }

    // Ensure catalogs is an object
    const catalogs = data.catalogs;
    if (typeof catalogs !== 'object' || Array.isArray(catalogs)) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'catalogs',
        received: typeof catalogs,
        error: 'data.catalogs must be an object'
      });
    }

    // Check if catalogs has at least one entry
    const catalogKeys = Object.keys(catalogs);
    if (catalogKeys.length === 0) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'catalogs',
        error: 'data.catalogs must contain at least one catalog'
      });
    }

    // === VALIDATION LAYER 7: Individual catalog validation (with try-catch) ===
    // This validation uses try-catch to ensure individual catalog errors don't crash Foundry
    let validCatalogCount = 0;
    const catalogValidationErrors = [];

    for (const catalogKey of catalogKeys) {
      try {
        const catalog = catalogs[catalogKey];

        // Skip null/undefined catalogs (log warning)
        if (catalog === null || catalog === undefined) {
          catalogValidationErrors.push(`${catalogKey}: catalog is ${catalog}`);
          logWarn(`Catalog "${catalogKey}" in package "${packageCode}" is ${catalog}, skipping.`);
          continue;
        }

        // Ensure catalog is an object
        if (typeof catalog !== 'object' || Array.isArray(catalog)) {
          catalogValidationErrors.push(`${catalogKey}: catalog must be an object, got ${typeof catalog}`);
          logWarn(`Catalog "${catalogKey}" in package "${packageCode}" is not an object, skipping.`);
          continue;
        }

        // Check for displayName (recommended but not required)
        if ('displayName' in catalog && catalog.displayName !== null && catalog.displayName !== undefined) {
          if (typeof catalog.displayName !== 'object' || Array.isArray(catalog.displayName)) {
            logWarn(`Catalog "${catalogKey}" has invalid displayName type, skipping validation.`);
          }
        }

        // Check for items array (required for a functional catalog)
        if (!('items' in catalog) || catalog.items === null || catalog.items === undefined) {
          catalogValidationErrors.push(`${catalogKey}: missing required items array`);
          logWarn(`Catalog "${catalogKey}" in package "${packageCode}" is missing items array, skipping.`);
          continue;
        }

        // Ensure items is an array
        if (!Array.isArray(catalog.items)) {
          catalogValidationErrors.push(`${catalogKey}: items must be an array, got ${typeof catalog.items}`);
          logWarn(`Catalog "${catalogKey}" in package "${packageCode}" has non-array items, skipping.`);
          continue;
        }

        // Check if items array has at least one item
        if (catalog.items.length === 0) {
          catalogValidationErrors.push(`${catalogKey}: items array is empty`);
          logWarn(`Catalog "${catalogKey}" in package "${packageCode}" has empty items array, skipping.`);
          continue;
        }

        // Catalog passed all validation checks
        validCatalogCount++;

      } catch (error) {
        // Individual catalog errors should never crash Foundry
        const errorMsg = `${catalogKey}: ${error.message}`;
        catalogValidationErrors.push(errorMsg);
        logError(`Error validating catalog "${catalogKey}" in package "${packageCode}":`, error);
      }
    }

    // Check if we have at least one valid catalog
    if (validCatalogCount === 0) {
      throw createValidationError(ErrorType.PACKAGE_MISSING_DATA, {
        field: 'catalogs',
        errors: catalogValidationErrors,
        error: `No valid catalogs found. All ${catalogKeys.length} catalog(s) failed validation.`
      });
    }

    // Log warnings for any catalogs that failed validation (but don't fail registration)
    if (catalogValidationErrors.length > 0) {
      logWarn(`Package "${packageCode}" has ${catalogValidationErrors.length} catalog(s) with validation errors:`, catalogValidationErrors);
    }

    // === REGISTRATION: All validation passed, register the package ===
    try {
      await this.dataManager.registerPackage(packageCode, data);

      logInfo(`Successfully registered package: ${packageCode} with ${validCatalogCount} valid catalog(s)`);

      // Fire hook
      this._fireHook('names.dataLoaded', { packageCode, data });

    } catch (error) {
      logError(`Failed to register package ${packageCode}:`, error);

      // Re-throw NominaErrors as-is
      if (error.isNominaError) {
        throw error;
      }

      // Wrap system errors in NominaError
      throw createValidationError(ErrorType.PACKAGE_INVALID_FORMAT, {
        packageCode,
        error: error.message
      });
    }
  }

  /**
   * Register multiple packages at once
   * @param {Array<Object>} packages - Array of package registration options
   * @returns {Promise<void>}
   */
  async registerPackages(packages) {
    if (!Array.isArray(packages)) {
      throw new Error('registerPackages expects an array of package options');
    }

    for (const pkg of packages) {
      await this.registerPackage(pkg);
    }
  }

  /**
   * Get global NamesData for backward compatibility
   * @deprecated Use getGlobalGenerator() instead
   */
  getGlobalNamesData() {
    logWarn("getGlobalNamesData() is deprecated. Use the V4 API methods instead.");
    return this.dataManager;
  }

  /**
   * Check if the API is ready without waiting
   * Use this method to synchronously check if the API has been initialized.
   * Returns true only if the API has completed setup and the generator is available.
   *
   * @returns {boolean} True if API is ready, false otherwise
   *
   * @example
   * // Check API readiness before attempting operations
   * const api = game.modules.get('nomina-names').api;
   * if (api.isReady()) {
   *   // Safe to use API
   *   const name = await api.generateName({ language: 'de' });
   * } else {
   *   console.warn('Nomina Names API not ready yet');
   * }
   */
  isReady() {
    return this._isSetup && this.generator !== null;
  }

  /**
   * Check if a package (species-language combination) exists in the loaded data
   * This method validates that both species and language are provided and checks
   * if the corresponding package has been loaded into the data manager.
   *
   * @param {string} species - The species code (e.g., 'human', 'elf', 'goblin')
   * @param {string} language - The language code (e.g., 'de', 'en', 'fr')
   * @returns {Promise<boolean>} True if the package exists, false otherwise
   * @throws {NominaError} When validation fails for species or language parameters
   *
   * @example
   * // Check if German human names are available
   * const api = game.modules.get('nomina-names').api;
   * await api.ready();
   * const hasGermanHumans = await api.hasPackage('human', 'de');
   * if (hasGermanHumans) {
   *   // Package exists, safe to generate names
   *   const name = await api.generateName({ species: 'human', language: 'de' });
   * }
   *
   * @example
   * // Check multiple packages
   * const packages = [
   *   { species: 'human', language: 'de' },
   *   { species: 'elf', language: 'de' },
   *   { species: 'goblin', language: 'en' }
   * ];
   * for (const pkg of packages) {
   *   const exists = await api.hasPackage(pkg.species, pkg.language);
   *   console.log(`${pkg.species}-${pkg.language}: ${exists ? 'available' : 'not found'}`);
   * }
   */
  async hasPackage(species, language) {
    await this._ensureSetup();

    // Validate package code format (species-language) without checking against available packages
    // The goal is to check if a package EXISTS, not to validate against available packages
    const packageCode = `${species}-${language}`;
    const packageCodeValidation = validatePackageCode(packageCode);
    if (!packageCodeValidation.isValid) {
      throw createValidationError(ErrorType.API_INVALID_PACKAGE_CODE, {
        packageCode,
        error: packageCodeValidation.error
      });
    }

    const pkg = this.dataManager.getPackage(packageCodeValidation.normalized);
    return pkg !== null && pkg !== undefined;
  }

  /**
   * Get the Validator object for external use
   * This provides access to the validation utilities used by the API, allowing
   * external modules to perform the same validations on their own data.
   *
   * @returns {Object} Validator object with validation methods
   * @returns {Function} return.validateLanguage - Validate language codes
   * @returns {Function} return.validateSpecies - Validate species codes
   * @returns {Function} return.validateGender - Validate gender values
   * @returns {Function} return.validateComponents - Validate name component arrays
   * @returns {Function} return.validateFormat - Validate format strings
   * @returns {Function} return.validateCatalog - Validate catalog codes
   * @returns {Function} return.validateTags - Validate tag arrays
   * @returns {Function} return.validateCount - Validate count values
   * @returns {Function} return.validatePackageCode - Validate package codes
   *
   * @example
   * // Validate user input before calling API
   * const api = game.modules.get('nomina-names').api;
   * const validator = api.getValidator();
   * const language = userInput;
   * const result = validator.validateLanguage(language);
   * if (!result.isValid) {
   *   ui.notifications.error(`Invalid language: ${result.error}`);
   *   return;
   * }
   * // Use normalized value
   * const name = await api.generateName({ language: result.normalized });
   *
   * @example
   * // Validate multiple parameters
   * const validator = api.getValidator();
   * const speciesCheck = validator.validateSpecies('dragon', []);
   * const genderCheck = validator.validateGender('female');
   * if (speciesCheck.isValid && genderCheck.isValid) {
   *   // Both valid, proceed with generation
   * }
   */
  getValidator() {
    return {
      validateLanguage,
      validateSpecies,
      validateGender,
      validateComponents,
      validateFormat,
      validateCatalog,
      validateTags,
      validateCount,
      validatePackageCode
    };
  }
}

// Create and export global instance
export const NamesAPI = new NamesModuleAPI();

// Also export as default
export default NamesAPI;
