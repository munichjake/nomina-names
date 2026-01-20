/**
 * Data Manager
 * Manages loading and caching of JSON Format 4.0 data packages
 * Updated to support new index.json format with species/category grouping
 */

import { getGlobalEngine } from './engine.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

/**
 * Data Manager
 * Handles loading and managing v4.0 format data packages.
 * Responsible for discovering, loading, merging, and caching all name generation data.
 * Supports multi-file packages where data from multiple JSON files is merged into one package.
 *
 * @class DataManager
 * @example
 * // Get the global data manager instance
 * const dataManager = getGlobalDataManager();
 * await dataManager.initializeData();
 *
 * // Get available species for German language
 * const species = dataManager.getSpecies('de', 'de');
 */
export class DataManager {
  /**
   * Creates a new DataManager instance.
   * Initializes internal caches and references the global engine.
   */
  constructor() {
    /** @type {Map<string, Object>} Map of packageCode to package data */
    this.packages = new Map();
    /** @type {Engine} Reference to the global generation engine */
    this.engine = getGlobalEngine();
    /** @type {Object|null} Loaded index.json data */
    this.indexData = null;
    /** @type {boolean} Whether data has been fully loaded */
    this.isLoaded = false;
    /** @type {boolean} Whether data is currently being loaded */
    this.isLoading = false;
  }

