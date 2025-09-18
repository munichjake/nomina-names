/**
 * Permission utilities for the Names module
 */

import { MODULE_ID } from '../shared/constants.js';

/**
 * Checks if the current user has permission to use the names generator
 * @returns {boolean}
 */
export function hasNamesGeneratorPermission() {
  try {
    const allowedRoles = game.settings.get(MODULE_ID, "allowedUserRoles") || [CONST.USER_ROLES.GAMEMASTER];
    const userRole = game.user.role;
    
    return allowedRoles.includes(userRole);
  } catch (error) {
    console.warn("Names Module: Permission check failed, defaulting to GM only:", error);
    return game.user.role === CONST.USER_ROLES.GAMEMASTER;
  }
}

/**
 * Gets all available user roles for configuration
 * @returns {Array} Array of role objects
 */
export function getAllUserRoles() {
  return [
    { level: CONST.USER_ROLES.PLAYER, name: "PLAYER", key: "PLAYER" },
    { level: CONST.USER_ROLES.TRUSTED, name: "TRUSTED", key: "TRUSTED" },
    { level: CONST.USER_ROLES.ASSISTANT, name: "ASSISTANT", key: "ASSISTANT" },
    { level: CONST.USER_ROLES.GAMEMASTER, name: "GAMEMASTER", key: "GAMEMASTER" }
  ];
}

/**
 * Gets users affected by role permission changes
 * @param {Array} oldRoles - Previous allowed roles
 * @param {Array} newRoles - New allowed roles  
 * @returns {Array} Array of affected user IDs
 */
export function getAffectedUsers(oldRoles, newRoles) {
  const affectedUsers = [];
  
  for (const user of game.users) {
    const hadPermission = oldRoles.includes(user.role);
    const hasPermission = newRoles.includes(user.role);
    
    if (hadPermission !== hasPermission) {
      affectedUsers.push(user.id);
    }
  }
  
  return affectedUsers;
}

/**
 * Broadcasts permission changes to affected users
 * @param {Array} affectedUserIds - IDs of affected users
 */
export function broadcastPermissionChange(affectedUserIds) {
  if (affectedUserIds.length > 0) {
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "permissionChanged",
      affectedUsers: affectedUserIds
    });
  }
}

/**
 * Shows permission change notification dialog
 */
export function showPermissionChangeDialog() {
  new Dialog({
    title: game.i18n.localize("names.permissionChange.title") || "Berechtigung geändert",
    content: `
      <div style="text-align: center; padding: 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2em; color: #ff6400; margin-bottom: 15px;"></i>
        <p>${game.i18n.localize("names.permissionChange.content") || "Deine Namen-Generator Berechtigung wurde vom Spielleiter geändert. Ein Reload der Seite ist erforderlich, damit die Änderungen wirksam werden."}</p>
      </div>
    `,
    buttons: {
      reload: {
        icon: '<i class="fas fa-sync-alt"></i>',
        label: game.i18n.localize("names.permissionChange.reload") || "Seite neu laden",
        callback: () => location.reload()
      },
      later: {
        icon: '<i class="fas fa-clock"></i>',
        label: game.i18n.localize("names.permissionChange.later") || "Später",
        callback: () => {}
      }
    },
    default: "reload"
  }, {
    width: 400,
    height: 200
  }).render(true);
}