/**
 * Names Data Manager - Handles loading and caching of name data
 */

import { NAME_CATEGORIES, DATA_PATHS, MODULE_ID } from '../shared/constants.js';

export class NamesDataManager {
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
    this.nameCategories = NAME_CATEGORIES;
  }

  /**
   * Starts loading data in the background
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
      this._log('console.index-loaded', { count: indexData.files.length });

      const loadPromises = indexData.files
        .filter(file => file.enabled !== false)
        .map(file => this.loadDataFileFromIndex(file));

      await Promise.all(loadPromises);

    } catch (error) {
      this._log('console.index-error', null, error);
      await this.loadFallbackData();
    }

    this._log('console.available-languages', null, Array.from(this.availableLanguages));
    this._log('console.available-species', null, Array.from(this.availableSpecies));
    this._log('console.available-categories', null, Array.from(this.availableCategories));
  }

  /**
   * Loads known fallback data files
   */
  async loadFallbackData() {
    const knownFiles = [
      { filename: 'de.human.male.json', language: 'de', species: 'human', category: 'male' },
      { filename: 'de.human.female.json', language: 'de', species: 'human', category: 'female' },
      { filename: 'de.human.surnames.json', language: 'de', species: 'human', category: 'surnames' },
      { filename: 'de.human.titles.json', language: 'de', species: 'human', category: 'titles' },
      { filename: 'de.human.nicknames.json', language: 'de', species: 'human', category: 'nicknames' },
      { filename: 'de.human.settlements.json', language: 'de', species: 'human', category: 'settlements' },
      { filename: 'de.elf.male.json', language: 'de', species: 'elf', category: 'male' }
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
    }

    const loadPromises = knownFiles.map(file => this.loadDataFileFromIndex(file));
    await Promise.all(loadPromises);
  }

  /**
   * Loads a specific data file
   * @param {Object} fileInfo - File information with filename, language, species, category
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
   * Gets localized species list
   * @returns {Array} Array of species objects with code and name
   */
  getLocalizedSpecies() {
    const species = [];
    
    for (const spec of this.availableSpecies) {
      const locKey = `names.species.${spec}`;
      species.push({
        code: spec,
        name: game.i18n.localize(locKey) || spec.charAt(0).toUpperCase() + spec.slice(1)
      });
    }

    return species.sort((a, b) => a.name.localeCompare(b.name));
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
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code
   * @returns {boolean} True if data was loaded successfully
   */
  async ensureDataLoaded(language, species, category) {
    const key = `${language}.${species}.${category}`;
    
    if (this.nameData.has(key)) {
      return true;
    }

    // Try to load the specific file
    const filename = `${language}.${species}.${category}.json`;
    const fileInfo = { filename, language, species, category };
    
    await this.loadDataFileFromIndex(fileInfo);
    return this.nameData.has(key);
  }

  /**
   * Gets data for a specific key
   * @param {string} key - Data key in format "language.species.category"
   * @returns {Object|null} Data object or null if not found
   */
  getData(key) {
    return this.nameData.get(key) || null;
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
  }

  /**
   * Fires the data loaded hook for API extensions
   */
  _fireDataLoadedHook() {
    try {
      Hooks.callAll('namesDataLoaded', this);
    } catch (error) {
      console.warn("Names Module: Error firing data loaded hook:", error);
    }
  }

  /**
   * Logs messages with localization support
   * @param {string} messageKey - Localization key
   * @param {Object} params - Parameters for formatting
   * @param {Error} error - Optional error object
   */
  _log(messageKey, params = null, error = null) {
    let message;
    
    try {
      message = params ? 
        game.i18n.format(`names.${messageKey}`, params) : 
        game.i18n.localize(`names.${messageKey}`);
    } catch (e) {
      message = messageKey;
    }

    const prefix = "Names Module: ";
    
    if (error) {
      console.warn(prefix + message, error);
    } else {
      console.log(prefix + message);
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
    console.log("Names Module: Creating new NamesDataManager instance");
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
}