  /**
   * Initialize and load all data packages from the index.
   * Loads the index.json file first, then loads all enabled packages in parallel.
   * Files within the same package are loaded sequentially to avoid race conditions during merging.
   *
   * @async
   * @returns {Promise<void>} Resolves when all packages are loaded
   * @throws {Error} If index loading or critical package loading fails
   * @example
   * const dataManager = getGlobalDataManager();
   * await dataManager.initializeData();
   * console.log(`Loaded ${dataManager.packages.size} packages`);
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
      // Group files by packageCode to avoid race conditions when merging
      const filesByPackage = new Map();

      for (const pkg of this.indexData.packages || []) {
        // Process each file in the package
        for (const file of pkg.files || []) {
          if (file.enabled !== false) {
            // Build package code from species and language
            const packageCode = `${pkg.species}-${file.language}`;

            if (!filesByPackage.has(packageCode)) {
              filesByPackage.set(packageCode, []);
            }
            filesByPackage.get(packageCode).push({
              path: file.path,
              packageCode,
              species: pkg.species,
              category: pkg.category
            });
          }
        }
      }

      // Load packages in parallel, but files within each package sequentially
      // This prevents race conditions when merging data into the same package
      const packagePromises = [];
      for (const [packageCode, files] of filesByPackage) {
        const loadPackageFiles = async () => {
          for (const file of files) {
            await this.loadPackage(file.path, file.packageCode, file.species, file.category);
          }
        };
        packagePromises.push(loadPackageFiles());
      }

      await Promise.all(packagePromises);

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
   * Load the index.json file that describes all available packages.
   * The index contains species metadata, locale configuration, and package file paths.
   * Falls back to an empty configuration if loading fails.
   *
   * @async
   * @returns {Promise<void>} Resolves when index is loaded (or fallback applied)
   * @private
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
   * Load a single package file and merge it into the existing package data.
   * If the package doesn't exist yet, creates a new package entry.
   * Handles merging of catalogs, recipes, langRules, vocab, and collections.
   *
   * @async
   * @param {string} path - Path to the JSON package file
   * @param {string} packageCode - Package identifier (e.g., "human-de")
   * @param {string} species - Species code (e.g., "human")
   * @param {string} category - Category for this file (e.g., "male", "female")
   * @returns {Promise<void>} Resolves when package file is loaded and merged
   * @private
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

      // Merge recipes from this file (deduplicate by ID)
      if (data.recipes && Array.isArray(data.recipes)) {
        const existingIds = new Set(packageData.data.recipes.map(r => r.id));
        for (const recipe of data.recipes) {
          if (existingIds.has(recipe.id)) {
            logDebug(`Skipping duplicate recipe '${recipe.id}' in package ${packageCode} (from ${path})`);
          } else {
            packageData.data.recipes.push(recipe);
            existingIds.add(recipe.id);
          }
        }
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
   * Register a package at runtime for external modules.
   * Allows third-party modules to add their own name data packages dynamically.
   * The package will be validated and loaded into the engine immediately.
   *
   * @async
   * @param {string} packageCode - Package code (e.g., "goblin-de", "custom-species-en")
   * @param {Object} data - V4.0.0/4.0.1 format package data
   * @param {string} data.format - Must be "4.0.0"
   * @param {Object} data.package - Package metadata with code and displayName
   * @param {Object} data.catalogs - At least one catalog with items
   * @param {Array} [data.recipes] - Optional recipes for name generation
   * @param {Object} [data.langRules] - Optional language-specific grammar rules
   * @param {Object} [data.vocab] - Optional vocabulary translations (v4.0.1)
   * @param {Array} [data.collections] - Optional preset queries (v4.0.1)
   * @returns {Promise<void>} Resolves when package is registered
   * @throws {Error} If format is unsupported or required fields are missing
   * @example
   * await dataManager.registerPackage('custom-de', {
   *   format: '4.0.0',
   *   package: { code: 'custom-de', displayName: { de: 'Benutzerdefiniert' } },
   *   catalogs: { names: { items: [{ t: { de: 'Max' }, tags: ['firstnames', 'male'] }] } }
   * });
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
   * Get the localized display name for a species from the index metadata.
   * Falls back to a capitalized version of the species code if not found.
   *
   * @param {string} speciesCode - Species code (e.g., "human", "elf", "dwarf")
   * @returns {Object} Localized display names (e.g., { en: "Human", de: "Mensch" })
   * @private
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
   * Get all available languages across all loaded packages.
   * Languages are determined from the package.languages array of each package.
   *
   * @returns {string[]} Sorted array of unique language codes (e.g., ["de", "en"])
   * @example
   * const languages = dataManager.getLanguages();
   * // Returns: ["de", "en"]
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
   * Respects user settings for enabled/disabled species
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

    // Get user settings for available species
    let speciesSettings = {};
    try {
      speciesSettings = game.settings.get("nomina-names", "availableSpecies") || {};
    } catch (error) {
      logWarn("Failed to read species settings, showing all species:", error);
    }

    // Filter and map species, respecting enabled/disabled settings
    return Array.from(speciesCodes).sort()
      .filter(code => {
        // If no settings exist, default to enabled
        if (!speciesSettings || Object.keys(speciesSettings).length === 0) {
          return true;
        }
        // Species is enabled if not explicitly set to false
        return speciesSettings[code] !== false;
      })
      .map(code => {
        const metadata = speciesMetadata[code];
        // Species metadata structure: { "code": { "en": "Name", "de": "Name" } }
        const name = metadata?.[locale] ||
                     metadata?.en ||
                     code.charAt(0).toUpperCase() + code.slice(1);

        return { code, name };
      });
  }

  /**
   * Get available recipes for a specific package.
   * Delegates to the engine to retrieve recipe metadata with localized display names.
   *
   * @param {string} packageCode - Package identifier (e.g., "human-de")
   * @param {string} [locale='en'] - Locale for display names
   * @returns {Array<{id: string, displayName: string}>} Array of recipe objects
   * @example
   * const recipes = dataManager.getRecipes('human-de', 'de');
   * // Returns: [{ id: 'full_name', displayName: 'Vollständiger Name' }, ...]
   */
  getRecipes(packageCode, locale = 'en') {
    return this.engine.getAvailableRecipes(packageCode, locale);
  }

  /**
   * Get available catalogs (categories) for a package.
   * Catalogs are collections of name items (e.g., "names", "settlements", "taverns").
   * Hidden catalogs are filtered out from the results.
   *
   * @param {string} packageCode - Package identifier (e.g., "human-de")
   * @param {string} [locale='en'] - Locale for display names
   * @returns {Array<{code: string, name: string}>} Array of catalog objects with code and localized name
   * @example
   * const catalogs = dataManager.getCatalogs('human-de', 'de');
   * // Returns: [{ code: 'names', name: 'Namen' }, { code: 'settlements', name: 'Siedlungen' }]
   */
  getCatalogs(packageCode, locale = 'en') {
    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.catalogs) {
      return [];
    }

