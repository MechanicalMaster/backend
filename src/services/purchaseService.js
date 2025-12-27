import { getDatabase, transaction } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { generatePurchaseNumber } from './sequenceService.js';
import { logAction } from './auditService.js';

/**
 * Create a new purchase
 */
export function createPurchase(data) {
    return transaction((db) => {
        const purchaseId = generateUUID();
        const purchaseNumber = generatePurchaseNumber();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO purchases (id, purchase_number, vendor_id, status, date, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            purchaseId,
            purchaseNumber,
            data.vendorId || null,
            data.status || 'UNPAID',
            data.date,
            data.dueDate || null,
            now,
            now
        );

        logAction('purchase', purchaseId, 'CREATE', { purchaseNumber });
        return getPurchase(purchaseId);
    });
}

/**
 * Get a single purchase
 */
export function getPurchase(purchaseId) {
    const db = getDatabase();
    const purchase = db.prepare(
        'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL'
    ).get(purchaseId);

    if (!purchase) return null;

    // Get vendor info if exists
    let vendor = null;
    if (purchase.vendor_id) {
        vendor = db.prepare('SELECT id, name, phone FROM vendors WHERE id = ?').get(purchase.vendor_id);
    }

    return { ...purchase, vendor };
}

/**
 * List all purchases
 */
export function listPurchases(filters = {}) {
    const db = getDatabase();
    let query = 'SELECT * FROM purchases WHERE deleted_at IS NULL';
    const params = [];

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
 */
export function updatePurchase(purchaseId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
    UPDATE purchases SET vendor_id = ?, status = ?, date = ?, due_date = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(
        data.vendorId || null,
        data.status,
        data.date,
        data.dueDate || null,
        now,
        purchaseId
    );

    if (result.changes === 0) throw new Error('Purchase not found');
    logAction('purchase', purchaseId, 'UPDATE');
    return getPurchase(purchaseId);
}

/**
 * Soft delete a purchase
 */
export function deletePurchase(purchaseId) {
    const db = getDatabase();
    const result = db.prepare(
        'UPDATE purchases SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
    ).run(new Date().toISOString(), purchaseId);

    if (result.changes === 0) throw new Error('Purchase not found');
    logAction('purchase', purchaseId, 'DELETE');
}
