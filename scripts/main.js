/**
 * Names Module - Main entry point
 * Handles initialization, settings, and Foundry VTT integration
 */

import { ensureGlobalNamesData, setGlobalNamesData, NamesDataManager } from './core/data-manager.js';
import { NamesGeneratorApp } from './apps/generator-app.js';
import { NamesPickerApp } from './apps/picker-app.js';
import { EmergencyNamesApp } from './apps/emergency-app.js';
import { NamesRoleConfig } from './apps/role-config.js';
import { hasNamesGeneratorPermission, showPermissionChangeDialog } from './utils/permissions.js';
import { injectEmergencyButton, removeEmergencyButton } from './utils/ui-helpers.js';
import { MODULE_ID } from './shared/constants.js';
import { NamesAPI } from './api-system.js';
import { LOG_LEVELS, updateLogLevel, logInfo, logInfoL, logDebug, logError } from './utils/logger.js';
import { EnhancedDropdown, initializeEnhancedDropdowns } from './components/enhanced-dropdown.js';

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
  logDebug("Ready hook - initializing data");
  
  // Initialize log level
  updateLogLevel();
  
  // Ensure globalNamesData exists and start loading
  const dataManager = ensureGlobalNamesData();
  if (dataManager) {
    dataManager.initializeData();
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
 * Token Controls integration - adds Names Generator button to token toolbar
 * @param {Array} controls - Array of control button groups
 */
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.settings.get(MODULE_ID, "showInTokenControls")) return;
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
 * @param {TokenHUD} app - The token HUD application
 * @param {jQuery} html - The HUD's HTML
 * @param {Object} data - The HUD's data
 */
Hooks.on('renderTokenHUD', (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "showInTokenContextMenu")) return;
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

  if (content === '/emergency-names' || content === '/npc-names') {
    new EmergencyNamesApp().render(true);
    return false;
  }
});

// ===== SETTINGS REGISTRATION =====

/**
 * Registers all module settings with Foundry VTT
 * Includes log level, language, UI visibility, permissions, and configuration menus
 */
function registerModuleSettings() {
  // Direct German choices since localization might not be ready during init
  const logLevelChoices = {
    "Nur Fehler": "0",
    "Warnungen": "1",
    "Informationen": "2",
    "Alle Details": "3"
  };

  // Log Level Setting
  game.settings.register(MODULE_ID, "logLevel", {
    name: game.i18n.localize("names.settings.logLevel.name") || "Log Level",
    hint: game.i18n.localize("names.settings.logLevel.hint") || "Bestimmt wie viele Konsolen-Meldungen angezeigt werden. Debug zeigt alle Meldungen, Error nur Fehler.",
    scope: "client",
    config: true,
    type: String,
    choices: logLevelChoices,
    default: "2", // LOG_LEVELS.INFO
    onChange: (value) => {
      updateLogLevel();

      // Map text back to number if needed
      let newLevel;
      if (typeof value === 'string') {
        if (value === "Nur Fehler") newLevel = 0;
        else if (value === "Warnungen") newLevel = 1;
        else if (value === "Informationen") newLevel = 2;
        else if (value === "Alle Details") newLevel = 3;
        else newLevel = parseInt(value) || LOG_LEVELS.INFO;
      } else {
        newLevel = parseInt(value) || LOG_LEVELS.INFO;
      }

      const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === newLevel) || 'UNKNOWN';
      logInfo(`Log level changed to: ${newLevel} (${levelName})`);
    }
  });

  // Default Language Setting
  game.settings.register(MODULE_ID, "defaultLanguage", {
    name: game.i18n.localize("names.settings.defaultLanguage.name") || "Standard-Sprache",
    hint: game.i18n.localize("names.settings.defaultLanguage.hint") || "Die Sprache, die beim Öffnen des Namen-Generators automatisch ausgewählt wird",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "auto": game.i18n.localize("names.settings.defaultLanguage.auto") || "Automatisch (Foundry-Sprache)",
      "de": "Deutsch",
      "en": "English",
      "fr": "Français",
      "es": "Español",
      "it": "Italiano"
    },
    default: "auto"
  });

  // Token Controls Setting
  game.settings.register(MODULE_ID, "showInTokenControls", {
    name: game.i18n.localize("names.settings.showInTokenControls.name"),
    hint: game.i18n.localize("names.settings.showInTokenControls.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Character Sheet Setting
  game.settings.register(MODULE_ID, "showInCharacterSheet", {
    name: game.i18n.localize("names.settings.showInCharacterSheet.name"),
    hint: game.i18n.localize("names.settings.showInCharacterSheet.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Token Context Menu Setting
  game.settings.register(MODULE_ID, "showInTokenContextMenu", {
    name: game.i18n.localize("names.settings.showInTokenContextMenu.name"),
    hint: game.i18n.localize("names.settings.showInTokenContextMenu.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Emergency Button Setting
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

  // Non-binary Names Setting
  game.settings.register(MODULE_ID, "includeNonbinaryNames", {
    name: game.i18n.localize("names.settings.includeNonbinaryNames.name") || "Non-binäre Namen einbeziehen",
    hint: game.i18n.localize("names.settings.includeNonbinaryNames.hint") || "Ermöglicht die Generierung von non-binären Namen",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // User Roles Setting (hidden from config UI)
  game.settings.register(MODULE_ID, "allowedUserRoles", {
    name: "Erlaubte Benutzerrollen",
    hint: "Welche Benutzerrollen dürfen den Namen-Generator verwenden",
    scope: "world",
    config: false,
    type: Array,
    default: [CONST.USER_ROLES.GAMEMASTER]
  });

  // Role Configuration Menu
  game.settings.registerMenu(MODULE_ID, "roleConfig", {
    name: game.i18n.localize("names.settings.roleConfig.name"),
    hint: game.i18n.localize("names.settings.roleConfig.hint"),
    label: game.i18n.localize("names.settings.roleConfig.label"),
    icon: "fas fa-users-cog",
    type: NamesRoleConfig,
    restricted: true
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