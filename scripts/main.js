/**
 * Names Module - Main entry point
 * Handles initialization, settings, and Foundry VTT integration
 */

import { getGlobalDataManager } from './core/data-manager.js';
import { getGlobalGenerator } from './api/generator.js';
import { getGlobalEngine } from './core/engine.js';
import { NamesAPI } from './api-system.js';
import { registerModuleSettings } from './settings/settings-registration.js';
import { registerTokenControls, setupGlobalEventDelegation, injectTokenControlsButtonDirectly, registerRenderSceneControls, openNamesGenerator } from './integrations/token-controls.js';
import { registerCharacterSheetIntegration, registerTokenHUDIntegration, registerTokenContextMenu } from './integrations/character-sheet.js';
import { registerChatCommands } from './integrations/chat-commands.js';
import { hasNamesGeneratorPermission } from './utils/permissions.js';
import { injectEmergencyButton, removeEmergencyButton, moveEmergencyButton } from './utils/ui-helpers.js';
import { MODULE_ID } from './shared/constants.js';
import { updateLogLevel, logInfoL, logDebug, logError } from './utils/logger.js';
import { EnhancedDropdown, initializeEnhancedDropdowns } from './components/enhanced-dropdown.js';
import { getHistoryManager } from './core/history-manager.js';
import { registerHandlebarsHelpers } from './utils/handlebars-helpers.js';
import { SavrasLib } from './savras-lib.js';

// ===== TELEMETRY =====

/**
 * SavrasLib telemetry instance - shared across the module.
 * Instantiated at module level so its auto-registered hooks (init/ready) fire correctly.
 */
const telemetry = new SavrasLib({
  moduleId:       MODULE_ID,
  telemetryUrl:   'https://savras.dnd-session.de/api/v1/telemetry',
  startupMessage: 'Nomina Names v3.1.0 loaded – anonymous telemetry active (opt-out in settings)',
});

/** @returns {SavrasLib} */
export function getTelemetry() {
  return telemetry;
}

// ===== MODULE INITIALIZATION =====

/**
 * Module initialization hook - runs once during Foundry startup
 * Sets up the data manager, registers settings, and initializes socket handlers
 */
Hooks.once('init', () => {
  logInfoL("console.module-init");

  // Register Handlebars helpers
  registerHandlebarsHelpers();
  logDebug("Handlebars helpers registered");

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

  logDebug("Ready hook - initializing V4 data");

  // Initialize V4 DataManager and Generator
  const dataManager = getGlobalDataManager();
  const generator = getGlobalGenerator();

  dataManager.initializeData().then(() => {
    // Setup NamesAPI after DataManager is ready
    try {
      NamesAPI.setup();
      logDebug("V4 DataManager and NamesAPI initialization completed");

      // Fire API ready event for external modules
      Hooks.callAll('nomina-names.api.ready', NamesAPI);
      logDebug("Fired nomina-names.api.ready event");
    } catch (error) {
      logError("Failed to setup NamesAPI", error);

      // Fire error event for external modules even when NamesAPI setup fails
      Hooks.callAll('nomina-names.api.error', {
        error: error,
        message: "Failed to setup NamesAPI",
        phase: "api-setup"
      });

      // Still fire ready event with null to notify waiting modules
      Hooks.callAll('nomina-names.api.ready', null);
      logDebug("Fired nomina-names.api.error and nomina-names.api.ready (null) events after NamesAPI setup failure");
    }
  }).catch(error => {
    logError("Failed to initialize V4 DataManager", error);

    // Fire error event for external modules when DataManager initialization fails
    Hooks.callAll('nomina-names.api.error', {
      error: error,
      message: "Failed to initialize V4 DataManager",
      phase: "data-manager-initialization"
    });

    // Still fire ready event with null to notify waiting modules
    Hooks.callAll('nomina-names.api.ready', null);
    logDebug("Fired nomina-names.api.error and nomina-names.api.ready (null) events after DataManager initialization failure");
  });

  // Initialize History Manager and apply setting
  const historyManager = getHistoryManager();
  const maxEntries = game.settings.get(MODULE_ID, "historyMaxEntries");
  historyManager.setMaxEntries(maxEntries);
  logDebug(`History Manager initialized with max entries: ${maxEntries}`);

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

  // Register simplified global API access point
  game.NominaAPI = NamesAPI;
  logDebug("Global API access point registered: game.NominaAPI");

  // Initialize Enhanced Dropdowns after a short delay to ensure DOM is ready
  setTimeout(() => {
    initializeEnhancedDropdownsForModule();
  }, 200);

  // Fire legacy event for backwards compatibility
  Hooks.callAll('namesModuleReady', NamesAPI);

  // Setup global event delegation for token controls
  setTimeout(() => {
    setupGlobalEventDelegation();
  }, 2000);
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
 * Emergency Button injection with robust event handling for chat state changes
 * Inspired by best practices for Foundry VTT module UI integration
 */

// Initial injection after Chat Log renders
Hooks.on('renderChatLog', () => {
  setTimeout(() => {
    if (hasNamesGeneratorPermission() && game.settings.get(MODULE_ID, "showEmergencyButton")) {
      injectEmergencyButton();
    }
  }, 100);
});

// Re-inject/move button when chat is popped out
Hooks.on('renderChatLog', (chatlog, html, data) => {
  if (!chatlog.isPopout) return;
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) return;
  moveEmergencyButton();
});

// Remove/re-inject button when chat popout is closed
Hooks.on('closeChatLog', (chatlog, html, data) => {
  if (!chatlog.isPopout) return;
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) return;
  moveEmergencyButton();
});

