/**
 * Emergency Names App - Quick NPC name generator
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState, copyToClipboard, fallbackCopyToClipboard } from '../utils/ui-helpers.js';
import { TEMPLATE_PATHS, CSS_CLASSES, GENDER_SYMBOLS, getSupportedGenders } from '../shared/constants.js';

export class EmergencyNamesApp extends Application {
  constructor(options = {}) {
    super(options);
    this.emergencyNames = [];
    this.availableSpecies = ['human', 'elf', 'dwarf', 'halfling', 'orc'];
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
      console.warn("Names Module: globalNamesData not available, creating temporary instance");
      return {
        emergencyNames: this.emergencyNames,
        isLoading: false
      };
    }

    // Initialize data
    try {
      await globalNamesData.initializeData();
    } catch (error) {
      console.warn("Names Module: Failed to initialize data:", error);
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
    try {
      const globalNamesData = getGlobalNamesData();
      
      if (globalNamesData && globalNamesData.isLoading) {
        showLoadingState(html);
        await this._waitForLoadingComplete(html);
      } else {
        await this._generateEmergencyNames();
      }
    } catch (error) {
      console.error("Names Module: Emergency app initialization failed:", error);
      this._generateFallbackNames();
      this._updateNamesDisplay();
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
      console.warn("Names Module: Loading failed, using fallback:", error);
      this._generateFallbackNames();
      this._updateNamesDisplay();
    }
  }

  async _generateEmergencyNames() {
    console.log("Names Module: Generating emergency names...");
    
    try {
      const language = this._getFoundryLanguage();
      console.log("Names Module: Using language:", language);
      
      const names = [];
      const globalNamesData = getGlobalNamesData();
      
      // Check if data is loaded
      if (!globalNamesData || !globalNamesData.isLoaded) {
        console.warn("Names Module: Data not loaded, using fallback names");
        this._generateFallbackNames();
        return;
      }

      // Determine available species
      const availableSpecies = this._getAvailableSpecies(language);
      console.log("Names Module: Available species:", availableSpecies);
      
      if (availableSpecies.length === 0) {
        console.warn("Names Module: No species data available, using fallback");
        this._generateFallbackNames();
        return;
      }
      
      let i = 0;
      while (names.length < 6) {
        try {
          const species = availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
          const gender = this._getRandomGender();
          
          const name = await this._generateSingleName(language, species, gender);
          if (name) {
            names.push({
              name: name,
              species: species,
              gender: gender,
              displaySpecies: this._getLocalizedSpecies(species)
            });
            $i++;
          }
        } catch (error) {
          console.warn(`Names Module: Failed to generate name ${i}:`, error);
        }
      }

      // Fallback if no names generated
      if (names.length === 0) {
        console.warn("Names Module: No names generated, using fallback");
        this._generateFallbackNames();
      } else {
        this.emergencyNames = names;
        console.log("Names Module: Generated", names.length, "emergency names");
        this._updateNamesDisplay();
      }

    } catch (error) {
      console.error("Names Module: Emergency name generation failed:", error);
      this._generateFallbackNames();
    }
  }

  _generateFallbackNames() {
    console.log("Names Module: Using fallback emergency names");
    const supportedGenders = getSupportedGenders();
    this.emergencyNames = [
      { name: "Alaric Steinherz", species: "human", gender: "male", displaySpecies: "Mensch" },
      { name: "Lyra Mondschein", species: "elf", gender: "female", displaySpecies: "Elf" },
      { name: "Thorin Eisenfaust", species: "dwarf", gender: "male", displaySpecies: "Zwerg" },
      { name: "Rosie Hügelkind", species: "halfling", gender: "female", displaySpecies: "Halbling" },
      { name: "Grimjaw der Wilde", species: "orc", gender: "male", displaySpecies: "Ork" }
    ];

    // Add nonbinary example if supported
    if (supportedGenders.includes('nonbinary')) {
      this.emergencyNames.push({ 
        name: "Raven Sternenwandler", 
        species: "human", 
        gender: "nonbinary", 
        displaySpecies: "Mensch" 
      });
    }
    
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
    console.log("Names Module: Foundry lang:", foundryLang, "mapped to:", mappedLang);
    
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(mappedLang)) {
      return mappedLang;
    }
    
    if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.size > 0) {
      const firstLang = Array.from(globalNamesData.availableLanguages)[0];
      console.log("Names Module: Using first available language:", firstLang);
      return firstLang;
    }
    
    return 'de';
  }

  _getAvailableSpecies(language) {
    const speciesWithData = new Set();
    const globalNamesData = getGlobalNamesData();
    const supportedGenders = getSupportedGenders();
    
    if (globalNamesData && globalNamesData.nameData) {
      for (const [key, data] of globalNamesData.nameData.entries()) {
        const [dataLang, dataSpecies, dataCategory] = key.split('.');
        if (dataLang === language && supportedGenders.includes(dataCategory)) {
          speciesWithData.add(dataSpecies);
        }
      }
    }
    
    const result = Array.from(speciesWithData).length > 0 ? 
           Array.from(speciesWithData) : 
           ['human', 'elf', 'dwarf'];
           
    console.log("Names Module: Species with data for", language, ":", result);
    return result;
  }

  _getRandomGender() {
    const supportedGenders = getSupportedGenders();
    return supportedGenders[Math.floor(Math.random() * supportedGenders.length)];
  }

  async _generateSingleName(language, species, gender) {
    try {
      const firstName = this._getRandomFromData(language, species, gender);
      const lastName = this._getRandomFromData(language, species, 'surnames');
      
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      } else if (firstName) {
        return firstName;
      }
      
      return null;
    } catch (error) {
      console.warn(`Names Module: Failed to generate name for ${language}.${species}.${gender}:`, error);
      return null;
    }
  }

  _getRandomFromData(language, species, category) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData || !globalNamesData.nameData) {
      return null;
    }

    const key = `${language}.${species}.${category}`;
    const data = globalNamesData.getData(key);

    if (!data?.names || data.names.length === 0) {
      console.warn(`Names Module: No data found for key: ${key}`);
      return null;
    }

    return data.names[Math.floor(Math.random() * data.names.length)];
  }

  _getLocalizedSpecies(species) {
    const locKey = `names.species.${species}`;
    return game.i18n.localize(locKey) || species.charAt(0).toUpperCase() + species.slice(1);
  }

  _updateNamesDisplay() {
    const html = this.element;
    if (!html || html.length === 0) {
      console.warn("Names Module: Cannot update display - element not found");
      return;
    }
    
    const container = html.find('.emergency-names-grid');
    if (container.length === 0) {
      console.warn("Names Module: Cannot find emergency names grid container");
      return;
    }
    
    console.log("Names Module: Updating display with", this.emergencyNames.length, "names");
    
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
    console.log("Names Module: Reroll button clicked");
    event.preventDefault();
    
    const html = this.element;
    const rerollBtn = html.find('.emergency-reroll-btn');
    
    rerollBtn.prop('disabled', true);
    rerollBtn.html('<i class="fas fa-spinner fa-spin"></i> ' + (game.i18n.localize("names.emergency.generating") || "Generiere..."));
    
    try {
      await this._generateEmergencyNames();
    } catch (error) {
      console.error("Names Module: Reroll failed:", error);
      ui.notifications.error("Fehler beim Generieren der Namen");
    } finally {
      rerollBtn.prop('disabled', false);
      rerollBtn.html('<i class="fas fa-dice"></i> ' + (game.i18n.localize("names.emergency.reroll") || "Neue Namen"));
    }
  }

  _onOpenGenerator() {
    console.log("Names Module: Opening main generator");
    // Import dynamically to avoid circular dependencies
    import('./generator-app.js').then(({ NamesGeneratorApp }) => {
      new NamesGeneratorApp().render(true);
    });
    this.close();
  }

  async _onCopyName(event) {
    console.log("Names Module: Copy name clicked");
    event.preventDefault();
    
    const nameElement = $(event.currentTarget);
    const name = nameElement.data('name');
    
    if (!name) {
      console.warn("Names Module: No name data found");
      return;
    }

    try {
      await copyToClipboard(name, game.i18n.format("names.emergency.nameCopied", { name: name }) || `Name "${name}" kopiert`);
      
      // Visual feedback
      nameElement.addClass('copied');
      setTimeout(() => nameElement.removeClass('copied'), 1000);
      
    } catch (error) {
      console.warn("Names Module: Clipboard copy failed:", error);
      fallbackCopyToClipboard(name, game.i18n.format("names.emergency.nameCopied", { name: name }) || `Name "${name}" kopiert`);
    }
  }
}