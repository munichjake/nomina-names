/**
 * Species Manager - Centralized species definition and management
 */

import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

/**
 * Species Definition - Contains all information about a species
 */
export class SpeciesDefinition {
  constructor(options = {}) {
    const {
      code,
      displayName,
      enabled = true,
      languages = [],
      categories = [],
      grammarRules = null,
      dataFiles = [],
      metadata = {}
    } = options;

    this.code = code;
    this.displayName = displayName;
    this.enabled = enabled;
    this.languages = new Set(languages);
    this.categories = new Set(categories);
    this.grammarRules = grammarRules;
    this.dataFiles = new Map(dataFiles || []); // "language.category" → data/path
    this.metadata = metadata;
  }

  /**
   * Check if species has data for a specific language and optional category
   */
  hasDataFor(language, category = null) {
    if (category) {
      return this.dataFiles.has(`${language}.${category}`);
    }
    return Array.from(this.dataFiles.keys()).some(key => key.startsWith(`${language}.`));
  }

  /**
   * Get available categories for a language
   */
  getCategoriesFor(language) {
    const categories = [];
    for (const key of this.dataFiles.keys()) {
      const [lang, category] = key.split('.');
      if (lang === language && category) {
        categories.push(category);
      }
    }
    return [...new Set(categories)];
  }

  /**
   * Get available languages
   */
  getLanguages() {
    return Array.from(this.languages);
  }

  /**
   * Check if species is enabled in user settings
   */
  isEnabled() {
    if (!this.enabled) return false;

    try {
      const speciesSettings = game.settings.get("nomina-names", "availableSpecies");
      if (!speciesSettings || Object.keys(speciesSettings).length === 0) {
        return true; // Default to enabled if no settings
      }
      return speciesSettings[this.code] !== false;
    } catch (error) {
      logWarn(`Failed to check species settings for ${this.code}:`, error);
      return true; // Default to enabled if settings fail
    }
  }

  /**
   * Get localized display name
   */
  getLocalizedName() {
    const locKey = `names.species.${this.code}`;
    return game.i18n.localize(locKey) || this.displayName || this.code.charAt(0).toUpperCase() + this.code.slice(1);
  }

  /**
   * Add data for a language/category combination
   */
  addData(language, category, data, source = null) {
    const key = `${language}.${category}`;

    // Always include source information
    const dataWithSource = {
      ...data,
      _source: source || this.metadata?.moduleId || 'unknown',
      _addedAt: new Date().toISOString()
    };

    this.dataFiles.set(key, dataWithSource);

    // Ensure languages and categories are Sets (robust initialization)
    if (!this.languages || !(this.languages instanceof Set)) {
      this.languages = new Set(this.languages || []);
    }
    if (!this.categories || !(this.categories instanceof Set)) {
      this.categories = new Set(this.categories || []);
    }

    this.languages.add(language);
    this.categories.add(category);
    logDebug(`Added data for ${this.code}: ${key} (source: ${dataWithSource._source})`);
  }

  /**
   * Get data for a language/category combination
   */
  getData(language, category) {
    const key = `${language}.${category}`;
    return this.dataFiles.get(key);
  }

  /**
   * Set grammar rules for this species
   */
  setGrammarRules(rules) {
    this.grammarRules = rules;
    logDebug(`Set grammar rules for ${this.code}`);
  }

  /**
   * Get grammar rules
   */
  getGrammarRules() {
    return this.grammarRules;
  }
}

/**
 * Species Manager - Central management for all species
 */
export class SpeciesManager {
  constructor() {
    this.species = new Map(); // code → SpeciesDefinition
    this.initialized = false;
  }