// Move button when chat tab is activated
Hooks.on('activateChatLog', (chatlog) => {
  if (ui.chat.popout?.rendered && !ui.chat.isPopout) return;
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) return;
  moveEmergencyButton();
});

// Move button when chat tab is deactivated
Hooks.on('deactivateChatLog', (chatlog) => {
  if (ui.chat.popout?.rendered && !ui.chat.isPopout) return;
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) return;
  moveEmergencyButton();
});

// Move button when sidebar is collapsed/expanded
Hooks.on('collapseSidebar', (sidebar, wasExpanded) => {
  if (ui.chat.popout?.rendered && !ui.chat.isPopout) return;
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) return;
  moveEmergencyButton();
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
 * Token Controls integration - adds Names Generator button to token toolbar
 */
Hooks.on('getSceneControlButtons', (controls) => {
  registerTokenControls(controls);
});

/**
 * Token Controls - Direct DOM injection approach
 * Adds button directly to the rendered scene controls
 */
Hooks.on('renderSceneControls', (sceneControls, html, data) => {
  registerRenderSceneControls(sceneControls, html, data);
});

/**
 * Character Sheet Integration - adds Names Picker button next to name field
 */
Hooks.on('renderActorSheet', (app, html, data) => {
  registerCharacterSheetIntegration(app, html, data);
});

/**
 * Token Context Menu integration - adds Names option to token right-click menu
 */
Hooks.on('getTokenContextOptions', (html, options) => {
  registerTokenContextMenu(html, options);
});

/**
 * Token HUD integration - adds Names button to token HUD
 */
Hooks.on('renderTokenHUD', (app, html, data) => {
  registerTokenHUDIntegration(app, html, data);
});

/**
 * Chat Commands integration - handles slash commands for Names module
 */
Hooks.on('chatMessage', (html, content, msg) => {
  registerChatCommands(html, content, msg);
});

// ===== SOCKET HANDLING =====

/**
 * Registers socket handler for inter-client communication
 * Handles permission change notifications between clients
 */
function registerSocketHandler() {
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    if (data.type === "permissionChanged" && data.affectedUsers.includes(game.user.id)) {
      // Import the dialog function dynamically to avoid circular dependencies
      import('./utils/permissions.js').then(module => {
        module.showPermissionChangeDialog();
      });
    }
  });

  logDebug("Socket handler registered");
}

// ===== GLOBAL ACCESS (for backwards compatibility) =====
// Make apps available globally for chat commands and other integrations
window.NamesModule = {
  NamesGeneratorApp: () => import('./apps/generator-app.js').then(m => m.NamesGeneratorApp),
  NamesPickerApp: () => import('./apps/picker-app.js').then(m => m.NamesPickerApp),
  EmergencyNamesApp: () => import('./apps/emergency-app.js').then(m => m.EmergencyNamesApp),
  NamesHistoryApp: () => import('./apps/history-app.js').then(m => m.NamesHistoryApp),
  NamesRoleConfig: () => import('./apps/role-config.js').then(m => m.NamesRoleConfig),
  hasNamesGeneratorPermission,
  getGlobalDataManager: () => getGlobalDataManager(),
  getGlobalGenerator: () => getGlobalGenerator(),
  getGlobalEngine: () => getGlobalEngine(),
  getHistoryManager: () => getHistoryManager(),
  // Expose API for other modules
  api: NamesAPI,
  // Expose Enhanced Dropdown for external use
  EnhancedDropdown
};
