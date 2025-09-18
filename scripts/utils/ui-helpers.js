/**
 * UI helper utilities for the Names module
 */

import { hasNamesGeneratorPermission } from './permissions.js';
import { CSS_CLASSES, MODULE_ID } from '../shared/constants.js';

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
    console.warn("Names Module: Clipboard API failed, using fallback:", error);
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
    console.error("Names Module: Fallback copy failed:", error);
    ui.notifications.error(errorMessage);
  }

  document.body.removeChild(textArea);
}

/**
 * Injects the emergency names button into the chat
 */
export function injectEmergencyButton() {
  // Check settings
  if (!game.settings.get(MODULE_ID, "showEmergencyButton")) {
    removeEmergencyButton();
    return;
  }

  // Check if button already exists
  if ($('#emergency-names-button').length > 0) {
    return;
  }

  // Find chat elements
  const chatLog = $('#chat-log');
  const chatForm = $('#chat-form');
  
  if (chatLog.length === 0 || chatForm.length === 0) {
    return;
  }

  // Create button
  const emergencyButton = $(`
    <div id="emergency-names-button" class="${CSS_CLASSES.emergencyButton}" title="${game.i18n.localize("names.emergency.tooltip") || "Schnelle NPC-Namen"}">
      <i class="fas fa-user-friends"></i>
      <span>${game.i18n.localize("names.emergency.button") || "NPC Namen"}</span>
    </div>
  `);

  // Add click handler
  emergencyButton.click(() => {
    try {
      if (hasNamesGeneratorPermission()) {
        // Import and create app dynamically
        import('../apps/emergency-app.js').then(({ EmergencyNamesApp }) => {
          new EmergencyNamesApp().render(true);
        });
      } else {
        ui.notifications.warn(game.i18n.localize("names.no-permission") || "Keine Berechtigung");
      }
    } catch (error) {
      console.error("Names Module: Failed to open Emergency Names App:", error);
      ui.notifications.error("Fehler beim Öffnen des Namen-Generators");
    }
  });

  // Insert button
  chatLog.after(emergencyButton);
  
  // Add CSS if not present
  injectEmergencyButtonCSS();
  
  console.log("Names Module: Emergency button injected");
}

/**
 * Removes the emergency names button from chat
 */
export function removeEmergencyButton() {
  $('#emergency-names-button').remove();
  console.log("Names Module: Emergency button removed");
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
          padding: 8px 16px;
          margin: 10px;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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