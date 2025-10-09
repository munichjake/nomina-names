/**
 * Handlebars Helpers for Templates
 */

/**
 * Register all custom Handlebars helpers
 */
export function registerHandlebarsHelpers() {
  // Helper: upper - Convert text to uppercase
  Handlebars.registerHelper('upper', function(str) {
    return str ? String(str).toUpperCase() : '';
  });

  // Helper: capitalize - Capitalize first letter
  Handlebars.registerHelper('capitalize', function(str) {
    if (!str) return '';
    const s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  // Helper: includes - Check if array includes value
  Handlebars.registerHelper('includes', function(array, value) {
    if (!array || !Array.isArray(array)) return false;
    return array.includes(value);
  });

  // Helper: eq - Check equality (if not already registered by Foundry)
  if (!Handlebars.helpers.eq) {
    Handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });
  }
}
