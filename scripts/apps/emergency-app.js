/**
 * Emergency Names App - Quick NPC name generator
 * Updated to exclude categorized content (books, ships, shops, taverns)
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState, copyToClipboard, fallbackCopyToClipboard } from '../utils/ui-helpers.js';
import { TEMPLATE_PATHS, CSS_CLASSES, GENDER_SYMBOLS, getSupportedGenders, isGeneratorOnlyCategory } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { NamesAPI } from '../api-system.js';

export class EmergencyNamesApp extends Application {
  constructor(options = {}) {
    super(options);
    this.emergencyNames = [];
    this.availableSpecies = ['human', 'elf', 'dwarf', 'halfling', 'orc'];
    this._initialized = false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "emergency-names",
      title: game.i18n.localize("names.emergency.title") || "Schnelle NPC Namen",
      template: TEMPLATE_PATHS.emergency,
      width: 500,
      height: 720,
      resizable: false,
      classes: [CSS_CLASSES.emergencyApp]
    });
  }

  async getData() {
    // Ensure globalNamesData exists
    ensureGlobalNamesData();
    const globalNamesData = getGlobalNamesData();

    if (!globalNamesData) {
      logWarn("globalNamesData not available, using temporary instance");
      return {
        emergencyNames: this.emergencyNames,
        isLoading: false
      };
    }

    // Initialize data
    try {
      await globalNamesData.initializeData();
    } catch (error) {
      logWarn("Failed to initialize data", error);
    }

    return {
      emergencyNames: this.emergencyNames,
      isLoading: globalNamesData.isLoading || false
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.emergency-reroll-btn').off('click').on('click', this._onRerollNames.bind(this));
    html.find('.emergency-open-generator-btn').off('click').on('click', this._onOpenGenerator.bind(this));
    html.find('.emergency-name-pill').off('click').on('click', this._onCopyName.bind(this));

    this._initializeApp(html);
  }

  async _initializeApp(html) {
    // Prevent multiple initialization
    if (this._initialized) {
      logDebug("App already initialized, skipping");
      return;
    }

    try {
      const globalNamesData = getGlobalNamesData();

      if (globalNamesData && globalNamesData.isLoading) {
        logDebug("Data still loading, showing loading state");
        showLoadingState(html);
        await this._waitForLoadingComplete(html);
      } else {
        logDebug("Data ready, generating emergency names");
        await this._generateEmergencyNames();
      }

      this._initialized = true;
    } catch (error) {
      logError("Emergency app initialization failed", error);
      this._generateFallbackNames();
      this._updateNamesDisplay();
      this._initialized = true;
    }
  }

  async _waitForLoadingComplete(html) {
    try {
      const globalNamesData = getGlobalNamesData();
      if (globalNamesData && globalNamesData.loadingPromise) {
        await globalNamesData.loadingPromise;
      }
      
      hideLoadingState(html);
      await this._generateEmergencyNames();
    } catch (error) {
      logWarn("Loading failed, using fallback", error);
      this._generateFallbackNames();
      this._updateNamesDisplay();
    }
  }

  async _generateEmergencyNames() {
    logDebug("Generating emergency names...");
    
    try {
      const language = this._getFoundryLanguage();
      logDebug(`Using language: ${language}`);
      
      const names = [];
      const globalNamesData = getGlobalNamesData();
      
      // Check if data is loaded
      if (!globalNamesData || !globalNamesData.isLoaded) {
        logWarn("Data not loaded, using fallback names");
        this._generateFallbackNames();
        return;
      }

      // Determine available species (only those with traditional name data)
      const availableSpecies = this._getAvailableSpecies(language);
      logDebug("Available species:", availableSpecies);
      
      if (availableSpecies.length === 0) {
        logWarn("No species data available, using fallback");
        this._generateFallbackNames();
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 20; // Prevent infinite loops
      
      while (names.length < 6 && attempts < maxAttempts) {
        try {
          const species = availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
          const gender = this._getRandomGender();
          
          // Skip generator-only categories - emergency only uses traditional name generation
          if (isGeneratorOnlyCategory(gender)) {
            attempts++;
            continue;
          }
          
          const name = await this._generateSingleName(language, species, gender);
          if (name) {
            names.push({
              name: name,
              species: species,
              gender: gender,
              displaySpecies: this._getLocalizedSpecies(species)
            });
          }
          attempts++;
        } catch (error) {
          logWarn(`Failed to generate name (attempt ${attempts})`, error);
          attempts++;
        }
      }

      // Fallback if no names generated
      if (names.length === 0) {
        logWarn("No names generated, using fallback");
        this._generateFallbackNames();
      } else {
        this.emergencyNames = names;
        logInfo(`Generated ${names.length} emergency names`);
        this._updateNamesDisplay();
      }

    } catch (error) {
      logError("Emergency name generation failed", error);
      this._generateFallbackNames();
    }
  }

  _generateFallbackNames() {
    logDebug("Using fallback emergency names");
    const supportedGenders = getSupportedGenders();
    const globalNamesData = getGlobalNamesData();

    // Get enabled species from settings, or use defaults
    let enabledSpeciesCodes = ['human'];
    if (globalNamesData) {
      const enabledSpeciesList = globalNamesData.getLocalizedSpecies();
      if (enabledSpeciesList.length > 0) {
        enabledSpeciesCodes = enabledSpeciesList.map(s => s.code);
      }
    }

    // Create fallback names only for enabled species
    const fallbackNames = [];
    const nameTemplates = {
      human: { name: "Alaric Steinherz", gender: "male", displaySpecies: game.i18n.localize("names.species.human") },
      elf: { name: "Lyra Mondschein", gender: "female", displaySpecies: game.i18n.localize("names.species.elf") },
      dwarf: { name: "Thorin Eisenfaust", gender: "male", displaySpecies: game.i18n.localize("names.species.dwarf") },
      halfling: { name: "Rosie Hügelkind", gender: "female", displaySpecies: game.i18n.localize("names.species.halfling") },
      orc: { name: "Grimjaw der Wilde", gender: "male", displaySpecies: game.i18n.localize("names.species.orc") }
    };

    // Add fallback names for enabled species
    for (const species of enabledSpeciesCodes) {
      if (nameTemplates[species]) {
        fallbackNames.push({
          name: nameTemplates[species].name,
          species: species,
          gender: nameTemplates[species].gender,
          displaySpecies: nameTemplates[species].displaySpecies
        });
      }
    }

    // Add nonbinary example if supported and human is enabled
    if (supportedGenders.includes('nonbinary') && enabledSpeciesCodes.includes('human')) {
      fallbackNames.push({
        name: "Raven Sternenwandler",
        species: "human",
        gender: "nonbinary",
        displaySpecies: game.i18n.localize("names.species.human")
      });
      logDebug("Added nonbinary fallback name");
    }

    // Ensure we have at least one fallback name
    if (fallbackNames.length === 0) {
      fallbackNames.push({
        name: "Fallback Name",
        species: "human",
        gender: "male",
        displaySpecies: game.i18n.localize("names.species.human")
      });
    }

    this.emergencyNames = fallbackNames;
    logDebug(`Generated ${fallbackNames.length} fallback names for enabled species:`, enabledSpeciesCodes);
    this._updateNamesDisplay();
  }

  _getFoundryLanguage() {
    const foundryLang = game.settings.get("core", "language");
    
    const languageMapping = {
      'en': 'en',
      'de': 'de',
      'fr': 'fr',
      'es': 'es',
      'it': 'it'
    };

    const mappedLang = languageMapping[foundryLang] || 'de';
    logDebug(`Foundry language ${foundryLang} mapped to ${mappedLang}`);
    
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(mappedLang)) {
      return mappedLang;
    }
    
    if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.size > 0) {
      const firstLang = Array.from(globalNamesData.availableLanguages)[0];
      logDebug(`Using first available language: ${firstLang}`);
      return firstLang;
    }
    
    return 'de';
  }

  _getAvailableSpecies(language) {
    const globalNamesData = getGlobalNamesData();

    // First get species filtered by user settings
    const enabledSpeciesList = globalNamesData ? globalNamesData.getLocalizedSpecies() : [];
    const enabledSpeciesCodes = enabledSpeciesList.map(s => s.code);

    if (enabledSpeciesCodes.length === 0) {
      logWarn("No enabled species found in settings, using fallback");
      return ['human'];
    }

    // Then filter by what actually has name data
    const speciesWithData = new Set();
    const supportedGenders = getSupportedGenders();

    if (globalNamesData && globalNamesData.nameData) {
      for (const [key, data] of globalNamesData.nameData.entries()) {
        const [dataLang, dataSpecies, dataCategory] = key.split('.');

        // Only include enabled species AND traditional categories
        if (dataLang === language &&
            enabledSpeciesCodes.includes(dataSpecies) &&
            (supportedGenders.includes(dataCategory) || dataCategory === 'surnames') &&
            !isGeneratorOnlyCategory(dataCategory)) {
          speciesWithData.add(dataSpecies);
        }
      }
    }

    const result = Array.from(speciesWithData).length > 0 ?
           Array.from(speciesWithData) :
           ['human'];

    logDebug(`Enabled species with traditional name data for ${language}:`, result);
    return result;
  }

  _getRandomGender() {
    const supportedGenders = getSupportedGenders();
    
    // Filter out any generator-only categories (though genders shouldn't be)
    const validGenders = supportedGenders.filter(gender => !isGeneratorOnlyCategory(gender));
    
    if (validGenders.length === 0) {
      // Fallback to basic genders if something went wrong
      return 'male';
    }
    
    const selectedGender = validGenders[Math.floor(Math.random() * validGenders.length)];
    logDebug(`Selected random gender: ${selectedGender}`);
    return selectedGender;
  }

  async _generateSingleName(language, species, gender) {
    try {
      // Use the new NamesAPI for proper person name generation
      const options = {
        language: language,
        species: species,
        category: 'names',  // Use names category for person names
        gender: gender,     // Specify gender for name generation
        components: ['firstname', 'surname'],  // Generate both components
        count: 1
      };

      const results = await NamesAPI.generateNames(options);
      if (results.length > 0) {
        const fullName = typeof results[0] === 'string' ? results[0] : results[0].name;
        logDebug(`Generated full name: ${fullName} (${species}, ${gender})`);
        return fullName;
      }

      logDebug(`Failed to generate name for ${species} ${gender}`);
      return null;
    } catch (error) {
      logWarn(`Failed to generate name for ${language}.${species}.${gender}`, error);
      return null;
    }
  }

  _getLocalizedSpecies(species) {
    const locKey = `names.species.${species}`;
    return game.i18n.localize(locKey) || species.charAt(0).toUpperCase() + species.slice(1);
  }

  _updateNamesDisplay() {
    const html = this.element;
    if (!html || html.length === 0) {
      logWarn("Cannot update display - element not found");
      return;
    }
    
    const container = html.find('.emergency-names-grid');
    if (container.length === 0) {
      logWarn("Cannot find emergency names grid container");
      return;
    }
    
    logDebug(`Updating display with ${this.emergencyNames.length} names`);
    
    container.empty();
    
    for (const nameData of this.emergencyNames) {
      const genderSymbol = GENDER_SYMBOLS[nameData.gender] || '';
      const nameElement = $(`
        <div class="emergency-name-pill" data-name="${nameData.name}" title="${game.i18n.localize("names.emergency.clickToCopy") || "Klicken zum Kopieren"}">
          <div class="name-text">${nameData.name}</div>
          <div class="species-text">${nameData.displaySpecies} ${genderSymbol}</div>
        </div>
      `);
      
      container.append(nameElement);
    }
    
    html.find('.emergency-name-pill').off('click').on('click', this._onCopyName.bind(this));
  }

  async _onRerollNames(event) {
    logDebug("Reroll button clicked");
    event.preventDefault();
    
    const html = this.element;
    const rerollBtn = html.find('.emergency-reroll-btn');
    
    rerollBtn.prop('disabled', true);
    rerollBtn.html('<i class="fas fa-spinner fa-spin"></i> ' + (game.i18n.localize("names.emergency.generating") || "Generiere..."));
    
    try {
      await this._generateEmergencyNames();
      logInfo("Successfully rerolled emergency names");
    } catch (error) {
      logError("Reroll failed", error);
      ui.notifications.error(game.i18n.localize("names.emergency.error") || game.i18n.localize("names.generation-error"));
    } finally {
      rerollBtn.prop('disabled', false);
      rerollBtn.html('<i class="fas fa-dice"></i> ' + (game.i18n.localize("names.emergency.reroll") || "Neue Namen"));
    }
  }

  _onOpenGenerator() {
    logDebug("Opening main generator");
    // Import dynamically to avoid circular dependencies
    import('./generator-app.js').then(({ NamesGeneratorApp }) => {
      new NamesGeneratorApp().render(true);
      logDebug("Main generator opened successfully");
    }).catch(error => {
      logError("Failed to open main generator", error);
      ui.notifications.error(game.i18n.localize("names.emergency.errorOpenGenerator") || game.i18n.localize("names.generation-error"));
    });
    this.close();
  }

  async _onCopyName(event) {
    logDebug("Copy name clicked");
    event.preventDefault();
    
    const nameElement = $(event.currentTarget);
    const name = nameElement.data('name');
    
    if (!name) {
      logWarn("No name data found in clicked element");
      return;
    }

    logDebug(`Copying name to clipboard: ${name}`);

    try {
      await copyToClipboard(name, game.i18n.format("names.emergency.nameCopied", { name: name }) || `Name "${name}" kopiert`);
      
      // Visual feedback
      nameElement.addClass('copied');
      setTimeout(() => nameElement.removeClass('copied'), 1000);
      
      logDebug(`Successfully copied name: ${name}`);
    } catch (error) {
      logWarn("Clipboard copy failed, using fallback", error);
      fallbackCopyToClipboard(name, game.i18n.format("names.emergency.nameCopied", { name: name }) || `Name "${name}" kopiert`);
    }
  }
}