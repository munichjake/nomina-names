/**
 * Names Generator App
 * Updated to use V4 API with dynamic recipe generation
 * Maintains old UI for gender and component selection
 */

import { getGlobalGenerator } from '../api/generator.js';
import { getHistoryManager } from '../core/history-manager.js';
import { getSupportedGenders, TEMPLATE_PATHS, CSS_CLASSES, MODULE_ID } from '../shared/constants.js';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';
import { NamesHistoryApp } from './history-app.js';
import { initializeEnhancedDropdowns } from '../components/enhanced-dropdown.js';

export class NamesGeneratorApp extends Application {
  constructor(options = {}) {
    super(options);
    this.generator = null;
    this.currentLanguage = null;
    this.currentSpecies = null;
    this.currentCategory = null; // Will use catalogs now
    this.generatedNames = [];
    this.favoritedNames = new Set(); // Track favorited names
    this.supportedGenders = getSupportedGenders();
    this._isFirstRender = true; // Track first render to avoid infinite loop
    this.currentView = 'detailed'; // 'detailed' or 'simple'
    this.currentMode = 'components'; // 'components' or 'recipe'
    this.currentRecipe = null; // Currently selected recipe ID
    this.lastRecipeDefinition = ''; // Store last recipe definition for "selbst definieren"
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-generator",
      title: game.i18n.localize("names.window-title") || "Nomina Names - Generator",
      template: TEMPLATE_PATHS.generator,
      width: 900,
      height: 800,
      resizable: true,
      classes: [CSS_CLASSES.moduleApp]
    });
  }

  async getData() {
    if (!this.generator) {
      this.generator = getGlobalGenerator();
      await this.generator.initialize();
    }

    // Set default language if not set
    if (!this.currentLanguage) {
      this.currentLanguage = this._getFoundryLanguage();
    }

    // Get available data
    const languages = await this.generator.getAvailableLanguages();
    const species = this.currentLanguage
      ? await this.generator.getAvailableSpecies(this.currentLanguage)
      : [];

    // Get catalogs (categories) for current package
    let categories = [];
    if (this.currentLanguage && this.currentSpecies) {
      const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;
      const catalogs = await this.generator.getAvailableCatalogs(packageCode, this.currentLanguage);

      // Catalogs already come as { code, name } objects
      // Template checks for length property, so we add it
      categories = [{
        length: catalogs.length, // Add length for template check
        groupLabel: game.i18n.localize("names.categories") || "Categories",
        items: catalogs // Already in the right format
      }];
    }

    return {
      languages: languages.map(code => ({ code, name: code.toUpperCase() })),
      species, // Already contains { code, name } objects with localized names
      categories,
      defaultLanguage: this.currentLanguage,
      isLoading: false,
      isLoaded: true,
      supportedGenders: this.supportedGenders
    };
  }

  _capitalizeSpecies(species) {
    return species.charAt(0).toUpperCase() + species.slice(1);
  }

  /**
   * Apply preselection to language dropdown
   * (Placeholders are now auto-localized via placeholderI18n in data-enhanced)
   */
  _updateEnhancedDropdownOptions(html) {
    // Language dropdown - preselect default content language
    const languageDropdown = html.find('#names-language-select')[0]?.nextSibling?._enhancedDropdown;
    if (languageDropdown) {
      // Set preselect to default content language if not already set
      if (!languageDropdown.selectedValues && this.currentLanguage) {
        languageDropdown.options.preselect = this.currentLanguage;
        languageDropdown.loadItems(); // Reload to apply preselect
      }

      languageDropdown.updateDisplay();
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Hide view toggle initially (will be shown only when there's metadata)
    html.find('.names-module-view-toggle').hide();

    // Update enhanced dropdown options after they are initialized
    setTimeout(() => {
      this._updateEnhancedDropdownOptions(html);
    }, 50);

    // Language change
    html.find('#names-language-select').change(async (ev) => {
      this.currentLanguage = ev.target.value;
      this.currentSpecies = null;
      this.currentCategory = null;
      this.generatedNames = [];
      await this._updateSpeciesDropdown(html);
      await this._updateCategoriesDropdown(html);
    });

    // Species change
    html.find('#names-species-select').change(async (ev) => {
      this.currentSpecies = ev.target.value;
      this.currentCategory = null;
      this.generatedNames = [];
      await this._updateCategoriesDropdown(html);
    });

    // Category change
    html.find('#names-category-select').change(async (ev) => {
      this.currentCategory = ev.target.value;
      await this._updateComponentsPanel(html);
    });

    // Generate button
    html.find('#names-generate-btn').click(async (ev) => {
      ev.preventDefault();
      await this._onGenerateName(html);
    });

    // Copy all names
    html.find('#names-copy-btn').click(async (ev) => {
      ev.preventDefault();
      await this._onCopyNames(html);
    });

    // Clear results
    html.find('#names-clear-btn').click((ev) => {
      ev.preventDefault();
      this._onClearResult(html);
    });

    // History button
    html.find('#names-history-btn').click((ev) => {
      ev.preventDefault();
      new NamesHistoryApp().render(true);
    });

    // View toggle buttons
    html.find('.names-module-toggle-btn').click((ev) => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const view = btn.data('view');

      if (view === this.currentView) return; // Already in this view

      this.currentView = view;

      // Update button states
      html.find('.names-module-toggle-btn').removeClass('active');
      btn.addClass('active');

      // Update result display
      this._updateResultDisplay(html);

      logDebug(`View switched to: ${view}`);
    });

    // Mode toggle buttons (Components vs Recipe)
    html.find('.names-module-mode-btn').click((ev) => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const mode = btn.data('mode');

      if (mode === this.currentMode) return; // Already in this mode

      this.currentMode = mode;

      // Update button states
      html.find('.names-module-mode-btn').removeClass('active');
      btn.addClass('active');

      // Toggle content visibility
      if (mode === 'recipe') {
        html.find('.names-module-components-content').hide();
        html.find('.names-module-recipe-content').show();
        this._updateRecipeDropdown(html);
      } else {
        html.find('.names-module-recipe-content').hide();
        html.find('.names-module-components-content').show();
      }

      logDebug(`Mode switched to: ${mode}`);
    });

    // Recipe dropdown change
    html.find('#names-recipe-select').change(async (ev) => {
      const recipeId = ev.target.value;
      this.currentRecipe = recipeId;
      await this._onRecipeSelected(html, recipeId);
    });

    // Recipe copy button
    html.find('#names-recipe-copy-btn').click(async (ev) => {
      ev.preventDefault();
      await this._onCopyRecipe(html);
    });

    // Recipe clear button
    html.find('#names-recipe-clear-btn').click((ev) => {
      ev.preventDefault();
      this._onClearRecipe(html);
    });

    // Recipe seed randomize button
    html.find('#names-recipe-randomize-seed').click((ev) => {
      ev.preventDefault();
      this._onRandomizeSeed(html);
    });

    // Copy individual name (detailed view)
    html.find('#names-result-display').on('click', '.names-module-generated-name', async (ev) => {
      const nameEl = $(ev.currentTarget);
      const name = nameEl.data('name');
      if (name) {
        await this._handleNameClick(name, nameEl);
      }
    });

    // Copy individual name (simple view)
    html.find('#names-result-display').on('click', '.names-module-simple-name', async (ev) => {
      const nameEl = $(ev.currentTarget);
      const name = nameEl.data('name');
      if (name) {
        await this._handleNameClick(name, nameEl);
      }
    });

    // Toggle favorite (both views)
    html.find('#names-result-display').on('click', '.favorite-toggle', (ev) => {
      ev.stopPropagation(); // Prevent copy action
      const btn = $(ev.currentTarget);
      const nameEl = btn.closest('.names-module-generated-name, .names-module-simple-name');
      const name = nameEl.data('name');

      if (this.favoritedNames.has(name)) {
        this.favoritedNames.delete(name);
        btn.removeClass('active');
        nameEl.removeClass('favorited');
      } else {
        this.favoritedNames.add(name);
        btn.addClass('active');
        nameEl.addClass('favorited');
      }

      logDebug(`Toggled favorite for: ${name}. Total favorites: ${this.favoritedNames.size}`);
    });

    // Set default language only on first render
    if (this._isFirstRender) {
      this._isFirstRender = false;
      setTimeout(() => {
        this._setDefaultLanguage(html);
      }, 100);
    }
  }

  async _updateSpeciesDropdown(html) {
    const speciesSelect = html.find('#names-species-select');
    const species = this.currentLanguage
      ? await this.generator.getAvailableSpecies(this.currentLanguage)
      : [];

    // Get the native select element
    const nativeSelect = speciesSelect[0];

    // Update native select
    speciesSelect.empty();
    speciesSelect.append('<option value=""></option>'); // Empty placeholder option

    // Species is now array of { code, name } objects with localized names
    for (const item of species) {
      speciesSelect.append(`<option value="${item.code}">${item.name}</option>`);
    }

    // If enhanced dropdown exists, reload its items
    const container = nativeSelect.nextSibling;
    if (container && container._enhancedDropdown) {
      container._enhancedDropdown.loadItems();
    }
  }

  async _updateCategoriesDropdown(html) {
    const categorySelect = html.find('#names-category-select');
    const nativeSelect = categorySelect[0];

    categorySelect.empty();
    categorySelect.append('<option value=""></option>'); // Empty placeholder option

    if (this.currentLanguage && this.currentSpecies) {
      const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;
      const catalogs = await this.generator.getAvailableCatalogs(packageCode, this.currentLanguage);

      if (catalogs && catalogs.length > 0) {
        for (const catalog of catalogs) {
          // Catalog is already an object with { code, name } where name is localized
          categorySelect.append(`<option value="${catalog.code}" class="names-category-item">${catalog.name}</option>`);
        }
      }
    }

    // If enhanced dropdown exists, reload its items
    const container = nativeSelect.nextSibling;
    if (container && container._enhancedDropdown) {
      container._enhancedDropdown.loadItems();
    }

    await this._updateComponentsPanel(html);
  }

  async _updateComponentsPanel(html) {
    const componentsSection = html.find('.names-module-components-section');
    const genderSection = html.find('.names-module-gender-section');
    const subcategorySection = html.find('.names-module-subcategory-section');
    const generateBtn = html.find('#names-generate-btn');

    logDebug(`_updateComponentsPanel called for category: ${this.currentCategory}`);

    // Show gender and components sections for person name catalogs
    if (this.currentCategory === 'firstnames' || this.currentCategory === 'surnames' ||
        this.currentCategory === 'titles' || this.currentCategory === 'nicknames' ||
        this.currentCategory === 'names') {
      logDebug('Showing gender/components sections');
      genderSection.show();
      componentsSection.show();
      subcategorySection.hide();

      // Fill gender checkboxes if not already filled
      const genderContainer = html.find('#gender-checkboxes-container');
      if (genderContainer.children().length === 0) {
        this._fillGenderCheckboxes(html);
      }

      // Enable generate button
      generateBtn.prop('disabled', false);
    } else if (this.currentCategory) {
      // For other catalogs, show collections if available
      logDebug('Checking for collections...');
      genderSection.hide();
      componentsSection.hide();

      // Check if collections are available
      const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;
      logDebug(`Package code: ${packageCode}, Category: ${this.currentCategory}`);

      const collections = await this._getCollectionsForCatalog(packageCode, this.currentCategory);
      logDebug(`Found ${collections ? collections.length : 0} collections`);

      if (collections && collections.length > 0) {
        logDebug('Showing collections section with', collections);
        subcategorySection.show();
        await this._fillCollectionCheckboxes(html, collections);
      } else {
        logDebug('No collections found, hiding section');
        subcategorySection.hide();
      }

      // Enable generate button when category is selected
      generateBtn.prop('disabled', false);
    } else {
      logDebug('No category selected, hiding all sections');
      genderSection.hide();
      componentsSection.hide();
      subcategorySection.hide();

      // Disable generate button when no category selected
      generateBtn.prop('disabled', true);
    }
  }

  _fillGenderCheckboxes(html) {
    const genderContainer = html.find('#gender-checkboxes-container');
    genderContainer.empty();

    for (const gender of this.supportedGenders) {
      const label = game.i18n.localize(`names.gender.${gender}`) || gender;
      const checkbox = `
        <label class="names-module-checkbox-item">
          <input type="checkbox" name="names-gender-${gender}" checked>
          <span class="names-module-checkmark"></span>
          ${label}
        </label>
      `;
      genderContainer.append(checkbox);
    }
  }

  async _onGenerateName(html) {
    if (!this.currentLanguage || !this.currentSpecies) {
      ui.notifications.warn(game.i18n.localize("names.select-all"));
      return;
    }

    const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;

    try {
      const count = parseInt(html.find('#names-count-input').val()) || 10;

      // Check if this is a person name generation (with gender/components)
      const isPersonName = this.currentCategory === 'firstnames' || this.currentCategory === 'surnames' ||
                          this.currentCategory === 'titles' || this.currentCategory === 'nicknames' ||
                          this.currentCategory === 'names';

      let result;

      if (isPersonName && this.currentMode === 'recipe') {
        // Recipe-based generation
        result = await this._generateWithRecipe(html, packageCode, count);
      } else if (isPersonName) {
        // Get selected genders
        const selectedGenders = [];
        html.find('input[name^="names-gender-"]:checked').each(function() {
          const genderName = this.name.replace('names-gender-', '');
          selectedGenders.push(genderName);
        });

        // Get selected components
        const components = [];
        if (html.find('input[name="names-include-firstname"]:checked').length) components.push('firstname');
        if (html.find('input[name="names-include-surname"]:checked').length) components.push('surname');
        if (html.find('input[name="names-include-title"]:checked').length) components.push('title');
        if (html.find('input[name="names-include-nickname"]:checked').length) components.push('nickname');

        // Default to firstname + surname if nothing selected
        if (components.length === 0) {
          components.push('firstname', 'surname');
        }

        // Get format string from input field, or build default
        let format = html.find('input[name="names-format"]').val()?.trim();
        if (!format) {
          // Build default format string if field is empty
          format = components.map(c => `{${c}}`).join(' ');
        }

        // Generate person names with mixed genders if multiple selected
        if (selectedGenders.length > 1) {
          // Generate a mix of names from all selected genders
          const suggestions = [];
          const errors = [];
          const namesPerGender = Math.ceil(count / selectedGenders.length);

          for (const gender of selectedGenders) {
            try {
              const genderResult = await this.generator.generatePersonName(packageCode, {
                locale: this.currentLanguage,
                n: namesPerGender,
                gender,
                components,
                format,
                allowDuplicates: false
              });

              suggestions.push(...genderResult.suggestions);
              if (genderResult.errors) {
                errors.push(...genderResult.errors);
              }
            } catch (error) {
              logError(`Failed to generate names for gender ${gender}:`, error);
              errors.push({ code: 'generation_failed', message: error.message, gender });
            }
          }

          // Shuffle to mix genders and trim to requested count
          const shuffled = suggestions.sort(() => Math.random() - 0.5).slice(0, count);
          result = {
            suggestions: shuffled,
            errors
          };
        } else {
          // Single gender or no gender selected - use original logic
          const gender = selectedGenders.length > 0 ? selectedGenders[0] : null;

          result = await this.generator.generatePersonName(packageCode, {
            locale: this.currentLanguage,
            n: count,
            gender,
            components,
            format,
            allowDuplicates: false
          });
        }
      } else {
        // Generate from catalog with collection filters
        const selectedCollections = [];
        html.find('input[name^="names-collection-"]:checked').each(function() {
          selectedCollections.push(this.value);
        });

        // If collections are selected, generate from collections
        if (selectedCollections.length > 0) {
          // Separate collections by type: recipe-based vs tag-based
          const allTags = [];
          const allRecipes = [];
          const errors = [];

          for (const collectionKey of selectedCollections) {
            const collection = this.generator.dataManager.getCollection(packageCode, collectionKey);
            if (collection && collection.query) {
              // If collection has recipes, use recipe-based generation
              if (collection.query.recipes && collection.query.recipes.length > 0) {
                allRecipes.push(...collection.query.recipes);
              }
              // If collection has tags, collect them for tag-based generation
              if (collection.query.tags) {
                allTags.push(...collection.query.tags);
              }
            }
          }

          // If we have recipes, use recipe-based generation
          if (allRecipes.length > 0) {
            // Remove duplicate recipes
            const uniqueRecipes = [...new Set(allRecipes)];

            logDebug(`Generating ${count} names from ${uniqueRecipes.length} recipes (random recipe per name)`);

            try {
              // Generate names one by one, picking a random recipe for each
              const suggestions = [];
              const errors = [];
              const generatedNames = new Set(); // Track unique names across all recipes

              let attempts = 0;
              const maxAttempts = count * 10; // Prevent infinite loops

              while (suggestions.length < count && attempts < maxAttempts) {
                attempts++;

                // Pick a truly random recipe for each name
                const randomRecipe = uniqueRecipes[Math.floor(Math.random() * uniqueRecipes.length)];

                // Create a unique seed for this attempt
                const nameSeed = `${Date.now()}-${Math.random()}-${attempts}`;

                logDebug(`Generating name ${suggestions.length + 1}/${count} with recipe: ${randomRecipe} (attempt ${attempts})`);

                try {
                  const singleResult = await this.generator.generate({
                    packageCode,
                    locale: this.currentLanguage,
                    n: 1,
                    recipes: randomRecipe,
                    seed: nameSeed,
                    allowDuplicates: false
                  });

                  if (singleResult.suggestions && singleResult.suggestions.length > 0) {
                    const newName = singleResult.suggestions[0].text;

                    // Only add if it's not a duplicate
                    if (!generatedNames.has(newName)) {
                      generatedNames.add(newName);
                      suggestions.push(singleResult.suggestions[0]);
                      logDebug(`✓ Added unique name: ${newName}`);
                    } else {
                      logDebug(`✗ Skipped duplicate name: ${newName}`);
                    }
                  }
                  if (singleResult.errors && singleResult.errors.length > 0) {
                    errors.push(...singleResult.errors);
                  }
                } catch (err) {
                  logError(`Failed to generate from recipe ${randomRecipe}:`, err);
                  errors.push({ code: 'generation_failed', message: err.message, recipe: randomRecipe });
                }
              }

              if (suggestions.length < count) {
                logWarn(`Only generated ${suggestions.length}/${count} unique names after ${attempts} attempts`);
              }

              result = {
                suggestions,
                errors
              };
            } catch (err) {
              logError(`Failed to generate from recipes:`, err);
              result = {
                suggestions: [],
                errors: [err.message]
              };
            }
          } else if (allTags.length > 0) {
            // Use tag-based generation if no recipes
            const uniqueTags = [...new Set(allTags)];

            logDebug(`Generating ${count} names from catalog ${this.currentCategory} with tags: ${uniqueTags.join(', ')}`);

            try {
              result = await this.generator.generateFromCatalog(packageCode, this.currentCategory, {
                locale: this.currentLanguage,
                n: count,
                tags: uniqueTags,
                anyOfTags: true, // Use OR logic to get variety from multiple collections
                allowDuplicates: false
              });
            } catch (err) {
              logError(`Failed to generate from catalog with collections:`, err);
              result = {
                suggestions: [],
                errors: [err.message]
              };
            }
          } else {
            // No tags or recipes - generate from catalog directly
            result = await this.generator.generateFromCatalog(packageCode, this.currentCategory, {
              locale: this.currentLanguage,
              n: count,
              allowDuplicates: false
            });
          }
        } else {
          // Generate from catalog directly (no collections filter)
          result = await this.generator.generateFromCatalog(packageCode, this.currentCategory, {
            locale: this.currentLanguage,
            n: count,
            allowDuplicates: false
          });
        }
      }

      if (result.errors && result.errors.length > 0) {
        logError('Generation errors:', result.errors);
        ui.notifications.error(game.i18n.localize('names.generation-error'));
      }

      // Keep favorited names and add new ones
      const newNames = result.suggestions.map(s => s.text);
      const favoritedNamesArray = Array.from(this.favoritedNames);

      // Combine: favorited names first, then new names (excluding any that are already favorited)
      const combinedNames = [...favoritedNamesArray, ...newNames.filter(name => !this.favoritedNames.has(name))];

      this.generatedNames = combinedNames;

      // Debug: Log all generated names with their catalog sources
      logDebug('=== GENERATION DEBUG ===');
      logDebug(`Generated ${result.suggestions.length} names from package: ${packageCode}`);
      result.suggestions.forEach((suggestion, index) => {
        logDebug(`[${index + 1}] Name: "${suggestion.text}" | Catalog: ${suggestion.catalog || 'unknown'} | Metadata:`, suggestion.metadata);
      });
      logDebug('=== END GENERATION DEBUG ===');

      // Check if any result has meaningful metadata (for showing/hiding view toggle)
      // Metadata like just 'catalog' or 'source' isn't meaningful for detailed view
      const hasMetadata = result.suggestions.some(s => {
        if (!s.metadata || Object.keys(s.metadata).length === 0) return false;
        // Filter out metadata that's just technical info (catalog, source, seed, etc.)
        const meaningfulKeys = Object.keys(s.metadata).filter(k =>
          k !== 'catalog' && k !== 'source' && k !== 'tags' && k !== 'index' && k !== 'seed'
        );
        logDebug(`Metadata keys:`, Object.keys(s.metadata), `Meaningful:`, meaningfulKeys);
        return meaningfulKeys.length > 0;
      });

      logDebug(`Has meaningful metadata: ${hasMetadata}`);
      this._updateViewToggleVisibility(html, hasMetadata);

      // Determine if this is first generation (show animation) or regeneration (keep favorited)
      const isFirstGeneration = this.favoritedNames.size === 0 && favoritedNamesArray.length === 0;
      this._displayResults(html, isFirstGeneration);

      // Add to history
      this._addToHistory();

      logInfo(`Generated ${this.generatedNames.length} names`);

    } catch (error) {
      logError('Failed to generate names:', error);
      ui.notifications.error(game.i18n.localize('names.generation-failed'));
    }
  }

  _displayResults(html, isInitialRender = true) {
    const resultDiv = html.find('#names-result-display');

    if (this.generatedNames.length === 0) {
      resultDiv.html('<div class="names-module-no-result">' +
        game.i18n.localize("names.select-options") + '</div>');
      return;
    }

    // Get existing favorited elements to keep them (detach preserves event handlers and prevents fade-out)
    const existingFavorited = new Map();
    if (!isInitialRender) {
      resultDiv.find('.names-module-generated-name.favorited, .names-module-simple-name.favorited').each((i, el) => {
        const $el = $(el);
        const name = $el.data('name');
        if (this.favoritedNames.has(name)) {
          existingFavorited.set(name, $el.detach()); // detach removes from DOM without destroying
        }
      });
    }

    resultDiv.empty();

    if (this.currentView === 'simple') {
      // Simple view: compact list with favorite button
      const container = $('<div class="names-module-simple-view"></div>');

      for (const name of this.generatedNames) {
        const isFavorited = this.favoritedNames.has(name);

        // Reuse existing favorited element if available (no animation)
        if (!isInitialRender && existingFavorited.has(name)) {
          container.append(existingFavorited.get(name));
        } else {
          // New item: always animate
          const favClass = isFavorited ? 'active' : '';
          const nameClass = isFavorited ? 'favorited' : '';
          const itemHtml = `
            <div class="names-module-simple-name ${nameClass} initial-render" data-name="${name}">
              <button type="button" class="favorite-toggle ${favClass}">⭐</button>
              <span class="name-text">${name}</span>
            </div>`;
          container.append(itemHtml);
        }
      }

      resultDiv.append(container);
    } else {
      // Detailed view: cards with favorite button
      for (const name of this.generatedNames) {
        const isFavorited = this.favoritedNames.has(name);

        // Reuse existing favorited element if available (no animation)
        if (!isInitialRender && existingFavorited.has(name)) {
          resultDiv.append(existingFavorited.get(name));
        } else {
          // New item: always animate
          const favClass = isFavorited ? 'active' : '';
          const nameClass = isFavorited ? 'favorited' : '';
          const itemHtml = `
            <div class="names-module-generated-name ${nameClass} initial-render" data-name="${name}">
              <div class="name-content-wrapper">
                <button type="button" class="favorite-toggle ${favClass}">⭐</button>
                <div class="name-content">
                  <div class="name-title">${name}</div>
                </div>
              </div>
            </div>
          `;
          resultDiv.append(itemHtml);
        }
      }
    }

    html.find('#names-copy-btn').prop('disabled', false);
    html.find('#names-clear-btn').prop('disabled', false);
  }

  _updateResultDisplay(html) {
    const resultDiv = html.find('#names-result-display');

    // Transform existing elements with grow/shrink animation
    const existingNames = resultDiv.find('.names-module-generated-name, .names-module-simple-name');

    if (existingNames.length > 0) {
      // Update existing elements with new classes
      existingNames.each((index, el) => {
        const $el = $(el);
        const name = $el.data('name');
        const isFavorited = this.favoritedNames.has(name);
        const favClass = isFavorited ? 'active' : '';

        // Remove animation class to prevent re-animation during view switch
        $el.removeClass('initial-render');

        if (this.currentView === 'simple') {
          // Transform to simple view with shrink animation
          $el.addClass('view-transition');
          $el.removeClass('names-module-generated-name').addClass('names-module-simple-name');
          $el.html(`
            <button type="button" class="favorite-toggle ${favClass}">⭐</button>
            <span class="name-text">${name}</span>
          `);
          setTimeout(() => $el.removeClass('view-transition'), 400);
        } else {
          // Transform to detailed view with grow animation
          $el.addClass('view-transition');
          $el.removeClass('names-module-simple-name').addClass('names-module-generated-name');
          $el.html(`
            <div class="name-content-wrapper">
              <button type="button" class="favorite-toggle ${favClass}">⭐</button>
              <div class="name-content">
                <div class="name-title">${name}</div>
              </div>
            </div>
          `);
          setTimeout(() => $el.removeClass('view-transition'), 400);
        }
      });

      // Update container
      const container = resultDiv.find('.names-module-simple-view');
      if (container.length > 0 && this.currentView !== 'simple') {
        container.contents().unwrap();
      } else if (container.length === 0 && this.currentView === 'simple') {
        resultDiv.children().wrapAll('<div class="names-module-simple-view"></div>');
      }
    } else {
      // No existing elements, do full render
      this._displayResults(html);
    }
  }

  async _onCopyNames(html) {
    if (this.generatedNames.length === 0) return;

    const names = this.generatedNames.join('\n');
    await navigator.clipboard.writeText(names);
    ui.notifications.info(game.i18n.localize("names.copied"));
  }

  _onClearResult(html) {
    this.generatedNames = [];
    const resultDiv = html.find('#names-result-display');
    resultDiv.html('<div class="names-module-no-result">' +
      game.i18n.localize("names.select-options") + '</div>');

    html.find('#names-copy-btn').prop('disabled', true);
    html.find('#names-clear-btn').prop('disabled', true);
  }

  _addToHistory() {
    const historyManager = getHistoryManager();

    const entries = this.generatedNames.map(name => ({
      name: name,
      source: 'generator',
      metadata: {
        language: this.currentLanguage,
        species: this.currentSpecies,
        category: this.currentCategory,
        timestamp: Date.now()
      }
    }));

    historyManager.addEntries(entries);
    logDebug(`Added ${entries.length} names to history`);
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

  _setDefaultLanguage(html) {
    const defaultLang = this._getFoundryLanguage();
    const languageSelect = html.find('#names-language-select');

    if (languageSelect.length && defaultLang) {
      languageSelect.val(defaultLang);
      languageSelect.trigger('change');
    }
  }

  // ============================================================
  // V4.0.1 Collections Support
  // ============================================================

  /**
   * Get collections for a specific catalog
   */
  async _getCollectionsForCatalog(packageCode, catalogKey) {
    try {
      const dataManager = this.generator.dataManager;
      logDebug('DataManager exists:', !!dataManager);

      if (!dataManager) {
        logError('No dataManager available');
        return [];
      }

      const hasSupport = dataManager.hasCollectionsSupport(packageCode);
      logDebug(`Package ${packageCode} has collections support:`, hasSupport);

      if (!hasSupport) {
        logDebug('Package does not have collections support');
        return [];
      }

      const collections = dataManager.getCollectionsForCatalog(packageCode, catalogKey);
      logDebug(`getCollectionsForCatalog returned:`, collections);

      return collections;
    } catch (error) {
      logError('Failed to get collections:', error);
      return [];
    }
  }

  /**
   * Fill collection checkboxes
   */
  async _fillCollectionCheckboxes(html, collections) {
    const container = html.find('#subcategory-checkboxes-container');
    container.empty();

    const dataManager = this.generator.dataManager;
    const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;

    for (const collection of collections) {
      // Get translated label
      const label = collection.labels?.[this.currentLanguage] ||
                   collection.labels?.en ||
                   collection.key;

      // Get icon for the first tag if available
      let icon = '';
      if (collection.query?.tags && collection.query.tags.length > 0) {
        const tagIcon = dataManager.getVocabIcon(packageCode, collection.query.tags[0]);
        if (tagIcon) {
          icon = tagIcon + ' ';
        }
      }

      const checkbox = `
        <label class="names-module-checkbox-item">
          <input type="checkbox" name="names-collection-${collection.key}" value="${collection.key}" checked>
          <span class="names-module-checkmark"></span>
          ${icon}${label}
        </label>
      `;
      container.append(checkbox);
    }
  }

  // ============================================================
  // Recipe Mode Support
  // ============================================================

  /**
   * Update recipe dropdown with available recipes
   */
  async _updateRecipeDropdown(html) {
    const recipeSelect = html.find('#names-recipe-select');
    const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;

    // Get available recipes
    const recipes = this.generator.dataManager.getRecipes(packageCode, this.currentLanguage);

    // Clear and repopulate
    recipeSelect.empty();
    recipeSelect.append('<option value=""></option>');

    // Add custom option first
    const customLabel = game.i18n.localize('names.custom-recipe');
    recipeSelect.append(`<option value="custom">${customLabel}</option>`);

    // Generate example names for each recipe and add to dropdown
    for (const recipe of recipes) {
      // Get display name (already localized by engine)
      const displayName = recipe.displayName || recipe.id;

      // Try to generate example name
      let exampleName = displayName; // Fallback to display name
      try {
        const exampleResult = await this._generateExampleForRecipe(packageCode, recipe.id);
        if (exampleResult) {
          exampleName = exampleResult;
        }
      } catch (error) {
        // Silently fail - use display name as fallback
        logDebug(`Could not generate example for recipe ${recipe.id}, using display name`);
      }

      // Create option with display name as main text and example as subtitle
      const examplePrefix = game.i18n.localize('names.example-prefix') || 'z.B.:';
      const subtitle = `${examplePrefix} ${exampleName}`;
      recipeSelect.append(`<option value="${recipe.id}" data-subtitle="${subtitle}">${displayName}</option>`);
    }

    // Initialize or reload enhanced dropdown
    const nativeSelect = recipeSelect[0];
    const container = nativeSelect?.nextSibling;

    if (container && container._enhancedDropdown) {
      // Enhanced dropdown already exists - reload items
      container._enhancedDropdown.loadItems();
    } else {
      // Initialize enhanced dropdown for the first time
      initializeEnhancedDropdowns('#names-recipe-select');
    }
  }

  /**
   * Generate example name for a recipe
   * Uses a consistent seed based on recipe ID for reproducible examples
   */
  async _generateExampleForRecipe(packageCode, recipeId) {
    try {
      // Create a simple hash-based seed from recipeId for consistency
      const seed = `examples`;

      const result = await this.generator.generate({
        packageCode,
        locale: this.currentLanguage,
        n: 1,
        recipes: recipeId,
        seed: seed,
        allowDuplicates: false
      });

      if (result.suggestions && result.suggestions.length > 0) {
        return result.suggestions[0].text;
      }
    } catch (error) {
      // Silently ignore - recipe might be incompatible with current data structure
      logDebug(`Skipping example generation for recipe ${recipeId} (incompatible)`);
    }
    return null;
  }

  /**
   * Handle recipe selection
   */
  async _onRecipeSelected(html, recipeId) {
    const recipeTextarea = html.find('#names-recipe-definition');
    const copyBtn = html.find('#names-recipe-copy-btn');
    const clearBtn = html.find('#names-recipe-clear-btn');

    if (!recipeId) {
      // No recipe selected
      recipeTextarea.val('');
      recipeTextarea.prop('disabled', true).prop('readonly', true);
      copyBtn.prop('disabled', true);
      clearBtn.prop('disabled', true);
      return;
    }

    if (recipeId === 'custom') {
      // Custom mode - enable textarea
      recipeTextarea.val(this.lastRecipeDefinition);
      recipeTextarea.prop('disabled', false).prop('readonly', false);
      copyBtn.prop('disabled', false);
      clearBtn.prop('disabled', false);
      return;
    }

    // Regular recipe - show full recipe definition
    const packageCode = `${this.currentSpecies}-${this.currentLanguage}`;
    const pkg = this.generator.dataManager.getPackage(packageCode);

    if (pkg && pkg.data.recipes) {
      const recipe = pkg.data.recipes.find(r => r.id === recipeId);

      if (recipe) {
        // Format complete recipe as JSON (not just id and displayName)
        const recipeJson = JSON.stringify(recipe, null, 2);
        recipeTextarea.val(recipeJson);
        recipeTextarea.prop('disabled', true).prop('readonly', true);

        // Store for custom mode
        this.lastRecipeDefinition = recipeJson;

        copyBtn.prop('disabled', false);
        clearBtn.prop('disabled', false);
      }
    }
  }

  /**
   * Copy recipe to clipboard
   */
  async _onCopyRecipe(html) {
    const recipeTextarea = html.find('#names-recipe-definition');
    const recipeText = recipeTextarea.val();

    if (recipeText) {
      await navigator.clipboard.writeText(recipeText);
      ui.notifications.info(game.i18n.localize('names.copied'));
    }
  }

  /**
   * Clear recipe definition
   */
  _onClearRecipe(html) {
    const recipeTextarea = html.find('#names-recipe-definition');
    recipeTextarea.val('');
    this.lastRecipeDefinition = '';
  }

  /**
   * Randomize seed
   */
  _onRandomizeSeed(html) {
    const seedInput = html.find('#names-recipe-seed');
    // Generate a random seed using timestamp and random number
    const randomSeed = `seed-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    seedInput.val(randomSeed);
  }

  /**
   * Generate names using selected recipe
   */
  async _generateWithRecipe(html, packageCode, count) {
    const recipeId = this.currentRecipe;

    if (!recipeId) {
      ui.notifications.warn(game.i18n.localize('names.select-all'));
      return { suggestions: [], errors: ['No recipe selected'] };
    }

    // Get seed from input field
    const seedInput = html.find('#names-recipe-seed');
    const userSeed = seedInput.val()?.trim() || null;

    // Get selected genders from checkboxes
    const selectedGenders = [];
    html.find('input[name^="names-gender-"]:checked').each(function() {
      const genderName = this.name.replace('names-gender-', '');
      selectedGenders.push(genderName);
    });

    logDebug(`Selected genders from checkboxes:`, selectedGenders);

    if (recipeId === 'custom') {
      // Custom recipe mode
      const recipeTextarea = html.find('#names-recipe-definition');
      const recipeText = recipeTextarea.val();

      if (!recipeText) {
        ui.notifications.warn('Please define a custom recipe');
        return { suggestions: [], errors: ['No custom recipe defined'] };
      }

      try {
        const customRecipe = JSON.parse(recipeText);

        // Add custom recipe temporarily to package
        const pkg = this.generator.dataManager.getPackage(packageCode);
        const engine = this.generator.dataManager.getEngine();

        if (!pkg) {
          throw new Error(`Package not found: ${packageCode}`);
        }

        const customRecipeId = '_custom_user_recipe';
        customRecipe.id = customRecipeId;

        // Replace or add custom recipe
        if (!pkg.data.recipes) {
          pkg.data.recipes = [];
        }
        const existingIndex = pkg.data.recipes.findIndex(r => r.id === customRecipeId);
        if (existingIndex >= 0) {
          pkg.data.recipes[existingIndex] = customRecipe;
        } else {
          pkg.data.recipes.push(customRecipe);
        }

        // Reload package in engine
        engine.loadPackage(pkg.data);

        // Generate with custom recipe
        return await this.generator.generate({
          packageCode,
          locale: this.currentLanguage,
          n: count,
          recipes: customRecipeId,
          seed: userSeed,
          allowDuplicates: false
        });
      } catch (error) {
        ui.notifications.error('Invalid recipe JSON: ' + error.message);
        return { suggestions: [], errors: ['Invalid recipe JSON'] };
      }
    }

    // Generate with existing recipe
    // If genders are selected, we need to modify the recipe to include gender filters
    if (selectedGenders.length > 0 && selectedGenders.length < 3) {
      // Clone and modify the recipe to add gender tags
      const pkg = this.generator.dataManager.getPackage(packageCode);
      const engine = this.generator.dataManager.getEngine();

      if (!pkg) {
        throw new Error(`Package not found: ${packageCode}`);
      }

      // Find the original recipe
      const originalRecipe = pkg.data.recipes?.find(r => r.id === recipeId);
      if (!originalRecipe) {
        ui.notifications.error('Recipe not found');
        return { suggestions: [], errors: ['Recipe not found'] };
      }

      // Deep clone the recipe
      const modifiedRecipe = JSON.parse(JSON.stringify(originalRecipe));
      modifiedRecipe.id = `_temp_${recipeId}_gendered`;

      // Inject gender tags into all name selections with "firstnames" tag
      this._injectGenderTagsIntoRecipe(modifiedRecipe, selectedGenders);

      logDebug(`Modified recipe after gender injection:`, JSON.stringify(modifiedRecipe, null, 2));

      // Add or replace the temporary recipe
      const existingIndex = pkg.data.recipes.findIndex(r => r.id === modifiedRecipe.id);
      if (existingIndex >= 0) {
        pkg.data.recipes[existingIndex] = modifiedRecipe;
      } else {
        pkg.data.recipes.push(modifiedRecipe);
      }

      // Reload package in engine
      engine.loadPackage(pkg.data);

      // Generate with modified recipe
      return await this.generator.generate({
        packageCode,
        locale: this.currentLanguage,
        n: count,
        recipes: modifiedRecipe.id,
        seed: userSeed,
        allowDuplicates: false
      });
    }

    // No gender filter or all genders selected - use original recipe
    return await this.generator.generate({
      packageCode,
      locale: this.currentLanguage,
      n: count,
      recipes: recipeId,
      seed: userSeed,
      allowDuplicates: false
    });
  }

  /**
   * Inject gender tags into recipe pattern
   * Modifies select blocks that have "firstnames" in their where.tags
   * Uses anyOfTags so at least ONE gender tag must match (not ALL)
   */
  _injectGenderTagsIntoRecipe(recipe, genderTags) {
    if (!recipe.pattern || !Array.isArray(recipe.pattern)) {
      return;
    }

    for (const block of recipe.pattern) {
      // Check if this is a select block for firstnames
      if (block.select && block.select.where && block.select.where.tags) {
        if (block.select.where.tags.includes('firstnames')) {
          // Add gender tags as anyOfTags (at least one must match)
          if (!block.select.where.anyOfTags) {
            block.select.where.anyOfTags = [];
          }
          block.select.where.anyOfTags = [...block.select.where.anyOfTags, ...genderTags];
        }
      }

      // Also check nested blocks (e.g., in pp.ref)
      if (block.pp && block.pp.ref && block.pp.ref.select) {
        const nestedSelect = block.pp.ref.select;
        if (nestedSelect.where && nestedSelect.where.tags && nestedSelect.where.tags.includes('firstnames')) {
          // Add gender tags as anyOfTags
          if (!nestedSelect.where.anyOfTags) {
            nestedSelect.where.anyOfTags = [];
          }
          nestedSelect.where.anyOfTags = [...nestedSelect.where.anyOfTags, ...genderTags];
        }
      }
    }
  }

  /**
   * Show or hide the view toggle based on whether results have metadata
   */
  _updateViewToggleVisibility(html, hasMetadata) {
    const viewToggle = html.find('.names-module-view-toggle');
    if (hasMetadata) {
      viewToggle.css('display', 'flex'); // Show as flex container
      // Keep current view preference when metadata is present
    } else {
      viewToggle.hide();
      // Force simple/compact view when no metadata (no need for detailed view)
      this.currentView = 'simple';
    }
  }

  /**
   * Handle name click - copy and/or post to chat based on settings
   */
  async _handleNameClick(name, nameEl) {
    const shouldCopy = game.settings.get(MODULE_ID, "nameClickCopy");
    const shouldPost = game.settings.get(MODULE_ID, "nameClickPost");

    // Copy to clipboard
    if (shouldCopy) {
      await navigator.clipboard.writeText(name);
      ui.notifications.info(`"${name}" ${game.i18n.localize('names.copied-to-clipboard') || 'copied to clipboard'}`);

      // Add copied animation
      nameEl.addClass('copied');
      setTimeout(() => {
        nameEl.removeClass('copied');
      }, 600);
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
}
