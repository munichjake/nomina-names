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

// ===== MODULE INITIALIZATION =====
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
  
  // Fire the data loaded hook for other modules
  Hooks.callAll('namesModuleReady', NamesAPI);
});

// ===== UI INTEGRATIONS =====

// Emergency Button after Chat Render
Hooks.on('renderChatLog', () => {
  setTimeout(() => {
    if (hasNamesGeneratorPermission() && game.settings.get(MODULE_ID, "showEmergencyButton")) {
      injectEmergencyButton();
    }
  }, 100);
});

// Token Controls
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

// Character Sheet Integration
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

// Token Context Menu
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

// Token HUD
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

// Chat Commands
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
function registerModuleSettings() {
  // Function to get log level choices with proper localization
  function getLogLevelChoices() {
    return {
      [game.i18n.localize("names.settings.logLevel.error") || "Nur Fehler"]: "0",
      [game.i18n.localize("names.settings.logLevel.warn") || "Warnungen"]: "1",
      [game.i18n.localize("names.settings.logLevel.info") || "Informationen"]: "2",
      [game.i18n.localize("names.settings.logLevel.debug") || "Alle Details"]: "3"
    };
  }

  // Log Level Setting
  game.settings.register(MODULE_ID, "logLevel", {
    name: game.i18n.localize("names.settings.logLevel.name") || "Log Level",
    hint: game.i18n.localize("names.settings.logLevel.hint") || "Bestimmt wie viele Konsolen-Meldungen angezeigt werden. Debug zeigt alle Meldungen, Error nur Fehler.",
    scope: "client",
    config: true,
    type: String,
    choices: getLogLevelChoices(),
    default: "2", // LOG_LEVELS.INFO
    onChange: (value) => {
      updateLogLevel();
      logInfo(`Log level changed to: ${parseInt(value) || LOG_LEVELS.INFO}`);
    }
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
function registerSocketHandler() {
  game.socket.on(`module.${MODULE_ID}`, (data) => {
    if (data.type === "permissionChanged" && data.affectedUsers.includes(game.user.id)) {
      showPermissionChangeDialog();
    }
  });
  
  logDebug("Socket handler registered");
}

// ===== CSS INJECTION =====
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
  api: NamesAPI
};