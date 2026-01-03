// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../../db/init.js';

/**
 * Calculate business pulse metrics
 * @param {string} shopId - Shop UUID
 * @returns {import('./homeSnapshot.types.js').BusinessPulse}
 */
export function calculateBusinessPulse(shopId) {
    const db = getDatabase();

    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - daysToMonday);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const startOfNextWeek = new Date(startOfThisWeek);
    startOfNextWeek.setDate(startOfThisWeek.getDate() + 7);

    // Format dates for SQLite (YYYY-MM-DD)
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Current week: payments IN (received)
    const currentWeek = db.prepare(`
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE shop_id = ? 
        AND type = 'IN'
        AND date >= ?
        AND date < ?
    `).get(shopId, formatDate(startOfThisWeek), formatDate(startOfNextWeek));

    // Last week for comparison
    const lastWeek = db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE shop_id = ? 
        AND type = 'IN'
        AND date >= ?
        AND date < ?
    `).get(shopId, formatDate(startOfLastWeek), formatDate(startOfThisWeek));

    // Calculate percentage change (avoid division by zero)
    const percentChange = lastWeek.total > 0
        ? ((currentWeek.total - lastWeek.total) / lastWeek.total) * 100
        : (currentWeek.total > 0 ? 100 : 0);

    return {
        amountReceivedThisWeek: currentWeek.total,
        percentChangeWoW: Math.round(percentChange * 10) / 10, // 1 decimal place
        paymentsCompleted: currentWeek.count
    };
}
