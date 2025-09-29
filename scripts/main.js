/**
 * Names Module - Main entry point
 * Handles initialization, settings, and Foundry VTT integration
 */

import { ensureGlobalNamesData, setGlobalNamesData, NamesDataManager } from './core/data-manager.js';
import { NamesGeneratorApp } from './apps/generator-app.js';
import { NamesPickerApp } from './apps/picker-app.js';
import { EmergencyNamesApp } from './apps/emergency-app.js';
import { NamesRoleConfig } from './apps/role-config.js';
import { NamesSpeciesConfig } from './apps/species-config.js';
import { hasNamesGeneratorPermission, showPermissionChangeDialog } from './utils/permissions.js';
import { injectEmergencyButton, removeEmergencyButton } from './utils/ui-helpers.js';
import { MODULE_ID } from './shared/constants.js';
import { NamesAPI } from './api-system.js';
import { LOG_LEVELS, updateLogLevel, logInfo, logInfoL, logDebug, logError } from './utils/logger.js';
import { EnhancedDropdown, initializeEnhancedDropdowns } from './components/enhanced-dropdown.js';

/**
 * Central function to handle Names Generator opening
 * Prevents multiple instances from opening simultaneously
 */
let isGeneratorOpening = false;
function openNamesGenerator() {
  if (isGeneratorOpening) {
    logDebug("Names generator already opening, ignoring duplicate request");
    return;
  }

  isGeneratorOpening = true;

  try {
    logDebug("Opening Names Generator");
    new NamesGeneratorApp().render(true);
  } catch (error) {
    logError("Error opening Names Generator:", error);
  } finally {
    // Reset flag after a short delay
    setTimeout(() => {
      isGeneratorOpening = false;
    }, 500);
  }
}

// ===== MODULE INITIALIZATION =====

/**
 * Module initialization hook - runs once during Foundry startup
 * Sets up the data manager, registers settings, and initializes socket handlers
 */
Hooks.once('init', () => {
  logInfoL("console.module-init");

  // Create global instance with error protection
  try {
    const dataManager = new NamesDataManager();
    setGlobalNamesData(dataManager);
    logDebug("NamesDataManager created successfully");
  } catch (error) {
    logError("Failed to create NamesDataManager", error);
  }

  // Register settings
  registerModuleSettings();
  
  // Register socket handler
  registerSocketHandler();
});

// ===== BACKGROUND LOADING =====

/**
 * Ready hook - runs after Foundry is fully loaded
 * Initializes data loading, emergency button, API registration, and enhanced dropdowns
 */
Hooks.once('ready', () => {
  // Initialize log level FIRST before any logging
  updateLogLevel();

  logDebug("Ready hook - initializing data");
  
  // Ensure globalNamesData exists and start loading
  const dataManager = ensureGlobalNamesData();
  if (dataManager) {
    dataManager.initializeData().then(() => {
      // Setup API after DataManager is ready
      NamesAPI.setup();
      logDebug("API setup completed after DataManager initialization");
    }).catch(error => {
      logError("Failed to initialize DataManager", error);
    });
  }

  // Add emergency button after delay (only if enabled and permitted)
  setTimeout(() => {
    if (hasNamesGeneratorPermission() && game.settings.get(MODULE_ID, "showEmergencyButton")) {
      injectEmergencyButton();
    }
  }, 1000);

  // Register the API with Foundry's module system
  if (game.modules.get(MODULE_ID)) {
    game.modules.get(MODULE_ID).api = NamesAPI;
    logDebug("API registered with Foundry module system");
  }
  
  // Initialize Enhanced Dropdowns after a short delay to ensure DOM is ready
  setTimeout(() => {
    initializeEnhancedDropdownsForModule();
  }, 200);
  
  // Fire the data loaded hook for other modules
  Hooks.callAll('namesModuleReady', NamesAPI);
});

// ===== EVENT SYSTEM FOR API EXTENSIONS =====

/**
 * Hook for external modules to register species data
 * This hook is fired by the DataManager after core species are loaded
 */
