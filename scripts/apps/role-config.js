/**
 * Role Configuration App - Manages user role permissions
 */

import { getAllUserRoles, getAffectedUsers, broadcastPermissionChange } from '../utils/permissions.js';
import { TEMPLATE_PATHS, MODULE_ID } from '../shared/constants.js';

export class NamesRoleConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-role-config",
      title: game.i18n.localize("names.roleConfig.title"),
      template: TEMPLATE_PATHS.roleConfig,
      width: 620,
      height: 550,
      closeOnSubmit: true,
      resizable: false
    });
  }

  getData() {
    const currentRoles = game.settings.get(MODULE_ID, "allowedUserRoles");
    const allRoles = getAllUserRoles();

    return {
      roles: allRoles.map(role => ({
        ...role,
        checked: currentRoles.includes(role.level) || role.level === CONST.USER_ROLES.GAMEMASTER
      }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.role-toggle').click(this._onRoleToggleClick.bind(this));
    html.find('input[type="checkbox"]').click(this._onCheckboxClick.bind(this));
    html.find('button[name="reset"]').click(this._onResetClick.bind(this));
  }

  _onRoleToggleClick(event) {
    const toggle = $(event.currentTarget);
    const checkbox = toggle.find('input[type="checkbox"]');
    
    if (toggle.hasClass('locked')) {
      return;
    }
    
    const wasChecked = checkbox.prop('checked');
    checkbox.prop('checked', !wasChecked);
    
    if (!wasChecked) {
      toggle.addClass('active');
    } else {
      toggle.removeClass('active');
    }
    
    event.preventDefault();
  }

  _onCheckboxClick(event) {
    event.stopPropagation();
    const checkbox = $(event.currentTarget);
    const toggle = checkbox.closest('.role-toggle');
    
    if (checkbox.prop('disabled')) {
      return;
    }
    
    if (checkbox.prop('checked')) {
      toggle.addClass('active');
    } else {
      toggle.removeClass('active');
    }
  }

  _onResetClick(event) {
    event.preventDefault();
    const defaultRoles = [CONST.USER_ROLES.GAMEMASTER];
    
    this.element.find('.role-toggle').each((i, toggle) => {
      const $toggle = $(toggle);
      const checkbox = $toggle.find('input[type="checkbox"]');
      const level = parseInt(checkbox.attr('name').replace('role_', ''));
      
      if (defaultRoles.includes(level)) {
        checkbox.prop('checked', true);
        $toggle.addClass('active');
      } else if (!$toggle.hasClass('locked')) {
        checkbox.prop('checked', false);
        $toggle.removeClass('active');
      }
    });
  }

  async _updateObject(event, formData) {
    const oldRoles = game.settings.get(MODULE_ID, "allowedUserRoles");
    const newAllowedRoles = [CONST.USER_ROLES.GAMEMASTER];
    
    // Collect all checked roles
    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('role_') && value) {
        const roleLevel = parseInt(key.replace('role_', ''));
        if (!newAllowedRoles.includes(roleLevel)) {
          newAllowedRoles.push(roleLevel);
        }
      }
    }

    // Save new settings
    await game.settings.set(MODULE_ID, "allowedUserRoles", newAllowedRoles);
    ui.notifications.info(game.i18n.localize("names.permissions-saved"));
    
    // Notify affected users
    const affectedUsers = getAffectedUsers(oldRoles, newAllowedRoles);
    if (affectedUsers.length > 0) {
      broadcastPermissionChange(affectedUsers);
    }
  }
}