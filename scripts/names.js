class NamesGeneratorApp extends Application {
  constructor(options = {}) {
    super(options);
    this.nameData = new Map();
    this.availableLanguages = new Set();
    this.availableSpecies = new Set();
    this.availableCategories = new Set();
    this.grammarRules = new Map();
    this.languageConfig = null;
    this.speciesConfig = null;
    this.nameCategories = {
      'firstnames': ['male', 'female', 'nonbinary'],
      'surnames': ['surnames'],
      'titles': ['titles'],
      'nicknames': ['nicknames'],
      'settlements': ['settlements']
    };
    this.supportedGenders = ['male', 'female', 'nonbinary'];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-generator",
      title: game.i18n.localize("names.title"),
      template: "modules/names/templates/names.hbs",
      width: 450,
      height: 690,
      resizable: true,
      classes: ["names-module-app"]
    });
  }

  async getData() {
    await this.loadConfigs();
    await this.loadNameData();

    return {
      languages: this._getLocalizedLanguages(),
      species: this._getLocalizedSpecies(),
      categories: Array.from(this.availableCategories).sort()
    };
  }

  async loadConfigs() {
    try {
      const langResponse = await fetch("modules/names/lang/_config.json");
      if (langResponse.ok) {
        this.languageConfig = await langResponse.json();
        this._log('console.grammar-loaded', { key: 'language config' });
      }
    } catch (error) {
      this._log('console.index-error', null, error);
    }

    try {
      const speciesResponse = await fetch("modules/names/lang/_species-mapping.json");
      if (speciesResponse.ok) {
        this.speciesConfig = await speciesResponse.json();
        this._log('console.grammar-loaded', { key: 'species config' });
      }
    } catch (error) {
      this._log('console.index-error', null, error);
    }
  }

  _getLocalizedLanguages() {
    const languages = [];
    
    if (this.languageConfig) {
      // Verwende Konfigurationsdatei
      for (const [code, config] of Object.entries(this.languageConfig.supportedLanguages)) {
        if (config.enabled && this.availableLanguages.has(code)) {
          languages.push({
            code: code,
            name: game.i18n.localize(config.name) || config.nativeName || code.toUpperCase()
          });
        }
      }
    } else {
      // Fallback zu alter Methode
      for (const lang of this.availableLanguages) {
        const locKey = `names.languages.${lang}`;
        languages.push({
          code: lang,
          name: game.i18n.localize(locKey) || lang.toUpperCase()
        });
      }
    }

    return languages.sort((a, b) => a.name.localeCompare(b.name));
  }

  _getLocalizedSpecies() {
    const species = [];
    
    for (const spec of this.availableSpecies) {
      const locKey = `names.species.${spec}`;
      species.push({
        code: spec,
        name: game.i18n.localize(locKey) || spec.charAt(0).toUpperCase() + spec.slice(1)
      });
    }

    return species.sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadNameData() {
    this._log('console.loading-index');

    try {
      const indexResponse = await fetch("modules/names/data/index.json");
      if (!indexResponse.ok) {
        this._log('console.index-not-found');
        await this.loadFallbackData();
        return;
      }

      const indexData = await indexResponse.json();
      this._log('console.index-loaded', { count: indexData.files.length });

      const loadPromises = indexData.files
        .filter(file => file.enabled !== false)
        .map(file => this.loadDataFileFromIndex(file));

      await Promise.all(loadPromises);

    } catch (error) {
      this._log('console.index-error', null, error);
      await this.loadFallbackData();
    }

    this._log('console.available-languages', null, Array.from(this.availableLanguages));
    this._log('console.available-species', null, Array.from(this.availableSpecies));
    this._log('console.available-categories', null, Array.from(this.availableCategories));
  }

  async loadFallbackData() {
    const knownFiles = [
      { filename: 'de.human.male.json', language: 'de', species: 'human', category: 'male' },
      { filename: 'de.human.female.json', language: 'de', species: 'human', category: 'female' },
      { filename: 'de.human.surnames.json', language: 'de', species: 'human', category: 'surnames' },
      { filename: 'de.human.titles.json', language: 'de', species: 'human', category: 'titles' },
      { filename: 'de.human.nicknames.json', language: 'de', species: 'human', category: 'nicknames' },
      { filename: 'de.human.settlements.json', language: 'de', species: 'human', category: 'settlements' },
      { filename: 'de.elf.male.json', language: 'de', species: 'elf', category: 'male' }
    ];

    const loadPromises = knownFiles.map(file => this.loadDataFileFromIndex(file));
    await Promise.all(loadPromises);
  }

  async loadDataFileFromIndex(fileInfo) {
    try {
      const response = await fetch(`modules/names/data/${fileInfo.filename}`);
      if (!response.ok) {
        this._log('console.file-unavailable', { 
          filename: fileInfo.filename, 
          status: response.status 
        });
        return;
      }

      const data = await response.json();

      this.availableLanguages.add(fileInfo.language);
      this.availableSpecies.add(fileInfo.species);
      this.availableCategories.add(fileInfo.category);

      const key = `${fileInfo.language}.${fileInfo.species}.${fileInfo.category}`;
      this.nameData.set(key, data);

      if (data.grammar && fileInfo.category === 'titles') {
        const grammarKey = `${fileInfo.language}.${fileInfo.species}`;
        this.grammarRules.set(grammarKey, data.grammar);
        this._log('console.grammar-loaded', { key: grammarKey });
      }

      const entryCount = this._getDataEntryCount(data, fileInfo.category);
      this._log('console.file-loaded', { 
        filename: fileInfo.filename, 
        count: entryCount 
      });

    } catch (error) {
      this._log('console.file-failed', { 
        filename: fileInfo.filename, 
        error: error.message 
      });
    }
  }

  _getDataEntryCount(data, category) {
    if (category === 'titles' && data.titles) {
      return (data.titles.male?.length || 0) + (data.titles.female?.length || 0) + (data.titles.nonbinary?.length || 0);
    }
    if (category === 'nicknames' && data.names) {
      return (data.names.male?.length || 0) + (data.names.female?.length || 0) + (data.names.nonbinary?.length || 0);
    }
    return data.names?.length || data.settlements?.length || data.titles?.length || 0;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('#names-generate-btn').click(this._onGenerateName.bind(this));
    html.find('#names-copy-btn').click(this._onCopyName.bind(this));
    html.find('#names-clear-btn').click(this._onClearResult.bind(this));

    html.find('input[type="checkbox"]').change(this._onComponentChange.bind(this));
    html.find('select').change(this._onDropdownChange.bind(this));

    this._updateUI(html);
  }

  _onComponentChange(event) {
    const form = event.currentTarget.closest('form');
    const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    const generateBtn = form.querySelector('#names-generate-btn');

    generateBtn.disabled = checkboxes.length === 0;
  }

  _onDropdownChange(event) {
    const $form = $(event.currentTarget).closest('form');
    this._updateUI($form);
  }

  _updateUI($form) {
    const language = $form.find('#names-language-select').val();
    const species = $form.find('#names-species-select').val();
    const category = $form.find('#names-category-select').val();

    this._updateCategoryOptions($form, language, species);
    this._toggleNameComponentsPanel($form, category);
    this._updateGenerateButtonState($form, category);
  }

  _updateCategoryOptions(html, language, species) {
    const categorySelect = html.find('#names-category-select');
    const currentValue = categorySelect.val();

    categorySelect.find('option:not(:first)').remove();

    if (language && species) {
      const availableCategories = new Set();

      for (const [key, data] of this.nameData.entries()) {
        const [dataLang, dataSpecies, dataCategory] = key.split('.');
        if (dataLang === language && dataSpecies === species) {
          availableCategories.add(dataCategory);
        }
      }

      const localizedCategories = [];
      for (const category of availableCategories) {
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

      if (currentValue && availableCategories.has(currentValue)) {
        categorySelect.val(currentValue);
      }
    }
  }

  _toggleNameComponentsPanel(html, category) {
    const panel = html.find('.names-module-components-section');
    const formatGroup = html.find('.names-module-format-group');

    if (this.supportedGenders.includes(category)) {
      panel.show();
      formatGroup.show();
    } else {
      panel.hide();
      formatGroup.hide();
    }
  }

  _updateGenerateButtonState(html, category) {
    const generateBtn = html.find('#names-generate-btn');
    const language = html.find('#names-language-select').val();
    const species = html.find('#names-species-select').val();

    if (this.supportedGenders.includes(category)) {
      const checkboxes = html.find('input[type="checkbox"]:checked');
      generateBtn.prop('disabled', !language || !species || !category || checkboxes.length === 0);
    } else {
      generateBtn.prop('disabled', !language || !species || !category);
    }
  }

  async _onGenerateName(event) {
    event.preventDefault();

    const form = event.currentTarget.closest('form');
    const formData = new FormData(form);

    const language = formData.get('names-language');
    const species = formData.get('names-species');
    const category = formData.get('names-category');
    const nameFormat = formData.get('names-format') || '{firstname} {nickname} {surname}, {title}';
    const count = parseInt(formData.get('names-count')) || 1;

    if (!language || !species || !category) {
      ui.notifications.warn(game.i18n.localize("names.select-all"));
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

          generatedName = await this._generateFormattedName(language, species, category, selectedComponents, nameFormat);
        } else {
          generatedName = await this._generateSimpleName(language, species, category);
        }

        if (generatedName) {
          results.push(generatedName);
        }
      }

      if (results.length === 0) {
        throw new Error(game.i18n.localize("names.no-names-generated"));
      }

      const resultDiv = form.querySelector('#names-result-display');
      const authorCredits = this._collectAuthorCredits(language, species, [category]);

      let resultsHtml = results.map(name =>
        `<div class="names-module-generated-name">${name}</div>`
      ).join('');

      resultDiv.innerHTML = resultsHtml + authorCredits;

      form.querySelector('#names-copy-btn').disabled = false;
      form.querySelector('#names-clear-btn').disabled = false;

    } catch (error) {
      const errorMsg = game.i18n.format("names.generation-error", { error: error.message });
      ui.notifications.error(errorMsg);
    }
  }

  async _generateSimpleName(language, species, category) {
    if (category === 'settlements') {
      const settlementData = this.nameData.get(`${language}.${species}.settlements`);
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

  async _generateFormattedName(language, species, gender, components, nameFormat) {
    let selectedSettlement = null;

    if (components.includes('title')) {
      const settlementData = this.nameData.get(`${language}.${species}.settlements`);
      if (settlementData?.settlements) {
        const settlements = settlementData.settlements;
        selectedSettlement = settlements[Math.floor(Math.random() * settlements.length)];
      }
    }

    const nameComponents = {};
    for (const component of components) {
      try {
        let part = await this._generateNameComponent(language, species, gender, component, selectedSettlement);
        if (part) {
          nameComponents[component] = part;
        }
      } catch (error) {
        this._log('console.component-generation-failed', { component }, error);
      }
    }

    if (Object.keys(nameComponents).length === 0) {
      throw new Error(game.i18n.localize("names.no-names-generated"));
    }

    return this._formatName(nameFormat, nameComponents);
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
        return null;
    }
  }

  _generateTitle(language, species, gender, settlement) {
    const titleData = this.nameData.get(`${language}.${species}.titles`);
    if (!titleData?.titles) return null;

    const genderTitles = titleData.titles[gender];
    if (!genderTitles || genderTitles.length === 0) {
      this._log('console.no-titles-found', { 
        gender, 
        language, 
        species 
      });
      
      if (gender === 'nonbinary' && titleData.titles.male) {
        const maleTitles = titleData.titles.male;
        const selectedTitle = maleTitles[Math.floor(Math.random() * maleTitles.length)];
        if (settlement && selectedTitle.template) {
          return this._formatTitleWithSettlement(selectedTitle, settlement, language, species);
        }
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

    const grammarKey = `${language}.${species}`;
    const grammarRules = this.grammarRules.get(grammarKey);

    let article = title.preposition || 'von';

    if (grammarRules?.articles && title.preposition) {
      const prepositionRules = grammarRules.articles[title.preposition];
      if (prepositionRules) {
        const gender = settlement.gender || 'n';
        article = prepositionRules[gender] || title.preposition;
      }
    }

    return title.template
      .replace('{preposition}', article)
      .replace('{settlement}', settlement.name);
  }

  _getRandomFromData(language, species, category) {
    const key = `${language}.${species}.${category}`;
    const data = this.nameData.get(key);

    if (!data?.names || data.names.length === 0) {
      this._log('console.no-data-found', { key });
      return null;
    }

    return data.names[Math.floor(Math.random() * data.names.length)];
  }

  _getRandomFromGenderedData(language, species, category, gender) {
    const key = `${language}.${species}.${category}`;
    const data = this.nameData.get(key);

    if (data?.names && typeof data.names === 'object' && data.names[gender]) {
      const genderNames = data.names[gender];
      if (genderNames.length === 0) {
        this._log('console.no-gender-data', { 
          gender, 
          category, 
          key 
        });
        return null;
      }
      return genderNames[Math.floor(Math.random() * genderNames.length)];
    }

    if (data?.names && Array.isArray(data.names)) {
      return data.names[Math.floor(Math.random() * data.names.length)];
    }

    this._log('console.no-data-found', { key });
    return null;
  }

  _collectAuthorCredits(language, species, components) {
    const authors = new Map();

    for (const component of components) {
      const key = `${language}.${species}.${component}`;
      const data = this.nameData.get(key);

      if (data?.authors) {
        for (const author of data.authors) {
          const authorKey = author.name || author.email || 'Unbekannt';
          authors.set(authorKey, author);
        }
      }
    }

    if (authors.size === 0) return '';

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

    const form = event.currentTarget.closest('form');
    const nameElements = form.querySelectorAll('.names-module-generated-name');
    if (nameElements.length === 0) return;

    const names = Array.from(nameElements).map(el => el.textContent).join('\n');

    try {
      await navigator.clipboard.writeText(names);
      ui.notifications.info(game.i18n.localize("names.copied"));
    } catch (error) {
      this._log('console.clipboard-fallback');
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
    } catch (error) {
      ui.notifications.error(game.i18n.localize("names.copy-error"));
    }

    document.body.removeChild(textArea);
  }

  _onClearResult(event) {
    event.preventDefault();

    const form = event.currentTarget.closest('form');
    const resultDiv = form.querySelector('#names-result-display');

    resultDiv.innerHTML = `<div class="names-module-no-result">${game.i18n.localize("names.select-options")}</div>`;

    form.querySelector('#names-copy-btn').disabled = true;
    form.querySelector('#names-clear-btn').disabled = true;
  }

  // Logging helper mit i18n Support
  _log(messageKey, params = null, error = null) {
    let message;
    
    try {
      message = params ? 
        game.i18n.format(`names.${messageKey}`, params) : 
        game.i18n.localize(`names.${messageKey}`);
    } catch (e) {
      // Fallback falls i18n Key nicht existiert
      message = messageKey;
    }

    const prefix = "Names Module: ";
    
    if (error) {
      console.warn(prefix + message, error);
    } else {
      console.log(prefix + message);
    }
  }
}

// ===== KOMPAKTER NAMEN-PICKER FÜR CHARACTER SHEETS =====
class NamesPickerApp extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.nameGenerator = new NamesGeneratorApp();
    this.currentNames = [];
    this.supportedGenders = ['male', 'female', 'nonbinary'];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-picker",
      title: game.i18n.localize("names.title"),
      template: "modules/names/templates/names-picker.hbs",
      width: 400,
      height: 350,
      resizable: false,
      classes: ["names-picker-app"]
    });
  }

  async getData() {
    await this.nameGenerator.loadConfigs();
    await this.nameGenerator.loadNameData();

    const actorSpecies = this._getActorSpecies();
    const defaultLanguage = this.nameGenerator.languageConfig?.defaultLanguage || 'de';

    return {
      languages: this.nameGenerator._getLocalizedLanguages(),
      species: this.nameGenerator._getLocalizedSpecies(),
      currentNames: this.currentNames,
      actorSpecies: actorSpecies,
      defaultLanguage: defaultLanguage
    };
  }

  _getActorSpecies() {
    if (!this.actor) return null;

    const actorData = this.actor.system || this.actor.data?.data || {};
    
    if (this.nameGenerator.speciesConfig) {
      // Verwende Species-Config
      const searchFields = this.nameGenerator.speciesConfig.searchFields;
      
      for (const field of searchFields) {
        const value = foundry.utils.getProperty(actorData, field);
        if (value) {
          const normalized = value.toString().toLowerCase();
          
          // Durchsuche alle Species-Mappings
          for (const [species, config] of Object.entries(this.nameGenerator.speciesConfig.speciesMappings)) {
            for (const keyword of config.keywords) {
              if (normalized.includes(keyword.toLowerCase())) {
                return species;
              }
            }
          }
        }
      }
      
      return this.nameGenerator.speciesConfig.defaultSpecies;
    } else {
      // Fallback zu alter Methode
      const raceFields = ['race', 'species', 'ancestry', 'details.race', 'details.species'];
      
      for (const field of raceFields) {
        const value = foundry.utils.getProperty(actorData, field);
        if (value) {
          const normalized = value.toString().toLowerCase();
          const raceMapping = {
            'human': 'human',
            'mensch': 'human',
            'elf': 'elf',
            'elfe': 'elf',
            'dwarf': 'dwarf',
            'zwerg': 'dwarf',
            'halfling': 'halfling',
            'halbling': 'halfling'
          };

          for (const [key, mapped] of Object.entries(raceMapping)) {
            if (normalized.includes(key)) {
              return mapped;
            }
          }
        }
      }
      
      return 'human';
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.names-picker-generate').click(this._onGenerateNames.bind(this));
    html.find('.names-picker-name').click(this._onSelectName.bind(this));
    html.find('select').change(this._onOptionChange.bind(this));

    this._onGenerateNames();
  }

  _onOptionChange(event) {
    this._onGenerateNames();
  }

  async _onGenerateNames() {
    const html = this.element;
    const language = html.find('#picker-language').val() || 
                    this.nameGenerator.languageConfig?.defaultLanguage || 'de';
    const species = html.find('#picker-species').val() || this._getActorSpecies() || 'human';
    const category = html.find('#picker-category').val() || 'male';

    try {
      const names = [];
      for (let i = 0; i < 3; i++) {
        let name;
        if (this.supportedGenders.includes(category)) {
          name = await this.nameGenerator._generateFormattedName(
            language, species, category, 
            ['firstname', 'surname'], 
            '{firstname} {surname}'
          );
        } else {
          name = await this.nameGenerator._generateSimpleName(language, species, category);
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
      this.nameGenerator._log('console.generation-error', null, error);
      ui.notifications.error(game.i18n.localize("names.generation-error"));
    }
  }

  async _onSelectName(event) {
    const selectedName = event.currentTarget.dataset.name;
    if (!selectedName || !this.actor) return;

    try {
      await this._updateActorName(selectedName);
      const message = game.i18n.format("names.name-adopted", { name: selectedName });
      ui.notifications.info(message);
      this.close();

    } catch (error) {
      this.nameGenerator._log('console.name-setting-error', null, error);
      ui.notifications.error(game.i18n.localize("names.name-error"));
    }
  }

  async _updateActorName(name) {
    if (!this.actor) return;

    await this.actor.update({ name: name });

    const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === this.actor.id);
    for (const token of tokens) {
      await token.document.update({ name: name });
    }

    if (this.actor.prototypeToken) {
      await this.actor.update({
        "prototypeToken.name": name
      });
    }
  }
}

// ===== UTILITY FUNCTIONS FOR ROLE PERMISSIONS =====

function hasNamesGeneratorPermission() {
  const allowedRoles = game.settings.get("names", "allowedUserRoles");
  const userRole = game.user.role;
  
  return allowedRoles.includes(userRole);
}

class NamesRoleConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-role-config",
      title: game.i18n.localize("names.roleConfig.title"),
      template: "modules/names/templates/role-config.hbs",
      width: 620,
      height: 550,
      closeOnSubmit: true,
      resizable: false
    });
  }

  getData() {
    const currentRoles = game.settings.get("names", "allowedUserRoles");
    const allRoles = [
      { level: CONST.USER_ROLES.PLAYER, name: "PLAYER", key: "PLAYER" },
      { level: CONST.USER_ROLES.TRUSTED, name: "TRUSTED", key: "TRUSTED" },
      { level: CONST.USER_ROLES.ASSISTANT, name: "ASSISTANT", key: "ASSISTANT" },
      { level: CONST.USER_ROLES.GAMEMASTER, name: "GAMEMASTER", key: "GAMEMASTER" }
    ];

    return {
      roles: allRoles.map(role => ({
        ...role,
        checked: currentRoles.includes(role.level) || role.level === CONST.USER_ROLES.GAMEMASTER
      }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Toggle-Verhalten für die Role Cards
    html.find('.role-toggle').click((event) => {
      const toggle = $(event.currentTarget);
      const checkbox = toggle.find('input[type="checkbox"]');
      
      // GM-Rolle kann nicht geändert werden
      if (toggle.hasClass('locked')) {
        return;
      }
      
      const wasChecked = checkbox.prop('checked');
      checkbox.prop('checked', !wasChecked);
      
      if (!wasChecked) {
        toggle.addClass('active');
      } else {
        toggle.removeClass('active');
      }
      
      event.preventDefault();
    });

    // Verhindere Event-Bubbling bei direkten Checkbox-Klicks
    html.find('input[type="checkbox"]').click((event) => {
      event.stopPropagation();
      const checkbox = $(event.currentTarget);
      const toggle = checkbox.closest('.role-toggle');
      
      // Ignoriere disabled checkboxes
      if (checkbox.prop('disabled')) {
        return;
      }
      
      if (checkbox.prop('checked')) {
        toggle.addClass('active');
      } else {
        toggle.removeClass('active');
      }
    });

    // Reset Button
    html.find('button[name="reset"]').click((event) => {
      event.preventDefault();
      const defaultRoles = [CONST.USER_ROLES.GAMEMASTER];
      
      html.find('.role-toggle').each((i, toggle) => {
        const $toggle = $(toggle);
        const checkbox = $toggle.find('input[type="checkbox"]');
        const level = parseInt(checkbox.attr('name').replace('role_', ''));
        
        if (defaultRoles.includes(level)) {
          checkbox.prop('checked', true);
          $toggle.addClass('active');
        } else if (!$toggle.hasClass('locked')) {
          checkbox.prop('checked', false);
          $toggle.removeClass('active');
        }
      });
    });
  }

  async _updateObject(event, formData) {
    const oldRoles = game.settings.get("names", "allowedUserRoles");
    const newAllowedRoles = [CONST.USER_ROLES.GAMEMASTER]; // GM ist immer dabei
    
    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('role_') && value) {
        const roleLevel = parseInt(key.replace('role_', ''));
        if (!newAllowedRoles.includes(roleLevel)) {
          newAllowedRoles.push(roleLevel);
        }
      }
    }

    await game.settings.set("names", "allowedUserRoles", newAllowedRoles);
    ui.notifications.info(game.i18n.localize("names.permissions-saved"));
    
    // Bestimme welche User von der Änderung betroffen sind
    const affectedUsers = this._getAffectedUsers(oldRoles, newAllowedRoles);
    
    // Socket-Message an betroffene User senden für Reload
    if (affectedUsers.length > 0) {
      game.socket.emit("module.names", {
        type: "permissionChanged",
        affectedUsers: affectedUsers
      });
    }
  }

  _getAffectedUsers(oldRoles, newRoles) {
    const affectedUsers = [];
    
    // Finde alle User deren Berechtigung sich geändert hat
    for (const user of game.users) {
      const hadPermission = oldRoles.includes(user.role);
      const hasPermission = newRoles.includes(user.role);
      
      if (hadPermission !== hasPermission) {
        affectedUsers.push(user.id);
      }
    }
    
    return affectedUsers;
  }
}

