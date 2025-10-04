/**
 * Names Data Manager - Unified management for all species data
 * Handles both core species (from consolidated JSON files) and API species (from external modules)
 */

import { isCategorizedContent, DATA_PATHS, MODULE_ID } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError, logInfoL, logWarnL, logErrorL, logDebugL } from '../utils/logger.js';

// Language code validation regex - compiled once for performance
const LANGUAGE_CODE_REGEX = /^[a-z]{2}$/;

/**
 * Validates if a string is a valid 2-letter language code
 * @param {string} code - Language code to validate
 * @returns {boolean} True if valid
 */
function isValidLanguageCode(code) {
  return code && code.length === 2 && LANGUAGE_CODE_REGEX.test(code);
}

/**
 * Names Data Manager - Unified management for all species data
 * Handles both core species (from consolidated JSON files) and API species (from external modules)
 */
export class NamesDataManager {
  /**
   * Creates a new Names Data Manager instance
   */
  constructor() {
    // Core data structures
    this.coreSpecies = new Map(); // speciesCode → SpeciesData
    this.apiSpecies = new Map(); // speciesCode → SpeciesData from external modules
    this.consolidatedData = new Map(); // "language.species.category" → data (for legacy compatibility)
    this.categoryDisplayNames = new Map(); // "language.species.category" → displayName object (3.1.0+ format)
    this.entryMetadata = new Map(); // "language.species.category" → entry_metadata object (3.1.1 format)

    // Available data tracking
    this.availableLanguages = new Set();
    this.availableSpecies = new Set();
    this.availableCategories = new Set();
    this.grammarRules = new Map();

    // Configuration
    this.languageConfig = null;
    this.speciesConfig = null;

    // Loading state
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
      this._setupEventSystem();
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
    await this.loadCoreSpeciesData();
    await this._setupEventSystem();
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
   * Loads core species data from consolidated JSON files
   */
  async loadCoreSpeciesData() {
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
        const { setCategoryDefinitionsFromGroups } = await import('../shared/constants.js');
        setCategoryDefinitionsFromGroups(indexData.categoryGroups);
        logDebug("Category groups loaded from index:", Object.keys(indexData.categoryGroups));
      } else if (indexData.categories) {
        const { setCategoryDefinitions } = await import('../shared/constants.js');
        setCategoryDefinitions(indexData.categories);
        logDebug("Category definitions loaded from index:", Object.keys(indexData.categories));
      }

      this._log('console.index-loaded', { count: indexData.files.length });

      // Load consolidated data files
      await this._loadConsolidatedFiles(indexData.files);

    } catch (error) {
      this._log('console.index-error', null, error);
      await this.loadFallbackData();
    }

    // Update legacy compatibility structures
    this._buildLegacyCompatibility();