Hooks.on('nomina-names:coreLoaded', (dataManager) => {
  logDebug("Core species loaded - external modules can now register species");

  // Example for external modules:
  // Hooks.on('nomina-names:coreLoaded', (dataManager) => {
  //   dataManager.addApiSpecies({
  //     code: 'genasi',
  //     displayName: 'Genasi',
  //     languages: ['de', 'en'],
  //     categories: ['male', 'female', 'surnames'],
  //     data: {
  //       'de.male': ['Aqualius', 'Brenn', 'Hydro'],
  //       'de.female': ['Aquila', 'Flamina', 'Terra'],
  //       'de.surnames': ['Wasserlauf', 'Glutwind', 'Steinfels']
  //     }
  //   });
  // });
});

// ===== ENHANCED DROPDOWNS INITIALIZATION =====

/**
 * Initializes enhanced dropdowns for the Names module
 * Wraps the general enhanced dropdown initialization with error handling
 */
function initializeEnhancedDropdownsForModule() {
  try {
    // Initialize any existing enhanced dropdowns
    initializeEnhancedDropdowns('select[data-enhanced]');
    logDebug("Enhanced dropdowns initialized");
  } catch (error) {
    logError("Failed to initialize enhanced dropdowns", error);
  }
}

/**
 * Hook into application rendering to replace dropdowns with enhanced versions
 * Only processes Names module applications
 * @param {Application} app - The rendered application
 * @param {jQuery} html - The application's HTML
 * @param {Object} data - The application's data
 */
Hooks.on('renderApplication', (app, html, data) => {
  // Only process Names module apps
  if (!app.constructor.name.includes('Names')) return;
  
  setTimeout(() => {
    replaceDropdownsInElement(html[0]);
  }, 50);
});

/**
 * Replaces standard dropdowns with enhanced dropdowns in a given element
 * @param {HTMLElement} element - The DOM element to process
 */
function replaceDropdownsInElement(element) {
  try {
    const selectors = [
      '#names-language-select',
      '#names-species-select', 
      '#names-category-select',
      '#picker-language',
      '#picker-species',
      '#picker-category'
    ];
    
    selectors.forEach(selector => {
      const selectElement = element.querySelector(selector);
      if (selectElement && !selectElement.dataset.enhancedInitialized) {
        // Mark as initialized to prevent double-initialization
        selectElement.dataset.enhancedInitialized = 'true';
        
        // Add enhanced attributes if not present
        if (!selectElement.dataset.enhanced) {
          selectElement.dataset.enhanced = JSON.stringify({
            theme: 'names-orange',
            searchPlaceholder: 'Suchen...',
            virtualScroll: true,
            clearable: false,
            maxVisible: 8
          });
        }
        
        // Initialize enhanced dropdown
        new EnhancedDropdown(selectElement);
        logDebug(`Enhanced dropdown initialized for ${selector}`);
      }
    });
  } catch (error) {
    logError("Failed to replace dropdowns in element", error);
  }
}

// ===== UI INTEGRATIONS =====

/**
 * Emergency Button injection after Chat Log renders
 */
Hooks.on('renderChatLog', () => {
  setTimeout(() => {
    if (hasNamesGeneratorPermission() && game.settings.get(MODULE_ID, "showEmergencyButton")) {
      injectEmergencyButton();
    }
  }, 100);
});

/**
 * Fallback injection attempts - only as last resort if getSceneControlButtons doesn't work
 */
Hooks.on('canvasReady', () => {
  // Only try DOM injection if the proper API method failed
  setTimeout(() => {
    if ($('[data-tool="names-generator"]').length === 0) {
      logDebug("No names tool found via API, trying DOM injection fallback");
      injectTokenControlsButtonDirectly();
    }
  }, 2000);
});

/**
 * Direct injection of token controls button for v13 - injects into token tools specifically
 */
