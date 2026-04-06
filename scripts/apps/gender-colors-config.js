/**
 * Gender Colors Configuration App - Manages gender color settings
 * Extended for Emergency Generator support
 */

import { TEMPLATE_PATHS, MODULE_ID, DEFAULT_GENDER_COLORS, getSupportedGenders } from '../shared/constants.js';

export class NamesGenderColorsConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "names-gender-colors-config",
      title: game.i18n.localize("names.genderColorsConfig.title"),
      template: TEMPLATE_PATHS.genderColorsConfig,
      width: 420,
      height: "auto",
      closeOnSubmit: true,
      resizable: false
    });
  }

  getData() {
    const currentColors = game.settings.get(MODULE_ID, "genderColors");
    const enabled = game.settings.get(MODULE_ID, "enableGenderColors");
    const supportedGenders = getSupportedGenders();

    // Main generator genders
    const genders = supportedGenders.map(gender => ({
      key: gender,
      label: game.i18n.localize(`names.genderColorsConfig.${gender}`),
      color: currentColors[gender] || DEFAULT_GENDER_COLORS[gender]
    }));

    // Emergency generator settings
    let emergencyColors = DEFAULT_GENDER_COLORS;
    let emergencyEnabled = false;

    try {
      emergencyColors = game.settings.get(MODULE_ID, "emergencyGenderColors") || DEFAULT_GENDER_COLORS;
      emergencyEnabled = game.settings.get(MODULE_ID, "enableEmergencyGenderColors") || false;
    } catch (error) {
      // Settings may not exist yet, use defaults
      console.debug("Names | Emergency gender color settings not found, using defaults");
    }

    // Emergency generator genders
    const emergencyGenders = supportedGenders.map(gender => ({
      key: gender,
      label: game.i18n.localize(`names.genderColorsConfig.${gender}`),
      color: emergencyColors[gender] || DEFAULT_GENDER_COLORS[gender]
    }));

    return {
      genders,
      enabled,
      emergencyGenders,
      emergencyEnabled,
      description: game.i18n.localize("names.genderColorsConfig.description")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Main generator: Update preview when color changes
    html.find('input[type="color"][data-section="main"]').on('input', this._onColorChange.bind(this));

    // Main generator: Toggle enable/disable
    html.find('input[name="enabled"]').on('change', this._onEnableToggle.bind(this));

    // Emergency generator: Update preview when color changes
    html.find('input[type="color"][data-section="emergency"]').on('input', this._onEmergencyColorChange.bind(this));

    // Emergency generator: Toggle enable/disable
    html.find('input[name="emergencyEnabled"]').on('change', this._onEmergencyEnableToggle.bind(this));

    // Copy from main button
    html.find('button[name="copyFromMain"]').click(this._onCopyFromMain.bind(this));

    // Reset button
    html.find('button[name="reset"]').click(this._onResetClick.bind(this));
  }

  /**
   * Handle main generator enable toggle
   * @param {Event} event - The change event
   */
  _onEnableToggle(event) {
    const enabled = $(event.currentTarget).prop('checked');
    const colorsList = this.element.find('.gender-colors-list.main-colors');
    if (enabled) {
      colorsList.removeClass('disabled');
    } else {
      colorsList.addClass('disabled');
    }
  }

  /**
   * Handle emergency generator enable toggle
   * @param {Event} event - The change event
   */
  _onEmergencyEnableToggle(event) {
    const enabled = $(event.currentTarget).prop('checked');
    const colorsList = this.element.find('.gender-colors-list.emergency-colors');
    if (enabled) {
      colorsList.removeClass('disabled');
    } else {
      colorsList.addClass('disabled');
    }
  }

  /**
   * Handle main generator color change
   * @param {Event} event - The input event
   */
  _onColorChange(event) {
    const input = $(event.currentTarget);
    const gender = input.attr('name').replace('color_', '');
    const color = input.val();

    // Update hex display
    input.siblings('.color-hex').text(color);

    // Update preview
    const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"][data-section="main"]`);
    this._updatePreviewStyle(preview, color);
  }

  /**
   * Handle emergency generator color change
   * @param {Event} event - The input event
   */
  _onEmergencyColorChange(event) {
    const input = $(event.currentTarget);
    const gender = input.attr('name').replace('emergency_color_', '');
    const color = input.val();

    // Update hex display
    input.siblings('.color-hex').text(color);

    // Update preview
    const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"][data-section="emergency"]`);
    this._updatePreviewStyle(preview, color);
  }

  /**
   * Copy colors from main generator to emergency generator
   * @param {Event} event - The click event
   */
  _onCopyFromMain(event) {
    event.preventDefault();

    const supportedGenders = getSupportedGenders();

    for (const gender of supportedGenders) {
      // Get color from main input
      const mainInput = this.element.find(`input[name="color_${gender}"]`);
      const mainColor = mainInput.val();

      // Set color to emergency input
      const emergencyInput = this.element.find(`input[name="emergency_color_${gender}"]`);
      if (emergencyInput.length && mainColor) {
        emergencyInput.val(mainColor);

        // Update hex display
        emergencyInput.siblings('.color-hex').text(mainColor);

        // Update preview
        const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"][data-section="emergency"]`);
        this._updatePreviewStyle(preview, mainColor);
      }
    }

    // Show success notification
    ui.notifications.info(game.i18n.localize("names.emergencyGenderColorsConfig.copiedSuccess"));
  }

  /**
   * Update the preview element style with the given color
   * @param {jQuery} previewEl - The preview element
   * @param {string} color - The hex color value
   */
  _updatePreviewStyle(previewEl, color) {
    // Create the same gradient effect as in the actual UI
    const $preview = $(previewEl);
    $preview.css({
      'background': `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
      'border-left': `3px solid ${color}`,
      'box-shadow': `inset 0 0 20px ${color}10`
    });
  }

  /**
   * Reset all colors to defaults
   * @param {Event} event - The click event
   */
  _onResetClick(event) {
    event.preventDefault();

    // Reset main generator colors
    for (const [gender, defaultColor] of Object.entries(DEFAULT_GENDER_COLORS)) {
      const input = this.element.find(`input[name="color_${gender}"]`);
      if (input.length) {
        input.val(defaultColor);
        input.siblings('.color-hex').text(defaultColor);
        const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"][data-section="main"]`);
        this._updatePreviewStyle(preview, defaultColor);
      }
    }

    // Reset emergency generator colors
    for (const [gender, defaultColor] of Object.entries(DEFAULT_GENDER_COLORS)) {
      const input = this.element.find(`input[name="emergency_color_${gender}"]`);
      if (input.length) {
        input.val(defaultColor);
        input.siblings('.color-hex').text(defaultColor);
        const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"][data-section="emergency"]`);
        this._updatePreviewStyle(preview, defaultColor);
      }
    }
  }

  /**
   * Process form submission and save settings
   * @param {Event} event - The submit event
   * @param {Object} formData - The form data
   */
  async _updateObject(event, formData) {
    const newColors = {};
    const newEmergencyColors = {};

    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('emergency_color_')) {
        const gender = key.replace('emergency_color_', '');
        newEmergencyColors[gender] = value;
      } else if (key.startsWith('color_')) {
        const gender = key.replace('color_', '');
        newColors[gender] = value;
      }
    }

    // Merge with defaults to ensure all genders have a color
    const finalColors = { ...DEFAULT_GENDER_COLORS, ...newColors };
    const finalEmergencyColors = { ...DEFAULT_GENDER_COLORS, ...newEmergencyColors };

    // Save main generator settings
    await game.settings.set(MODULE_ID, "enableGenderColors", formData.enabled === true);
    await game.settings.set(MODULE_ID, "genderColors", finalColors);

    // Save emergency generator settings
    await game.settings.set(MODULE_ID, "enableEmergencyGenderColors", formData.emergencyEnabled === true);
    await game.settings.set(MODULE_ID, "emergencyGenderColors", finalEmergencyColors);

    ui.notifications.info(game.i18n.localize("names.genderColorsConfig.saved"));
  }
}
