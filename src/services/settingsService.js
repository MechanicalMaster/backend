// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';

/**
 * Get a setting value for a shop
 * @param {string} shopId - Shop UUID
 * @param {string} key - Setting key
 * @returns {*} Parsed setting value or null
 */
export function getSetting(shopId, key) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value_json FROM settings WHERE shop_id = ? AND key = ?');
    const result = stmt.get(shopId, key);

    if (!result) {
        return null;
    }

    return JSON.parse(result.value_json);
}

/**
 * Set a setting value for a shop
 * @param {string} shopId - Shop UUID
 * @param {string} key - Setting key
 * @param {*} value - Value to store (will be JSON stringified)
 */
export function setSetting(shopId, key, value) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO settings (shop_id, key, value_json) VALUES (?, ?, ?)
    ON CONFLICT(shop_id, key) DO UPDATE SET value_json = excluded.value_json
  `);

    stmt.run(shopId, key, JSON.stringify(value));
}

/**
 * Get all settings for a shop
 * @param {string} shopId - Shop UUID
 * @returns {Object} Key-value pairs of all settings
 */
export function getAllSettings(shopId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT key, value_json FROM settings WHERE shop_id = ?');
    const rows = stmt.all(shopId);

    const settings = {};
    rows.forEach(row => {
        settings[row.key] = JSON.parse(row.value_json);
    });

    return settings;
}

/**
 * Delete a setting for a shop
 * @param {string} shopId - Shop UUID
 * @param {string} key - Setting key to delete
 */
export function deleteSetting(shopId, key) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM settings WHERE shop_id = ? AND key = ?');
    stmt.run(shopId, key);
}
