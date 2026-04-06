/**
 * Settings Registration
 * Registers all module settings with Foundry VTT
 */

import { NamesRoleConfig } from '../apps/role-config.js';
import { NamesSpeciesConfig } from '../apps/species-config.js';
import { NamesGenderColorsConfig } from '../apps/gender-colors-config.js';
import { getHistoryManager } from '../core/history-manager.js';
import { MODULE_ID, DEFAULT_GENDER_COLORS } from '../shared/constants.js';
import { LOG_LEVELS, updateLogLevel, logDebug } from '../utils/logger.js';

/**
 * Registers all module settings with Foundry VTT
 * Settings are organized logically: Client preferences, World configuration, UI integration
 */
export function registerModuleSettings() {
  const logLevelChoices = getLogLevelChoices();

  registerClientSettings(logLevelChoices);
  registerWorldSettings();
  registerHiddenSettings();

  logDebug("Module settings registered");
}

/**
 * Get localized log level choices for the setting UI
 * @returns {Object} Map of log level values to localized labels
 */
function getLogLevelChoices() {
  return {
    0: game.i18n.localize("names.settings.logLevel.error") || "Nur Fehler",
    1: game.i18n.localize("names.settings.logLevel.warn") || "Warnungen und Fehler",
    2: game.i18n.localize("names.settings.logLevel.info") || "Alle Infos",
    3: game.i18n.localize("names.settings.logLevel.debug") || "Debug (alle Meldungen)"
  };
}

/**
 * Register client-specific settings (user preferences)
 * These settings are stored per-user and control individual user experience
 * @param {Object} logLevelChoices - Localized log level choices
 */
function registerClientSettings(logLevelChoices) {
  registerNameClickBehaviorSettings();
  migrateLegacyLanguageSettings();
  registerLanguageSettings();
  registerDisplaySettings();
  registerHistorySettings();
  registerGenderColorsSettings();
  registerLogLevelSetting(logLevelChoices);
}

/**
 * Register name click behavior settings
 * Controls what happens when a user clicks on a generated name
 */
function registerNameClickBehaviorSettings() {
  game.settings.register(MODULE_ID, "nameClickCopy", {
    name: game.i18n.localize("names.settings.nameClickCopy.name") || "In Zwischenablage kopieren",
    hint: game.i18n.localize("names.settings.nameClickCopy.hint") || "Namen beim Klick in die Zwischenablage kopieren",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "nameClickPost", {
    name: game.i18n.localize("names.settings.nameClickPost.name") || "In Chat posten",
    hint: game.i18n.localize("names.settings.nameClickPost.hint") || "Namen beim Klick in den Chat posten",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "nameClickPostWhisper", {
    name: game.i18n.localize("names.settings.nameClickPostWhisper.name") || "Chat-Vertraulichkeit",
    hint: game.i18n.localize("names.settings.nameClickPostWhisper.hint") || "Vertraulichkeitseinstellung beim Chat-Post",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "inherit": game.i18n.localize("names.settings.nameClickPostWhisper.inherit") || "Aktuelle Stufe übernehmen",
      "whisper": game.i18n.localize("names.settings.nameClickPostWhisper.whisper") || "Nur für GM sichtbar (WHISPER)",
      "public": game.i18n.localize("names.settings.nameClickPostWhisper.public") || "Öffentlich (PUBLIC)"
    },
    default: "inherit"
  });
}

/**
 * Migrate legacy defaultLanguage setting to new language settings
 * This is a one-time migration from the old unified language setting
 */
function migrateLegacyLanguageSettings() {
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
      console.info(`Migrated legacy defaultLanguage setting: ${legacyDefaultLanguage}`);
    }
  } catch (error) {
    // Setting doesn't exist yet, which is fine
  }
}

/**
 * Register language-related settings
 * Controls interface language and content language (name sound)
 */
function registerLanguageSettings() {
  // Interface Language Setting
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
}

/**
 * Register display-related settings
 * Controls how generated names are displayed in the UI
 */
function registerDisplaySettings() {
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

  // Generate Button Placement Setting - nur für Generator-App
  game.settings.register(MODULE_ID, "generateButtonPlacement", {
    name: game.i18n.localize("names.settings.generateButtonPlacement.name") || "Generieren-Button Position",
    hint: game.i18n.localize("names.settings.generateButtonPlacement.hint") || "Position des Generieren-Buttons in der Generator-App",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "legacy": game.i18n.localize("names.settings.generateButtonPlacement.legacy") || "Klassisch (unter den Optionen)",
      "floating": game.i18n.localize("names.settings.generateButtonPlacement.floating") || "Schwebend (am unteren Rand der Optionen)",
      "result": game.i18n.localize("names.settings.generateButtonPlacement.result") || "Ergebnisbereich (neben Kopieren-Button)"
    },
    default: "legacy"
  });
}

