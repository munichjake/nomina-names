/**
 * Names Generator App - Main application for generating names
 * Updated for simplified UI with gender and component checkboxes + categorized content subcategories
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, DEFAULT_NAME_FORMAT, isCategorizedContent, getSubcategories, isGeneratorOnlyCategory } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

/**
 * Names Generator Application - Main application for generating names
 * Provides UI for selecting language, species, category and generating various types of names
 * Supports enhanced dropdowns, auto-resize, and smart defaults
 */
export class NamesGeneratorApp extends Application {
  /**
   * Creates a new Names Generator App instance
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);
    this.supportedGenders = getSupportedGenders();
    this.enhancedDropdowns = new Map(); // Store Enhanced Dropdown instances
    this.autoResize = true; // Enable auto-resize by default
    this.minHeight = 400; // Minimum window height
    this.maxHeight = 800; // Maximum window height
    logDebug("NamesGeneratorApp initialized with supported genders:", this.supportedGenders);
  }

  /**
   * Default application options
   * @returns {Object} Default options for the Names Generator App
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-generator",
      title: game.i18n.localize("names.title"),
      template: TEMPLATE_PATHS.generator,
      width: 900,
      height: 600, // Reduced initial height for more compact layout
      resizable: true,
      classes: [CSS_CLASSES.moduleApp]
    });
  }

  /**
   * Prepares data for template rendering
   * @returns {Promise<Object>} Template data including languages, species, categories, and loading state
   */
  async getData() {
    ensureGlobalNamesData();
    const globalNamesData = getGlobalNamesData();

    if (globalNamesData) {
      await globalNamesData.initializeData();
    }

    const data = {
      languages: globalNamesData ? globalNamesData.getLocalizedLanguages() : [],
      species: globalNamesData ? globalNamesData.getLocalizedSpecies() : [],
      categories: globalNamesData ? await globalNamesData.getLocalizedCategoriesForGenerator('generator') : [],
      isLoading: globalNamesData ? globalNamesData.isLoading : false,
      isLoaded: globalNamesData ? globalNamesData.isLoaded : false,
      supportedGenders: getSupportedGenders(),
      defaultLanguage: this._getFoundryLanguage()
    };

    logDebug("Generator app data prepared:", {
      languages: data.languages.length,
      species: data.species.length,
      categories: data.categories.length,
      isLoading: data.isLoading,
      isLoaded: data.isLoaded,
      defaultLanguage: data.defaultLanguage
    });

    return data;
  }

  /**
   * Activates event listeners for the application
   * @param {jQuery} html - The application's HTML
   */
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

    // Initial resize to fit content
    setTimeout(() => this._resizeToContent(), 100);

