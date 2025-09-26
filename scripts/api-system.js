/**
 * Names Module API - Public interface for other modules
 * Simplified to use unified DataManager system
 */

import { ensureGlobalNamesData, getGlobalNamesData } from './core/data-manager.js';
import { NameGenerator } from './core/name-generator.js';
import { NamesGeneratorApp } from './apps/generator-app.js';
import { NamesPickerApp } from './apps/picker-app.js';
import { EmergencyNamesApp } from './apps/emergency-app.js';
import { hasNamesGeneratorPermission } from './utils/permissions.js';
import { getSupportedGenders, GENDER_SYMBOLS, isCategorizedContent, getSubcategories } from './shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from './utils/logger.js';
import { validateAndSanitizeSpeciesData } from './utils/species-validator.js';

/**
 * Names Module API - Public interface for other modules
 * Provides methods for generating names, accessing data, and extending functionality
 */
class NamesModuleAPI {
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

    // Initialize unified system
    this.dataManager = null;
    this.nameGenerator = new NameGenerator();

    // Setup will be called after DataManager is ready
    this._isSetup = false;
  }

  /**
   * Setup the API with the DataManager instance
   */
  setup() {
    if (this._isSetup) return;

    this.dataManager = getGlobalNamesData();
    if (this.dataManager) {
      this.nameGenerator = new NameGenerator(this.dataManager);
      this._isSetup = true;
      logDebug("NamesModuleAPI setup completed with unified DataManager");
    }
  }

  /**
   * Ensure API is setup before use
   */
  _ensureSetup() {
    if (!this._isSetup) {
      this.setup();
    }
    if (!this.dataManager) {
      throw new Error("DataManager not available - ensure nomina-names module is initialized");
    }
  }

  /**
   * Main API functions for external modules
   */

  /**
   * Generate a single name or categorized content
   * @param {Object} options - Generation options
   * @param {string} options.language - Language code (default: 'de')
   * @param {string} options.species - Species code (default: 'human')
   * @param {string} options.category - Category (default: 'names')
   * @param {string} options.gender - Gender for names (default: 'male')
   * @param {string} options.subcategory - Specific subcategory
   * @param {Array} options.components - Name components for names category
   * @param {string} options.format - Name format for names category
   * @param {Object} options.filters - Metadata filters (3.0.1 format)
   * @param {boolean} options.returnWithMetadata - Return entry with metadata
   * @returns {Promise<string|Object>} Generated name/content or object with metadata
   */
  async generateName(options = {}) {
    this._ensureSetup();

    logDebug("Generating name with options:", options);

    // Fire beforeGenerate hook
    this._fireHook('names.beforeGenerate', { options });

    // Use the unified name generator
    const result = await this.nameGenerator.generateName(options);

    // Fire afterGenerate hook
    this._fireHook('names.afterGenerate', { options, result });

    logDebug("Generated name/content:", result);
    return result;
  }

  /**
   * Generate multiple names or categorized content
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of generated names/content
   */
  async generateNames(options = {}) {
    this._ensureSetup();

    const { count = 5, ...otherOptions } = options;

    logDebug(`Generating ${count} names with options:`, otherOptions);

    // Use the unified name generator with count parameter
    const result = await this.nameGenerator.generateName({
      ...otherOptions,
      count
    });

    // Ensure we always return an array
    const names = Array.isArray(result) ? result : [result];

    logDebug(`Generated ${names.length} names:`, names);
    return names;
  }

  /**
   * Generate categorized content (books, ships, shops, taverns)
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated content
   */
  async generateCategorizedContent(options = {}) {
    const {
      language = 'de',
      species = 'human',
      category,
      subcategory = null,
      useCustomData = true
    } = options;

    if (!category || !isCategorizedContent(category)) {
      throw new Error(`Invalid categorized content category: ${category}`);
    }

    logDebug("Generating categorized content with options:", options);

    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();

    if (useCustomData) {
      await this._loadCustomDataSources(language, species);
    }

    return await this._generateCategorizedContent(language, species, category, subcategory);
  }

  /**
   * Generate content from a specific subcategory (supports 3.0.0 format)
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated content
   */
  async generateFromSubcategory(options = {}) {
    const {
      language = 'de',
      species = 'human',
      category,
      subcategory,
      gender = null // For names subcategories
    } = options;

    if (!category || !subcategory) {
      throw new Error('Both category and subcategory are required');
    }

    logDebug("Generating from subcategory with options:", options);

    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();

    const subcategoryData = dataManager.getSubcategoryData(language, species, category, subcategory);
    if (!subcategoryData) {
      throw new Error(`No data found for ${language}.${species}.${category}.${subcategory}`);
    }

    // Handle different data structures
    if (Array.isArray(subcategoryData)) {
      // Simple array of entries
      const randomIndex = Math.floor(Math.random() * subcategoryData.length);
      return subcategoryData[randomIndex];
    } else if (typeof subcategoryData === 'object') {
      // Handle gender-specific entries (for names)
      if (gender && subcategoryData[gender] && Array.isArray(subcategoryData[gender])) {
        const genderEntries = subcategoryData[gender];
        const randomIndex = Math.floor(Math.random() * genderEntries.length);
        return genderEntries[randomIndex];
      } else {
        // Pick a random gender
        const genders = Object.keys(subcategoryData).filter(key => Array.isArray(subcategoryData[key]));
        if (genders.length > 0) {
          const randomGender = genders[Math.floor(Math.random() * genders.length)];
          const genderEntries = subcategoryData[randomGender];
          const randomIndex = Math.floor(Math.random() * genderEntries.length);
          return genderEntries[randomIndex];
        }
      }
    }

    throw new Error(`Unable to generate content from subcategory data structure`);
  }

  /**
   * Get available subcategories for a categorized content type
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code (books, ships, shops, taverns, names)
   * @returns {Promise<Array>} Array of available subcategories
   */
  async getAvailableSubcategories(language, species, category) {
    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();

    return dataManager.getAvailableSubcategories(language, species, category);
  }

  /**
   * Get available subcategories with display names for dynamic UI generation
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code (books, ships, shops, taverns, names)
   * @returns {Promise<Array>} Array of subcategory objects with key and displayName
   */
  async getSubcategoriesWithDisplayNames(language, species, category) {
    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();

    const subcategories = dataManager.getAvailableSubcategories(language, species, category);

    // If subcategories already have display names (3.0.0 format), return them
    if (subcategories.length > 0 && typeof subcategories[0] === 'object' && subcategories[0].displayName) {
      return subcategories;
    }

    // For legacy format, return with basic structure
    return subcategories.map(key => ({
      key: key,
      displayName: {
        de: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        en: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
      }
    }));
  }

  /**
   * Get all defined subcategories for a content type (from constants)
   * @param {string} category - Category code (books, ships, shops, taverns)
   * @returns {Object} Object with subcategory codes and localization keys
   */
  getDefinedSubcategories(category) {
    return getSubcategories(category);
  }

  /**
   * Check if a category is categorized content
   * @param {string} category - Category to check
   * @returns {boolean} True if categorized content
   */
  isCategorizedContent(category) {
    return isCategorizedContent(category);
  }

  /**
   * Get available languages
   * @returns {Array} Array of language objects
   */
  getAvailableLanguages() {
    this._ensureSetup();
    return this.dataManager.getLocalizedLanguages();
  }

  /**
   * Get available species (filtered by user settings)
   * @returns {Array} Array of species objects with code and name
   */
  getAvailableSpecies() {
    this._ensureSetup();
    return this.dataManager.getLocalizedSpecies();
  }

  /**
   * Get all species codes (including disabled ones)
   * @returns {Array} Array of species code strings
   */
  getAllSpeciesCodes() {
    this._ensureSetup();
    return Array.from(this.dataManager.availableSpecies);
  }

  /**
   * Register a new species for use in name generation
   * ONLY supports 3.0.1 format - external modules must use this format
   * @param {Object} speciesConfig - 3.0.1 format species configuration
   */
  registerSpecies(speciesConfig) {
    this._ensureSetup();

    if (!speciesConfig || typeof speciesConfig !== 'object') {
      logError("registerSpecies: Invalid species configuration - must be a 3.0.1 format object");
      throw new Error("Invalid species configuration - must be a 3.0.1 format object");
    }

    if (!speciesConfig.code || typeof speciesConfig.code !== 'string') {
      logError("registerSpecies: Species code is required and must be a string", speciesConfig);
      throw new Error("Species code is required and must be a string");
    }

    logInfo(`Registering API species: ${speciesConfig.code}`);

    // Validate and sanitize species data
    const validation = validateAndSanitizeSpeciesData(speciesConfig.code, speciesConfig);
    if (!validation.isValid) {
      logError(`Species validation failed for '${speciesConfig.code}':`, validation.errors);
      throw new Error(`Invalid species data: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings && validation.warnings.length > 0) {
      logWarn(`Species data sanitized for '${speciesConfig.code}':`, validation.warnings);
    }

    // Try to determine the calling module
    let callingModule = null;
    try {
      const stack = new Error().stack;
      const moduleMatch = stack.match(/\/modules\/([^\/]+)\//);
      if (moduleMatch) {
        callingModule = moduleMatch[1];
      }
    } catch (e) {
      // Fallback - can't determine calling module
    }

    try {
      this.dataManager.registerApiSpecies(validation.sanitizedData, callingModule);
      logInfo(`Successfully registered API species: ${speciesConfig.code}`);
    } catch (error) {
      logError(`Failed to register species ${speciesConfig.code}:`, error);
      throw error;
    }
  }

  /**
   * Convenience method for registering species from 3.0.1 JSON files
   * Ideal for external modules that load JSON data files
   * @param {Object|Array} jsonData - 3.0.1 format JSON data (single species object or array of species)
   */
  registerSpeciesFromJSON(jsonData) {
    this._ensureSetup();

    try {
      this.dataManager.registerSpeciesFromJSON(jsonData);
    } catch (error) {
      logError("Failed to register species from JSON:", error);
      throw error;
    }
  }

  /**
   * Get supported genders (respects settings)
   * @returns {Array} Array of supported gender strings
   */
  getSupportedGenders() {
    return getSupportedGenders();
  }

  /**
   * Get gender symbols
   * @returns {Object} Object with gender symbols
   */
  getGenderSymbols() {
    return { ...GENDER_SYMBOLS };
  }

  /**
   * Check if user has permission to use names generator
   * @returns {boolean} True if user has permission
   */
  hasPermission() {
    return hasNamesGeneratorPermission();
  }

  /**
   * Show names generator UI
   * @returns {Application} Generator app instance
   */
  showGenerator() {
    logDebug("Opening names generator UI");
    return new NamesGeneratorApp().render(true);
  }

  /**
   * Show names picker UI for an actor
   * @param {Actor} actor - Actor to pick names for
   * @returns {Application} Picker app instance
   */
  showPicker(actor) {
    logDebug("Opening names picker UI for actor:", actor?.name || "Unknown");
    return new NamesPickerApp({ actor }).render(true);
  }

  /**
   * Show emergency names UI
   * @returns {Application} Emergency app instance
   */
  showEmergencyNames() {
    logDebug("Opening emergency names UI");
    return new EmergencyNamesApp().render(true);
  }

  /**
   * Extension system for third-party modules
   */

  /**
   * Legacy species registration method (redirected to new registerSpecies)
   * @param {string} moduleId - ID of the registering module
   * @param {Object} speciesData - Species configuration and data
   */
  async registerSpeciesLegacy(moduleId, speciesData) {
    if (!speciesData || typeof speciesData !== 'object') {
      const errorMsg = 'Invalid species data - must be an object';
      logError(errorMsg, { moduleId, speciesData });
      throw new Error(errorMsg);
    }

    const {
      species,
      languages = ['de', 'en'],
      displayName,
      data = {},
      keywords = []
    } = speciesData;

    if (!species || typeof species !== 'string') {
      const errorMsg = 'Species registration requires a valid species code string';
      logError(errorMsg, { moduleId, species, speciesData });
      throw new Error(errorMsg);
    }

    if (!displayName || typeof displayName !== 'string') {
      const errorMsg = 'Species registration requires a valid displayName string';
      logError(errorMsg, { moduleId, species, displayName, speciesData });
      throw new Error(errorMsg);
    }

    // Convert to new format and call registerSpecies
    const dataMapping = {};
    for (const language of languages) {
      for (const [category, categoryData] of Object.entries(data)) {
        dataMapping[`${language}.${category}`] = categoryData;
      }
    }

    try {
      this.registerSpecies({
        code: species,
        displayName,
        languages,
        categories: Object.keys(data),
        data: dataMapping,
        moduleId,
        metadata: { keywords }
      });
    } catch (error) {
      logError(`Legacy registration failed for module ${moduleId}:`, error);
      throw error;
    }

    // Legacy tracking for compatibility
    const extensionKey = `${moduleId}.species.${species}`;
    this.registeredExtensions.set(extensionKey, {
      type: 'species',
      moduleId,
      species,
      displayName,
      languages,
      data,
      keywords,
      enabled: true
    });

    logInfo(`Registered species '${species}' from module '${moduleId}' via SpeciesManager`);
  }

  /**
   * Register custom name data for existing species
   * @param {string} moduleId - ID of the registering module
   * @param {Object} dataConfig - Data configuration
   */
  registerNameData(moduleId, dataConfig) {
    const {
      language,
      species,
      category,
      data,
      displayName
    } = dataConfig;

    if (!language || !species || !category || !data) {
      const errorMsg = 'Name data registration requires language, species, category, and data';
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const extensionKey = `${moduleId}.data.${language}.${species}.${category}`;
    this.registeredExtensions.set(extensionKey, {
      type: 'namedata',
      moduleId,
      language,
      species,
      category,
      displayName: displayName || `${species} ${category}`,
      enabled: true
    });

    const dataKey = `${language}.${species}.${category}`;
    this.customDataSources.set(dataKey, {
      moduleId,
      data,
      enabled: true
    });

    logInfo(`Registered name data '${dataKey}' from module '${moduleId}'`);
  }

  /**
   * Register categorized content data
   * @param {string} moduleId - ID of the registering module
   * @param {Object} contentConfig - Content configuration
   */
  registerCategorizedContent(moduleId, contentConfig) {
    const {
      language,
      species,
      category,
      subcategories = {},
      displayName
    } = contentConfig;

    if (!language || !species || !category || !isCategorizedContent(category)) {
      const errorMsg = 'Categorized content registration requires language, species, valid category, and subcategories';
      logError(errorMsg);
      throw new Error(errorMsg);
    }

    const extensionKey = `${moduleId}.categorized.${language}.${species}.${category}`;
    this.registeredExtensions.set(extensionKey, {
      type: 'categorized',
      moduleId,
      language,
      species,
      category,
      displayName: displayName || `${species} ${category}`,
      enabled: true
    });

    // Structure data for categorized content
    const structuredData = {};
    structuredData[category] = subcategories;

    const dataKey = `${language}.${species}.${category}`;
    this.customDataSources.set(dataKey, {
      moduleId,
      data: structuredData,
      enabled: true
    });

    logInfo(`Registered categorized content '${dataKey}' from module '${moduleId}'`);
  }

  /**
   * Register a hook listener
   * @param {string} hookName - Name of the hook
   * @param {Function} callback - Callback function
   */
  registerHook(hookName, callback) {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(callback);
    logDebug(`Registered hook listener for '${hookName}'`);
  }

  /**
   * Remove all extensions from a specific module
   * @param {string} moduleId - ID of the module to remove extensions for
   */
  unregisterModule(moduleId) {
    let removedExtensions = 0;
    let removedDataSources = 0;

    // Remove extensions
    for (const [key, extension] of this.registeredExtensions.entries()) {
      if (extension.moduleId === moduleId) {
        this.registeredExtensions.delete(key);
        removedExtensions++;
      }
    }

    // Remove custom data sources
    for (const [key, source] of this.customDataSources.entries()) {
      if (source.moduleId === moduleId) {
        this.customDataSources.delete(key);
        removedDataSources++;
      }
    }

    logInfo(`Unregistered all extensions from module '${moduleId}' (${removedExtensions} extensions, ${removedDataSources} data sources)`);
  }

  /**
   * Get all registered extensions
   * @param {string} type - Optional type filter ('species', 'namedata', 'categorized')
   * @returns {Array} Array of extension objects
   */
  getRegisteredExtensions(type = null) {
    const extensions = Array.from(this.registeredExtensions.values());
    const filtered = type ? extensions.filter(ext => ext.type === type) : extensions;
    
    logDebug(`Retrieved ${filtered.length} extensions` + (type ? ` of type '${type}'` : ''));
    return filtered;
  }

  /**
   * Internal methods (simplified)
   */

  _fireHook(hookName, data) {
    const callbacks = this.hooks[hookName] || [];
    if (callbacks.length === 0) {
      logDebug(`No listeners registered for hook '${hookName}'`);
      return;
    }

    logDebug(`Firing hook '${hookName}' for ${callbacks.length} listeners`);
    
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        logError(`Error in hook '${hookName}'`, error);
      }
    }
  }

  // ===== CONVENIENCE FUNCTIONS FOR EASY USAGE =====

  /**
   * Generates a random name with minimal configuration
   * @param {string} [species='human'] - Species: 'human', 'elf', 'dwarf', 'halfling', etc.
   * @param {string} [gender='random'] - Gender: 'male', 'female', 'nonbinary', 'random'
   * @param {string} [language='auto'] - Language: 'de', 'en', 'fr', 'es', 'it', 'auto'
   * @returns {Promise<string>} Generated name
   *
   * @example
   * const name = await api.randomName(); // Random human name
   * const elfName = await api.randomName('elf'); // Random elf name
   * const dwarfFemale = await api.randomName('dwarf', 'female'); // Female dwarf name
   */
  async randomName(species = 'human', gender = 'random', language = 'auto') {
    try {
      // Handle 'auto' language
      if (language === 'auto') {
        language = this._getAutoLanguage();
      }

      // Handle 'random' gender
      if (gender === 'random') {
        gender = this._getRandomGender(species);
      }

      const result = await this.generateName({
        language,
        species,
        gender,
        category: 'names',
        components: ['firstname', 'surname'],
        format: '{firstname} {surname}'
      });

      logDebug(`Generated random name "${result}" for ${species}/${gender}`);
      return result;
    } catch (error) {
      logWarn('Failed to generate random name, using fallback', error);
      return this._getFallbackName(species, gender);
    }
  }

  /**
   * Generates only a first name
   * @param {string} [species='human'] - Species
   * @param {string} [gender='random'] - Gender
   * @param {string} [language='auto'] - Language
   * @returns {Promise<string>} First name only
   */
  async firstName(species = 'human', gender = 'random', language = 'auto') {
    try {
      if (language === 'auto') language = this._getAutoLanguage();
      if (gender === 'random') gender = this._getRandomGender(species);

      return await this.generateName({
        language,
        species,
        gender,
        category: 'names',
        components: ['firstname'],
        format: '{firstname}'
      });
    } catch (error) {
      logWarn('Failed to generate first name', error);
      return this._getFallbackFirstName(gender);
    }
  }

  /**
   * Generates only a surname
   * @param {string} [species='human'] - Species
   * @param {string} [language='auto'] - Language
   * @returns {Promise<string>} Surname only
   */
  async surname(species = 'human', language = 'auto') {
    try {
      if (language === 'auto') language = this._getAutoLanguage();

      return await this.generateName({
        language,
        species,
        category: 'surnames'
      });
    } catch (error) {
      logWarn('Failed to generate surname', error);
      return 'Unbekannt';
    }
  }

  /**
   * Generates a settlement name
   * @param {string} [species='human'] - Species
   * @param {string} [language='auto'] - Language
   * @returns {Promise<string>} Settlement name
   */
  async settlement(species = 'human', language = 'auto') {
    try {
      if (language === 'auto') language = this._getAutoLanguage();

      return await this.generateName({
        language,
        species,
        category: 'settlements'
      });
    } catch (error) {
      logWarn('Failed to generate settlement', error);
      return 'Namenlose Stadt';
    }
  }

  /**
   * Generates a tavern name
   * @param {string} [species='human'] - Species
   * @param {string} [language='auto'] - Language
   * @returns {Promise<string>} Tavern name
   */
  async tavern(species = 'human', language = 'auto') {
    try {
      if (language === 'auto') language = this._getAutoLanguage();

      return await this.generateName({
        language,
        species,
        category: 'taverns'
      });
    } catch (error) {
      logWarn('Failed to generate tavern', error);
      return 'Zur Goldenen Krone';
    }
  }

  /**
   * Generates a shop name
   * @param {string} [species='human'] - Species
   * @param {string} [language='auto'] - Language
   * @returns {Promise<string>} Shop name
   */
  async shop(species = 'human', language = 'auto') {
    try {
      if (language === 'auto') language = this._getAutoLanguage();

      return await this.generateName({
        language,
        species,
        category: 'shops'
      });
    } catch (error) {
      logWarn('Failed to generate shop', error);
      return 'Allgemeiner Handel';
    }
  }

  /**
   * Generates a book title
   * @param {string} [species='human'] - Species
   * @param {string} [language='auto'] - Language
   * @returns {Promise<string>} Book title
   */
  async book(species = 'human', language = 'auto') {
    try {
      if (language === 'auto') language = this._getAutoLanguage();

      return await this.generateName({
        language,
        species,
        category: 'books'
      });
    } catch (error) {
      logWarn('Failed to generate book', error);
      return 'Das Buch der Geheimnisse';
    }
  }

  /**
   * Generates multiple names at once
   * @param {number} count - Number of names to generate
   * @param {string} [species='human'] - Species
   * @param {string} [gender='random'] - Gender (can be 'mixed' for variety)
   * @param {string} [language='auto'] - Language
   * @returns {Promise<Array<string>>} Array of generated names
   */
  async multipleNames(count = 5, species = 'human', gender = 'random', language = 'auto') {
    const names = [];

    for (let i = 0; i < count; i++) {
      const useGender = gender === 'mixed' ? 'random' : gender;
      try {
        const name = await this.randomName(species, useGender, language);
        names.push(name);
      } catch (error) {
        logWarn(`Failed to generate name ${i + 1}/${count}`, error);
        names.push(this._getFallbackName(species, useGender));
      }
    }

    return names;
  }

  /**
   * Quick NPC generator with name and basic info
   * @param {string} [species='human'] - Species
   * @param {string} [gender='random'] - Gender
   * @param {string} [language='auto'] - Language
   * @returns {Promise<Object>} NPC object with name, species, gender
   */
  async quickNPC(species = 'human', gender = 'random', language = 'auto') {
    if (gender === 'random') gender = this._getRandomGender(species);

    const name = await this.randomName(species, gender, language);

    return {
      name,
      species,
      gender,
      fullName: name,
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || ''
    };
  }

  // ===== HELPER METHODS =====

  /**
   * Gets automatic language based on Foundry settings
   * @private
   */
  _getAutoLanguage() {
    const foundryLang = game.settings.get("core", "language");
    const mapping = {
      'en': 'en',
      'de': 'de',
      'fr': 'fr',
      'es': 'es',
      'it': 'it'
    };
    return mapping[foundryLang] || 'de';
  }

  /**
   * Gets a random gender for the species
   * @private
   */
  _getRandomGender(species) {
    // Most species support male/female, some also nonbinary
    const genders = ['male', 'female'];

    // Add nonbinary for species that support it
    if (['human', 'elf'].includes(species)) {
      genders.push('nonbinary');
    }

    return genders[Math.floor(Math.random() * genders.length)];
  }

  /**
   * Provides fallback names when generation fails
   * @private
   */
  _getFallbackName(species, gender) {
    const fallbacks = {
      human: {
        male: ['Johann Müller', 'Hans Weber', 'Klaus Schmidt'],
        female: ['Anna Müller', 'Maria Weber', 'Elisabeth Schmidt'],
        nonbinary: ['Alex Müller', 'Sam Weber', 'Robin Schmidt']
      },
      elf: {
        male: ['Legolas Waldläufer', 'Elrond Sterndeuter', 'Thranduil Blattflüsterer'],
        female: ['Galadriel Mondschein', 'Arwen Sternenlicht', 'Tauriel Waldtänzerin'],
        nonbinary: ['Rivendell Dämmerlicht', 'Lothlórien Waldgeist', 'Mirkwood Sternenwanderer']
      },
      dwarf: {
        male: ['Thorin Steinhammer', 'Gimli Axtschwinger', 'Balin Goldgräber'],
        female: ['Daina Steinhammer', 'Nori Axtschwinger', 'Dwalin Goldgräber']
      }
    };

    const speciesFallbacks = fallbacks[species] || fallbacks.human;
    const genderFallbacks = speciesFallbacks[gender] || speciesFallbacks.male || ['Unbekannt Unbekannt'];

    return genderFallbacks[Math.floor(Math.random() * genderFallbacks.length)];
  }

  /**
   * Generate name with metadata (3.0.1 format support)
   * @param {Object} options - Generation options (same as generateName)
   * @returns {Promise<Object>} Generated entry with name and metadata
   */
  async generateNameWithMetadata(options = {}) {
    return this.generateName({ ...options, returnWithMetadata: true });
  }

  /**
   * Generate names with metadata filters (3.0.1 format)
   * @param {Object} options - Generation options with filters
   * @param {Object} options.filters - Metadata filter criteria
   * @param {string|Array} options.filters.style - Style filter(s)
   * @param {string|Array} options.filters.rarity - Rarity filter(s)
   * @param {string|Array} options.filters.region - Region filter(s)
   * @returns {Promise<Array>} Array of filtered generated names/content
   */
  async generateNamesWithFilters(options = {}) {
    return this.generateNames(options);
  }

  /**
   * Provides fallback first names
   * @private
   */
  _getFallbackFirstName(gender) {
    const fallbacks = {
      male: ['Johann', 'Hans', 'Klaus', 'Peter', 'Wolfgang'],
      female: ['Anna', 'Maria', 'Elisabeth', 'Ursula', 'Ingrid'],
      nonbinary: ['Alex', 'Sam', 'Robin', 'Jordan', 'Casey']
    };

    const names = fallbacks[gender] || fallbacks.male;
    return names[Math.floor(Math.random() * names.length)];
  }
}

// Create and export the API instance
export const NamesAPI = new NamesModuleAPI();


// Example usage for third-party modules:
/*
// In a third-party module's init hook:
Hooks.once('init', () => {
  // Register categorized content
  game.modules.get('nomina-names').api.registerCategorizedContent('my-module', {
    language: 'de',
    species: 'human',
    category: 'books',
    displayName: 'Custom Books',
    subcategories: {
      magic_books: ['Das große Buch der Zauber', 'Elementare Magie für Anfänger'],
      history_books: ['Die Kriege von Cormyr', 'Chroniken des Nordens']
    }
  });

  // Generate categorized content
  const bookName = await game.modules.get('nomina-names').api.generateCategorizedContent({
    language: 'de',
    species: 'human',
    category: 'books',
    subcategory: 'magic_books' // optional - will pick random if not specified
  });

  // Get available subcategories
  const subcategories = await game.modules.get('nomina-names').api.getAvailableSubcategories('de', 'human', 'books');

  // ==== SIMPLIFIED API FUNCTIONS ====
  // New convenience functions for easy usage:

  // Generate a random name (human by default)
  const simpleName = await game.modules.get('nomina-names').api.randomName();

  // Generate specific types
  const elfName = await game.modules.get('nomina-names').api.randomName('elf');
  const dwarfFemale = await game.modules.get('nomina-names').api.randomName('dwarf', 'female');

  // Generate other content types
  const tavernName = await game.modules.get('nomina-names').api.tavern();
  const settlement = await game.modules.get('nomina-names').api.settlement('elf');
  const shopName = await game.modules.get('nomina-names').api.shop();
  const bookTitle = await game.modules.get('nomina-names').api.book();

  // Component functions
  const firstName = await game.modules.get('nomina-names').api.firstName('elf', 'female');
  const surname = await game.modules.get('nomina-names').api.surname('dwarf');

  // Generate multiple names
  const npcNames = await game.modules.get('nomina-names').api.multipleNames(5, 'human', 'mixed');

  // Quick NPC generation
  const npc = await game.modules.get('nomina-names').api.quickNPC('halfling', 'female');
  // Returns: { name: "...", species: "halfling", gender: "female", firstName: "...", lastName: "..." }

  // ==== 3.0.1 FORMAT WITH METADATA ====

  // Generate with metadata
  const nameWithMeta = await game.modules.get('nomina-names').api.generateNameWithMetadata({
    language: 'de',
    species: 'elf',
    category: 'names',
    subcategory: 'firstnames',
    gender: 'male'
  });
  // Returns: { name: "Thalion", meta: { style: "ancient", rarity: "uncommon" } }

  // Generate with filters
  const ancientNames = await game.modules.get('nomina-names').api.generateNames({
    language: 'de',
    species: 'elf',
    category: 'names',
    subcategory: 'firstnames',
    gender: 'male',
    count: 5,
    filters: {
      style: 'ancient',
      rarity: ['uncommon', 'rare']
    }
  });

  // Generate taverns with specific atmosphere
  const cozyTaverns = await game.modules.get('nomina-names').api.generateNames({
    language: 'de',
    species: 'human',
    category: 'taverns',
    subcategory: 'upscale',
    count: 3,
    filters: {
      atmosphere: 'cozy',
      region: ['urban', 'coastal']
    }
  });
});
*/