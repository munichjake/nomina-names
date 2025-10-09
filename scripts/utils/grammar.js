/**
 * Grammar - Language rules handler for pp (preposition-article-noun) phrases
 * Implements the grammar system from JSON Format 4.0 specification
 */

import { logDebug, logWarn } from './logger.js';

/**
 * Build a pp (preposition + article + noun) phrase according to language rules
 * @param {Object} targetItem - The item to reference (must have t and optional gram)
 * @param {string} locale - Target language
 * @param {string} prep - Preposition (e.g., "an", "bei", "of")
 * @param {Object} langRules - Language rules from package
 * @returns {string} Formatted phrase
 */
export function buildPPPhrase(targetItem, locale, prep, langRules) {
  if (!targetItem || !targetItem.t) {
    throw new Error('PP Error: Target item must have text (t)');
  }

  // Get target text in requested locale
  const targetText = getLocalizedText(targetItem.t, locale);

  // If no preposition, just return the text
  if (!prep) {
    return targetText;
  }

  // Get language-specific rules
  const rules = langRules?.[locale];
  if (!rules) {
    logDebug(`No language rules for ${locale}, using simple preposition`);
    return `${prep} ${targetText}`;
  }

  // Determine grammatical case from preposition
  const gramCase = rules.prepCase?.[prep];
  if (!gramCase) {
    logDebug(`No case mapping for preposition "${prep}" in ${locale}`);
    return `${prep} ${targetText}`;
  }

  // Check item's grammar metadata
  const itemGrammar = targetItem.gram?.[locale];

  // If no article needed or specified
  if (!itemGrammar || itemGrammar.article === 'none') {
    const defaultBehavior = rules.defaults?.articleWhenNone || 'omit';
    if (defaultBehavior === 'omit') {
      return `${prep} ${targetText}`;
    }
  }

  // If definite article is needed
  if (itemGrammar && itemGrammar.article === 'def') {
    const gender = itemGrammar.gender;
    if (!gender) {
      logWarn(`Item has article="def" but no gender specified for ${locale}`);
      return `${prep} ${targetText}`;
    }

    // Lookup article
    const article = rules.articles?.def?.[gramCase]?.[gender];
    if (!article) {
      logWarn(`No definite article found for case=${gramCase}, gender=${gender} in ${locale}`);
      return `${prep} ${targetText}`;
    }

    // Build phrase
    let phrase = `${prep} ${article} ${targetText}`;

    // Apply contractions
    phrase = applyContractions(phrase, rules.contractions);

    return phrase;
  }

  // Default: preposition + text
  return `${prep} ${targetText}`;
}

/**
 * Get localized text from multilingual text object
 * @param {Object|string} textObj - Text object with locale keys or plain string
 * @param {string} locale - Target locale
 * @param {string} fallbackLocale - Fallback locale (optional)
 * @returns {string} Localized text
 */
export function getLocalizedText(textObj, locale, fallbackLocale = null) {
  // If already a string, return as-is
  if (typeof textObj === 'string') {
    return textObj;
  }

  // Try requested locale
  if (textObj[locale]) {
    return textObj[locale];
  }

  // Try fallback locale
  if (fallbackLocale && textObj[fallbackLocale]) {
    return textObj[fallbackLocale];
  }

  // Use first available locale
  const firstKey = Object.keys(textObj)[0];
  if (firstKey) {
    return textObj[firstKey];
  }

  throw new Error('No text available in any locale');
}

/**
 * Apply language-specific contractions
 * @param {string} phrase - Input phrase
 * @param {Object} contractions - Contraction rules (e.g., {"an dem": "am"})
 * @returns {string} Phrase with contractions applied
 */
function applyContractions(phrase, contractions) {
  if (!contractions) {
    return phrase;
  }

  let result = phrase;

  // Apply each contraction rule
  for (const [pattern, replacement] of Object.entries(contractions)) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Adapt title to match person's gender
 * @param {Object} titleItem - Title item from catalog
 * @param {string} personGender - Gender of the person (m/f/n)
 * @param {Object} langRules - Language rules
 * @param {string} locale - Target locale
 * @param {string} kase - Grammatical case (nom/gen/dat/akk or plain)
 * @returns {string} Gender-adapted title text
 */
export function adaptTitleToGender(titleItem, personGender, langRules, locale, kase = 'nom') {
  // Get title ID from attrs if available
  const titleId = titleItem.attrs?.titleId;

  if (!titleId) {
    logDebug('No titleId in attrs, using plain text');
    return getLocalizedText(titleItem.t, locale);
  }

  // Look up title forms in langRules
  const rules = langRules?.[locale];
  if (!rules || !rules.titles || !rules.titles[titleId]) {
    logWarn(`No title forms found for "${titleId}" in ${locale}`);
    return getLocalizedText(titleItem.t, locale);
  }

  const titleDef = rules.titles[titleId];
  const genderForms = titleDef.forms?.[personGender];

  if (!genderForms) {
    logWarn(`No forms for gender "${personGender}" in title "${titleId}"`);
    // Fallback to base gender
    const baseGender = titleItem.attrs?.baseGender || 'm';
    const fallbackForms = titleDef.forms?.[baseGender];
    if (fallbackForms) {
      return fallbackForms[kase] || fallbackForms.nom || fallbackForms.plain || '';
    }
    return getLocalizedText(titleItem.t, locale);
  }

  // Return form for requested case
  const defaultCase = rules.defaults?.defaultCase || 'nom';
  return genderForms[kase] || genderForms[defaultCase] || genderForms.plain || '';
}

/**
 * Validate language rules structure
 * @param {Object} langRules - Language rules object
 * @param {string} locale - Locale to validate
 * @returns {Object} Validation result {isValid, missing}
 */
export function validateLangRules(langRules, locale) {
  const missing = [];

  if (!langRules || !langRules[locale]) {
    return { isValid: false, missing: ['langRules'] };
  }

  const rules = langRules[locale];

  if (!rules.prepCase) {
    missing.push('prepCase');
  }

  if (!rules.articles) {
    missing.push('articles');
  } else if (!rules.articles.def) {
    missing.push('articles.def');
  }

  return {
    isValid: missing.length === 0,
    missing
  };
}