    // Set default language selection after UI is ready
    setTimeout(() => this._setDefaultLanguage(), 200);
  }

  /**
   * Initializes enhanced dropdowns and binds change events
   * @param {jQuery} html - The application's HTML
   */
  _initializeEnhancedDropdowns(html) {
    // Wait for Enhanced Dropdowns to be initialized
    setTimeout(() => {
      const languageSelect = html[0].querySelector('#names-language-select');
      const speciesSelect = html[0].querySelector('#names-species-select');
      const categorySelect = html[0].querySelector('#names-category-select');

      // Find Enhanced Dropdown instances by checking the next sibling
      if (languageSelect && languageSelect.nextElementSibling && languageSelect.nextElementSibling.classList.contains('enhanced-dropdown')) {
        this.enhancedDropdowns.set('language', languageSelect.nextElementSibling._enhancedDropdown);
        logInfo("Language Enhanced Dropdown found and stored");
      }
      if (speciesSelect && speciesSelect.nextElementSibling && speciesSelect.nextElementSibling.classList.contains('enhanced-dropdown')) {
        this.enhancedDropdowns.set('species', speciesSelect.nextElementSibling._enhancedDropdown);
        logInfo("Species Enhanced Dropdown found and stored");
      }
      if (categorySelect && categorySelect.nextElementSibling && categorySelect.nextElementSibling.classList.contains('enhanced-dropdown')) {
        this.enhancedDropdowns.set('category', categorySelect.nextElementSibling._enhancedDropdown);
        logInfo("Category Enhanced Dropdown found and stored");
      }

      // If Enhanced Dropdowns aren't ready yet, try again with longer delay
      if (!this.enhancedDropdowns.has('language')) {
        setTimeout(() => this._initializeEnhancedDropdowns(html), 200);
        return;
      }

      // Bind change events for Enhanced Dropdowns
      html.find('#names-language-select, #names-species-select, #names-category-select').change(this._onDropdownChange.bind(this));

      logInfo("Enhanced Dropdowns initialized and bound:", Array.from(this.enhancedDropdowns.keys()));
      logInfo("Event listeners bound to dropdown elements");
    }, 100);
  }

  /**
   * Waits for data loading to complete and updates the UI
   * @param {jQuery} html - The application's HTML
   */
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

  /**
   * Handles checkbox change events
   * @param {Event} event - The change event
   */
  _onCheckboxChange(event) {
    const $form = $(event.currentTarget).closest('form');
    this._updateGenerateButtonState($form);
    logDebug(`Checkbox changed: ${event.currentTarget.name} = ${event.currentTarget.checked}`);
  }

  /**
   * Handles dropdown change events
   * @param {Event} event - The change event
   */
  _onDropdownChange(event) {
    const $form = $(event.currentTarget).closest('form');
    const changedElement = event.currentTarget;
    logInfo(`Dropdown changed: ${changedElement.name} = "${changedElement.value}"`);

    // Debug: Check if Enhanced Dropdown value differs from native select
    if (changedElement.name === 'names-category') {
      const enhancedDropdown = this.enhancedDropdowns.get('category');
      if (enhancedDropdown && enhancedDropdown.getValue) {
        const enhancedValue = enhancedDropdown.getValue();
        logInfo(`Enhanced Dropdown value: "${enhancedValue}" vs Native: "${changedElement.value}"`);
      }
    }

    this._updateUI($form);
  }

  /**
   * Updates the entire UI based on current selections
   * @param {jQuery} $form - The form element
   */
  async _updateUI($form) {
    const language = $form.find('#names-language-select').val();
    const species = $form.find('#names-species-select').val();
    let category = $form.find('#names-category-select').val();

    // Check Enhanced Dropdown value if native select is empty
    if (!category || category === '') {
      const enhancedDropdown = this.enhancedDropdowns.get('category');
      if (enhancedDropdown && enhancedDropdown.getValue) {
        const enhancedValue = enhancedDropdown.getValue();
        if (enhancedValue && enhancedValue !== '') {
          category = enhancedValue;
          logInfo(`Using Enhanced Dropdown value for category: "${enhancedValue}"`);
          // Sync native select with enhanced dropdown
          $form.find('#names-category-select').val(enhancedValue);
        }
      }
    }

    logInfo("=== UI UPDATE START ===");
    logInfo("Updating UI with selection:", { language, species, category });

    await this._updateCategoryOptions($form, language, species);
    logInfo("Category options updated");

    await this._updateGenderCheckboxes($form, language, species);
    logInfo("Gender checkboxes updated");

    await this._updateSubcategoryCheckboxes($form, language, species, category);
    logInfo("Subcategory checkboxes updated");

    this._toggleNamesPanels($form, category);
    logInfo("Panels toggled");

    this._updateGenerateButtonState($form);
    logInfo("=== UI UPDATE END ===");

    // Resize window after UI updates
    setTimeout(() => this._resizeToContent(), 100);
  }

  async _updateCategoryOptions($form, language, species) {
    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData || !language || !species) {
      logDebug("Cannot update categories - missing data or selection");
      return;
    }

    const categorySelect = $form.find('#names-category-select');
    const currentCategory = categorySelect.val();

    // Get categories available for this specific language/species combination
    const availableCategories = await globalNamesData.getLocalizedCategoriesForLanguageAndSpecies(language, species, 'generator');

    logDebug(`Updating categories for ${language}.${species}:`, availableCategories);

    // Clear and repopulate the category dropdown
    categorySelect.empty();

    // Add default option
    categorySelect.append('<option value="">' + game.i18n.localize("names.ui.choose-category") + '</option>');

    // Add available categories grouped
    for (const group of availableCategories) {
      const optgroup = $(`<optgroup label="${group.groupLabel}"></optgroup>`);
      for (const item of group.items) {
        optgroup.append(`<option value="${item.code}">${item.name}</option>`);
      }
      categorySelect.append(optgroup);
    }

    // Try to restore previous selection if still available
    if (currentCategory) {
      const isStillAvailable = availableCategories.some(group =>
        group.items.some(item => item.code === currentCategory)
      );
      if (isStillAvailable) {
        categorySelect.val(currentCategory);
      }
    }

    // Update Enhanced Dropdown if available
    const enhancedDropdown = this.enhancedDropdowns.get('category');
    if (enhancedDropdown && enhancedDropdown.rebuildOptions) {
      logInfo("Rebuilding Enhanced Dropdown options for category");
      enhancedDropdown.rebuildOptions();
      if (categorySelect.val()) {
        enhancedDropdown.setValue(categorySelect.val());
        logInfo(`Set Enhanced Dropdown value to: "${categorySelect.val()}"`);
      }
    } else {
      logInfo("Enhanced Dropdown not available for category, rebinding events");
      // Re-bind change event if Enhanced Dropdown not available
      categorySelect.off('change.names');
      categorySelect.on('change.names', this._onDropdownChange.bind(this));
    }

    logInfo(`Category options updated, current selection: "${categorySelect.val()}"`);

    // Debug: Log all available options
    const options = [];
    categorySelect.find('option').each(function() {
      options.push(`"${this.value}" = "${this.text}"`);
    });
    logInfo(`Available category options: ${options.join(', ')}`);

    // Debug: Enhanced dropdown state (reuse variable from above)
    if (enhancedDropdown) {
      logInfo(`Enhanced dropdown for category exists: ${!!enhancedDropdown}`);
    } else {
      logInfo("No enhanced dropdown found for category");
    }
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
      let hasData = globalNamesData.hasData(language, species, gender);
      
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

  async _updateSubcategoryCheckboxes(html, language, species, category) {
    const globalNamesData = getGlobalNamesData();
    const container = html.find('#subcategory-checkboxes-container');
    
    // Clear container first
    container.empty();

    if (!globalNamesData || !language || !species || !category) {
      logDebug("Clearing subcategory checkboxes - missing data");
      return;
    }

    // Only show subcategories for categorized content
    if (!isCategorizedContent(category)) {
      logDebug(`Category ${category} is not categorized content, no subcategories needed`);
      return;
    }

    // Ensure data is loaded for this category
    const hasData = await globalNamesData.ensureDataLoaded(language, species, category);
    if (!hasData) {
      logDebug(`No data available for ${language}.${species}.${category}`);
      return;
    }

    // Get available subcategories from data
    const availableSubcategories = globalNamesData.getAvailableSubcategories(language, species, category);
    
    if (availableSubcategories.length === 0) {
      logDebug(`No subcategories available for ${language}.${species}.${category}`);
      return;
    }

    logDebug(`Available subcategories for ${language}.${species}.${category}:`, availableSubcategories);

    // Generate subcategory checkboxes
    let checkboxesHtml = '';
    const subcategoryDefinitions = getSubcategories(category);
    
    for (const subcategory of availableSubcategories) {
      const locKey = subcategoryDefinitions[subcategory] || `names.subcategory-translations.${category}.${subcategory}`;
      const subcategoryLabel = game.i18n.localize(locKey) || subcategory.replace(/_/g, ' ');
      const isChecked = availableSubcategories.length === 1 ? 'checked' : ''; // Auto-select if only one option
      
      checkboxesHtml += `
        <label class="names-module-checkbox-item">
          <input type="checkbox" name="names-subcategory-${subcategory}" ${isChecked}>
          <span class="names-module-checkmark"></span>
          ${subcategoryLabel}
        </label>
      `;
    }

    container.html(checkboxesHtml);
    
    // Bind change events to new checkboxes
    container.find('input[type="checkbox"]').change(this._onCheckboxChange.bind(this));

    logDebug(`Updated subcategory checkboxes for ${language}.${species}.${category}:`, availableSubcategories);
  }

  _toggleNamesPanels(html, category) {
    const genderPanel = html.find('.names-module-gender-section');
    const componentsPanel = html.find('.names-module-components-section');
    const formatGroup = html.find('.names-module-format-group');
    const subcategoryPanel = html.find('.names-module-subcategory-section');

    if (category === 'names') {
      genderPanel.show();
      componentsPanel.show();
      formatGroup.show();
      subcategoryPanel.hide();
      logDebug("Showing names panels for name generation");
    } else if (isCategorizedContent(category)) {
      genderPanel.hide();
      componentsPanel.hide();
      formatGroup.hide();
      subcategoryPanel.show();
      logDebug(`Showing subcategory panel for categorized content: ${category}`);
    } else {
      genderPanel.hide();
      componentsPanel.hide();
      formatGroup.hide();
      subcategoryPanel.hide();
      logDebug(`Hiding all special panels for category: ${category}`);
    }

    // Trigger resize after panel visibility changes
    setTimeout(() => this._resizeToContent(), 50);
  }

  /**
   * Updates the state of the generate button based on current selections
   * @param {jQuery} html - The form element
   */
  _updateGenerateButtonState(html) {
    const generateBtn = html.find('#names-generate-btn');
    const language = html.find('#names-language-select').val();
    const species = html.find('#names-species-select').val();
    let category = html.find('#names-category-select').val();

    // Check Enhanced Dropdown value if native select is empty
    if (!category || category === '') {
      const enhancedDropdown = this.enhancedDropdowns.get('category');
      if (enhancedDropdown && enhancedDropdown.getValue) {
        const enhancedValue = enhancedDropdown.getValue();
        if (enhancedValue && enhancedValue !== '') {
          category = enhancedValue;
          logInfo(`Button state: Using Enhanced Dropdown value for category: "${enhancedValue}"`);
        }
      }
    }

    logInfo(`Button state check: language="${language}", species="${species}", category="${category}"`);

    // Basic requirements: language and species must be selected
    let isDisabled = !language || !species;
    let disabledReason = "";

    if (!language) disabledReason += "No language selected. ";
    if (!species) disabledReason += "No species selected. ";

    // If no category selected, that's okay - we'll just disable generation temporarily
    if (!category) {
      isDisabled = true;
      disabledReason += "No category selected. ";
    }

    if (category === 'names') {
      // For names category, we need either gender OR component checkboxes available
      const genderCheckboxes = html.find('input[name^="names-gender-"]');
      const componentCheckboxes = html.find('input[name^="names-include-"]');

      logInfo(`Names category: ${genderCheckboxes.length} gender checkboxes, ${componentCheckboxes.length} component checkboxes available`);

      // If no checkboxes are available yet, that means data is still loading
      if (genderCheckboxes.length === 0 && componentCheckboxes.length === 0) {
        isDisabled = true;
        disabledReason += "Names data still loading. ";
      }
      // If we have checkboxes available, generation is possible (smart defaults apply internally)
    } else if (isCategorizedContent(category)) {
      // For categorized content, generation is possible once we have the category selected
      // Subcategory selection is optional (smart defaults apply)
      logInfo(`Categorized content "${category}" selected - allowing generation`);
    } else if (category) {
      // For other categories (like settlements), generation should be possible
      logInfo(`Simple category "${category}" selected - allowing generation`);
    }

    generateBtn.prop('disabled', isDisabled);

    if (isDisabled) {
      logInfo(`Generate button DISABLED: ${disabledReason}`);
    } else {
      logInfo("Generate button ENABLED");
    }
  }

  /**
   * Handles the generate name button click event
   * @param {Event} event - The click event
   */
  async _onGenerateName(event) {
    event.preventDefault();
    logDebug("Generate name button clicked");

    const form = event.currentTarget.closest('form');
    const $form = $(form);

    // Get values directly from elements, with Enhanced Dropdown fallback
    const language = $form.find('#names-language-select').val();
    const species = $form.find('#names-species-select').val();
    let category = $form.find('#names-category-select').val();

    // Check Enhanced Dropdown value if native select is empty
    if (!category || category === '') {
      const enhancedDropdown = this.enhancedDropdowns.get('category');
      if (enhancedDropdown && enhancedDropdown.getValue) {
        const enhancedValue = enhancedDropdown.getValue();
        if (enhancedValue && enhancedValue !== '') {
          category = enhancedValue;
          logInfo(`Generate: Using Enhanced Dropdown value for category: "${enhancedValue}"`);
        }
      }
    }

    const formData = new FormData(form);
    const nameFormat = formData.get('names-format') || DEFAULT_NAME_FORMAT;
    const count = parseInt(formData.get('names-count')) || 1;

    logInfo(`Generating ${count} names: ${language}.${species}.${category}`);

    if (!language || !species || !category) {
      ui.notifications.warn(game.i18n.localize("names.select-all"));
      logWarn(`Missing values: language="${language}", species="${species}", category="${category}"`);
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

        try {
          if (category === 'names') {
            generatedName = await this._generateNameWithSelections(form, language, species, nameFormat);
          } else if (isCategorizedContent(category)) {
            logDebug(`Attempting to generate categorized content for: ${language}.${species}.${category}`);
            generatedName = await this._generateCategorizedContent(form, language, species, category);
          } else {
            generatedName = await this._generateSimpleName(language, species, category);
          }

          if (generatedName) {
            results.push(generatedName);
            logDebug(`Generated name ${i + 1}/${count}: ${generatedName}`);
          } else {
            logError(`No name generated for iteration ${i + 1}, category: ${category}`);
          }
        } catch (innerError) {
          logError(`Error generating name for iteration ${i + 1}:`, innerError);
          // Continue with next iteration instead of failing completely
        }
      }

      if (results.length === 0) {
        throw new Error(game.i18n.localize("names.no-names-generated"));
      }

      const resultDiv = form.querySelector('#names-result-display');
      const authorCredits = this._collectAuthorCredits(language, species, [category]);

      // Add updating class for shimmer effect
      resultDiv.classList.add('updating');

      // Clear previous results with a short delay
      setTimeout(() => {
        let resultsHtml = results.map(name =>
          `<div class="${CSS_CLASSES.generatedName}">${name}</div>`
        ).join('');

        resultDiv.innerHTML = resultsHtml + authorCredits;

        // Remove updating class after animation starts
        setTimeout(() => {
          resultDiv.classList.remove('updating');
        }, 300);
      }, 100);

      form.querySelector('#names-copy-btn').disabled = false;
      form.querySelector('#names-clear-btn').disabled = false;

      logInfo(`Successfully generated ${results.length} names`);

      // Resize window after generating names
      setTimeout(() => this._resizeToContent(), 100);

    } catch (error) {
      logError("Name generation failed", error);
      const errorMsg = game.i18n.format("names.generation-error", { error: error.message });
      ui.notifications.error(errorMsg);
    }
  }

  async _generateCategorizedContent(form, language, species, category) {
    const $form = $(form);
    const globalNamesData = getGlobalNamesData();

    logDebug(`_generateCategorizedContent called with: ${language}.${species}.${category}`);

    // Ensure data is loaded before accessing it
    const dataLoaded = await globalNamesData.ensureDataLoaded(language, species, category);
    logDebug(`Data loaded result for ${language}.${species}.${category}: ${dataLoaded}`);
    if (!dataLoaded) {
      throw new Error(`No data file available for ${language}.${species}.${category}`);
    }

    // Get selected subcategories (with smart default)
    const selectedSubcategories = [];
    $form.find('input[name^="names-subcategory-"]:checked').each(function() {
      const subcategoryName = this.name.replace('names-subcategory-', '');
      selectedSubcategories.push(subcategoryName);
    });

    // Smart default: if no subcategories selected, use all available subcategories
    let subcategoriesToUse = selectedSubcategories;
    if (selectedSubcategories.length === 0) {
      subcategoriesToUse = globalNamesData.getAvailableSubcategories(language, species, category);
      logDebug("No subcategories selected, using all available:", subcategoriesToUse);
    }

    if (subcategoriesToUse.length === 0) {
      throw new Error(`No subcategories available for ${language}.${species}.${category}`);
    }

    // Randomly select a subcategory for this generation
    const randomSubcategory = subcategoriesToUse[Math.floor(Math.random() * subcategoriesToUse.length)];
    
    // Get data from the selected subcategory
    const subcategoryData = globalNamesData.getSubcategoryData(language, species, category, randomSubcategory);
    
    if (!subcategoryData || subcategoryData.length === 0) {
      throw new Error(`No data available for subcategory ${randomSubcategory}`);
    }

    // Select a random item from the subcategory
    const randomItem = subcategoryData[Math.floor(Math.random() * subcategoryData.length)];
    
    logDebug(`Generated categorized content from ${category}.${randomSubcategory}: ${randomItem}`);
    return randomItem;
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
    } else if (category === 'nicknames') {
      // Special handling for nicknames - they have gendered structure
      const { getSupportedGenders } = await import('../shared/constants.js');
      const supportedGenders = getSupportedGenders();
      const randomGender = supportedGenders[Math.floor(Math.random() * supportedGenders.length)];
      const nickname = this._getRandomFromGenderedData(language, species, 'nicknames', randomGender);
      return nickname ? `"${nickname}"` : null;
    } else if (category === 'titles') {
      // Special handling for titles - they have gendered structure and need settlements
      const { getSupportedGenders } = await import('../shared/constants.js');
      const supportedGenders = getSupportedGenders();
      const randomGender = supportedGenders[Math.floor(Math.random() * supportedGenders.length)];
      return this._generateTitle(language, species, randomGender, null);
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

  /**
   * Handles the copy names button click event
   * @param {Event} event - The click event
   */
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

    // Add updating class for shimmer effect during clear
    resultDiv.classList.add('updating');

    setTimeout(() => {
      resultDiv.innerHTML = `<div class="names-module-no-result">${game.i18n.localize("names.select-options")}</div>`;

      form.querySelector('#names-copy-btn').disabled = true;
      form.querySelector('#names-clear-btn').disabled = true;

      // Remove updating class
      setTimeout(() => {
        resultDiv.classList.remove('updating');
      }, 300);

      logDebug("Results cleared and buttons disabled");

      // Resize after clearing results
      this._resizeToContent();
    }, 100);
  }

  /**
   * Calculate required height based on visible content
   */
  _calculateRequiredHeight() {
    if (!this.element || !this.element[0]) return this.minHeight;

    const contentElement = this.element.find('.window-content')[0];
    if (!contentElement) return this.minHeight;

    // Get the natural height of all content
    const children = Array.from(contentElement.children);
    let totalHeight = 0;

    // Add padding and margins
    const computedStyle = window.getComputedStyle(contentElement);
    const padding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
    const margin = parseInt(computedStyle.marginTop) + parseInt(computedStyle.marginBottom);

    // Calculate height of all visible content
    children.forEach(child => {
      if (child.offsetHeight > 0) {
        const childStyle = window.getComputedStyle(child);
        const childMargin = parseInt(childStyle.marginTop) + parseInt(childStyle.marginBottom);
        totalHeight += child.offsetHeight + childMargin;
      }
    });

    // Add window header height (estimated)
    const headerHeight = 30;

    // Add some buffer for comfortable spacing
    const buffer = 20;

    const requiredHeight = headerHeight + totalHeight + padding + margin + buffer;

    logDebug(`Calculated required height: ${requiredHeight}px (content: ${totalHeight}px)`);

    // Clamp to min/max values
    return Math.max(this.minHeight, Math.min(this.maxHeight, requiredHeight));
  }

  /**
   * Resize window to fit content with smooth animation
   */
  _resizeToContent() {
    if (!this.autoResize || !this.element || !this.element[0]) return;

    const newHeight = this._calculateRequiredHeight();
    const currentHeight = this.position.height;

    // Only resize if there's a significant difference (avoid micro-adjustments)
    if (Math.abs(newHeight - currentHeight) > 10) {
      logDebug(`Resizing window from ${currentHeight}px to ${newHeight}px`);

      // Add CSS transition for smooth resizing
      this.element.css('transition', 'height 0.3s ease-out');

      // Perform the resize
      this.setPosition({ height: newHeight });

      // Remove transition after animation completes
      setTimeout(() => {
        if (this.element) {
          this.element.css('transition', '');
        }
      }, 300);
    }
  }

  /**
   * Get the default language from module settings
   */
  _getFoundryLanguage() {
    const defaultLanguageSetting = game.settings.get("nomina-names", "defaultLanguage");

    // If set to "auto", use Foundry language
    if (defaultLanguageSetting === "auto") {
      const foundryLang = game.settings.get("core", "language");

      const languageMapping = {
        'en': 'en',
        'de': 'de',
        'fr': 'fr',
        'es': 'es',
        'it': 'it'
      };

      const mappedLang = languageMapping[foundryLang] || 'de';
      logDebug(`Auto mode: Foundry language ${foundryLang} mapped to ${mappedLang}`);

      const globalNamesData = getGlobalNamesData();
      if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(mappedLang)) {
        return mappedLang;
      }

      // Fallback to 'de' if mapped language not available
      logDebug(`Language ${mappedLang} not available, falling back to 'de'`);
      return 'de';
    }

    // Use specific language setting
    logDebug(`Using module default language setting: ${defaultLanguageSetting}`);

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.availableLanguages && globalNamesData.availableLanguages.has(defaultLanguageSetting)) {
      return defaultLanguageSetting;
    }

    // Fallback to 'de' if set language not available
    logDebug(`Set language ${defaultLanguageSetting} not available, falling back to 'de'`);
    return 'de';
  }

  /**
   * Set the default language selection in the dropdown
   */
  _setDefaultLanguage() {
    if (!this.element || !this.element[0]) return;

    const defaultLang = this._getFoundryLanguage();
    const languageSelect = this.element[0].querySelector('#names-language-select');

    if (languageSelect && defaultLang) {
      // Set value for native select
      languageSelect.value = defaultLang;

      // If Enhanced Dropdown is available, update it too
      const enhancedDropdown = this.enhancedDropdowns.get('language');
      if (enhancedDropdown && enhancedDropdown.setValue) {
        enhancedDropdown.setValue(defaultLang);
        logDebug(`Set default language to ${defaultLang} via Enhanced Dropdown`);
      } else {
        logDebug(`Set default language to ${defaultLang} via native select`);
      }

      // Trigger change event to update UI
      $(languageSelect).trigger('change');
    }
  }
}