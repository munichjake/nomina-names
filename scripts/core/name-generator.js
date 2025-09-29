/**
 * Name Generator - Enhanced generator for names with 3.0.0 format support
 */

import { ensureGlobalNamesData } from './data-manager.js';
import { isCategorizedContent, getSubcategories, getSupportedGenders, DEFAULT_NAME_FORMAT } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

/**
 * Unified Name Generator - Handles all types of name generation
 */
export class NameGenerator {
  constructor(dataSource = null) {
    this.dataSource = dataSource; // Unified DataManager instance
    this.dataManager = null; // For new 3.0.0 format support
  }

  /**
   * Initialize with global data manager for 3.0.0 support
   */
  async initialize() {
    if (!this.dataManager) {
      this.dataManager = ensureGlobalNamesData();
      await this.dataManager.initializeData();
    }
  }

  /**
   * Main generation method - handles all types of name generation
   */
  async generateName(options = {}) {
    const {
      language = 'de',
      species = 'human',
      category = 'names',
      gender = 'male',
      subcategory = null,
      subcategories = null,
      components = ['firstname', 'surname'],
      format = DEFAULT_NAME_FORMAT,
      count = 1,
      filters = null,
      returnWithMetadata = false
    } = options;

    logDebug("Generating names with options:", options);

    // Validate species availability
    if (!this._isSpeciesAvailable(species, language)) {
      throw new Error(`Species "${species}" not available for language "${language}"`);
    }

    const results = [];

    for (let i = 0; i < count; i++) {
      let result;

      try {
        // Route to appropriate generation method
        if (category === 'names') {
          result = await this._generatePersonName(language, species, gender, components, format, filters, returnWithMetadata);
        } else if (isCategorizedContent(category)) {
          result = await this._generateCategorizedContent(language, species, category, subcategory, subcategories, filters, returnWithMetadata);
        } else {
          result = await this._generateSimpleContent(language, species, category);
        }

        if (result) {
          results.push(result);
        }
      } catch (error) {
        logWarn(`Failed to generate name ${i + 1}/${count}:`, error);
        // Continue with next generation instead of failing completely
      }
    }

    if (results.length === 0) {
      throw new Error(`No names could be generated for ${species}/${category}`);
    }

    logInfo(`Generated ${results.length}/${count} names successfully`);
    return count === 1 ? results[0] : results;
  }

  /**
   * Generate a person name with multiple components
   */
  async _generatePersonName(language, species, gender, components, format) {
    logDebug(`Generating person name: ${species}/${language}/${gender}, components:`, components);

    // Validate gender
    const supportedGenders = getSupportedGenders();
    if (!supportedGenders.includes(gender)) {
      throw new Error(`Unsupported gender: ${gender}`);
    }

    // Data availability will be checked during component generation

    // Generate each component
    const nameComponents = {};
    let selectedSettlement = null;

    // Pre-select settlement if titles are needed
    if (components.includes('title')) {
      selectedSettlement = await this._selectRandomSettlement(language, species);
    }

    logDebug(`Generating components: ${components.join(', ')} for ${language}.${species}.${gender}`);

    for (const component of components) {
      try {
        logDebug(`Attempting to generate component: ${component}`);
        const part = await this._generateNameComponent(language, species, gender, component, selectedSettlement);
        logDebug(`Generated component ${component} result:`, part);
        if (part) {
          nameComponents[component] = part;
          logDebug(`Successfully generated ${component}: ${part}`);
        } else {
          logDebug(`Component ${component} generated null/empty result`);
        }
      } catch (error) {
        logWarn(`Failed to generate component ${component}:`, error);
        // Continue with next component
      }
    }

    if (Object.keys(nameComponents).length === 0) {
      throw new Error("No name components could be generated");
    }

    const formattedName = this._formatName(format, nameComponents);
    logDebug(`Formatted name: ${formattedName}`);
    return formattedName;
  }

  /**
   * Check if species is available for the given language
   */
  _isSpeciesAvailable(species, language) {
    if (!this.dataSource) return false;

    // First check if the species is registered at all
    if (this.dataSource.availableSpecies && !this.dataSource.availableSpecies.has(species)) {
      return false;
    }

    // For API species, check if they have data for this language
    if (this.dataSource.apiSpecies && this.dataSource.apiSpecies.has(species)) {
      const apiSpeciesData = this.dataSource.apiSpecies.get(species);
      return apiSpeciesData.languages && apiSpeciesData.languages.includes(language);
    }

    // Check if we have any data for this species and language combination (traditional format)
    return this.dataSource.hasData(language, species, 'names') ||
           this.dataSource.hasData(language, species, 'male') ||
           this.dataSource.hasData(language, species, 'female');
  }

