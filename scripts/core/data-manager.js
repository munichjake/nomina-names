/**
 * Names Data Manager - Handles loading and caching of name data
 */

import { isCategorizedContent, DATA_PATHS, MODULE_ID } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError, logInfoL, logWarnL, logErrorL, logDebugL } from '../utils/logger.js';

/**
 * Names Data Manager - Central management for name data loading, caching, and access
 * Handles loading of name files, grammar rules, and provides API for name generation
 */
export class NamesDataManager {
  /**
   * Creates a new Names Data Manager instance
   */
  constructor() {
    this.nameData = new Map();
    this.availableLanguages = new Set();
    this.availableSpecies = new Set();
    this.availableCategories = new Set();
    this.grammarRules = new Map();
    this.languageConfig = null;
    this.speciesConfig = null;
    this.isLoading = false;
    this.isLoaded = false;
    this.loadingPromise = null;
  }

  /**
   * Starts loading data in the background
   * Loads index file first, then loads available name data files
   * @returns {Promise} Promise that resolves when all data is loaded
   */
  async initializeData() {
    if (this.isLoaded || this.isLoading) {
      return this.loadingPromise;
    }

    this.isLoading = true;
    this._log('console.background-loading-started');

    this.loadingPromise = this._loadAllData();

    try {
      await this.loadingPromise;
      this.isLoaded = true;
      this._log('console.background-loading-completed');

      // Fire hook for API extensions
      this._fireDataLoadedHook();
    } catch (error) {
      this._log('console.background-loading-failed', null, error);
    } finally {
      this.isLoading = false;
    }

    return this.loadingPromise;
  }

  /**
   * Loads all configuration and name data
   */
  async _loadAllData() {
    await this.loadConfigs();
    await this.loadNameData();
  }

  /**
   * Loads language and species configuration files
   */
  async loadConfigs() {
    try {
      const langResponse = await fetch(DATA_PATHS.langConfig);
      if (langResponse.ok) {
        this.languageConfig = await langResponse.json();
        this._log('console.grammar-loaded', { key: 'language config' });
      }
    } catch (error) {
      this._log('console.index-error', null, error);
    }

    try {
      const speciesResponse = await fetch(DATA_PATHS.speciesMapping);
      if (speciesResponse.ok) {
        this.speciesConfig = await speciesResponse.json();
        this._log('console.grammar-loaded', { key: 'species config' });
      }
    } catch (error) {
      this._log('console.index-error', null, error);
    }
  }

  /**
   * Loads all name data from index or fallback files
   */
  async loadNameData() {
    this._log('console.loading-index');

    try {
      const indexResponse = await fetch(DATA_PATHS.index);
      if (!indexResponse.ok) {
        this._log('console.index-not-found');
        await this.loadFallbackData();
        return;
      }

      const indexData = await indexResponse.json();

      // Load category definitions if available
      if (indexData.categoryGroups) {
        // Import and set category definitions from new grouped structure
        const { setCategoryDefinitionsFromGroups } = await import('../shared/constants.js');
        setCategoryDefinitionsFromGroups(indexData.categoryGroups);
        logDebug("Category groups loaded from index:", Object.keys(indexData.categoryGroups));
      } else if (indexData.categories) {
        // Fallback to old structure
        const { setCategoryDefinitions } = await import('../shared/constants.js');
        setCategoryDefinitions(indexData.categories);
        logDebug("Category definitions loaded from index:", Object.keys(indexData.categories));
      }

      this._log('console.index-loaded', { count: indexData.files.length });

      const loadPromises = indexData.files
        .filter(file => file.enabled !== false)
        .map(file => this.loadDataFileFromIndex(file));

      await Promise.all(loadPromises);

    } catch (error) {
      this._log('console.index-error', null, error);
      await this.loadFallbackData();
    }
    logDebug("Available languages:", Array.from(this.availableLanguages));
    logDebug("Available species:", Array.from(this.availableSpecies));
    logDebug("Available categories:", Array.from(this.availableCategories));
  }

