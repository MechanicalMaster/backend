// SECURITY: All queries in this service MUST be scoped by shopId

import { getDatabase } from '../db/init.js';
import { generateUUID } from '../utils/uuid.js';
import { createChildLogger } from '../utils/logger.js';

const shopLogger = createChildLogger('shop');

/**
 * Create a new shop
 * @param {string} name - Shop name
 * @returns {Object} Created shop
 */
export function createShop(name) {
    const db = getDatabase();
    const shopId = generateUUID();
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO shops (id, name, created_at)
        VALUES (?, ?, ?)
    `).run(shopId, name, now);

    // Initialize sequences for the new shop
    initializeShopSequences(shopId);

    shopLogger.info({ shopId, name }, 'Shop created');

    return { id: shopId, name, created_at: now };
}

/**
 * Initialize default sequences for a shop
 * @param {string} shopId - Shop UUID
 */
export function initializeShopSequences(shopId) {
    const db = getDatabase();
    const sequences = [
        { key: 'invoice_seq', value: 1 },
        { key: 'purchase_seq', value: 1 },
        { key: 'payment_seq', value: 1 }
    ];

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO sequences (shop_id, key, value) VALUES (?, ?, ?)
    `);

    sequences.forEach(seq => {
        insertStmt.run(shopId, seq.key, seq.value);
    });

    shopLogger.debug({ shopId }, 'Initialized shop sequences');
}

/**
 * Get a shop by ID
 * @param {string} shopId - Shop UUID
 * @returns {Object|null} Shop or null
 */
export function getShop(shopId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) || null;
}

/**
 * Update shop details (ADMIN only)
 * @param {string} shopId - Shop UUID
 * @param {Object} data - Update data
 * @returns {Object} Updated shop
 */
export function updateShop(shopId, data) {
    const db = getDatabase();

    const result = db.prepare(`
        UPDATE shops SET name = ? WHERE id = ?
    `).run(data.name, shopId);

    if (result.changes === 0) {
        throw new Error('Shop not found');
    }

    shopLogger.info({ shopId }, 'Shop updated');

    return getShop(shopId);
}
