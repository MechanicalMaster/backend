import { getDatabase } from '../db/init.js';

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @returns {*} Parsed setting value or null
 */
export function getSetting(key) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
    const result = stmt.get(key);

    if (!result) {
        return null;
    }

    return JSON.parse(result.value_json);
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Value to store (will be JSON stringified)
 */
export function setSetting(key, value) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO settings (key, value_json) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `);

    stmt.run(key, JSON.stringify(value));
}

/**
 * Get all settings
 * @returns {Object} Key-value pairs of all settings
 */
export function getAllSettings() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT key, value_json FROM settings');
    const rows = stmt.all();

    const settings = {};
    rows.forEach(row => {
        settings[row.key] = JSON.parse(row.value_json);
    });

    return settings;
}

/**
 * Delete a setting
 * @param {string} key - Setting key to delete
 */
export function deleteSetting(key) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
    stmt.run(key);
}
