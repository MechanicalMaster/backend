// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../../db/init.js';

/**
 * Calculate risk summary (unpaid invoices)
 * @param {string} shopId - Shop UUID
 * @returns {import('./homeSnapshot.types.js').RiskSummary}
 */
export function calculateRiskSummary(shopId) {
    const db = getDatabase();

    const result = db.prepare(`
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(it.grand_total - COALESCE(paid.total, 0)), 0) as unpaid
        FROM invoices i
        JOIN invoice_totals it ON i.id = it.invoice_id
        LEFT JOIN (
            SELECT invoice_id, SUM(amount) as total
            FROM payment_allocations
            GROUP BY invoice_id
        ) paid ON i.id = paid.invoice_id
        WHERE i.shop_id = ?
        AND i.status IN ('UNPAID', 'PARTIAL')
        AND i.deleted_at IS NULL
    `).get(shopId);

    return {
        unpaidInvoicesCount: result.count,
        unpaidAmount: result.unpaid
    };
}