// ===== MODULE SETTINGS =====
Hooks.once('init', () => {
  console.log(game.i18n.localize("names.console.module-init"));

  game.settings.register("names", "showInTokenControls", {
    name: game.i18n.localize("names.settings.showInTokenControls.name"),
    hint: game.i18n.localize("names.settings.showInTokenControls.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("names", "showInCharacterSheet", {
    name: game.i18n.localize("names.settings.showInCharacterSheet.name"),
    hint: game.i18n.localize("names.settings.showInCharacterSheet.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("names", "showInTokenContextMenu", {
    name: game.i18n.localize("names.settings.showInTokenContextMenu.name"),
    hint: game.i18n.localize("names.settings.showInTokenContextMenu.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("names", "allowedUserRoles", {
    name: "Erlaubte Benutzerrollen",
    hint: "Welche Benutzerrollen dürfen den Namen-Generator verwenden",
    scope: "world",
    config: false,
    type: Array,
    default: [CONST.USER_ROLES.GAMEMASTER]
  });

  game.settings.registerMenu("names", "roleConfig", {
    name: game.i18n.localize("names.settings.roleConfig.name"),
    hint: game.i18n.localize("names.settings.roleConfig.hint"),
    label: game.i18n.localize("names.settings.roleConfig.label"),
    icon: "fas fa-users-cog",
    type: NamesRoleConfig,
    restricted: true
  });

  // Socket-Listener für Permission-Änderungen
  game.socket.on("module.names", (data) => {
    if (data.type === "permissionChanged" && data.affectedUsers.includes(game.user.id)) {
      // Zeige Notification und biete Reload an
      new Dialog({
        title: game.i18n.localize("names.permissionChange.title") || "Berechtigung geändert",
        content: `
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2em; color: #ff6400; margin-bottom: 15px;"></i>
            <p>${game.i18n.localize("names.permissionChange.content") || "Deine Namen-Generator Berechtigung wurde vom Spielleiter geändert. Ein Reload der Seite ist erforderlich, damit die Änderungen wirksam werden."}</p>
          </div>
        `,
        buttons: {
          reload: {
            icon: '<i class="fas fa-sync-alt"></i>',
            label: game.i18n.localize("names.permissionChange.reload") || "Seite neu laden",
            callback: () => location.reload()
          },
          later: {
            icon: '<i class="fas fa-clock"></i>',
            label: game.i18n.localize("names.permissionChange.later") || "Später",
            callback: () => {}
          }
        },
        default: "reload"
      }, {
        width: 400,
        height: 200
      }).render(true);
    }
  });

  Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.settings.get("names", "showInTokenControls")) return;
    if (!hasNamesGeneratorPermission()) return;

    const token = controls.find(c => c.name === 'token');
    if (!token) return;

    if (token.tools.some(t => t.name === 'names-generator')) return;

    token.tools.push({
      name: 'names-generator',
      title: game.i18n.localize("names.title"),
      icon: 'fas fa-user-tag',
      button: true,
      visible: () => hasNamesGeneratorPermission(),
      onClick: () => new NamesGeneratorApp().render(true)
    });
  });

  Hooks.on('renderActorSheet', (app, html, data) => {
    if (!game.settings.get("names", "showInCharacterSheet")) return;
    if (!hasNamesGeneratorPermission()) return;
    if (app.actor.type !== 'character') return;

    const nameInput = html.find('input[name="name"]');
    if (nameInput.length > 0) {
      const button = $(`
        <button type="button" class="names-picker-button" title="${game.i18n.localize("names.choose-name")}">
          <i class="fas fa-dice"></i>
        </button>
      `);

      nameInput.after(button);

      button.click(() => {
        new NamesPickerApp({ actor: app.actor }).render(true);
      });

      if (!$('#names-picker-button-style').length) {
        $('head').append(`
          <style id="names-picker-button-style">
            .names-picker-button {
              background: #ff6400;
              border: 1px solid #e55a00;
              border-radius: 3px;
              color: white;
              padding: 2px 8px;
              margin-left: 5px;
              cursor: pointer;
              font-size: 12px;
              height: fit-content;
            }
            .names-picker-button:hover {
              background: #ff8533;
              box-shadow: 0 0 5px rgba(255, 100, 0, 0.3);
            }
          </style>
        `);
      }
    }
  });

  Hooks.on('getTokenContextOptions', (html, options) => {
    if (!game.settings.get("names", "showInTokenContextMenu")) return;
    if (!hasNamesGeneratorPermission()) return;

    options.push({
      name: game.i18n.localize("names.title"),
      icon: '<i class="fas fa-user-tag"></i>',
      condition: (token) => {
        return token.actor && hasNamesGeneratorPermission();
      },
      callback: (token) => {
        new NamesPickerApp({ actor: token.actor }).render(true);
      }
    });
  });
});

