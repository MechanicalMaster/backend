// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../../db/init.js';

/**
 * Generate curated activity cards (business logic, not raw data)
 * 
 * Rules:
 * 1. First card: oldest overdue invoice (if any)
 * 2. Second card: last paid invoice (if any)  
 * 3. Third card: risk summary OR recent creation
 * 
 * @param {string} shopId - Shop UUID
 * @returns {import('./homeSnapshot.types.js').ActivityCard[]}
 */
export function generateRecentActivity(shopId) {
    const db = getDatabase();
    const cards = [];
    const today = new Date().toISOString().split('T')[0];

    // Card 1: Oldest overdue invoice
    const overdue = db.prepare(`
        SELECT 
            i.id, 
            i.invoice_number, 
            i.due_date, 
            it.grand_total,
            ics.name as customer_name
        FROM invoices i
        JOIN invoice_totals it ON i.id = it.invoice_id
        LEFT JOIN invoice_customer_snapshot ics ON i.id = ics.invoice_id
        WHERE i.shop_id = ?
        AND i.status IN ('UNPAID', 'PARTIAL')
        AND i.due_date < ?
        AND i.deleted_at IS NULL
        ORDER BY i.due_date ASC
        LIMIT 1
    `).get(shopId, today);

    if (overdue) {
        cards.push({
            type: 'INVOICE',
            title: `Overdue: ${overdue.invoice_number}`,
            subtitle: overdue.customer_name || 'Unknown Customer',
            amount: overdue.grand_total,
            status: 'OVERDUE',
            date: overdue.due_date,
            entityId: overdue.id
        });
    }

    // Card 2: Last paid invoice
    const lastPaid = db.prepare(`
        SELECT 
            i.id, 
            i.invoice_number, 
            i.date,
            it.grand_total,
            ics.name as customer_name
        FROM invoices i
        JOIN invoice_totals it ON i.id = it.invoice_id
        LEFT JOIN invoice_customer_snapshot ics ON i.id = ics.invoice_id
        WHERE i.shop_id = ?
        AND i.status = 'PAID'
        AND i.deleted_at IS NULL
        ORDER BY i.updated_at DESC
        LIMIT 1
    `).get(shopId);

    if (lastPaid) {
        cards.push({
            type: 'INVOICE',
            title: `Paid: ${lastPaid.invoice_number}`,
            subtitle: lastPaid.customer_name || 'Unknown Customer',
            amount: lastPaid.grand_total,
            status: 'PAID',
            date: lastPaid.date,
            entityId: lastPaid.id
        });
    }

    // Card 3: Risk summary if unpaid invoices exist, otherwise recent creation
    const unpaidCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM invoices
        WHERE shop_id = ?
        AND status IN ('UNPAID', 'PARTIAL')
        AND deleted_at IS NULL
    `).get(shopId).count;

    if (unpaidCount > 0 && cards.length < 3) {
        const unpaidTotal = db.prepare(`
            SELECT COALESCE(SUM(it.grand_total), 0) as total
            FROM invoices i
            JOIN invoice_totals it ON i.id = it.invoice_id
            WHERE i.shop_id = ?
            AND i.status IN ('UNPAID', 'PARTIAL')
            AND i.deleted_at IS NULL
        `).get(shopId).total;

        cards.push({
            type: 'RISK',
            title: `${unpaidCount} Unpaid Invoice${unpaidCount > 1 ? 's' : ''}`,
            subtitle: 'Action required',
            amount: unpaidTotal,
            status: 'UNPAID',
            date: today,
            entityId: '' // No specific entity
        });
    } else if (cards.length < 3) {
        // Show most recent invoice creation
        const recent = db.prepare(`
            SELECT 
                i.id, 
                i.invoice_number, 
                i.date,
                it.grand_total,
                ics.name as customer_name
            FROM invoices i
            JOIN invoice_totals it ON i.id = it.invoice_id
            LEFT JOIN invoice_customer_snapshot ics ON i.id = ics.invoice_id
            WHERE i.shop_id = ?
            AND i.deleted_at IS NULL
            ORDER BY i.created_at DESC
            LIMIT 1
        `).get(shopId);

        if (recent) {
            cards.push({
                type: 'INVOICE',
                title: `Recent: ${recent.invoice_number}`,
                subtitle: recent.customer_name || 'Unknown Customer',
                amount: recent.grand_total,
                status: 'CREATED',
                date: recent.date,
                entityId: recent.id
            });
        }
    }

    return cards;
}
