/**
 * Emergency Names App - Quick NPC name generator
 * Updated to use V4 API internally
 */

import { getGlobalGenerator } from '../api/generator.js';
import { showLoadingState, hideLoadingState, copyToClipboard, fallbackCopyToClipboard } from '../utils/ui-helpers.js';
import { TEMPLATE_PATHS, CSS_CLASSES, GENDER_SYMBOLS, getSupportedGenders, MODULE_ID } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { getHistoryManager } from '../core/history-manager.js';
import { NamesHistoryApp } from './history-app.js';

export class EmergencyNamesApp extends Application {
  constructor(options = {}) {
    super(options);
    this.emergencyNames = [];
    this.generator = null;
    this._initialized = false;
    this.availableSpecies = [];
    this.enabledSpecies = new Set();
    this.isFilterExpanded = false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "emergency-names",
      title: game.i18n.localize("names.emergency.title") || "Schnelle NPC Namen",
      template: TEMPLATE_PATHS.emergency,
      width: 500,
      height: 760,
      resizable: false,
      classes: [CSS_CLASSES.emergencyApp]
    });
  }

  async getData() {
    if (!this.generator) {
      this.generator = getGlobalGenerator();
      await this.generator.initialize();
    }

    const language = this._getFoundryLanguage();
    const allSpecies = await this.generator.getAvailableSpecies(language);

    // Initialize enabled species if not already done
    if (this.enabledSpecies.size === 0) {
      allSpecies.forEach(s => this.enabledSpecies.add(s.code));
    }

    this.availableSpecies = allSpecies.map(s => ({
      code: s.code,
      displayName: this._getLocalizedSpecies(s.code),
      enabled: this.enabledSpecies.has(s.code)
    }));

    const speciesFilterCount = this.enabledSpecies.size === allSpecies.length
      ? game.i18n.localize("names.emergency.allSpeciesSelected")
      : `(${this.enabledSpecies.size}/${allSpecies.length})`;

    return {
      emergencyNames: this.emergencyNames,
      isLoading: false,
      availableSpecies: this.availableSpecies,
      speciesFilterLabel: game.i18n.localize("names.emergency.speciesFilter"),
      speciesFilterCount: speciesFilterCount
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.emergency-reroll-btn').off('click').on('click', this._onRerollNames.bind(this));
    html.find('.emergency-open-generator-btn').off('click').on('click', this._onOpenGenerator.bind(this));
    html.find('.emergency-name-pill').off('click').on('click', this._onCopyName.bind(this));
    html.find('#emergency-history-btn').off('click').on('click', this._onOpenHistory.bind(this));

    // Species filter listeners
    html.find('.species-filter-header').off('click').on('click', this._onToggleFilter.bind(this));
    html.find('.species-pill').off('click').on('click', this._onToggleSpecies.bind(this));
    html.find('.species-filter-action').off('click').on('click', this._onFilterAction.bind(this));

    this._initializeApp(html);
  }

  async _initializeApp(html) {
    // Prevent multiple initialization
    if (this._initialized) {
      logDebug("App already initialized, skipping");
      return;
    }

    try {
      logDebug("Generating initial emergency names");
      await this._generateEmergencyNames();
      this._initialized = true;
    } catch (error) {
      logError("Emergency app initialization failed", error);
      this._generateFallbackNames();
      this._updateNamesDisplay();
      this._initialized = true;
    }
  }

  async _generateEmergencyNames() {
    logDebug("Generating emergency names...");

    try {
      const language = this._getFoundryLanguage();
      logDebug(`Using language: ${language}`);

      const names = [];

      // Get available species for this language
      const availableSpecies = await this.generator.getAvailableSpecies(language);

      // Filter by enabled species
      const filteredSpecies = availableSpecies.filter(s => this.enabledSpecies.has(s.code));

      if (filteredSpecies.length === 0) {
        logWarn("No enabled species available, using fallback");
        this._generateFallbackNames();
        return;
      }

      logDebug("Available species:", filteredSpecies);

      // Generate 6 random names
      const supportedGenders = getSupportedGenders();

      logDebug('=== EMERGENCY GENERATION START ===');

      for (let i = 0; i < 6; i++) {
        try {
          const speciesObj = filteredSpecies[Math.floor(Math.random() * filteredSpecies.length)];
          const species = speciesObj.code;
          const gender = supportedGenders[Math.floor(Math.random() * supportedGenders.length)];
          const packageCode = `${species}-${language}`;

          const result = await this.generator.generatePersonName(packageCode, {
            locale: language,
            n: 1,
            gender: gender,
            components: ['firstname', 'surname'],
            format: '{firstname} {surname}',
            allowDuplicates: false
          });

          if (result.suggestions && result.suggestions.length > 0) {
            const suggestion = result.suggestions[0];
            names.push({
              name: suggestion.text,
              species: species,
              gender: gender,
              displaySpecies: this._getLocalizedSpecies(species)
            });

            // Debug output for each generated name
            logDebug(`[${i + 1}/6] Name: "${suggestion.text}" | Package: ${packageCode} | Gender: ${gender} | Catalog: ${suggestion.catalog || 'unknown'}`, suggestion.metadata);
          }
        } catch (error) {
          logWarn(`Failed to generate name ${i + 1}`, error);
        }
      }

      logDebug('=== EMERGENCY GENERATION END ===');

      // Fallback if no names generated
      if (names.length === 0) {
        logWarn("No names generated, using fallback");
        this._generateFallbackNames();
      } else {
        this.emergencyNames = names;
        logInfo(`Generated ${names.length} emergency names`);
        this._updateNamesDisplay();

        // Add to history
        this._addToHistory(names, language);
      }

    } catch (error) {
      logError("Emergency name generation failed", error);
      this._generateFallbackNames();
    }
  }

  _generateFallbackNames() {
    logDebug("Using fallback emergency names");
    const supportedGenders = getSupportedGenders();

    const fallbackNames = [
      { name: "Alaric Steinherz", species: "human", gender: "male", displaySpecies: game.i18n.localize("names.species.human") },
      { name: "Lyra Mondschein", species: "elf", gender: "female", displaySpecies: game.i18n.localize("names.species.elf") },
      { name: "Thorin Eisenfaust", species: "dwarf", gender: "male", displaySpecies: game.i18n.localize("names.species.dwarf") },
      { name: "Rosie Hügelkind", species: "halfling", gender: "female", displaySpecies: game.i18n.localize("names.species.halfling") },
      { name: "Grimjaw der Wilde", species: "orc", gender: "male", displaySpecies: game.i18n.localize("names.species.orc") }
    ];

    // Add nonbinary example if supported
    if (supportedGenders.includes('nonbinary')) {
      fallbackNames.push({
        name: "Raven Sternenwandler",
        species: "human",
        gender: "nonbinary",
        displaySpecies: game.i18n.localize("names.species.human")
      });
      logDebug("Added nonbinary fallback name");
    }

    this.emergencyNames = fallbackNames;
    logDebug(`Generated ${fallbackNames.length} fallback names`);
    this._updateNamesDisplay();
  }

  _getFoundryLanguage() {
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
      logDebug('Error getting Foundry language:', error);
      return 'de';
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

    await this._handleNameClick(name, nameElement);
  }

  /**
   * Handle name click - copy and/or post to chat based on settings
   */
  async _handleNameClick(name, nameEl) {
    const shouldCopy = game.settings.get(MODULE_ID, "nameClickCopy");
    const shouldPost = game.settings.get(MODULE_ID, "nameClickPost");

    // Copy to clipboard
    if (shouldCopy) {
      logDebug(`Copying name to clipboard: ${name}`);

      try {
        await copyToClipboard(name, game.i18n.format("names.emergency.nameCopied", { name: name }) || `Name "${name}" kopiert`);

        // Visual feedback
        nameEl.addClass('copied');
        setTimeout(() => nameEl.removeClass('copied'), 1000);

        logDebug(`Successfully copied name: ${name}`);
      } catch (error) {
        logWarn("Clipboard copy failed, using fallback", error);
        fallbackCopyToClipboard(name, game.i18n.format("names.emergency.nameCopied", { name: name }) || `Name "${name}" kopiert`);
      }
    }

    // Post to chat
    if (shouldPost) {
      await this._postNameToChat(name);
    }

    // If neither is enabled, do nothing (but show a hint)
    if (!shouldCopy && !shouldPost) {
      ui.notifications.info(game.i18n.localize('names.click-disabled-hint') ||
        'Name click actions are disabled. Enable them in module settings.');
    }
  }

  /**
   * Post a name to chat with configured privacy settings
   */
  async _postNameToChat(name) {
    const whisperSetting = game.settings.get(MODULE_ID, "nameClickPostWhisper");

    let whisperTargets = null;
    let rollMode = null;

    // Determine whisper/roll mode based on setting
    if (whisperSetting === "whisper") {
      // Whisper to GM only
      whisperTargets = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
      rollMode = CONST.DICE_ROLL_MODES.PRIVATE;
    } else if (whisperSetting === "public") {
      // Public message
      rollMode = CONST.DICE_ROLL_MODES.PUBLIC;
    } else {
      // Inherit current roll mode from chat
      rollMode = game.settings.get("core", "rollMode");

      // Apply roll mode rules
      if (rollMode === CONST.DICE_ROLL_MODES.PRIVATE) {
        whisperTargets = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
      } else if (rollMode === CONST.DICE_ROLL_MODES.BLIND) {
        whisperTargets = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
      }
    }

    // Create chat message
    const messageData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker(),
      content: `<div class="nomina-names-chat-post">
        <strong>${game.i18n.localize('names.generated-name') || 'Generated Name'}:</strong> ${name}
      </div>`,
      whisper: whisperTargets
    };

    await ChatMessage.create(messageData);

    logDebug(`Posted name to chat: ${name} (mode: ${whisperSetting})`);
  }

  /**
   * Opens the History App
   * @param {Event} event - The click event
   */
  _onOpenHistory(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Opening history from emergency app");

    new NamesHistoryApp().render(true);
  }

  /**
   * Add generated names to history
   * @param {Array} names - Array of name objects with name, species, gender
   * @param {string} language - Language code
   */
  _addToHistory(names, language) {
    const historyManager = getHistoryManager();

    const entries = names.map(nameObj => {
      const gender = nameObj.gender || '';

      return {
        name: nameObj.name,
        source: 'emergency',
        metadata: {
          language: language,
          species: nameObj.species,
          category: 'names',
          subcategory: gender,
          gender: gender,
          format: '{firstname} {surname}'
        }
      };
    });

    historyManager.addEntries(entries);

    logDebug(`Added ${entries.length} names to history from emergency app`);
  }

  /**
   * Toggle the species filter expand/collapse
   */
  _onToggleFilter(event) {
    event.preventDefault();
    const html = this.element;
    const filterContent = html.find('.species-filter-content');
    const toggleBtn = html.find('.species-filter-toggle i');

    this.isFilterExpanded = !this.isFilterExpanded;

    if (this.isFilterExpanded) {
      filterContent.slideDown(300);
      toggleBtn.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    } else {
      filterContent.slideUp(300);
      toggleBtn.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    }

    logDebug(`Species filter ${this.isFilterExpanded ? 'expanded' : 'collapsed'}`);
  }

  /**
   * Toggle individual species selection
   */
  _onToggleSpecies(event) {
    event.preventDefault();
    const btn = $(event.currentTarget);
    const species = btn.data('species');

    if (this.enabledSpecies.has(species)) {
      // Prevent deselecting the last species
      if (this.enabledSpecies.size <= 1) {
        logDebug(`Cannot deselect last species ${species}`);
        ui.notifications.warn(game.i18n.localize("names.emergency.minOneSpecies") || "Mindestens eine Spezies muss ausgewählt sein");
        return;
      }
      this.enabledSpecies.delete(species);
      btn.removeClass('active');
    } else {
      this.enabledSpecies.add(species);
      btn.addClass('active');
    }

    this._updateFilterLabel();
    logDebug(`Toggled species ${species}, now ${this.enabledSpecies.size} enabled`);
  }

  /**
   * Handle select all / select humans actions
   */
  _onFilterAction(event) {
    event.preventDefault();
    const action = $(event.currentTarget).data('action');
    const html = this.element;

    if (action === 'select-all') {
      this.availableSpecies.forEach(s => this.enabledSpecies.add(s.code));
      html.find('.species-pill').addClass('active');
      logDebug('Selected all species');
    } else if (action === 'select-humans') {
      // Deselect all first
      this.enabledSpecies.clear();
      html.find('.species-pill').removeClass('active');

      // Try to find 'human' species, otherwise take first alphabetically
      const humanSpecies = this.availableSpecies.find(s => s.code === 'human');
      const targetSpecies = humanSpecies || this.availableSpecies.sort((a, b) => a.code.localeCompare(b.code))[0];

      if (targetSpecies) {
        this.enabledSpecies.add(targetSpecies.code);
        html.find(`.species-pill[data-species="${targetSpecies.code}"]`).addClass('active');
        logDebug(`Selected only ${targetSpecies.code} species`);
      }
    }

    this._updateFilterLabel();
  }

  /**
   * Update the species filter label text
   */
  _updateFilterLabel() {
    const html = this.element;
    const countSpan = html.find('.species-filter-count');
    const totalSpecies = this.availableSpecies.length;

    const countText = this.enabledSpecies.size === totalSpecies
      ? game.i18n.localize("names.emergency.allSpeciesSelected")
      : `(${this.enabledSpecies.size}/${totalSpecies})`;

    countSpan.text(countText);
  }
}
