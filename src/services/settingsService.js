// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { logAction } from './auditService.js';

/**
 * Get a setting value for a shop
 */
export function getSetting(shopId, key) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value_json FROM settings WHERE shop_id = ? AND key = ?');
    const result = stmt.get(shopId, key);

    if (!result) return null;
    return JSON.parse(result.value_json);
}

/**
 * Set a setting value for a shop
 * @param {string} shopId - Shop UUID
 * @param {string} key - Setting key
 * @param {*} value - Value to store
 * @param {string} actorUserId - User performing the action
 */
export function setSetting(shopId, key, value, actorUserId) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO settings (shop_id, key, value_json) VALUES (?, ?, ?)
    ON CONFLICT(shop_id, key) DO UPDATE SET value_json = excluded.value_json
  `);

    stmt.run(shopId, key, JSON.stringify(value));
    logAction(shopId, 'setting', key, 'UPDATE', { value }, actorUserId);
}

/**
 * Get all settings for a shop
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
 * @param {string} actorUserId - User performing the action
 */
export function deleteSetting(shopId, key, actorUserId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM settings WHERE shop_id = ? AND key = ?');
    stmt.run(shopId, key);
    logAction(shopId, 'setting', key, 'DELETE', null, actorUserId);
}