function injectTokenControlsButtonDirectly() {
  if (!game.settings.get(MODULE_ID, "showInTokenControls")) {
    logDebug("injectTokenControlsButtonDirectly: Setting disabled");
    return;
  }
  if (!hasNamesGeneratorPermission()) {
    logDebug("injectTokenControlsButtonDirectly: No permission");
    return;
  }

  logDebug("injectTokenControlsButtonDirectly: Starting injection attempt for token tools");

  // Check if button already exists
  if ($('[data-tool="names-generator"]').length > 0) {
    logDebug("injectTokenControlsButtonDirectly: Button already exists");
    return;
  }

  // Try to find token tools container specifically
  let tokenToolsContainer = null;
  const tokenToolsSelectors = [
    '.control-tools[data-control="token"]',
    '.scene-control-tools[data-control="token"]',
    '#controls .control-tools[data-control="token"]'
  ];

  for (const selector of tokenToolsSelectors) {
    const found = $(selector);
    if (found.length > 0) {
      tokenToolsContainer = found.first();
      logDebug(`injectTokenControlsButtonDirectly: Found token tools with selector ${selector}`);
      break;
    }
  }

  // If no specific token tools found, try to find token control and its tools
  if (!tokenToolsContainer || tokenToolsContainer.length === 0) {
    logDebug("injectTokenControlsButtonDirectly: Looking for token control and its tools");

    const tokenControl = $('.scene-control[data-control="token"]');
    if (tokenControl.length > 0) {
      // Look for tools container near the token control
      tokenToolsContainer = tokenControl.siblings('.control-tools[data-control="token"]');
      if (tokenToolsContainer.length === 0) {
        tokenToolsContainer = tokenControl.next('.control-tools');
      }
      if (tokenToolsContainer.length === 0) {
        tokenToolsContainer = $('.control-tools[data-control="token"]');
      }

      if (tokenToolsContainer.length > 0) {
        logDebug("injectTokenControlsButtonDirectly: Found token tools via token control");
      }
    }
  }

  if (!tokenToolsContainer || tokenToolsContainer.length === 0) {
    logDebug("injectTokenControlsButtonDirectly: No token tools container found, using fallback");

    // Fallback: try to find any tools container and use the first one
    const anyToolsContainer = $('.control-tools').first();
    if (anyToolsContainer.length > 0) {
      tokenToolsContainer = anyToolsContainer;
      logDebug("injectTokenControlsButtonDirectly: Using first available tools container as fallback");
    } else {
      logDebug("injectTokenControlsButtonDirectly: No tools container found at all");
      return;
    }
  }

  logDebug("injectTokenControlsButtonDirectly: Using token tools container", {
    id: tokenToolsContainer.attr('id'),
    classes: tokenToolsContainer.attr('class'),
    dataControl: tokenToolsContainer.attr('data-control'),
    children: tokenToolsContainer.children().length
  });

  // Create our tool button specifically for token tools
  const namesButton = $(`
    <li class="scene-control-tool" data-tool="names-generator" title="${game.i18n.localize("names.title") || 'Namen-Generator'}">
      <i class="fas fa-user-tag"></i>
    </li>
  `);

  // Add click handler
  namesButton.click((event) => {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool button clicked via DOM injection into token tools");
    openNamesGenerator();
  });

  // Additional event delegation for v13 compatibility
  namesButton.on('mousedown touchstart', (event) => {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool button pressed via DOM injection into token tools");
    openNamesGenerator();
  });

  // Insert into token tools container
  tokenToolsContainer.append(namesButton);
  logDebug("injectTokenControlsButtonDirectly: Names tool added to token tools container");

  // Setup event handlers after injection
  setTimeout(() => {
    setupV13EventHandling();
  }, 100);
}