  /**
   * Loads known fallback data files when index.json is not available
   * Uses hardcoded list of known data files as backup
   */
  async loadFallbackData() {
    const knownFiles = [
      { filename: 'de.human.male.json', language: 'de', species: 'human', category: 'male' },
      { filename: 'de.human.female.json', language: 'de', species: 'human', category: 'female' },
      { filename: 'de.human.surnames.json', language: 'de', species: 'human', category: 'surnames' },
      { filename: 'de.human.titles.json', language: 'de', species: 'human', category: 'titles' },
      { filename: 'de.human.nicknames.json', language: 'de', species: 'human', category: 'nicknames' },
      { filename: 'de.human.settlements.json', language: 'de', species: 'human', category: 'settlements' },
      { filename: 'de.elf.male.json', language: 'de', species: 'elf', category: 'male' },
      // Add categorized content fallbacks
      { filename: 'de.human.books.json', language: 'de', species: 'human', category: 'books' },
      { filename: 'de.human.ships.json', language: 'de', species: 'human', category: 'ships' },
      { filename: 'de.human.shops.json', language: 'de', species: 'human', category: 'shops' },
      { filename: 'de.human.taverns.json', language: 'de', species: 'human', category: 'taverns' }
    ];

    // Add nonbinary data if supported
    try {
      const includeNonbinary = game.settings.get(MODULE_ID, 'includeNonbinaryNames');
      if (includeNonbinary) {
        knownFiles.push(
          { filename: 'de.human.nonbinary.json', language: 'de', species: 'human', category: 'nonbinary' },
          { filename: 'de.elf.nonbinary.json', language: 'de', species: 'elf', category: 'nonbinary' }
        );
      }
    } catch (error) {
      // Setting might not exist yet during initialization
      logDebug("Setting 'includeNonbinaryNames' not available during fallback loading");
    }

    const loadPromises = knownFiles.map(file => this.loadDataFileFromIndex(file));
    await Promise.all(loadPromises);
  }

  /**
   * Loads a single data file based on index information
   * @param {Object} fileInfo - File information from index.json
   * @param {string} fileInfo.filename - Name of the file to load
   * @param {string} fileInfo.language - Language code
   * @param {string} fileInfo.species - Species code
   * @param {string} fileInfo.category - Category code
   */
  async loadDataFileFromIndex(fileInfo) {
    try {
      const response = await fetch(`${DATA_PATHS.base}${fileInfo.filename}`);
      if (!response.ok) {
        this._log('console.file-unavailable', {
          filename: fileInfo.filename,
          status: response.status
        });
        return;
      }

      const data = await response.json();

      this.availableLanguages.add(fileInfo.language);
      this.availableSpecies.add(fileInfo.species);
      this.availableCategories.add(fileInfo.category);

      const key = `${fileInfo.language}.${fileInfo.species}.${fileInfo.category}`;
      this.nameData.set(key, data);

      if (data.grammar && fileInfo.category === 'titles') {
        const grammarKey = `${fileInfo.language}.${fileInfo.species}`;
        this.grammarRules.set(grammarKey, data.grammar);
        this._log('console.grammar-loaded', { key: grammarKey });
      }

      const entryCount = this._getDataEntryCount(data, fileInfo.category);
      this._log('console.file-loaded', {
        filename: fileInfo.filename,
        count: entryCount
      });

    } catch (error) {
      this._log('console.file-failed', {
        filename: fileInfo.filename,
        error: error.message
      });
    }
  }

  /**
   * Counts entries in a data file
   * @param {Object} data - Data object
   * @param {string} category - Data category
   * @returns {number} Entry count
   */
  _getDataEntryCount(data, category) {
    if (category === 'titles' && data.titles) {
      return (data.titles.male?.length || 0) + (data.titles.female?.length || 0) + (data.titles.nonbinary?.length || 0);
    }
    if (category === 'nicknames' && data.names) {
      return (data.names.male?.length || 0) + (data.names.female?.length || 0) + (data.names.nonbinary?.length || 0);
    }

    // Handle categorized content (books, ships, shops, taverns)
    if (isCategorizedContent(category)) {
      let totalCount = 0;
      const contentKey = Object.keys(data).find(key =>
        key === 'books' || key === 'ships' || key === 'shops' || key === 'taverns'
      );

      if (contentKey && data[contentKey]) {
        for (const subcategory of Object.values(data[contentKey])) {
          if (Array.isArray(subcategory)) {
            totalCount += subcategory.length;
          }
        }
      }
      return totalCount;
    }

    return data.names?.length || data.settlements?.length || data.titles?.length || 0;
  }

