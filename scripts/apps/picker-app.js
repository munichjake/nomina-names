/**
 * Names Picker App - Compact name picker for actors
 * Updated to use V4 API internally while maintaining the same UI
 */

import { getGlobalGenerator } from '../api/generator.js';
import { showLoadingState, hideLoadingState, getActorSpecies, updateActorName } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, MODULE_ID } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { getHistoryManager } from '../core/history-manager.js';
import { NamesHistoryApp } from './history-app.js';

export class NamesPickerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.currentNames = [];
    this.supportedGenders = getSupportedGenders();
    this._initialized = false;
    this.generator = null;

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
    if (!this.generator) {
      this.generator = getGlobalGenerator();
      await this.generator.initialize();
    }

    const actorSpecies = this._getActorSpecies();
    const defaultLanguage = this._getDefaultContentLanguage();

    const languages = await this.generator.getAvailableLanguages();
    const species = await this.generator.getAvailableSpecies(defaultLanguage);

    // Get UI language
    const uiLanguage = game.i18n.lang || 'de';
    logDebug(`UI Language from game.i18n.lang: ${uiLanguage}`);

    // Get species metadata for localized names
    const speciesMetadata = this.generator.dataManager.getSpeciesMetadata();
    logDebug('Species metadata:', speciesMetadata);

    const data = {
      languages: languages.map(code => ({ code, name: code.toUpperCase() })),
      species: species.map(speciesObj => {
        const code = speciesObj.code;
        const localizedName = speciesMetadata[code]?.[uiLanguage] ||
                             speciesMetadata[code]?.['en'] ||
                             this._capitalizeSpecies(code);
        logDebug(`Species ${code}: uiLanguage=${uiLanguage}, localizedName=${localizedName}`);
        return { code, name: localizedName };
      }),
      currentNames: this.currentNames,
      actorSpecies: actorSpecies,
      defaultLanguage: defaultLanguage,
      isLoading: false,
      isLoaded: true,
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

  _capitalizeSpecies(species) {
    return species.charAt(0).toUpperCase() + species.slice(1);
  }

  _getActorSpecies() {
    // Try to detect species from actor
    const actorRace = this.actor?.system?.details?.race || this.actor?.system?.race;
    if (actorRace) {
      const raceLower = actorRace.toLowerCase();
      // Simple mapping
      if (raceLower.includes('elf')) return 'elf';
      if (raceLower.includes('dwarf')) return 'dwarf';
      if (raceLower.includes('orc')) return 'orc';
      if (raceLower.includes('halfling')) return 'halfling';
    }
    return 'human'; // Default fallback
  }

  /**
   * Update category dropdown options based on available data and settings
   */
  async _updateCategoryOptions(html) {
    const language = html.find('#picker-language').val() || this._getDefaultContentLanguage();
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    const categorySelect = html.find('#picker-category');

    logDebug(`Updating category options for ${language}.${species}`);

    // Get available genders from catalog displayNameByCategory
    const packageCode = `${species}-${language}`;
    const pkg = this.generator.dataManager.getPackage(packageCode);

    const availableGenders = [];

    // Get UI language for displaying category names
    const uiLanguage = game.i18n.lang || 'de';
    logDebug(`UI Language: ${uiLanguage}, Content Language: ${language}`);

    if (pkg && pkg.data.catalogs && pkg.data.catalogs.firstnames) {
      const catalog = pkg.data.catalogs.firstnames;
      logDebug('Catalog structure:', catalog);
      logDebug('displayNameByCategory:', catalog.displayNameByCategory);
      logDebug('displayNameByCategory[de]:', catalog.displayNameByCategory?.de);
      logDebug('displayNameByCategory[en]:', catalog.displayNameByCategory?.en);

      if (catalog.displayNameByCategory && catalog.displayNameByCategory[uiLanguage]) {
        // Get all available categories (genders) from displayNameByCategory
        availableGenders.push(...Object.keys(catalog.displayNameByCategory[uiLanguage]));
      }
    }

    logDebug(`Available genders for ${language}.${species}:`, availableGenders);

    // Build new options HTML
    let optionsHtml = '<option value="">' + game.i18n.localize("names.ui.all-genders") + '</option>';
    for (const gender of availableGenders) {
      const catalog = pkg?.data.catalogs.firstnames;
      const displayName = catalog?.displayNameByCategory?.[uiLanguage]?.[gender] || gender;
      logDebug(`Gender option: ${gender} -> displayName="${displayName}" (from displayNameByCategory[${uiLanguage}][${gender}])`);
      optionsHtml += `<option value="${gender}">${displayName}</option>`;
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
    try {
      const packageCode = `${species}-${language}`;
      const recipes = await this.generator.getAvailableRecipes(packageCode, language);

      // Check if there are recipes that could generate names for this gender
      // For V4, we look for recipes that mention the gender or are generic person recipes
      return recipes && recipes.length > 0;
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
    html.find('#picker-history-btn').click(this._onOpenHistory.bind(this));

    // Update category options when species changes
    html.find('#picker-species').change(async (event) => {
      await this._updateCategoryOptions(html);
    });

    // Prevent multiple initialization
    if (this._initialized) {
      logDebug("Picker app already initialized, skipping auto-generation");
      return;
    }

    // Update category options on initial load
    this._updateCategoryOptions(html);

    // Generate initial names
    logDebug("Generating initial names for picker");
    this._onGenerateNames();
    this._initialized = true;
  }

  async _onOptionChange(event) {
    const changedElement = event.currentTarget;
    logDebug(`Picker option changed: ${changedElement.name} = ${changedElement.value}`);

    // Always regenerate names when any option changes
    await this._onGenerateNames();
  }

  async _onGenerateNames() {
    const html = this.element;

    if (!this.generator) {
      logError("Generator not available for name generation");
      ui.notifications.error("Names generator not available");
      return;
    }

    const language = html.find('#picker-language').val() || this._getDefaultContentLanguage();
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    let category = html.find('#picker-category').val(); // Can be empty for "all genders"

    logDebug("Generating names for picker", { language, species, category: category || 'random' });

    try {
      const packageCode = `${species}-${language}`;

      // Generate 3 names using generatePersonName with gender filter
      const result = await this.generator.generatePersonName(packageCode, {
        locale: language,
        n: 3,
        gender: category || null, // Use selected gender or null for random
        components: ['firstname', 'surname'],
        format: '{firstname} {surname}',
        allowDuplicates: false
      });

      const names = result.suggestions ? result.suggestions.map(s => s.text) : [];

      // Debug output for picker generation
      logDebug('=== PICKER GENERATION START ===');
      logDebug(`Generated ${result.suggestions.length} names from package: ${packageCode} | Gender: ${category || 'random'}`);
      result.suggestions.forEach((suggestion, index) => {
        logDebug(`[${index + 1}/3] Name: "${suggestion.text}" | Catalog: ${suggestion.catalog || 'unknown'}`, suggestion.metadata);
      });
      logDebug('=== PICKER GENERATION END ===');

      this.currentNames = names;
      this._updateNamesDisplay(html);

      // Add to history
      this._addToHistory(names, language, species, category);

      logDebug(`Successfully generated ${names.length} names for picker`);

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
    try {
      const defaultContentLanguageSetting = game.settings.get("nomina-names", "defaultContentLanguage");

      if (defaultContentLanguageSetting === "auto") {
        const foundryLang = game.settings.get("core", "language");
        const languageMapping = {
          'en': 'en',
          'de': 'de',
          'fr': 'fr',
          'es': 'es',
          'it': 'it'
        };
        return languageMapping[foundryLang] || 'de';
      }

      return defaultContentLanguageSetting;
    } catch (error) {
      logDebug('Error getting default language:', error);
      return 'de'; // Fallback
    }
  }

  /**
   * Opens the History App
   * @param {Event} event - The click event
   */
  _onOpenHistory(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Opening history from picker app");

    new NamesHistoryApp().render(true);
  }

  /**
   * Add generated names to history
   * @param {Array} names - Array of generated name strings
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category/gender code
   */
  _addToHistory(names, language, species, category) {
    const historyManager = getHistoryManager();

    const entries = names.map(name => {
      const gender = category || 'random';

      return {
        name: name,
        source: 'picker',
        metadata: {
          language: language,
          species: species,
          category: 'names',
          subcategory: gender,
          gender: gender,
          format: 'v4-generated'
        }
      };
    });

    historyManager.addEntries(entries);

    logDebug(`Added ${entries.length} names to history from picker`);
  }
}
