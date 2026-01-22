/**
 * Null and undefined check utilities.
 * Provides consistent validation patterns throughout the codebase.
 *
 * @module utils/null-checks
 */

/**
 * Checks if a value is null or undefined.
 *
 * @param {*} value - The value to check
 * @returns {boolean} True if value is null or undefined, false otherwise
 *
 * @example
 * isNullOrUndefined(null); // true
 * isNullOrUndefined(undefined); // true
 * isNullOrUndefined(0); // false
 * isNullOrUndefined(''); // false
 * isNullOrUndefined(false); // false
 */
export function isNullOrUndefined(value) {
  return value === null || value === undefined;
}

/**
 * Ensures a value is not null or undefined. Throws an error if validation fails.
 *
 * @param {*} value - The value to validate
 * @param {string} [message='Value must not be null'] - Custom error message
 * @returns {*} The validated value (enables chaining)
 * @throws {Error} If value is null or undefined
 *
 * @example
 * const name = requireNonNull(getName(), 'Name is required');
 * const config = requireNonNull(config, 'Configuration must be provided');
 */
export function requireNonNull(value, message = 'Value must not be null') {
  if (isNullOrUndefined(value)) {
    throw new Error(message);
  }
  return value;
}

/**
 * Checks if a value is considered "empty" based on its type.
 * Empty means: null/undefined, empty string, empty array, or empty object.
 *
 * @param {*} value - The value to check
 * @returns {boolean} True if value is empty, false otherwise
 *
 * @example
 * isEmpty(null); // true
 * isEmpty(''); // true
 * isEmpty('   '); // true (whitespace is trimmed)
 * isEmpty([]); // true
 * isEmpty({}); // true
 * isEmpty([1]); // false
 * isEmpty('hello'); // false
 * isEmpty(0); // false (zero is not empty)
 * isEmpty(false); // false
 */
export function isEmpty(value) {
  if (isNullOrUndefined(value)) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Ensures a value is not empty. Throws an error if validation fails.
 *
 * @param {*} value - The value to validate
 * @param {string} [message='Value must not be empty'] - Custom error message
 * @returns {*} The validated value (enables chaining)
 * @throws {Error} If value is null, undefined, or empty
 *
 * @example
 * const name = requireNonEmpty(getName(), 'Name cannot be blank');
 * const list = requireNonEmpty(items, 'List must contain at least one item');
 */
export function requireNonEmpty(value, message = 'Value must not be empty') {
  if (isEmpty(value)) {
    throw new Error(message);
  }
  return value;
}
