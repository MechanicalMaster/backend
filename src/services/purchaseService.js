// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { generatePurchaseNumber } from './sequenceService.js';
import { logAction } from './auditService.js';

/**
 * Create a new purchase
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Purchase data
 */
export function createPurchase(shopId, data) {
    return transaction((db) => {
        const purchaseId = generateUUID();
        const purchaseNumber = generatePurchaseNumber(shopId);
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO purchases (id, shop_id, purchase_number, vendor_id, status, date, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            purchaseId,
            shopId,
            purchaseNumber,
            data.vendorId || null,
            data.status || 'UNPAID',
            data.date,
            data.dueDate || null,
            now,
            now
        );

        logAction(shopId, 'purchase', purchaseId, 'CREATE', { purchaseNumber });
        return getPurchase(shopId, purchaseId);
    });
}

/**
 * Get a single purchase
 * @param {string} shopId - Shop UUID
 * @param {string} purchaseId - Purchase UUID
 */
export function getPurchase(shopId, purchaseId) {
    const db = getDatabase();
    const purchase = db.prepare(
        'SELECT * FROM purchases WHERE id = ? AND shop_id = ? AND deleted_at IS NULL'
    ).get(purchaseId, shopId);

    if (!purchase) return null;

    // Get vendor info if exists
    let vendor = null;
    if (purchase.vendor_id) {
        vendor = db.prepare('SELECT id, name, phone FROM vendors WHERE id = ? AND shop_id = ?').get(purchase.vendor_id, shopId);
    }

    return { ...purchase, vendor };
}

/**
 * List all purchases for a shop
 * @param {string} shopId - Shop UUID
 * @param {Object} filters - Optional filters
 */
export function listPurchases(shopId, filters = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM purchases WHERE shop_id = ? AND deleted_at IS NULL';
    const params = [shopId];

    if (filters.vendorId) {
        query += ' AND vendor_id = ?';
        params.push(filters.vendorId);
    }

    if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
    }

    query += ' ORDER BY date DESC, created_at DESC';
    return db.prepare(query).all(...params);
}

/**
 * Update a purchase
 * @param {string} shopId - Shop UUID
 * @param {string} purchaseId - Purchase UUID
 * @param {Object} data - Update data
 */
export function updatePurchase(shopId, purchaseId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
    UPDATE purchases SET vendor_id = ?, status = ?, date = ?, due_date = ?, updated_at = ?
    WHERE id = ? AND shop_id = ? AND deleted_at IS NULL
  `).run(
        data.vendorId || null,
        data.status,
        data.date,
        data.dueDate || null,
        now,
        purchaseId,
        shopId
    );

    if (result.changes === 0) throw new Error('Purchase not found');
    logAction(shopId, 'purchase', purchaseId, 'UPDATE');
    return getPurchase(shopId, purchaseId);
}

/**
 * Soft delete a purchase
 * @param {string} shopId - Shop UUID
 * @param {string} purchaseId - Purchase UUID
 */
export function deletePurchase(shopId, purchaseId) {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE purchases SET deleted_at = ? WHERE id = ? AND shop_id = ? AND deleted_at IS NULL'
    ).run(new Date().toISOString(), purchaseId, shopId);

    if (result.changes === 0) throw new Error('Purchase not found');
    logAction(shopId, 'purchase', purchaseId, 'DELETE');
}