    logDebug("Available languages:", Array.from(this.availableLanguages));
    logDebug("Available species:", Array.from(this.availableSpecies));
    logDebug("Available categories:", Array.from(this.availableCategories));
  }

  /**
   * Load consolidated data files
   */
  async _loadConsolidatedFiles(files) {
    const loadStart = performance.now();
    const enabledFiles = files.filter(file => file.enabled !== false);
    logDebug(`Performance: Loading ${enabledFiles.length} data files`);

    // Group files by species
    const speciesGroups = new Map();

    for (const file of enabledFiles) {
      const { language, species, category, filename } = file;
      if (!speciesGroups.has(species)) {
        speciesGroups.set(species, {
          code: species,
          displayName: species.charAt(0).toUpperCase() + species.slice(1),
          files: [],
          languages: new Set(),
          categories: new Set()
        });
      }

      const speciesGroup = speciesGroups.get(species);
      speciesGroup.files.push({ language, category, filename });
      speciesGroup.languages.add(language);
      speciesGroup.categories.add(category);
    }

    // Load each species data
    for (const speciesGroup of speciesGroups.values()) {
      await this._loadSpeciesData(speciesGroup);
    }

    const loadTime = performance.now() - loadStart;
    logInfo(`Loaded ${speciesGroups.size} core species in ${loadTime.toFixed(2)}ms`);
  }

  /**
   * Load species data from consolidated JSON files
   */
  async _loadSpeciesData(speciesGroup) {
    const speciesData = {
      code: speciesGroup.code,
      displayName: speciesGroup.displayName,
      languages: Array.from(speciesGroup.languages),
      categories: new Set(),
      dataFiles: new Map(), // "language.category" → data
      grammarRules: null
    };

    // Load each data file for this species
    for (const file of speciesGroup.files) {
      try {
        const response = await fetch(`${DATA_PATHS.base}${file.filename}`);
        if (!response.ok) {
          this._log('console.file-unavailable', {
            filename: file.filename,
            status: response.status
          });
          continue;
        }

        const data = await response.json();
        const key = `${file.language}.${file.category}`;

        // Handle both 3.0.0+ format and legacy formats
        if (this._isModernFormat(data)) {
          // New 3.0.0+ format
          speciesData.dataFiles.set(key, data);

          // Add main category
          speciesData.categories.add(file.category);
          this.availableCategories.add(file.category);

          // Extract and cache category displayNames for 3.1.0+ format
          if ((data.format === "3.1.0" || data.format === "3.1.1" || data.format === "3.1.2") && data.data && data.data[file.category] && data.data[file.category].displayName) {
            const displayNameCacheKey = `${file.language}.${speciesGroup.code}.${file.category}`;
            this.categoryDisplayNames.set(displayNameCacheKey, data.data[file.category].displayName);
          }

          // Extract and cache entry metadata for 3.1.1+ format
          if ((data.format === "3.1.1" || data.format === "3.1.2") && data.data && data.data[file.category] && data.data[file.category].entry_metadata) {
            const metadataCacheKey = `${file.language}.${speciesGroup.code}.${file.category}`;
            this._cacheEntryMetadata(metadataCacheKey, data.data[file.category].entry_metadata);
          }

          // Process data structure for subcategories
          if (data.data && data.data[file.category] && data.data[file.category].subcategories) {
            const subcategories = data.data[file.category].subcategories;
            for (const subcategory of subcategories) {
              if (subcategory.key) {
                speciesData.categories.add(subcategory.key);
                this.availableCategories.add(subcategory.key);
              }
            }
          }
        } else if (data.subcategories) {
          // Legacy consolidated format (e.g., names.json with subcategories)
          speciesData.dataFiles.set(key, data);

          // Add BOTH the main category AND subcategories to available categories
          speciesData.categories.add(file.category);
          this.availableCategories.add(file.category);

          // Add subcategories to available categories
          for (const subcat of Object.keys(data.subcategories)) {
            speciesData.categories.add(subcat);
            this.availableCategories.add(subcat);
          }
        } else {
          // Traditional format or simple category
          speciesData.dataFiles.set(key, data);
          speciesData.categories.add(file.category);
          this.availableCategories.add(file.category);
        }

        // Extract grammar rules if present
        if (data.grammar) {
          speciesData.grammarRules = data.grammar;
        }

        // Only add valid language codes (2-letter codes)
        if (isValidLanguageCode(file.language)) {
          this.availableLanguages.add(file.language);
        }

        const entryCount = this._getDataEntryCount(data, file.category);
        this._log('console.file-loaded', {
          filename: file.filename,
          count: entryCount
        });

      } catch (error) {
        this._log('console.file-failed', {
          filename: file.filename,
          error: error.message
        });
      }
    }

    // Store species data
    this.coreSpecies.set(speciesGroup.code, speciesData);
    this.availableSpecies.add(speciesGroup.code);

    logDebug(`Loaded core species: ${speciesGroup.code}`);
  }

  /**
   * Loads known fallback data files when index.json is not available
   * Uses hardcoded list of known consolidated data files as backup
   */
  async loadFallbackData() {
    const knownFiles = [
      // Consolidated name files
      { filename: 'de.human.names.json', language: 'de', species: 'human', category: 'names' },
      { filename: 'de.elf.names.json', language: 'de', species: 'elf', category: 'names' },
      { filename: 'de.dwarf.names.json', language: 'de', species: 'dwarf', category: 'names' },
      { filename: 'en.human.names.json', language: 'en', species: 'human', category: 'names' },
      { filename: 'en.elf.names.json', language: 'en', species: 'elf', category: 'names' },

      // Categorized content files
      { filename: 'de.human.books.json', language: 'de', species: 'human', category: 'books' },
      { filename: 'de.human.ships.json', language: 'de', species: 'human', category: 'ships' },
      { filename: 'de.human.shops.json', language: 'de', species: 'human', category: 'shops' },
      { filename: 'de.human.taverns.json', language: 'de', species: 'human', category: 'taverns' },

      // Simple category files
      { filename: 'de.human.settlements.json', language: 'de', species: 'human', category: 'settlements' },
      { filename: 'de.elf.settlements.json', language: 'de', species: 'elf', category: 'settlements' }
    ];

    // Group files by species for loading
    const speciesGroups = new Map();
    for (const file of knownFiles) {
      if (!speciesGroups.has(file.species)) {
        speciesGroups.set(file.species, {
          code: file.species,
          displayName: file.species.charAt(0).toUpperCase() + file.species.slice(1),
          files: [],
          languages: new Set(),
          categories: new Set()
        });
      }

      const group = speciesGroups.get(file.species);
      group.files.push(file);
      group.languages.add(file.language);
      group.categories.add(file.category);
    }

    // Load each species group
    for (const speciesGroup of speciesGroups.values()) {
      await this._loadSpeciesData(speciesGroup);
    }
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

      // Only add valid language codes (2-letter codes)
      if (isValidLanguageCode(fileInfo.language)) {
        this.availableLanguages.add(fileInfo.language);
      }
      this.availableSpecies.add(fileInfo.species);
      this.availableCategories.add(fileInfo.category);

      const key = `${fileInfo.language}.${fileInfo.species}.${fileInfo.category}`;
      this.consolidatedData.set(key, data);

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
   * Check if data uses modern 3.0+ format
   * @param {Object} data - Data object to check
   * @returns {boolean} True if 3.0+ format
   */
  _isModernFormat(data) {
    return data && (data.format === "3.0.0" || data.format === "3.0.1" || data.format === "3.1.0" || data.format === "3.1.1" || data.format === "3.1.2");
  }

  /**
   * Counts entries in a data file
   * @param {Object} data - Data object
   * @param {string} category - Data category
   * @returns {number} Entry count
   */
  _getDataEntryCount(data, category) {
    // Handle 3.0.0 and 3.0.1 formats
    if ((this._isModernFormat(data)) && data.data && data.data[category] && data.data[category].subcategories) {
      let totalCount = 0;
      for (const subcategory of data.data[category].subcategories) {
        if (subcategory.entries) {
          for (const languageEntries of Object.values(subcategory.entries)) {
            if (Array.isArray(languageEntries)) {
              totalCount += languageEntries.length;
            } else if (typeof languageEntries === 'object') {
              // Handle gender-specific entries
              for (const genderEntries of Object.values(languageEntries)) {
                if (Array.isArray(genderEntries)) {
                  totalCount += genderEntries.length;
                }
              }
            }
          }
        }
      }
      return totalCount;
    }

    // Handle legacy consolidated format with subcategories
    if (data.subcategories) {
      let totalCount = 0;
      for (const subcategory of Object.values(data.subcategories)) {
        if (subcategory.names) {
          totalCount += subcategory.names.length;
        }
        if (subcategory.items) {
          totalCount += subcategory.items.length;
        }
        if (subcategory.titles) {
          for (const genderTitles of Object.values(subcategory.titles)) {
            if (Array.isArray(genderTitles)) {
              totalCount += genderTitles.length;
            }
          }
        }
      }
      return totalCount;
    }

    // Handle traditional format
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

    // Handle simple arrays
    return data.names?.length || data.settlements?.length || data.titles?.length || data.items?.length || 0;
  }

  /**
   * Debug method to list all loaded species
   */
  debugListSpecies() {
    logDebug("DataManager Status:", {
      coreSpecies: Array.from(this.coreSpecies.keys()),
      coreSpeciesCount: this.coreSpecies.size,
      apiSpecies: Array.from(this.apiSpecies.keys()),
      apiSpeciesCount: this.apiSpecies.size,
      consolidatedDataSize: this.consolidatedData.size
    });
  }

  /**
   * Gets localized language list
   * @returns {Array} Array of language objects with code and name
   */
  getLocalizedLanguages() {
    const languages = [];

    // Fixed language display names (independent of interface language)
    const languageDisplayNames = {
      'de': 'Deutsch',
      'en': 'English',
      'fr': 'Français',
      'es': 'Español',
      'it': 'Italiano'
    };

    if (this.languageConfig) {
      for (const [code, config] of Object.entries(this.languageConfig.supportedLanguages)) {
        if (config.enabled && this.availableLanguages.has(code)) {
          languages.push({
            code: code,
            name: languageDisplayNames[code] || config.nativeName || code.toUpperCase()
          });
        }
      }
    } else {
      for (const lang of this.availableLanguages) {
        languages.push({
          code: lang,
          name: languageDisplayNames[lang] || lang.toUpperCase()
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

    logDebug(`getLocalizedSpecies: enabledSpecies = ${enabledSpecies.join(', ')}`);
    logDebug(`Available core species: ${Array.from(this.coreSpecies.keys()).join(', ')}`);
    logDebug(`Available API species: ${Array.from(this.apiSpecies.keys()).join(', ')}`);

    // Add core species
    for (const [code, speciesData] of this.coreSpecies) {
      if (enabledSpecies.includes(code)) {
        const localizedName = this._getLocalizedSpeciesName(code, speciesData.displayName);
        species.push({
          code: code,
          name: localizedName
        });
        logDebug(`Added core species: ${code} → "${localizedName}"`);
      }
    }

    // Add API species
    for (const [code, speciesData] of this.apiSpecies) {
      if (enabledSpecies.includes(code)) {
        const localizedName = this._getLocalizedSpeciesName(code, speciesData.displayName);
        species.push({
          code: code,
          name: localizedName
        });
        logDebug(`Added API species: ${code} → "${localizedName}" (displayName: ${typeof speciesData.displayName === 'object' ? JSON.stringify(speciesData.displayName) : `"${speciesData.displayName}"`})`);
      }
    }

    logDebug(`Final species list: ${species.map(s => `${s.code}="${s.name}"`).join(', ')}`);
    return species.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Setup event system for API extensions
   */
  async _setupEventSystem() {
    // Fire hook to allow external modules to register species
    try {
      Hooks.callAll('nomina-names:coreLoaded', this);
      logDebug("Event system initialized - external modules can now register species");
    } catch (error) {
      logWarn("Error setting up event system", error);
    }
  }

  /**
   * Build legacy compatibility structures for existing code
   */
  _buildLegacyCompatibility() {
    this.consolidatedData.clear();

    // Convert core species data to legacy format
    for (const [speciesCode, speciesData] of this.coreSpecies) {
      for (const [langCat, data] of speciesData.dataFiles) {
        const [language, category] = langCat.split('.');
        const legacyKey = `${language}.${speciesCode}.${category}`;
        this.consolidatedData.set(legacyKey, data);
      }

      // Add grammar rules
      if (speciesData.grammarRules) {
        for (const language of speciesData.languages) {
          const grammarKey = `${language}.${speciesCode}`;
          this.grammarRules.set(grammarKey, speciesData.grammarRules);
        }
      }
    }

    // Convert API species data to legacy format
    for (const [speciesCode, speciesData] of this.apiSpecies) {
      for (const [langCat, data] of speciesData.dataFiles) {
        const [language, category] = langCat.split('.');
        const legacyKey = `${language}.${speciesCode}.${category}`;
        this.consolidatedData.set(legacyKey, data);
      }

      // Add grammar rules
      if (speciesData.grammarRules) {
        for (const language of speciesData.languages) {
          const grammarKey = `${language}.${speciesCode}`;
          this.grammarRules.set(grammarKey, speciesData.grammarRules);
        }
      }
    }

    logDebug(`Built legacy compatibility for ${this.consolidatedData.size} data entries`);
  }

  /**
   * Gets enabled species based on user settings
   * @returns {Array} Array of enabled species codes
   */
  _getEnabledSpecies() {
    try {
      // Collect all available species
      const allAvailableSpecies = new Set();
      for (const code of this.coreSpecies.keys()) {
        allAvailableSpecies.add(code);
      }
      for (const code of this.apiSpecies.keys()) {
        allAvailableSpecies.add(code);
      }

      const speciesSettings = game.settings.get("nomina-names", "availableSpecies");

      // If no settings yet, enable all species by default
      if (!speciesSettings || Object.keys(speciesSettings).length === 0) {
        return Array.from(allAvailableSpecies);
      }

      // For species not in settings (newly registered), enable them by default
      const enabledSpecies = [];
      for (const species of allAvailableSpecies) {
        if (speciesSettings.hasOwnProperty(species)) {
          if (speciesSettings[species]) {
            enabledSpecies.push(species);
          }
        } else {
          // New species not in settings - enable by default
          enabledSpecies.push(species);
        }
      }

      return enabledSpecies;

    } catch (error) {
      // Fallback to all species if settings access fails
      logWarn("Failed to get species settings, enabling all species:", error);
      return Array.from(this.availableSpecies);
    }
  }

  /**
   * Get localized species name
   */
  _getLocalizedSpeciesName(code, displayName) {
    const locKey = `names.species.${code}`;
    const localized = game.i18n.localize(locKey);

    // If localization found, use it
    if (localized !== locKey) {
      return localized;
    }

    // Handle displayName as object (3.0.1 format) or string
    if (typeof displayName === 'object' && displayName !== null) {
      const currentLang = game.i18n.lang || 'en';
      return displayName[currentLang] || displayName.en || displayName.de || Object.values(displayName)[0] || code.charAt(0).toUpperCase() + code.slice(1);
    }

    // Handle displayName as string (legacy format)
    return displayName || code.charAt(0).toUpperCase() + code.slice(1);
  }

  /**
   * Gets available categories for a specific generator type
   */
  async getAvailableCategoriesForGenerator(generatorType) {
    const { getCategoriesForGenerator } = await import('../shared/constants.js');
    const allCategories = getCategoriesForGenerator(generatorType);

    // Names subcategories that should not be shown as separate categories
    const nameSubcategories = ['titles', 'nicknames', 'firstnames', 'surnames'];

    // Filter by actually available data
    const availableCategories = allCategories.filter(category => {
      if (category === 'names') {
        // Special case: 'names' category is available if we have gender-specific data files OR name subcategories
        return Array.from(this.availableCategories).some(cat =>
          cat === 'male' || cat === 'female' || cat === 'nonbinary' || nameSubcategories.includes(cat)
        );
      }
      // Don't show name subcategories as separate top-level categories
      if (nameSubcategories.includes(category)) {
        return false;
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

    // Names subcategories that should not be shown as separate categories
    const nameSubcategories = ['titles', 'nicknames', 'firstnames', 'surnames'];

    // Filter by actually available data for this specific language/species combination
    const availableCategories = allCategories.filter(category => {
      if (category === 'names') {
        // For names category, check if we have consolidated names data OR individual gender files OR name subcategories
        return this.hasDataFile(language, species, 'names') ||
               ['male', 'female', 'nonbinary'].some(gender =>
                 this.hasDataFile(language, species, gender)
               ) ||
               nameSubcategories.some(subcat =>
                 this.hasDataFile(language, species, subcat)
               );
      }
      // Don't show name subcategories as separate top-level categories
      if (nameSubcategories.includes(category)) {
        return false;
      }
      return this.hasDataFile(language, species, category);
    });

    return availableCategories;
  }

  /**
   * Check if a data file exists for the given language, species, and category
   */
  hasDataFile(language, species, category) {

    // Check core species
    const coreSpecies = this.coreSpecies.get(species);
    if (coreSpecies) {
      // Map singular forms from generator app to plural forms used in data files
      const categoryMap = {
        'title': 'titles',
        'nickname': 'nicknames',
        'firstname': 'firstnames',
        'surname': 'surnames'
      };

      // Convert category to the data file form (singular -> plural if needed)
      const dataCategory = categoryMap[category] || category;

      // For names subcategories (titles, nicknames, firstnames, surnames), check in the names file
      const nameSubcategories = ['titles', 'nicknames', 'firstnames', 'surnames'];
      if (nameSubcategories.includes(dataCategory)) {
        const namesKey = `${language}.names`;
        if (coreSpecies.dataFiles.has(namesKey)) {
          const data = coreSpecies.dataFiles.get(namesKey);
          if (this._isModernFormat(data) && data.data && data.data.names && data.data.names.subcategories) {
            const subcategory = data.data.names.subcategories.find(sub => sub.key === dataCategory);
            if (subcategory && subcategory.entries) {
              // Check if this subcategory has entries for any language
              for (const [lang, langEntries] of Object.entries(subcategory.entries)) {
                if (Array.isArray(langEntries) && langEntries.length > 0) {
                  // For simple arrays (like nicknames: ["name1", "name2"])
                  return true;
                }
                // Handle gender-specific entries (like firstnames: {male: [...], female: [...]})
                if (typeof langEntries === 'object' && langEntries !== null && !Array.isArray(langEntries)) {
                  for (const genderEntries of Object.values(langEntries)) {
                    if (Array.isArray(genderEntries) && genderEntries.length > 0) {
                      return true;
                    }
                    // Handle complex structures like titles: [{male: [...], female: [...]}]
                    if (typeof genderEntries === 'object' && genderEntries !== null && !Array.isArray(genderEntries)) {
                      for (const nestedEntries of Object.values(genderEntries)) {
                        if (Array.isArray(nestedEntries) && nestedEntries.length > 0) {
                          return true;
                        }
                      }
                    }
                  }
                }
                // Handle mixed array structures (like halfling titles: [{ male: [...], female: [...] }])
                if (Array.isArray(langEntries)) {
                  for (const entry of langEntries) {
                    if (typeof entry === 'object' && entry !== null) {
                      // Check if this is a gender-based object
                      for (const [genderKey, genderArray] of Object.entries(entry)) {
                        if (['male', 'female', 'nonbinary'].includes(genderKey) && Array.isArray(genderArray) && genderArray.length > 0) {
                          return true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          return false;
        }
      }

      // For other categories, check the direct file
      const key = `${language}.${category}`;
      if (coreSpecies.dataFiles.has(key)) {
        const data = coreSpecies.dataFiles.get(key);
        // Handle 3.0.0+ formats
        if (this._isModernFormat(data)) {
          if (data.data && data.data[category]) {
            return true;
          }
          return false;
        }
        // Handle consolidated format
        if (data.subcategories) {
          // If we're looking for the main category that matches the file, it exists
          const [, fileCategory] = key.split('.');
          if (category === fileCategory) {
            return true;
          }
          // If we're looking for a subcategory, check if it exists in the data
          if (data.subcategories[category]) {
            return true;
          }
        }
        // Handle traditional format
        return data && (data.names?.length > 0 || data[category]?.length > 0);
      }
    }

    // Check API species
    const apiSpecies = this.apiSpecies.get(species);
    if (apiSpecies) {
      const key = `${language}.${category}`;
      if (apiSpecies.dataFiles.has(key)) {
        const data = apiSpecies.dataFiles.get(key);
        // Handle transformed 3.0.1 format with subcategories
        if (data && data.subcategories) {
          return Object.keys(data.subcategories).length > 0;
        }
        // Handle legacy format
        return data && (data.names?.length > 0 || data[category]?.length > 0);
      }
    }

    // Fallback to legacy check
    const legacyKey = `${language}.${species}.${category}`;
    return this.consolidatedData.has(legacyKey);
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

    // Create enhanced wrapper that supports 3.1.0 displayNames
    const enhancedGetLocalizedCategoryName = (category) => {
      const context = {
        language: game.i18n.lang, // Use interface language for category names, not content language
        species,
        getCategoryDisplayName: this.getCategoryDisplayName.bind(this)
      };
      return getLocalizedCategoryName(category, context);
    };

    return this._buildLocalizedCategoryGroups(availableCategories, generatorType, categoryGroups, enhancedGetLocalizedCategoryName);
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
        categorized: [],
        consolidated: [],
        dynamic: []
      };

      for (const category of availableCategories) {
        const categoryType = getCategoryType(category);
        const localizedName = getLocalizedCategoryName(category);

        // Ensure the categoryType exists in tempGrouped, fallback to 'simple' if not
        if (!tempGrouped[categoryType]) {
          logWarn(`Unknown category type '${categoryType}' for category '${category}', using 'simple' instead`);
          tempGrouped.simple.push({
            code: category,
            name: localizedName
          });
        } else {
          tempGrouped[categoryType].push({
            code: category,
            name: localizedName
          });
        }
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
      if (tempGrouped.consolidated.length > 0) {
        grouped.push({
          groupLabel: game.i18n.localize("names.category-groups.consolidated") || "Names",
          items: tempGrouped.consolidated,
          length: tempGrouped.consolidated.length
        });
      }
      if (tempGrouped.dynamic.length > 0) {
        grouped.push({
          groupLabel: game.i18n.localize("names.category-groups.dynamic") || "Dynamic Content",
          items: tempGrouped.dynamic,
          length: tempGrouped.dynamic.length
        });
      }

      return grouped;
    }
  }

  /**
   * Gets available subcategories for a categorized content type
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code (books, ships, shops, taverns, names)
   * @returns {Array} Array of available subcategories
   */
  getAvailableSubcategories(language, species, category) {
    logDebug(`getAvailableSubcategories called with ${language}.${species}.${category}`);

    // Check API species first
    if (this.apiSpecies && this.apiSpecies.has(species)) {
      const apiSpecies = this.apiSpecies.get(species);
      const langCatKey = `${language}.${category}`;

      logDebug(`Found API species ${species}, looking for ${langCatKey}`, {
        availableKeys: Array.from(apiSpecies.dataFiles?.keys() || [])
      });

      if (apiSpecies.dataFiles && apiSpecies.dataFiles.has(langCatKey)) {
        const categoryData = apiSpecies.dataFiles.get(langCatKey);

        if (categoryData && categoryData.subcategories) {
          // Handle 3.0.1 format with array structure
          if (Array.isArray(categoryData.subcategories)) {
            const result = categoryData.subcategories.map(subcat => ({
              key: subcat.key,
              displayName: subcat.displayName
            }));
            logDebug(`Returning API species subcategories (array format):`, result);
            return result;
          }
          // Handle legacy format with object structure
          else if (typeof categoryData.subcategories === 'object') {
            const result = Object.keys(categoryData.subcategories).map(key => ({
              key: key,
              displayName: {
                en: key.charAt(0).toUpperCase() + key.slice(1),
                de: key.charAt(0).toUpperCase() + key.slice(1)
              }
            }));
            logDebug(`Returning API species subcategories (object format):`, result);
            return result;
          }
        }
        logDebug(`categoryData structure invalid or no subcategories`);
      } else {
        logDebug(`No dataFiles entry for ${langCatKey}`, {
          availableKeys: Array.from(apiSpecies.dataFiles?.keys() || [])
        });
      }
    } else {
      logDebug(`No API species found for ${species}`, {
        availableApiSpecies: Array.from(this.apiSpecies?.keys() || [])
      });
    }

    const data = this.getData(`${language}.${species}.${category}`);
    if (!data) {
      return [];
    }

    // Handle 3.0.0 and 3.0.1 formats
    if ((this._isModernFormat(data)) && data.data && data.data[category] && data.data[category].subcategories) {
      return data.data[category].subcategories.map(subcat => ({
        key: subcat.key,
        displayName: subcat.displayName
      }));
    }

    // Handle legacy consolidated format with subcategories
    if (data.subcategories) {
      return Object.keys(data.subcategories).filter(subcat => {
        const subcatData = data.subcategories[subcat];
        return (subcatData.names && subcatData.names.length > 0) ||
               (subcatData.items && subcatData.items.length > 0) ||
               (subcatData.titles && Object.keys(subcatData.titles).length > 0);
      });
    }

    // Handle traditional categorized content format
    if (isCategorizedContent(category)) {
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

    return [];
  }

  /**
   * Gets data from a specific subcategory of categorized content
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code (books, ships, shops, taverns, names)
   * @param {string} subcategory - Subcategory code
   * @returns {Array|Object|null} Array of entries, object with titles/templates/components, or null
   */
  getSubcategoryData(language, species, category, subcategory, options = {}) {
    // Check API species first
    if (this.apiSpecies && this.apiSpecies.has(species)) {
      const apiSpecies = this.apiSpecies.get(species);
      const langCatKey = `${language}.${category}`;

      if (apiSpecies.dataFiles && apiSpecies.dataFiles.has(langCatKey)) {
        const categoryData = apiSpecies.dataFiles.get(langCatKey);
        if (categoryData && categoryData.subcategories) {
          // Handle 3.0.1+ format with array structure
          if (Array.isArray(categoryData.subcategories)) {
            const subcategoryData = categoryData.subcategories.find(sub => sub.key === subcategory);
            if (subcategoryData) {
              // 3.2.0: Check for templates (return full subcategory object)
              if (subcategoryData.templates && subcategoryData.components) {
                return subcategoryData;
              }

              // Otherwise return entries only
              if (subcategoryData.entries) {
                let entries = subcategoryData.entries[language] || null;

                // Apply metadata filters if provided
                if (entries && options.filters) {
                  entries = this._filterEntriesByMetadata(entries, options.filters);
                }

                return entries;
              }
            }
          }
          // Handle legacy format with object structure
          else if (typeof categoryData.subcategories === 'object') {
            if (categoryData.subcategories[subcategory] && Array.isArray(categoryData.subcategories[subcategory])) {
              let entries = categoryData.subcategories[subcategory];

              // Apply metadata filters if provided
              if (entries && options.filters) {
                entries = this._filterEntriesByMetadata(entries, options.filters);
              }

              return entries;
            }
          }
        }
      }
    }

    const data = this.getData(`${language}.${species}.${category}`);
    if (!data) {
      return null;
    }

    // Handle 3.0.0+ formats
    if ((this._isModernFormat(data)) && data.data && data.data[category] && data.data[category].subcategories) {
      const subcategoryData = data.data[category].subcategories.find(sub => sub.key === subcategory);
      if (subcategoryData) {
        // 3.2.0: Check for templates (return full subcategory object)
        if (subcategoryData.templates && subcategoryData.components) {
          return subcategoryData;
        }

        // Otherwise return entries only
        if (subcategoryData.entries) {
          let entries = subcategoryData.entries[language] || null;

          // Apply metadata filters if provided
          if (entries && options.filters) {
            entries = this._filterEntriesByMetadata(entries, options.filters);
          }

          return entries;
        }
      }
    }

    // Handle legacy consolidated format with subcategories
    if (data.subcategories && data.subcategories[subcategory]) {
      const subcatData = data.subcategories[subcategory];
      // Return the appropriate data type (names, items, or titles)
      return subcatData.names || subcatData.items || subcatData.titles || null;
    }

    // Handle traditional categorized content format
    if (isCategorizedContent(category)) {
      const contentKey = Object.keys(data).find(key =>
        key === 'books' || key === 'ships' || key === 'shops' || key === 'taverns'
      );

      if (!contentKey || !data[contentKey] || !data[contentKey][subcategory]) {
        return null;
      }

      return data[contentKey][subcategory];
    }

    return null;
  }

  /**
   * Checks if data is available for a specific combination
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code
   * @returns {boolean} True if data exists
   */
  hasData(language, species, category) {
    return this.getData(`${language}.${species}.${category}`) !== null;
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
    // Check API species first
    if (this.apiSpecies && this.apiSpecies.has(species)) {
      const apiSpecies = this.apiSpecies.get(species);

      // Check if this language/category combination exists in API species data
      const langCatKey = `${language}.${category}`;
      if (apiSpecies.dataFiles && apiSpecies.dataFiles.has(langCatKey)) {
        logDebug(`API species ${species} has data for ${langCatKey}`);
        return true;
      }

      // For API species, also check if the language is supported
      if (apiSpecies.languages && apiSpecies.languages.includes(language) &&
          apiSpecies.categories && apiSpecies.categories.has(category)) {
        logDebug(`API species ${species} supports ${language}.${category}`);
        return true;
      }
    }

    // Check if data already exists
    const data = this.getData(`${language}.${species}.${category}`);
    if (data) {
      return true;
    }

    // For gender categories, check if 3.0.0 'names' file exists with firstnames subcategory
    const genderCategories = ['male', 'female', 'nonbinary'];
    if (genderCategories.includes(category)) {
      const namesData = this.getData(`${language}.${species}.names`);
      if (namesData && (namesData.format === "3.0.0" || namesData.format === "3.0.1" || namesData.format === "3.1.0" || namesData.format === "3.1.1" || namesData.format === "3.1.2")) {
        logDebug(`Using ${namesData.format} 'names' data for gender category ${language}.${species}.${category}`);
        return true;
      }
      // Legacy: check consolidated format
      if (namesData && namesData.subcategories && namesData.subcategories[category]) {
        logDebug(`Using existing consolidated 'names' data for ${language}.${species}.${category}`);
        return true;
      }
    }

    // For traditional subcategories (surnames, nicknames, titles), check 3.0.0 names file
    const nameSubcategories = ['surnames', 'nicknames', 'titles'];
    if (nameSubcategories.includes(category)) {
      const namesData = this.getData(`${language}.${species}.names`);
      if (namesData && (namesData.format === "3.0.0" || namesData.format === "3.0.1" || namesData.format === "3.1.0" || namesData.format === "3.1.1" || namesData.format === "3.1.2")) {
        // Check if this subcategory exists in the 3.0+ structure
        if (namesData.data && namesData.data.names && namesData.data.names.subcategories) {
          const subcategoryExists = namesData.data.names.subcategories.some(sub => sub.key === category);
          if (subcategoryExists) {
            logDebug(`Using ${namesData.format} 'names' data for subcategory ${language}.${species}.${category}`);
            return true;
          }
        }
      }
      // Legacy: check consolidated format
      if (namesData && namesData.subcategories && namesData.subcategories[category]) {
        logDebug(`Using existing consolidated 'names' data for ${language}.${species}.${category}`);
        return true;
      }
    }

    // Try to load the specific file
    const filename = `${language}.${species}.${category}.json`;
    const fileInfo = { filename, language, species, category };

    logDebug(`Attempting to load specific file: ${filename}`);
    await this.loadDataFileFromIndex(fileInfo);
    return this.getData(`${language}.${species}.${category}`) !== null;
  }

  /**
   * Gets data for a specific key
   * @param {string} key - Data key in format "language.species.category"
   * @returns {Object|null} Data object or null if not found
   */
  getData(key) {
    const parts = key.split('.');
    if (parts.length !== 3) return null;

    const [language, species, category] = parts;

    // Try core species first
    const coreSpecies = this.coreSpecies.get(species);
    if (coreSpecies) {
      const dataKey = `${language}.${category}`;
      const data = coreSpecies.dataFiles.get(dataKey);
      if (data) {
        // Handle 3.0.0 format
        if (this._isModernFormat(data)) {
          return data; // Return the full 3.0+ structure
        }
        // Handle legacy consolidated format with subcategories
        if (data.subcategories && data.subcategories[category]) {
          return data.subcategories[category];
        }
        return data;
      }

      // Try to find data in a consolidated 'names' file (legacy)
      const namesKey = `${language}.names`;
      const namesData = coreSpecies.dataFiles.get(namesKey);
      if (namesData) {
        if (namesData.format === "3.0.0" || namesData.format === "3.0.1" || namesData.format === "3.1.0" || namesData.format === "3.1.1" || namesData.format === "3.1.2") {
          // For 3.0+ format, check if this category is a subcategory
          if (namesData.data && namesData.data.names && namesData.data.names.subcategories) {
            const subcategoryData = namesData.data.names.subcategories.find(sub => sub.key === category);
            if (subcategoryData) {
              return subcategoryData;
            }
          }
        } else if (namesData.subcategories && namesData.subcategories[category]) {
          return namesData.subcategories[category];
        }
      }
    }

    // Try API species
    const apiSpecies = this.apiSpecies.get(species);
    if (apiSpecies) {
      const dataKey = `${language}.${category}`;
      const data = apiSpecies.dataFiles.get(dataKey);
      if (data) return data;

      // Try consolidated names for API species
      const namesKey = `${language}.names`;
      const namesData = apiSpecies.dataFiles.get(namesKey);
      if (namesData && namesData.subcategories && namesData.subcategories[category]) {
        return namesData.subcategories[category];
      }
    }

    // Fallback to legacy consolidated data
    return this.consolidatedData.get(key) || null;
  }

  /**
   * Transform 3.0.1 format data to API registration format
   * @param {Object} fileData - 3.0.1 format data from JSON file
   * @returns {Object} Transformed data for API registration
   */
  _transform301FormatForApi(speciesConfig) {
    if (!speciesConfig || speciesConfig.format !== "3.0.1") {
      logDebug(`Transformation skipped - format: ${speciesConfig?.format || 'undefined'}`);
      return speciesConfig; // Return as-is if not 3.0.1 format
    }

    logDebug(`Starting 3.0.1 transformation for species: ${speciesConfig.code}`);
    logDebug(`Available data keys:`, Object.keys(speciesConfig.data || {}));

    const transformedData = {};

    // Transform each language-category combination
    for (const language of speciesConfig.languages) {
      logDebug(`Processing language: ${language}`);
      for (const category of speciesConfig.categories) {
        logDebug(`Processing category: ${category}`);
        if (speciesConfig.data && speciesConfig.data[category] && speciesConfig.data[category].subcategories) {
          const key = `${language}.${category}`;
          const subcategories = {};

          logDebug(`Found category data for ${category}, subcategories: ${speciesConfig.data[category].subcategories.length}`);

          // Transform 3.0.1 subcategories to API format
          for (const subcat of speciesConfig.data[category].subcategories) {
            logDebug(`Processing subcategory: ${subcat.key}`, subcat.entries ? Object.keys(subcat.entries) : 'no entries');
            if (subcat.entries && subcat.entries[language]) {
              const subcatKey = subcat.key;
              const entries = subcat.entries[language];

              logDebug(`Found entries for ${language}.${subcatKey}:`, typeof entries, Array.isArray(entries) ? entries.length : Object.keys(entries));

              if (typeof entries === 'object' && !Array.isArray(entries)) {
                // Gender-specific entries (male/female structure)
                // For firstnames: { "male": [...], "female": [...] }
                for (const [genderOrType, nameList] of Object.entries(entries)) {
                  if (Array.isArray(nameList)) {
                    subcategories[genderOrType] = nameList;
                    logDebug(`Added gender/type ${genderOrType}: ${nameList.length} entries`);
                  }
                }
              } else if (Array.isArray(entries)) {
                // Simple array entries (surnames, etc.)
                subcategories[subcatKey] = entries;
                logDebug(`Added subcategory ${subcatKey}: ${entries.length} entries`);
              }
            } else {
              logDebug(`No entries found for ${language}.${subcat.key}`);
            }
          }

          // Create API-compatible structure
          if (Object.keys(subcategories).length > 0) {
            transformedData[key] = {
              subcategories: subcategories
            };
            logDebug(`Created transformed data for ${key} with ${Object.keys(subcategories).length} subcategories`);
          } else {
            logDebug(`No subcategories created for ${key}`);
          }
        } else {
          logDebug(`No data found for category ${category}`);
        }
      }
    }

    logDebug(`Transformed 3.0.1 data for ${speciesConfig.code}:`, {
      originalCategories: Object.keys(speciesConfig.data || {}),
      transformedKeys: Object.keys(transformedData),
      transformedDataSize: Object.keys(transformedData).length,
      sampleKey: Object.keys(transformedData)[0],
      sampleData: Object.keys(transformedData)[0] ? transformedData[Object.keys(transformedData)[0]] : null,
      inputLanguages: speciesConfig.languages,
      inputCategories: speciesConfig.categories
    });

    return transformedData;
  }

  /**
   * Register a new API species (used by external modules)
   * ONLY supports 3.0.1 format - external modules must use this format
   * @param {Object} speciesConfig - 3.0.1 format species configuration
   */
  registerApiSpecies(speciesConfig, callingModule = null) {
    // Validate format
    if (!speciesConfig.format || speciesConfig.format !== "3.0.1") {
      throw new Error(`Invalid species format. External modules must use format "3.0.1". Received: ${speciesConfig.format || 'undefined'}`);
    }

    if (!speciesConfig.data) {
      throw new Error(`Species data is required for registration`);
    }

    logDebug(`Registering 3.0.1 format species: ${speciesConfig.code}`);
    logDebug(`Species config structure:`, {
      format: speciesConfig.format,
      code: speciesConfig.code,
      languages: speciesConfig.languages,
      categories: speciesConfig.categories,
      dataKeys: Object.keys(speciesConfig.data || {}),
      sampleCategoryData: speciesConfig.data ? speciesConfig.data[Object.keys(speciesConfig.data)[0]] : null
    });

    // Transform 3.0.1 format to internal API format
    const transformedData = this._transform301FormatForApi(speciesConfig);

    logDebug(`Transformation result:`, {
      transformedDataKeys: Object.keys(transformedData || {}),
      sampleTransformedData: transformedData ? transformedData[Object.keys(transformedData)[0]] : null
    });

    // Convert displayName from object to string for current language
    let displayName = speciesConfig.displayName;
    if (typeof displayName === 'object' && displayName !== null) {
      const currentLang = game.i18n.lang || 'en';
      displayName = displayName[currentLang] || displayName.en || displayName.de || Object.values(displayName)[0] || speciesConfig.code;
    }

    const finalConfig = {
      code: speciesConfig.code,
      displayName: displayName,
      languages: speciesConfig.languages,
      categories: speciesConfig.categories,
      data: transformedData,
      grammarRules: speciesConfig.grammarRules || null
    };

    logDebug(`3.0.1 species registration:`, {
      code: speciesConfig.code,
      convertedDisplayName: displayName,
      languages: speciesConfig.languages,
      categories: speciesConfig.categories,
      dataKeys: Object.keys(transformedData)
    });

    const {
      code,
      displayName: finalDisplayName,
      languages = [],
      categories = [],
      data = {},
      grammarRules = null
    } = finalConfig;

    if (!code) {
      throw new Error("Species code is required");
    }

    logDebug(`Registering API species: ${code}`, {
      displayName: typeof finalDisplayName === 'object' ? finalDisplayName : `"${finalDisplayName}"`,
      languages,
      categories,
      dataKeys: Object.keys(data)
    });

    const speciesData = {
      code,
      displayName: finalDisplayName || code.charAt(0).toUpperCase() + code.slice(1), // Keep original format for processing
      languages: Array.isArray(languages) ? languages : [languages],
      categories: new Set(Array.isArray(categories) ? categories : [categories]),
      dataFiles: new Map(),
      grammarRules,
      callingModule
    };

    // Process data entries
    for (const [langCat, entryData] of Object.entries(data)) {
      speciesData.dataFiles.set(langCat, entryData);
      const [language, category] = langCat.split('.');
      // Only add valid language codes (2-letter codes)
      if (isValidLanguageCode(language)) {
        this.availableLanguages.add(language);
      }
      if (category) {
        speciesData.categories.add(category);
        this.availableCategories.add(category);
      }
    }

    this.apiSpecies.set(code, speciesData);
    this.availableSpecies.add(code);

    // Rebuild legacy compatibility
    this._buildLegacyCompatibility();

    logInfo(`Registered API species: ${code}`);
  }

  /**
   * Sets data for a specific key (legacy compatibility)
   * @param {string} key - Data key in format "language.species.category"
   * @param {Object} data - Data object
   */
  setData(key, data) {
    this.consolidatedData.set(key, data);

    // Update available sets
    const [language, species, category] = key.split('.');
    // Only add valid language codes (2-letter codes)
    if (isValidLanguageCode(language)) {
      this.availableLanguages.add(language);
    }
    if (species) this.availableSpecies.add(species);
    if (category) this.availableCategories.add(category);

    logDebug(`Legacy data set for key: ${key}`);
  }

  /**
   * Get localized subcategory name
   * @param {string} category - Main category
   * @param {string} subcategory - Subcategory code
   * @param {Object} subcatData - Subcategory data with i18n
   * @returns {string} Localized name
   */
  _getLocalizedSubcategoryName(category, subcategory, subcatData = null) {
    // Try to get localized name from subcategory data
    if (subcatData && subcatData.i18n) {
      const currentLang = game.i18n.lang || 'en';
      const localizedName = subcatData.i18n[currentLang] || subcatData.i18n.en;
      if (localizedName) {
        return localizedName;
      }
    }

    // Fallback to localization key
    const locKey = `names.subcategories.${subcategory}`;
    const localized = game.i18n.localize(locKey);
    if (localized !== locKey) {
      return localized;
    }

    // Final fallback to formatted subcategory name
    return subcategory.charAt(0).toUpperCase() + subcategory.slice(1).replace(/_/g, ' ');
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
   * API method for external modules to register species
   * This is called by the event system when modules respond to 'nomina-names:coreLoaded'
   */
  addApiSpecies(speciesConfig) {
    this.registerApiSpecies(speciesConfig);
  }

  /**
   * Convenience method for registering species from 3.0.1 JSON files
   * @param {Object|Array} jsonData - 3.0.1 format JSON data (single species object or array of species)
   */
  registerSpeciesFromJSON(jsonData) {
    if (Array.isArray(jsonData)) {
      // Handle array of species (multiple 3.0.1 files)
      for (const speciesData of jsonData) {
        this.registerApiSpecies(speciesData);
        logInfo(`Registered species from JSON array: ${speciesData.code}`);
      }
    } else {
      // Handle single species (single 3.0.1 file)
      this.registerApiSpecies(jsonData);
      logInfo(`Registered species from JSON: ${jsonData.code}`);
    }
  }

  /**
   * Get all species data for debugging
   */
  getSpeciesInfo(speciesCode) {
    const coreSpecies = this.coreSpecies.get(speciesCode);
    if (coreSpecies) {
      return {
        ...coreSpecies,
        source: 'core',
        dataCount: coreSpecies.dataFiles.size
      };
    }

    const apiSpecies = this.apiSpecies.get(speciesCode);
    if (apiSpecies) {
      return {
        ...apiSpecies,
        source: 'api',
        dataCount: apiSpecies.dataFiles.size
      };
    }

    return null;
  }

  /**
   * Legacy compatibility - maps to consolidatedData
   */
  get nameData() {
    return this.consolidatedData;
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
    logDebug("Creating new unified NamesDataManager instance");
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
  logDebug("Global unified NamesDataManager instance set");
}

// Add metadata filtering methods to NamesDataManager prototype
NamesDataManager.prototype._filterEntriesByMetadata = function(entries, filters) {
  if (!Array.isArray(entries) || !filters || Object.keys(filters).length === 0) {
    return entries;
  }

  return entries.filter(entry => {
    // Simple string entries always pass if no metadata required
    if (typeof entry === 'string') {
      return true;
    }

    // Object entries with metadata
    if (typeof entry === 'object' && entry.meta) {
      return this._matchesMetadataFilters(entry.meta, filters);
    }

    // Object entries without metadata pass by default
    return true;
  });
};

NamesDataManager.prototype._matchesMetadataFilters = function(meta, filters) {
  for (const [filterKey, filterValue] of Object.entries(filters)) {
    const metaValue = meta[filterKey];

    // If metadata doesn't have this property, skip this filter
    if (metaValue === undefined) {
      continue;
    }

    // Handle array filter values (OR logic)
    if (Array.isArray(filterValue)) {
      if (!filterValue.includes(metaValue)) {
        return false;
      }
    }
    // Handle single value filter
    else if (metaValue !== filterValue) {
      return false;
    }
  }
  return true;
};

NamesDataManager.prototype.extractEntryName = function(entry) {
  if (typeof entry === 'string') {
    return entry;
  }
  if (typeof entry === 'object' && entry.name) {
    return entry.name;
  }
  return entry.toString();
};

NamesDataManager.prototype.extractEntryMetadata = function(entry) {
  if (typeof entry === 'object' && entry.meta) {
    return entry.meta;
  }
  return null;
};

/**
 * Extracts and localizes metadata values for display (3.1.2 format)
 * @param {Object} entry - Entry object with metadata
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @returns {Object|null} Localized metadata object or null
 */
NamesDataManager.prototype.extractLocalizedMetadata = function(entry, language, species, category) {
  if (typeof entry !== 'object' || !entry.meta) {
    return null;
  }

  const rawMeta = entry.meta;
  const localizedMeta = {};

  // Localize each metadata field
  for (const [fieldName, fieldValue] of Object.entries(rawMeta)) {
    // First, try individual entry translation (3.1.2)
    const localizedValue = this.getLocalizedEntryValue(fieldValue);

    // Then, try predefined value mapping (3.1.1)
    if (typeof localizedValue === 'string') {
      localizedMeta[fieldName] = this.getLocalizedValue(language, species, category, fieldName, localizedValue);
    } else {
      localizedMeta[fieldName] = localizedValue;
    }
  }

  return localizedMeta;
};

/**
 * Gets cached category displayName from 3.1.0 format files
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @returns {Object|null} DisplayName object with language keys, or null if not found
 */
NamesDataManager.prototype.getCategoryDisplayName = function(language, species, category) {
  const cacheKey = `${language}.${species}.${category}`;
  return this.categoryDisplayNames.get(cacheKey) || null;
};

/**
 * Cache entry metadata from 3.1.1 format files
 * @param {string} cacheKey - Cache key in format "language.species.category"
 * @param {Object} metadata - Entry metadata object
 */
NamesDataManager.prototype._cacheEntryMetadata = function(cacheKey, metadata) {
  this.entryMetadata.set(cacheKey, metadata);
  logDebug(`Cached entry metadata for ${cacheKey}`, Object.keys(metadata));
};

/**
 * Gets cached entry metadata from 3.1.1 format files
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @returns {Object|null} Entry metadata object, or null if not found
 */
NamesDataManager.prototype.getEntryMetadata = function(language, species, category) {
  const cacheKey = `${language}.${species}.${category}`;
  return this.entryMetadata.get(cacheKey) || null;
};

/**
 * Gets localized field label from entry metadata (3.1.1 format)
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @param {string} fieldName - Field name
 * @returns {string|null} Localized field label, or null if not found
 */
NamesDataManager.prototype.getFieldLabel = function(language, species, category, fieldName) {
  const metadata = this.getEntryMetadata(language, species, category);
  if (!metadata || !metadata[fieldName]) {
    return null;
  }

  const fieldDef = metadata[fieldName];
  const currentLang = game.i18n.lang || 'en';

  // Return localized label for current language, with fallbacks
  return fieldDef[currentLang] || fieldDef.en || fieldDef.de || Object.values(fieldDef).find(val => typeof val === 'string') || null;
};

/**
 * Gets field icon from entry metadata (3.1.1 format)
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @param {string} fieldName - Field name
 * @returns {string|null} Unicode icon, or null if not found
 */
NamesDataManager.prototype.getFieldIcon = function(language, species, category, fieldName) {
  const metadata = this.getEntryMetadata(language, species, category);
  if (!metadata || !metadata[fieldName] || !metadata[fieldName].icon) {
    return null;
  }

  const icon = metadata[fieldName].icon;
  if (icon.type === 'unicode' && icon.value) {
    return icon.value;
  }

  return null;
};

/**
 * Gets localized value mapping from entry metadata (3.1.1 format)
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @param {string} fieldName - Field name
 * @param {string} value - Raw value to map
 * @returns {string} Localized value or original value if no mapping found
 */
NamesDataManager.prototype.getLocalizedValue = function(language, species, category, fieldName, value) {
  const metadata = this.getEntryMetadata(language, species, category);
  if (!metadata || !metadata[fieldName] || !metadata[fieldName].values) {
    return value;
  }

  const values = metadata[fieldName].values;
  const currentLang = game.i18n.lang || 'en';

  // Check for localized value mapping
  if (values[currentLang] && values[currentLang][value]) {
    return values[currentLang][value];
  }

  // Fallback to English or German
  if (values.en && values.en[value]) {
    return values.en[value];
  }

  if (values.de && values.de[value]) {
    return values.de[value];
  }

  // Return original value if no mapping found
  return value;
};

/**
 * Gets localized individual entry value (3.1.2 format)
 * Handles both string values and localized objects within entry metadata
 * @param {any} value - Value to localize (can be string or object with language keys)
 * @param {string} fallbackLang - Fallback language if current language not available
 * @returns {string} Localized value or original value
 */
NamesDataManager.prototype.getLocalizedEntryValue = function(value, fallbackLang = 'en') {
  // If it's not an object, return as-is
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const currentLang = game.i18n.lang || fallbackLang;

  // Check for current language
  if (value[currentLang]) {
    return value[currentLang];
  }

  // Fallback to specified fallback language
  if (value[fallbackLang]) {
    return value[fallbackLang];
  }

  // Fallback to German if not English
  if (fallbackLang !== 'de' && value.de) {
    return value.de;
  }

  // Fallback to English if not already tried
  if (fallbackLang !== 'en' && value.en) {
    return value.en;
  }

  // Fallback to first available value
  const firstValue = Object.values(value).find(v => typeof v === 'string');
  if (firstValue) {
    return firstValue;
  }

  // Return original object if no string values found
  return value;
};

/**
 * Gets all available metadata fields for a category (3.1.1 format)
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @returns {Array} Array of field names that have metadata definitions
 */
NamesDataManager.prototype.getMetadataFields = function(language, species, category) {
  const metadata = this.getEntryMetadata(language, species, category);
  return metadata ? Object.keys(metadata) : [];
};

/**
 * Checks if a category has entry metadata (3.1.1 format)
 * @param {string} language - Language code
 * @param {string} species - Species code
 * @param {string} category - Category name
 * @returns {boolean} True if category has entry metadata definitions
 */
NamesDataManager.prototype.hasEntryMetadata = function(language, species, category) {
  return this.getEntryMetadata(language, species, category) !== null;
};