  /**
   * Generate categorized content (books, ships, shops, taverns) - 3.0.1 format with metadata support
   */
  async _generateCategorizedContent(language, species, category, specificSubcategory = null, availableSubcategories = null, filters = null, returnWithMetadata = false) {
    logDebug(`Generating categorized content: ${species}/${language}/${category}/${specificSubcategory || 'random'}`);

    // Get available subcategories - use provided list or fetch from data
    let subcategoriesToUse;
    if (availableSubcategories && Array.isArray(availableSubcategories) && availableSubcategories.length > 0) {
      subcategoriesToUse = availableSubcategories;
      logDebug(`Using provided subcategories:`, subcategoriesToUse);
    } else {
      subcategoriesToUse = this._getAvailableSubcategories(language, species, category);
      logDebug(`Fetched available subcategories:`, subcategoriesToUse);
    }

    if (subcategoriesToUse.length === 0) {
      throw new Error(`No subcategories available for ${language}.${species}.${category}`);
    }

    // Select subcategory
    let subcategory = specificSubcategory;
    if (!subcategory || !subcategoriesToUse.includes(subcategory)) {
      // For multiple subcategories, randomly select one each time
      subcategory = subcategoriesToUse[Math.floor(Math.random() * subcategoriesToUse.length)];
      logDebug(`Selected random subcategory: ${subcategory} from ${subcategoriesToUse.length} options`);
    } else {
      logDebug(`Using specified subcategory: ${subcategory}`);
    }

    // Get data for the subcategory using DataManager with filters
    const subcategoryData = this._getSubcategoryData(language, species, category, subcategory, { filters });
    logDebug(`Subcategory data for ${subcategory}:`, subcategoryData);

    if (!subcategoryData) {
      throw new Error(`No data available for subcategory ${subcategory}`);
    }

    // The DataManager returns the array for the specific language (potentially filtered)
    if (!Array.isArray(subcategoryData) || subcategoryData.length === 0) {
      logDebug(`No items match the criteria for subcategory ${subcategory}`);
      throw new Error(`No items available for subcategory ${subcategory}${filters ? ' matching the specified filters' : ''}`);
    }

    // Select random item
    const entry = subcategoryData[Math.floor(Math.random() * subcategoryData.length)];

    const entryName = this.dataSource.extractEntryName(entry);

    if (returnWithMetadata) {
      // Return entry with metadata if requested
      return {
        name: entryName,
        subcategory: subcategory,
        meta: this.dataSource.extractEntryMetadata(entry)
      };
    } else {
      // For categorized content, always return with subcategory info for display purposes
      if (availableSubcategories && availableSubcategories.length > 1) {
        logDebug(`Generated categorized content from ${category}.${subcategory}: ${entryName}`);
        return {
          name: entryName,
          subcategory: subcategory
        };
      } else {
        // Return just the name for backward compatibility when only one subcategory
        logDebug(`Generated categorized content from ${category}.${subcategory}: ${entryName}`);
        return entryName;
      }
    }
  }

  /**
   * Generate simple content (settlements, single categories) - 3.0.0 format only
   */
  async _generateSimpleContent(language, species, category) {
    logDebug(`Generating simple content: ${species}/${language}/${category} - NOT IMPLEMENTED FOR 3.0.0 FORMAT`);
    throw new Error(`Simple content generation not implemented for category ${category} in 3.0.0 format`);
  }

  /**
   * Generate individual name component
   */
  async _generateNameComponent(language, species, gender, component, settlement = null) {
    switch (component) {
      case 'firstname':
        return await this._selectRandomFromSubcategory(language, species, 'names', gender);

      case 'surname':
        return await this._selectRandomFromSubcategory(language, species, 'names', 'surnames');

      case 'title':
        return await this._generateTitle(language, species, gender, settlement);

      case 'nickname':
        const nickname = await this._selectRandomFromSubcategory(language, species, 'names', 'nicknames');
        return nickname ? `"${nickname}"` : null;

      default:
        logWarn(`Unknown name component: ${component}`);
        return null;
    }
  }

