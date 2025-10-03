/**
 * Names History App - Displays generation history
 * Shows all generated names from all sources with filtering and search
 */

import { getHistoryManager } from '../core/history-manager.js';
import { TEMPLATE_PATHS, CSS_CLASSES, MODULE_ID, getLocalizedCategoryName } from '../shared/constants.js';
import { logDebug, logInfo, logWarn } from '../utils/logger.js';
import { getGlobalNamesData } from '../core/data-manager.js';

/**
 * Names History Application
 * Displays the generation history with filtering, search, and multi-select
 */
export class NamesHistoryApp extends Application {
  /**
   * Creates a new Names History App instance
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);

    this.historyManager = getHistoryManager();
    this.selectedIds = new Set(); // Track selected entries for multi-copy
    this.currentFilter = { source: null, search: '' }; // null = show all, no filter active
    this.virtualScrollOffset = 0; // For virtual scrolling
    this.itemHeight = 36; // Height of each row in pixels
    this.visibleItems = 20; // Number of items to render at once

    // Bind history updates
    this.boundUpdateDisplay = this._updateDisplay.bind(this);
    this.historyManager.addListener(this.boundUpdateDisplay);

    logDebug("NamesHistoryApp initialized");
  }

  /**
   * Default application options
   * @returns {Object} Default options for the History App
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-history",
      title: game.i18n.localize("names.history.title") || "Namen-Historie",
      template: TEMPLATE_PATHS.history,
      width: 900,
      height: 600,
      resizable: true,
      classes: [CSS_CLASSES.historyApp]
    });
  }

  /**
   * Prepares data for template rendering
   * @returns {Promise<Object>} Template data
   */
  async getData() {
    const entries = this.historyManager.getFilteredEntries(this.currentFilter);
    const stats = this.historyManager.getStats();

    // Format entries for display
    const formattedEntries = entries.map(entry => ({
      ...entry,
      displayTime: this._formatTime(entry.timestamp),
      displaySpecies: this._getSpeciesName(entry.metadata.species),
      displayCategory: this._getCategoryName(entry.metadata.category, entry.metadata.language, entry.metadata.species),
      displaySubcategory: this._getSubcategoryName(entry.metadata.subcategory, entry.metadata.language, entry.metadata.species, entry.metadata.category)
    }));

    return {
      entries: formattedEntries,
      stats: stats,
      hasEntries: formattedEntries.length > 0,
      isEmpty: formattedEntries.length === 0,
      totalCount: this.historyManager.getCount(),
      maxCount: this.historyManager.getMaxEntries(),
      currentFilter: this.currentFilter
    };
  }

