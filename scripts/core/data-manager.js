/**
 * Data Manager
 * Manages loading and caching of JSON Format 4.0 data packages
 * Updated to support new index.json format with species/category grouping
 */

import { getGlobalEngine } from './engine.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

/**
 * Data Manager
 * Handles loading and managing v4.0 format data packages
 */
export class DataManager {
  constructor() {
    this.packages = new Map(); // packageCode -> packageData
    this.engine = getGlobalEngine();
    this.indexData = null;
    this.isLoaded = false;
    this.isLoading = false;
  }

  /**
   * Initialize and load all data packages
   */
  async initializeData() {
    if (this.isLoaded || this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      // Load index to discover available packages
      await this.loadIndex();

      // Load all packages from new index format
      const loadPromises = [];

      for (const pkg of this.indexData.packages || []) {
        // Process each file in the package
        for (const file of pkg.files || []) {
          if (file.enabled !== false) {
            // Build package code from species and language
            const packageCode = `${pkg.species}-${file.language}`;
            loadPromises.push(this.loadPackage(file.path, packageCode, pkg.species, pkg.category));
          }
        }
      }

      await Promise.all(loadPromises);

      this.isLoaded = true;
      logInfo(`DataManager initialized: ${this.packages.size} packages loaded`);
    } catch (error) {
      logError('Failed to initialize DataManager:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load index file
   */
  async loadIndex() {
    try {
      const indexPath = 'modules/nomina-names/data/index.json';
      const response = await fetch(indexPath);

      if (response.ok) {
        this.indexData = await response.json();
        logDebug('Loaded package index with format:', this.indexData.format);
        return;
      }
    } catch (error) {
      logError('Failed to load index:', error);
      this.indexData = { packages: [], species: {}, locales: { default: 'en' } };
    }
  }

  /**
   * Load a single package file and merge it into the package
   */
  async loadPackage(path, packageCode, species, category) {
    try {
      const response = await fetch(path);

      if (!response.ok) {
        logWarn(`Failed to load package from ${path}`);
        return;
      }

      const data = await response.json();

      // Validate format
      if (data.format !== '4.0.0') {
        logWarn(`Package ${packageCode} has unsupported format: ${data.format}`);
        return;
      }

      // Check if package already exists (multi-file package)
      let packageData = this.packages.get(packageCode);

      if (!packageData) {
        // Create new package entry
        packageData = {
          data: {
            format: data.format,
            fileVersion: data.fileVersion || null,
            package: data.package || {
              code: packageCode,
              displayName: this._getSpeciesDisplayName(species),
              languages: [data.package?.languages?.[0] || 'en'],
              phoneticLanguage: data.package?.phoneticLanguage || 'en'
            },
            catalogs: {},
            recipes: [],
            langRules: data.langRules || {},
            output: data.output || {},
            vocab: data.vocab || null,
            collections: []
          },
          code: packageCode,
          species: species,
          categories: []
        };
        this.packages.set(packageCode, packageData);
      }

      // Merge catalogs from this file
      if (data.catalogs) {
        for (const [catalogKey, catalogData] of Object.entries(data.catalogs)) {
          if (!packageData.data.catalogs[catalogKey]) {
            // Catalog doesn't exist yet, add it
            packageData.data.catalogs[catalogKey] = {
              ...catalogData,
              displayNameByCategory: {}
            };

            // Store displayName by category (e.g., "male", "female")
            if (catalogData.displayName && category) {
              for (const [lang, value] of Object.entries(catalogData.displayName)) {
                if (!packageData.data.catalogs[catalogKey].displayNameByCategory[lang]) {
                  packageData.data.catalogs[catalogKey].displayNameByCategory[lang] = {};
                }
                packageData.data.catalogs[catalogKey].displayNameByCategory[lang][category] = value;
                logDebug(`Stored displayName for catalog '${catalogKey}': [${lang}][${category}] = "${value}"`);
              }
            }
          } else {
            // Catalog exists, merge items
            if (catalogData.items && Array.isArray(catalogData.items)) {
              packageData.data.catalogs[catalogKey].items.push(...catalogData.items);
            }

            // Store displayName by category instead of overwriting
            if (catalogData.displayName && category) {
              if (!packageData.data.catalogs[catalogKey].displayNameByCategory) {
                packageData.data.catalogs[catalogKey].displayNameByCategory = {};
              }

              for (const [lang, value] of Object.entries(catalogData.displayName)) {
                if (!packageData.data.catalogs[catalogKey].displayNameByCategory[lang]) {
                  packageData.data.catalogs[catalogKey].displayNameByCategory[lang] = {};
                }
                packageData.data.catalogs[catalogKey].displayNameByCategory[lang][category] = value;
                logDebug(`Stored displayName for catalog '${catalogKey}': [${lang}][${category}] = "${value}"`);
              }
            }
          }
        }
      }

      // Merge recipes from this file
      if (data.recipes && Array.isArray(data.recipes)) {
        packageData.data.recipes.push(...data.recipes);
      }

      // Merge langRules
      if (data.langRules) {
        Object.assign(packageData.data.langRules, data.langRules);
      }

      // Merge vocab (v4.0.1) - use first non-null vocab found
      if (data.vocab && !packageData.data.vocab) {
        packageData.data.vocab = data.vocab;
        logDebug(`Loaded vocab for package: ${packageCode}`);
      } else if (data.vocab && packageData.data.vocab) {
        // Merge vocab fields and icons
        if (data.vocab.fields) {
          if (!packageData.data.vocab.fields) {
            packageData.data.vocab.fields = {};
          }
          Object.assign(packageData.data.vocab.fields, data.vocab.fields);
        }
        if (data.vocab.icons) {
          if (!packageData.data.vocab.icons) {
            packageData.data.vocab.icons = {};
          }
          Object.assign(packageData.data.vocab.icons, data.vocab.icons);
        }
        logDebug(`Merged vocab for package: ${packageCode}`);
      }

      // Merge collections (v4.0.1)
      if (data.collections && Array.isArray(data.collections)) {
        packageData.data.collections.push(...data.collections);
        logDebug(`Merged ${data.collections.length} collections for package: ${packageCode}`);
      }

      // Update fileVersion if present
      if (data.fileVersion && !packageData.data.fileVersion) {
        packageData.data.fileVersion = data.fileVersion;
      }

      // Track categories
      if (category && !packageData.categories.includes(category)) {
        packageData.categories.push(category);
      }

      // Load merged package into engine
      this.engine.loadPackage(packageData.data);

      logDebug(`Loaded and merged file into package: ${packageCode} (${path})`);
    } catch (error) {
      logError(`Error loading package file ${path}:`, error);
    }
  }

  /**
   * Register a package at runtime (for external modules)
   * @param {string} packageCode - Package code (e.g., 'goblin-de')
   * @param {Object} data - V4.0.0/4.0.1 format package data
   */
  async registerPackage(packageCode, data) {
    // Validate format
    if (data.format !== '4.0.0') {
      throw new Error(`Unsupported format: ${data.format}. Only 4.0.0 is supported.`);
    }

    // Validate required fields
    if (!data.package || !data.package.code) {
      throw new Error('Package data must include package.code');
    }

    if (!data.catalogs || Object.keys(data.catalogs).length === 0) {
      throw new Error('Package data must include at least one catalog');
    }

    // Extract species from package code (e.g., 'goblin-de' -> 'goblin')
    const parts = packageCode.split('-');
    const species = parts.slice(0, -1).join('-'); // Everything except last part
    const language = parts[parts.length - 1]; // Last part is language

    // Create package entry
    const packageData = {
      data: {
        format: data.format,
        fileVersion: data.fileVersion || null,
        package: data.package,
        catalogs: data.catalogs || {},
        recipes: data.recipes || [],
        langRules: data.langRules || {},
        output: data.output || {},
        vocab: data.vocab || null,
        collections: data.collections || []
      },
      code: packageCode,
      species: species,
      categories: Object.keys(data.catalogs),
      _external: true, // Mark as externally registered
      _registeredAt: new Date().toISOString()
    };

    // Store package
    this.packages.set(packageCode, packageData);

    // Load into engine
    this.engine.loadPackage(packageData.data);

    // Update index data to include new species if not present
    if (!this.indexData.species) {
      this.indexData.species = {};
    }
    if (!this.indexData.species[species] && data.package.displayName) {
      this.indexData.species[species] = data.package.displayName;
    }

    logInfo(`Registered external package: ${packageCode} (species: ${species}, language: ${language})`);
  }

  /**
   * Get species display name from index
   */
  _getSpeciesDisplayName(speciesCode) {
    if (this.indexData?.species?.[speciesCode]) {
      return this.indexData.species[speciesCode];
    }
    return {
      en: speciesCode.charAt(0).toUpperCase() + speciesCode.slice(1),
      de: speciesCode.charAt(0).toUpperCase() + speciesCode.slice(1)
    };
  }

  /**
   * Get available languages
   */
  getLanguages() {
    const languages = new Set();

    for (const pkg of this.packages.values()) {
      pkg.data.package.languages.forEach(lang => languages.add(lang));
    }

    return Array.from(languages).sort();
  }

  /**
   * Get available species for a language with localized names
   * @param {string} language - Language code (e.g., 'de')
   * @param {string} locale - UI locale for species names (e.g., 'de')
   * @returns {Array<Object>} Array of { code, name } objects with localized species names
   */
  getSpecies(language, locale = 'en') {
    const speciesCodes = new Set();

    for (const pkg of this.packages.values()) {
      if (pkg.data.package.languages.includes(language)) {
        speciesCodes.add(pkg.species);
      }
    }

    // Get species metadata for localized names
    const speciesMetadata = this.getSpeciesMetadata();

    return Array.from(speciesCodes).sort().map(code => {
      const metadata = speciesMetadata[code];
      // Species metadata structure: { "code": { "en": "Name", "de": "Name" } }
      const name = metadata?.[locale] ||
                   metadata?.en ||
                   code.charAt(0).toUpperCase() + code.slice(1);

      return { code, name };
    });
  }

  /**
   * Get available recipes for a package
   */
  getRecipes(packageCode, locale = 'en') {
    return this.engine.getAvailableRecipes(packageCode, locale);
  }

  /**
   * Get available catalogs (categories) for a package
   * Returns catalogs as category-like structure for UI compatibility
   */
  getCatalogs(packageCode, locale = 'en') {
    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.catalogs) {
      return [];
    }

    // Get the default language from the package
    const defaultLang = pkg.data.package?.languages?.[0] || 'en';

    return Object.keys(pkg.data.catalogs).map(catalogKey => {
      const catalog = pkg.data.catalogs[catalogKey];

      // Try to get localized displayName, fallback to capitalized key
      let displayName;
      if (catalog.displayName) {
        displayName = catalog.displayName[locale] ||
                     catalog.displayName[defaultLang] ||
                     catalog.displayName.en;
      }

      if (!displayName) {
        displayName = this._capitalizeCatalogName(catalogKey);
      }

      return {
        code: catalogKey,
        name: displayName
      };
    });
  }

  /**
   * Capitalize catalog name for display
   */
  _capitalizeCatalogName(catalogKey) {
    return catalogKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get the engine instance
   */
  getEngine() {
    return this.engine;
  }

  /**
   * Get package by code
   */
  getPackage(packageCode) {
    return this.packages.get(packageCode);
  }

  /**
   * Get all loaded package codes
   */
  getLoadedPackages() {
    return Array.from(this.packages.keys());
  }

  /**
   * Get the index data
   */
  getIndexData() {
    return this.indexData;
  }

  /**
   * Get species metadata from index
   */
  getSpeciesMetadata() {
    return this.indexData?.species || {};
  }

  /**
   * Get locales configuration from index
   */
  getLocalesConfig() {
    return this.indexData?.locales || { default: 'en', fallbacks: {} };
  }

  // ============================================================
  // V4.0.1 Extensions: Vocab & Collections
  // ============================================================

  /**
   * Get vocab (vocabulary) for a package
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @returns {object|null} Vocab object with fields and icons, or null
   */
  getVocab(packageCode) {
    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.vocab) {
      return null;
    }
    return pkg.data.vocab;
  }

  /**
   * Get translation for a tag from vocab
   * @param {string} packageCode - Package code
   * @param {string} tag - Tag name (e.g., "upscale_inn")
   * @param {string} lang - Language code (e.g., "de", "en")
   * @param {string} fieldName - Field name in vocab (default: "type")
   * @returns {string|null} Translated tag label, or null if not found
   */
  getVocabTranslation(packageCode, tag, lang, fieldName = 'type') {
    const vocab = this.getVocab(packageCode);
    if (!vocab || !vocab.fields || !vocab.fields[fieldName]) {
      return null;
    }

    const field = vocab.fields[fieldName];
    const values = field.values || {};

    if (values[tag] && values[tag][lang]) {
      return values[tag][lang];
    }

    // Fallback: try first available language
    if (values[tag]) {
      const availableLangs = Object.keys(values[tag]);
      if (availableLangs.length > 0) {
        return values[tag][availableLangs[0]];
      }
    }

    return null;
  }

  /**
   * Get all vocab translations for a tag in all languages
   * @param {string} packageCode - Package code
   * @param {string} tag - Tag name
   * @param {string} fieldName - Field name in vocab (default: "type")
   * @returns {object|null} Object with language keys, or null
   */
  getVocabTranslations(packageCode, tag, fieldName = 'type') {
    const vocab = this.getVocab(packageCode);
    if (!vocab || !vocab.fields || !vocab.fields[fieldName]) {
      return null;
    }

    const field = vocab.fields[fieldName];
    const values = field.values || {};

    return values[tag] || null;
  }

  /**
   * Get icon for a tag from vocab
   * @param {string} packageCode - Package code
   * @param {string} tag - Tag name
   * @returns {string|null} Icon string (emoji or icon token), or null
   */
  getVocabIcon(packageCode, tag) {
    const vocab = this.getVocab(packageCode);
    if (!vocab || !vocab.icons) {
      return null;
    }

    return vocab.icons[tag] || null;
  }

  /**
   * Get all collections for a package
   * @param {string} packageCode - Package code
   * @returns {array} Array of collection objects
   */
  getCollections(packageCode) {
    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.collections) {
      return [];
    }
    return pkg.data.collections;
  }

  /**
   * Get a specific collection by key
   * @param {string} packageCode - Package code
   * @param {string} collectionKey - Collection key
   * @returns {object|null} Collection object, or null if not found
   */
  getCollection(packageCode, collectionKey) {
    const collections = this.getCollections(packageCode);
    return collections.find(c => c.key === collectionKey) || null;
  }

  /**
   * Get items filtered by collection query
   * @param {string} packageCode - Package code
   * @param {string} collectionKey - Collection key
   * @returns {array} Array of items matching the collection query
   */
  getItemsByCollection(packageCode, collectionKey) {
    const collection = this.getCollection(packageCode, collectionKey);
    if (!collection || !collection.query) {
      return [];
    }

    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.catalogs) {
      return [];
    }

    const query = collection.query;
    const catalogKey = query.category;

    // Get items from the specified catalog
    const catalog = pkg.data.catalogs[catalogKey];
    if (!catalog || !catalog.items) {
      return [];
    }

    let items = catalog.items;

    // Apply tag filters (ALL-of logic)
    if (query.tags && query.tags.length > 0) {
      items = items.filter(item => {
        const itemTags = item.tags || [];
        // Item must have all required tags
        return query.tags.every(requiredTag => itemTags.includes(requiredTag));
      });
    }

    // Apply limit if specified
    if (query.limit && query.limit > 0) {
      items = items.slice(0, query.limit);
    }

    return items;
  }

