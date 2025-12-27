import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { logAction } from './auditService.js';

/**
 * Create a new category
 */
export function createCategory(data) {
    const db = getDatabase();
    const categoryId = generateUUID();

    db.prepare(`
    INSERT INTO categories (id, name, type) VALUES (?, ?, ?)
  `).run(categoryId, data.name, data.type);

    logAction('category', categoryId, 'CREATE', { name: data.name });

    return getCategory(categoryId);
}

/**
 * Get a single category with subcategories
 */
export function getCategory(categoryId) {
    const db = getDatabase();

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!category) return null;

    const subcategories = db.prepare(
        'SELECT * FROM subcategories WHERE category_id = ?'
    ).all(categoryId);

    return { ...category, subcategories };
}

/**
 * List all categories with subcategories
 */
export function listCategories() {
    const db = getDatabase();
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();

    return categories.map(cat => ({
        ...cat,
        subcategories: db.prepare(
            'SELECT * FROM subcategories WHERE category_id = ? ORDER BY name'
        ).all(cat.id)
    }));
}

/**
 * Update a category
 */
export function updateCategory(categoryId, data) {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE categories SET name = ?, type = ? WHERE id = ?'
    ).run(data.name, data.type, categoryId);

    if (result.changes === 0) throw new Error('Category not found');
    logAction('category', categoryId, 'UPDATE');
    return getCategory(categoryId);
}

/**
 * Delete a category
 */
export function deleteCategory(categoryId) {
    const db = getDatabase();
    // Also delete subcategories
    db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(categoryId);
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    if (result.changes === 0) throw new Error('Category not found');
    logAction('category', categoryId, 'DELETE');
}

/**
 * Create a subcategory
 */
export function createSubcategory(categoryId, data) {
    const db = getDatabase();
    const subcategoryId = generateUUID();

    db.prepare(`
    INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)
  `).run(subcategoryId, categoryId, data.name);

    logAction('subcategory', subcategoryId, 'CREATE', { name: data.name });

    return { id: subcategoryId, category_id: categoryId, name: data.name };
}

/**
 * Delete a subcategory
 */
export function deleteSubcategory(subcategoryId) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM subcategories WHERE id = ?').run(subcategoryId);
    if (result.changes === 0) throw new Error('Subcategory not found');
    logAction('subcategory', subcategoryId, 'DELETE');
}
