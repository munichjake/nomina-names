/**
 * Gender Colors Configuration App - Manages gender color settings
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

    const genders = supportedGenders.map(gender => ({
      key: gender,
      label: game.i18n.localize(`names.genderColorsConfig.${gender}`),
      color: currentColors[gender] || DEFAULT_GENDER_COLORS[gender]
    }));

    return {
      genders,
      enabled,
      description: game.i18n.localize("names.genderColorsConfig.description")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Update preview when color changes
    html.find('input[type="color"]').on('input', this._onColorChange.bind(this));

    // Toggle enable/disable
    html.find('input[name="enabled"]').on('change', this._onEnableToggle.bind(this));

    // Reset button
    html.find('button[name="reset"]').click(this._onResetClick.bind(this));
  }

  _onEnableToggle(event) {
    const enabled = $(event.currentTarget).prop('checked');
    const colorsList = this.element.find('.gender-colors-list');
    if (enabled) {
      colorsList.removeClass('disabled');
    } else {
      colorsList.addClass('disabled');
    }
  }

  _onColorChange(event) {
    const input = $(event.currentTarget);
    const gender = input.attr('name').replace('color_', '');
    const color = input.val();

    // Update preview
    const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"]`);
    this._updatePreviewStyle(preview, color);
  }

  _updatePreviewStyle(previewEl, color) {
    // Create the same gradient effect as in the actual UI
    const $preview = $(previewEl);
    $preview.css({
      'background': `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
      'border-left': `3px solid ${color}`,
      'box-shadow': `inset 0 0 20px ${color}10`
    });
  }

  _onResetClick(event) {
    event.preventDefault();

    // Reset all color inputs to defaults
    for (const [gender, defaultColor] of Object.entries(DEFAULT_GENDER_COLORS)) {
      const input = this.element.find(`input[name="color_${gender}"]`);
      if (input.length) {
        input.val(defaultColor);
        const preview = this.element.find(`.gender-color-preview[data-gender="${gender}"]`);
        this._updatePreviewStyle(preview, defaultColor);
      }
    }
  }

  async _updateObject(event, formData) {
    const newColors = {};

    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('color_')) {
        const gender = key.replace('color_', '');
        newColors[gender] = value;
      }
    }

    // Merge with defaults to ensure all genders have a color
    const finalColors = { ...DEFAULT_GENDER_COLORS, ...newColors };

    // Save both settings
    await game.settings.set(MODULE_ID, "enableGenderColors", formData.enabled === true);
    await game.settings.set(MODULE_ID, "genderColors", finalColors);
    ui.notifications.info(game.i18n.localize("names.genderColorsConfig.saved"));
  }
}