  /**
   * Gets localized language list
   * @returns {Array} Array of language objects with code and name
   */
  getLocalizedLanguages() {
    const languages = [];

    if (this.languageConfig) {
      for (const [code, config] of Object.entries(this.languageConfig.supportedLanguages)) {
        if (config.enabled && this.availableLanguages.has(code)) {
          languages.push({
            code: code,
            name: game.i18n.localize(config.name) || config.nativeName || code.toUpperCase()
          });
        }
      }
    } else {
      for (const lang of this.availableLanguages) {
        const locKey = `names.languages.${lang}`;
        languages.push({
          code: lang,
          name: game.i18n.localize(locKey) || lang.toUpperCase()
        });
      }
    }

    return languages.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Gets localized species list filtered by user settings
   * @returns {Array} Array of species objects with code and name
   */
  getLocalizedSpecies() {
    const species = [];
    const enabledSpecies = this._getEnabledSpecies();

    // Collect all species from nameData keys (includes externally registered species)
    const allSpecies = new Set();
    for (const key of this.nameData.keys()) {
      const [language, speciesCode, category] = key.split('.');
      if (speciesCode) {
        allSpecies.add(speciesCode);
      }
    }

    // Also include species from availableSpecies for completeness
    for (const spec of this.availableSpecies) {
      allSpecies.add(spec);
    }

    console.log("DEBUG getLocalizedSpecies:");
    console.log("  nameData keys:", Array.from(this.nameData.keys()));
    console.log("  availableSpecies:", Array.from(this.availableSpecies));
    console.log("  allSpecies collected:", Array.from(allSpecies));
    console.log("  enabledSpecies:", enabledSpecies);

    for (const spec of allSpecies) {
      // Check if this species is enabled in settings
      if (!enabledSpecies.includes(spec)) {
        console.log(`  SKIPPING species '${spec}' - not in enabled list`);
        continue;
      }

      const locKey = `names.species.${spec}`;
      const localizedName = game.i18n.localize(locKey) || spec.charAt(0).toUpperCase() + spec.slice(1);
      console.log(`  ADDING species '${spec}' as '${localizedName}'`);
      species.push({
        code: spec,
        name: localizedName
      });
    }

    console.log("  FINAL species list:", species);
    return species.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Gets enabled species based on user settings
   * @returns {Array} Array of enabled species codes
   */
  _getEnabledSpecies() {
    try {
      // Collect all species from nameData keys (includes externally registered species)
      const allAvailableSpecies = new Set();
      for (const key of this.nameData.keys()) {
        const [language, speciesCode, category] = key.split('.');
        if (speciesCode) {
          allAvailableSpecies.add(speciesCode);
        }
      }

      // Also include species from availableSpecies for completeness
      for (const spec of this.availableSpecies) {
        allAvailableSpecies.add(spec);
      }

      const speciesSettings = game.settings.get("nomina-names", "availableSpecies");

      console.log("DEBUG _getEnabledSpecies:");
      console.log("  allAvailableSpecies:", Array.from(allAvailableSpecies));
      console.log("  speciesSettings:", speciesSettings);

      // If no settings yet, enable all species by default
      if (!speciesSettings || Object.keys(speciesSettings).length === 0) {
        console.log("  No settings found, enabling all species");
        return Array.from(allAvailableSpecies);
      }

      // For species not in settings (newly registered), enable them by default
      const enabledSpecies = [];
      for (const species of allAvailableSpecies) {
        if (speciesSettings.hasOwnProperty(species)) {
          // Use explicit setting
          if (speciesSettings[species]) {
            console.log(`  ENABLED: ${species} (explicit setting: true)`);
            enabledSpecies.push(species);
          } else {
            console.log(`  DISABLED: ${species} (explicit setting: false)`);
          }
        } else {
          // New species not in settings - enable by default
          console.log(`  ENABLED: ${species} (new species, default enabled)`);
          enabledSpecies.push(species);
        }
      }

      console.log("  FINAL enabledSpecies:", enabledSpecies);
      return enabledSpecies;

    } catch (error) {
      // Fallback to all species if settings access fails
      console.warn("Failed to get species settings, enabling all species:", error);

      // Collect all species as fallback
      const allAvailableSpecies = new Set();
      for (const key of this.nameData.keys()) {
        const [language, speciesCode, category] = key.split('.');
        if (speciesCode) {
          allAvailableSpecies.add(speciesCode);
        }
      }
      for (const spec of this.availableSpecies) {
        allAvailableSpecies.add(spec);
      }
      return Array.from(allAvailableSpecies);
    }
  }

  /**
   * Gets available categories for a specific generator type
   */
  async getAvailableCategoriesForGenerator(generatorType) {
    const { getCategoriesForGenerator } = await import('../shared/constants.js');
    const allCategories = getCategoriesForGenerator(generatorType);

    // Filter by actually available data
    const availableCategories = allCategories.filter(category => {
      if (category === 'names') {
        // Special case: 'names' category is available if we have gender-specific data files
        return Array.from(this.availableCategories).some(cat =>
          cat === 'male' || cat === 'female' || cat === 'nonbinary'
        );
      }
      return Array.from(this.availableCategories).includes(category);
    });

    return availableCategories;
  }

  /**
   * Gets available categories for a specific language, species, and generator type
   */
  async getAvailableCategoriesForLanguageAndSpecies(language, species, generatorType) {
    const { getCategoriesForGenerator } = await import('../shared/constants.js');
    const allCategories = getCategoriesForGenerator(generatorType);

    // Filter by actually available data for this specific language/species combination
    const availableCategories = allCategories.filter(category => {
      if (category === 'names') {
        // Special case: 'names' category is available if we have gender-specific data files
        return ['male', 'female', 'nonbinary'].some(gender =>
          this.hasDataFile(language, species, gender)
        );
      }
      return this.hasDataFile(language, species, category);
    });

    return availableCategories;
  }

  /**
   * Check if a data file exists for the given language, species, and category
   */
  hasDataFile(language, species, category) {
    const key = `${language}.${species}.${category}`;
    return this.nameData.has(key) && this.nameData.get(key).length > 0;
  }

  /**
   * Gets localized categories for a specific generator type
   */
  async getLocalizedCategoriesForGenerator(generatorType) {
    const { getLocalizedCategoryName, getCategoryGroups } = await import('../shared/constants.js');
    const availableCategories = await this.getAvailableCategoriesForGenerator(generatorType);
    const categoryGroups = getCategoryGroups();

    return this._buildLocalizedCategoryGroups(availableCategories, generatorType, categoryGroups, getLocalizedCategoryName);
  }

  /**
   * Gets localized categories for a specific language, species, and generator type
   */
  async getLocalizedCategoriesForLanguageAndSpecies(language, species, generatorType) {
    const { getLocalizedCategoryName, getCategoryGroups } = await import('../shared/constants.js');
    const availableCategories = await this.getAvailableCategoriesForLanguageAndSpecies(language, species, generatorType);
    const categoryGroups = getCategoryGroups();

    return this._buildLocalizedCategoryGroups(availableCategories, generatorType, categoryGroups, getLocalizedCategoryName);
  }

  /**
   * Helper method to build localized category groups
   */
  async _buildLocalizedCategoryGroups(availableCategories, generatorType, categoryGroups, getLocalizedCategoryName) {
    // If we have category groups from index.json, use them
    if (Object.keys(categoryGroups).length > 0) {
      const grouped = [];

      for (const [groupKey, groupData] of Object.entries(categoryGroups)) {
        const groupItems = [];

        if (groupData.categories) {
          for (const [categoryKey, categoryData] of Object.entries(groupData.categories)) {
            // Only include if available and supports this generator
            if (availableCategories.includes(categoryKey) &&
                (!categoryData.generators || categoryData.generators.includes(generatorType))) {

              groupItems.push({
                code: categoryKey,
                name: getLocalizedCategoryName(categoryKey)
              });
            }
          }
        }

        // Only add group if it has items
        if (groupItems.length > 0) {
          grouped.push({
            groupLabel: game.i18n.localize(groupData.localization) || groupKey,
            items: groupItems,
            length: groupItems.length
          });
        }
      }

      return grouped;
    } else {
      // Fallback to old grouping logic
      const { getCategoryType } = await import('../shared/constants.js');
      const tempGrouped = {
        traditional: [],
        simple: [],
        categorized: []
      };

      for (const category of availableCategories) {
        const categoryType = getCategoryType(category);
        const localizedName = getLocalizedCategoryName(category);

        tempGrouped[categoryType].push({
          code: category,
          name: localizedName
        });
      }

      // Convert to new format
      const grouped = [];
      if (tempGrouped.traditional.length > 0) {
        grouped.push({
          groupLabel: game.i18n.localize("names.category-groups.traditional") || "Traditional",
          items: tempGrouped.traditional,
          length: tempGrouped.traditional.length
        });
      }
      if (tempGrouped.simple.length > 0) {
        grouped.push({
          groupLabel: game.i18n.localize("names.category-groups.simple") || "Simple",
          items: tempGrouped.simple,
          length: tempGrouped.simple.length
        });
      }
      if (tempGrouped.categorized.length > 0) {
        grouped.push({
          groupLabel: game.i18n.localize("names.category-groups.categorized") || "Categorized",
          items: tempGrouped.categorized,
          length: tempGrouped.categorized.length
        });
      }

      return grouped;
    }
  }

  /**
   * Gets available subcategories for a categorized content type
   * @param {string} language - Language code
   * @param {string} species - Species code  
   * @param {string} category - Category code (books, ships, shops, taverns)
   * @returns {Array} Array of available subcategories
   */
  getAvailableSubcategories(language, species, category) {
    if (!isCategorizedContent(category)) {
      return [];
    }

    const key = `${language}.${species}.${category}`;
    const data = this.getData(key);

    if (!data) {
      return [];
    }

    const contentKey = Object.keys(data).find(key =>
      key === 'books' || key === 'ships' || key === 'shops' || key === 'taverns'
    );

    if (!contentKey || !data[contentKey]) {
      return [];
    }

    return Object.keys(data[contentKey]).filter(subcategory => {
      const subcategoryData = data[contentKey][subcategory];
      return Array.isArray(subcategoryData) && subcategoryData.length > 0;
    });
  }

  /**
   * Gets data from a specific subcategory of categorized content
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code (books, ships, shops, taverns)
   * @param {string} subcategory - Subcategory code
   * @returns {Array|null} Array of entries or null
   */
  getSubcategoryData(language, species, category, subcategory) {
    if (!isCategorizedContent(category)) {
      return null;
    }

    const key = `${language}.${species}.${category}`;
    const data = this.getData(key);

    if (!data) {
      return null;
    }

    const contentKey = Object.keys(data).find(key =>
      key === 'books' || key === 'ships' || key === 'shops' || key === 'taverns'
    );

    if (!contentKey || !data[contentKey] || !data[contentKey][subcategory]) {
      return null;
    }

    return data[contentKey][subcategory];
  }

  /**
   * Checks if data is available for a specific combination
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code
   * @returns {boolean} True if data exists
   */
  hasData(language, species, category) {
    const key = `${language}.${species}.${category}`;
    return this.nameData.has(key);
  }

  /**
   * Ensures data is loaded for a specific combination (lazy loading)
   * Attempts to load the data file if not already cached
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code
   * @returns {Promise<boolean>} True if data was loaded successfully
   */
  async ensureDataLoaded(language, species, category) {
    const key = `${language}.${species}.${category}`;

    if (this.nameData.has(key)) {
      return true;
    }

    // For API-loaded species, check if we have a 'names' category that can be used for all traditional categories
    const traditionalCategories = ['male', 'female', 'nonbinary', 'surnames', 'nicknames', 'titles', 'settlements'];
    if (traditionalCategories.includes(category)) {
      const namesKey = `${language}.${species}.names`;
      if (this.nameData.has(namesKey)) {
        // API-loaded species use combined 'names' data, not separate category files
        logDebug(`Using existing 'names' data for ${key} (API-loaded species)`);
        return true;
      }
    }

    // Try to load the specific file
    const filename = `${language}.${species}.${category}.json`;
    const fileInfo = { filename, language, species, category };

    logDebug(`Attempting to load specific file: ${filename}`);
    await this.loadDataFileFromIndex(fileInfo);
    return this.nameData.has(key);
  }

  /**
   * Gets data for a specific key
   * @param {string} key - Data key in format "language.species.category"
   * @returns {Object|null} Data object or null if not found
   */
  getData(key) {
    // First try to get the exact key
    const data = this.nameData.get(key);
    if (data) {
      return data;
    }

    // For API-loaded species, fall back to 'names' data for traditional categories
    const parts = key.split('.');
    if (parts.length === 3) {
      const [language, species, category] = parts;
      const traditionalCategories = ['male', 'female', 'nonbinary', 'surnames', 'nicknames', 'titles', 'settlements'];
      if (traditionalCategories.includes(category)) {
        const namesKey = `${language}.${species}.names`;
        return this.nameData.get(namesKey) || null;
      }
    }

    return null;
  }

  /**
   * Sets data for a specific key (used by API extensions)
   * @param {string} key - Data key in format "language.species.category"
   * @param {Object} data - Data object
   */
  setData(key, data) {
    this.nameData.set(key, data);

    // Update available sets
    const [language, species, category] = key.split('.');
    if (language) this.availableLanguages.add(language);
    if (species) this.availableSpecies.add(species);
    if (category) this.availableCategories.add(category);

    logDebug(`Data set for key: ${key}`);
  }

  /**
   * Merges data into existing data for a specific key (used by API extensions)
   * @param {string} key - Data key in format "language.species.category"
   * @param {Object} newData - Data object to merge
   */
  mergeData(key, newData) {
    const existing = this.nameData.get(key);
    if (!existing) {
      this.setData(key, newData);
      return;
    }

    const merged = this._mergeDataObjects(existing, newData);
    this.setData(key, merged);
    logDebug(`Data merged for key: ${key}`);
  }

  /**
   * Merges two data objects
   * @param {Object} existing - Existing data
   * @param {Object} newData - New data to merge
   * @returns {Object} Merged data object
   */
  _mergeDataObjects(existing, newData) {
    const merged = { ...existing };

    if (newData.names) {
      if (Array.isArray(newData.names)) {
        merged.names = [...(merged.names || []), ...newData.names];
      } else if (typeof newData.names === 'object') {
        merged.names = merged.names || {};
        for (const [gender, names] of Object.entries(newData.names)) {
          merged.names[gender] = [...(merged.names[gender] || []), ...names];
        }
      }
    }

    if (newData.settlements) {
      merged.settlements = [...(merged.settlements || []), ...newData.settlements];
    }

    if (newData.titles) {
      merged.titles = merged.titles || {};
      for (const [gender, titles] of Object.entries(newData.titles)) {
        merged.titles[gender] = [...(merged.titles[gender] || []), ...titles];
      }
    }

    // Merge categorized content (books, ships, shops, taverns)
    for (const contentType of ['books', 'ships', 'shops', 'taverns']) {
      if (newData[contentType]) {
        merged[contentType] = merged[contentType] || {};
        for (const [subcategory, items] of Object.entries(newData[contentType])) {
          merged[contentType][subcategory] = [
            ...(merged[contentType][subcategory] || []),
            ...items
          ];
        }
      }
    }

    // Merge authors
    if (newData.authors) {
      merged.authors = [...(merged.authors || []), ...newData.authors];
    }

    // Merge grammar
    if (newData.grammar) {
      merged.grammar = { ...(merged.grammar || {}), ...newData.grammar };
    }

    return merged;
  }

  /**
   * Gets grammar rules for a language-species combination
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @returns {Object|null} Grammar rules or null if not found
   */
  getGrammarRules(language, species) {
    const key = `${language}.${species}`;
    return this.grammarRules.get(key) || null;
  }

  /**
   * Sets grammar rules for a language-species combination
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {Object} rules - Grammar rules
   */
  setGrammarRules(language, species, rules) {
    const key = `${language}.${species}`;
    this.grammarRules.set(key, rules);
    logDebug(`Grammar rules set for: ${key}`);
  }

  /**
   * Fires the data loaded hook for API extensions
   */
  _fireDataLoadedHook() {
    try {
      Hooks.callAll('namesDataLoaded', this);
      logDebug("Data loaded hook fired for API extensions");
    } catch (error) {
      logWarn("Error firing data loaded hook", error);
    }
  }

  /**
   * Logs messages with localization support (updated to use new logger system)
   * @param {string} messageKey - Localization key
   * @param {Object} params - Parameters for formatting
   * @param {Error} error - Optional error object
   */
  _log(messageKey, params = null, error = null) {
    if (error) {
      logWarnL(messageKey, error, params);
    } else {
      // Determine appropriate log level based on message content
      if (messageKey.includes('loading') || messageKey.includes('loaded') || messageKey.includes('available')) {
        logDebugL(messageKey, null, params);
      } else if (messageKey.includes('error') || messageKey.includes('failed') || messageKey.includes('unavailable')) {
        logWarnL(messageKey, null, params);
      } else {
        logInfoL(messageKey, null, params);
      }
    }
  }
}

// Global instance
let globalNamesData = null;

/**
 * Ensures globalNamesData exists and returns it
 * @returns {NamesDataManager} Global data manager instance
 */
export function ensureGlobalNamesData() {
  if (!globalNamesData) {
    logDebug("Creating new NamesDataManager instance");
    globalNamesData = new NamesDataManager();
  }
  return globalNamesData;
}

/**
 * Gets the global names data instance
 * @returns {NamesDataManager|null} Global data manager instance
 */
export function getGlobalNamesData() {
  return globalNamesData;
}

/**
 * Sets the global names data instance
 * @param {NamesDataManager} instance - Data manager instance to set as global
 */
export function setGlobalNamesData(instance) {
  globalNamesData = instance;
  logDebug("Global NamesDataManager instance set");
}