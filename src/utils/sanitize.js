import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize a string value to prevent stored XSS
 * Strips all HTML tags and attributes
 * 
 * @param {string} value - String to sanitize
 * @returns {string|null} Sanitized string or null if input was null/undefined
 */
export function sanitizeString(value) {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value !== 'string') {
        return value;
    }

    // Strip all HTML tags - conservative approach to prevent any XSS
    return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'recursiveEscape'
    });
}

/**
 * Sanitize specific fields in an object
 * Returns a new object with sanitized fields
 * 
 * @param {Object} obj - Object to sanitize
 * @param {string[]} fields - Array of field names to sanitize
 * @returns {Object} New object with sanitized fields
 */
export function sanitizeObject(obj, fields) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const sanitized = { ...obj };

    for (const field of fields) {
        if (field in sanitized) {
            sanitized[field] = sanitizeString(sanitized[field]);
        }
    }

    return sanitized;
}