    // Get the default language from the package
    const defaultLang = pkg.data.package?.languages?.[0] || 'en';

    return Object.keys(pkg.data.catalogs)
      .filter(catalogKey => !pkg.data.catalogs[catalogKey].hidden)
      .map(catalogKey => {
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
   * Capitalize a catalog key for display when no localized name is available.
   * Converts underscores to spaces and capitalizes each word.
   *
   * @param {string} catalogKey - The catalog key (e.g., "first_names")
   * @returns {string} Capitalized name (e.g., "First Names")
   * @private
   */
  _capitalizeCatalogName(catalogKey) {
    return catalogKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get the global engine instance used for name generation.
   *
   * @returns {Engine} The Engine instance
   */
  getEngine() {
    return this.engine;
  }

  /**
   * Get a loaded package by its code.
   *
   * @param {string} packageCode - Package identifier (e.g., "human-de")
   * @returns {Object|undefined} Package object with data, code, species, and categories, or undefined if not found
   */
  getPackage(packageCode) {
    return this.packages.get(packageCode);
  }

  /**
   * Get all loaded package codes.
   *
   * @returns {string[]} Array of package codes (e.g., ["human-de", "human-en", "elf-de"])
   */
  getLoadedPackages() {
    return Array.from(this.packages.keys());
  }

  /**
   * Get the raw index data loaded from index.json.
   * Contains species metadata, locale configuration, and package definitions.
   *
   * @returns {Object|null} Index data object or null if not loaded
   */
  getIndexData() {
    return this.indexData;
  }

  /**
   * Get species metadata from the index.
   * Contains localized display names for all species.
   *
   * @returns {Object} Species metadata object (e.g., { human: { en: "Human", de: "Mensch" } })
   */
  getSpeciesMetadata() {
    return this.indexData?.species || {};
  }

  /**
   * Get locale configuration from the index.
   * Contains default locale and fallback mappings.
   *
   * @returns {Object} Locales config (e.g., { default: "en", fallbacks: { de: "en" } })
   */
  getLocalesConfig() {
    return this.indexData?.locales || { default: 'en', fallbacks: {} };
  }

  // ============================================================
  // V4.0.1 Extensions: Vocab & Collections
  // ============================================================

  /**
   * Get vocabulary definitions for a package (v4.0.1 feature).
   * Vocab provides localized translations for tags and other metadata.
   *
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @returns {Object|null} Vocab object with fields and icons, or null if not available
   * @example
   * const vocab = dataManager.getVocab('human-de');
   * // Returns: { fields: { type: { values: { noble: { de: "Adelig", en: "Noble" } } } }, icons: { noble: "crown" } }
   */
  getVocab(packageCode) {
    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.vocab) {
      return null;
    }
    return pkg.data.vocab;
  }

  /**
   * Get a localized translation for a tag from the package vocabulary.
   * Looks up the tag in the specified vocab field and returns the translation for the given language.
   *
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @param {string} tag - Tag name to translate (e.g., "upscale_inn", "noble")
   * @param {string} lang - Language code for the translation (e.g., "de", "en")
   * @param {string} [fieldName='type'] - Field name in vocab to search (default: "type")
   * @returns {string|null} Translated tag label, or null if not found
   * @example
   * const label = dataManager.getVocabTranslation('tavern-de', 'upscale_inn', 'de', 'type');
   * // Returns: "Gehobenes Wirtshaus"
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
   * Get all translations for a tag across all available languages.
   * Returns the complete translation object for the tag.
   *
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @param {string} tag - Tag name to translate (e.g., "noble")
   * @param {string} [fieldName='type'] - Field name in vocab to search
   * @returns {Object|null} Object mapping language codes to translations, or null if not found
   * @example
   * const translations = dataManager.getVocabTranslations('human-de', 'noble', 'type');
   * // Returns: { de: "Adelig", en: "Noble" }
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
   * Get the icon associated with a tag from the package vocabulary.
   * Icons can be emojis or icon tokens used for UI display.
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @param {string} tag - Tag name (e.g., "upscale_inn")
   * @returns {string|null} Icon string (emoji or icon token), or null if not defined
   * @example
   * const icon = dataManager.getVocabIcon('tavern-de', 'upscale_inn');
   * // Returns: "fa-star" or an emoji like "star"
   */
  getVocabIcon(packageCode, tag) {
    const vocab = this.getVocab(packageCode);
    if (!vocab || !vocab.icons) {
      return null;
    }

    return vocab.icons[tag] || null;
  }

  /**
   * Get all collections defined in a package (v4.0.1 feature).
   * Collections are preset queries that define catalog + filter combinations.
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @returns {Array<Object>} Array of collection objects with key, displayName, and query
   * @example
   * const collections = dataManager.getCollections('tavern-de');
   * // Returns: [{ key: "upscale", displayName: { de: "Gehobene Tavernen" }, query: { category: "taverns", tags: ["upscale"] } }]
   */
  getCollections(packageCode) {
    const pkg = this.packages.get(packageCode);
    if (!pkg || !pkg.data.collections) {
      return [];
    }
    return pkg.data.collections;
  }

  /**
   * Get a specific collection by its key.
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @param {string} collectionKey - Collection key (e.g., "upscale")
   * @returns {Object|null} Collection object, or null if not found
   */
  getCollection(packageCode, collectionKey) {
    const collections = this.getCollections(packageCode);
    return collections.find(c => c.key === collectionKey) || null;
  }

  /**
   * Get catalog items filtered by a collection's query criteria.
   * Applies the collection's tag filters and limit to return matching items.
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @param {string} collectionKey - Collection key (e.g., "upscale")
   * @returns {Array<Object>} Array of catalog items matching the collection query
   * @example
   * const items = dataManager.getItemsByCollection('tavern-de', 'upscale');
   * // Returns items from 'taverns' catalog that have the 'upscale' tag
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
   * Get all collections that query a specific catalog.
   * Useful for finding available preset filters for a catalog.
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @param {string} catalogKey - Catalog key (e.g., "taverns")
   * @returns {Array<Object>} Array of collections that target this catalog
   * @example
   * const collections = dataManager.getCollectionsForCatalog('tavern-de', 'taverns');
   * // Returns all collections that filter the 'taverns' catalog
   */
  getCollectionsForCatalog(packageCode, catalogKey) {
    const collections = this.getCollections(packageCode);
    return collections.filter(c => c.query?.category === catalogKey);
  }

  /**
   * Check if a package has vocabulary support (v4.0.1+ feature).
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @returns {boolean} True if the package has vocab definitions
   */
  hasVocabSupport(packageCode) {
    const pkg = this.packages.get(packageCode);
    return !!(pkg && pkg.data.vocab);
  }

  /**
   * Check if a package has collections support (v4.0.1+ feature).
   *
   * @param {string} packageCode - Package code (e.g., "tavern-de")
   * @returns {boolean} True if the package has at least one collection defined
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
   * Get the file version of a package data file.
   * The fileVersion indicates the content version, separate from the format version.
   *
   * @param {string} packageCode - Package code (e.g., "human-de")
   * @returns {string|null} File version string (e.g., "1.2.0"), or null if not specified
   */
  getFileVersion(packageCode) {
    const pkg = this.packages.get(packageCode);
    return pkg?.data?.fileVersion || null;
  }
}

// Global instance
let globalDataManager = null;

/**
 * Get or create the global DataManager singleton instance.
 * The DataManager is shared across all components to ensure consistent data access.
 *
 * @returns {DataManager} The global DataManager instance
 * @example
 * const dataManager = getGlobalDataManager();
 * await dataManager.initializeData();
 */
export function getGlobalDataManager() {
  if (!globalDataManager) {
    globalDataManager = new DataManager();
  }
  return globalDataManager;
}
