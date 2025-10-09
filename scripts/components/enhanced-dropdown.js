/**
 * Enhanced Modern Dropdown Component for Names Module
 * Features: Search, Virtual Scrolling, Modern Design, Accessibility
 */

import { logDebug, logInfo, logWarn, logError } from '../utils/logger.js';

export class EnhancedDropdown {
  constructor(element, options = {}) {
    this.element = element;

    // Parse data-enhanced attribute if it exists
    let dataEnhanced = {};
    try {
      if (element.dataset.enhanced) {
        dataEnhanced = JSON.parse(element.dataset.enhanced);
      }
    } catch (error) {
      logWarn('Failed to parse data-enhanced attribute:', error);
    }

    this.options = {
      placeholder: "Wählen Sie eine Option...",
      searchPlaceholder: "Suchen...",
      multiSelect: false,
      virtualScroll: true,
      itemHeight: 32, // Reduced from 44 to 32 for slimmer entries
      maxVisible: 8,
      maxVisibleItems: 8, // Alternative name
      clearable: true,
      disabled: false,
      allowCustomValue: false,
      groupBy: null,
      theme: 'names-orange', // names-orange, names-dark, names-light
      preselect: null, // Value to preselect (e.g., "de" for language dropdown)
      dependsOn: null, // CSS selector for dependency (e.g., "#names-language-select")
      ...dataEnhanced, // Apply data-enhanced first
      ...options // Then apply constructor options
    };

    // Auto-localize placeholders if they look like i18n keys
    this.options.placeholder = this._localizeIfNeeded(this.options.placeholder);
    this.options.searchPlaceholder = this._localizeIfNeeded(this.options.searchPlaceholder);

    // Handle both maxVisible and maxVisibleItems
    if (this.options.maxVisibleItems && !options.maxVisible) {
      this.options.maxVisible = this.options.maxVisibleItems;
    }
    
    this.isOpen = false;
    this.selectedValues = this.options.multiSelect ? [] : null;
    this.filteredItems = [];
    this.allItems = [];
    this.groupedItems = [];
    this.focusedIndex = -1;
    this.searchTerm = '';
    this.virtualStart = 0;
    this.virtualEnd = 0;
    
    this.init();
  }

  /**
   * Auto-localize a string if it looks like an i18n key
   * Checks if the string contains dots (like "names.ui.placeholder-language")
   * @param {string} text - The text to potentially localize
   * @returns {string} Localized text or original text
   */
  _localizeIfNeeded(text) {
    if (!text || typeof text !== 'string') return text;

    // Check if text looks like an i18n key (contains dots and no spaces)
    const looksLikeI18nKey = text.includes('.') && !text.includes(' ');

    if (looksLikeI18nKey && typeof game !== 'undefined' && game.i18n) {
      const localized = game.i18n.localize(text);
      // If localization returns the same key, it wasn't found - return original
      return localized !== text ? localized : text;
    }

    return text;
  }

  /**
   * Check if dependency is satisfied
   * @returns {boolean} True if no dependency or dependency has a value
   */
  _isDependencySatisfied() {
    if (!this.dependencyElement) return true;

    // Check if dependency element has a value
    if (this.dependencyElement.tagName === 'SELECT') {
      return this.dependencyElement.value !== '';
    } else if (this.dependencyElement.tagName === 'INPUT') {
      if (this.dependencyElement.type === 'checkbox') {
        return this.dependencyElement.checked;
      } else {
        return this.dependencyElement.value !== '';
      }
    }

    return true;
  }

  /**
   * Update disabled state based on dependency
   */
  _updateDependencyState() {
    if (!this.options.dependsOn) return;

    const isSatisfied = this._isDependencySatisfied();
    this.options.disabled = !isSatisfied;

    logDebug(`Enhanced Dropdown (${this.element.id}): Dependency satisfied: ${isSatisfied}, disabled: ${!isSatisfied}`);

    if (this.container) {
      this.container.classList.toggle('disabled', !isSatisfied);

      if (!isSatisfied) {
        this.container.setAttribute('aria-disabled', 'true');
      } else {
        this.container.removeAttribute('aria-disabled');
      }
    }
  }