/**
 * Register history-related settings
 * Controls the name history functionality
 */
function registerHistorySettings() {
  // History Max Entries Setting - Anzahl der gespeicherten Namen
  game.settings.register(MODULE_ID, "historyMaxEntries", {
    name: game.i18n.localize("names.settings.historyMaxEntries.name") || "Maximale History-Einträge",
    hint: game.i18n.localize("names.settings.historyMaxEntries.hint") || "Die maximale Anzahl generierter Namen, die in der History gespeichert werden (10-200)",
    scope: "client",
    config: true,
    type: Number,
    range: {
      min: 10,
      max: 200,
      step: 10
    },
    default: 100,
    onChange: (value) => {
      // Update history manager when setting changes
      const historyManager = getHistoryManager();
      historyManager.setMaxEntries(value);
      logDebug(`History max entries updated to: ${value}`);
    }
  });
}

/**
 * Register gender color settings
 * Controls color-coding of generated names based on gender
 */
function registerGenderColorsSettings() {
  // Standard gender colors for name generator
  game.settings.register(MODULE_ID, "enableGenderColors", {
    name: "Enable Gender Colors",
    hint: "Display generated names with color-coding based on gender",
    scope: "client",
    config: false, // Managed via config dialog
    type: Boolean,
    default: false
  });

  game.settings.registerMenu(MODULE_ID, "genderColorsConfig", {
    name: game.i18n.localize("names.settings.genderColorsConfig.name") || "Geschlechter-Farben",
    hint: game.i18n.localize("names.settings.genderColorsConfig.hint") || "Aktivieren und konfigurieren der farblichen Kennzeichnung nach Geschlecht",
    label: game.i18n.localize("names.settings.genderColorsConfig.label") || "Konfigurieren",
    icon: "fas fa-palette",
    type: NamesGenderColorsConfig,
    restricted: false
  });

  game.settings.register(MODULE_ID, "genderColors", {
    name: "Gender Colors",
    hint: "Color configuration for each gender",
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULT_GENDER_COLORS
  });

  // Emergency Gender Colors Settings
  game.settings.register(MODULE_ID, "enableEmergencyGenderColors", {
    name: game.i18n.localize("names.settings.enableEmergencyGenderColors.name"),
    hint: game.i18n.localize("names.settings.enableEmergencyGenderColors.hint"),
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "emergencyGenderColors", {
    name: game.i18n.localize("names.settings.emergencyGenderColors.name"),
    hint: game.i18n.localize("names.settings.emergencyGenderColors.hint"),
    scope: "client",
    config: false,
    type: Object,
    default: DEFAULT_GENDER_COLORS
  });
}

/**
 * Register log level setting
 * Controls the verbosity of console output for debugging
 * @param {Object} logLevelChoices - Localized log level choices
 */
function registerLogLevelSetting(logLevelChoices) {
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
}

/**
 * Register world-specific settings (game-wide configuration)
 * These settings are stored per-world and control game-wide behavior
 */
function registerWorldSettings() {
  registerConfigurationMenus();
  registerContentSettings();
  registerUIIntegrationSettings();
}

/**
 * Register configuration menu settings
 * Provides access to role and species configuration dialogs
 */
function registerConfigurationMenus() {
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
}

/**
 * Register content-related settings
 * Controls content features and generation behavior
 */
function registerContentSettings() {
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
}

/**
 * Register UI integration settings
 * Controls where the name generator appears in the Foundry UI
 */
function registerUIIntegrationSettings() {
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
      // This is handled by the main module's emergency button logic
    }
  });
}

/**
 * Register hidden settings
 * These settings are not visible in the configuration UI and are managed programmatically
 */
function registerHiddenSettings() {
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

  // Emergency App - remembered species filter
  game.settings.register(MODULE_ID, "emergencyFilterSpecies", {
    name: "Emergency Filter Species",
    scope: "client",
    config: false,
    type: Array,
    default: []
  });

  // Generator App - remembered selections
  game.settings.register(MODULE_ID, "generatorLastLanguage", {
    name: "Generator Last Language",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "generatorLastSpecies", {
    name: "Generator Last Species",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "generatorLastCategory", {
    name: "Generator Last Category",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  // Picker App - remembered selections
  game.settings.register(MODULE_ID, "pickerLastLanguage", {
    name: "Picker Last Language",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "pickerLastSpecies", {
    name: "Picker Last Species",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "pickerLastCategory", {
    name: "Picker Last Category",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
}
