/**
 * Names Picker App - Compact name picker for actors
 * Updated to exclude categorized content (books, ships, shops, taverns)
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState, getActorSpecies, updateActorName } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, isGeneratorOnlyCategory, MODULE_ID, getLocalizedCategoryName } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { NamesAPI } from '../api-system.js';

export class NamesPickerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.currentNames = [];
    this.supportedGenders = getSupportedGenders();
    this._initialized = false;
    
    logDebug("NamesPickerApp initialized", {
      actorName: this.actor?.name || "No actor",
      actorType: this.actor?.type || "Unknown",
      supportedGenders: this.supportedGenders
    });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-picker",
      title: game.i18n.localize("names.picker-window-title") || "Nomina Names - Name Picker",
      template: TEMPLATE_PATHS.picker,
      width: 600,
      height: 600,
      resizable: false,
      classes: [CSS_CLASSES.pickerApp]
    });
  }

  async getData() {
    ensureGlobalNamesData();
    const globalNamesData = getGlobalNamesData();

    if (!globalNamesData) {
      logWarn("Global names data not available, returning empty data");
      return {
        languages: [],
        species: [],
        currentNames: this.currentNames,
        actorSpecies: null,
        defaultLanguage: 'de',
        isLoading: false,
        isLoaded: false,
        supportedGenders: getSupportedGenders()
      };
    }

    await globalNamesData.initializeData();

    const actorSpecies = this._getActorSpecies();
    const defaultLanguage = this._getDefaultContentLanguage();

    const data = {
      languages: globalNamesData.getLocalizedLanguages(),
      species: globalNamesData.getLocalizedSpecies(),
      currentNames: this.currentNames,
      actorSpecies: actorSpecies,
      defaultLanguage: defaultLanguage,
      isLoading: globalNamesData.isLoading,
      isLoaded: globalNamesData.isLoaded,
      supportedGenders: getSupportedGenders()
    };

    logDebug("Picker app data prepared", {
      languages: data.languages.length,
      species: data.species.length,
      actorSpecies: actorSpecies,
      defaultLanguage: defaultLanguage,
      currentNamesCount: this.currentNames.length,
      supportedGenders: data.supportedGenders
    });

    return data;
  }


  _getActorSpecies() {
    const globalNamesData = getGlobalNamesData();
    const detectedSpecies = getActorSpecies(this.actor, globalNamesData?.speciesConfig);
    logDebug(`Detected actor species: ${detectedSpecies}`, {
      actorName: this.actor?.name,
      actorRace: this.actor?.system?.details?.race || this.actor?.system?.race || "Unknown"
    });
    return detectedSpecies;
  }

  /**
   * Update category dropdown options based on available data and settings
   */
  async _updateCategoryOptions(html) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return;

    const language = html.find('#picker-language').val() || this._getDefaultContentLanguage();
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    const categorySelect = html.find('#picker-category');

    logDebug(`Updating category options for ${language}.${species}`);

    // Get available genders for this species/language
    const availableGenders = [];
    const supportedGenders = getSupportedGenders();

    for (const gender of supportedGenders) {
      // Check if we have data for this gender
      const hasData = await this._hasGenderData(language, species, gender);
      if (hasData) {
        availableGenders.push(gender);
      }
    }

    logDebug(`Available genders for ${language}.${species}:`, availableGenders);

    // Build new options HTML
    let optionsHtml = '<option value="">' + game.i18n.localize("names.ui.all-genders") + '</option>';
    for (const gender of availableGenders) {
      const locKey = `names.${gender}`;
      const genderName = game.i18n.localize(locKey);
      optionsHtml += `<option value="${gender}">${genderName}</option>`;
    }

    // Update the select element
    categorySelect.html(optionsHtml);
    categorySelect.val(''); // Reset to "All Genders"

    // Update the enhanced dropdown if it exists
    const enhancedContainer = categorySelect.next('.enhanced-dropdown');
    if (enhancedContainer.length > 0) {
      const enhancedDropdown = enhancedContainer[0]._enhancedDropdown;
      if (enhancedDropdown) {
        enhancedDropdown.loadItems();
        enhancedDropdown.updateDisplay();
        logDebug('Enhanced dropdown updated with available genders');
      }
    }
  }

  /**
   * Check if gender data is available for language/species
   */
  async _hasGenderData(language, species, gender) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return false;

    try {
      // Try to generate a test name
      const options = {
        language: language,
        species: species,
        category: 'names',
        gender: gender,
        components: ['firstname'],
        count: 1
      };

      const result = await NamesAPI.generateNames(options);
      return result && result.length > 0;
    } catch (error) {
      logDebug(`No data for ${language}.${species}.${gender}:`, error.message);
      return false;
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Update supported genders on render
    this.supportedGenders = getSupportedGenders();
    logDebug("Updated supported genders:", this.supportedGenders);

    html.find('.names-picker-generate').click(this._onGenerateNames.bind(this));
    html.find('.names-picker-name').click(this._onSelectName.bind(this));
    html.find('select').change(this._onOptionChange.bind(this));

    // Update category options when species changes
    html.find('#picker-species').change(async (event) => {
      await this._updateCategoryOptions(html);
    });

    // Prevent multiple initialization
    if (this._initialized) {
      logDebug("Picker app already initialized, skipping auto-generation");
      return;
    }

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.isLoading) {
      logDebug("Data still loading, showing loading state");
      showLoadingState(html);
      this._waitForLoadingComplete(html);
    } else {
      logDebug("Data ready, generating initial names");
      this._onGenerateNames();
    }

    this._initialized = true;
  }

  async _waitForLoadingComplete(html) {
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.loadingPromise) {
      logDebug("Waiting for data loading to complete");
      await globalNamesData.loadingPromise;
    }

    hideLoadingState(html);
    await this._onGenerateNames();
    this._initialized = true;
    logDebug("Data loading completed, names generated");
  }

  async _onOptionChange(event) {
    const changedElement = event.currentTarget;
    logDebug(`Picker option changed: ${changedElement.name} = ${changedElement.value}`);

    // Always regenerate names when any option changes
    await this._onGenerateNames();
  }

  async _onGenerateNames() {
    const html = this.element;
    const globalNamesData = getGlobalNamesData();

    if (!globalNamesData) {
      logError("Data manager not available for name generation");
      ui.notifications.error("Names data manager not available");
      return;
    }

    const language = html.find('#picker-language').val() || this._getDefaultContentLanguage();
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    let category = html.find('#picker-category').val(); // Can be empty for "all genders"

    logDebug("Generating names for picker", { language, species, category: category || 'random' });

    try {
      const names = [];
      const nameCount = 3;

      // If no category selected, get available genders for random selection
      let availableGenders = [];
      if (!category) {
        const supportedGenders = getSupportedGenders();
        for (const gender of supportedGenders) {
          const hasData = await this._hasGenderData(language, species, gender);
          if (hasData) {
            availableGenders.push(gender);
          }
        }
        logDebug(`Available genders for random selection:`, availableGenders);
      }

      for (let i = 0; i < nameCount; i++) {
        // Select random gender if no category specified
        let genderToUse = category;
        if (!category && availableGenders.length > 0) {
          genderToUse = availableGenders[Math.floor(Math.random() * availableGenders.length)];
          logDebug(`Randomly selected gender: ${genderToUse}`);
        } else if (!category) {
          // Fallback to male if no available genders
          genderToUse = 'male';
        }

        const name = await this._generateFormattedName(
          language, species, genderToUse,
          ['firstname', 'surname'],
          '{firstname} {surname}'
        );

        if (name) {
          names.push(name);
          logDebug(`Generated picker name ${i + 1}/${nameCount}: ${name} (${genderToUse})`);
        }
      }

      this.currentNames = names;
      this._updateNamesDisplay(html);

      logInfo(`Successfully generated ${names.length} names for picker`);

    } catch (error) {
      logError("Name generation failed in picker", error);
      ui.notifications.error(game.i18n.localize("names.generation-error"));
    }
  }

  _updateNamesDisplay(html) {
    const namesList = html.find('.names-picker-list');
    namesList.empty();

    logDebug(`Updating picker display with ${this.currentNames.length} names`);

    for (const name of this.currentNames) {
      namesList.append(`
        <div class="names-picker-name" data-name="${name}">
          <i class="fas fa-user"></i>
          ${name}
        </div>
      `);
    }

    html.find('.names-picker-name').click(this._onSelectName.bind(this));
  }

  async _generateFormattedName(language, species, gender, components, nameFormat) {
    try {
      // Use the new NamesAPI for proper person name generation
      const options = {
        language: language,
        species: species,
        category: 'names',
        gender: gender,
        components: components,
        format: nameFormat,
        count: 1
      };

      const results = await NamesAPI.generateNames(options);
      if (results.length > 0) {
        const fullName = typeof results[0] === 'string' ? results[0] : results[0].name;
        logDebug(`Generated picker name: ${fullName} (${species}, ${gender})`);
        return fullName;
      }

      throw new Error(game.i18n.localize("names.no-names-generated"));
    } catch (error) {
      logWarn(`Failed to generate picker name for ${language}.${species}.${gender}`, error);
      throw error;
    }
  }

  async _generateSimpleName(language, species, category) {
    try {
      const options = {
        language: language,
        species: species,
        categories: [category],
        count: 1
      };

      const results = await NamesAPI.generateNames(options);
      if (results.length > 0) {
        const result = typeof results[0] === 'string' ? results[0] : results[0].name;
        logDebug(`Generated simple name: ${result} (${language}.${species}.${category})`);
        return result;
      }

      throw new Error(`Keine Daten für ${language}.${species}.${category}`);
    } catch (error) {
      logWarn(`Failed to generate simple name for ${language}.${species}.${category}`, error);
      return null;
    }
  }

  async _generateNameComponent(language, species, gender, component) {
    switch (component) {
      case 'firstname':
        return await this._getRandomFromData(language, species, gender);

      case 'surname':
        return await this._getRandomFromData(language, species, 'surnames');

      default:
        logWarn(`Unknown picker component: ${component}`);
        return null;
    }
  }

  _formatName(format, components) {
    let result = format;

    const placeholders = {
      '{firstname}': components.firstname || '',
      '{surname}': components.surname || ''
    };

    for (const [placeholder, value] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    const formattedResult = result.replace(/\s+/g, ' ').trim();
    logDebug("Formatted picker name:", formattedResult);
    return formattedResult;
  }

  async _getRandomFromData(language, species, category) {
    try {
      const options = {
        language: language,
        species: species,
        categories: [category],
        count: 1
      };

      const results = await NamesAPI.generateNames(options);
      if (results.length > 0) {
        const selectedName = typeof results[0] === 'string' ? results[0] : results[0].name;
        logDebug(`Selected from ${language}.${species}.${category}: ${selectedName}`);
        return selectedName;
      }

      logDebug(`No picker data found for ${language}.${species}.${category}`);
      return null;
    } catch (error) {
      logWarn(`Failed to get random data for ${language}.${species}.${category}`, error);
      return null;
    }
  }

  async _onSelectName(event) {
    const selectedName = event.currentTarget.dataset.name;
    if (!selectedName || !this.actor) {
      logWarn("Name selection failed", { 
        selectedName: selectedName || "No name",
        hasActor: !!this.actor 
      });
      return;
    }

    logInfo(`User selected name: ${selectedName} for actor: ${this.actor.name}`);

    try {
      await updateActorName(this.actor, selectedName);
      const message = game.i18n.format("names.name-adopted", { name: selectedName });
      ui.notifications.info(message);
      
      logInfo(`Successfully updated actor name: ${this.actor.name} -> ${selectedName}`);
      this.close();

    } catch (error) {
      logError("Failed to update actor name", error);
      ui.notifications.error(game.i18n.localize("names.name-error"));
    }
  }

  /**
   * Get the default content language from settings
   * @returns {string} Default content language code
   */
  _getDefaultContentLanguage() {
    const defaultContentLanguageSetting = game.settings.get("nomina-names", "defaultContentLanguage");

    // If set to "auto", use interface language or fallback to Foundry language
    if (defaultContentLanguageSetting === "auto") {
      // First try interface language setting
      const interfaceLanguageSetting = game.settings.get("nomina-names", "interfaceLanguage");

      if (interfaceLanguageSetting !== "auto") {
        // Use interface language if available in content languages
        const globalNamesData = getGlobalNamesData();
        if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(interfaceLanguageSetting)) {
          return interfaceLanguageSetting;
        }
      }

      // Fallback to Foundry language
      const foundryLang = game.settings.get("core", "language");
      const languageMapping = {
        'en': 'en',
        'de': 'de',
        'fr': 'fr',
        'es': 'es',
        'it': 'it'
      };

      const mappedLang = languageMapping[foundryLang] || 'de';
      const globalNamesData = getGlobalNamesData();
      if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(mappedLang)) {
        return mappedLang;
      }

      return 'de'; // Final fallback
    }

    // Use specific language setting
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(defaultContentLanguageSetting)) {
      return defaultContentLanguageSetting;
    }

    // Fallback to 'de' if set language not available
    return 'de';
  }
}