  /**
   * Select random entry from a subcategory in the new consolidated format
   */
  async _selectRandomFromSubcategory(language, species, category, subcategory) {
    // For gender subcategories (male, female, nonbinary), look in firstnames
    if (['male', 'female', 'nonbinary'].includes(subcategory)) {
      const firstnamesData = this.dataSource.getSubcategoryData(language, species, 'names', 'firstnames');
      if (firstnamesData && firstnamesData[subcategory] && Array.isArray(firstnamesData[subcategory])) {
        const genderNames = firstnamesData[subcategory];
        const randomIndex = Math.floor(Math.random() * genderNames.length);
        return genderNames[randomIndex];
      }
    }

    // Try to get subcategory data directly from consolidated format
    const subcatData = this.dataSource.getSubcategoryData(language, species, category, subcategory);

    if (subcatData && Array.isArray(subcatData) && subcatData.length > 0) {
      const randomIndex = Math.floor(Math.random() * subcatData.length);
      return subcatData[randomIndex];
    }

    // For gender-specific structure in other subcategories
    if (subcatData && typeof subcatData === 'object') {
      const genders = ['male', 'female', 'nonbinary'];
      for (const gender of genders) {
        if (subcatData[gender] && Array.isArray(subcatData[gender]) && subcatData[gender].length > 0) {
          const randomIndex = Math.floor(Math.random() * subcatData[gender].length);
          return subcatData[gender][randomIndex];
        }
      }
    }

    // Fallback: try to get data from traditional format
    const data = await this._getData(language, species, subcategory);
    if (data && data.names && Array.isArray(data.names) && data.names.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.names.length);
      return data.names[randomIndex];
    }

