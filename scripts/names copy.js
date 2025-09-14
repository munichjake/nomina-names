class NamesGeneratorApp extends Application {
  constructor(options = {}) {
    super(options);
    this.nameData = new Map();
    this.availableLanguages = new Set();
    this.availableSpecies = new Set();
    this.availableCategories = new Set();
    this.grammarRules = new Map();
    this.nameCategories = {
      'firstnames': ['male', 'female'],
      'surnames': ['surnames'],
      'titles': ['titles'], 
      'nicknames': ['nicknames'],
      'settlements': ['settlements']
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-generator",
      title: "Names",
      template: "modules/names/templates/names.hbs",
      width: 450,
      height: 600,
      resizable: true,
      classes: ["names-module-app"]
    });
  }

  async getData() {
    await this.loadNameData();
    
    return {
      languages: Array.from(this.availableLanguages).sort(),
      species: Array.from(this.availableSpecies).sort(),
      categories: Array.from(this.availableCategories).sort()
    };
  }

  async loadNameData() {
    console.log("Names Module: Lade Datenindex...");
    
    try {
      const indexResponse = await fetch("modules/names/data/index.json");
      if (!indexResponse.ok) {
        console.warn("Names Module: index.json nicht gefunden, verwende Fallback");
        await this.loadFallbackData();
        return;
      }
      
      const indexData = await indexResponse.json();
      console.log(`Names Module: Index geladen, ${indexData.files.length} Dateien gefunden`);
      
      const loadPromises = indexData.files
        .filter(file => file.enabled !== false)
        .map(file => this.loadDataFileFromIndex(file));
        
      await Promise.all(loadPromises);
      
    } catch (error) {
      console.warn("Names Module: Fehler beim Laden der Index-Datei:", error);
      await this.loadFallbackData();
    }
    
    console.log("Names Module: Verfügbare Sprachen:", Array.from(this.availableLanguages));
    console.log("Names Module: Verfügbare Spezies:", Array.from(this.availableSpecies));
    console.log("Names Module: Verfügbare Kategorien:", Array.from(this.availableCategories));
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
        console.log(`Names Module: ${fileInfo.filename} nicht verfügbar (${response.status})`);
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
        console.log(`Names Module: Grammatik-Regeln geladen für ${grammarKey}`);
      }
      
      const entryCount = data.names?.length || data.settlements?.length || data.titles?.length || 0;
      console.log(`Names Module: ✓ ${fileInfo.filename} (${entryCount} Einträge)`);
      
    } catch (error) {
      console.log(`Names Module: ✗ ${fileInfo.filename} - ${error.message}`);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('#names-generate-btn').click(this._onGenerateName.bind(this));
    html.find('#names-copy-btn').click(this._onCopyName.bind(this));
    html.find('#names-clear-btn').click(this._onClearResult.bind(this));
    
    html.find('input[type="checkbox"]').change(this._onComponentChange.bind(this));
    html.find('select').change(this._onDropdownChange.bind(this));
    
    // Initial UI Update
    this._updateUI(html);
  }

  _onComponentChange(event) {
    const form = event.currentTarget.closest('form');
    const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    const generateBtn = form.querySelector('#names-generate-btn');
    
    generateBtn.disabled = checkboxes.length === 0;
  }

  _onDropdownChange(event) {
    const html = event.currentTarget.closest('form');
    this._updateUI(html);
  }

  _updateUI(html) {
    const language = html.find('#names-language-select').val();
    const species = html.find('#names-species-select').val();
    const category = html.find('#names-category-select').val();
    
    // Update verfügbare Kategorien basierend auf Sprache/Spezies
    this._updateCategoryOptions(html, language, species);
    
    // Show/Hide Namenskomponenten Panel
    this._toggleNameComponentsPanel(html, category);
    
    // Update Generate Button State
    this._updateGenerateButtonState(html, category);
  }

  _updateCategoryOptions(html, language, species) {
    const categorySelect = html.find('#names-category-select');
    const currentValue = categorySelect.val();
    
    // Clear existing options except first
    categorySelect.find('option:not(:first)').remove();
    
    if (language && species) {
      const availableCategories = new Set();
      
      // Find all categories for this language/species combination
      for (const [key, data] of this.nameData.entries()) {
        const [dataLang, dataSpecies, dataCategory] = key.split('.');
        if (dataLang === language && dataSpecies === species) {
          availableCategories.add(dataCategory);
        }
      }
      
      // Add category options
      for (const category of Array.from(availableCategories).sort()) {
        const displayName = this._getCategoryDisplayName(category);
        categorySelect.append(`<option value="${category}">${displayName}</option>`);
      }
      
      // Restore previous selection if still valid
      if (currentValue && availableCategories.has(currentValue)) {
        categorySelect.val(currentValue);
      }
    }
  }

  _getCategoryDisplayName(category) {
    const displayNames = {
      'male': 'Männliche Vornamen',
      'female': 'Weibliche Vornamen', 
      'surnames': 'Nachnamen',
      'titles': 'Titel/Adelstitel',
      'nicknames': 'Beinamen',
      'settlements': 'Siedlungen/Orte'
    };
    return displayNames[category] || category;
  }

  _toggleNameComponentsPanel(html, category) {
    const panel = html.find('.names-module-components-section');
    const formatGroup = html.find('.names-module-format-group');
    
    // Show components panel only for name categories (male/female)
    if (category === 'male' || category === 'female') {
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
    
    if (category === 'male' || category === 'female') {
      // For name categories, check if at least one component is selected
      const checkboxes = html.find('input[type="checkbox"]:checked');
      generateBtn.prop('disabled', !language || !species || !category || checkboxes.length === 0);
    } else {
      // For other categories, only need language, species and category
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
      ui.notifications.warn("Bitte wähle Sprache, Spezies und Kategorie aus.");
      return;
    }

    try {
      const results = [];
      
      for (let i = 0; i < count; i++) {
        let generatedName;
        
        if (category === 'male' || category === 'female') {
          // Generate complex names with components
          const selectedComponents = [];
          if (formData.get('names-include-firstname')) selectedComponents.push('firstname');
          if (formData.get('names-include-surname')) selectedComponents.push('surname');
          if (formData.get('names-include-title')) selectedComponents.push('title');
          if (formData.get('names-include-nickname')) selectedComponents.push('nickname');

          if (selectedComponents.length === 0) {
            ui.notifications.warn("Bitte wähle mindestens eine Namenskomponente aus.");
            return;
          }
          
          generatedName = await this._generateFormattedName(language, species, category, selectedComponents, nameFormat);
        } else {
          // Generate simple names from category
          generatedName = await this._generateSimpleName(language, species, category);
        }
        
        if (generatedName) {
          results.push(generatedName);
        }
      }
      
      if (results.length === 0) {
        throw new Error("Keine Namen konnten generiert werden");
      }
      
      // Display results
      const resultDiv = form.querySelector('#names-result-display');
      const authorCredits = this._collectAuthorCredits(language, species, [category]);
      
      let resultsHtml = results.map(name => 
        `<div class="names-module-generated-name">${name}</div>`
      ).join('');
      
      resultDiv.innerHTML = resultsHtml + authorCredits;
      
      form.querySelector('#names-copy-btn').disabled = false;
      form.querySelector('#names-clear-btn').disabled = false;
      
    } catch (error) {
      ui.notifications.error(`Fehler beim Generieren: ${error.message}`);
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
        console.warn(`Names Module: Konnte ${component} nicht generieren:`, error);
      }
    }

    if (Object.keys(nameComponents).length === 0) {
      throw new Error("Keine Namenskomponenten konnten generiert werden");
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
        return this._generateTitle(language, species, settlement);
        
      case 'nickname':
        const nickname = this._getRandomFromData(language, species, 'nicknames');
        return nickname ? `"${nickname}"` : null;
        
      default:
        return null;
    }
  }

  _generateTitle(language, species, settlement) {
    const titleData = this.nameData.get(`${language}.${species}.titles`);
    if (!titleData?.titles) return null;

    const titles = titleData.titles;
    const selectedTitle = titles[Math.floor(Math.random() * titles.length)];

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
      console.warn(`Names Module: Keine Daten gefunden für ${key}`);
      return null;
    }
    
    return data.names[Math.floor(Math.random() * data.names.length)];
  }

  _collectAuthorCredits(language, species, components) {
    const authors = new Map();
    
    for (const component of components) {
      const key = `${language}.${species}.${component}`;
      const data = this.nameData.get(key);
      
      if (data?.author) {
        const authorKey = data.author.name || data.author.email || 'Unbekannt';
        authors.set(authorKey, data.author);
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
      ui.notifications.info("Namen in Zwischenablage kopiert!");
    } catch (error) {
      console.warn("Names Module: Clipboard API nicht verfügbar, verwende Fallback");
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
      ui.notifications.info("Namen in Zwischenablage kopiert!");
    } catch (error) {
      ui.notifications.error("Kopieren fehlgeschlagen");
    }
    
    document.body.removeChild(textArea);
  }

  _onClearResult(event) {
    event.preventDefault();
    
    const form = event.currentTarget.closest('form');
    const resultDiv = form.querySelector('#names-result-display');
    
    resultDiv.innerHTML = '<div class="names-module-no-result">Wähle Optionen und klicke "Generieren"</div>';
    
    form.querySelector('#names-copy-btn').disabled = true;
    form.querySelector('#names-clear-btn').disabled = true;
  }
}

Hooks.once('init', () => {
  console.log("Names Modul init");

  Hooks.on('getSceneControlButtons', (controls) => {
    const token = controls.find(c => c.name === 'token');
    if (!token) return;

    if (token.tools.some(t => t.name === 'names-generator')) return;

    token.tools.push({
      name: 'names-generator',
      title: 'Names Generator',
      icon: 'fas fa-user-tag',
      button: true,
      visible: () => true,
      onClick: () => new NamesGeneratorApp().render(true)
    });
  });
});

Hooks.on('chatMessage', (html, content, msg) => {
  if (content === '/names' || content === '/namen') {
    new NamesGeneratorApp().render(true);
    return false;
  }
});