  /**
   * Get collections for a specific catalog/category
   * @param {string} packageCode - Package code
   * @param {string} catalogKey - Catalog key (e.g., "taverns")
   * @returns {array} Array of collections that query this catalog
   */
  getCollectionsForCatalog(packageCode, catalogKey) {
    const collections = this.getCollections(packageCode);
    return collections.filter(c => c.query?.category === catalogKey);
  }

  /**
   * Check if a package has vocab support (v4.0.1+)
   * @param {string} packageCode - Package code
   * @returns {boolean} True if package has vocab
   */
  hasVocabSupport(packageCode) {
    const pkg = this.packages.get(packageCode);
    return !!(pkg && pkg.data.vocab);
  }

  /**
   * Check if a package has collections support (v4.0.1+)
   * @param {string} packageCode - Package code
   * @returns {boolean} True if package has collections
   */
  hasCollectionsSupport(packageCode) {
    const pkg = this.packages.get(packageCode);

    if (!pkg) {
      logDebug(`Package ${packageCode} not found in packages map. Available:`, Array.from(this.packages.keys()));
      return false;
    }

    if (!pkg.data) {
      logDebug(`Package ${packageCode} has no data`);
      return false;
    }

    if (!pkg.data.collections) {
      logDebug(`Package ${packageCode} has no collections property`);
      return false;
    }

    logDebug(`Package ${packageCode} has ${pkg.data.collections.length} collections`);
    return pkg.data.collections.length > 0;
  }

  /**
   * Get file version of a package
   * @param {string} packageCode - Package code
   * @returns {string|null} File version string, or null
   */
  getFileVersion(packageCode) {
    const pkg = this.packages.get(packageCode);
    return pkg?.data?.fileVersion || null;
  }
}

// Global instance
let globalDataManager = null;

/**
 * Get or create global data manager
 */
export function getGlobalDataManager() {
  if (!globalDataManager) {
    globalDataManager = new DataManager();
  }
  return globalDataManager;
}
