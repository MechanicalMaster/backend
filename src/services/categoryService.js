// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { logAction } from './auditService.js';
import { sanitizeString } from '../utils/sanitize.js';

/**
 * Create a new category
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Category data
 * @param {string} actorUserId - User performing the action
 */
export function createCategory(shopId, data, actorUserId) {
    const db = getDatabase();
    const categoryId = generateUUID();

    // Sanitize name to prevent XSS
    const sanitizedName = sanitizeString(data.name);

    db.prepare(`
    INSERT INTO categories (id, shop_id, name, type) VALUES (?, ?, ?, ?)
  `).run(categoryId, shopId, sanitizedName, data.type);

    logAction(shopId, 'category', categoryId, 'CREATE', { name: sanitizedName }, actorUserId);

    return getCategory(shopId, categoryId);
}

/**
 * Get a single category
 */
export function getCategory(shopId, categoryId) {
    const db = getDatabase();

    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND shop_id = ?').get(categoryId, shopId);
    if (!category) return null;

    return category;
}

/**
 * List all categories
 */
export function listCategories(shopId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE shop_id = ? ORDER BY name').all(shopId);
}

/**
 * Update a category
 * @param {string} shopId - Shop UUID
 * @param {string} categoryId - Category UUID
 * @param {Object} data - Update data
 * @param {string} actorUserId - User performing the action
 */
export function updateCategory(shopId, categoryId, data, actorUserId) {
    const db = getDatabase();

    // Sanitize name to prevent XSS
    const sanitizedName = sanitizeString(data.name);

    const result = db.prepare(
        'UPDATE categories SET name = ?, type = ? WHERE id = ? AND shop_id = ?'
    ).run(sanitizedName, data.type, categoryId, shopId);

    if (result.changes === 0) throw new Error('Category not found');
    logAction(shopId, 'category', categoryId, 'UPDATE', null, actorUserId);
    return getCategory(shopId, categoryId);
}

/**
 * Delete a category
 * @param {string} shopId - Shop UUID
 * @param {string} categoryId - Category UUID
 * @param {string} actorUserId - User performing the action
 */
export function deleteCategory(shopId, categoryId, actorUserId) {
    const db = getDatabase();

    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND shop_id = ?').get(categoryId, shopId);
    if (!category) throw new Error('Category not found');

    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    logAction(shopId, 'category', categoryId, 'DELETE', null, actorUserId);
}
