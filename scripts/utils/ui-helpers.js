/**
 * UI helper utilities for the Names module
 */

import { hasNamesGeneratorPermission } from './permissions.js';
import { CSS_CLASSES, MODULE_ID } from '../shared/constants.js';
import { logWarn, logError, logInfo, logDebug } from './logger.js';

/**
 * Shows loading state in a container
 * @param {jQuery} html - Container element
 * @param {string} message - Loading message
 */
export function showLoadingState(html, message = null) {
  const loadingMessage = message || game.i18n.localize("names.loading-data") || "Lade Namen-Daten...";
  
  html.find('.names-module-form, .names-picker-content, .emergency-content').hide();
  
  if (!html.find('.names-loading-indicator, .names-picker-loading, .emergency-loading').length) {
    html.find('.window-content').prepend(`
      <div class="${CSS_CLASSES.loadingIndicator}" style="text-align: center; padding: 50px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2em; color: #ff6400;"></i>
        <p style="margin-top: 15px;">${loadingMessage}</p>
      </div>
    `);
  }
}

/**
 * Hides loading state and shows content
 * @param {jQuery} html - Container element
 */
export function hideLoadingState(html) {
  html.find('.names-loading-indicator, .names-picker-loading, .emergency-loading').hide();
  html.find('.names-module-form, .names-picker-content, .emergency-content').show();
}

/**
 * Copies text to clipboard with fallback
 * @param {string} text - Text to copy
 * @param {string} successMessage - Success notification message
 */
export async function copyToClipboard(text, successMessage = null) {
  const message = successMessage || game.i18n.localize("names.copied");
  
  try {
    await navigator.clipboard.writeText(text);
    ui.notifications.info(message);
  } catch (error) {
    logWarn("Clipboard API failed, using fallback", error);
    fallbackCopyToClipboard(text, message);
  }
}

/**
 * Fallback clipboard method for older browsers
 * @param {string} text - Text to copy
 * @param {string} successMessage - Success notification message
 */
export function fallbackCopyToClipboard(text, successMessage = null) {
  const message = successMessage || game.i18n.localize("names.copied");
  const errorMessage = game.i18n.localize("names.copy-error") || "Kopieren fehlgeschlagen";
  
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    ui.notifications.info(message);
  } catch (error) {
    logError("Fallback copy failed", error);
    ui.notifications.error(errorMessage);
  }

  document.body.removeChild(textArea);
}

/**
 * Injects the emergency names button into the chat
 * Compatible with Foundry v12 and v13 using native DOM API
 */
export function injectEmergencyButton() {
  // Check settings
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) {
    removeEmergencyButton();
    return;
  }

  // Remove existing button if present
  if (document.getElementById('emergency-names-button')) {
    document.getElementById('emergency-names-button').remove();
  }

  // Get the chat input element for reliable positioning
  const inputElement = document.getElementById("chat-message");

  if (!inputElement) {
    logWarn("Could not find chat-message input for emergency button");
    return;
  }

  // Create button HTML
  const buttonHTML = `
    <div id="emergency-names-button" class="${CSS_CLASSES.emergencyButton}" title="${game.i18n.localize("names.emergency.tooltip") || "Schnelle NPC-Namen"}">
      <i class="fas fa-user-friends"></i>
      <span>${game.i18n.localize("names.emergency.button") || "NPC Namen"}</span>
    </div>
  `;

  // Inject button after chat input using native DOM API for better performance
  inputElement.insertAdjacentHTML("afterend", buttonHTML);

  // Get the injected button and add event listeners
  const emergencyButton = document.getElementById('emergency-names-button');

  if (!emergencyButton) {
    logWarn("Failed to create emergency button");
    return;
  }

  // Add click handler
  emergencyButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    logDebug("Emergency button clicked");

    try {
      if (hasNamesGeneratorPermission()) {
        // Import and create app dynamically
        import('../apps/emergency-app.js').then(({ EmergencyNamesApp }) => {
          new EmergencyNamesApp().render(true);
        }).catch(error => {
          logError("Failed to import EmergencyNamesApp", error);
          ui.notifications.error("Fehler beim Laden des Namen-Generators");
        });
      } else {
        ui.notifications.warn(game.i18n.localize("names.no-permission") || "Keine Berechtigung");
      }
    } catch (error) {
      logError("Failed to open Emergency Names App", error);
      ui.notifications.error("Fehler beim Öffnen des Namen-Generators");
    }
  });

  // Additional event handler for better compatibility
  emergencyButton.addEventListener('mousedown', (event) => {
    event.preventDefault();
    logDebug("Emergency button mousedown");
  });

  // Add CSS if not present
  injectEmergencyButtonCSS();

  logInfo("Emergency button injected");
}