  /**
   * Initialize with default species
   */
  initialize() {
    if (this.initialized) return;

    // Register core species
    this.registerSpecies('human', {
      displayName: 'Human',
      enabled: true,
      languages: ['de', 'en'],
      categories: ['male', 'female', 'nonbinary', 'surnames', 'titles', 'nicknames', 'settlements']
    });

    this.registerSpecies('elf', {
      displayName: 'Elf',
      enabled: true,
      languages: ['de', 'en'],
      categories: ['male', 'female', 'nonbinary', 'surnames', 'titles', 'nicknames', 'settlements']
    });

    this.registerSpecies('dwarf', {
      displayName: 'Dwarf',
      enabled: true,
      languages: ['de', 'en'],
      categories: ['male', 'female', 'surnames', 'titles', 'nicknames', 'settlements']
    });

    this.registerSpecies('halfling', {
      displayName: 'Halfling',
      enabled: true,
      languages: ['de', 'en'],
      categories: ['male', 'female', 'surnames', 'titles', 'nicknames', 'settlements']
    });

    this.registerSpecies('orc', {
      displayName: 'Orc',
      enabled: true,
      languages: ['de', 'en'],
      categories: ['male', 'female', 'surnames', 'titles', 'nicknames', 'settlements']
    });

    this.initialized = true;
    logInfo("SpeciesManager initialized with core species");
  }

  /**
   * Register a new species or update existing one
   */
  registerSpecies(code, options) {
    if (!code) {
      throw new Error("Species code is required");
    }

    const existingSpecies = this.species.get(code);
    if (existingSpecies) {
      // Update existing species - carefully merge to preserve Sets
      const { languages, categories, ...otherOptions } = options;
      Object.assign(existingSpecies, otherOptions);

      // Merge languages and categories as Sets
      if (languages) {
        const newLanguages = Array.isArray(languages) ? languages : [languages];
        newLanguages.forEach(lang => existingSpecies.languages.add(lang));
      }
      if (categories) {
        const newCategories = Array.isArray(categories) ? categories : [categories];
        newCategories.forEach(cat => existingSpecies.categories.add(cat));
      }

      logInfo(`Updated species definition: ${code}`);
    } else {
      // Create new species
      const speciesDefinition = new SpeciesDefinition({ code, ...options });
      this.species.set(code, speciesDefinition);
      logInfo(`Registered new species: ${code}`);
    }

    return this.species.get(code);
  }

  /**
   * Get a species definition by code
   */
  getSpecies(code) {
    return this.species.get(code);
  }

  /**
   * Get all registered species codes
   */
  getAllSpeciesCodes() {
    return Array.from(this.species.keys());
  }

