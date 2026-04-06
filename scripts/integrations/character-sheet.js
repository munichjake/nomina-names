/**
 * Character Sheet Integration
 * Adds Names Picker button to character sheets
 */

import { hasNamesGeneratorPermission } from '../utils/permissions.js';
import { NamesPickerApp } from '../apps/picker-app.js';
import { MODULE_ID } from '../shared/constants.js';

/**
 * Character Sheet Integration - adds Names Picker button next to name field
 * @param {ActorSheet} app - The rendered actor sheet
 * @param {jQuery} html - The sheet's HTML
 * @param {Object} data - The sheet's data
 */
export function registerCharacterSheetIntegration(app, html, data) {
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
}

/**
 * Token HUD integration - adds Names button to token HUD
 * Compatible with both Foundry VTT v12 and v13
 * @param {TokenHUD} app - The token HUD application
 * @param {jQuery|HTMLElement} html - The HUD's HTML
 * @param {Object} data - The HUD's data
 */
export function registerTokenHUDIntegration(app, html, data) {
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
      console.error("renderTokenHUD: Unexpected html parameter type", typeof html);
      return;
    }

    const button = $(`
      <div class="control-icon nomina-token-hud-btn" title="${game.i18n.localize("names.title")}">
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
      console.error("renderTokenHUD: Could not find .left panel");
    }
  } catch (error) {
    console.error("Error in renderTokenHUD hook", error);
  }
}

/**
 * Token Context Menu integration - adds Names option to token right-click menu
 * @param {jQuery} html - The context menu HTML
 * @param {Array} options - Array of context menu options
 */
export function registerTokenContextMenu(html, options) {
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
}

/**
 * Injects CSS styles for the Names Picker button
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
