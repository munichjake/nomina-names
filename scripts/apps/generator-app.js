/**
 * Names Generator App - Main application for generating names
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, DEFAULT_NAME_FORMAT } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

export class NamesGeneratorApp extends Application {
  constructor(options = {}) {
    super(options);
    this.supportedGenders = getSupportedGenders();
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
      categories: globalNamesData ? Array.from(globalNamesData.availableCategories).sort() : [],
      isLoading: globalNamesData ? globalNamesData.isLoading : false,
      isLoaded: globalNamesData ? globalNamesData.isLoaded : false,
      supportedGenders: getSupportedGenders()
    };

    logDebug("Generator app data prepared:", {
      languages: data.languages.length,
      species: data.species.length,
      categories: data.categories.length,
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

    html.find('input[type="checkbox"]').change(this._onComponentChange.bind(this));
    html.find('select').change(this._onDropdownChange.bind(this));

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.isLoading) {
      logDebug("Data still loading, showing loading state");
      showLoadingState(html);
      this._waitForLoadingComplete(html);
    } else {
      this._updateUI(html);
    }
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

  _onComponentChange(event) {
    const form = event.currentTarget.closest('form');
    const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    const generateBtn = form.querySelector('#names-generate-btn');

    generateBtn.disabled = checkboxes.length === 0;
    logDebug(`Component selection changed: ${checkboxes.length} components selected`);
  }

  _onDropdownChange(event) {
    const $form = $(event.currentTarget).closest('form');
    const changedElement = event.currentTarget;
    logDebug(`Dropdown changed: ${changedElement.name} = ${changedElement.value}`);
    this._updateUI($form);
  }

  _updateUI($form) {
    const language = $form.find('#names-language-select').val();
    const species = $form.find('#names-species-select').val();
    const category = $form.find('#names-category-select').val();

    logDebug("Updating UI with selection:", { language, species, category });

    this._updateCategoryOptions($form, language, species);
    this._toggleNameComponentsPanel($form, category);
    this._updateGenerateButtonState($form, category);
  }

  _updateCategoryOptions(html, language, species) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return;

    const categorySelect = html.find('#names-category-select');
    const currentValue = categorySelect.val();

    categorySelect.find('option:not(:first)').remove();

    if (language && species) {
      const availableCategories = new Set();
      const supportedGenders = getSupportedGenders();

      for (const [key, data] of globalNamesData.nameData.entries()) {
        const [dataLang, dataSpecies, dataCategory] = key.split('.');
        if (dataLang === language && dataSpecies === species) {
          // Only show categories that are either not gender-specific or are supported genders
          if (!supportedGenders.includes(dataCategory) || supportedGenders.includes(dataCategory)) {
            availableCategories.add(dataCategory);
          }
        }
      }

      // Filter out unsupported genders
      const filteredCategories = Array.from(availableCategories).filter(category => {
        return !this.supportedGenders || !this.supportedGenders.includes(category) || supportedGenders.includes(category);
      });

      const localizedCategories = [];
      for (const category of filteredCategories) {
        const locKey = `names.categories.${category}`;
        localizedCategories.push({
          code: category,
          name: game.i18n.localize(locKey) || category
        });
      }

      localizedCategories.sort((a, b) => a.name.localeCompare(b.name));

      for (const category of localizedCategories) {
        categorySelect.append(`<option value="${category.code}">${category.name}</option>`);
      }

      if (currentValue && filteredCategories.includes(currentValue)) {
        categorySelect.val(currentValue);
      }

      logDebug(`Updated category options for ${language}.${species}:`, filteredCategories);
    }
  }

  _toggleNameComponentsPanel(html, category) {
    const panel = html.find('.names-module-components-section');
    const formatGroup = html.find('.names-module-format-group');

    if (this.supportedGenders.includes(category)) {
      panel.show();
      formatGroup.show();
      logDebug(`Showing components panel for gender category: ${category}`);
    } else {
      panel.hide();
      formatGroup.hide();
      logDebug(`Hiding components panel for non-gender category: ${category}`);
    }
  }

  _updateGenerateButtonState(html, category) {
    const generateBtn = html.find('#names-generate-btn');
    const language = html.find('#names-language-select').val();
    const species = html.find('#names-species-select').val();

    if (this.supportedGenders.includes(category)) {
      const checkboxes = html.find('input[type="checkbox"]:checked');
      const isDisabled = !language || !species || !category || checkboxes.length === 0;
      generateBtn.prop('disabled', isDisabled);
      
      if (isDisabled) {
        logDebug("Generate button disabled: missing required fields or components");
      }
    } else {
      const isDisabled = !language || !species || !category;
      generateBtn.prop('disabled', isDisabled);
      
      if (isDisabled) {
        logDebug("Generate button disabled: missing required fields");
      }
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

    const hasData = await globalNamesData.ensureDataLoaded(language, species, category);
    if (!hasData) {
      logWarn(`No data available for ${language}.${species}.${category}`);
      ui.notifications.error(game.i18n.localize("names.data-not-available"));
      return;
    }

    try {
      const results = [];

      for (let i = 0; i < count; i++) {
        let generatedName;

        if (this.supportedGenders.includes(category)) {
          const selectedComponents = [];
          if (formData.get('names-include-firstname')) selectedComponents.push('firstname');
          if (formData.get('names-include-surname')) selectedComponents.push('surname');
          if (formData.get('names-include-title')) selectedComponents.push('title');
          if (formData.get('names-include-nickname')) selectedComponents.push('nickname');

          if (selectedComponents.length === 0) {
            ui.notifications.warn(game.i18n.localize("names.select-components"));
            return;
          }

          logDebug(`Generating formatted name with components:`, selectedComponents);
          generatedName = await this._generateFormattedName(language, species, category, selectedComponents, nameFormat);
        } else {
          logDebug(`Generating simple name for category: ${category}`);
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
      logDebug(`Generated settlement name: ${result}`);
      return result;
    } else {
      return this._getRandomFromData(language, species, category);
    }
  }

  async _generateFormattedName(language, species, gender, components, nameFormat) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return null;

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
        return this._getRandomFromData(language, species, 'surnames');

      case 'title':
        return this._generateTitle(language, species, gender, settlement);

      case 'nickname':
        const nickname = this._getRandomFromGenderedData(language, species, 'nicknames', gender);
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
      if (author.twitter) links.push(`<a href="${author.twitter}" target="_blank" title="Twitter">🐦</a>`);

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