  /**
   * Get all enabled species for a specific language
   */
  getAvailableSpecies(language = null) {
    const availableSpecies = [];

    for (const species of this.species.values()) {
      if (!species.isEnabled()) continue;

      if (language && !species.hasDataFor(language)) continue;

      availableSpecies.push({
        code: species.code,
        name: species.getLocalizedName(),
        definition: species
      });
    }

    return availableSpecies.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get all enabled species that have data for specific language and category
   */
  getSpeciesWithData(language, category) {
    const speciesWithData = [];

    for (const species of this.species.values()) {
      if (!species.isEnabled()) continue;
      if (!species.hasDataFor(language, category)) continue;

      speciesWithData.push({
        code: species.code,
        name: species.getLocalizedName(),
        definition: species
      });
    }

    return speciesWithData.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Central function to add a species with data (supports both file paths and direct data)
   * @param {Object} speciesConfig - Species configuration
   * @param {string} speciesConfig.code - Species code
   * @param {string} speciesConfig.displayName - Display name
   * @param {Object} speciesConfig.data - Direct data or file mapping
   * @param {Array} speciesConfig.languages - Supported languages
   * @param {Array} speciesConfig.categories - Supported categories
   * @param {boolean} speciesConfig.loadOnDemand - Whether to load data on demand
   * @param {string} speciesConfig.moduleId - ID of module registering this species
   */
  async addSpecies(speciesConfig) {
    const {
      code,
      displayName,
      data = {},
      languages = [],
      categories = [],
      loadOnDemand = true,
      moduleId = 'core',
      enabled = true,
      grammarRules = null
    } = speciesConfig;

    if (!code) {
      throw new Error("Species code is required");
    }

    logDebug(`Adding species ${code} (module: ${moduleId}, loadOnDemand: ${loadOnDemand})`);

    // Register or update species definition
    const species = this.registerSpecies(code, {
      displayName: displayName || code.charAt(0).toUpperCase() + code.slice(1),
      enabled,
      languages,
      categories,
      metadata: { moduleId, loadOnDemand }
    });

    // Set grammar rules if provided
    if (grammarRules) {
      species.setGrammarRules(grammarRules);
    }

    let loadedDataCount = 0;

    // Process data entries
    for (const [dataKey, dataValue] of Object.entries(data)) {
      if (this._isFileReference(dataValue)) {
        // File path - setup for load on demand
        const [language, category] = this._parseDataKey(dataKey);
        if (language && category) {
          const source = this._generateSourceInfo(moduleId, dataValue);
          species.addData(language, category, {
            _filePath: dataValue,
            _loadOnDemand: loadOnDemand,
            _loaded: false
          }, source);

          // Load immediately if not load-on-demand
          if (!loadOnDemand) {
            await this._loadSpeciesDataFile(species, language, category, dataValue, source);
            loadedDataCount++;
          }
        }
      } else {
        // Direct data - add immediately
        const [language, category] = this._parseDataKey(dataKey);
        if (language && category) {
          const source = this._generateSourceInfo(moduleId, 'direct-data');
          species.addData(language, category, dataValue, source);
          loadedDataCount++;
        }
      }
    }

    logInfo(`Added species ${code}: ${loadedDataCount} data entries loaded immediately`);
    return species;
  }

  /**
   * Add data to a species (legacy method, now routes through addSpecies)
   */
  addSpeciesData(speciesCode, language, category, data) {
    const species = this.species.get(speciesCode);
    if (!species) {
      logWarn(`Cannot add data to unknown species: ${speciesCode}`);
      return false;
    }

    species.addData(language, category, data);
    return true;
  }

  /**
   * Load species data on demand
   */
  async loadSpeciesDataOnDemand(speciesCode, language, category) {
    const species = this.species.get(speciesCode);
    if (!species) {
      logWarn(`Cannot load data for unknown species: ${speciesCode}`);
      return false;
    }

    const data = species.getData(language, category);
    if (!data || !data._loadOnDemand || data._loaded) {
      return true; // Already loaded or not a load-on-demand entry
    }

    if (data._filePath) {
      return await this._loadSpeciesDataFile(species, language, category, data._filePath);
    }

    return false;
  }

  /**
   * Parse data key into language and category components
   */
  _parseDataKey(dataKey) {
    const parts = dataKey.split('.');
    if (parts.length === 2) {
      return [parts[0], parts[1]]; // language.category
    }
    if (parts.length === 1) {
      return ['de', parts[0]]; // assume 'de' as default language
    }
    return [null, null];
  }

  /**
   * Check if data value is a file reference
   */
  _isFileReference(dataValue) {
    return typeof dataValue === 'string' && (
      dataValue.endsWith('.json') ||
      dataValue.includes('/') ||
      dataValue.includes('\\')
    );
  }

  /**
   * Generate source information for data tracking
   */
  _generateSourceInfo(moduleId, filePath) {
    if (moduleId === 'core') {
      // Core module files from /data folder
      return `core:${filePath}`;
    } else {
      // External module files
      return `module:${moduleId}:${filePath}`;
    }
  }

  /**
   * Load species data from file
   */
  async _loadSpeciesDataFile(species, language, category, filePath, source = null) {
    try {
      logDebug(`Loading species data file: ${filePath}`);

      const response = await fetch(filePath);
      if (!response.ok) {
        logWarn(`Failed to load species data file: ${filePath} (status: ${response.status})`);
        return false;
      }

      const data = await response.json();

      // Replace the file reference with actual data, preserving source info
      species.addData(language, category, {
        ...data,
        _loaded: true,
        _filePath: filePath
      }, source);

      logDebug(`Successfully loaded species data from ${filePath} (source: ${source})`);
      return true;
    } catch (error) {
      logError(`Error loading species data file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get data from a species (with automatic load-on-demand)
   */
  async getSpeciesData(speciesCode, language, category) {
    const species = this.species.get(speciesCode);
    if (!species) {
      logWarn(`Cannot get data from unknown species: ${speciesCode}`);
      return null;
    }

    const data = species.getData(language, category);

    // Check if this is a load-on-demand file that hasn't been loaded yet
    if (data && data._loadOnDemand && !data._loaded && data._filePath) {
      logDebug(`Loading data on demand for ${speciesCode}.${language}.${category}`);
      const loaded = await this._loadSpeciesDataFile(species, language, category, data._filePath);
      if (loaded) {
        return species.getData(language, category);
      }
    }

    return data;
  }

  /**
   * Bulk load species from file directory (for initialization from /data folder)
   */
  async loadSpeciesFromDirectory(basePath, fileList) {
    logInfo(`Loading species from directory: ${basePath}`);
    let loadedFiles = 0;
    const speciesMap = new Map();

    for (const filename of fileList) {
      if (!filename.endsWith('.json')) continue;

      const parts = filename.replace('.json', '').split('.');
      if (parts.length < 3) continue;

      const [language, speciesCode, category] = parts;
      const filePath = `${basePath}/${filename}`;

      // Group by species
      if (!speciesMap.has(speciesCode)) {
        speciesMap.set(speciesCode, {
          code: speciesCode,
          displayName: speciesCode.charAt(0).toUpperCase() + speciesCode.slice(1),
          data: {},
          languages: new Set(),
          categories: new Set(),
          loadOnDemand: true,
          moduleId: 'core'
        });
      }

      const speciesConfig = speciesMap.get(speciesCode);
      speciesConfig.data[`${language}.${category}`] = filePath;
      speciesConfig.languages.add(language);
      speciesConfig.categories.add(category);

      // Track source for directory loading
      if (!speciesConfig.sources) {
        speciesConfig.sources = [];
      }
      speciesConfig.sources.push(`core:${filePath}`);
    }

    // Register all collected species
    for (const speciesConfig of speciesMap.values()) {
      speciesConfig.languages = Array.from(speciesConfig.languages);
      speciesConfig.categories = Array.from(speciesConfig.categories);

      await this.addSpecies(speciesConfig);
      loadedFiles += Object.keys(speciesConfig.data).length;
    }

    logInfo(`Loaded ${speciesMap.size} species with ${loadedFiles} data files from directory`);
    return speciesMap.size;
  }

  /**
   * Check if a species exists and is enabled
   */
  isSpeciesAvailable(speciesCode, language = null, category = null) {
    const species = this.species.get(speciesCode);
    if (!species || !species.isEnabled()) return false;

    if (language && category) {
      return species.hasDataFor(language, category);
    } else if (language) {
      return species.hasDataFor(language);
    }

    return true;
  }

  /**
   * Get available languages for a species
   */
  getSpeciesLanguages(speciesCode) {
    const species = this.species.get(speciesCode);
    return species ? species.getLanguages() : [];
  }

  /**
   * Get available categories for a species and language
   */
  getSpeciesCategories(speciesCode, language) {
    const species = this.species.get(speciesCode);
    return species ? species.getCategoriesFor(language) : [];
  }

  /**
   * Set grammar rules for a species
   */
  setSpeciesGrammarRules(speciesCode, language, rules) {
    const species = this.species.get(speciesCode);
    if (!species) {
      logWarn(`Cannot set grammar rules for unknown species: ${speciesCode}`);
      return false;
    }

    species.setGrammarRules(rules);
    return true;
  }

  /**
   * Get grammar rules for a species
   */
  getSpeciesGrammarRules(speciesCode, language) {
    const species = this.species.get(speciesCode);
    return species ? species.getGrammarRules() : null;
  }

  /**
   * Get data sources for a species
   */
  getSpeciesSources(speciesCode, language = null, category = null) {
    const species = this.species.get(speciesCode);
    if (!species) return [];

    const sources = [];

    if (language && category) {
      // Get source for specific data
      const data = species.getData(language, category);
      if (data && data._source) {
        sources.push({
          key: `${language}.${category}`,
          source: data._source,
          filePath: data._filePath || null,
          addedAt: data._addedAt || null,
          loaded: data._loaded !== false
        });
      }
    } else {
      // Get all sources for the species
      for (const [key, data] of species.dataFiles.entries()) {
        if (data._source) {
          const [lang, cat] = key.split('.');
          sources.push({
            key: key,
            language: lang,
            category: cat,
            source: data._source,
            filePath: data._filePath || null,
            addedAt: data._addedAt || null,
            loaded: data._loaded !== false
          });
        }
      }
    }

    return sources;
  }

  /**
   * Get detailed info about a species including sources
   */
  getSpeciesInfo(speciesCode) {
    const species = this.species.get(speciesCode);
    if (!species) return null;

    return {
      code: species.code,
      displayName: species.displayName,
      localizedName: species.getLocalizedName(),
      enabled: species.isEnabled(),
      languages: species.getLanguages(),
      categories: Array.from(species.categories),
      metadata: species.metadata,
      sources: this.getSpeciesSources(speciesCode),
      dataCount: species.dataFiles.size
    };
  }

  /**
   * Import species data from the old data manager format
   */
  importFromDataManager(dataManager) {
    if (!dataManager || !dataManager.nameData) {
      logWarn("No data manager provided for import");
      return;
    }

    let importedCount = 0;

    // Import all data entries
    for (const [key, data] of dataManager.nameData.entries()) {
      const [language, speciesCode, category] = key.split('.');
      if (!language || !speciesCode || !category) continue;

      // Ensure species exists
      if (!this.species.has(speciesCode)) {
        this.registerSpecies(speciesCode, {
          displayName: speciesCode.charAt(0).toUpperCase() + speciesCode.slice(1),
          enabled: true,
          languages: [language],
          categories: [category]
        });
      }

      // Add data to species
      this.addSpeciesData(speciesCode, language, category, data);
      importedCount++;
    }

    // Import grammar rules
    for (const [key, rules] of dataManager.grammarRules.entries()) {
      const [language, speciesCode] = key.split('.');
      if (language && speciesCode) {
        this.setSpeciesGrammarRules(speciesCode, language, rules);
      }
    }

    logInfo(`Imported ${importedCount} data entries from DataManager`);
  }

  /**
   * Export current species data to old data manager format (for compatibility)
   */
  exportToDataManager(dataManager) {
    if (!dataManager) {
      logWarn("No data manager provided for export");
      return;
    }

    let exportedCount = 0;

    // Export all species data
    for (const species of this.species.values()) {
      for (const [key, data] of species.dataFiles.entries()) {
        const fullKey = `${species.code}.${key}`;
        dataManager.nameData.set(fullKey, data);
        exportedCount++;
      }

      // Export grammar rules if available
      if (species.grammarRules) {
        for (const language of species.languages) {
          const grammarKey = `${language}.${species.code}`;
          dataManager.grammarRules.set(grammarKey, species.grammarRules);
        }
      }
    }

    logInfo(`Exported ${exportedCount} data entries to DataManager`);
  }
}

// Global instance
let globalSpeciesManager = null;

/**
 * Get or create the global species manager
 */
export function getSpeciesManager() {
  if (!globalSpeciesManager) {
    globalSpeciesManager = new SpeciesManager();
    globalSpeciesManager.initialize();
  }
  return globalSpeciesManager;
}

/**
 * Set the global species manager (for testing)
 */
export function setSpeciesManager(manager) {
  globalSpeciesManager = manager;
}