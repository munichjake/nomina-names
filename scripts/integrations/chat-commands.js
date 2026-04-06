/**
 * Chat Commands Integration
 * Handles slash commands for Names module
 */

import { hasNamesGeneratorPermission } from '../utils/permissions.js';
import { NamesGeneratorApp } from '../apps/generator-app.js';
import { NamesPickerApp } from '../apps/picker-app.js';
import { EmergencyNamesApp } from '../apps/emergency-app.js';
import { NamesHistoryApp } from '../apps/history-app.js';

/**
 * Chat Commands integration - handles slash commands for Names module
 * @param {jQuery} html - The chat message HTML
 * @param {string} content - The message content
 * @param {Object} msg - The message data
 * @returns {boolean} False to prevent message from being sent
 */
export function registerChatCommands(html, content, msg) {
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

  if (content === '/history' || content === '/namen-history') {
    new NamesHistoryApp().render(true);
    return false;
  }
}