  /**
   * Activates event listeners for the application
   * @param {jQuery} html - The application's HTML
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Search input
    html.find('#history-search').on('input', this._onSearch.bind(this));

    // Filter buttons
    html.find('.history-filter-btn').click(this._onFilterChange.bind(this));

    // Select all checkbox
    html.find('#select-all').change(this._onSelectAll.bind(this));

    // Individual row checkboxes
    html.find('.history-entry-checkbox').change(this._onCheckboxChange.bind(this));

    // Row click (for name copy)
    html.find('.history-entry').click(this._onRowClick.bind(this));

    // Action buttons
    html.find('#copy-selected-btn').click(this._onCopySelected.bind(this));
    html.find('#copy-all-btn').click(this._onCopyAll.bind(this));
    html.find('#clear-history-btn').click(this._onClearHistory.bind(this));
    html.find('#export-history-btn').click(this._onExportHistory.bind(this));

    // Virtual scrolling setup
    const scrollContainer = html.find('.history-scroll-container');
    if (scrollContainer.length > 0) {
      scrollContainer.on('scroll', this._onScroll.bind(this));
    }

    // Stop event propagation on checkboxes
    html.find('.history-entry-checkbox, #select-all').click((event) => {
      event.stopPropagation();
    });

    logDebug("History app listeners activated");
  }

  /**
   * Handle search input
   * @param {Event} event - Input event
   */
  _onSearch(event) {
    const searchTerm = event.target.value.trim();
    this.currentFilter.search = searchTerm;

    // Debounce search to avoid losing focus
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this._updateTableOnly();
    }, 150);

    logDebug(`History search: "${searchTerm}"`);
  }

  /**
   * Handle filter button click
   * @param {Event} event - Click event
   */
  _onFilterChange(event) {
    const source = event.currentTarget.dataset.source;

    // Update button states
    this.element.find('.history-filter-btn').removeClass('active');
    $(event.currentTarget).addClass('active');

    // Update filter
    this.currentFilter.source = source === 'all' ? null : source;

    // Use table-only update to keep filter buttons active
    this._updateTableOnly();

    logDebug(`History filter changed to: ${source}`);
  }

  /**
   * Handle select all checkbox
   * @param {Event} event - Change event
   */
  _onSelectAll(event) {
    const isChecked = event.target.checked;
    const entries = this.historyManager.getFilteredEntries(this.currentFilter);

    if (isChecked) {
      entries.forEach(entry => this.selectedIds.add(entry.id));
      // Add selected class to all rows
      this.element.find('.history-entry').addClass('selected');
    } else {
      this.selectedIds.clear();
      // Remove selected class from all rows
      this.element.find('.history-entry').removeClass('selected');
    }

    // Update checkboxes
    this.element.find('.history-entry-checkbox').prop('checked', isChecked);
    this._updateCopyButtonState();

    logDebug(`Select all: ${isChecked}, selected: ${this.selectedIds.size}`);
  }

  /**
   * Handle individual checkbox change
   * @param {Event} event - Change event
   */
  _onCheckboxChange(event) {
    const checkbox = event.target;
    const entryId = parseFloat(checkbox.dataset.entryId);

    if (checkbox.checked) {
      this.selectedIds.add(entryId);
      // Add selected class to row
      $(checkbox).closest('.history-entry').addClass('selected');
    } else {
      this.selectedIds.delete(entryId);
      // Remove selected class from row
      $(checkbox).closest('.history-entry').removeClass('selected');
    }

    // Update select-all checkbox state
    const totalVisible = this.element.find('.history-entry-checkbox').length;
    const allChecked = this.selectedIds.size === totalVisible && totalVisible > 0;
    this.element.find('#select-all').prop('checked', allChecked);

    this._updateCopyButtonState();

    logDebug(`Checkbox changed, selected: ${this.selectedIds.size}`);
  }

  /**
   * Handle row click (copy name)
   * @param {Event} event - Click event
   */
  async _onRowClick(event) {
    // Ignore if clicking on checkbox
    if ($(event.target).hasClass('history-entry-checkbox') ||
        $(event.target).closest('.history-entry-checkbox').length > 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget;
    const name = row.dataset.name;

    if (!name) return;

    try {
      await navigator.clipboard.writeText(name);

      // Visual feedback
      $(row).addClass('copied');
      setTimeout(() => {
        $(row).removeClass('copied');
      }, 800);

      ui.notifications.info(game.i18n.format("names.history.name-copied", { name }));
      logDebug(`Copied name from history: "${name}"`);

    } catch (error) {
      logWarn('Clipboard copy failed:', error);
      ui.notifications.warn(game.i18n.localize("names.copy-error"));
    }
  }

  /**
   * Handle copy selected button
   * @param {Event} event - Click event
   */
  async _onCopySelected(event) {
    event.preventDefault();

    if (this.selectedIds.size === 0) {
      ui.notifications.warn(game.i18n.localize("names.history.no-selection"));
      return;
    }

    const entries = this.historyManager.getEntries();
    const selectedNames = entries
      .filter(e => this.selectedIds.has(e.id))
      .map(e => e.name)
      .join('\n');

    try {
      await navigator.clipboard.writeText(selectedNames);
      ui.notifications.info(game.i18n.format("names.history.copied-selected", { count: this.selectedIds.size }));
      logInfo(`Copied ${this.selectedIds.size} selected names from history`);
    } catch (error) {
      logWarn('Clipboard copy failed:', error);
      ui.notifications.warn(game.i18n.localize("names.copy-error"));
    }
  }

  /**
   * Handle copy all button
   * @param {Event} event - Click event
   */
  async _onCopyAll(event) {
    event.preventDefault();

    const entries = this.historyManager.getFilteredEntries(this.currentFilter);

    if (entries.length === 0) {
      ui.notifications.warn(game.i18n.localize("names.history.empty"));
      return;
    }

    const allNames = entries.map(e => e.name).join('\n');

    try {
      await navigator.clipboard.writeText(allNames);
      ui.notifications.info(game.i18n.format("names.history.copied-all", { count: entries.length }));
      logInfo(`Copied ${entries.length} names from history`);
    } catch (error) {
      logWarn('Clipboard copy failed:', error);
      ui.notifications.warn(game.i18n.localize("names.copy-error"));
    }
  }

  /**
   * Handle clear history button
   * @param {Event} event - Click event
   */
  _onClearHistory(event) {
    event.preventDefault();

    const count = this.historyManager.getCount();

    if (count === 0) {
      ui.notifications.info(game.i18n.localize("names.history.already-empty"));
      return;
    }

    // Confirmation dialog
    Dialog.confirm({
      title: game.i18n.localize("names.history.clear-title"),
      content: game.i18n.format("names.history.clear-confirm", { count }),
      yes: () => {
        this.historyManager.clear();
        this.selectedIds.clear();
        ui.notifications.info(game.i18n.localize("names.history.cleared"));
        logInfo("History cleared by user");
      },
      no: () => {
        logDebug("History clear cancelled");
      },
      defaultYes: false
    });
  }

  /**
   * Handle export history button
   * @param {Event} event - Click event
   */
  _onExportHistory(event) {
    event.preventDefault();

    const json = this.historyManager.exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `names-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    ui.notifications.info(game.i18n.localize("names.history.exported"));
    logInfo("History exported to JSON");
  }

  /**
   * Handle scroll event for virtual scrolling
   * @param {Event} event - Scroll event
   */
  _onScroll(event) {
    const scrollTop = event.target.scrollTop;
    this.virtualScrollOffset = Math.floor(scrollTop / this.itemHeight);

    // Throttle re-render
    clearTimeout(this._scrollTimeout);
    this._scrollTimeout = setTimeout(() => {
      this._renderVirtualList();
    }, 50);
  }

  /**
   * Update the display (re-render with current filters)
   */
  async _updateDisplay() {
    await this.render(false);
  }

  /**
   * Update copy button states based on selection
   */
  _updateCopyButtonState() {
    const copyBtn = this.element.find('#copy-selected-btn');
    if (copyBtn.length > 0) {
      copyBtn.prop('disabled', this.selectedIds.size === 0);
    }
  }

  /**
   * Update only the table content without full re-render (prevents losing input focus)
   */
  async _updateTableOnly() {
    const entries = this.historyManager.getFilteredEntries(this.currentFilter);

    // Format entries for display
    const formattedEntries = entries.map(entry => ({
      ...entry,
      displayTime: this._formatTime(entry.timestamp),
      displaySpecies: this._getSpeciesName(entry.metadata.species),
      displayCategory: this._getCategoryName(entry.metadata.category, entry.metadata.language, entry.metadata.species),
      displaySubcategory: this._getSubcategoryName(entry.metadata.subcategory, entry.metadata.language, entry.metadata.species, entry.metadata.category)
    }));

    // Update table body
    const tbody = this.element.find('tbody.history-scroll-container');
    if (tbody.length === 0) return;

    // Clear existing rows
    tbody.empty();

    if (formattedEntries.length === 0) {
      // Show empty message in table
      tbody.append(`
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #888;">
            <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">📋</div>
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${game.i18n.localize("names.history.empty")}</div>
            <div style="font-size: 14px;">${game.i18n.localize("names.history.empty-hint")}</div>
          </td>
        </tr>
      `);
    } else {
      // Update rows
      formattedEntries.forEach(entry => {
        const sourceIcon = this._getSourceIcon(entry.source);
        const row = $(`
          <tr class="history-entry" data-entry-id="${entry.id}" data-name="${entry.name}" title="${game.i18n.localize('names.history.click-to-copy')}">
            <td class="col-checkbox">
              <input type="checkbox" class="history-entry-checkbox" data-entry-id="${entry.id}">
            </td>
            <td class="col-name">
              <span class="name-text">${entry.name}</span>
            </td>
            <td class="col-species">
              ${entry.displaySpecies ? `<span class="species-badge">${entry.displaySpecies}</span>` : `<span class="empty-badge">—</span>`}
            </td>
            <td class="col-category">
              ${entry.displayCategory ? `<span class="category-badge">${entry.displayCategory}</span>` : `<span class="empty-badge">—</span>`}
            </td>
            <td class="col-subcategory">
              ${entry.displaySubcategory ? `<span class="subcategory-badge">${entry.displaySubcategory}</span>` : `<span class="empty-badge">—</span>`}
            </td>
            <td class="col-source">
              <span class="source-badge source-${entry.source}" title="${game.i18n.localize(`names.history.source.${entry.source}`)}">${sourceIcon}</span>
            </td>
            <td class="col-time">
              <span class="time-text">${entry.displayTime}</span>
            </td>
          </tr>
        `);

        // Re-attach event listeners
        row.click(this._onRowClick.bind(this));
        const checkbox = row.find('.history-entry-checkbox');
        checkbox.change(this._onCheckboxChange.bind(this)).click((e) => e.stopPropagation());

        // Restore selected state
        if (this.selectedIds.has(entry.id)) {
          checkbox.prop('checked', true);
          row.addClass('selected');
        }

        tbody.append(row);
      });
    }

    logDebug('Table updated without full re-render');
  }

  /**
   * Render virtual list (only visible items)
   * @private
   */
  _renderVirtualList() {
    // TODO: Implement virtual scrolling if needed for performance
    // For now, we render all items (Foundry handles 100 items fine)
    logDebug("Virtual list render requested");
  }

  /**
   * Format timestamp for display
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Formatted time string
   */
  _formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute ago
    if (diff < 60000) {
      return game.i18n.localize("names.history.time.just-now");
    }

    // Less than 1 hour ago
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return game.i18n.format("names.history.time.minutes-ago", { minutes });
    }

    // Less than 24 hours ago
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return game.i18n.format("names.history.time.hours-ago", { hours });
    }

    // Older - show date and time
    return date.toLocaleString(game.i18n.lang, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get localized species name
   * @param {string} speciesCode - Species code
   * @returns {string} Localized name
   */
  _getSpeciesName(speciesCode) {
    if (!speciesCode) return '';

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData) {
      const species = globalNamesData.getLocalizedSpecies();
      const found = species.find(s => s.code === speciesCode);
      if (found) return found.name;
    }

    return speciesCode.charAt(0).toUpperCase() + speciesCode.slice(1);
  }

  /**
   * Get localized category name
   * @param {string} categoryCode - Category code
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @returns {string} Localized name
   */
  _getCategoryName(categoryCode, language, species) {
    if (!categoryCode) return '';

    return getLocalizedCategoryName(categoryCode, {
      language,
      species,
      getCategoryDisplayName: (lang, spec, cat) => {
        const globalNamesData = getGlobalNamesData();
        return globalNamesData?.getCategoryDisplayName?.(lang, spec, cat);
      }
    });
  }

  /**
   * Get localized subcategory name
   * @param {string} subcategoryCode - Subcategory code
   * @param {string} language - Language code
   * @param {string} species - Species code
   * @param {string} category - Category code
   * @returns {string} Localized name
   */
  _getSubcategoryName(subcategoryCode, language, species, category) {
    if (!subcategoryCode) return '';

    // Check if it's a gender value (male, female, neutral)
    const genderKey = `names.gender.${subcategoryCode}`;
    if (game.i18n.has(genderKey)) {
      return game.i18n.localize(genderKey);
    }

    const globalNamesData = getGlobalNamesData();
    if (globalNamesData && globalNamesData.getAvailableSubcategories) {
      try {
        const subcats = globalNamesData.getAvailableSubcategories(language, species, category);
        if (subcats && Array.isArray(subcats)) {
          const found = subcats.find(sub => sub && sub.key === subcategoryCode);
          if (found && found.displayName) {
            const currentLang = game.i18n.lang || 'de';
            return found.displayName[currentLang] ||
                   found.displayName.en ||
                   found.displayName.de ||
                   subcategoryCode;
          }
        }
      } catch (error) {
        logDebug("Error getting subcategory name:", error);
      }
    }

    return subcategoryCode.replace(/_/g, ' ');
  }

  /**
   * Get source icon
   * @param {string} source - Source type
   * @returns {string} Icon HTML
   */
  _getSourceIcon(source) {
    const icons = {
      'generator': '🎲',
      'picker': '🎯',
      'emergency': '🆘'
    };
    return icons[source] || '📝';
  }

  /**
   * Cleanup when app is closed
   */
  close() {
    // Remove history listener
    this.historyManager.removeListener(this.boundUpdateDisplay);

    // Clear timeout
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout);
    }

    return super.close();
  }
}
