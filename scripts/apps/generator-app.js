/**
 * Names Generator App - Main application for generating names
 * Updated for simplified UI with gender and component checkboxes
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, DEFAULT_NAME_FORMAT } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

export class NamesGeneratorApp extends Application {
  constructor(options = {}) {
    super(options);
    this.supportedGenders = getSupportedGenders();
    this.enhancedDropdowns = new Map(); // Store Enhanced Dropdown instances
    logDebug("NamesGeneratorApp initialized with supported genders:", this.supportedGenders);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-generator",
      title: game.i18n.localize("names.title"),
      template: TEMPLATE_PATHS.generator,
      width: 450,
      height: 750,
      resizable: true,
      classes: [CSS_CLASSES.moduleApp]
    });
  }

  async getData() {
    ensureGlobalNamesData();
    const globalNamesData = getGlobalNamesData();
    
    if (globalNamesData) {
      await globalNamesData.initializeData();
    }

    const data = {
      languages: globalNamesData ? globalNamesData.getLocalizedLanguages() : [],
      species: globalNamesData ? globalNamesData.getLocalizedSpecies() : [],
      isLoading: globalNamesData ? globalNamesData.isLoading : false,
      isLoaded: globalNamesData ? globalNamesData.isLoaded : false,
      supportedGenders: getSupportedGenders()
    };

    logDebug("Generator app data prepared:", {
      languages: data.languages.length,
      species: data.species.length,
      isLoading: data.isLoading,
      isLoaded: data.isLoaded
    });

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Update supported genders on render
    this.supportedGenders = getSupportedGenders();
    logDebug("Updated supported genders:", this.supportedGenders);

    html.find('#names-generate-btn').click(this._onGenerateName.bind(this));
    html.find('#names-copy-btn').click(this._onCopyName.bind(this));
    html.find('#names-clear-btn').click(this._onClearResult.bind(this));

    html.find('input[type="checkbox"]').change(this._onCheckboxChange.bind(this));

    // Store Enhanced Dropdown instances and bind to their change events
    this._initializeEnhancedDropdowns(html);

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.isLoading) {
      logDebug("Data still loading, showing loading state");
      showLoadingState(html);
      this._waitForLoadingComplete(html);
    } else {
      this._updateUI(html);
    }
  }

  _initializeEnhancedDropdowns(html) {
    // Wait for Enhanced Dropdowns to be initialized
    setTimeout(() => {
      const languageSelect = html[0].querySelector('#names-language-select');
      const speciesSelect = html[0].querySelector('#names-species-select');
      const categorySelect = html[0].querySelector('#names-category-select');

      // Find Enhanced Dropdown instances by checking the next sibling
      if (languageSelect && languageSelect.nextElementSibling && languageSelect.nextElementSibling.classList.contains('enhanced-dropdown')) {
        this.enhancedDropdowns.set('language', languageSelect.nextElementSibling._enhancedDropdown);
      }
      if (speciesSelect && speciesSelect.nextElementSibling && speciesSelect.nextElementSibling.classList.contains('enhanced-dropdown')) {
        this.enhancedDropdowns.set('species', speciesSelect.nextElementSibling._enhancedDropdown);
      }
      if (categorySelect && categorySelect.nextElementSibling && categorySelect.nextElementSibling.classList.contains('enhanced-dropdown')) {
        this.enhancedDropdowns.set('category', categorySelect.nextElementSibling._enhancedDropdown);
      }

      // If Enhanced Dropdowns aren't ready yet, try again with longer delay
      if (!this.enhancedDropdowns.has('language')) {
        setTimeout(() => this._initializeEnhancedDropdowns(html), 200);
        return;
      }

      // Bind change events for Enhanced Dropdowns
      html.find('#names-language-select, #names-species-select, #names-category-select').change(this._onDropdownChange.bind(this));

      logDebug("Enhanced Dropdowns initialized and bound:", Array.from(this.enhancedDropdowns.keys()));
    }, 100);
  }

  async _waitForLoadingComplete(html) {
    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.loadingPromise) {
      logDebug("Waiting for data loading to complete");
      await globalNamesData.loadingPromise;
    }
    
    hideLoadingState(html);
    this._updateUI(html);
    logDebug("Data loading completed, UI updated");
    this.render(false);
  }

  _onCheckboxChange(event) {
    const $form = $(event.currentTarget).closest('form');
    this._updateGenerateButtonState($form);
    logDebug(`Checkbox changed: ${event.currentTarget.name} = ${event.currentTarget.checked}`);
  }

  _onDropdownChange(event) {
    const $form = $(event.currentTarget).closest('form');
    const changedElement = event.currentTarget;
    logDebug(`Dropdown changed: ${changedElement.name} = ${changedElement.value}`);
    this._updateUI($form);
  }

  async _updateUI($form) {
    const language = $form.find('#names-language-select').val();
    const species = $form.find('#names-species-select').val();
    const category = $form.find('#names-category-select').val();

    logDebug("Updating UI with selection:", { language, species, category });

    await this._updateGenderCheckboxes($form, language, species);
    this._toggleNamesPanels($form, category);
    this._updateGenerateButtonState($form);
  }

  async _updateGenderCheckboxes(html, language, species) {
    const globalNamesData = getGlobalNamesData();
    const container = html.find('#gender-checkboxes-container');
    
    if (!globalNamesData || !language || !species) {
      // Clear gender checkboxes if no data available
      container.empty();
      logDebug("Clearing gender checkboxes - missing data, language, or species");
      return;
    }

    const supportedGenders = getSupportedGenders();
    const availableGenders = [];

    logDebug(`Checking gender data availability for ${language}.${species}`, { supportedGenders });

    // Check which genders have data available - try to load if not present
    for (const gender of supportedGenders) {
      const key = `${language}.${species}.${gender}`;
      
      // First check if data exists
      let hasData = globalNamesData.hasData(key);
      
      // If not, try to load it
      if (!hasData) {
        try {
          hasData = await globalNamesData.ensureDataLoaded(language, species, gender);
          logDebug(`Attempted to load data for ${key}: ${hasData}`);
        } catch (error) {
          logDebug(`Failed to load data for ${key}:`, error.message);
        }
      }
      
      if (hasData) {
        availableGenders.push(gender);
        logDebug(`Gender ${gender} has data available`);
      }
    }

    logDebug(`Available genders for ${language}.${species}:`, availableGenders);

    if (availableGenders.length === 0) {
      container.empty();
      logDebug("No gender data available for current selection");
      return;
    }

    // Generate gender checkboxes
    let checkboxesHtml = '';
    for (const gender of availableGenders) {
      const locKey = `names.categories.${gender}`;
      const genderLabel = game.i18n.localize(locKey) || gender;
      const isChecked = availableGenders.length === 1 ? 'checked' : ''; // Auto-select if only one option
      
      checkboxesHtml += `
        <label class="names-module-checkbox-item">
          <input type="checkbox" name="names-gender-${gender}" ${isChecked}>
          <span class="names-module-checkmark"></span>
          ${genderLabel}
        </label>
      `;
    }

    container.html(checkboxesHtml);
    
    // Bind change events to new checkboxes
    container.find('input[type="checkbox"]').change(this._onCheckboxChange.bind(this));

    logDebug(`Updated gender checkboxes for ${language}.${species}:`, availableGenders);
  }

  _toggleNamesPanels(html, category) {
    const genderPanel = html.find('.names-module-gender-section');
    const componentsPanel = html.find('.names-module-components-section');
    const formatGroup = html.find('.names-module-format-group');

    if (category === 'names') {
      genderPanel.show();
      componentsPanel.show();
      formatGroup.show();
      logDebug("Showing names panels for name generation");
    } else {
      genderPanel.hide();
      componentsPanel.hide();
      formatGroup.hide();
      logDebug(`Hiding names panels for category: ${category}`);
    }
  }

  _updateGenerateButtonState(html) {
    const generateBtn = html.find('#names-generate-btn');
    const language = html.find('#names-language-select').val();
    const species = html.find('#names-species-select').val();
    const category = html.find('#names-category-select').val();

    let isDisabled = !language || !species || !category;

    if (category === 'names') {
      // For names, check if at least one gender OR one component is selected
      // Smart default: if nothing is selected, allow generation (will use all internally)
      const genderCheckboxes = html.find('input[name^="names-gender-"]:checked');
      const componentCheckboxes = html.find('input[name^="names-include-"]:checked');
      
      // Allow generation if either genders or components are selected, or if none are selected (smart default)
      const hasGenderSelection = genderCheckboxes.length > 0;
      const hasComponentSelection = componentCheckboxes.length > 0;
      const noSelections = genderCheckboxes.length === 0 && componentCheckboxes.length === 0;
      
      if (!hasGenderSelection && !hasComponentSelection && !noSelections) {
        isDisabled = true;
      }
    }

    generateBtn.prop('disabled', isDisabled);
    
    if (isDisabled) {
      logDebug("Generate button disabled: missing required fields or selections");
    } else {
      logDebug("Generate button enabled");
    }
  }

  async _onGenerateName(event) {
    event.preventDefault();
    logDebug("Generate name button clicked");

    const form = event.currentTarget.closest('form');
    const formData = new FormData(form);

    const language = formData.get('names-language');
    const species = formData.get('names-species');
    const category = formData.get('names-category');
    const nameFormat = formData.get('names-format') || DEFAULT_NAME_FORMAT;
    const count = parseInt(formData.get('names-count')) || 1;

    logInfo(`Generating ${count} names: ${language}.${species}.${category}`);

    if (!language || !species || !category) {
      ui.notifications.warn(game.i18n.localize("names.select-all"));
      return;
    }

    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) {
      logError("Data manager not available for name generation");
      ui.notifications.error("Names data manager not available");
      return;
    }

    try {
      const results = [];

      for (let i = 0; i < count; i++) {
        let generatedName;

        if (category === 'names') {
          generatedName = await this._generateNameWithSelections(form, language, species, nameFormat);
        } else {
          generatedName = await this._generateSimpleName(language, species, category);
        }

        if (generatedName) {
          results.push(generatedName);
          logDebug(`Generated name ${i + 1}/${count}: ${generatedName}`);
        }
      }

      if (results.length === 0) {
        throw new Error(game.i18n.localize("names.no-names-generated"));
      }

      const resultDiv = form.querySelector('#names-result-display');
      const authorCredits = this._collectAuthorCredits(language, species, [category]);

      let resultsHtml = results.map(name =>
        `<div class="${CSS_CLASSES.generatedName}">${name}</div>`
      ).join('');

      resultDiv.innerHTML = resultsHtml + authorCredits;

      form.querySelector('#names-copy-btn').disabled = false;
      form.querySelector('#names-clear-btn').disabled = false;

      logInfo(`Successfully generated ${results.length} names`);

    } catch (error) {
      logError("Name generation failed", error);
      const errorMsg = game.i18n.format("names.generation-error", { error: error.message });
      ui.notifications.error(errorMsg);
    }
  }

  async _generateNameWithSelections(form, language, species, nameFormat) {
    const $form = $(form);
    
    // Get selected genders (with smart default)
    const selectedGenders = [];
    $form.find('input[name^="names-gender-"]:checked').each(function() {
      const genderName = this.name.replace('names-gender-', '');
      selectedGenders.push(genderName);
    });

    // Smart default: if no genders selected, use all available genders
    let gendersToUse = selectedGenders;
    if (selectedGenders.length === 0) {
      gendersToUse = [];
      $form.find('input[name^="names-gender-"]').each(function() {
        const genderName = this.name.replace('names-gender-', '');
        gendersToUse.push(genderName);
      });
      logDebug("No genders selected, using all available:", gendersToUse);
    }

    if (gendersToUse.length === 0) {
      throw new Error("No gender data available for name generation");
    }

    // Get selected components (with smart default)
    const selectedComponents = [];
    if ($form.find('input[name="names-include-firstname"]:checked').length) selectedComponents.push('firstname');
    if ($form.find('input[name="names-include-surname"]:checked').length) selectedComponents.push('surname');
    if ($form.find('input[name="names-include-title"]:checked').length) selectedComponents.push('title');
    if ($form.find('input[name="names-include-nickname"]:checked').length) selectedComponents.push('nickname');

    // Smart default: if no components selected, use firstname and surname
    let componentsToUse = selectedComponents;
    if (selectedComponents.length === 0) {
      componentsToUse = ['firstname', 'surname'];
      logDebug("No components selected, using default:", componentsToUse);
    }

    // Randomly select a gender for this generation
    const randomGender = gendersToUse[Math.floor(Math.random() * gendersToUse.length)];
    
    logDebug(`Generating formatted name with gender: ${randomGender}, components:`, componentsToUse);
    return await this._generateFormattedName(language, species, randomGender, componentsToUse, nameFormat);
  }

  async _generateSimpleName(language, species, category) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const hasData = await globalNamesData.ensureDataLoaded(language, species, category);
    if (!hasData) {
      logWarn(`No data available for ${language}.${species}.${category}`);
      throw new Error(game.i18n.localize("names.data-not-available"));
    }

    if (category === 'settlements') {
      const settlementData = globalNamesData.getData(`${language}.${species}.settlements`);
      if (!settlementData?.settlements) {
        throw new Error(`Keine Siedlungsdaten für ${language}.${species}`);
      }
      const settlements = settlementData.settlements;
      const settlement = settlements[Math.floor(Math.random() * settlements.length)];
      const result = settlement.name || settlement;
      logDebug(`Generated settlement name: ${result}`);
      return result;
    } else {
      return this._getRandomFromData(language, species, category);
    }
  }

  async _generateFormattedName(language, species, gender, components, nameFormat) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    // Map components to correct data categories
    const componentToCategoryMap = {
      'firstname': gender,
      'surname': 'surnames',
      'title': 'titles', 
      'nickname': 'nicknames'
    };

    // Ensure all required data is loaded
    for (const component of components) {
      const category = componentToCategoryMap[component];
      if (category) {
        const hasData = await globalNamesData.ensureDataLoaded(language, species, category);
        if (!hasData) {
          logWarn(`No data available for ${language}.${species}.${category}`);
        }
      }
    }

    let selectedSettlement = null;

    if (components.includes('title')) {
      const settlementData = globalNamesData.getData(`${language}.${species}.settlements`);
      if (settlementData?.settlements) {
        const settlements = settlementData.settlements;
        selectedSettlement = settlements[Math.floor(Math.random() * settlements.length)];
        logDebug("Selected settlement for title:", selectedSettlement?.name);
      }
    }

    const nameComponents = {};
    for (const component of components) {
      try {
        let part = await this._generateNameComponent(language, species, gender, component, selectedSettlement);
        if (part) {
          nameComponents[component] = part;
          logDebug(`Generated ${component}: ${part}`);
        }
      } catch (error) {
        logWarn(`Failed to generate component ${component}`, error);
      }
    }

    if (Object.keys(nameComponents).length === 0) {
      throw new Error(game.i18n.localize("names.no-names-generated"));
    }

    const formattedName = this._formatName(nameFormat, nameComponents);
    logDebug("Formatted name:", formattedName);
    return formattedName;
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

  async _generateNameComponent(language, species, gender, component, settlement) {
    switch (component) {
      case 'firstname':
        return this._getRandomFromData(language, species, gender);

      case 'surname':
        return this._getRandomFromData(language, species, 'surnames'); // Correct: plural

      case 'title':
        return this._generateTitle(language, species, gender, settlement);

      case 'nickname':
        const nickname = this._getRandomFromGenderedData(language, species, 'nicknames', gender); // Correct: plural
        return nickname ? `"${nickname}"` : null;

      default:
        logWarn(`Unknown name component: ${component}`);
        return null;
    }
  }

  _generateTitle(language, species, gender, settlement) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const titleData = globalNamesData.getData(`${language}.${species}.titles`);
    if (!titleData?.titles) {
      logDebug(`No title data found for ${language}.${species}`);
      return null;
    }

    const genderTitles = titleData.titles[gender];
    if (!genderTitles || genderTitles.length === 0) {
      logDebug(`No ${gender} titles found for ${language}.${species}`);
      
      if (gender === 'nonbinary' && titleData.titles.male) {
        const maleTitles = titleData.titles.male;
        const selectedTitle = maleTitles[Math.floor(Math.random() * maleTitles.length)];
        if (settlement && selectedTitle.template) {
          return this._formatTitleWithSettlement(selectedTitle, settlement, language, species);
        }
        logDebug("Using male title as fallback for nonbinary");
        return selectedTitle.name || selectedTitle;
      }
      return null;
    }

    const selectedTitle = genderTitles[Math.floor(Math.random() * genderTitles.length)];

    if (settlement && selectedTitle.template) {
      return this._formatTitleWithSettlement(selectedTitle, settlement, language, species);
    }

    return selectedTitle.name || selectedTitle;
  }

  _formatTitleWithSettlement(title, settlement, language, species) {
    if (!title.template) return title.name || title;

    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return title.name || title;

    const grammarRules = globalNamesData.getGrammarRules(language, species);
    let article = title.preposition || 'von';

    if (grammarRules?.articles && title.preposition) {
      const prepositionRules = grammarRules.articles[title.preposition];
      if (prepositionRules) {
        const gender = settlement.gender || 'n';
        article = prepositionRules[gender] || title.preposition;
      }
    }

    const formattedTitle = title.template
      .replace('{preposition}', article)
      .replace('{settlement}', settlement.name);

    logDebug("Formatted title with settlement:", formattedTitle);
    return formattedTitle;
  }

  _getRandomFromData(language, species, category) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const key = `${language}.${species}.${category}`;
    const data = globalNamesData.getData(key);

    if (!data?.names || data.names.length === 0) {
      logDebug(`No data found for ${key}`);
      return null;
    }

    const selectedName = data.names[Math.floor(Math.random() * data.names.length)];
    logDebug(`Selected from ${key}: ${selectedName}`);
    return selectedName;
  }

  _getRandomFromGenderedData(language, species, category, gender) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

    const key = `${language}.${species}.${category}`;
    const data = globalNamesData.getData(key);

    if (data?.names && typeof data.names === 'object' && data.names[gender]) {
      const genderNames = data.names[gender];
      if (genderNames.length === 0) {
        logDebug(`No ${gender} names found for ${key}`);
        return null;
      }
      const selectedName = genderNames[Math.floor(Math.random() * genderNames.length)];
      logDebug(`Selected ${gender} name from ${key}: ${selectedName}`);
      return selectedName;
    }

    if (data?.names && Array.isArray(data.names)) {
      const selectedName = data.names[Math.floor(Math.random() * data.names.length)];
      logDebug(`Selected ungendered name from ${key}: ${selectedName}`);
      return selectedName;
    }

    logDebug(`No gendered data found for ${key}`);
    return null;
  }

  _collectAuthorCredits(language, species, components) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return '';

    const authors = new Map();

    for (const component of components) {
      const key = `${language}.${species}.${component}`;
      const data = globalNamesData.getData(key);

      if (data?.authors) {
        for (const author of data.authors) {
          const authorKey = author.name || author.email || 'Unbekannt';
          authors.set(authorKey, author);
        }
      }
    }

    if (authors.size === 0) return '';

    logDebug(`Collected credits from ${authors.size} authors`);

    let creditsHtml = '<div class="names-module-author-credits"><strong>Quellen:</strong><br>';

    for (const [key, author] of authors) {
      creditsHtml += `<div class="names-module-author-entry">`;
      creditsHtml += `<span class="names-module-author-name">${author.name || 'Unbekannt'}</span>`;

      const links = [];
      if (author.email) links.push(`<a href="mailto:${author.email}" title="E-Mail">✉️</a>`);
      if (author.url) links.push(`<a href="${author.url}" target="_blank" title="Website">🌐</a>`);
      if (author.github) links.push(`<a href="${author.github}" target="_blank" title="GitHub">💻</a>`);
      if (author.twitter) links.push(`<a href="${author.twitter}" target="_blank" title="Twitter">🦅</a>`);

      if (links.length > 0) {
        creditsHtml += ` <span class="names-module-author-links">${links.join(' ')}</span>`;
      }

      creditsHtml += `</div>`;
    }

    creditsHtml += '</div>';
    return creditsHtml;
  }

  async _onCopyName(event) {
    event.preventDefault();
    logDebug("Copy names button clicked");

    const form = event.currentTarget.closest('form');
    const nameElements = form.querySelectorAll('.names-module-generated-name');
    if (nameElements.length === 0) return;

    const names = Array.from(nameElements).map(el => el.textContent).join('\n');

    try {
      await navigator.clipboard.writeText(names);
      ui.notifications.info(game.i18n.localize("names.copied"));
      logInfo(`Copied ${nameElements.length} names to clipboard`);
    } catch (error) {
      logWarn("Clipboard copy failed, using fallback", error);
      this._fallbackCopyToClipboard(names);
    }
  }

  _fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      ui.notifications.info(game.i18n.localize("names.copied"));
      logInfo("Successfully copied names using fallback method");
    } catch (error) {
      logError("Fallback copy method failed", error);
      ui.notifications.error(game.i18n.localize("names.copy-error"));
    }

    document.body.removeChild(textArea);
  }

  _onClearResult(event) {
    event.preventDefault();
    logDebug("Clear results button clicked");

    const form = event.currentTarget.closest('form');
    const resultDiv = form.querySelector('#names-result-display');

    resultDiv.innerHTML = `<div class="names-module-no-result">${game.i18n.localize("names.select-options")}</div>`;

    form.querySelector('#names-copy-btn').disabled = true;
    form.querySelector('#names-clear-btn').disabled = true;

    logDebug("Results cleared and buttons disabled");
  }
}