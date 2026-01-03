// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../../db/init.js';

/**
 * Calculate primary action (most used in last 30 days)
 * @param {string} shopId - Shop UUID
 * @returns {import('./homeSnapshot.types.js').PrimaryAction}
 */
export function calculatePrimaryAction(shopId) {
    const db = getDatabase();

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    // Count invoices
    const invoiceCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE shop_id = ? 
        AND created_at >= ?
        AND deleted_at IS NULL
    `).get(shopId, cutoffDate).count;

    // Count purchases
    const purchaseCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM purchases 
        WHERE shop_id = ? 
        AND created_at >= ?
        AND deleted_at IS NULL
    `).get(shopId, cutoffDate).count;

    // Count payments (used as proxy for expense tracking)
    const paymentCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM payments 
        WHERE shop_id = ? 
        AND created_at >= ?
        AND type = 'OUT'
    `).get(shopId, cutoffDate).count;

    // Determine most used action
    const max = Math.max(invoiceCount, purchaseCount, paymentCount);

    if (max === 0) {
        // Default to INVOICE if no activity
        return { mostUsed: 'INVOICE' };
    }

    if (invoiceCount === max) {
        return { mostUsed: 'INVOICE' };
    }

    if (purchaseCount === max) {
        return { mostUsed: 'PURCHASE' };
    }

    return { mostUsed: 'EXPENSE' };
}