Hooks.on('renderTokenHUD', (app, html, data) => {
  if (!game.settings.get("names", "showInTokenContextMenu")) return;
  if (!hasNamesGeneratorPermission()) return;
  if (!app.object?.actor) return;

  const button = $(`
    <div class="control-icon" title="${game.i18n.localize("names.title")}">
      <i class="fas fa-user-tag"></i>
    </div>
  `);

  button.click(() => {
    new NamesPickerApp({ actor: app.object.actor }).render(true);
  });

  html.find('.left').append(button);
});

Hooks.on('chatMessage', (html, content, msg) => {
  if (!hasNamesGeneratorPermission()) {
    if (content === '/names' || content === '/namen' || content === '/pick-name' || content === '/name-picker') {
      ui.notifications.warn(game.i18n.localize("names.no-permission"));
      return false;
    }
    return;
  }

  if (content === '/names' || content === '/namen') {
    new NamesGeneratorApp().render(true);
    return false;
  }

  if (content === '/pick-name' || content === '/name-picker') {
    const controlled = canvas.tokens.controlled;
    if (controlled.length === 1 && controlled[0].actor) {
      new NamesPickerApp({ actor: controlled[0].actor }).render(true);
    } else {
      ui.notifications.warn(game.i18n.localize("names.select-one-token"));
    }
    return false;
  }
});