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
 * Get a single category with subcategories
 */
export function getCategory(shopId, categoryId) {
    const db = getDatabase();

    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND shop_id = ?').get(categoryId, shopId);
    if (!category) return null;

    const subcategories = db.prepare(
        'SELECT * FROM subcategories WHERE category_id = ?'
    ).all(categoryId);

    return { ...category, subcategories };
}

/**
 * List all categories with subcategories
 */
export function listCategories(shopId) {
    const db = getDatabase();
    const categories = db.prepare('SELECT * FROM categories WHERE shop_id = ? ORDER BY name').all(shopId);

    return categories.map(cat => ({
        ...cat,
        subcategories: db.prepare(
            'SELECT * FROM subcategories WHERE category_id = ? ORDER BY name'
        ).all(cat.id)
    }));
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

    db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(categoryId);
    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    logAction(shopId, 'category', categoryId, 'DELETE', null, actorUserId);
}

/**
 * Create a subcategory
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} categoryId - Category UUID
 * @param {Object} data - Subcategory data
 * @param {string} actorUserId - User performing the action
 */
export function createSubcategory(shopId, categoryId, data, actorUserId) {
    const db = getDatabase();

    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND shop_id = ?').get(categoryId, shopId);
    if (!category) throw new Error('Category not found');

    const subcategoryId = generateUUID();

    // Sanitize name to prevent XSS
    const sanitizedName = sanitizeString(data.name);

    db.prepare(`
    INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)
  `).run(subcategoryId, categoryId, sanitizedName);

    logAction(shopId, 'subcategory', subcategoryId, 'CREATE', { name: sanitizedName }, actorUserId);

    return { id: subcategoryId, category_id: categoryId, name: sanitizedName };
}

/**
 * Delete a subcategory
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} subcategoryId - Subcategory UUID
 * @param {string} actorUserId - User performing the action
 */
export function deleteSubcategory(shopId, subcategoryId, actorUserId) {
    const db = getDatabase();

    const subcategory = db.prepare(`
        SELECT sc.id FROM subcategories sc
        JOIN categories c ON sc.category_id = c.id
        WHERE sc.id = ? AND c.shop_id = ?
    `).get(subcategoryId, shopId);

    if (!subcategory) throw new Error('Subcategory not found');

    db.prepare('DELETE FROM subcategories WHERE id = ?').run(subcategoryId);
    logAction(shopId, 'subcategory', subcategoryId, 'DELETE', null, actorUserId);
}
