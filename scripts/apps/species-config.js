/**
 * Species Configuration App - Manages available species selection
 * Allows users to enable/disable species from both core module and third-party extensions
 */

import { MODULE_ID } from '../shared/constants.js';
import { logDebug, logError } from '../utils/logger.js';

/**
 * Species Configuration Application
 * Provides interface for managing which species are available in the generator
 */
export class NamesSpeciesConfig extends FormApplication {

  /**
   * Default application options
   * @returns {Object} Application configuration
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-species-config",
      title: game.i18n.localize("names.speciesConfig.title") || "Spezies verwalten",
      template: "modules/nomina-names/templates/species-config.hbs",
      width: 700,
      height: 600,
      closeOnSubmit: true,
      resizable: true,
      classes: ["names-species-config"]
    });
  }

  /**
   * Get template data for rendering
   * Collects all available species from core module and extensions
   * @returns {Object} Template data
   */
  getData() {
    const currentSettings = game.settings.get(MODULE_ID, "availableSpecies");
    const api = game.modules.get(MODULE_ID)?.api;

    if (!api) {
      logError("Names API not available in species config");
      return { species: [], coreSpecies: [], extensionSpecies: [] };
    }

    // Get all available species (including disabled ones)
    const allSpecies = api.getAllSpeciesCodes();
    const registeredExtensions = api.registeredExtensions || new Map();

    // Separate core species from extensions
    const coreSpecies = [];
    const extensionSpecies = [];
    const extensionsByModule = new Map();

    // Core species (built into the module)
    const coreSpeciesList = [
      'human', 'elf', 'dwarf', 'halfling', 'orc', 'goblin',
      'dragonborn', 'tiefling', 'aasimar', 'gnome'
    ];

    // Process core species
    for (const species of coreSpeciesList) {
      if (allSpecies.includes(species)) {
        const enabled = currentSettings[species] !== false; // Default enabled
        coreSpecies.push({
          species,
          displayName: this._getSpeciesDisplayName(species),
          enabled,
          source: 'core',
          description: this._getSpeciesDescription(species)
        });
      }
    }

    // Process extension species
    for (const [key, extension] of registeredExtensions) {
      if (extension.type === 'species') {
        const species = extension.species;
        const moduleId = extension.moduleId;

        if (!extensionsByModule.has(moduleId)) {
          extensionsByModule.set(moduleId, {
            moduleId,
            moduleName: this._getModuleName(moduleId),
            species: []
          });
        }

        const enabled = currentSettings[species] !== false; // Default enabled
        extensionsByModule.get(moduleId).species.push({
          species,
          displayName: extension.displayName || species,
          enabled,
          source: 'extension',
          moduleId,
          description: this._getExtensionDescription(extension)
        });
      }
    }

    // Convert extension map to array
    const extensionModules = Array.from(extensionsByModule.values());

    logDebug(`Species config data: ${coreSpecies.length} core, ${extensionModules.length} extension modules`);

    return {
      coreSpecies,
      extensionModules,
      hasExtensions: extensionModules.length > 0,
      totalSpecies: coreSpecies.length + extensionModules.reduce((sum, mod) => sum + mod.species.length, 0)
    };
  }

  /**
   * Activate event listeners for the form
   * @param {jQuery} html - The rendered HTML
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Species toggle events
    html.find('.species-toggle').click(this._onSpeciesToggle.bind(this));
    html.find('.species-checkbox').click(this._onCheckboxClick.bind(this));

    // Module-level controls
    html.find('.module-enable-all').click(this._onModuleEnableAll.bind(this));
    html.find('.module-disable-all').click(this._onModuleDisableAll.bind(this));

    // Global controls
    html.find('button[name="enable-all"]').click(this._onEnableAll.bind(this));
    html.find('button[name="disable-all"]').click(this._onDisableAll.bind(this));
    html.find('button[name="reset"]').click(this._onReset.bind(this));

    // Search functionality
    html.find('#species-search').on('input', this._onSearch.bind(this));

    // Form submission and cancel
    html.find('.cancel-button').click(this._onCancel.bind(this));
    html.find('form').on('submit', this._onSubmit.bind(this));
  }

  /**
   * Handle species toggle click
   * @param {Event} event - Click event
   */
  _onSpeciesToggle(event) {
    event.preventDefault();
    const toggle = $(event.currentTarget);
    const checkbox = toggle.find('.species-checkbox');

    const wasChecked = checkbox.prop('checked');
    checkbox.prop('checked', !wasChecked);

    this._updateToggleVisual(toggle, !wasChecked);
  }

  /**
   * Handle checkbox click (prevent event bubbling)
   * @param {Event} event - Click event
   */
  _onCheckboxClick(event) {
    event.stopPropagation();
    const checkbox = $(event.currentTarget);
    const toggle = checkbox.closest('.species-toggle');

    this._updateToggleVisual(toggle, checkbox.prop('checked'));
  }

  /**
   * Handle module enable all button
   * @param {Event} event - Click event
   */
  _onModuleEnableAll(event) {
    event.preventDefault();
    const moduleSection = $(event.currentTarget).closest('.extension-module');
    moduleSection.find('.species-checkbox').prop('checked', true);
    moduleSection.find('.species-toggle').addClass('enabled').removeClass('disabled');
  }

  /**
   * Handle module disable all button
   * @param {Event} event - Click event
   */
  _onModuleDisableAll(event) {
    event.preventDefault();
    const moduleSection = $(event.currentTarget).closest('.extension-module');
    moduleSection.find('.species-checkbox').prop('checked', false);
    moduleSection.find('.species-toggle').addClass('disabled').removeClass('enabled');
  }

