/**
 * Names Module API - Public interface for other modules
 * Updated to support categorized content (books, ships, shops, taverns)
 */

import { ensureGlobalNamesData, getGlobalNamesData } from './core/data-manager.js';
import { NamesGeneratorApp } from './apps/generator-app.js';
import { NamesPickerApp } from './apps/picker-app.js';
import { EmergencyNamesApp } from './apps/emergency-app.js';
import { hasNamesGeneratorPermission } from './utils/permissions.js';
import { getSupportedGenders, GENDER_SYMBOLS, isCategorizedContent, getSubcategories } from './shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from './utils/logger.js';

/**
 * Names Module API - Public interface for other modules
 * Provides methods for generating names, accessing data, and extending functionality
 */
class NamesModuleAPI {
  /**
   * Creates a new Names Module API instance
   */
  constructor() {
    this.registeredExtensions = new Map();
    this.customDataSources = new Map();
    this.hooks = {
      'names.beforeGenerate': [],
      'names.afterGenerate': [],
      'names.dataLoaded': []
    };
  }

  /**
   * Main API functions for external modules
   */

  /**
   * Generate a single name or categorized content
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated name or content
   */
  async generateName(options = {}) {
    const {
      language = 'de',
      species = 'human',
      gender = 'male',
      category = null,
      subcategory = null,
      components = ['firstname', 'surname'],
      format = '{firstname} {surname}',
      useCustomData = true
    } = options;

    logDebug("Generating name with options:", options);

    // Fire beforeGenerate hook
    this._fireHook('names.beforeGenerate', { options });

    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();

    // Include custom data sources if requested
    if (useCustomData) {
      await this._loadCustomDataSources(language, species);
    }

    let result;

    // Determine generation type based on category
    if (category && isCategorizedContent(category)) {
      result = await this._generateCategorizedContent(language, species, category, subcategory);
    } else if (category === 'names' || (!category && components.length > 0)) {
      result = await this._performNameGeneration(language, species, gender, components, format);
    } else if (category) {
      result = await this._generateSimpleContent(language, species, category);
    } else {
      result = await this._performNameGeneration(language, species, gender, components, format);
    }
    
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
    const { count = 5, ...otherOptions } = options;
    const names = [];

    logDebug(`Generating ${count} names with options:`, otherOptions);

    for (let i = 0; i < count; i++) {
      const name = await this.generateName(otherOptions);
      if (name) names.push(name);
    }

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
   * Get available subcategories for a categorized content type
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code (books, ships, shops, taverns)
   * @returns {Promise<Array>} Array of available subcategories
   */
  async getAvailableSubcategories(language, species, category) {
    if (!isCategorizedContent(category)) {
      return [];
    }

    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();
    
    return dataManager.getAvailableSubcategories(language, species, category);
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
    const dataManager = getGlobalNamesData();
    if (!dataManager) return [];
    return dataManager.getLocalizedLanguages();
  }

  /**
   * Get available species (filtered by user settings)
   * @returns {Array} Array of species objects with code and name
   */
  getAvailableSpecies() {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return [];
    return dataManager.getLocalizedSpecies();
  }

  /**
   * Get all species codes (including disabled ones)
   * @returns {Array} Array of species code strings
   */
  getAllSpeciesCodes() {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return [];
    return Array.from(dataManager.availableSpecies);
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
   * Register a new species with name data
   * @param {string} moduleId - ID of the registering module
   * @param {Object} speciesData - Species configuration and data
   */
  registerSpecies(moduleId, speciesData) {
    const {
      species,
      languages = ['de', 'en'],
      displayName,
      data = {},
      keywords = []
    } = speciesData;

    if (!species || !displayName) {
      const errorMsg = 'Species registration requires species code and displayName';
      logError(errorMsg);
      throw new Error(errorMsg);
    }

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

    // Register custom data sources
    for (const language of languages) {
      for (const [category, categoryData] of Object.entries(data)) {
        const dataKey = `${language}.${species}.${category}`;
        this.customDataSources.set(dataKey, {
          moduleId,
          data: categoryData,
          enabled: true
        });
      }
    }

    logInfo(`Registered species '${species}' from module '${moduleId}'`);
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
   * Internal methods
   */

  async _loadCustomDataSources(language, species) {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return;

    let loadedSources = 0;

    // Load custom data for all categories of this language-species combination
    for (const [dataKey, source] of this.customDataSources.entries()) {
      if (!source.enabled) continue;
      
      const [dataLang, dataSpecies] = dataKey.split('.');
      if (dataLang === language && dataSpecies === species) {
        // Inject custom data into the data manager
        if (!dataManager.nameData.has(dataKey)) {
          dataManager.nameData.set(dataKey, source.data);
        } else {
          // Merge with existing data
          const existing = dataManager.nameData.get(dataKey);
          const merged = this._mergeNameData(existing, source.data);
          dataManager.nameData.set(dataKey, merged);
        }
        loadedSources++;
      }
    }

    if (loadedSources > 0) {
      logDebug(`Loaded ${loadedSources} custom data sources for ${language}.${species}`);
    }
  }

  _mergeNameData(existing, custom) {
    const merged = { ...existing };
    
    if (custom.names) {
      if (Array.isArray(custom.names)) {
        merged.names = [...(merged.names || []), ...custom.names];
      } else if (typeof custom.names === 'object') {
        merged.names = merged.names || {};
        for (const [gender, names] of Object.entries(custom.names)) {
          merged.names[gender] = [...(merged.names[gender] || []), ...names];
        }
      }
    }

    if (custom.settlements) {
      merged.settlements = [...(merged.settlements || []), ...custom.settlements];
    }

    if (custom.titles) {
      merged.titles = merged.titles || {};
      for (const [gender, titles] of Object.entries(custom.titles)) {
        merged.titles[gender] = [...(merged.titles[gender] || []), ...titles];
      }
    }

    // Merge categorized content (books, ships, shops, taverns)
    for (const contentType of ['books', 'ships', 'shops', 'taverns']) {
      if (custom[contentType]) {
        merged[contentType] = merged[contentType] || {};
        for (const [subcategory, items] of Object.entries(custom[contentType])) {
          merged[contentType][subcategory] = [
            ...(merged[contentType][subcategory] || []), 
            ...items
          ];
        }
      }
    }

    // Merge authors
    if (custom.authors) {
      merged.authors = [...(merged.authors || []), ...custom.authors];
    }

    return merged;
  }

  async _generateCategorizedContent(language, species, category, subcategory) {
    const dataManager = getGlobalNamesData();
    if (!dataManager) {
      logError("Data manager not available for categorized content generation");
      return null;
    }

    // Ensure data is loaded
    const hasData = await dataManager.ensureDataLoaded(language, species, category);
    if (!hasData) {
      logWarn(`No data available for ${language}.${species}.${category}`);
      return null;
    }

    // If specific subcategory requested, use it
    if (subcategory) {
      const subcategoryData = dataManager.getSubcategoryData(language, species, category, subcategory);
      if (!subcategoryData || subcategoryData.length === 0) {
        logWarn(`No data available for subcategory ${subcategory}`);
        return null;
      }
      return subcategoryData[Math.floor(Math.random() * subcategoryData.length)];
    }

    // Otherwise, pick random subcategory and random item
    const availableSubcategories = dataManager.getAvailableSubcategories(language, species, category);
    if (availableSubcategories.length === 0) {
      logWarn(`No subcategories available for ${language}.${species}.${category}`);
      return null;
    }

    const randomSubcategory = availableSubcategories[Math.floor(Math.random() * availableSubcategories.length)];
    const subcategoryData = dataManager.getSubcategoryData(language, species, category, randomSubcategory);
    
    if (!subcategoryData || subcategoryData.length === 0) {
      logWarn(`No data in randomly selected subcategory ${randomSubcategory}`);
      return null;
    }

    const result = subcategoryData[Math.floor(Math.random() * subcategoryData.length)];
    logDebug(`Generated categorized content from ${category}.${randomSubcategory}: ${result}`);
    return result;
  }

  async _generateSimpleContent(language, species, category) {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return null;

    const hasData = await dataManager.ensureDataLoaded(language, species, category);
    if (!hasData) {
      logWarn(`No data available for ${language}.${species}.${category}`);
      return null;
    }

    if (category === 'settlements') {
      const settlementData = dataManager.getData(`${language}.${species}.settlements`);
      if (!settlementData?.settlements) {
        return null;
      }
      const settlements = settlementData.settlements;
      const settlement = settlements[Math.floor(Math.random() * settlements.length)];
      return settlement.name || settlement;
    } else {
      return this._getRandomFromData(dataManager, language, species, category);
    }
  }

  async _performNameGeneration(language, species, gender, components, format) {
    const dataManager = getGlobalNamesData();
    if (!dataManager) {
      logError("Data manager not available for name generation");
      return null;
    }

    // Ensure data is loaded
    for (const component of components) {
      const category = component === 'firstname' ? gender : component;
      const hasData = await dataManager.ensureDataLoaded(language, species, category);
      if (!hasData) {
        logWarn(`No data available for ${language}.${species}.${category}`);
      }
    }

    // Generate name components
    const nameComponents = {};
    for (const component of components) {
      const part = await this._generateNameComponent(dataManager, language, species, gender, component);
      if (part) {
        nameComponents[component] = part;
      }
    }

    // Format the name
    return this._formatName(format, nameComponents);
  }

  async _generateNameComponent(dataManager, language, species, gender, component) {
    switch (component) {
      case 'firstname':
        return this._getRandomFromData(dataManager, language, species, gender);
      case 'surname':
        return this._getRandomFromData(dataManager, language, species, 'surnames');
      case 'nickname':
        const nickname = this._getRandomFromGenderedData(dataManager, language, species, 'nicknames', gender);
        return nickname ? `"${nickname}"` : null;
      case 'title':
        return this._generateTitle(dataManager, language, species, gender);
      default:
        logWarn(`Unknown name component: ${component}`);
        return null;
    }
  }

  _getRandomFromData(dataManager, language, species, category) {
    const key = `${language}.${species}.${category}`;
    const data = dataManager.getData(key);
    
    if (!data?.names || data.names.length === 0) {
      logDebug(`No data found for ${key}`);
      return null;
    }
    
    return data.names[Math.floor(Math.random() * data.names.length)];
  }

  _getRandomFromGenderedData(dataManager, language, species, category, gender) {
    const key = `${language}.${species}.${category}`;
    const data = dataManager.getData(key);

    if (data?.names && typeof data.names === 'object' && data.names[gender]) {
      const genderNames = data.names[gender];
      if (genderNames.length === 0) {
        logDebug(`No ${gender} names found for ${key}`);
        return null;
      }
      return genderNames[Math.floor(Math.random() * genderNames.length)];
    }

    if (data?.names && Array.isArray(data.names)) {
      return data.names[Math.floor(Math.random() * data.names.length)];
    }

    logDebug(`No gendered data found for ${key}`);
    return null;
  }

  _generateTitle(dataManager, language, species, gender) {
    const titleData = dataManager.getData(`${language}.${species}.titles`);
    if (!titleData?.titles) {
      logDebug(`No title data found for ${language}.${species}`);
      return null;
    }

    const genderTitles = titleData.titles[gender];
    if (!genderTitles || genderTitles.length === 0) {
      // Fallback to male titles for nonbinary if available
      if (gender === 'nonbinary' && titleData.titles.male) {
        const maleTitles = titleData.titles.male;
        const selectedTitle = maleTitles[Math.floor(Math.random() * maleTitles.length)];
        logDebug(`Using male title as fallback for nonbinary: ${selectedTitle.name || selectedTitle}`);
        return selectedTitle.name || selectedTitle;
      }
      logDebug(`No ${gender} titles found for ${language}.${species}`);
      return null;
    }

    const selectedTitle = genderTitles[Math.floor(Math.random() * genderTitles.length)];
    return selectedTitle.name || selectedTitle;
  }

  _formatName(format, components) {
    let result = format;

    const placeholders = {
      '{firstname}': components.firstname || '',
      '{surname}': components.surname || '',
      '{title}': components.title || '',
      '{nickname}': components.nickname || ''
    };

    for (const [placeholder, value] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    result = result
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*,/g, ',')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .replace(/,\s*$/g, '')
      .replace(/^\s*,/g, '')
      .replace(/\s+,/g, ',')
      .replace(/,\s*/g, ', ')
      .trim();

    return result;
  }

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
});
*/