/**
 * Token Controls integration - adds Names Generator button to token toolbar
 * Compatible with both Foundry VTT v12 and v13
 * @param {Array|Object} controls - Array of control button groups (v12) or controls object (v13)
 */
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.settings.get(MODULE_ID, "showInTokenControls")) return;
  if (!hasNamesGeneratorPermission()) return;

  // v12 compatibility - controls is an array
  if (Array.isArray(controls)) {
    const token = controls.find(c => c.name === 'token');
    if (!token) return;

    if (token.tools.some(t => t.name === 'names-generator')) return;

    token.tools.push({
      name: 'names-generator',
      title: game.i18n.localize("names.title"),
      icon: 'fas fa-user-tag',
      button: true,
      visible: () => hasNamesGeneratorPermission(),
      onClick: () => openNamesGenerator()
    });

    logDebug("Names generator tool added to token controls (v12)");
  } else if (controls.tokens) {
    // v13 - controls.tokens structure
    if (controls.tokens.tools && !controls.tokens.tools.namesGenerator) {
      controls.tokens.tools.namesGenerator = {
        name: 'names-generator',
        title: game.i18n.localize("names.title") || "Namen-Generator",
        icon: 'fas fa-user-tag',
        order: 999,
        button: true,
        visible: true,
        onClick: () => {
          logDebug("Names generator clicked via v13 token controls");
          openNamesGenerator();
        }
      };

      logDebug("Names generator tool added to token controls (v13)");
    }
  }
});

/**
 * Setup global event delegation and v13 event handling
 */
Hooks.on('ready', () => {
  // Add global event delegation for Names control button as fallback
  setTimeout(() => {
    setupGlobalEventDelegation();
    setupV13EventHandling();
  }, 2000);
});

/**
 * Setup global event delegation for Names control buttons
 */
function setupGlobalEventDelegation() {
  // Remove any existing delegation
  $(document).off('click.names-control');

  // Add event delegation for Names control buttons (both old control and new tool)
  $(document).on('click.names-control', '[data-control="names"], .scene-control[data-control="names"], [data-tool="names-generator"], .scene-control-tool[data-tool="names-generator"]', function(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names control/tool clicked via global event delegation", {
      element: this.tagName,
      dataControl: $(this).attr('data-control'),
      dataTool: $(this).attr('data-tool')
    });
    openNamesGenerator();
  });

  logDebug("Global event delegation setup for Names controls");
}

/**
 * Setup v13 specific event handling for token controls
 */
function setupV13EventHandling() {
  // Debug: Log all existing token tools
  const existingTools = $('[data-tool]');
  logDebug("setupV13EventHandling: Found existing tools", {
    count: existingTools.length,
    tools: existingTools.map((i, el) => $(el).attr('data-tool')).get()
  });

  // Hook into control tool activation for v13
  // Use once() to avoid duplicate handlers
  Hooks.once('controlTool', function namesControlToolHandler(tool, active) {
    logDebug("controlTool hook called", { tool, active });
    if (tool === 'names-generator' && active) {
      logDebug("Names generator activated via controlTool hook");
      openNamesGenerator();
    }
  });

  // Additional event delegation specifically for v13 token tools
  $(document).off('click.names-v13');
  $(document).on('click.names-v13', '[data-tool="names-generator"]', function(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool clicked via v13 event delegation", {
      target: event.target.tagName,
      currentTarget: event.currentTarget.tagName,
      dataTool: $(this).attr('data-tool')
    });
    openNamesGenerator();
  });

  // Also try direct click handler on existing tools
  $('[data-tool="names-generator"]').off('click.names-direct').on('click.names-direct', function(event) {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Names tool clicked via direct handler");
    openNamesGenerator();
  });

  logDebug("v13 event handling setup completed", {
    namesToolsFound: $('[data-tool="names-generator"]').length
  });
}


/**
 * v13 Token Controls - Direct DOM injection approach
 * Adds button directly to the rendered scene controls
 * Compatible with both jQuery and native HTMLElement
 */
