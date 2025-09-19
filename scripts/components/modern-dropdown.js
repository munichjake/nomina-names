/**
 * Enhanced Modern Dropdown Component for Names Module
 * Features: Search, Virtual Scrolling, Modern Design, Accessibility
 */

export class EnhancedDropdown {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      placeholder: "Wählen Sie eine Option...",
      searchPlaceholder: "Suchen...",
      multiSelect: false,
      virtualScroll: true,
      itemHeight: 44,
      maxVisible: 8,
      clearable: true,
      disabled: false,
      allowCustomValue: false,
      groupBy: null,
      theme: 'names-orange', // names-orange, names-dark, names-light
      ...options
    };
    
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

  init() {
    this.createStructure();
    this.bindEvents();
    this.updateDisplay();
    this.loadItems();
  }

  createStructure() {
    // Hide original select
    this.element.style.display = 'none';
    
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
    
    // Inject styles
    this.injectStyles();
  }

  loadItems() {
    this.allItems = [];
    const options = this.element.querySelectorAll('option');
    
    options.forEach((option, index) => {
      if (option.value || option.textContent.trim()) {
        const group = option.parentElement.tagName.toLowerCase() === 'optgroup' 
          ? option.parentElement.label 
          : null;
          
        this.allItems.push({
          value: option.value,
          text: option.textContent.trim(),
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
    });
    
    // Window resize
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.positionPanel();
      }
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen || this.options.disabled) return;
    
    this.isOpen = true;
    this.panel.style.display = 'block';
    this.container.classList.add('open');
    this.container.setAttribute('aria-expanded', 'true');
    
    // Reset and focus search
    this.searchBox.value = '';
    this.searchTerm = '';
    this.filteredItems = [...this.allItems];
    this.focusedIndex = -1;
    
    this.renderItems();
    this.positionPanel();
    
    // Focus search with slight delay for smoother animation
    setTimeout(() => {
      this.searchBox.focus();
    }, 100);
  }

  close() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.panel.style.display = 'none';
    this.container.classList.remove('open');
    this.container.setAttribute('aria-expanded', 'false');
    this.focusedIndex = -1;
    
    // Return focus to trigger
    this.container.focus();
  }

  positionPanel() {
    const rect = this.container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const panelHeight = Math.min(400, this.panel.scrollHeight);
    
    if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
      // Show above
      this.panel.style.bottom = '100%';
      this.panel.style.top = 'auto';
      this.panel.style.marginBottom = '4px';
      this.panel.style.marginTop = '0';
      this.container.classList.add('dropup');
    } else {
      // Show below
      this.panel.style.top = '100%';
      this.panel.style.bottom = 'auto';
      this.panel.style.marginTop = '4px';
      this.panel.style.marginBottom = '0';
      this.container.classList.remove('dropup');
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
    
    itemEl.innerHTML = `
      <div class="item-content">
        ${this.options.multiSelect ? `
          <div class="item-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1">
            <div class="checkbox-mark"></div>
          </div>
        ` : ''}
        <div class="item-text">${displayText}</div>
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
    this.element.style.display = '';
  }

  injectStyles() {
    if (document.getElementById('enhanced-dropdown-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'enhanced-dropdown-styles';
    styles.textContent = `
      /* Enhanced Dropdown Styles */
      .enhanced-dropdown {
        position: relative;
        display: inline-block;
        width: 100%;
        font-family: inherit;
      }

      .enhanced-dropdown.disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      /* Trigger */
      .dropdown-trigger {
        background: white;
        border: 2px solid #c8c7bc;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        min-height: 44px;
      }

      .enhanced-dropdown:not(.disabled) .dropdown-trigger:hover {
        border-color: #ff6400;
        box-shadow: 0 2px 8px rgba(255, 100, 0, 0.1);
      }

      .enhanced-dropdown.open .dropdown-trigger {
        border-color: #ff6400;
        box-shadow: 0 0 0 3px rgba(255, 100, 0, 0.1);
      }

      .trigger-content {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        gap: 8px;
      }

      .selected-value {
        flex: 1;
        font-size: 14px;
        color: #191813;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .selected-value.placeholder {
        color: #666;
      }

      .trigger-icons {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .clear-btn {
        background: none;
        border: none;
        padding: 4px;
        color: #666;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
        display: none;
      }

      .clear-btn:hover {
        background: rgba(255, 100, 0, 0.1);
        color: #ff6400;
      }

      .dropdown-arrow {
        color: #666;
        transition: transform 0.2s ease;
        padding: 4px;
      }

      .enhanced-dropdown.open .dropdown-arrow {
        transform: rotate(180deg);
      }

      /* Panel */
      .dropdown-panel {
        position: absolute;
        left: 0;
        right: 0;
        background: white;
        border: 2px solid #ff6400;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        z-index: 1000;
        max-height: 400px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .enhanced-dropdown.dropup .dropdown-panel {
        box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
      }

      /* Search */
      .dropdown-search {
        border: none;
        padding: 16px;
        font-size: 14px;
        background: #f8f8f7;
        border-bottom: 1px solid #e0e0e0;
        outline: none;
      }

      .dropdown-search:focus {
        background: white;
      }

      .dropdown-search::placeholder {
        color: #999;
      }

      /* Items */
      .items-wrapper {
        flex: 1;
        overflow: hidden;
      }

      .virtual-viewport {
        overflow-y: auto;
        overflow-x: hidden;
      }

      .items-container {
        position: relative;
      }

      .dropdown-item {
        padding: 0;
        cursor: pointer;
        transition: all 0.15s ease;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: center;
      }

      .dropdown-item:last-child {
        border-bottom: none;
      }

      .dropdown-item:hover:not(.disabled) {
        background: rgba(255, 100, 0, 0.05);
      }

      .dropdown-item.focused:not(.disabled) {
        background: rgba(255, 100, 0, 0.1);
      }

      .dropdown-item.selected {
        background: rgba(255, 100, 0, 0.1);
        color: #ff6400;
        font-weight: 500;
      }

      .dropdown-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .item-content {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        width: 100%;
        gap: 12px;
      }

      .item-checkbox {
        position: relative;
        width: 18px;
        height: 18px;
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
        width: 18px;
        height: 18px;
        border: 2px solid #ddd;
        border-radius: 3px;
        background: white;
        position: relative;
        transition: all 0.2s ease;
      }

      .item-checkbox input:checked + .checkbox-mark {
        background: #ff6400;
        border-color: #ff6400;
      }

      .item-checkbox input:checked + .checkbox-mark::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 12px;
        font-weight: bold;
      }

      .item-text {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
      }

      .item-text mark {
        background: rgba(255, 100, 0, 0.2);
        color: inherit;
        padding: 0;
        border-radius: 2px;
      }

      .item-check {
        color: #ff6400;
        font-size: 12px;
        flex-shrink: 0;
      }

      /* Groups */
      .dropdown-group .group-header {
        font-size: 12px;
        font-weight: 600;
        color: #666;
        background: #f8f8f7;
        padding: 8px 16px;
        border-bottom: 1px solid #e0e0e0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .dropdown-item.group-item {
        padding-left: 32px;
      }

      /* Empty State */
      .dropdown-empty {
        padding: 32px 16px;
        text-align: center;
        color: #666;
      }

      .empty-icon {
        font-size: 24px;
        margin-bottom: 8px;
        opacity: 0.5;
      }

      .empty-text {
        font-size: 14px;
      }

      /* Theme: Names Orange */
      .enhanced-dropdown.names-orange .dropdown-trigger:hover {
        border-color: #ff6400;
      }

      .enhanced-dropdown.names-orange.open .dropdown-trigger {
        border-color: #ff6400;
        box-shadow: 0 0 0 3px rgba(255, 100, 0, 0.1);
      }

      .enhanced-dropdown.names-orange .dropdown-panel {
        border-color: #ff6400;
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
    try {
      const options = select.dataset.enhanced ? 
        JSON.parse(select.dataset.enhanced) : {};
      const instance = new EnhancedDropdown(select, options);
      instances.push(instance);
    } catch (error) {
      console.warn('Failed to initialize enhanced dropdown:', error);
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