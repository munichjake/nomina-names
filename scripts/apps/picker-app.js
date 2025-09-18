/**
 * Names Picker App - Compact name picker for actors
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState, getActorSpecies, updateActorName } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

export class NamesPickerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.currentNames = [];
    this.supportedGenders = getSupportedGenders();
    
    logDebug("NamesPickerApp initialized", {
      actorName: this.actor?.name || "No actor",
      actorType: this.actor?.type || "Unknown",
      supportedGenders: this.supportedGenders
    });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-picker",
      title: game.i18n.localize("names.title"),
      template: TEMPLATE_PATHS.picker,
      width: 400,
      height: 350,
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
    const defaultLanguage = globalNamesData.languageConfig?.defaultLanguage || 'de';

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
      currentNamesCount: this.currentNames.length
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

  activateListeners(html) {
    super.activateListeners(html);

    // Update supported genders on render
    this.supportedGenders = getSupportedGenders();
    logDebug("Updated supported genders:", this.supportedGenders);

    html.find('.names-picker-generate').click(this._onGenerateNames.bind(this));
    html.find('.names-picker-name').click(this._onSelectName.bind(this));
    html.find('select').change(this._onOptionChange.bind(this));

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.isLoading) {
      logDebug("Data still loading, showing loading state");
      showLoadingState(html);
      this._waitForLoadingComplete(html);
    } else {
      logDebug("Data ready, generating initial names");
      this._onGenerateNames();
    }
  }

  async _waitForLoadingComplete(html) {
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.loadingPromise) {
      logDebug("Waiting for data loading to complete");
      await globalNamesData.loadingPromise;
    }
    
    hideLoadingState(html);
    await this._onGenerateNames();
    logDebug("Data loading completed, names generated");
  }

  _onOptionChange(event) {
    const changedElement = event.currentTarget;
    logDebug(`Picker option changed: ${changedElement.name} = ${changedElement.value}`);
    this._onGenerateNames();
  }

  async _onGenerateNames() {
    const html = this.element;
    const globalNamesData = getGlobalNamesData();
    
    if (!globalNamesData) {
      logError("Data manager not available for name generation");
      ui.notifications.error("Names data manager not available");
      return;
    }

    const language = html.find('#picker-language').val() || 
                    globalNamesData.languageConfig?.defaultLanguage || 'de';
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    const category = html.find('#picker-category').val() || 'male';

    logDebug("Generating names for picker", { language, species, category });

    // Ensure the selected category is supported
    if (!this.supportedGenders.includes(category) && this.supportedGenders.length > 0) {
      // Fall back to first supported gender
      const fallbackCategory = this.supportedGenders[0];
      html.find('#picker-category').val(fallbackCategory);
      logDebug(`Category ${category} not supported, falling back to ${fallbackCategory}`);
      category = fallbackCategory;
    }

    try {
      const names = [];
      const nameCount = 3;
      
      for (let i = 0; i < nameCount; i++) {
        let name;
        if (this.supportedGenders.includes(category)) {
          name = await this._generateFormattedName(
            language, species, category, 
            ['firstname', 'surname'], 
            '{firstname} {surname}'
          );
        } else {
          name = await this._generateSimpleName(language, species, category);
        }
        
        if (name) {
          names.push(name);
          logDebug(`Generated picker name ${i + 1}/${nameCount}: ${name}`);
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
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const nameComponents = {};
    for (const component of components) {
      try {
        let part = await this._generateNameComponent(language, species, gender, component);
        if (part) {
          nameComponents[component] = part;
          logDebug(`Generated picker component ${component}: ${part}`);
        }
      } catch (error) {
        logWarn(`Failed to generate picker component ${component}`, error);
      }
    }

    if (Object.keys(nameComponents).length === 0) {
      throw new Error(game.i18n.localize("names.no-names-generated"));
    }

    return this._formatName(nameFormat, nameComponents);
  }

  async _generateSimpleName(language, species, category) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    if (category === 'settlements') {
      const settlementData = globalNamesData.getData(`${language}.${species}.settlements`);
      if (!settlementData?.settlements) {
        throw new Error(`Keine Siedlungsdaten für ${language}.${species}`);
      }
      const settlements = settlementData.settlements;
      const settlement = settlements[Math.floor(Math.random() * settlements.length)];
      const result = settlement.name || settlement;
      logDebug(`Generated simple settlement name: ${result}`);
      return result;
    } else {
      return this._getRandomFromData(language, species, category);
    }
  }

  async _generateNameComponent(language, species, gender, component) {
    switch (component) {
      case 'firstname':
        return this._getRandomFromData(language, species, gender);

      case 'surname':
        return this._getRandomFromData(language, species, 'surnames');

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

  _getRandomFromData(language, species, category) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const key = `${language}.${species}.${category}`;
    const data = globalNamesData.getData(key);

    if (!data?.names || data.names.length === 0) {
      logDebug(`No picker data found for ${key}`);
      return null;
    }

    const selectedName = data.names[Math.floor(Math.random() * data.names.length)];
    logDebug(`Selected from ${key}: ${selectedName}`);
    return selectedName;
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
}