Hooks.on('renderSceneControls', (sceneControls, html, data) => {
  try {
    if (!game.settings.get(MODULE_ID, "showInTokenControls")) return;
    if (!hasNamesGeneratorPermission()) return;

    logDebug("renderSceneControls called", {
      sceneControlsType: typeof sceneControls,
      htmlType: typeof html,
      hasControls: !!sceneControls?.controls
    });

    // Only for v13 - check if we're not in v12 mode
    if (Array.isArray(sceneControls?.controls)) {
      logDebug("renderSceneControls: v12 detected, skipping DOM injection");
      return;
    }

    // Handle both jQuery and native HTMLElement for v13 compatibility
    let $html;
    if (html && typeof html.find === 'function') {
      // v12 - html is jQuery object
      $html = html;
    } else if (html instanceof HTMLElement) {
      // v13 - html is HTMLElement
      $html = $(html);
    } else {
      logError("renderSceneControls: Unexpected html parameter type", typeof html);
      return;
    }

    logDebug("renderSceneControls: HTML converted to jQuery", { htmlLength: $html.length });

    // Check if button already exists
    if ($html.find('[data-tool="names-generator"]').length > 0) {
      logDebug("renderSceneControls: Names tool already exists");
      return;
    }

    // Debug: Log all scene controls found
    const allControls = $html.find('.scene-control');
    logDebug("renderSceneControls: Found scene controls", {
      count: allControls.length,
      controls: allControls.map((i, el) => $(el).attr('data-control')).get()
    });

    // Try multiple selectors for token control
    let tokenControl = $html.find('.scene-control[data-control="token"]');
    if (tokenControl.length === 0) {
      tokenControl = $html.find('[data-control="token"]');
    }
    if (tokenControl.length === 0) {
      tokenControl = $html.find('.scene-control').filter((i, el) => $(el).text().toLowerCase().includes('token'));
    }

    if (tokenControl.length === 0) {
      logDebug("renderSceneControls: No token control found with any selector");
      return;
    }

    logDebug("renderSceneControls: Token control found", { length: tokenControl.length });

    // Try multiple approaches to find tools container
    let tokenToolsContainer = tokenControl.siblings('.control-tools[data-control="token"]');
    if (tokenToolsContainer.length === 0) {
      tokenToolsContainer = $html.find('.control-tools[data-control="token"]');
    }
    if (tokenToolsContainer.length === 0) {
      tokenToolsContainer = tokenControl.next('.control-tools');
    }
    if (tokenToolsContainer.length === 0) {
      // Try to find any tools container
      tokenToolsContainer = $html.find('.control-tools').first();
    }

    if (tokenToolsContainer.length === 0) {
      logDebug("renderSceneControls: No token tools container found, trying alternative approach");

      // Alternative: Add directly to the main controls area
      const controlsContainer = $html.find('#controls');
      if (controlsContainer.length > 0) {
        // Create a simple button and add it to the main area
        const namesButton = $(`
          <li class="scene-control" data-control="names" title="${game.i18n.localize("names.title")}">
            <i class="fas fa-user-tag"></i>
          </li>
        `);

        namesButton.click((event) => {
          event.preventDefault();
          event.stopPropagation();
          openNamesGenerator();
        });

        controlsContainer.append(namesButton);
        logDebug("Names generator button added to main controls (v13 alternative)");
        return;
      }

      logDebug("renderSceneControls: No suitable container found");
      return;
    }

    logDebug("renderSceneControls: Token tools container found", { length: tokenToolsContainer.length });

    // Create our tool button
    const namesButton = $(`
      <li class="scene-control-tool" data-tool="names-generator" title="${game.i18n.localize("names.title")}">
        <i class="fas fa-user-tag"></i>
      </li>
    `);

    // Add click handler
    namesButton.click((event) => {
      event.preventDefault();
      event.stopPropagation();
      openNamesGenerator();
    });

    // Add the button to the token tools
    tokenToolsContainer.append(namesButton);
    logDebug("Names generator tool added to token controls (v13)");

    // Setup event handlers after DOM injection
    setTimeout(() => {
      setupV13EventHandling();
    }, 100);
  } catch (error) {
    logError("Error in renderSceneControls hook", error);
  }
});

/**
 * Character Sheet Integration - adds Names Picker button next to name field
 * @param {ActorSheet} app - The rendered actor sheet
 * @param {jQuery} html - The sheet's HTML
 * @param {Object} data - The sheet's data
 */
Hooks.on('renderActorSheet', (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "showInCharacterSheet")) return;
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

    injectPickerButtonCSS();
  }
});