  init() {
    this.createStructure();
    this.bindEvents();
    this.updateDisplay();
    this.loadItems();

    // Find and setup dependency element
    this.dependencyElement = null;
    if (this.options.dependsOn) {
      this.dependencyElement = document.querySelector(this.options.dependsOn);
      if (!this.dependencyElement) {
        logWarn(`Enhanced Dropdown: Dependency element not found: ${this.options.dependsOn}`);
      } else {
        logDebug(`Enhanced Dropdown (${this.element.id}): Found dependency element:`, this.dependencyElement.id || this.options.dependsOn);

        // Listen for changes on dependency element
        this.dependencyElement.addEventListener('change', () => {
          logDebug(`Enhanced Dropdown (${this.element.id}): Dependency changed, updating state`);
          this._updateDependencyState();
        });
      }
    }

    // Set initial dependency state
    this._updateDependencyState();

    // Store reference on container for external access
    this.container._enhancedDropdown = this;
  }

  findBestPanelContainer() {
    // Priority list of containers to try (from best to fallback)
    const containerSelectors = [
      // Foundry application window content (highest priority for names picker)
      '.names-picker-app .window-content',
      '.window-app .window-content',
      '.application .window-content',

      // Foundry dialog content
      '.dialog .window-content',

      // General window content
      '.window-content',

      // Application wrapper
      '.application',

      // Window app wrapper
      '.window-app',

      // Form content (for picker forms)
      '.names-picker-form',
      'form'
    ];

    // Start from the dropdown element and traverse up
    let current = this.element;

    // First, try to find a matching container by traversing up the DOM
    while (current && current !== document.body) {
      for (const selector of containerSelectors) {
        if (current.matches && current.matches(selector)) {
          // Ensure the container has proper positioning for absolute children
          const computedStyle = window.getComputedStyle(current);
          if (computedStyle.position === 'static') {
            current.style.position = 'relative';
          }
          logDebug(`Found container using selector: ${selector}`, current);
          return current;
        }
      }
      current = current.parentElement;
    }

    // If traversal didn't work, try global queries within reasonable scope
    const app = this.element.closest('.window-app, .application, .dialog, .names-picker-app');
    if (app) {
      for (const selector of containerSelectors) {
        const found = app.querySelector(selector);
        if (found) {
          // Ensure proper positioning
          const computedStyle = window.getComputedStyle(found);
          if (computedStyle.position === 'static') {
            found.style.position = 'relative';
          }
          logDebug(`Found container via query in app: ${selector}`, found);
          return found;
        }
      }
      // If no specific container found, use the app itself
      const computedStyle = window.getComputedStyle(app);
      if (computedStyle.position === 'static') {
        app.style.position = 'relative';
      }
      logDebug('Using application container', app);
      return app;
    }

    // Ultimate fallback - use document.body for global positioning
    logDebug('Using document.body as fallback container');
    return document.body;
  }

  createStructure() {
    // Ensure we don't create duplicates
    if (this.element.nextSibling && this.element.nextSibling.classList && this.element.nextSibling.classList.contains('enhanced-dropdown')) {
      logWarn('Enhanced dropdown already exists for this element');
      return;
    }

    // Hide original select completely
    this.element.style.display = 'none';
    this.element.style.visibility = 'hidden';
    this.element.style.position = 'absolute';
    this.element.style.left = '-9999px';
    
    // Create dropdown container
    this.container = document.createElement('div');
    this.container.className = `enhanced-dropdown ${this.options.theme}`;
    this.container.setAttribute('tabindex', '0');
    this.container.setAttribute('role', 'combobox');
    this.container.setAttribute('aria-expanded', 'false');
    this.container.setAttribute('aria-haspopup', 'listbox');
    
    // Create trigger
    this.trigger = document.createElement('div');
    this.trigger.className = 'dropdown-trigger';
    this.trigger.innerHTML = `
      <div class="trigger-content">
        <span class="selected-value">${this.options.placeholder}</span>
        <div class="trigger-icons">
          ${this.options.clearable ? '<button type="button" class="clear-btn" aria-label="Clear selection"><i class="fas fa-times"></i></button>' : ''}
          <div class="dropdown-arrow">
            <i class="fas fa-chevron-down"></i>
          </div>
        </div>
      </div>
    `;
    
    // Create dropdown panel
    this.panel = document.createElement('div');
    this.panel.className = 'dropdown-panel';
    this.panel.style.display = 'none';
    this.panel.setAttribute('role', 'listbox');
    
    // Create search box
    this.searchBox = document.createElement('input');
    this.searchBox.type = 'text';
    this.searchBox.className = 'dropdown-search';
    this.searchBox.placeholder = this.options.searchPlaceholder;
    this.searchBox.setAttribute('aria-label', 'Search options');
    
    // Create items container with virtual scrolling
    this.itemsWrapper = document.createElement('div');
    this.itemsWrapper.className = 'items-wrapper';
    
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'items-container';
    this.itemsContainer.setAttribute('role', 'group');
    
    if (this.options.virtualScroll) {
      this.viewport = document.createElement('div');
      this.viewport.className = 'virtual-viewport';
      this.viewport.style.maxHeight = `${this.options.itemHeight * this.options.maxVisible}px`;
      this.viewport.appendChild(this.itemsContainer);
      this.itemsWrapper.appendChild(this.viewport);
    } else {
      this.itemsWrapper.appendChild(this.itemsContainer);
    }
    
    // Create empty state
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'dropdown-empty';
    this.emptyState.innerHTML = `
      <div class="empty-icon">
        <i class="fas fa-search"></i>
      </div>
      <div class="empty-text">Keine Ergebnisse gefunden</div>
    `;
    this.emptyState.style.display = 'none';
    
    // Assemble components
    this.panel.appendChild(this.searchBox);
    this.panel.appendChild(this.itemsWrapper);
    this.panel.appendChild(this.emptyState);

    this.container.appendChild(this.trigger);
    this.container.appendChild(this.panel);

    // Insert after original element
    this.element.parentNode.insertBefore(this.container, this.element.nextSibling);

    // Ensure the container has proper positioning context for z-index
    this.container.style.position = 'relative';
    this.container.style.zIndex = '10';

    // Fix stacking context issues with parent sections
    const parentSection = this.element.closest('.names-module-section');
    if (parentSection) {
      parentSection.style.position = 'relative';
      parentSection.style.zIndex = '1';
    }

    // Re-position panel if window is resized while open
    this.resizeHandler = () => {
      if (this.isOpen) {
        this.positionPanel();
      }
    };
    window.addEventListener('resize', this.resizeHandler);

    // Inject styles
    this.injectStyles();
  }