  /**
   * Handle global enable all button
   * @param {Event} event - Click event
   */
  _onEnableAll(event) {
    event.preventDefault();
    this.element.find('.species-checkbox').prop('checked', true);
    this.element.find('.species-toggle').addClass('enabled').removeClass('disabled');
  }

  /**
   * Handle global disable all button
   * @param {Event} event - Click event
   */
  _onDisableAll(event) {
    event.preventDefault();
    this.element.find('.species-checkbox').prop('checked', false);
    this.element.find('.species-toggle').addClass('disabled').removeClass('enabled');
  }

  /**
   * Handle reset button
   * @param {Event} event - Click event
   */
  _onReset(event) {
    event.preventDefault();

    // Enable all core species, disable all extensions
    this.element.find('.core-species .species-checkbox').prop('checked', true);
    this.element.find('.core-species .species-toggle').addClass('enabled').removeClass('disabled');

    this.element.find('.extension-module .species-checkbox').prop('checked', false);
    this.element.find('.extension-module .species-toggle').addClass('disabled').removeClass('enabled');
  }

  /**
   * Handle search input
   * @param {Event} event - Input event
   */
  _onSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const speciesItems = this.element.find('.species-item');

    speciesItems.each((i, item) => {
      const $item = $(item);
      const speciesName = $item.find('.species-name').text().toLowerCase();
      const description = $item.find('.species-description').text().toLowerCase();

      if (speciesName.includes(searchTerm) || description.includes(searchTerm)) {
        $item.show();
      } else {
        $item.hide();
      }
    });
  }

  /**
   * Handle cancel button click
   * @param {Event} event - Click event
   */
  _onCancel(event) {
    event.preventDefault();
    this.close();
  }

  /**
   * Handle form submission
   * @param {Event} event - Submit event
   */
  _onSubmit(event) {
    event.preventDefault();

    // Collect form data
    const formData = new FormData(event.target);
    const formObj = {};
    for (let [key, value] of formData.entries()) {
      formObj[key] = value;
    }

    // Call the inherited _updateObject method
    this._updateObject(event, formObj);
  }

  /**
   * Update visual state of toggle
   * @param {jQuery} toggle - Toggle element
   * @param {boolean} enabled - Whether enabled
   */
  _updateToggleVisual(toggle, enabled) {
    if (enabled) {
      toggle.addClass('enabled').removeClass('disabled');
    } else {
      toggle.addClass('disabled').removeClass('enabled');
    }
  }

  /**
   * Process form submission
   * @param {Event} event - Submit event
   * @param {Object} formData - Form data
   */
  async _updateObject(event, formData) {
    const newSettings = {};

    // Process all checkboxes to determine enabled species
    this.element.find('.species-checkbox').each((i, checkbox) => {
      const $checkbox = $(checkbox);
      const species = $checkbox.data('species');
      newSettings[species] = $checkbox.prop('checked');
    });

    // Save settings
    await game.settings.set(MODULE_ID, "availableSpecies", newSettings);

    // Count enabled species for notification
    const enabledCount = Object.values(newSettings).filter(enabled => enabled).length;
    const totalCount = Object.keys(newSettings).length;

    ui.notifications.info(
      game.i18n.format("names.speciesConfig.saved", {
        enabled: enabledCount,
        total: totalCount
      }) || `Spezies-Konfiguration gespeichert: ${enabledCount}/${totalCount} aktiviert`
    );

    logDebug(`Species configuration saved: ${enabledCount}/${totalCount} species enabled`);
  }

  /**
   * Get display name for a species
   * @param {string} species - Species identifier
   * @returns {string} Display name
   */
  _getSpeciesDisplayName(species) {
    const displayNames = {
      'human': 'Menschen',
      'elf': 'Elfen',
      'dwarf': 'Zwerge',
      'halfling': 'Halblinge',
      'orc': 'Orks',
      'goblin': 'Goblins',
      'dragonborn': 'Drachengeborene',
      'tiefling': 'Tieflinge',
      'aasimar': 'Aasimar',
      'gnome': 'Gnome'
    };

    return displayNames[species] || species.charAt(0).toUpperCase() + species.slice(1);
  }

  /**
   * Get description for a core species
   * @param {string} species - Species identifier
   * @returns {string} Description
   */
  _getSpeciesDescription(species) {
    const descriptions = {
      'human': 'Vielseitige und anpassungsfähige Humanoide',
      'elf': 'Langlebige, magisch begabte Waldvölker',
      'dwarf': 'Robuste Bergbewohner und Handwerker',
      'halfling': 'Kleine, friedliche Naturvölker',
      'orc': 'Kriegerische und starke Stammesangehörige',
      'goblin': 'Kleine, schlaue und trickreiche Kreaturen',
      'dragonborn': 'Drachenähnliche humanoide Krieger',
      'tiefling': 'Dämonisches Erbe in humanoider Form',
      'aasimar': 'Himmlisches Erbe in humanoider Form',
      'gnome': 'Kleine, magisch begabte Tüftler'
    };

    return descriptions[species] || 'Fantastische humanoide Spezies';
  }

  /**
   * Get description for an extension species
   * @param {Object} extension - Extension data
   * @returns {string} Description
   */
  _getExtensionDescription(extension) {
    if (extension.keywords && extension.keywords.length > 0) {
      return `Eigenschaften: ${extension.keywords.join(', ')}`;
    }
    return `Erweiterte Spezies aus ${this._getModuleName(extension.moduleId)}`;
  }

  /**
   * Get module name from module ID
   * @param {string} moduleId - Module identifier
   * @returns {string} Module name
   */
  _getModuleName(moduleId) {
    const module = game.modules.get(moduleId);
    return module?.title || moduleId;
  }
}