/**
 * Token Context Menu integration - adds Names option to token right-click menu
 * @param {jQuery} html - The context menu HTML
 * @param {Array} options - Array of context menu options
 */
Hooks.on('getTokenContextOptions', (html, options) => {
  if (!game.settings.get(MODULE_ID, "showInTokenContextMenu")) return;
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

/**
 * Token HUD integration - adds Names button to token HUD
 * Compatible with both Foundry VTT v12 and v13
 * @param {TokenHUD} app - The token HUD application
 * @param {jQuery|HTMLElement} html - The HUD's HTML
 * @param {Object} data - The HUD's data
 */
Hooks.on('renderTokenHUD', (app, html, data) => {
  try {
    if (!game.settings.get(MODULE_ID, "showInTokenContextMenu")) return;
    if (!hasNamesGeneratorPermission()) return;
    if (!app.object?.actor) return;

    // Handle both jQuery and native HTMLElement for v13 compatibility
    let $html;
    if (html && typeof html.find === 'function') {
      // v12 - html is jQuery object
      $html = html;
    } else if (html instanceof HTMLElement) {
      // v13 - html is HTMLElement
      $html = $(html);
    } else {
      logError("renderTokenHUD: Unexpected html parameter type", typeof html);
      return;
    }

    const button = $(`
      <div class="control-icon" title="${game.i18n.localize("names.title")}">
        <i class="fas fa-user-tag"></i>
      </div>
    `);

    button.click(() => {
      new NamesPickerApp({ actor: app.object.actor }).render(true);
    });

    const leftPanel = $html.find('.left');
    if (leftPanel.length > 0) {
      leftPanel.append(button);
    } else {
      logError("renderTokenHUD: Could not find .left panel");
    }
  } catch (error) {
    logError("Error in renderTokenHUD hook", error);
  }
});

/**
 * Chat Commands integration - handles slash commands for Names module
 * @param {jQuery} html - The chat message HTML
 * @param {string} content - The message content
 * @param {Object} msg - The message data
 */
Hooks.on('chatMessage', (html, content, msg) => {
  if (!hasNamesGeneratorPermission()) {
    if (content === '/names' || content === '/namen' || content === '/pick-name' || content === '/name-picker' || content === '/emergency-names') {
      ui.notifications.warn(game.i18n.localize("names.no-permission"));
      return false;
    }
    return;
  }

  if (content === '/names' || content === '/namen') {
    openNamesGenerator();
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

  if (content === '/emergency-names' || content === '/npc-names') {
    new EmergencyNamesApp().render(true);
    return false;
  }
});

// ===== SETTINGS REGISTRATION =====

/**
 * Registers all module settings with Foundry VTT
 * Settings are organized logically: Client preferences, World configuration, UI integration
 */
function registerModuleSettings() {
  // Use numeric values directly to avoid string parsing issues
  const logLevelChoices = {
    "Nur Fehler": 0,
    "Warnungen": 1,
    "Informationen": 2,
    "Alle Details": 3
  };

  // ===== CLIENT SETTINGS (Benutzer-spezifische Einstellungen) =====

  // Legacy migration: migrate defaultLanguage to new settings
  try {
    const legacyDefaultLanguage = game.settings.get(MODULE_ID, "defaultLanguage");
    if (legacyDefaultLanguage !== undefined) {
      // Migrate to new settings
      if (!game.settings.settings.has(`${MODULE_ID}.defaultContentLanguage`)) {
        game.settings.set(MODULE_ID, "defaultContentLanguage", legacyDefaultLanguage);
      }
      if (!game.settings.settings.has(`${MODULE_ID}.interfaceLanguage`)) {
        game.settings.set(MODULE_ID, "interfaceLanguage", "auto");
      }
      logInfo(`Migrated legacy defaultLanguage setting: ${legacyDefaultLanguage}`);
    }
  } catch (error) {
    // Setting doesn't exist yet, which is fine
  }

  // Interface Language Setting - wichtigste persönliche Präferenz
  game.settings.register(MODULE_ID, "interfaceLanguage", {
    name: game.i18n.localize("names.settings.interfaceLanguage.name") || "Interface-Sprache",
    hint: game.i18n.localize("names.settings.interfaceLanguage.hint") || "Die Sprache der Benutzeroberfläche (unabhängig von der Inhaltssprache)",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "auto": game.i18n.localize("names.settings.interfaceLanguage.auto") || "Automatisch (Foundry-Sprache)",
      "de": "Deutsch",
      "en": "English"
    },
    default: "auto",
    requiresReload: true
  });

  // Default Content Language Setting - für Sprachklang der Namen
  game.settings.register(MODULE_ID, "defaultContentLanguage", {
    name: game.i18n.localize("names.settings.defaultContentLanguage.name") || "Standard-Sprachklang",
    hint: game.i18n.localize("names.settings.defaultContentLanguage.hint") || "Die Standard-Sprache für generierte Namen (Sprachklang)",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "auto": game.i18n.localize("names.settings.defaultContentLanguage.auto") || "Automatisch (Interface-Sprache)",
      "de": "Deutsch",
      "en": "English",
      "fr": "Français",
      "es": "Español",
      "it": "Italiano"
    },
    default: "auto"
  });

  // Default Name Count Setting - häufiger genutzt als Anzeigeformat
  game.settings.register(MODULE_ID, "defaultNameCount", {
    name: game.i18n.localize("names.settings.defaultNameCount.name") || "Standard-Anzahl Namen",
    hint: game.i18n.localize("names.settings.defaultNameCount.hint") || "Die Anzahl der Namen, die standardmäßig generiert werden sollen (1-20)",
    scope: "client",
    config: true,
    type: Number,
    range: {
      min: 1,
      max: 20,
      step: 1
    },
    default: 5
  });

  // Default View Setting - Anzeigeformat
  game.settings.register(MODULE_ID, "defaultView", {
    name: game.i18n.localize("names.settings.defaultView.name") || "Standard-Ansicht",
    hint: game.i18n.localize("names.settings.defaultView.hint") || "Die Ansicht, die beim Öffnen des Namen-Generators automatisch ausgewählt wird",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "detailed": game.i18n.localize("names.settings.defaultView.detailed") || "Detailliert",
      "simple": game.i18n.localize("names.settings.defaultView.simple") || "Kompakt"
    },
    default: "detailed"
  });

  // Log Level Setting - für Entwicklung/Debugging am Ende der Client-Settings
  game.settings.register(MODULE_ID, "logLevel", {
    name: game.i18n.localize("names.settings.logLevel.name") || "Log Level",
    hint: game.i18n.localize("names.settings.logLevel.hint") || "Bestimmt wie viele Konsolen-Meldungen angezeigt werden. Debug zeigt alle Meldungen, Error nur Fehler.",
    scope: "client",
    config: true,
    type: Number,
    choices: logLevelChoices,
    default: 2, // LOG_LEVELS.INFO
    onChange: (value) => {
      updateLogLevel();
    }
  });

  // ===== WORLD SETTINGS (Spiel-weite Konfiguration) =====

  // Role Configuration Menu - wichtigste Berechtigung zuerst
  game.settings.registerMenu(MODULE_ID, "roleConfig", {
    name: game.i18n.localize("names.settings.roleConfig.name"),
    hint: game.i18n.localize("names.settings.roleConfig.hint"),
    label: game.i18n.localize("names.settings.roleConfig.label"),
    icon: "fas fa-users-cog",
    type: NamesRoleConfig,
    restricted: true
  });

  // Species Configuration Menu - wichtigste Inhaltskonfiguration
  game.settings.registerMenu(MODULE_ID, "speciesConfig", {
    name: game.i18n.localize("names.settings.speciesConfig.name") || "Spezies verwalten",
    hint: game.i18n.localize("names.settings.speciesConfig.hint") || "Konfiguriere welche Spezies verfügbar sein sollen",
    label: game.i18n.localize("names.settings.speciesConfig.label") || "Spezies konfigurieren",
    icon: "fas fa-dragon",
    type: NamesSpeciesConfig,
    restricted: true
  });

  // Content and Feature Settings - Features die das Verhalten beeinflussen
  game.settings.register(MODULE_ID, "enableMetadata", {
    name: game.i18n.localize("names.settings.enableMetadata.name") || "Erweiterte Metadaten anzeigen",
    hint: game.i18n.localize("names.settings.enableMetadata.hint") || "Zeigt zusätzliche Informationen wie Inhaber, Lage und Spezialitäten bei generierten Orten und Gebäuden an",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "includeNonbinaryNames", {
    name: game.i18n.localize("names.settings.includeNonbinaryNames.name") || "Non-binäre Namen einbeziehen",
    hint: game.i18n.localize("names.settings.includeNonbinaryNames.hint") || "Ermöglicht die Generierung von non-binären Namen",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // UI Integration Settings - wo der Generator verfügbar ist
  game.settings.register(MODULE_ID, "showInTokenControls", {
    name: game.i18n.localize("names.settings.showInTokenControls.name"),
    hint: game.i18n.localize("names.settings.showInTokenControls.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showInCharacterSheet", {
    name: game.i18n.localize("names.settings.showInCharacterSheet.name"),
    hint: game.i18n.localize("names.settings.showInCharacterSheet.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showInTokenContextMenu", {
    name: game.i18n.localize("names.settings.showInTokenContextMenu.name"),
    hint: game.i18n.localize("names.settings.showInTokenContextMenu.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showEmergencyButton", {
    name: game.i18n.localize("names.settings.showEmergencyButton.name") || "Emergency Button anzeigen",
    hint: game.i18n.localize("names.settings.showEmergencyButton.hint") || "Zeigt einen Emergency Button im Chat an",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      // Show/hide button immediately on setting change
      if (value && hasNamesGeneratorPermission()) {
        setTimeout(() => injectEmergencyButton(), 100);
      } else {
        removeEmergencyButton();
      }
    }
  });

  // ===== HIDDEN SETTINGS (nicht in der Konfiguration sichtbar) =====

  // User Roles Setting (hidden from config UI)
  game.settings.register(MODULE_ID, "allowedUserRoles", {
    name: "Erlaubte Benutzerrollen",
    hint: "Welche Benutzerrollen dürfen den Namen-Generator verwenden",
    scope: "world",
    config: false,
    type: Array,
    default: [CONST.USER_ROLES.GAMEMASTER]
  });

  // Available Species Setting
  game.settings.register(MODULE_ID, "availableSpecies", {
    name: game.i18n.localize("names.settings.availableSpecies.name") || "Verfügbare Spezies",
    hint: game.i18n.localize("names.settings.availableSpecies.hint") || "Wähle welche Spezies im Generator verfügbar sein sollen",
    scope: "world",
    config: false, // Will be handled by menu
    type: Object,
    default: {}
  });

  logDebug("Module settings registered");
}

// ===== SOCKET HANDLING =====

/**
 * Registers socket handler for inter-client communication
 * Handles permission change notifications between clients
 */
function registerSocketHandler() {
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    if (data.type === "permissionChanged" && data.affectedUsers.includes(game.user.id)) {
      showPermissionChangeDialog();
    }
  });
  
  logDebug("Socket handler registered");
}

// ===== CSS INJECTION =====

/**
 * Injects CSS styles for the Names Picker button and other UI elements
 * Only injects if not already present to avoid duplicates
 */
function injectPickerButtonCSS() {
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
        
        .emergency-name-item.copied {
          background-color: #4CAF50 !important;
          color: white !important;
          transform: scale(1.02);
        }
      </style>
    `);
  }
}

// ===== GLOBAL ACCESS (for backwards compatibility) =====
// Make apps available globally for chat commands and other integrations
window.NamesModule = {
  NamesGeneratorApp,
  NamesPickerApp,
  EmergencyNamesApp,
  NamesRoleConfig,
  hasNamesGeneratorPermission,
  getGlobalNamesData: () => ensureGlobalNamesData(),
  // Expose API for other modules
  api: NamesAPI,
  // Expose Enhanced Dropdown for external use
  EnhancedDropdown
};