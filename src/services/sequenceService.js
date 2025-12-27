import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';

/**
 * Get next sequence number for invoice, purchase, or payment
 * Thread-safe via SQLite's transaction isolation
 * 
 * @param {string} key - Sequence key
 * @returns {number} Next sequence number
 */
export function getNextSequence(key) {
    const db = getDatabase();

    const stmt = db.prepare('UPDATE sequences SET value = value + 1 WHERE key = ? RETURNING value');
    const result = stmt.get(key);

    if (!result) {
        throw new Error(`Sequence not found: ${key}`);
    }

    return result.value;
}

/**
 * Generate formatted invoice number
 * Format: INV-YYYY-NNNN
 */
export function generateInvoiceNumber() {
    const seq = getNextSequence('invoice_seq');
    const year = new Date().getFullYear();
    return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate formatted purchase number
 * Format: PUR-YYYY-NNNN
 */
export function generatePurchaseNumber() {
    const seq = getNextSequence('purchase_seq');
    const year = new Date().getFullYear();
    return `PUR-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate formatted payment/transaction number
 * Format: PAY-YYYY-NNNN
 */
export function generatePaymentNumber() {
    const seq = getNextSequence('payment_seq');
    const year = new Date().getFullYear();
    return `PAY-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Reset a sequence (use with caution)
 */
export function resetSequence(key, value = 1) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE sequences SET value = ? WHERE key = ?');
    stmt.run(value, key);
}
