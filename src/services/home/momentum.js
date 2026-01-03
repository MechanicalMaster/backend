// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../../db/init.js';

/**
 * Calculate momentum metrics (invoice streak)
 * @param {string} shopId - Shop UUID
 * @returns {import('./homeSnapshot.types.js').Momentum}
 */
export function calculateMomentum(shopId) {
    const db = getDatabase();

    // Get all invoice creation dates (distinct days)
    const dates = db.prepare(`
        SELECT DISTINCT DATE(created_at) as date
        FROM invoices
        WHERE shop_id = ?
        AND deleted_at IS NULL
        ORDER BY date DESC
    `).all(shopId);

    // Count consecutive days from today backwards
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const row of dates) {
        const invoiceDate = new Date(row.date + 'T00:00:00');
        const diffDays = Math.floor((currentDate - invoiceDate) / (1000 * 60 * 60 * 24));

        if (diffDays === streak) {
            // Consecutive day
            streak++;
            currentDate = new Date(invoiceDate);
        } else if (diffDays > streak) {
            // Gap found, streak is broken
            break;
        }
    }

    // Total sent this week
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - daysToMonday);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const thisWeek = db.prepare(`
        SELECT COUNT(*) as count
        FROM invoices
        WHERE shop_id = ?
        AND DATE(created_at) >= ?
        AND deleted_at IS NULL
    `).get(shopId, formatDate(startOfThisWeek));

    return {
        invoiceStreakDays: streak,
        totalSentThisWeek: thisWeek.count
    };
}