  loadItems() {
    this.allItems = [];
    const options = this.element.querySelectorAll('option');

    // Re-localize placeholders in case language has changed
    const dataEnhanced = this.element.dataset.enhanced ? JSON.parse(this.element.dataset.enhanced) : {};
    if (dataEnhanced.placeholder) {
      this.options.placeholder = this._localizeIfNeeded(dataEnhanced.placeholder);
    }
    if (dataEnhanced.searchPlaceholder) {
      this.options.searchPlaceholder = this._localizeIfNeeded(dataEnhanced.searchPlaceholder);
    }

    options.forEach((option, index) => {
      // Skip options with empty value (placeholder options like <option value="">...</option>)
      if (option.value) {
        const group = option.parentElement.tagName.toLowerCase() === 'optgroup'
          ? option.parentElement.label
          : null;

        this.allItems.push({
          value: option.value,
          text: option.textContent.trim(),
          subtitle: option.dataset.subtitle || null,
          selected: option.selected,
          disabled: option.disabled,
          index: index,
          group: group,
          element: option
        });
      }
    });

    this.applyGrouping();
    this.filteredItems = [...this.allItems];

    // Set initial selection
    if (this.options.multiSelect) {
      this.selectedValues = this.allItems.filter(item => item.selected).map(item => item.value);
    } else {
      const selected = this.allItems.find(item => item.selected);
      this.selectedValues = selected ? selected.value : null;

      // Apply preselect if no value is selected and preselect is configured
      if (!this.selectedValues && this.options.preselect) {
        const preselectItem = this.allItems.find(item => item.value === this.options.preselect);
        if (preselectItem) {
          this.selectedValues = preselectItem.value;
          // Update the native select element
          this.element.value = preselectItem.value;
          preselectItem.element.selected = true;
        }
      }
    }

    this.updateDisplay();
  }

