// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';

/**
 * Get next sequence number for invoice, purchase, or payment
 * Thread-safe via SQLite's transaction isolation
 * Sequences are per-shop to allow multiple shops to have their own numbering
 * 
 * @param {string} shopId - Shop UUID
 * @param {string} key - Sequence key
 * @returns {number} Next sequence number
 */
export function getNextSequence(shopId, key) {
    const db = getDatabase();

    const stmt = db.prepare(`
        UPDATE sequences SET value = value + 1 
        WHERE shop_id = ? AND key = ? 
        RETURNING value
    `);
    const result = stmt.get(shopId, key);

    if (!result) {
        throw new Error(`Sequence not found: ${key} for shop ${shopId}`);
    }

    return result.value;
}

/**
 * Generate formatted invoice number (per-shop unique)
 * Format: INV-YYYY-NNNN
 * @param {string} shopId - Shop UUID
 */
export function generateInvoiceNumber(shopId) {
    const seq = getNextSequence(shopId, 'invoice_seq');
    const year = new Date().getFullYear();
    return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate formatted purchase number (per-shop unique)
 * Format: PUR-YYYY-NNNN
 * @param {string} shopId - Shop UUID
 */
export function generatePurchaseNumber(shopId) {
    const seq = getNextSequence(shopId, 'purchase_seq');
    const year = new Date().getFullYear();
    return `PUR-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate formatted payment/transaction number (per-shop unique)
 * Format: PAY-YYYY-NNNN
 * @param {string} shopId - Shop UUID
 */
export function generatePaymentNumber(shopId) {
    const seq = getNextSequence(shopId, 'payment_seq');
    const year = new Date().getFullYear();
    return `PAY-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Reset a sequence (use with caution)
 * @param {string} shopId - Shop UUID
 * @param {string} key - Sequence key
 * @param {number} value - New value
 */
export function resetSequence(shopId, key, value = 1) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE sequences SET value = ? WHERE shop_id = ? AND key = ?');
    stmt.run(value, shopId, key);
}
