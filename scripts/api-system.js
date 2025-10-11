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
      throw new Error("Generator not available - ensure nomina-names module is initialized");
    }
    await this.generator.initialize();
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

    logDebug("Generating name with options:", options);

    // Fire beforeGenerate hook
    this._fireHook('names.beforeGenerate', { options });

    const packageCode = `${species}-${language}`;

    try {
      const result = await this.generator.generatePersonName(packageCode, {
        locale: language,
        n: count,
        gender,
        components,
        format,
        allowDuplicates: false
      });

      // Fire afterGenerate hook
      this._fireHook('names.afterGenerate', { options, result });

      // Return single name or array
      if (count === 1 && result.suggestions && result.suggestions.length > 0) {
        return result.suggestions[0].text;
      }

      return result.suggestions ? result.suggestions.map(s => s.text) : [];

    } catch (error) {
      logError("Failed to generate name:", error);
      return count === 1 ? '' : [];
    }
  }

  /**
   * Generate multiple names
   * @param {Object} options - Same as generateName
   * @returns {Promise<Array<string>>} Array of generated names
   */
  async generateNames(options = {}) {
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
    return await this.generator.getAvailableSpecies(language);
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
    const packageCode = `${species}-${language}`;
    return await this.generator.getAvailableCatalogs(packageCode);
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

    const packageCode = `${species}-${language}`;

    try {
      const result = await this.generator.generateFromCatalog(packageCode, catalog, {
        locale: language,
        n: count,
        tags,
        allowDuplicates: false
      });

      return result.suggestions ? result.suggestions.map(s => s.text) : [];
    } catch (error) {
      logError("Failed to generate from catalog:", error);
      return [];
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
    if (this.hooks[hookName]) {
      for (const callback of this.hooks[hookName]) {
        try {
          callback(data);
        } catch (error) {
          logError(`Error in hook ${hookName}:`, error);
        }
      }
    }
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
    await this._ensureSetup();

    if (!options || !options.code) {
      throw new Error('Package registration requires code and data');
    }

    if (!options.data || !options.data.format) {
      throw new Error('Package data must follow JSON Format 4.0.0/4.0.1');
    }

    const packageCode = options.code;
    const data = options.data;

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

    try {
      // Register with data manager
      await this.dataManager.registerPackage(packageCode, data);

      logInfo(`Successfully registered package: ${packageCode}`);

      // Fire hook
      this._fireHook('names.dataLoaded', { packageCode, data });

    } catch (error) {
      logError(`Failed to register package ${packageCode}:`, error);
      throw error;
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
}

// Create and export global instance
export const NamesAPI = new NamesModuleAPI();

// Also export as default
export default NamesAPI;