    throw new Error(`No names available for ${category}/${subcategory}`);
  }

  /**
   * Get data for a specific language, species, and category combination
   * @param {string} key - Data key in format "language.species.category"
   * @returns {Promise<Object|null>} Data object or null if not found
   */
  async _getData(key) {
    const parts = key.split('.');
    if (parts.length !== 3) return null;

    const [language, species, category] = parts;

    // Ensure data is loaded
    await this.dataSource.ensureDataLoaded(language, species, category);

    return this.dataSource.getData(key);
  }

  /**
   * Generate a title with optional settlement
   */
  async _generateTitle(language, species, gender, settlement = null) {
    // Try to get titles from consolidated 'names' format first
    const titlesSubcatData = this.dataSource.getSubcategoryData(language, species, 'names', 'titles');
    logDebug(`getSubcategoryData result for titles:`, titlesSubcatData);

    let titleData;
    if (titlesSubcatData) {
      // Handle the complex nested structure from 3.1.0+ format
      // titlesSubcatData is the raw entries array: [{male: [...], female: [...], nonbinary: [...]}]
      if (Array.isArray(titlesSubcatData) && titlesSubcatData.length > 0) {
        const genderData = titlesSubcatData[0]; // Get the first (and likely only) gender structure
        logDebug(`Gender data structure:`, genderData);
        titleData = { titles: genderData };
      } else {
        titleData = { titles: titlesSubcatData };
      }
    } else {
      // Fallback to traditional format
      titleData = await this._getData(`${language}.${species}.titles`);
    }

    logDebug(`Final titleData:`, titleData);

    if (!titleData?.titles) {
      logDebug(`No title data found for ${language}.${species}`);
      return null;
    }

    const genderTitles = titleData.titles[gender];
    if (!genderTitles || genderTitles.length === 0) {
      // Fallback to male titles for nonbinary
      if (gender === 'nonbinary' && titleData.titles.male) {
        const maleTitles = titleData.titles.male;
        const selectedTitle = maleTitles[Math.floor(Math.random() * maleTitles.length)];
        logDebug("Using male title as fallback for nonbinary");
        return this._formatTitleWithSettlement(selectedTitle, settlement, language, species);
      }
      logDebug(`No ${gender} titles found for ${language}.${species}`);
      return null;
    }

    const selectedTitle = genderTitles[Math.floor(Math.random() * genderTitles.length)];
    return this._formatTitleWithSettlement(selectedTitle, settlement, language, species);
  }

  /**
   * Format title with settlement if template is available
   */
  _formatTitleWithSettlement(title, settlement, language, species) {
    if (!settlement || !title.template) {
      return title.name || title;
    }

    let article = title.preposition || 'von';

    const formattedTitle = title.template
      .replace('{preposition}', article)
      .replace('{settlement}', settlement.name || settlement);

    logDebug("Formatted title with settlement:", formattedTitle);
    return formattedTitle;
  }

  /**
   * Generate a settlement name
   */
  async _generateSettlement(language, species) {
    const result = await this._getRandomFromData(language, species, 'settlements');
    if (!result) {
      throw new Error(`No settlement data for ${language}.${species}`);
    }
    return result.name || result;
  }

  /**
   * Select a random settlement for title generation
   */
  async _selectRandomSettlement(language, species) {
    try {
      return await this._getRandomFromData(language, species, 'settlements');
    } catch (error) {
      logDebug("No settlement data available for title generation");
    }
    return null;
  }

  /**
   * Get random item from simple data array
   */
  async _getRandomFromData(language, species, category) {
    const key = `${language}.${species}.${category}`;
    const data = await this._getData(key);

    if (!data) {
      logDebug(`No data found for ${key}`);
      return null;
    }

    // Handle different data structures
    let namesList = this._extractNamesArray(data, category, language);

    if (!namesList || namesList.length === 0) {
      logDebug(`No valid names array found for ${key}`);
      return null;
    }

    const selectedName = namesList[Math.floor(Math.random() * namesList.length)];
    logDebug(`Selected from ${key}: ${selectedName}`);
    return selectedName;
  }

  /**
   * Get random item from gendered data
   */
  async _getRandomFromGenderedData(language, species, category, gender) {
    const key = `${language}.${species}.${category}`;
    const data = await this._getData(key);

    if (!data) {
      logDebug(`No data found for ${key}`);
      return null;
    }

    // Handle different data structures
    let genderNames = this._extractGenderedNames(data, category, gender);

    if (!genderNames || genderNames.length === 0) {
      logDebug(`No ${gender} names found for ${key}`);
      return null;
    }

    const selectedName = genderNames[Math.floor(Math.random() * genderNames.length)];
    logDebug(`Selected ${gender} name from ${key}: ${selectedName}`);
    return selectedName;
  }

  /**
   * Extract names array from data structure
   */
  _extractNamesArray(data, category, language) {
    // Handle 3.0+ format with subcategories structure
    if (data?.data?.[category]?.subcategories) {
      const subcategories = data.data[category].subcategories;
      const allEntries = [];

      // Collect all entries from all subcategories for the specified language
      for (const subcategory of subcategories) {
        if (subcategory.entries && subcategory.entries[language]) {
          const entries = subcategory.entries[language];
          if (Array.isArray(entries)) {
            allEntries.push(...entries);
          }
        }
      }

      if (allEntries.length > 0) {
        return allEntries;
      }
    }

    // Legacy format support - Traditional structure: data.names
    if (data.names && Array.isArray(data.names) && data.names.length > 0) {
      return data.names;
    }
    // API structure: data might be a direct array
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    // API structure: check for gender-specific arrays
    if (['male', 'female', 'nonbinary'].includes(category) && data[category] && Array.isArray(data[category])) {
      return data[category];
    }
    // API structure: nested gender-component structure
    if (['male', 'female', 'nonbinary'].includes(category) && data[category]?.firstname) {
      return data[category].firstname;
    }
    // API structure: check for other category arrays
    if (data[category] && Array.isArray(data[category])) {
      return data[category];
    }
    // For surnames, check in any gender section
    if (category === 'surnames') {
      for (const gender of ['male', 'female', 'nonbinary']) {
        if (data[gender]?.surname && Array.isArray(data[gender].surname)) {
          return data[gender].surname;
        }
      }
    }

    return null;
  }

  /**
   * Extract gendered names from data structure
   */
  _extractGenderedNames(data, category, gender) {
    // Traditional structure: data.names[gender]
    if (data?.names && typeof data.names === 'object' && data.names[gender]) {
      return data.names[gender];
    }
    // Traditional structure: data.names as array (ungendered)
    if (data?.names && Array.isArray(data.names)) {
      return data.names;
    }
    // API structure: data[gender] directly
    if (data[gender] && Array.isArray(data[gender])) {
      return data[gender];
    }
    // API structure: nested gender-category structure
    if (data[gender] && typeof data[gender] === 'object') {
      if (data[gender][category] && Array.isArray(data[gender][category])) {
        return data[gender][category];
      }
      // For general names, try common name fields
      if (data[gender].firstname && Array.isArray(data[gender].firstname)) {
        return data[gender].firstname;
      }
    }
    // API structure: data as direct array (ungendered)
    if (Array.isArray(data)) {
      return data;
    }

    return null;
  }

  /**
   * Get available subcategories for categorized content - 3.0.0 format only
   */
  _getAvailableSubcategories(language, species, category) {
    logDebug(`Getting subcategories for: ${language}.${species}.${category}`);

    if (!isCategorizedContent(category)) {
      logDebug(`Category ${category} is not categorized content`);
      return [];
    }

    if (!this.dataSource || !this.dataSource.getAvailableSubcategories) {
      logDebug('No DataManager or getAvailableSubcategories method available');
      return [];
    }

    const subcategories = this.dataSource.getAvailableSubcategories(language, species, category);
    logDebug(`DataManager returned subcategories:`, subcategories);

    if (subcategories && subcategories.length > 0) {
      // Convert to simple array if needed (for 3.0.0 format compatibility)
      const keys = subcategories.map(sub => typeof sub === 'object' ? sub.key : sub);
      logDebug(`Converted to keys:`, keys);
      return keys;
    }

    logDebug('No subcategories found');
    return [];
  }

  /**
   * Get data from a specific subcategory - 3.0.0 format only
   */
  _getSubcategoryData(language, species, category, subcategory, options = {}) {
    logDebug(`Getting subcategory data for: ${language}.${species}.${category}.${subcategory}`, options);

    if (!isCategorizedContent(category)) {
      logDebug(`Category ${category} is not categorized content`);
      return null;
    }

    if (!this.dataSource || !this.dataSource.getSubcategoryData) {
      logDebug('No DataManager or getSubcategoryData method available');
      return null;
    }

    const data = this.dataSource.getSubcategoryData(language, species, category, subcategory, options);
    logDebug(`DataManager returned data:`, data);
    return data;
  }

  /**
   * Format name components into final name
   */
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

    // Clean up formatting
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

  /**
   * Ensure data is available for generation
   */
  async _ensureDataAvailable(language, species, components, gender = null) {
    if (!this.dataSource) {
      logWarn("No data source available for name generation");
      return false;
    }

    let allDataAvailable = true;

    for (const component of components) {
      const category = component === 'firstname' ? gender : component;
      if (!category) continue;

      try {
        if (this.dataSource.ensureDataLoaded) {
          const hasData = await this.dataSource.ensureDataLoaded(language, species, category);
          if (!hasData) {
            logWarn(`No data available for ${language}.${species}.${category}`);
            allDataAvailable = false;
          }
        }
      } catch (error) {
        logWarn(`Failed to ensure data for ${language}.${species}.${category}:`, error);
        allDataAvailable = false;
      }
    }

    return allDataAvailable;
  }

  /**
   * Get data through data source or species manager (with load-on-demand)
   */
  async _getData(key) {
    // Try data source first (DataManager or async data source)
    if (this.dataSource && this.dataSource.getData) {
      const data = await this.dataSource.getData(key);
      if (data) return data;
    }

    // Fallback to species manager with automatic load-on-demand
    const [language, species, category] = key.split('.');
    if (language && species && category) {
      return await this.speciesManager.getSpeciesData(species, language, category);
    }

    return null;
  }

  /**
   * Set data source (DataManager or compatible)
   */
  setDataSource(dataSource) {
    this.dataSource = dataSource;
    logDebug("Name generator data source updated");
  }

  /**
   * Generate a name using the new 3.0.0 format
   * @param {Object} options - Generation options for 3.0.0 format
   * @returns {Promise<string>} Generated name
   */
  async generateFrom3_0_Format(options = {}) {
    const {
      language = 'de',
      species = 'human',
      subcategory = 'firstnames',
      gender = 'male'
    } = options;

    await this.initialize();

    logDebug('Generating name from 3.0.0 format with options:', options);

    try {
      const subcategoryData = this.dataManager.getSubcategoryData(language, species, 'names', subcategory);

      if (!subcategoryData) {
        throw new Error(`No data found for ${language}.${species}.names.${subcategory}`);
      }

      // Handle different data structures
      if (Array.isArray(subcategoryData)) {
        // Simple array (like surnames, nicknames)
        const randomIndex = Math.floor(Math.random() * subcategoryData.length);
        return subcategoryData[randomIndex];
      } else if (typeof subcategoryData === 'object') {
        // Gender-specific entries (like firstnames)
        if (subcategoryData[gender] && Array.isArray(subcategoryData[gender])) {
          const genderEntries = subcategoryData[gender];
          const randomIndex = Math.floor(Math.random() * genderEntries.length);
          return genderEntries[randomIndex];
        } else {
          // Pick a random gender if specified gender not available
          const availableGenders = Object.keys(subcategoryData).filter(key => Array.isArray(subcategoryData[key]));
          if (availableGenders.length > 0) {
            const randomGender = availableGenders[Math.floor(Math.random() * availableGenders.length)];
            const genderEntries = subcategoryData[randomGender];
            const randomIndex = Math.floor(Math.random() * genderEntries.length);
            return genderEntries[randomIndex];
          }
        }
      }

      throw new Error(`Unable to generate name from data structure`);
    } catch (error) {
      logError('Error generating name from 3.0.0 format:', error);
      throw error;
    }
  }

  /**
   * Get available subcategories for a species using 3.0.0 format
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @returns {Promise<Array>} Array of available subcategories with display names
   */
  async getAvailable3_0_Subcategories(language, species) {
    await this.initialize();
    return this.dataManager.getAvailableSubcategories(language, species, 'names');
  }
}