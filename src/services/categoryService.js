// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { logAction } from './auditService.js';

/**
 * Create a new category
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Category data
 */
export function createCategory(shopId, data) {
    const db = getDatabase();
    const categoryId = generateUUID();

    db.prepare(`
    INSERT INTO categories (id, shop_id, name, type) VALUES (?, ?, ?, ?)
  `).run(categoryId, shopId, data.name, data.type);

    logAction(shopId, 'category', categoryId, 'CREATE', { name: data.name });

    return getCategory(shopId, categoryId);
}

/**
 * Get a single category with subcategories
 * @param {string} shopId - Shop UUID
 * @param {string} categoryId - Category UUID
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
 * @param {string} shopId - Shop UUID
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
 */
export function updateCategory(shopId, categoryId, data) {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE categories SET name = ?, type = ? WHERE id = ? AND shop_id = ?'
    ).run(data.name, data.type, categoryId, shopId);

    if (result.changes === 0) throw new Error('Category not found');
    logAction(shopId, 'category', categoryId, 'UPDATE');
    return getCategory(shopId, categoryId);
}

/**
 * Delete a category
 * @param {string} shopId - Shop UUID
 * @param {string} categoryId - Category UUID
 */
export function deleteCategory(shopId, categoryId) {
    const db = getDatabase();

    // Verify category belongs to shop
    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND shop_id = ?').get(categoryId, shopId);
    if (!category) throw new Error('Category not found');

    // Also delete subcategories
    db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(categoryId);
    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    logAction(shopId, 'category', categoryId, 'DELETE');
}

/**
 * Create a subcategory
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} categoryId - Category UUID
 * @param {Object} data - Subcategory data
 */
export function createSubcategory(shopId, categoryId, data) {
    const db = getDatabase();

    // Verify category belongs to shop
    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND shop_id = ?').get(categoryId, shopId);
    if (!category) throw new Error('Category not found');

    const subcategoryId = generateUUID();

    db.prepare(`
    INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)
  `).run(subcategoryId, categoryId, data.name);

    logAction(shopId, 'subcategory', subcategoryId, 'CREATE', { name: data.name });

    return { id: subcategoryId, category_id: categoryId, name: data.name };
}

/**
 * Delete a subcategory
 * @param {string} shopId - Shop UUID (for validation)
 * @param {string} subcategoryId - Subcategory UUID
 */
export function deleteSubcategory(shopId, subcategoryId) {
    const db = getDatabase();

    // Verify subcategory belongs to a category in this shop
    const subcategory = db.prepare(`
        SELECT sc.id FROM subcategories sc
        JOIN categories c ON sc.category_id = c.id
        WHERE sc.id = ? AND c.shop_id = ?
    `).get(subcategoryId, shopId);

    if (!subcategory) throw new Error('Subcategory not found');

    db.prepare('DELETE FROM subcategories WHERE id = ?').run(subcategoryId);
    logAction(shopId, 'subcategory', subcategoryId, 'DELETE');
}
