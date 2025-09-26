/**
 * Names Generator App - Main application for generating names
 * Updated for simplified UI with gender and component checkboxes + categorized content subcategories
 */

import { ensureGlobalNamesData, getGlobalNamesData } from '../core/data-manager.js';
import { showLoadingState, hideLoadingState } from '../utils/ui-helpers.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, DEFAULT_NAME_FORMAT, isCategorizedContent, getSubcategories, isGeneratorOnlyCategory } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { NamesAPI } from '../api-system.js';

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
      height: 800, // Reduced initial height for more compact layout
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

    // Safely get data with proper fallbacks
    let languages = [];
    let species = [];
    let categories = [];
    let isLoading = false;
    let isLoaded = false;

    if (globalNamesData) {
      try {
        languages = globalNamesData.getLocalizedLanguages() || [];
        species = globalNamesData.getLocalizedSpecies() || [];
        categories = await globalNamesData.getLocalizedCategoriesForGenerator('generator') || [];
        isLoading = globalNamesData.isLoading;
        isLoaded = globalNamesData.isLoaded;
      } catch (error) {
        logError("Error getting data in generator-app getData:", error);
        // Keep default empty arrays
      }
    }

    logDebug("generator-app getData analysis:", {
      globalNamesDataExists: !!globalNamesData,
      isLoaded: globalNamesData?.isLoaded,
      isLoading: globalNamesData?.isLoading,
      nameDataSize: globalNamesData?.nameData?.size || 0,
      localizedSpecies: species
    });

    const data = {
      languages: languages,
      species: species,
      categories: categories,
      isLoading: isLoading,
      isLoaded: isLoaded,
      supportedGenders: getSupportedGenders() || [],
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
   * Handles dropdown change events with cascading behavior
   * @param {Event} event - The change event
   */
  _onDropdownChange(event) {
    const $form = $(event.currentTarget).closest('form');
    const changedElement = event.currentTarget;
    logInfo(`Dropdown changed: ${changedElement.name} = "${changedElement.value}"`);

    // Implement cascading behavior
    if (changedElement.name === 'names-language') {
      // When language changes, reset species and category
      $form.find('#names-species-select').val('');
      $form.find('#names-category-select').val('');
      this._updateEnhancedDropdownValue('species', '');
      this._updateEnhancedDropdownValue('category', '');
      logInfo('Language changed - reset species and category');
    } else if (changedElement.name === 'names-species') {
      // When species changes, reset category
      $form.find('#names-category-select').val('');
      this._updateEnhancedDropdownValue('category', '');
      logInfo('Species changed - reset category');
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

    // Update species options based on language (cascading)
    await this._updateSpeciesOptions($form, language);
    logInfo("Species options updated");

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

  /**
   * Updates species dropdown options based on current language selection
   * @param {jQuery} $form - The form element
   * @param {string} language - Selected language
   */
  async _updateSpeciesOptions($form, language) {
    if (!language) {
      logDebug("No language selected, clearing species options");
      const speciesSelect = $form.find('#names-species-select');
      speciesSelect.empty();
      speciesSelect.append('<option value="">' + game.i18n.localize("names.ui.choose-species") + '</option>');
      this._updateEnhancedDropdownOptions('species');
      return;
    }

    const globalNamesData = getGlobalNamesData();
    if (!globalNamesData) return;

    let allSpecies = [];
    try {
      allSpecies = globalNamesData.getLocalizedSpecies() || [];
    } catch (error) {
      logError("Error getting localized species:", error);
      allSpecies = [];
    }

    const speciesSelect = $form.find('#names-species-select');
    const currentSpecies = speciesSelect.val();

    // Filter species that have data for the selected language
    const availableSpecies = [];
    if (Array.isArray(allSpecies)) {
      for (const species of allSpecies) {
        if (species && species.code && (
            globalNamesData.hasData(language, species.code, 'names') ||
            globalNamesData.hasData(language, species.code, 'male') ||
            globalNamesData.hasData(language, species.code, 'female'))) {
          availableSpecies.push(species);
        }
      }
    }

    // Rebuild options
    speciesSelect.empty();
    speciesSelect.append('<option value="">' + game.i18n.localize("names.ui.choose-species") + '</option>');

    for (const species of availableSpecies) {
      speciesSelect.append(`<option value="${species.code}">${species.name}</option>`);
    }

    // Try to restore previous selection if still available
    if (currentSpecies && availableSpecies.some(s => s.code === currentSpecies)) {
      speciesSelect.val(currentSpecies);
    } else {
      // Current species not available for this language, clear selection
      speciesSelect.val('');
    }

    this._updateEnhancedDropdownOptions('species');
    logDebug(`Updated species options for language ${language}, ${availableSpecies.length} available`);
  }

  async _updateCategoryOptions($form, language, species) {
    const globalNamesData = getGlobalNamesData();
    const categorySelect = $form.find('#names-category-select');

    if (!globalNamesData || !language || !species) {
      logDebug("Cannot update categories - missing data or selection, clearing options");
      categorySelect.empty();
      categorySelect.append('<option value="">' + game.i18n.localize("names.ui.choose-category") + '</option>');
      this._updateEnhancedDropdownOptions('category');
      return;
    }

    const currentCategory = categorySelect.val();

    // Get categories available for this specific language/species combination
    let availableCategories = [];
    try {
      availableCategories = await globalNamesData.getLocalizedCategoriesForLanguageAndSpecies(language, species, 'generator') || [];
    } catch (error) {
      logError(`Error getting categories for ${language}.${species}:`, error);
      availableCategories = [];
    }

    logDebug(`Updating categories for ${language}.${species}:`, availableCategories);

    // Clear and repopulate the category dropdown
    categorySelect.empty();

    // Add default option
    categorySelect.append('<option value="">' + game.i18n.localize("names.ui.choose-category") + '</option>');

    // Add available categories grouped - ensure availableCategories is an array
    if (Array.isArray(availableCategories)) {
      for (const group of availableCategories) {
        if (group && Array.isArray(group.items)) {
          const optgroup = $(`<optgroup label="${group.groupLabel || 'Categories'}"></optgroup>`);
          for (const item of group.items) {
            if (item && item.code && item.name) {
              optgroup.append(`<option value="${item.code}">${item.name}</option>`);
            }
          }
          categorySelect.append(optgroup);
        }
      }
    }

    // Try to restore previous selection if still available
    if (currentCategory && Array.isArray(availableCategories)) {
      const isStillAvailable = availableCategories.some(group =>
        group && Array.isArray(group.items) && group.items.some(item => item && item.code === currentCategory)
      );
      if (isStillAvailable) {
        categorySelect.val(currentCategory);
      }
    }

    // Update Enhanced Dropdown if available
    const enhancedDropdown = this.enhancedDropdowns.get('category');
    if (enhancedDropdown && enhancedDropdown.loadItems) {
      logInfo("Reloading Enhanced Dropdown options for category");
      enhancedDropdown.loadItems(); // Lädt Items vom ursprünglichen select neu
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

    const supportedGenders = getSupportedGenders() || [];
    const availableGenders = [];

    logDebug(`Checking gender data availability for ${language}.${species}`, { supportedGenders });

    // Check which genders have data available - try to load if not present
    if (Array.isArray(supportedGenders)) {
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
    logInfo(`DEBUG: Calling ensureDataLoaded for ${language}.${species}.${category}`);
    const hasData = await globalNamesData.ensureDataLoaded(language, species, category);
    logInfo(`DEBUG: ensureDataLoaded returned: ${hasData}`);
    if (!hasData) {
      logDebug(`No data available for ${language}.${species}.${category}`);
      return;
    }

    // Get available subcategories from data
    let availableSubcategories = [];
    try {
      logInfo(`DEBUG: Getting subcategories for ${language}.${species}.${category}`);
      logInfo(`DEBUG: globalNamesData constructor:`, globalNamesData.constructor.name);
      logInfo(`DEBUG: globalNamesData.getAvailableSubcategories exists:`, typeof globalNamesData.getAvailableSubcategories);
      logInfo(`DEBUG: globalNamesData.apiSpecies keys:`, Array.from(globalNamesData.apiSpecies?.keys() || []));
      logInfo(`DEBUG: globalNamesData has species ${species}:`, globalNamesData.apiSpecies?.has(species));

      if (globalNamesData.apiSpecies?.has(species)) {
        const apiSpecies = globalNamesData.apiSpecies.get(species);
        logInfo(`DEBUG: API species ${species} data:`, apiSpecies);
        logInfo(`DEBUG: API species ${species} dataFiles keys:`, Array.from(apiSpecies.dataFiles?.keys() || []));
      }

      availableSubcategories = globalNamesData.getAvailableSubcategories(language, species, category) || [];
      logInfo(`DEBUG: getAvailableSubcategories returned:`, availableSubcategories);
    } catch (error) {
      logError(`Error getting subcategories for ${language}.${species}.${category}:`, error);
      availableSubcategories = [];
    }

    if (!Array.isArray(availableSubcategories) || availableSubcategories.length === 0) {
      logDebug(`No subcategories available for ${language}.${species}.${category}`);
      return;
    }

    logDebug(`Available subcategories for ${language}.${species}.${category}:`, availableSubcategories);

    // Generate subcategory checkboxes
    let checkboxesHtml = '';
    const subcategoryDefinitions = getSubcategories(category);

    for (const subcategory of availableSubcategories) {
      let subcategoryKey, subcategoryLabel;

      // Handle 3.0.0 format with display names
      if (typeof subcategory === 'object' && subcategory.key && subcategory.displayName) {
        subcategoryKey = subcategory.key;
        const currentLanguage = this._getFoundryLanguage();
        subcategoryLabel = subcategory.displayName[currentLanguage] || subcategory.displayName.en || subcategory.displayName.de || subcategoryKey;
      } else {
        // Handle legacy format
        subcategoryKey = subcategory;
        const locKey = subcategoryDefinitions[subcategory] || `names.subcategory-translations.${category}.${subcategory}`;
        subcategoryLabel = game.i18n.localize(locKey) || subcategory.replace(/_/g, ' ');
      }

      // Auto-check all subcategories by default to ensure generation works
      const isChecked = 'checked';

      checkboxesHtml += `
        <label class="names-module-checkbox-item">
          <input type="checkbox" name="names-subcategory-${subcategoryKey}" ${isChecked}>
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
   * Now simplified to use the central API
   * @param {Event} event - The click event
   */
  async _onGenerateName(event) {
    event.preventDefault();
    logDebug("Generate name button clicked");

    const form = event.currentTarget.closest('form');
    const $form = $(form);

    // Get form values
    const options = this._getGenerationOptions($form);

    if (!options.language || !options.species || !options.category) {
      ui.notifications.warn(game.i18n.localize("names.select-all"));
      logWarn(`Missing values: language="${options.language}", species="${options.species}", category="${options.category}"`);
      return;
    }

    logInfo(`Generating ${options.count} names: ${options.language}.${options.species}.${options.category}`);

    try {
      // Use the simplified API for all generation
      const results = await NamesAPI.generateNames(options);

      if (results.length === 0) {
        throw new Error(game.i18n.localize("names.no-names-generated"));
      }

      // Display results
      this._displayResults(form, results, options);

      logInfo(`Successfully generated ${results.length} names`);

    } catch (error) {
      logError("Name generation failed", error);
      const errorMsg = game.i18n.format("names.generation-error", { error: error.message });
      ui.notifications.error(errorMsg);
    }
  }

  /**
   * Extract generation options from form
   * @param {jQuery} $form - The form element
   * @returns {Object} Generation options
   */
  _getGenerationOptions($form) {
    // Get basic values
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
        }
      }
    }

    const formData = new FormData($form[0]);
    const nameFormat = formData.get('names-format') || DEFAULT_NAME_FORMAT;
    const count = parseInt(formData.get('names-count')) || 1;

    const options = {
      language,
      species,
      category,
      format: nameFormat,
      count
    };

    // Handle names category with components and gender
    if (category === 'names') {
      options.components = this._getSelectedComponents($form);
      options.gender = this._getSelectedGender($form);
    }

    // Handle categorized content with subcategories
    if (isCategorizedContent(category)) {
      const selectedSubcategories = this._getSelectedSubcategories($form);
      if (selectedSubcategories.length > 0) {
        // Pick random subcategory from selected ones
        options.subcategory = selectedSubcategories[Math.floor(Math.random() * selectedSubcategories.length)];
      } else {
        // No subcategory selected - let the generator pick automatically
        options.subcategory = null;
      }
    }

    return options;
  }

  /**
   * Get selected name components from form
   */
  _getSelectedComponents($form) {
    const components = [];
    if ($form.find('input[name="names-include-firstname"]:checked').length) components.push('firstname');
    if ($form.find('input[name="names-include-surname"]:checked').length) components.push('surname');
    if ($form.find('input[name="names-include-title"]:checked').length) components.push('title');
    if ($form.find('input[name="names-include-nickname"]:checked').length) components.push('nickname');

    // Smart default: if no components selected, use firstname and surname
    return components.length > 0 ? components : ['firstname', 'surname'];
  }

  /**
   * Get selected gender from form
   */
  _getSelectedGender($form) {
    const selectedGenders = [];
    $form.find('input[name^="names-gender-"]:checked').each(function() {
      const genderName = this.name.replace('names-gender-', '');
      selectedGenders.push(genderName);
    });

    // Smart default: if no genders selected, use all available genders
    if (selectedGenders.length === 0) {
      $form.find('input[name^="names-gender-"]').each(function() {
        const genderName = this.name.replace('names-gender-', '');
        selectedGenders.push(genderName);
      });
    }

    // Return random gender from selected ones
    return selectedGenders.length > 0 ?
      selectedGenders[Math.floor(Math.random() * selectedGenders.length)] : 'male';
  }

  /**
   * Get selected subcategories from form
   */
  _getSelectedSubcategories($form) {
    const subcategories = [];
    $form.find('input[name^="names-subcategory-"]:checked').each(function() {
      const subcategoryName = this.name.replace('names-subcategory-', '');
      subcategories.push(subcategoryName);
    });
    return subcategories;
  }

  /**
   * Display generation results
   */
  _displayResults(form, results, options) {
    const resultDiv = form.querySelector('#names-result-display');
    const authorCredits = this._collectAuthorCredits(options.language, options.species, [options.category]);

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

    // Resize window after generating names
    setTimeout(() => this._resizeToContent(), 100);
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
   * Updates an Enhanced Dropdown value
   * @param {string} dropdownName - Name of the dropdown (language, species, category)
   * @param {string} value - Value to set
   */
  _updateEnhancedDropdownValue(dropdownName, value) {
    const enhancedDropdown = this.enhancedDropdowns.get(dropdownName);
    if (enhancedDropdown && enhancedDropdown.setValue) {
      enhancedDropdown.setValue(value);
      logDebug(`Updated ${dropdownName} Enhanced Dropdown to: "${value}"`);
    }
  }

  /**
   * Updates Enhanced Dropdown options after rebuilding select options
   * @param {string} dropdownName - Name of the dropdown to update
   */
  _updateEnhancedDropdownOptions(dropdownName) {
    const enhancedDropdown = this.enhancedDropdowns.get(dropdownName);
    if (enhancedDropdown && enhancedDropdown.loadItems) {
      enhancedDropdown.loadItems();
      logDebug(`Reloaded Enhanced Dropdown options for ${dropdownName}`);
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