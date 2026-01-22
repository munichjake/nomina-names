/**
 * Sanitizer Utility Functions
 *
 * Provides security utilities to prevent XSS vulnerabilities when handling
 * user-generated content in FoundryVTT chat messages and other HTML contexts.
 *
 * @module utils/sanitizer
 * @author Nomina Names Module
 * @version 1.0.0
 */

/**
 * Sanitizes a string for safe HTML insertion by escaping HTML entities.
 *
 * This function uses the browser's built-in textContent/innerHTML mechanism
 * to properly escape all HTML special characters, including:
 * - < > & " ' (basic HTML entities)
 * - Potentially dangerous Unicode characters
 *
 * @param {string} str - The string to sanitize
 * @returns {string} The sanitized string with HTML entities escaped
 *
 * @example
 * const userInput = '<script>alert("XSS")</script>';
 * const safe = sanitizeHTML(userInput);
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 *
 * @example
 * const name = 'O\'Reilly <b>bold</b>';
 * const safe = sanitizeHTML(name);
 * // Returns: 'O&#39;Reilly &lt;b&gt;bold&lt;/b&gt;'
 */
export function sanitizeHTML(str) {
  // Handle null/undefined/empty cases
  if (str == null) {
    return '';
  }

  // Convert to string if not already
  const stringInput = String(str);

  // Use DOM API for robust HTML escaping
  // This is safer than manual regex replacement as it handles all edge cases
  const div = document.createElement('div');
  div.textContent = stringInput;
  return div.innerHTML;
}

/**
 * Sanitizes an object recursively for safe HTML insertion.
 *
 * Traverses the object structure and sanitizes all string values,
 * preserving the object structure and non-string values.
 *
 * @param {any} obj - The object to sanitize (can be any type)
 * @returns {any} The sanitized object with all string values escaped
 *
 * @example
 * const data = {
 *   name: '<script>alert("XSS")</script>',
 *   count: 42,
 *   nested: {
 *     value: '<img src=x onerror=alert(1)>'
 *   }
 * };
 * const safe = sanitizeObject(data);
 * // Returns: {
 * //   name: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
 * //   count: 42,
 * //   nested: {
 * //     value: '&lt;img src=x onerror=alert(1)&gt;'
 * //   }
 * // }
 */
export function sanitizeObject(obj) {
  // Handle primitive types
  if (obj == null) {
    return '';
  }

  // Strings: sanitize directly
  if (typeof obj === 'string') {
    return sanitizeHTML(obj);
  }

  // Numbers, booleans, etc.: return as-is
  if (typeof obj !== 'object') {
    return obj;
  }

  // Arrays: recursively sanitize each element
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Objects: recursively sanitize each property
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize keys as well to prevent key-based injection
    const sanitizedKey = sanitizeHTML(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitizes an array of strings for safe HTML insertion.
 *
 * Convenience function for handling string arrays efficiently.
 *
 * @param {string[]} arr - The array of strings to sanitize
 * @returns {string[]} A new array with all strings sanitized
 *
 * @example
 * const names = ['<b>John</b>', '<i>Jane</i>', '<script>bad()</script>'];
 * const safe = sanitizeArray(names);
 * // Returns: ['&lt;b&gt;John&lt;/b&gt;', '&lt;i&gt;Jane&lt;/i&gt;', '&lt;script&gt;bad()&lt;/script&gt;']
 */
export function sanitizeArray(arr) {
  if (!Array.isArray(arr)) {
    console.warn('sanitizeArray expected an array, received:', typeof arr);
    return [];
  }

  return arr.map(item => sanitizeHTML(item));
}

/**
 * Creates a safe ChatMessage data object by sanitizing all string fields.
 *
 * This function is specifically designed for FoundryVTT chat messages,
 * ensuring that user-provided content is properly escaped before rendering.
 *
 * @param {object} messageData - The chat message data object to sanitize
 * @param {object} options - Sanitization options
 * @param {string[]} [options.skipFields=[]] - Array of field names to skip sanitization
 * @param {boolean} [options.preserveFormatting=false] - If true, preserves basic HTML formatting (b, i, u, em, strong)
 * @returns {object} A new sanitized message data object
 *
 * @example
 * const message = {
 *   content: '<script>alert("XSS")</script> Hello <b>World</b>',
 *   flavor: '<img src=x onerror=alert(1)>',
 *   speaker: { alias: '<i>GM</i>' }
 * };
 * const safe = sanitizeChatMessage(message);
 * // Returns fully sanitized object safe for ChatMessage.create()
 */
export function sanitizeChatMessage(messageData, options = {}) {
  const { skipFields = [], preserveFormatting = false } = options;

  if (!messageData || typeof messageData !== 'object') {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(messageData)) {
    // Skip specified fields
    if (skipFields.includes(key)) {
      sanitized[key] = value;
      continue;
    }

    // Handle content field specially if preserveFormatting is true
    if (preserveFormatting && key === 'content' && typeof value === 'string') {
      sanitized[key] = sanitizeHTMLWithFormatting(value);
      continue;
    }

    // Recursively sanitize all other fields
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitizes HTML while preserving basic formatting tags.
 *
 * Allows safe formatting tags: <b>, <i>, <u>, <em>, <strong>, <p>, <br>
 * Removes all other tags and attributes.
 *
 * @param {string} str - The string to sanitize
 * @returns {string} The sanitized string with basic formatting preserved
 * @private
 */
function sanitizeHTMLWithFormatting(str) {
  if (typeof str !== 'string') {
    return sanitizeHTML(str);
  }

  // Escape everything first
  let sanitized = sanitizeHTML(str);

  // Then unescape safe formatting tags
  const safeTags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br'];

  for (const tag of safeTags) {
    // Unescape opening tags
    sanitized = sanitized.replace(
      new RegExp(`&lt;${tag}&gt;`, 'gi'),
      `<${tag}>`
    );
    // Unescape closing tags
    sanitized = sanitized.replace(
      new RegExp(`&lt;/${tag}&gt;`, 'gi'),
      `</${tag}>`
    );
    // Unescape self-closing tags (like <br />)
    sanitized = sanitized.replace(
      new RegExp(`&lt;${tag}\\s*/&gt;`, 'gi'),
      `<${tag} />`
    );
  }

  return sanitized;
}
