/**
 * Names Module API - Public interface for other modules
 */

import { ensureGlobalNamesData, getGlobalNamesData } from './core/data-manager.js';
import { NamesGeneratorApp } from './apps/generator-app.js';
import { NamesPickerApp } from './apps/picker-app.js';
import { EmergencyNamesApp } from './apps/emergency-app.js';
import { hasNamesGeneratorPermission } from './utils/permissions.js';
import { getSupportedGenders, GENDER_SYMBOLS } from './shared/constants.js';

class NamesModuleAPI {
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
   * Generate a single name
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated name
   */
  async generateName(options = {}) {
    const {
      language = 'de',
      species = 'human',
      gender = 'male',
      components = ['firstname', 'surname'],
      format = '{firstname} {surname}',
      useCustomData = true
    } = options;

    // Fire beforeGenerate hook
    this._fireHook('names.beforeGenerate', { options });

    const dataManager = ensureGlobalNamesData();
    await dataManager.initializeData();

    // Include custom data sources if requested
    if (useCustomData) {
      await this._loadCustomDataSources(language, species);
    }

    const result = await this._performNameGeneration(language, species, gender, components, format);
    
    // Fire afterGenerate hook
    this._fireHook('names.afterGenerate', { options, result });

    return result;
  }

  /**
   * Generate multiple names
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of generated names
   */
  async generateNames(options = {}) {
    const { count = 5, ...otherOptions } = options;
    const names = [];

    for (let i = 0; i < count; i++) {
      const name = await this.generateName(otherOptions);
      if (name) names.push(name);
    }

    return names;
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
   * Get available species
   * @returns {Array} Array of species objects
   */
  getAvailableSpecies() {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return [];
    return dataManager.getLocalizedSpecies();
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
    return new NamesGeneratorApp().render(true);
  }

  /**
   * Show names picker UI for an actor
   * @param {Actor} actor - Actor to pick names for
   * @returns {Application} Picker app instance
   */
  showPicker(actor) {
    return new NamesPickerApp({ actor }).render(true);
  }

  /**
   * Show emergency names UI
   * @returns {Application} Emergency app instance
   */
  showEmergencyNames() {
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
      throw new Error('Species registration requires species code and displayName');
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

    console.log(`Names Module: Registered species '${species}' from module '${moduleId}'`);
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
      throw new Error('Name data registration requires language, species, category, and data');
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

    console.log(`Names Module: Registered name data '${dataKey}' from module '${moduleId}'`);
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
  }

  /**
   * Remove all extensions from a specific module
   * @param {string} moduleId - ID of the module to remove extensions for
   */
  unregisterModule(moduleId) {
    // Remove extensions
    for (const [key, extension] of this.registeredExtensions.entries()) {
      if (extension.moduleId === moduleId) {
        this.registeredExtensions.delete(key);
      }
    }

    // Remove custom data sources
    for (const [key, source] of this.customDataSources.entries()) {
      if (source.moduleId === moduleId) {
        this.customDataSources.delete(key);
      }
    }

    console.log(`Names Module: Unregistered all extensions from module '${moduleId}'`);
  }

  /**
   * Get all registered extensions
   * @param {string} type - Optional type filter ('species', 'namedata')
   * @returns {Array} Array of extension objects
   */
  getRegisteredExtensions(type = null) {
    const extensions = Array.from(this.registeredExtensions.values());
    return type ? extensions.filter(ext => ext.type === type) : extensions;
  }

  /**
   * Internal methods
   */

  async _loadCustomDataSources(language, species) {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return;

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
      }
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

    // Merge authors
    if (custom.authors) {
      merged.authors = [...(merged.authors || []), ...custom.authors];
    }

    return merged;
  }

  async _performNameGeneration(language, species, gender, components, format) {
    const dataManager = getGlobalNamesData();
    if (!dataManager) return null;

    // Ensure data is loaded
    for (const component of components) {
      const category = component === 'firstname' ? gender : component;
      await dataManager.ensureDataLoaded(language, species, category);
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
        return null;
    }
  }

  _getRandomFromData(dataManager, language, species, category) {
    const key = `${language}.${species}.${category}`;
    const data = dataManager.getData(key);
    
    if (!data?.names || data.names.length === 0) return null;
    return data.names[Math.floor(Math.random() * data.names.length)];
  }

  _getRandomFromGenderedData(dataManager, language, species, category, gender) {
    const key = `${language}.${species}.${category}`;
    const data = dataManager.getData(key);

    if (data?.names && typeof data.names === 'object' && data.names[gender]) {
      const genderNames = data.names[gender];
      if (genderNames.length === 0) return null;
      return genderNames[Math.floor(Math.random() * genderNames.length)];
    }

    if (data?.names && Array.isArray(data.names)) {
      return data.names[Math.floor(Math.random() * data.names.length)];
    }

    return null;
  }

  _generateTitle(dataManager, language, species, gender) {
    const titleData = dataManager.getData(`${language}.${species}.titles`);
    if (!titleData?.titles) return null;

    const genderTitles = titleData.titles[gender];
    if (!genderTitles || genderTitles.length === 0) {
      // Fallback to male titles for nonbinary if available
      if (gender === 'nonbinary' && titleData.titles.male) {
        const maleTitles = titleData.titles.male;
        const selectedTitle = maleTitles[Math.floor(Math.random() * maleTitles.length)];
        return selectedTitle.name || selectedTitle;
      }
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
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Names Module: Error in hook '${hookName}':`, error);
      }
    }
  }
}

// Create and export the API instance
export const NamesAPI = new NamesModuleAPI();

// Example usage for third-party modules:
/*
// In a third-party module's init hook:
Hooks.once('init', () => {
  // Register a new species
  game.modules.get('names').api.registerSpecies('my-module', {
    species: 'dragon',
    displayName: 'Drache',
    languages: ['de', 'en'],
    keywords: ['dragon', 'drache', 'wyrm'],
    data: {
      male: {
        names: ['Smaug', 'Ancalagon', 'Glaurung'],
        authors: [{ name: 'My Module', url: 'https://example.com' }]
      },
      female: {
        names: ['Scatha', 'Chrysophylax', 'Tiamat'],
        authors: [{ name: 'My Module', url: 'https://example.com' }]
      },
      surnames: {
        names: ['der Goldene', 'der Mächtige', 'Schatzwächter'],
        authors: [{ name: 'My Module', url: 'https://example.com' }]
      }
    }
  });

  // Register additional data for existing species
  game.modules.get('names').api.registerNameData('my-module', {
    language: 'de',
    species: 'human',
    category: 'titles',
    displayName: 'Adelige Titel',
    data: {
      titles: {
        male: [
          { name: 'Herzog von Rabenstein', template: 'Herzog {preposition} {settlement}', preposition: 'von' }
        ],
        female: [
          { name: 'Herzogin von Rabenstein', template: 'Herzogin {preposition} {settlement}', preposition: 'von' }
        ]
      },
      authors: [{ name: 'My Module', url: 'https://example.com' }]
    }
  });

  // Register hook listeners
  game.modules.get('names').api.registerHook('names.afterGenerate', (data) => {
    console.log('Name generated:', data.result);
  });
});

// Generate names programmatically:
const name = await game.modules.get('names').api.generateName({
  language: 'de',
  species: 'dragon',
  gender: 'male',
  components: ['firstname', 'surname'],
  format: '{firstname} {surname}'
});

const multipleNames = await game.modules.get('names').api.generateNames({
  count: 5,
  language: 'de',
  species: 'human',
  gender: 'female'
});
*/