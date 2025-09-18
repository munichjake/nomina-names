/**
 * Names Picker App - Compact name picker for actors
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState, getActorSpecies, updateActorName } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES } from '../shared/constants.js';

export class NamesPickerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.currentNames = [];
    this.supportedGenders = getSupportedGenders();
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

    return {
      languages: globalNamesData.getLocalizedLanguages(),
      species: globalNamesData.getLocalizedSpecies(),
      currentNames: this.currentNames,
      actorSpecies: actorSpecies,
      defaultLanguage: defaultLanguage,
      isLoading: globalNamesData.isLoading,
      isLoaded: globalNamesData.isLoaded,
      supportedGenders: getSupportedGenders()
    };
  }

  _getActorSpecies() {
    const globalNamesData = getGlobalNamesData();
    return getActorSpecies(this.actor, globalNamesData?.speciesConfig);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Update supported genders on render
    this.supportedGenders = getSupportedGenders();

    html.find('.names-picker-generate').click(this._onGenerateNames.bind(this));
    html.find('.names-picker-name').click(this._onSelectName.bind(this));
    html.find('select').change(this._onOptionChange.bind(this));

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.isLoading) {
      showLoadingState(html);
      this._waitForLoadingComplete(html);
    } else {
      this._onGenerateNames();
    }
  }

  async _waitForLoadingComplete(html) {
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.loadingPromise) {
      await globalNamesData.loadingPromise;
    }
    
    hideLoadingState(html);
    await this._onGenerateNames();
  }

  _onOptionChange(event) {
    this._onGenerateNames();
  }

  async _onGenerateNames() {
    const html = this.element;
    const globalNamesData = getGlobalNamesData();
    
    if (!globalNamesData) {
      ui.notifications.error("Names data manager not available");
      return;
    }

    const language = html.find('#picker-language').val() || 
                    globalNamesData.languageConfig?.defaultLanguage || 'de';
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    const category = html.find('#picker-category').val() || 'male';

    // Ensure the selected category is supported
    if (!this.supportedGenders.includes(category) && this.supportedGenders.length > 0) {
      // Fall back to first supported gender
      const fallbackCategory = this.supportedGenders[0];
      html.find('#picker-category').val(fallbackCategory);
      category = fallbackCategory;
    }

    try {
      const names = [];
      for (let i = 0; i < 3; i++) {
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
        }
      }

      this.currentNames = names;

      const namesList = html.find('.names-picker-list');
      namesList.empty();

      for (const name of names) {
        namesList.append(`
          <div class="names-picker-name" data-name="${name}">
            <i class="fas fa-user"></i>
            ${name}
          </div>
        `);
      }

      html.find('.names-picker-name').click(this._onSelectName.bind(this));

    } catch (error) {
      if (globalNamesData) {
        globalNamesData._log('console.generation-error', null, error);
      }
      ui.notifications.error(game.i18n.localize("names.generation-error"));
    }
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
        }
      } catch (error) {
        globalNamesData._log('console.component-generation-failed', { component }, error);
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
      return settlement.name || settlement;
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

    return result.replace(/\s+/g, ' ').trim();
  }

  _getRandomFromData(language, species, category) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const key = `${language}.${species}.${category}`;
    const data = globalNamesData.getData(key);

    if (!data?.names || data.names.length === 0) {
      globalNamesData._log('console.no-data-found', { key });
      return null;
    }

    return data.names[Math.floor(Math.random() * data.names.length)];
  }

  async _onSelectName(event) {
    const selectedName = event.currentTarget.dataset.name;
    if (!selectedName || !this.actor) return;

    try {
      await updateActorName(this.actor, selectedName);
      const message = game.i18n.format("names.name-adopted", { name: selectedName });
      ui.notifications.info(message);
      this.close();

    } catch (error) {
      const globalNamesData = getGlobalNamesData();
      if (globalNamesData) {
        globalNamesData._log('console.name-setting-error', null, error);
      }
      ui.notifications.error(game.i18n.localize("names.name-error"));
    }
  }
}