  applyGrouping() {
    if (!this.options.groupBy) return;
    
    const groups = new Map();
    this.allItems.forEach(item => {
      const groupKey = item.group || 'Andere';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(item);
    });
    
    this.groupedItems = Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.text.localeCompare(b.text))
    }));
  }

  bindEvents() {
    // Trigger events
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.options.disabled) {
        this.toggle();
      }
    });
    
    // Clear button
    const clearBtn = this.trigger.querySelector('.clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearSelection();
      });
    }
    
    // Search input
    this.searchBox.addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this.filterItems(this.searchTerm);
    });
    
    this.searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
    
    // Item selection
    this.itemsContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('.dropdown-item');
      if (item && !item.classList.contains('disabled')) {
        const value = item.dataset.value;
        this.selectItem(value);
      }
    });
    
    // Virtual scrolling
    if (this.options.virtualScroll && this.viewport) {
      this.viewport.addEventListener('scroll', () => {
        this.updateVirtualScroll();
      });
    }
    
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    }, { capture: true });
    
    // Window resize
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.positionPanel();
      }
    });

    // Window scroll - reposition dropdown when page scrolls
    window.addEventListener('scroll', () => {
      if (this.isOpen) {
        this.positionPanel();
      }
    }, { passive: true });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen || this.options.disabled) return;

    this.isOpen = true;
    this.panel.style.display = 'block';
    this.panel.style.zIndex = '999';
    this.container.style.zIndex = '999';

    // Ensure parent section has higher z-index when dropdown is open
    const parentSection = this.element.closest('.names-module-section');
    if (parentSection) {
      parentSection.style.zIndex = '500';
    }

    this.container.classList.add('open');
    this.container.setAttribute('aria-expanded', 'true');
    
    // Reset and focus search
    this.searchBox.value = '';
    this.searchTerm = '';
    this.filteredItems = [...this.allItems];
    this.focusedIndex = -1;
    
    this.renderItems();

    // Position panel after a brief delay to ensure DOM is ready
    setTimeout(() => {
      this.positionPanel();
    }, 10);

    // Focus search with slight delay for smoother animation
    setTimeout(() => {
      this.searchBox.focus();
    }, 100);
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.panel.style.display = 'none';
    this.container.style.zIndex = '10'; // Reset to normal level

    // Reset parent section z-index
    const parentSection = this.element.closest('.names-module-section');
    if (parentSection) {
      parentSection.style.zIndex = '1';
    }

    this.container.classList.remove('open');
    this.container.setAttribute('aria-expanded', 'false');
    this.focusedIndex = -1;

    // Return focus to trigger
    this.container.focus();
  }

  positionPanel() {
    // Ensure panel is visible for measurements
    if (!this.panel || this.panel.style.display === 'none') {
      return;
    }

    const containerRect = this.container.getBoundingClientRect();
    const triggerRect = this.trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - triggerRect.bottom - 10;
    const spaceAbove = triggerRect.top - 10;
    const panelHeight = Math.min(300, this.panel.scrollHeight);

    // Panel width should match the trigger width
    const panelWidth = Math.max(triggerRect.width, 200);

    // Position relative to the container (simple approach)
    this.panel.style.position = 'absolute';
    this.panel.style.left = '0px';
    this.panel.style.width = panelWidth + 'px';
    this.panel.style.zIndex = '999';
    this.panel.style.right = 'auto';
    this.panel.style.marginTop = '0';
    this.panel.style.marginBottom = '0';

    // Position vertically
    if (spaceBelow >= panelHeight || spaceBelow > spaceAbove) {
      // Show below trigger
      this.panel.style.top = '100%';
      this.panel.style.transform = 'none';
      this.panel.style.bottom = 'auto';
      this.container.classList.remove('dropup');
    } else {
      // Show above trigger
      this.panel.style.top = 'auto';
      this.panel.style.bottom = '100%';
      this.panel.style.transform = 'none';
      this.container.classList.add('dropup');
    }
  }

  filterItems(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
      this.filteredItems = [...this.allItems];
    } else {
      this.filteredItems = this.allItems.filter(item => 
        item.text.toLowerCase().includes(searchTerm) ||
        item.value.toLowerCase().includes(searchTerm) ||
        (item.group && item.group.toLowerCase().includes(searchTerm))
      );
    }
    
    this.renderItems();
    this.focusedIndex = -1;
  }

  renderItems() {
    if (this.options.virtualScroll) {
      this.renderVirtualItems();
    } else {
      this.renderAllItems();
    }
    
    // Show/hide empty state
    const hasItems = this.filteredItems.length > 0;
    this.itemsWrapper.style.display = hasItems ? 'block' : 'none';
    this.emptyState.style.display = hasItems ? 'none' : 'block';
  }

  renderAllItems() {
    this.itemsContainer.innerHTML = '';
    
    if (this.options.groupBy && this.groupedItems.length > 0) {
      this.renderGroupedItems();
    } else {
      this.renderFlatItems();
    }
  }

  renderFlatItems() {
    this.filteredItems.forEach((item, index) => {
      const itemEl = this.createItemElement(item, index);
      this.itemsContainer.appendChild(itemEl);
    });
  }

  renderGroupedItems() {
    this.groupedItems.forEach(group => {
      const groupItems = group.items.filter(item => 
        this.filteredItems.includes(item)
      );
      
      if (groupItems.length > 0) {
        // Group header
        const groupEl = document.createElement('div');
        groupEl.className = 'dropdown-group';
        groupEl.innerHTML = `<div class="group-header">${group.name}</div>`;
        this.itemsContainer.appendChild(groupEl);
        
        // Group items
        groupItems.forEach((item, index) => {
          const itemEl = this.createItemElement(item, index);
          itemEl.classList.add('group-item');
          this.itemsContainer.appendChild(itemEl);
        });
      }
    });
  }

  renderVirtualItems() {
    // Simplified virtual scrolling
    const scrollTop = this.viewport ? this.viewport.scrollTop : 0;
    const startIndex = Math.floor(scrollTop / this.options.itemHeight);
    const endIndex = Math.min(
      startIndex + this.options.maxVisible + 2, 
      this.filteredItems.length
    );
    
    this.virtualStart = startIndex;
    this.virtualEnd = endIndex;
    
    this.itemsContainer.innerHTML = '';
    this.itemsContainer.style.height = `${this.filteredItems.length * this.options.itemHeight}px`;
    this.itemsContainer.style.paddingTop = `${startIndex * this.options.itemHeight}px`;
    
    for (let i = startIndex; i < endIndex; i++) {
      if (this.filteredItems[i]) {
        const itemEl = this.createItemElement(this.filteredItems[i], i);
        this.itemsContainer.appendChild(itemEl);
      }
    }
  }

  createItemElement(item, index) {
    const itemEl = document.createElement('div');
    itemEl.className = 'dropdown-item';
    itemEl.dataset.value = item.value;
    itemEl.dataset.index = index;
    itemEl.setAttribute('role', 'option');
    itemEl.style.height = `${this.options.itemHeight}px`;
    
    if (item.disabled) {
      itemEl.classList.add('disabled');
      itemEl.setAttribute('aria-disabled', 'true');
    }
    
    const isSelected = this.options.multiSelect ? 
      this.selectedValues.includes(item.value) : 
      this.selectedValues === item.value;
      
    if (isSelected) {
      itemEl.classList.add('selected');
      itemEl.setAttribute('aria-selected', 'true');
    }
    
    // Highlight search term
    let displayText = item.text;
    if (this.searchTerm) {
      const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      displayText = item.text.replace(regex, '<mark>$1</mark>');
    }

    // Handle subtitle if available
    let subtitleHtml = '';
    if (item.subtitle) {
      let displaySubtitle = item.subtitle;
      if (this.searchTerm) {
        const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        displaySubtitle = item.subtitle.replace(regex, '<mark>$1</mark>');
      }
      subtitleHtml = `<div class="item-subtitle">${displaySubtitle}</div>`;
    }

    itemEl.innerHTML = `
      <div class="item-content ${item.subtitle ? 'has-subtitle' : ''}">
        ${this.options.multiSelect ? `
          <div class="item-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1">
            <div class="checkbox-mark"></div>
          </div>
        ` : ''}
        <div class="item-text-wrapper">
          <div class="item-text">${displayText}</div>
          ${subtitleHtml}
        </div>
        ${isSelected && !this.options.multiSelect ? '<div class="item-check"><i class="fas fa-check"></i></div>' : ''}
      </div>
    `;
    
    return itemEl;
  }

  selectItem(value) {
    if (this.options.multiSelect) {
      const index = this.selectedValues.indexOf(value);
      if (index > -1) {
        this.selectedValues.splice(index, 1);
      } else {
        this.selectedValues.push(value);
      }
    } else {
      this.selectedValues = value;
      this.close();
    }
    
    this.updateOriginalSelect();
    this.updateDisplay();
    this.renderItems(); // Update selection state
    
    // Trigger change event
    this.element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  clearSelection() {
    if (this.options.multiSelect) {
      this.selectedValues = [];
    } else {
      this.selectedValues = null;
    }
    
    this.updateOriginalSelect();
    this.updateDisplay();
    this.renderItems();
    
    // Trigger change event
    this.element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  updateOriginalSelect() {
    const options = this.element.querySelectorAll('option');
    options.forEach(option => {
      if (this.options.multiSelect) {
        option.selected = this.selectedValues.includes(option.value);
      } else {
        option.selected = option.value === this.selectedValues;
      }
    });
  }

  updateDisplay() {
    const valueSpan = this.trigger.querySelector('.selected-value');
    const clearBtn = this.trigger.querySelector('.clear-btn');
    
    let displayText = '';
    let hasSelection = false;
    
    if (this.options.multiSelect) {
      if (this.selectedValues.length === 0) {
        displayText = this.options.placeholder;
      } else if (this.selectedValues.length === 1) {
        const item = this.allItems.find(item => item.value === this.selectedValues[0]);
        displayText = item ? item.text : this.selectedValues[0];
        hasSelection = true;
      } else {
        displayText = `${this.selectedValues.length} Optionen ausgewählt`;
        hasSelection = true;
      }
    } else {
      if (this.selectedValues === null) {
        displayText = this.options.placeholder;
      } else {
        const item = this.allItems.find(item => item.value === this.selectedValues);
        displayText = item ? item.text : this.selectedValues;
        hasSelection = true;
      }
    }
    
    valueSpan.textContent = displayText;
    valueSpan.classList.toggle('placeholder', !hasSelection);
    
    // Show/hide clear button
    if (clearBtn) {
      clearBtn.style.display = hasSelection && this.options.clearable ? 'flex' : 'none';
    }
  }

  handleKeydown(e) {
    if (!this.isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
      return;
    }
    
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this.focusedIndex = Math.min(this.focusedIndex + 1, this.filteredItems.length - 1);
        this.updateFocusedItem();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.focusedIndex = Math.max(this.focusedIndex - 1, -1);
        this.updateFocusedItem();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.focusedIndex >= 0 && this.filteredItems[this.focusedIndex]) {
          this.selectItem(this.filteredItems[this.focusedIndex].value);
        }
        break;
        
      case 'Tab':
        this.close();
        break;
    }
  }

  updateFocusedItem() {
    const items = this.itemsContainer.querySelectorAll('.dropdown-item');
    items.forEach((item, index) => {
      item.classList.toggle('focused', index === this.focusedIndex);
    });
    
    // Scroll focused item into view
    if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
      items[this.focusedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  updateVirtualScroll() {
    this.renderVirtualItems();
  }

  // Public API methods
  setValue(value) {
    if (this.options.multiSelect && Array.isArray(value)) {
      this.selectedValues = [...value];
    } else if (!this.options.multiSelect) {
      this.selectedValues = value;
    }
    this.updateOriginalSelect();
    this.updateDisplay();
    this.renderItems();
  }

  getValue() {
    return this.selectedValues;
  }

  addOption(value, text, selected = false, group = null) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = selected;
    
    if (group) {
      let optgroup = this.element.querySelector(`optgroup[label="${group}"]`);
      if (!optgroup) {
        optgroup = document.createElement('optgroup');
        optgroup.label = group;
        this.element.appendChild(optgroup);
      }
      optgroup.appendChild(option);
    } else {
      this.element.appendChild(option);
    }
    
    this.loadItems();
    this.renderItems();
  }

  removeOption(value) {
    const option = this.element.querySelector(`option[value="${value}"]`);
    if (option) {
      option.remove();
      this.loadItems();
      this.renderItems();
    }
  }

  clearOptions() {
    // Remove all options except the first (placeholder)
    const options = this.element.querySelectorAll('option');
    for (let i = 1; i < options.length; i++) {
      options[i].remove();
    }
    this.loadItems();
    this.renderItems();
  }

  replaceOptions(newOptions) {
    // Clear existing options (keep placeholder)
    this.clearOptions();
    
    // Add new options
    newOptions.forEach(opt => {
      this.addOption(opt.value, opt.text, opt.selected || false, opt.group || null);
    });
  }

  enable() {
    this.options.disabled = false;
    this.container.classList.remove('disabled');
    this.container.removeAttribute('aria-disabled');
  }

  disable() {
    this.options.disabled = true;
    this.container.classList.add('disabled');
    this.container.setAttribute('aria-disabled', 'true');
    this.close();
  }

  destroy() {
    this.container.remove();
    // Remove panel from body
    if (this.panel && this.panel.parentNode) {
      this.panel.remove();
    }
    // Clean up resize handler
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.element.style.display = '';
  }

  injectStyles() {
    if (document.getElementById('enhanced-dropdown-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'enhanced-dropdown-styles';
    styles.textContent = `
      /* Enhanced Dropdown Styles - Optimized for Names Module */
      .enhanced-dropdown {
        position: relative;
        display: inline-block;
        width: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      }

      .enhanced-dropdown.disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      /* Trigger - matching Foundry VTT style */
      .dropdown-trigger {
        background: #2f3136;
        border: 1px solid #72767d;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
        position: relative;
        min-height: 28px;
        box-shadow: 0 0 0 0 rgba(255, 100, 0, 0);
      }

      .enhanced-dropdown:not(.disabled) .dropdown-trigger:hover {
        border-color: var(--color-border-highlight-1, #ff6400);
        background: #36393f;
        box-shadow: 0 0 2px rgba(255, 100, 0, 0.25);
      }

      .enhanced-dropdown.open .dropdown-trigger {
        border-color: var(--color-border-highlight-1, #ff6400);
        background: #36393f;
        box-shadow: 0 0 0 2px rgba(255, 100, 0, 0.25);
        border-radius: 3px 3px 0 0;
      }

      .trigger-content {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        gap: 6px;
        min-height: 20px;
      }

      .selected-value {
        flex: 1;
        font-size: 13px;
        color: #dcddde;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.4;
      }

      .selected-value.placeholder {
        color: #72767d;
        font-style: italic;
      }

      .trigger-icons {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
      }

      .clear-btn {
        background: none;
        border: none;
        padding: 2px;
        color: #72767d;
        cursor: pointer;
        border-radius: 2px;
        transition: all 0.15s ease;
        display: none;
        font-size: 10px;
      }

      .clear-btn:hover {
        background: rgba(255, 100, 0, 0.2);
        color: var(--color-border-highlight-1, #ff6400);
      }

      .dropdown-arrow {
        color: #72767d;
        transition: transform 0.15s ease;
        padding: 2px;
        font-size: 10px;
      }

      .enhanced-dropdown.open .dropdown-arrow {
        transform: rotate(180deg);
        color: var(--color-border-highlight-1, #ff6400);
      }

      /* Panel - matching Foundry VTT dropdown style */
      .dropdown-panel {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #2f3136;
        border: 1px solid var(--color-border-highlight-1, #ff6400);
        border-top: none;
        border-radius: 0 0 3px 3px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        z-index: 999;
        max-height: 300px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .enhanced-dropdown.dropup .dropdown-panel {
        top: auto;
        bottom: 100%;
        border-top: 1px solid var(--color-border-highlight-1, #ff6400);
        border-bottom: none;
        border-radius: 3px 3px 0 0;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.4);
      }

      /* Search */
      .dropdown-search {
        border: none;
        border-bottom: 1px solid #444;
        padding: 8px 12px;
        font-size: 13px;
        background: #36393f;
        outline: none;
        color: #dcddde;
      }

      .dropdown-search:focus {
        background: #40444b;
        border-bottom-color: var(--color-border-highlight-1, #ff6400);
      }

      .dropdown-search::placeholder {
        color: #72767d;
        font-style: italic;
      }

      /* Items */
      .items-wrapper {
        flex: 1;
        overflow: hidden;
        background: #2f3136;
      }

      .virtual-viewport {
        overflow-y: auto;
        overflow-x: hidden;
        background: #2f3136;
      }

      .items-container {
        position: relative;
      }

      .dropdown-item {
        padding: 0;
        cursor: pointer;
        transition: background-color 0.1s ease;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        display: flex;
        align-items: center;
        background: #2f3136;
        color: #dcddde;
      }

      .dropdown-item:last-child {
        border-bottom: none;
      }

      .dropdown-item:hover:not(.disabled) {
        background: #40444b;
      }

      .dropdown-item.focused:not(.disabled) {
        background: var(--color-border-highlight-1, #ff6400);
        color: #ffffff;
      }

      .dropdown-item.selected {
        background: rgba(255, 100, 0, 0.2);
        color: var(--color-border-highlight-1, #ff6400);
        font-weight: 600;
      }

      .dropdown-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        color: #72767d;
      }

      .item-content {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        width: 100%;
        gap: 8px;
        min-height: 28px;
      }

      .item-checkbox {
        position: relative;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .item-checkbox input {
        opacity: 0;
        position: absolute;
        width: 100%;
        height: 100%;
        margin: 0;
        cursor: pointer;
      }

      .checkbox-mark {
        width: 16px;
        height: 16px;
        border: 1px solid var(--color-border-light-tertiary, #b5b3a4);
        border-radius: 2px;
        background: var(--color-bg, #f8f8f7);
        position: relative;
        transition: all 0.15s ease;
      }

      .item-checkbox input:checked + .checkbox-mark {
        background: var(--color-border-highlight-1, #ff6400);
        border-color: var(--color-border-highlight-1, #ff6400);
      }

      .item-checkbox input:checked + .checkbox-mark::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 10px;
        font-weight: bold;
      }

      .item-text {
        flex: 1;
        font-size: 13px;
        line-height: 1.3;
        color: inherit;
      }

      .item-text mark {
        background: rgba(255, 100, 0, 0.3);
        color: inherit;
        padding: 1px 2px;
        border-radius: 2px;
        font-weight: 600;
      }

      .item-check {
        color: var(--color-border-highlight-1, #ff6400);
        font-size: 11px;
        flex-shrink: 0;
      }

      /* Groups */
      .dropdown-group .group-header {
        font-size: 11px;
        font-weight: 700;
        color: var(--color-text-dark-secondary, #4b4a44);
        background: var(--color-bg-btn-minor-inactive, #ddd);
        padding: 4px 12px;
        border-bottom: 1px solid var(--color-border-light-tertiary, #b5b3a4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .dropdown-item.group-item .item-content {
        padding-left: 24px;
      }

      /* Empty State */
      .dropdown-empty {
        padding: 20px 12px;
        text-align: center;
        color: var(--color-text-dark-inactive, #7a7971);
        background: var(--color-bg, #f8f8f7);
      }

      .empty-icon {
        font-size: 18px;
        margin-bottom: 6px;
        opacity: 0.6;
      }

      .empty-text {
        font-size: 12px;
        font-style: italic;
      }

      /* Theme consistency */
      .enhanced-dropdown.names-orange .dropdown-trigger:hover {
        border-color: var(--color-border-highlight-1, #ff6400);
      }

      .enhanced-dropdown.names-orange.open .dropdown-trigger {
        border-color: var(--color-border-highlight-1, #ff6400);
        box-shadow: 0 0 0 2px rgba(255, 100, 0, 0.25);
      }

      .enhanced-dropdown.names-orange .dropdown-panel {
        border-color: var(--color-border-highlight-1, #ff6400);
      }

      /* Animations */
      .dropdown-panel {
        animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: top;
      }

      .enhanced-dropdown.dropup .dropdown-panel {
        animation: slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: bottom;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-8px) scaleY(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scaleY(1);
        }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(8px) scaleY(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scaleY(1);
        }
      }

      /* Responsive */
      @media (max-width: 768px) {
        .dropdown-panel {
          max-height: 60vh;
        }
        
        .item-content {
          padding: 14px 16px;
        }
      }

      /* Custom scrollbar */
      .virtual-viewport::-webkit-scrollbar {
        width: 6px;
      }

      .virtual-viewport::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }

      .virtual-viewport::-webkit-scrollbar-thumb {
        background: #ccc;
        border-radius: 3px;
      }

      .virtual-viewport::-webkit-scrollbar-thumb:hover {
        background: #ff6400;
      }
    `;
    
    document.head.appendChild(styles);
  }
}

// Auto-initialization function
export function initializeEnhancedDropdowns(selector = 'select[data-enhanced]') {
  const dropdowns = document.querySelectorAll(selector);
  const instances = [];

  dropdowns.forEach(select => {
    // Skip if already enhanced
    if (select._enhancedDropdown || (select.nextSibling && select.nextSibling.classList && select.nextSibling.classList.contains('enhanced-dropdown'))) {
      logDebug('Dropdown already enhanced, skipping:', select);
      return;
    }

    try {
      const options = select.dataset.enhanced ?
        JSON.parse(select.dataset.enhanced) : {};
      const instance = new EnhancedDropdown(select, options);
      instances.push(instance);

      // Store reference to prevent double initialization
      select._enhancedDropdown = instance;
    } catch (error) {
      logWarn('Failed to initialize enhanced dropdown:', error);
    }
  });

  return instances;
}

// Integration function for the Names module
export function replaceNamesModuleDropdowns() {
  // Replace specific dropdowns in the Names module
  const selectors = [
    '#names-language-select',
    '#names-species-select', 
    '#names-category-select',
    '#picker-language',
    '#picker-species',
    '#picker-category'
  ];
  
  selectors.forEach(selector => {
    const element = document.querySelector(selector);
    if (element && !element.dataset.enhanced) {
      element.dataset.enhanced = JSON.stringify({
        theme: 'names-orange',
        searchPlaceholder: 'Suchen...',
        virtualScroll: true,
        clearable: false
      });
      new EnhancedDropdown(element);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeEnhancedDropdowns();
  });
} else {
  initializeEnhancedDropdowns();
}