/**
 * Removes the emergency names button from chat
 */
export function removeEmergencyButton() {
  const button = document.getElementById('emergency-names-button');
  if (button) {
    button.remove();
    logInfo("Emergency button removed");
  }
}

/**
 * Moves the emergency button to the correct position
 * Used when chat is popped out, collapsed, or repositioned
 */
export function moveEmergencyButton() {
  const button = document.getElementById('emergency-names-button');
  const inputElement = document.getElementById("chat-message");

  if (button && inputElement) {
    inputElement.insertAdjacentElement("afterend", button);
    logDebug("Emergency button repositioned");
  }
}

/**
 * Injects CSS for the emergency button
 */
function injectEmergencyButtonCSS() {
  if (!$('#emergency-names-button-style').length) {
    $('head').append(`
      <style id="emergency-names-button-style">
        #emergency-names-button, .${CSS_CLASSES.emergencyButton} {
          background: linear-gradient(135deg, #ff6400 0%, #ff8533 100%);
          border: 1px solid #e55a00;
          border-radius: 6px;
          color: white;
          padding: 2em;
          margin: 0.5em 0;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 100;
          user-select: none;
          pointer-events: auto;
        }

        #emergency-names-button:hover, .${CSS_CLASSES.emergencyButton}:hover {
          background: linear-gradient(135deg, #ff8533 0%, #ffaa66 100%);
          box-shadow: 0 4px 8px rgba(255, 100, 0, 0.3);
          transform: translateY(-1px);
        }

        #emergency-names-button:active, .${CSS_CLASSES.emergencyButton}:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        #emergency-names-button i, .${CSS_CLASSES.emergencyButton} i {
          font-size: 14px;
          pointer-events: none;
        }

        #emergency-names-button span, .${CSS_CLASSES.emergencyButton} span {
          pointer-events: none;
        }
      </style>
    `);
  }
}

/**
 * Gets actor species for names generation
 * @param {Actor} actor - The actor to analyze
 * @param {Object} speciesConfig - Species configuration
 * @returns {string} Detected species
 */
export function getActorSpecies(actor, speciesConfig = null) {
  if (!actor) return null;

  const actorData = actor.system || actor.data?.data || {};
  
  if (speciesConfig) {
    const searchFields = speciesConfig.searchFields;
    
    for (const field of searchFields) {
      const value = foundry.utils.getProperty(actorData, field);
      if (value) {
        const normalized = value.toString().toLowerCase();
        
        for (const [species, config] of Object.entries(speciesConfig.speciesMappings)) {
          for (const keyword of config.keywords) {
            if (normalized.includes(keyword.toLowerCase())) {
              return species;
            }
          }
        }
      }
    }
    
    return speciesConfig.defaultSpecies;
  } else {
    // Fallback mapping
    const raceFields = ['race', 'species', 'ancestry', 'details.race', 'details.species'];
    
    for (const field of raceFields) {
      const value = foundry.utils.getProperty(actorData, field);
      if (value) {
        const normalized = value.toString().toLowerCase();
        const raceMapping = {
          'human': 'human',
          'mensch': 'human',
          'elf': 'elf',
          'elfe': 'elf',
          'dwarf': 'dwarf',
          'zwerg': 'dwarf',
          'halfling': 'halfling',
          'halbling': 'halfling'
        };

        for (const [key, mapped] of Object.entries(raceMapping)) {
          if (normalized.includes(key)) {
            return mapped;
          }
        }
      }
    }
    
    return 'human';
  }
}

/**
 * Updates actor name and associated tokens
 * @param {Actor} actor - Actor to update
 * @param {string} name - New name
 */
export async function updateActorName(actor, name) {
  if (!actor) return;

  await actor.update({ name: name });

  const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor.id);
  for (const token of tokens) {
    await token.document.update({ name: name });
  }

  if (actor.prototypeToken) {
    await actor.update({
      "prototypeToken.name": name
    });
  }
}